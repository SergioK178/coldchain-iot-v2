import { FastifyInstance } from 'fastify';
import { ErrorCode } from '@sensor/shared';
import { verifyAccessToken } from '../lib/auth.js';

const AUTH_PATHS = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout',
]);

function isPublicPath(url: string): boolean {
  if (url === '/api/v1/health' || url === '/api/v1/ready') return true;
  if (url === '/api/docs' || url.startsWith('/api/docs/')) return true;
  return AUTH_PATHS.has(url);
}

export async function authPlugin(app: FastifyInstance) {
  const jwtSecret = app.env.JWT_SECRET;

  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/api/')) return;
    if (isPublicPath(request.url.split('?')[0] ?? '')) return;

    const auth = request.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return reply.code(401).send({
        ok: false,
        error: { code: ErrorCode.UNAUTHORIZED, message: 'Invalid or missing access token' },
      });
    }

    const token = auth.slice(7);

    // JWT: three base64 parts separated by dots
    if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
      const user = await verifyAccessToken(token, jwtSecret);
      if (user) {
        request.user = { type: 'jwt', sub: user.sub, email: user.email, role: user.role };
        request.actor = user.email;
        return;
      }
    }

    return reply.code(401).send({
      ok: false,
      error: { code: ErrorCode.UNAUTHORIZED, message: 'Invalid or missing access token' },
    });
  });
}
