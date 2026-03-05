import { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { webhooks, webhookDeliveries } from '@sensor/db';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { ErrorCode } from '@sensor/shared';
import type { WebhookEvent } from '../services/webhook.js';
import { validateWebhookUrl } from '../lib/webhook-url-policy.js';

const EVENTS: WebhookEvent[] = [
  'alert.triggered',
  'alert.acknowledged',
  'device.online',
  'device.offline',
  'device.provisioned',
  'device.decommissioned',
];

const CreateWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum(EVENTS as [string, ...string[]])).min(1),
});

const PatchWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.enum(EVENTS as [string, ...string[]])).optional(),
  isActive: z.boolean().optional(),
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

function generateSecret(): string {
  return randomBytes(32).toString('hex');
}

export async function webhookRoutes(app: FastifyInstance) {
  app.get('/api/v1/webhooks', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const list = await app.db
      .select({
        id: webhooks.id,
        url: webhooks.url,
        events: webhooks.events,
        isActive: webhooks.isActive,
        createdAt: webhooks.createdAt,
      })
      .from(webhooks)
      .orderBy(desc(webhooks.createdAt));
    return reply.send({ ok: true, data: list });
  });

  app.post('/api/v1/webhooks', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const parsed = CreateWebhookSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: ErrorCode.VALIDATION_ERROR, message: parsed.error.message },
      });
    }
    const urlCheck = await validateWebhookUrl(parsed.data.url, app.env.WEBHOOK_ALLOWLIST_HOSTS);
    if (!urlCheck.ok) {
      return reply.code(400).send({
        ok: false,
        error: { code: ErrorCode.WEBHOOK_URL_FORBIDDEN, message: urlCheck.reason },
      });
    }
    const secret = generateSecret();
    const [created] = await app.db
      .insert(webhooks)
      .values({
        url: parsed.data.url,
        secret,
        events: parsed.data.events,
        isActive: true,
        createdBy: request.user?.type === 'jwt' ? request.user.sub : null,
      })
      .returning();
    await app.audit.append({
      action: 'webhook.created',
      entityType: 'webhook',
      entityId: created!.id,
      actor: request.actor ?? 'api_token',
      details: { url: created!.url },
    });
    return reply.code(201).send({
      ok: true,
      data: {
        id: created!.id,
        url: created!.url,
        events: created!.events,
        isActive: created!.isActive,
        secret,
        createdAt: created!.createdAt,
      },
    });
  });

  app.patch('/api/v1/webhooks/:id', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const parsed = PatchWebhookSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: ErrorCode.VALIDATION_ERROR, message: parsed.error.message },
      });
    }
    if (parsed.data.url !== undefined) {
      const urlCheck = await validateWebhookUrl(parsed.data.url, app.env.WEBHOOK_ALLOWLIST_HOSTS);
      if (!urlCheck.ok) {
        return reply.code(400).send({
          ok: false,
          error: { code: ErrorCode.WEBHOOK_URL_FORBIDDEN, message: urlCheck.reason },
        });
      }
    }
    const [existing] = await app.db.select().from(webhooks).where(eq(webhooks.id, id));
    if (!existing) {
      return reply.code(404).send({
        ok: false,
        error: { code: ErrorCode.WEBHOOK_NOT_FOUND, message: 'Webhook not found' },
      });
    }
    const updates: { url?: string; events?: string[]; isActive?: boolean } = {};
    if (parsed.data.url !== undefined) updates.url = parsed.data.url;
    if (parsed.data.events !== undefined) updates.events = parsed.data.events;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
    const [updated] = await app.db.update(webhooks).set(updates).where(eq(webhooks.id, id)).returning();
    await app.audit.append({
      action: 'webhook.updated',
      entityType: 'webhook',
      entityId: id,
      actor: request.actor ?? 'api_token',
      details: updates,
    });
    return reply.send({
      ok: true,
      data: {
        id: updated!.id,
        url: updated!.url,
        events: updated!.events,
        isActive: updated!.isActive,
      },
    });
  });

  app.delete('/api/v1/webhooks/:id', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const [existing] = await app.db.select().from(webhooks).where(eq(webhooks.id, id));
    if (!existing) {
      return reply.code(404).send({
        ok: false,
        error: { code: ErrorCode.WEBHOOK_NOT_FOUND, message: 'Webhook not found' },
      });
    }
    await app.db.delete(webhooks).where(eq(webhooks.id, id));
    await app.audit.append({
      action: 'webhook.deleted',
      entityType: 'webhook',
      entityId: id,
      actor: request.actor ?? 'api_token',
      details: { url: existing.url },
    });
    return reply.send({ ok: true, data: {} });
  });

  app.get('/api/v1/webhooks/:id/deliveries', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const [wh] = await app.db.select().from(webhooks).where(eq(webhooks.id, id));
    if (!wh) {
      return reply.code(404).send({
        ok: false,
        error: { code: ErrorCode.WEBHOOK_NOT_FOUND, message: 'Webhook not found' },
      });
    }
    const { limit: limitStr } = request.query as { limit?: string };
    const limit = Math.min(parseInt(limitStr ?? '100', 10) || 100, 500);
    const list = await app.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, id))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit);
    return reply.send({
      ok: true,
      data: list.map((d) => ({
        id: d.id,
        event: d.event,
        attempt: d.attempt,
        responseCode: d.responseCode,
        error: d.error,
        deliveredAt: d.deliveredAt?.toISOString() ?? null,
        createdAt: d.createdAt?.toISOString(),
      })),
    });
  });

  app.post('/api/v1/webhooks/:id/test', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const [wh] = await app.db.select().from(webhooks).where(eq(webhooks.id, id));
    if (!wh) {
      return reply.code(404).send({
        ok: false,
        error: { code: ErrorCode.WEBHOOK_NOT_FOUND, message: 'Webhook not found' },
      });
    }
    await app.webhookService.enqueueDelivery(id, 'alert.triggered', {
      event: 'alert.triggered',
      triggeredAt: new Date().toISOString(),
      test: true,
      device: { serial: 'TEST', displayName: 'Test', zoneName: null, locationName: null },
      rule: { metric: 'temperature_c', operator: 'gt', threshold: 0 },
      reading: { value: 0, timestamp: new Date().toISOString() },
    });
    return reply.send({ ok: true, data: { sent: true } });
  });
}
