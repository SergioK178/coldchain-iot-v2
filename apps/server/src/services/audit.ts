import { type Db, auditLog } from '@sensor/db';
import { desc, eq, and, gte } from 'drizzle-orm';

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  actor: string;
  details?: Record<string, unknown> | null;
}

export function createAuditService(db: Db) {
  return {
    async append(entry: AuditEntry) {
      await db.insert(auditLog).values({
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        actor: entry.actor,
        details: entry.details ?? null,
      });
    },

    async query(filters: {
      since?: Date;
      action?: string;
      entityType?: string;
      limit?: number;
    }) {
      const conditions = [];
      if (filters.since) {
        conditions.push(gte(auditLog.timestamp, filters.since));
      }
      if (filters.action) {
        conditions.push(eq(auditLog.action, filters.action));
      }
      if (filters.entityType) {
        conditions.push(eq(auditLog.entityType, filters.entityType));
      }

      return db
        .select()
        .from(auditLog)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(auditLog.timestamp))
        .limit(filters.limit ?? 100);
    },
  };
}

export type AuditService = ReturnType<typeof createAuditService>;
