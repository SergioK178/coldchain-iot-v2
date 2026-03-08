import { eq, isNull, and, lt, sql, inArray } from 'drizzle-orm';
import { type Db, devices, zones, locations, alertEvents } from '@sensor/db';
import { parseSerial, ErrorCode, type PatchDevice } from '@sensor/shared';
import { type AuditService } from './audit.js';

export function createDeviceService(db: Db, audit: AuditService) {
  return {
    async list(opts?: { limit?: number }) {
      const limit = Math.min(Math.max(opts?.limit ?? 500, 1), 1000);
      const rows = await db
        .select({
          serial: devices.serial,
          displayName: devices.displayName,
          zoneName: zones.name,
          locationName: locations.name,
          powerSource: devices.powerSource,
          calibrationOffsetC: devices.calibrationOffsetC,
          lastSeenAt: devices.lastSeenAt,
          lastTemperatureC: devices.lastTemperatureC,
          lastHumidityPct: devices.lastHumidityPct,
          lastBatteryPct: devices.lastBatteryPct,
          isOnline: devices.isOnline,
          provisionedAt: devices.provisionedAt,
          deviceId: devices.id,
        })
        .from(devices)
        .leftJoin(zones, eq(devices.zoneId, zones.id))
        .leftJoin(locations, eq(zones.locationId, locations.id))
        .where(isNull(devices.decommissionedAt))
        .limit(limit);

      // Check unacknowledged alerts per device
      const deviceIds = rows.map((r) => r.deviceId);
      const unackAlerts = deviceIds.length > 0
        ? await db
            .select({
              deviceId: alertEvents.deviceId,
              count: sql<number>`count(*)::int`,
            })
            .from(alertEvents)
            .where(and(
              isNull(alertEvents.acknowledgedAt),
              inArray(alertEvents.deviceId, deviceIds),
            ))
            .groupBy(alertEvents.deviceId)
        : [];

      const alertMap = new Map(unackAlerts.map((a) => [a.deviceId, a.count]));

      return rows.map((r) => {
        let type = 'TH';
        try {
          type = parseSerial(r.serial).type;
        } catch {
          // Fallback for legacy/invalid serial format
        }
        const hasUnackAlert = (alertMap.get(r.deviceId) ?? 0) > 0;
        return {
        serial: r.serial,
          deviceType: type,
          displayName: r.displayName,
          zoneName: r.zoneName,
          locationName: r.locationName,
          powerSource: r.powerSource,
          calibrationOffsetC: r.calibrationOffsetC ?? 0,
          lastSeenAt: r.lastSeenAt?.toISOString() ?? null,
          lastTemperatureC: r.lastTemperatureC,
          lastHumidityPct: r.lastHumidityPct,
          lastBatteryPct: r.lastBatteryPct,
          connectivityStatus: r.isOnline ? 'online' as const : 'offline' as const,
          alertStatus: hasUnackAlert ? 'alert' as const : 'normal' as const,
          provisionedAt: r.provisionedAt!.toISOString(),
        };
      });
    },

    async getBySerial(serial: string) {
      const [row] = await db
        .select({
          serial: devices.serial,
          displayName: devices.displayName,
          zoneName: zones.name,
          locationName: locations.name,
          powerSource: devices.powerSource,
          calibrationOffsetC: devices.calibrationOffsetC,
          lastSeenAt: devices.lastSeenAt,
          lastTemperatureC: devices.lastTemperatureC,
          lastHumidityPct: devices.lastHumidityPct,
          lastBatteryPct: devices.lastBatteryPct,
          isOnline: devices.isOnline,
          provisionedAt: devices.provisionedAt,
          deviceId: devices.id,
        })
        .from(devices)
        .leftJoin(zones, eq(devices.zoneId, zones.id))
        .leftJoin(locations, eq(zones.locationId, locations.id))
        .where(and(eq(devices.serial, serial), isNull(devices.decommissionedAt)));

      if (!row) return null;

      const unackCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(alertEvents)
        .where(and(isNull(alertEvents.acknowledgedAt), eq(alertEvents.deviceId, row.deviceId)));

      let type: string = 'TH';
      try {
        type = parseSerial(row.serial).type;
      } catch {
        // Fallback for legacy/invalid serial format
      }

      return {
        serial: row.serial,
        deviceType: type,
        displayName: row.displayName,
        zoneName: row.zoneName,
        locationName: row.locationName,
        powerSource: row.powerSource,
        calibrationOffsetC: row.calibrationOffsetC ?? 0,
        lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
        lastTemperatureC: row.lastTemperatureC,
        lastHumidityPct: row.lastHumidityPct,
        lastBatteryPct: row.lastBatteryPct,
        connectivityStatus: row.isOnline ? ('online' as const) : ('offline' as const),
        alertStatus: (unackCount[0]?.count ?? 0) > 0 ? ('alert' as const) : ('normal' as const),
        provisionedAt: row.provisionedAt!.toISOString(),
      };
    },

    async patch(serial: string, input: PatchDevice, actor: string) {
      const [device] = await db
        .select({ id: devices.id, decommissionedAt: devices.decommissionedAt })
        .from(devices)
        .where(eq(devices.serial, serial));

      if (!device || device.decommissionedAt) {
        return { error: ErrorCode.DEVICE_NOT_FOUND } as const;
      }

      if (input.zoneId !== undefined && input.zoneId !== null) {
        const [zone] = await db
          .select({ id: zones.id })
          .from(zones)
          .where(eq(zones.id, input.zoneId));
        if (!zone) {
          return { error: ErrorCode.ZONE_NOT_FOUND } as const;
        }
      }

      const updates: Record<string, unknown> = {};
      if (input.displayName !== undefined) updates.displayName = input.displayName;
      if (input.zoneId !== undefined) updates.zoneId = input.zoneId;
      if (input.calibrationOffsetC !== undefined) updates.calibrationOffsetC = input.calibrationOffsetC;

      if (Object.keys(updates).length > 0) {
        await db.update(devices).set(updates).where(eq(devices.id, device.id));

        await audit.append({
          action: 'config.changed',
          entityType: 'device',
          entityId: device.id,
          actor,
          details: { serial, changes: updates },
        });
      }

      return { data: await this.getBySerial(serial) };
    },

    /**
     * Mark devices offline if lastSeenAt > timeout threshold.
     */
    async checkOfflineDevices(timeoutSec: number) {
      const threshold = new Date(Date.now() - timeoutSec * 1000);
      const stale = await db
        .select({ id: devices.id, serial: devices.serial })
        .from(devices)
        .where(
          and(
            eq(devices.isOnline, true),
            isNull(devices.decommissionedAt),
            lt(devices.lastSeenAt, threshold),
          ),
        );

      for (const dev of stale) {
        await db
          .update(devices)
          .set({ isOnline: false })
          .where(eq(devices.id, dev.id));

        await audit.append({
          action: 'device.offline',
          entityType: 'device',
          entityId: dev.id,
          actor: 'system',
          details: { serial: dev.serial, reason: 'timeout' },
        });
      }

      return stale.length;
    },

    /**
     * Handle status message (online/offline) from MQTT d/+/s.
     */
    async handleStatusMessage(serial: string, payload: string) {
      const [device] = await db
        .select({ id: devices.id, decommissionedAt: devices.decommissionedAt })
        .from(devices)
        .where(eq(devices.serial, serial));

      if (!device || device.decommissionedAt) return;

      const isOnline = payload.trim() === '1';

      await db
        .update(devices)
        .set({
          isOnline,
          ...(isOnline ? { lastSeenAt: new Date() } : {}),
        })
        .where(eq(devices.id, device.id));

      await audit.append({
        action: isOnline ? 'device.online' : 'device.offline',
        entityType: 'device',
        entityId: device.id,
        actor: 'system',
        details: { serial },
      });
    },
  };
}

export type DeviceService = ReturnType<typeof createDeviceService>;
