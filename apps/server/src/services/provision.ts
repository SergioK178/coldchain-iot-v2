import { eq, isNull, and } from 'drizzle-orm';
import { type Db, devices, zones, locations } from '@sensor/db';
import { parseSerial, ErrorCode, type ProvisionRequest } from '@sensor/shared';
import {
  generateMosquittoHash,
  generateMqttPassword,
  mqttUsernameFromSerial,
  rebuildMosquittoFiles,
} from '../lib/mosquitto-files.js';
import { reloadMosquitto } from '../lib/mosquitto-reload.js';
import { type AuditService } from './audit.js';
import { type Env } from '../config.js';

export interface ProvisionDeps {
  db: Db;
  audit: AuditService;
  env: Env;
  adminPasswordHash: string;
}

async function getActiveDevicesForMosquitto(db: Db) {
  return db
    .select({
      serial: devices.serial,
      username: devices.mqttUsername,
      passwordHash: devices.mqttPasswordHash,
    })
    .from(devices)
    .where(isNull(devices.decommissionedAt));
}

export async function reconcileMosquitto(deps: ProvisionDeps) {
  const activeDevices = await getActiveDevicesForMosquitto(deps.db);

  await rebuildMosquittoFiles({
    dataDir: deps.env.MOSQUITTO_DATA_DIR,
    adminUsername: deps.env.MQTT_ADMIN_USER,
    adminPasswordHash: deps.adminPasswordHash,
    devices: activeDevices,
  });

  await reloadMosquitto({
    socketPath: deps.env.DOCKER_SOCKET,
    containerName: deps.env.MOSQUITTO_CONTAINER_NAME,
  });
}

export async function provisionDevice(
  deps: ProvisionDeps,
  input: ProvisionRequest,
  actor: string,
) {
  // P2: validate serial format and extract device type
  const parsed = parseSerial(input.serial);

  // P12: reconcile before conflict check
  await reconcileMosquitto(deps);

  // Check if already provisioned
  const existing = await deps.db
    .select({ id: devices.id })
    .from(devices)
    .where(and(eq(devices.serial, input.serial), isNull(devices.decommissionedAt)));

  if (existing.length > 0) {
    return { error: ErrorCode.DEVICE_ALREADY_PROVISIONED } as const;
  }

  // Validate zoneId if provided
  let zoneId = input.zoneId;
  if (zoneId) {
    const zone = await deps.db
      .select({ id: zones.id })
      .from(zones)
      .where(eq(zones.id, zoneId));
    if (zone.length === 0) {
      return { error: ErrorCode.ZONE_NOT_FOUND } as const;
    }
  } else {
    // Default zone
    const defaultZone = await deps.db
      .select({ id: zones.id })
      .from(zones)
      .where(eq(zones.name, 'Default Zone'));
    zoneId = defaultZone[0]?.id;
  }

  // P3: generate MQTT credentials
  const mqttUsername = mqttUsernameFromSerial(input.serial);
  const plaintextPassword = generateMqttPassword();
  // P4: hash for Mosquitto password_file
  const mqttPasswordHash = await generateMosquittoHash(plaintextPassword);

  // Insert device
  const [device] = await deps.db
    .insert(devices)
    .values({
      serial: input.serial,
      displayName: input.displayName ?? null,
      zoneId: zoneId ?? null,
      powerSource: input.powerSource,
      calibrationOffsetC: input.calibrationOffsetC ?? 0,
      mqttUsername,
      mqttPasswordHash,
    })
    .returning();

  // P6: full rebuild passwd/acl + reload
  try {
    await reconcileMosquitto(deps);
  } catch (err) {
    // P11: if rebuild/reload fails after DB write, return 500
    // System recoverable via reconcile at next startup/operation
    throw err;
  }

  // P10: audit
  await deps.audit.append({
    action: 'device.provisioned',
    entityType: 'device',
    entityId: device.id,
    actor,
    details: { serial: input.serial, deviceType: parsed.type },
  });

  // P8: return plaintext password once
  return {
    data: {
      serial: input.serial,
      deviceType: parsed.type,
      displayName: input.displayName ?? null,
      mqtt: {
        username: mqttUsername,
        password: plaintextPassword,
        topic: `d/${input.serial}/t`,
        statusTopic: `d/${input.serial}/s`,
      },
    },
  } as const;
}

export async function decommissionDevice(
  deps: ProvisionDeps,
  serial: string,
  actor: string,
) {
  const [device] = await deps.db
    .select({ id: devices.id, decommissionedAt: devices.decommissionedAt })
    .from(devices)
    .where(eq(devices.serial, serial));

  if (!device) {
    return { error: ErrorCode.DEVICE_NOT_FOUND } as const;
  }
  if (device.decommissionedAt) {
    return { error: ErrorCode.DEVICE_NOT_FOUND } as const;
  }

  const now = new Date();
  await deps.db
    .update(devices)
    .set({ decommissionedAt: now })
    .where(eq(devices.id, device.id));

  // P9: rebuild + reload
  try {
    await reconcileMosquitto(deps);
  } catch (err) {
    throw err;
  }

  // P10: audit
  await deps.audit.append({
    action: 'device.decommissioned',
    entityType: 'device',
    entityId: device.id,
    actor,
    details: { serial },
  });

  return {
    data: { serial, decommissionedAt: now.toISOString() },
  } as const;
}
