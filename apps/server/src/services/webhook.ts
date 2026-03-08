import { createHmac } from 'node:crypto';
import { eq, and, lt, isNull } from 'drizzle-orm';
import { type Db, webhooks, webhookDeliveries } from '@sensor/db';
import { validateWebhookUrl } from '../lib/webhook-url-policy.js';

const RETRY_BACKOFF_SEC = [10, 30, 120, 600, 1800]; // 10s, 30s, 2m, 10m, 30m
const MAX_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 10_000;

export type WebhookEvent =
  | 'alert.triggered'
  | 'alert.acknowledged'
  | 'device.online'
  | 'device.offline'
  | 'device.provisioned'
  | 'device.decommissioned';

function signPayload(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

export interface WebhookServiceDeps {
  db: Db;
  webhookAllowlistHosts: string;
}

export function createWebhookService(deps: WebhookServiceDeps) {
  const { db } = deps;

  async function deliverOne(deliveryId: string) {
    const [row] = await db
      .select({
        id: webhookDeliveries.id,
        webhookId: webhookDeliveries.webhookId,
        event: webhookDeliveries.event,
        payload: webhookDeliveries.payload,
        attempt: webhookDeliveries.attempt,
      })
      .from(webhookDeliveries)
      .innerJoin(webhooks, eq(webhookDeliveries.webhookId, webhooks.id))
      .where(
        and(
          eq(webhookDeliveries.id, deliveryId),
          eq(webhooks.isActive, true),
          isNull(webhookDeliveries.deliveredAt),
        ),
      );

    if (!row || row.attempt >= MAX_ATTEMPTS) return;

    const [webhook] = await db.select().from(webhooks).where(eq(webhooks.id, row.webhookId));
    if (!webhook) return;

    const urlCheck = await validateWebhookUrl(webhook.url, deps.webhookAllowlistHosts);
    if (!urlCheck.ok) {
      await db
        .update(webhookDeliveries)
        .set({
          attempt: MAX_ATTEMPTS,
          error: `Webhook target blocked: ${urlCheck.reason}`,
          nextRetryAt: null,
        })
        .where(eq(webhookDeliveries.id, deliveryId));
      return;
    }

    const body = JSON.stringify(row.payload);
    const signature = signPayload(body, webhook.secret);
    try {
      const res = await fetch(webhook.url, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature-256': `sha256=${signature}`,
        },
        body,
        signal: AbortSignal.timeout(15_000),
      });

      if (res.status >= 200 && res.status < 300) {
        await db
          .update(webhookDeliveries)
          .set({ deliveredAt: new Date(), responseCode: res.status })
          .where(eq(webhookDeliveries.id, deliveryId));
      } else {
        const nextAttempt = row.attempt + 1;
        const nextRetryAt = new Date(Date.now() + (RETRY_BACKOFF_SEC[nextAttempt - 1] ?? 1800) * 1000);
        await db
          .update(webhookDeliveries)
          .set({
            attempt: nextAttempt,
            responseCode: res.status,
            error: `HTTP ${res.status}`,
            nextRetryAt: nextAttempt < MAX_ATTEMPTS ? nextRetryAt : null,
          })
          .where(eq(webhookDeliveries.id, deliveryId));
      }
    } catch (err: unknown) {
      const nextAttempt = row.attempt + 1;
      const nextRetryAt = new Date(Date.now() + (RETRY_BACKOFF_SEC[nextAttempt - 1] ?? 1800) * 1000);
      await db
        .update(webhookDeliveries)
        .set({
          attempt: nextAttempt,
          error: err instanceof Error ? err.message : String(err),
          nextRetryAt: nextAttempt < MAX_ATTEMPTS ? nextRetryAt : null,
        })
        .where(eq(webhookDeliveries.id, deliveryId));
    }
  }

  return {
    async emit(event: WebhookEvent, payload: Record<string, unknown>) {
      const list = await db
        .select()
        .from(webhooks)
        .where(eq(webhooks.isActive, true));
      for (const w of list) {
        if (!w.events.includes(event)) continue;
        const nextRetryAt = new Date(Date.now() + RETRY_BACKOFF_SEC[0] * 1000);
        const [delivery] = await db
          .insert(webhookDeliveries)
          .values({
            webhookId: w.id,
            event,
            payload,
            attempt: 1,
            nextRetryAt,
          })
          .returning();
        if (delivery) deliverOne(delivery.id).catch(() => {});
      }
    },

    async enqueueDelivery(webhookId: string, event: WebhookEvent, payload: Record<string, unknown>) {
      const nextRetryAt = new Date(Date.now() + RETRY_BACKOFF_SEC[0] * 1000);
      const [delivery] = await db
        .insert(webhookDeliveries)
        .values({
          webhookId,
          event,
          payload,
          attempt: 1,
          nextRetryAt,
        })
        .returning();
      if (delivery) deliverOne(delivery.id).catch(() => {});
    },

    startRetryLoop(logger?: { error: (o: object, msg: string) => void }) {
      const log = logger ?? { error: () => {} };
      const interval = setInterval(async () => {
        try {
          const pending = await db
            .select({ id: webhookDeliveries.id })
            .from(webhookDeliveries)
            .where(
              and(
                lt(webhookDeliveries.nextRetryAt, new Date()),
                isNull(webhookDeliveries.deliveredAt),
                lt(webhookDeliveries.attempt, MAX_ATTEMPTS),
              ),
            )
            .limit(50);
          for (const p of pending) {
            await deliverOne(p.id);
          }
        } catch (err) {
          log.error({ err: err instanceof Error ? err.message : String(err) }, 'Webhook retry loop error');
        }
      }, POLL_INTERVAL_MS);
      return () => clearInterval(interval);
    },

    signPayload,
  };
}

export type WebhookService = ReturnType<typeof createWebhookService>;
