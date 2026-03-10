import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ErrorCode } from '@sensor/shared';
import { getRefreshCookieMaxAge } from '../lib/auth.js';
import { InMemoryRateLimiter } from '../lib/auth-rate-limit.js';

const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

function setRefreshCookie(
  reply: import('fastify').FastifyReply,
  value: string,
  maxAge: number,
  secure: boolean,
) {
  const parts = [
    `refreshToken=${encodeURIComponent(value)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push('Secure');
  reply.header('Set-Cookie', parts.join('; '));
}

function clearRefreshCookie(reply: import('fastify').FastifyReply, secure: boolean) {
  const parts = [
    'refreshToken=',
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];
  if (secure) parts.push('Secure');
  reply.header('Set-Cookie', parts.join('; '));
}

export async function authRoutes(app: FastifyInstance) {
  const limiter = new InMemoryRateLimiter();
  const maxAge = getRefreshCookieMaxAge();
  const loginCfg = {
    max: app.env.AUTH_RATE_LIMIT_LOGIN_MAX,
    windowSec: app.env.AUTH_RATE_LIMIT_LOGIN_WINDOW_SEC,
    blockSec: app.env.AUTH_RATE_LIMIT_BLOCK_SEC,
  };
  const refreshCfg = {
    max: app.env.AUTH_RATE_LIMIT_REFRESH_MAX,
    windowSec: app.env.AUTH_RATE_LIMIT_REFRESH_WINDOW_SEC,
    blockSec: app.env.AUTH_RATE_LIMIT_BLOCK_SEC,
  };

  function shouldUseSecureCookie(request: import('fastify').FastifyRequest): boolean {
    if (app.env.AUTH_COOKIE_SECURE === 'true') return true;
    if (app.env.AUTH_COOKIE_SECURE === 'false') return false;
    if (request.protocol === 'https') return true;
    const proto = request.headers['x-forwarded-proto'];
    if (typeof proto === 'string' && proto.split(',')[0]?.trim().toLowerCase() === 'https') return true;
    // In auto mode only set Secure when request is actually HTTPS.
    return false;
  }

  function getClientIp(request: import('fastify').FastifyRequest): string {
    return request.ip || request.socket.remoteAddress || 'unknown';
  }

  app.post('/api/v1/auth/login', async (request, reply) => {
    const parsed = LoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: ErrorCode.VALIDATION_ERROR, message: parsed.error.message },
      });
    }
    const ip = getClientIp(request);
    const loginKey = `login:${ip}:${parsed.data.email.toLowerCase()}`;
    const attempt = limiter.consume(loginKey, loginCfg);
    if (!attempt.allowed) {
      reply.header('Retry-After', String(attempt.retryAfterSec));
      return reply.code(429).send({
        ok: false,
        error: { code: ErrorCode.TOO_MANY_REQUESTS, message: 'Too many login attempts' },
      });
    }

    const result = await app.authService.login(parsed.data.email, parsed.data.password);
    if ('error' in result) {
      return reply.code(401).send({
        ok: false,
        error: { code: ErrorCode.INVALID_CREDENTIALS, message: 'Invalid email or password' },
      });
    }
    limiter.reset(loginKey);
    const secure = shouldUseSecureCookie(request);
    setRefreshCookie(reply, result.refreshToken, maxAge, secure);
    return reply.send({ ok: true, data: { accessToken: result.accessToken, user: result.user } });
  });

  function getRefreshFromCookie(request: import('fastify').FastifyRequest): string | undefined {
    const raw = request.headers.cookie;
    if (!raw) return undefined;
    const m = raw.match(/refreshToken=([^;]+)/);
    return m ? decodeURIComponent(m[1].trim()) : undefined;
  }

  app.post('/api/v1/auth/refresh', async (request, reply) => {
    const ip = getClientIp(request);
    const refreshKey = `refresh:${ip}`;
    const attempt = limiter.consume(refreshKey, refreshCfg);
    if (!attempt.allowed) {
      reply.header('Retry-After', String(attempt.retryAfterSec));
      return reply.code(429).send({
        ok: false,
        error: { code: ErrorCode.TOO_MANY_REQUESTS, message: 'Too many refresh attempts' },
      });
    }

    const token = getRefreshFromCookie(request);
    if (!token) {
      app.log.info({ hasCookie: !!request.headers.cookie }, 'Refresh 401: missing token');
      return reply.code(401).send({
        ok: false,
        error: { code: ErrorCode.UNAUTHORIZED, message: 'Missing refresh token' },
      });
    }
    const result = await app.authService.refresh(token);
    if ('error' in result) {
      app.log.info('Refresh 401: invalid or expired token');
      const secure = shouldUseSecureCookie(request);
      clearRefreshCookie(reply, secure);
      return reply.code(401).send({
        ok: false,
        error: { code: ErrorCode.UNAUTHORIZED, message: 'Invalid or expired refresh token' },
      });
    }
    limiter.reset(refreshKey);
    const secure = shouldUseSecureCookie(request);
    setRefreshCookie(reply, result.refreshToken, maxAge, secure);
    return reply.send({ ok: true, data: { accessToken: result.accessToken, user: result.user } });
  });

  app.post('/api/v1/auth/logout', async (request, reply) => {
    const token = getRefreshFromCookie(request);
    if (token) await app.authService.logout(token);
    const secure = shouldUseSecureCookie(request);
    clearRefreshCookie(reply, secure);
    return reply.send({ ok: true, data: {} });
  });
}
