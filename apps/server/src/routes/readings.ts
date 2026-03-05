import { FastifyInstance } from 'fastify';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { devices, readings } from '@sensor/db';
import { ErrorCode } from '@sensor/shared';

function encodeCursor(ts: Date, messageId: string): string {
  return Buffer.from(JSON.stringify({ ts: ts.toISOString(), msg: messageId }), 'utf-8').toString('base64url');
}

function decodeCursor(cursor: string): { ts: Date; msg: string } | null {
  try {
    const j = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8')) as { ts?: string; msg?: string };
    if (typeof j.ts === 'string' && typeof j.msg === 'string') return { ts: new Date(j.ts), msg: j.msg };
  } catch {
    // ignore
  }
  return null;
}

export async function readingsRoutes(app: FastifyInstance) {
  app.get('/api/v1/devices/:serial/readings', async (request, reply) => {
    const { serial } = request.params as { serial: string };
    const { limit: limitStr, since, until, cursor } = request.query as {
      limit?: string;
      since?: string;
      until?: string;
      cursor?: string;
    };

    const [device] = await app.db
      .select({ id: devices.id, decommissionedAt: devices.decommissionedAt })
      .from(devices)
      .where(eq(devices.serial, serial));

    if (!device || device.decommissionedAt) {
      return reply.code(404).send({
        ok: false,
        error: { code: ErrorCode.DEVICE_NOT_FOUND, message: 'Device not found' },
      });
    }

    const limit = Math.min(Math.max(parseInt(limitStr ?? '50', 10) || 50, 1), 100);
    const conditions = [eq(readings.deviceId, device.id)];

    if (since) conditions.push(gte(readings.timestamp, new Date(since)));
    if (until) conditions.push(lte(readings.timestamp, new Date(until)));

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        conditions.push(sql`(${readings.timestamp}, ${readings.messageId}) < (${decoded.ts}::timestamptz, ${decoded.msg})`);
      }
    }

    const rows = await app.db
      .select({
        timestamp: readings.timestamp,
        messageId: readings.messageId,
        temperatureC: readings.temperatureC,
        humidityPct: readings.humidityPct,
        batteryPct: readings.batteryPct,
        rssiDbm: readings.rssiDbm,
      })
      .from(readings)
      .where(and(...conditions))
      .orderBy(desc(readings.timestamp), desc(readings.messageId))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const out = rows.slice(0, limit);
    const nextCursor = hasMore && out.length > 0
      ? encodeCursor(out[out.length - 1].timestamp, out[out.length - 1].messageId)
      : null;

    return {
      ok: true,
      data: out.map((r) => ({
        timestamp: r.timestamp.toISOString(),
        temperatureC: r.temperatureC,
        humidityPct: r.humidityPct,
        batteryPct: r.batteryPct,
        rssiDbm: r.rssiDbm,
      })),
      cursor: nextCursor,
    };
  });
}
