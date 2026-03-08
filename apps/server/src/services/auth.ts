import { eq, and, isNull } from 'drizzle-orm';
import { type Db, users, refreshTokens } from '@sensor/db';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  createRefreshTokenValue,
  hashRefreshToken,
  getRefreshExpiresAt,
  type UserRole,
} from '../lib/auth.js';

const REFRESH_COOKIE_NAME = 'refreshToken';

export interface AuthServiceDeps {
  db: Db;
  jwtSecret: string;
}

export function createAuthService(deps: AuthServiceDeps) {
  const { db, jwtSecret } = deps;

  return {
    async login(email: string, password: string) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()));

      if (!user || !(await verifyPassword(user.passwordHash, password))) {
        return { error: 'INVALID_CREDENTIALS' as const };
      }

      const refreshValue = createRefreshTokenValue();
      const expiresAt = getRefreshExpiresAt();
      await db.insert(refreshTokens).values({
        userId: user.id,
        tokenHash: hashRefreshToken(refreshValue, jwtSecret),
        expiresAt,
      });

      const accessToken = await signAccessToken(
        { sub: user.id, email: user.email, role: user.role as UserRole },
        jwtSecret,
      );

      return {
        accessToken,
        refreshToken: refreshValue,
        refreshExpiresAt: expiresAt,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    },

    async refresh(refreshTokenValue: string) {
      const hash = hashRefreshToken(refreshTokenValue, jwtSecret);
      const [row] = await db
        .select({
          id: refreshTokens.id,
          userId: refreshTokens.userId,
          expiresAt: refreshTokens.expiresAt,
        })
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, hash));

      if (!row || row.expiresAt < new Date()) {
        if (row) await db.delete(refreshTokens).where(eq(refreshTokens.id, row.id));
        return { error: 'INVALID_REFRESH' as const };
      }

      const [user] = await db.select().from(users).where(eq(users.id, row.userId));
      if (!user) {
        await db.delete(refreshTokens).where(eq(refreshTokens.id, row.id));
        return { error: 'INVALID_REFRESH' as const };
      }

      await db.delete(refreshTokens).where(eq(refreshTokens.id, row.id));

      const newRefreshValue = createRefreshTokenValue();
      const expiresAt = getRefreshExpiresAt();
      await db.insert(refreshTokens).values({
        userId: user.id,
        tokenHash: hashRefreshToken(newRefreshValue, jwtSecret),
        expiresAt,
      });

      const accessToken = await signAccessToken(
        { sub: user.id, email: user.email, role: user.role as UserRole },
        jwtSecret,
      );

      return {
        accessToken,
        refreshToken: newRefreshValue,
        refreshExpiresAt: expiresAt,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      };
    },

    async logout(refreshTokenValue: string) {
      const hash = hashRefreshToken(refreshTokenValue, jwtSecret);
      await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, hash));
    },

    refreshCookieName: REFRESH_COOKIE_NAME,
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
