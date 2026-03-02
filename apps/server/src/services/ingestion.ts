import { eq, and, isNull } from 'drizzle-orm';
import { type Db, devices, readings, ingestionDedup } from '@sensor/db';
import {
  DevicePayloadSchema,
  parseSerial,
  DEVICE_TYPES,
  type DevicePayload,
  type DeviceTypeCode,
} from '@sensor/shared';
import { type AuditService } from './audit.js';

const MAX_PAYLOAD_BYTES = 512;

export interface IngestionDeps {
  db: Db;
  audit: AuditService;
  onReading?: (deviceId: string, reading: {
    temperatureC: number | null;
    humidityPct: number | null;
    timestamp: Date;
  }) => Promise<void>;
}

export function createIngestionService(deps: IngestionDeps) {
  const { db, audit } = deps;

  return {
    async handleTelemetry(rawPayloadStr: string) {
      // I1: size check
      if (Buffer.byteLength(rawPayloadStr, 'utf-8') > MAX_PAYLOAD_BYTES) {
        await audit.append({
          action: 'payload.invalid',
          entityType: 'telemetry',
          actor: 'system',
          details: { reason: 'payload_too_large', size: Buffer.byteLength(rawPayloadStr, 'utf-8') },
        });
        return;
      }

      // I1: validate schema
      let payload: DevicePayload;
      try {
        payload = DevicePayloadSchema.parse(JSON.parse(rawPayloadStr));
      } catch (err) {
        await audit.append({
          action: 'payload.invalid',
          entityType: 'telemetry',
          actor: 'system',
          details: { reason: 'schema_validation', raw: rawPayloadStr },
        });
        return;
      }

      // I2: check device registered
      const [device] = await db
        .select({
          id: devices.id,
          serial: devices.serial,
          calibrationOffsetC: devices.calibrationOffsetC,
          decommissionedAt: devices.decommissionedAt,
        })
        .from(devices)
        .where(eq(devices.serial, payload.id));

      if (!device || device.decommissionedAt) {
        await audit.append({
          action: 'device.unknown_message',
          entityType: 'device',
          actor: 'system',
          details: { serial: payload.id, raw: rawPayloadStr },
        });
        return;
      }

      // I4: capability validation
      let parsedType: DeviceTypeCode;
      try {
        parsedType = parseSerial(device.serial).type;
      } catch {
        return;
      }

      const capabilities: readonly string[] = DEVICE_TYPES[parsedType].capabilities;
      if (capabilities.includes('temperature_c') && payload.t === undefined) {
        await audit.append({
          action: 'payload.missing_capability',
          entityType: 'telemetry',
          entityId: device.id,
          actor: 'system',
          details: { serial: device.serial, missing: 'temperature_c' },
        });
        return;
      }
      if (capabilities.includes('humidity_pct') && payload.h === undefined) {
        await audit.append({
          action: 'payload.missing_capability',
          entityType: 'telemetry',
          entityId: device.id,
          actor: 'system',
          details: { serial: device.serial, missing: 'humidity_pct' },
        });
        return;
      }

      // I3: dedup
      const dedupResult = await db
        .insert(ingestionDedup)
        .values({ deviceId: device.id, messageId: payload.mid })
        .onConflictDoNothing({ target: [ingestionDedup.deviceId, ingestionDedup.messageId] })
        .returning({ messageId: ingestionDedup.messageId });

      if (dedupResult.length === 0) {
        // Duplicate — silently ignore (I3)
        return;
      }

      // I5: calibration offset
      const offset = device.calibrationOffsetC ?? 0;
      const temperatureC = payload.t !== undefined ? payload.t + offset : null;
      const humidityPct = payload.h ?? null;
      const readingTimestamp = new Date(payload.ts * 1000);

      // I6: insert reading
      await db.insert(readings).values({
        deviceId: device.id,
        timestamp: readingTimestamp,
        messageId: payload.mid,
        temperatureC,
        humidityPct,
        batteryPct: payload.bat ?? null,
        rssiDbm: payload.rssi ?? null,
        rawPayload: rawPayloadStr,
      });

      // I7: update device
      await db
        .update(devices)
        .set({
          lastSeenAt: new Date(),
          isOnline: true,
          lastTemperatureC: temperatureC,
          lastHumidityPct: humidityPct,
          lastBatteryPct: payload.bat ?? null,
          firmwareVersion: payload.fw ?? undefined,
        })
        .where(eq(devices.id, device.id));

      // I8: alert check callback
      if (deps.onReading) {
        await deps.onReading(device.id, {
          temperatureC,
          humidityPct,
          timestamp: readingTimestamp,
        });
      }
    },
  };
}

export type IngestionService = ReturnType<typeof createIngestionService>;
