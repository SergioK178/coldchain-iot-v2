import { eq, and, isNull, isNotNull, desc, gte, sql } from 'drizzle-orm';
import { type Db, alertRules, alertEvents, devices, zones, locations, users } from '@sensor/db';
import {
  type CreateAlertRule,
  type PatchAlertRule,
  parseSerial,
  DEVICE_TYPES,
  ErrorCode,
} from '@sensor/shared';
import { type AuditService } from './audit.js';
import { type WebhookService } from './webhook.js';
import { sendTelegramMessage, formatAlertMessage } from '../lib/telegram-send.js';

export interface AlertDeps {
  db: Db;
  audit: AuditService;
  webhookService: WebhookService;
  telegramBotToken?: string;
}

export function createAlertService(deps: AlertDeps) {
  const { db, audit, telegramBotToken } = deps;

  return {
    /**
     * A1–A6: Check all active alert rules for a device after a reading.
     */
    async checkAlertRules(
      deviceId: string,
      reading: { temperatureC: number | null; humidityPct: number | null; batteryPct: number | null; timestamp: Date },
    ) {
      const rules = await db
        .select()
        .from(alertRules)
        .where(and(eq(alertRules.deviceId, deviceId), eq(alertRules.isActive, true)));

      for (const rule of rules) {
        // Extract value by metric
        let value: number | null = null;
        if (rule.metric === 'temperature_c') value = reading.temperatureC;
        else if (rule.metric === 'humidity_pct') value = reading.humidityPct;
        else if (rule.metric === 'battery_pct') value = reading.batteryPct;

        if (value === null) continue;

        // A2: compare
        let triggered = false;
        switch (rule.operator) {
          case 'gt':  triggered = value > rule.threshold; break;
          case 'lt':  triggered = value < rule.threshold; break;
          case 'gte': triggered = value >= rule.threshold; break;
          case 'lte': triggered = value <= rule.threshold; break;
        }

        if (!triggered) continue;

        // A3: cooldown
        if (rule.lastTriggeredAt) {
          const cooldownEnd = new Date(
            rule.lastTriggeredAt.getTime() + rule.cooldownMinutes * 60_000,
          );
          if (cooldownEnd > new Date()) continue;
        }

        // A4: create event + update lastTriggeredAt
        const [event] = await db
          .insert(alertEvents)
          .values({
            alertRuleId: rule.id,
            deviceId,
            readingValue: value,
            thresholdValue: rule.threshold,
          })
          .returning();

        await db
          .update(alertRules)
          .set({ lastTriggeredAt: new Date() })
          .where(eq(alertRules.id, rule.id));

        // A8: audit
        await audit.append({
          action: 'alert.triggered',
          entityType: 'alert_event',
          entityId: event.id,
          actor: 'system',
          details: {
            ruleId: rule.id,
            metric: rule.metric,
            operator: rule.operator,
            threshold: rule.threshold,
            readingValue: value,
          },
        });

        // P2: emit to webhook engine (HMAC-signed, retry)
        const [deviceRow] = await db
          .select({
            serial: devices.serial,
            displayName: devices.displayName,
            zoneName: zones.name,
            locationName: locations.name,
          })
          .from(devices)
          .leftJoin(zones, eq(devices.zoneId, zones.id))
          .leftJoin(locations, eq(zones.locationId, locations.id))
          .where(eq(devices.id, deviceId));

        const payload = {
          event: 'alert.triggered',
          triggeredAt: new Date().toISOString(),
          device: {
            serial: deviceRow?.serial,
            displayName: deviceRow?.displayName,
            zoneName: deviceRow?.zoneName,
            locationName: deviceRow?.locationName,
          },
          rule: {
            metric: rule.metric,
            operator: rule.operator,
            threshold: rule.threshold,
          },
          reading: {
            value,
            timestamp: reading.timestamp.toISOString(),
          },
        };
        deps.webhookService.emit('alert.triggered', payload).catch(() => {});

        if (telegramBotToken) {
          const withTelegram = await db
            .select({ telegramChatId: users.telegramChatId })
            .from(users)
            .where(isNotNull(users.telegramChatId));
          const text = formatAlertMessage(payload);
          for (const u of withTelegram) {
            if (u.telegramChatId) {
              sendTelegramMessage(telegramBotToken, u.telegramChatId, text).catch(() => {});
            }
          }
        }
      }
    },

    // --- CRUD for alert rules ---

    async createRule(deviceId: string, input: CreateAlertRule, actor: string) {
      const [rule] = await db
        .insert(alertRules)
        .values({
          deviceId,
          metric: input.metric,
          operator: input.operator,
          threshold: input.threshold,
          cooldownMinutes: input.cooldownMinutes,
        })
        .returning();

      await audit.append({
        action: 'alert_rule.created',
        entityType: 'alert_rule',
        entityId: rule.id,
        actor,
        details: { metric: input.metric, operator: input.operator, threshold: input.threshold },
      });

      return rule;
    },

    async getRulesForDevice(deviceId: string) {
      return db
        .select()
        .from(alertRules)
        .where(eq(alertRules.deviceId, deviceId))
        .orderBy(desc(alertRules.createdAt));
    },

    async patchRule(ruleId: string, input: PatchAlertRule, actor: string) {
      const [existing] = await db
        .select()
        .from(alertRules)
        .where(eq(alertRules.id, ruleId));

      if (!existing) return { error: ErrorCode.ALERT_RULE_NOT_FOUND } as const;

      const updates: Record<string, unknown> = {};
      if (input.threshold !== undefined) updates.threshold = input.threshold;
      if (input.operator !== undefined) updates.operator = input.operator;
      if (input.isActive !== undefined) updates.isActive = input.isActive;
      if (input.cooldownMinutes !== undefined) updates.cooldownMinutes = input.cooldownMinutes;

      const [updated] = await db
        .update(alertRules)
        .set(updates)
        .where(eq(alertRules.id, ruleId))
        .returning();

      await audit.append({
        action: 'alert_rule.updated',
        entityType: 'alert_rule',
        entityId: ruleId,
        actor,
        details: { changes: updates },
      });

      return { data: updated };
    },

    async deleteRule(ruleId: string, actor: string) {
      const [existing] = await db
        .select({ id: alertRules.id })
        .from(alertRules)
        .where(eq(alertRules.id, ruleId));

      if (!existing) return { error: ErrorCode.ALERT_RULE_NOT_FOUND } as const;

      await db.delete(alertRules).where(eq(alertRules.id, ruleId));

      await audit.append({
        action: 'alert_rule.deleted',
        entityType: 'alert_rule',
        entityId: ruleId,
        actor,
      });

      return { data: { id: ruleId } };
    },

    // --- Alert events ---

    async queryEvents(filters: {
      deviceSerial?: string;
      acknowledged?: boolean;
      since?: Date;
      limit?: number;
    }) {
      const conditions = [];

      if (filters.deviceSerial) {
        const [device] = await db
          .select({ id: devices.id })
          .from(devices)
          .where(eq(devices.serial, filters.deviceSerial));
        if (device) {
          conditions.push(eq(alertEvents.deviceId, device.id));
        } else {
          return [];
        }
      }

      if (filters.acknowledged === true) {
        conditions.push(sql`${alertEvents.acknowledgedAt} IS NOT NULL`);
      } else if (filters.acknowledged === false) {
        conditions.push(isNull(alertEvents.acknowledgedAt));
      }

      if (filters.since) {
        conditions.push(gte(alertEvents.triggeredAt, filters.since));
      }

      const rows = await db
        .select({
          id: alertEvents.id,
          deviceId: alertEvents.deviceId,
          alertRuleId: alertEvents.alertRuleId,
          readingValue: alertEvents.readingValue,
          thresholdValue: alertEvents.thresholdValue,
          triggeredAt: alertEvents.triggeredAt,
          acknowledgedAt: alertEvents.acknowledgedAt,
          acknowledgedBy: alertEvents.acknowledgedBy,
          deviceSerial: devices.serial,
          deviceName: devices.displayName,
          metric: alertRules.metric,
          operator: alertRules.operator,
        })
        .from(alertEvents)
        .innerJoin(devices, eq(alertEvents.deviceId, devices.id))
        .innerJoin(alertRules, eq(alertEvents.alertRuleId, alertRules.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(alertEvents.triggeredAt))
        .limit(filters.limit ?? 100);

      return rows.map((r) => ({
        id: r.id,
        deviceSerial: r.deviceSerial,
        deviceName: r.deviceName,
        metric: r.metric,
        operator: r.operator,
        readingValue: r.readingValue,
        thresholdValue: r.thresholdValue,
        triggeredAt: r.triggeredAt!.toISOString(),
        acknowledgedAt: r.acknowledgedAt?.toISOString() ?? null,
        acknowledgedBy: r.acknowledgedBy,
      }));
    },

    async acknowledge(eventId: string, acknowledgedBy: string) {
      const [event] = await db
        .select({ id: alertEvents.id, acknowledgedAt: alertEvents.acknowledgedAt })
        .from(alertEvents)
        .where(eq(alertEvents.id, eventId));

      if (!event) return { error: ErrorCode.ALERT_EVENT_NOT_FOUND } as const;

      // A7: 409 if already acknowledged
      if (event.acknowledgedAt) {
        return { error: ErrorCode.ALREADY_ACKNOWLEDGED } as const;
      }

      const [updated] = await db
        .update(alertEvents)
        .set({ acknowledgedAt: new Date(), acknowledgedBy })
        .where(eq(alertEvents.id, eventId))
        .returning();

      // A8: audit — actor is acknowledgedBy
      await audit.append({
        action: 'alert.acknowledged',
        entityType: 'alert_event',
        entityId: eventId,
        actor: acknowledgedBy,
      });

      return { data: updated };
    },
  };
}

export type AlertService = ReturnType<typeof createAlertService>;
