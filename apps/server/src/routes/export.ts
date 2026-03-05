import { FastifyInstance } from 'fastify';
import { eq, and, gte, lte, desc, inArray, isNull } from 'drizzle-orm';
import { devices, readings, zones } from '@sensor/db';

const MAX_DAYS = 31;
const MAX_ROWS = 5000;

function parseSinceUntil(since?: string, until?: string): { since: Date; until: Date } | null {
  if (!since || !until) return null;
  const s = new Date(since);
  const u = new Date(until);
  if (Number.isNaN(s.getTime()) || Number.isNaN(u.getTime())) return null;
  if (u <= s) return null;
  const days = (u.getTime() - s.getTime()) / (24 * 60 * 60 * 1000);
  if (days > MAX_DAYS) return null;
  return { since: s, until: u };
}

export async function exportRoutes(app: FastifyInstance) {
  app.get('/api/v1/export/readings', async (request, reply) => {
    const { deviceSerial, locationId, since, until, format } = request.query as {
      deviceSerial?: string;
      locationId?: string;
      since?: string;
      until?: string;
      format?: string;
    };

    if (!format || (format !== 'csv' && format !== 'pdf')) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'format must be csv or pdf' },
      });
    }

    const range = parseSinceUntil(since, until);
    if (!range) {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'since and until required, max 31 days' },
      });
    }

    let deviceIds: string[] = [];
    if (deviceSerial) {
      const [d] = await app.db
        .select({ id: devices.id })
        .from(devices)
        .where(and(eq(devices.serial, deviceSerial), isNull(devices.decommissionedAt)));
      if (!d) {
        return reply.code(404).send({
          ok: false,
          error: { code: 'DEVICE_NOT_FOUND', message: 'Device not found' },
        });
      }
      deviceIds = [d.id];
    } else if (locationId) {
      const zoneRows = await app.db
        .select({ id: zones.id })
        .from(zones)
        .where(eq(zones.locationId, locationId));
      const zoneIds = zoneRows.map((z) => z.id);
      if (zoneIds.length === 0) {
        return reply.code(200).header('Content-Type', 'text/csv; charset=utf-8').send('timestamp,serial,temperature_c,humidity_pct,battery_pct\n');
      }
      const devRows = await app.db
        .select({ id: devices.id })
        .from(devices)
        .where(and(inArray(devices.zoneId, zoneIds), isNull(devices.decommissionedAt)));
      deviceIds = devRows.map((d) => d.id).filter(Boolean);
    } else {
      return reply.code(400).send({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'deviceSerial or locationId required' },
      });
    }

    if (deviceIds.length === 0) {
      const empty = format === 'csv' ? 'timestamp,serial,temperature_c,humidity_pct,battery_pct\n' : '';
      await app.audit.append({
        action: 'export.readings',
        entityType: 'export',
        entityId: null,
        actor: request.actor ?? 'unknown',
        details: { format, deviceSerial, locationId, since, until, rowCount: 0 },
      });
      if (format === 'csv') {
        return reply
          .header('Content-Type', 'text/csv; charset=utf-8')
          .header('Content-Disposition', 'attachment; filename="readings.csv"')
          .send(empty);
      }
      return reply.code(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'PDF not implemented' } });
    }

    const rows = await app.db
      .select({
        timestamp: readings.timestamp,
        deviceId: readings.deviceId,
        temperatureC: readings.temperatureC,
        humidityPct: readings.humidityPct,
        batteryPct: readings.batteryPct,
      })
      .from(readings)
      .where(and(inArray(readings.deviceId, deviceIds), gte(readings.timestamp, range.since), lte(readings.timestamp, range.until)))
      .orderBy(desc(readings.timestamp))
      .limit(MAX_ROWS);

    const deviceIdToSerial = new Map<string, string>();
    for (const id of deviceIds) {
      const [d] = await app.db.select({ serial: devices.serial }).from(devices).where(eq(devices.id, id));
      if (d) deviceIdToSerial.set(id, d.serial);
    }

    await app.audit.append({
      action: 'export.readings',
      entityType: 'export',
      entityId: null,
      actor: request.actor ?? 'unknown',
      details: { format, deviceSerial, locationId, since, until, rowCount: rows.length },
    });

    if (format === 'csv') {
      const header = 'timestamp,serial,temperature_c,humidity_pct,battery_pct\n';
      const lines = rows.map((r) => {
        const serial = deviceIdToSerial.get(r.deviceId) ?? '';
        const ts = r.timestamp.toISOString();
        const t = r.temperatureC ?? '';
        const h = r.humidityPct ?? '';
        const b = r.batteryPct ?? '';
        return `${ts},${serial},${t},${h},${b}`;
      });
      const csv = header + lines.join('\n');
      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="readings.csv"')
        .send(csv);
    }

    return reply.code(400).send({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'PDF not implemented, use format=csv' } });
  });
}
