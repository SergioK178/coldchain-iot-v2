import { FastifyInstance } from 'fastify';
import { eq, and, gte, lte, desc, inArray, isNull } from 'drizzle-orm';
import { devices, readings, zones, locations } from '@sensor/db';
import PDFDocument from 'pdfkit';

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
    const { deviceSerial, locationId, zoneId, since, until, format } = request.query as {
      deviceSerial?: string;
      locationId?: string;
      zoneId?: string;
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
    } else if (zoneId) {
      const devRows = await app.db
        .select({ id: devices.id })
        .from(devices)
        .where(and(eq(devices.zoneId, zoneId), isNull(devices.decommissionedAt)));
      deviceIds = devRows.map((d) => d.id).filter(Boolean);
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
        error: { code: 'VALIDATION_ERROR', message: 'deviceSerial, zoneId or locationId required' },
      });
    }

    if (deviceIds.length === 0) {
      const empty = format === 'csv' ? 'timestamp,serial,temperature_c,humidity_pct,battery_pct\n' : '';
      await app.audit.append({
        action: 'export.readings',
        entityType: 'export',
        entityId: null,
        actor: request.actor ?? 'unknown',
        details: { format, deviceSerial, locationId, zoneId, since, until, rowCount: 0 },
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

    const deviceRows = await app.db
      .select({
        id: devices.id,
        serial: devices.serial,
        displayName: devices.displayName,
        zoneName: zones.name,
        locationName: locations.name,
      })
      .from(devices)
      .leftJoin(zones, eq(devices.zoneId, zones.id))
      .leftJoin(locations, eq(zones.locationId, locations.id))
      .where(inArray(devices.id, deviceIds));
    const deviceIdToSerial = new Map(deviceRows.map((d) => [d.id, d.serial]));
    const deviceLabels = deviceRows.map((d) => d.displayName || d.serial).filter(Boolean);
    const zoneLabels = [...new Set(deviceRows.map((d) => d.zoneName).filter(Boolean))] as string[];
    const locationLabels = [...new Set(deviceRows.map((d) => d.locationName).filter(Boolean))] as string[];

    await app.audit.append({
      action: 'export.readings',
      entityType: 'export',
      entityId: null,
      actor: request.actor ?? 'unknown',
      details: { format, deviceSerial, locationId, zoneId, since, until, rowCount: rows.length },
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

    // PDF
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const generatedAt = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    const actor = request.actor ?? '—';

    doc.fontSize(16).text('ColdChain IoT — Экспорт показаний', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`Период: ${range.since.toISOString().slice(0, 10)} — ${range.until.toISOString().slice(0, 10)}`, { align: 'center' });
    doc.text(`Время генерации: ${generatedAt}`, { align: 'center' });
    if (locationLabels.length > 0) doc.text(`Локация: ${locationLabels.join(', ')}`, { align: 'center' });
    if (zoneLabels.length > 0) doc.text(`Зона: ${zoneLabels.join(', ')}`, { align: 'center' });
    if (deviceLabels.length > 0) doc.text(`Устройства: ${deviceLabels.join(', ')}`, { align: 'center' });
    doc.text(`Сгенерировал: ${actor}`, { align: 'center' });
    doc.moveDown(1);

    const colWidths = [120, 100, 70, 70, 60];
    const headers = ['Дата/время', 'Serial', 'Температура °C', 'Влажность %', 'Батарея %'];
    let y = doc.y;
    doc.fontSize(9).font('Helvetica-Bold');
    headers.forEach((h, i) => {
      doc.text(h, 40 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y, { width: colWidths[i] });
    });
    y += 20;
    doc.font('Helvetica');

    for (const r of rows) {
      const serial = deviceIdToSerial.get(r.deviceId) ?? '';
      const ts = r.timestamp.toISOString().slice(0, 19).replace('T', ' ');
      const t = r.temperatureC != null ? String(r.temperatureC) : '—';
      const h = r.humidityPct != null ? String(r.humidityPct) : '—';
      const b = r.batteryPct != null ? String(r.batteryPct) : '—';
      const rowY = doc.y;
      if (rowY > 750) {
        doc.addPage();
        y = 40;
      }
      doc.text(ts, 40, y, { width: colWidths[0] });
      doc.text(serial, 40 + colWidths[0], y, { width: colWidths[1] });
      doc.text(t, 40 + colWidths[0] + colWidths[1], y, { width: colWidths[2] });
      doc.text(h, 40 + colWidths[0] + colWidths[1] + colWidths[2], y, { width: colWidths[3] });
      doc.text(b, 40 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], y, { width: colWidths[4] });
      y += 18;
    }

    doc.moveDown(2);
    doc.fontSize(8).fillColor('#666').text('Сгенерировано в АИС Колдчейн', { align: 'center' });

    doc.end();
    const pdfBuffer = await pdfPromise;
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', 'attachment; filename="readings.pdf"')
      .send(pdfBuffer);
  });
}
