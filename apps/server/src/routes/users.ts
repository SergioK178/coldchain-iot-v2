import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { users } from '@sensor/db';
import { z } from 'zod';
import { ErrorCode } from '@sensor/shared';
import { hashPassword, verifyPassword } from '../lib/auth.js';

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
  role: z.enum(['admin', 'operator', 'viewer']),
});

const PatchUserSchema = z.object({
  name: z.string().optional(),
  role: z.enum(['admin', 'operator', 'viewer']).optional(),
});

const PatchPasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

function requireAdmin(request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) {
  const u = request.user;
  if (!u || u.role !== 'admin') {
    reply.code(403).send({
      ok: false,
      error: { code: ErrorCode.FORBIDDEN, message: 'Admin role required' },
    });
    return false;
  }
  return true;
}

export async function userRoutes(app: FastifyInstance) {
  app.get('/api/v1/users/me', async (request, reply) => {
    const u = request.user;
    if (!u) {
      return reply.code(401).send({
        ok: false,
        error: { code: ErrorCode.UNAUTHORIZED, message: 'Not authenticated' },
      });
    }
    const [user] = await app.db
      .select({ id: users.id, email: users.email, name: users.name, role: users.role, telegramChatId: users.telegramChatId })
      .from(users)
      .where(eq(users.id, u.sub));
    if (!user) {
      return reply.code(404).send({
        ok: false,
        error: { code: ErrorCode.USER_NOT_FOUND, message: 'User not found' },
      });
    }
    return reply.send({ ok: true, data: user });
  });

  app.post('/api/v1/users/me/telegram-code', async (request, reply) => {
    const u = request.user;
    if (!u) {
      return reply.code(403).send({
        ok: false,
        error: { code: ErrorCode.FORBIDDEN, message: 'Login required' },
      });
    }
    const { createCode: createTelegramCode } = await import('../lib/telegram-codes.js');
    const { code, expiresIn } = createTelegramCode(u.sub);
    return reply.send({ ok: true, data: { code, expiresIn } });
  });

  app.patch('/api/v1/users/me/telegram', async (request, reply) => {
    const u = request.user;
    if (!u) {
      return reply.code(403).send({
        ok: false,
        error: { code: ErrorCode.FORBIDDEN, message: 'Login required' },
      });
    }
    const body = request.body as { telegramChatId?: string | null };
    if (body.telegramChatId !== null && body.telegramChatId !== undefined && body.telegramChatId !== '') {
      return reply.code(400).send({
        ok: false,
        error: { code: ErrorCode.VALIDATION_ERROR, message: 'Use null to unlink' },
      });
    }
    await app.db.update(users).set({ telegramChatId: null }).where(eq(users.id, u.sub));
    return reply.send({ ok: true, data: {} });
  });

  app.patch('/api/v1/users/me/password', async (request, reply) => {
    const u = request.user;
    if (!u) {
      return reply.code(403).send({
        ok: false,
        error: { code: ErrorCode.FORBIDDEN, message: 'Login required' },
      });
    }
    const parsed = PatchPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: ErrorCode.VALIDATION_ERROR, message: parsed.error.message },
      });
    }
    const [user] = await app.db.select().from(users).where(eq(users.id, u.sub));
    if (!user || !(await verifyPassword(user.passwordHash, parsed.data.currentPassword))) {
      return reply.code(400).send({
        ok: false,
        error: { code: ErrorCode.INVALID_CREDENTIALS, message: 'Current password is wrong' },
      });
    }
    const newHash = await hashPassword(parsed.data.newPassword);
    await app.db.update(users).set({ passwordHash: newHash }).where(eq(users.id, u.sub));
    return reply.send({ ok: true, data: {} });
  });

  app.get('/api/v1/users', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const list = await app.db
      .select({ id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt })
      .from(users);
    return reply.send({ ok: true, data: list });
  });

  app.post('/api/v1/users', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const parsed = CreateUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: ErrorCode.VALIDATION_ERROR, message: parsed.error.message },
      });
    }
    const email = parsed.data.email.toLowerCase();
    const [existing] = await app.db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existing) {
      return reply.code(409).send({
        ok: false,
        error: { code: ErrorCode.VALIDATION_ERROR, message: 'Email already registered' },
      });
    }
    const passwordHash = await hashPassword(parsed.data.password);
    const [created] = await app.db
      .insert(users)
      .values({
        email,
        passwordHash,
        name: parsed.data.name ?? null,
        role: parsed.data.role,
      })
      .returning();
    await app.audit.append({
      action: 'user.created',
      entityType: 'user',
      entityId: created.id,
      actor: request.actor ?? 'system',
      details: { email: created.email, role: created.role },
    });
    return reply.code(201).send({
      ok: true,
      data: { id: created.id, email: created.email, name: created.name, role: created.role },
    });
  });

  app.patch('/api/v1/users/:id', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const u = request.user;
    if (u?.type === 'jwt' && u.sub === id) {
      return reply.code(400).send({
        ok: false,
        error: { code: ErrorCode.VALIDATION_ERROR, message: 'Use /users/me/password to change your own password' },
      });
    }
    const parsed = PatchUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: ErrorCode.VALIDATION_ERROR, message: parsed.error.message },
      });
    }
    const [existing] = await app.db.select().from(users).where(eq(users.id, id));
    if (!existing) {
      return reply.code(404).send({
        ok: false,
        error: { code: ErrorCode.USER_NOT_FOUND, message: 'User not found' },
      });
    }
    const updates: { name?: string; role?: string } = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.role !== undefined) updates.role = parsed.data.role;
    if (Object.keys(updates).length === 0) {
      return reply.send({ ok: true, data: { id: existing.id, email: existing.email, name: existing.name, role: existing.role } });
    }
    const [updated] = await app.db.update(users).set(updates).where(eq(users.id, id)).returning();
    await app.audit.append({
      action: 'user.updated',
      entityType: 'user',
      entityId: id,
      actor: request.actor ?? 'system',
      details: updates,
    });
    return reply.send({
      ok: true,
      data: { id: updated!.id, email: updated!.email, name: updated!.name, role: updated!.role },
    });
  });

  app.delete('/api/v1/users/:id', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    if (request.user?.type === 'jwt' && request.user.sub === id) {
      return reply.code(400).send({
        ok: false,
        error: { code: ErrorCode.VALIDATION_ERROR, message: 'Cannot delete yourself' },
      });
    }
    const [existing] = await app.db.select().from(users).where(eq(users.id, id));
    if (!existing) {
      return reply.code(404).send({
        ok: false,
        error: { code: ErrorCode.USER_NOT_FOUND, message: 'User not found' },
      });
    }
    await app.db.delete(users).where(eq(users.id, id));
    await app.audit.append({
      action: 'user.deleted',
      entityType: 'user',
      entityId: id,
      actor: request.actor ?? 'system',
      details: { email: existing.email },
    });
    return reply.send({ ok: true, data: {} });
  });
}
