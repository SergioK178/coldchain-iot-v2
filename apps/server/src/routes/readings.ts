import { FastifyInstance } from 'fastify';
import { eq, and, gte, lte, desc, isNull } from 'drizzle-orm';
import { devices, readings } from '@sensor/db';
import { ErrorCode } from '@sensor/shared';

export async function readingsRoutes(app: FastifyInstance) {
  app.get('/api/v1/devices/:serial/readings', async (request, reply) => {
    const { serial } = request.params as { serial: string };
    const { limit: limitStr, since, until } = request.query as {
      limit?: string;
      since?: string;
      until?: string;
    };

    // Find device
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

    const limit = Math.min(Math.max(parseInt(limitStr ?? '100', 10) || 100, 1), 1000);
    const conditions = [eq(readings.deviceId, device.id)];

    if (since) conditions.push(gte(readings.timestamp, new Date(since)));
    if (until) conditions.push(lte(readings.timestamp, new Date(until)));

    const rows = await app.db
      .select({
        timestamp: readings.timestamp,
        temperatureC: readings.temperatureC,
        humidityPct: readings.humidityPct,
        batteryPct: readings.batteryPct,
        rssiDbm: readings.rssiDbm,
      })
      .from(readings)
      .where(and(...conditions))
      .orderBy(desc(readings.timestamp))
      .limit(limit);

    return {
      ok: true,
      data: rows.map((r) => ({
        timestamp: r.timestamp.toISOString(),
        temperatureC: r.temperatureC,
        humidityPct: r.humidityPct,
        batteryPct: r.batteryPct,
        rssiDbm: r.rssiDbm,
      })),
    };
  });
}
