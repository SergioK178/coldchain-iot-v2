import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { organizations } from '@sensor/db';
import { z } from 'zod';
import { ErrorCode } from '@sensor/shared';

const PatchSiteNameSchema = z.object({
  name: z.string().min(1).max(255),
});

function requireAdmin(request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply): boolean {
  if (request.user?.role !== 'admin') {
    reply.code(403).send({
      ok: false,
      error: { code: ErrorCode.FORBIDDEN, message: 'Admin role required' },
    });
    return false;
  }
  return true;
}

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/api/v1/settings/site-name', async (request, reply) => {
    const [org] = await app.db.select({ name: organizations.name }).from(organizations).limit(1);
    return reply.send({ ok: true, data: { name: org?.name ?? 'Coldchain IoT' } });
  });

  app.patch('/api/v1/settings/site-name', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const parsed = PatchSiteNameSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: ErrorCode.VALIDATION_ERROR, message: parsed.error.message },
      });
    }
    const [org] = await app.db.select().from(organizations).limit(1);
    if (!org) {
      return reply.code(500).send({
        ok: false,
        error: { code: ErrorCode.INTERNAL_ERROR, message: 'No organization' },
      });
    }
    await app.db.update(organizations).set({ name: parsed.data.name }).where(eq(organizations.id, org.id));
    return reply.send({ ok: true, data: { name: parsed.data.name } });
  });
}
