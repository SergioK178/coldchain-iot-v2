import argon2 from 'argon2';
import * as jose from 'jose';
import { randomBytes, createHmac } from 'node:crypto';

const JWT_ACCESS_TTL = '1h';
const REFRESH_DAYS = 7;
const REFRESH_TOKEN_BYTES = 32;

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface JwtUser {
  sub: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    // Old/invalid hashes should be treated as wrong credentials, not a 500.
    return false;
  }
}

export async function signAccessToken(
  payload: { sub: string; email: string; role: UserRole },
  secret: string,
): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_ACCESS_TTL)
    .sign(key);
}

export async function verifyAccessToken(
  token: string,
  secret: string,
): Promise<JwtUser | null> {
  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jose.jwtVerify(token, key);
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      role: payload.role as UserRole,
      iat: payload.iat as number | undefined,
      exp: payload.exp as number | undefined,
    };
  } catch {
    return null;
  }
}

export function createRefreshTokenValue(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
}

/**
 * HMAC-SHA256 hash of a refresh token value.
 * The jwtSecret is used as the HMAC key so that a DB dump alone is not
 * sufficient to forge or verify tokens — the attacker must also have
 * the secret from the environment.
 *
 * NOTE: changing JWT_SECRET invalidates all existing refresh tokens (users
 * must re-authenticate). This is intentional: secret rotation = session revocation.
 */
export function hashRefreshToken(value: string, jwtSecret: string): string {
  return createHmac('sha256', jwtSecret).update(value).digest('hex');
}

export function getRefreshCookieMaxAge(): number {
  return REFRESH_DAYS * 24 * 60 * 60;
}

export function getRefreshExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_DAYS);
  return d;
}
