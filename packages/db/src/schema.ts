import { pgTable, uuid, varchar, timestamp, real, integer, boolean, text, jsonb, unique } from 'drizzle-orm/pg-core';

// --- organizations ---
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// --- locations ---
export const locations = pgTable('locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  address: varchar('address', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// --- zones ---
export const zones = pgTable('zones', {
  id: uuid('id').primaryKey().defaultRandom(),
  locationId: uuid('location_id').references(() => locations.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// --- devices ---
export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  serial: varchar('serial', { length: 50 }).notNull().unique(),
  displayName: varchar('display_name', { length: 255 }),
  zoneId: uuid('zone_id').references(() => zones.id),
  powerSource: varchar('power_source', { length: 20 }).notNull(),
  calibrationOffsetC: real('calibration_offset_c').default(0),
  firmwareVersion: varchar('firmware_version', { length: 20 }),
  isOnline: boolean('is_online').default(false),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  lastTemperatureC: real('last_temperature_c'),
  lastHumidityPct: real('last_humidity_pct'),
  lastBatteryPct: integer('last_battery_pct'),
  provisionedAt: timestamp('provisioned_at', { withTimezone: true }).defaultNow(),
  decommissionedAt: timestamp('decommissioned_at', { withTimezone: true }),
  mqttUsername: varchar('mqtt_username', { length: 100 }).notNull().unique(),
  mqttPasswordHash: varchar('mqtt_password_hash', { length: 255 }).notNull(),
});

// --- readings ---
// TimescaleDB hypertable by timestamp (applied in post-migration SQL)
export const readings = pgTable('readings', {
  deviceId: uuid('device_id').references(() => devices.id).notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
  messageId: text('message_id').notNull(),
  temperatureC: real('temperature_c'),
  humidityPct: real('humidity_pct'),
  batteryPct: integer('battery_pct'),
  rssiDbm: integer('rssi_dbm'),
  rawPayload: text('raw_payload').notNull(),
});

// --- ingestion_dedup ---
export const ingestionDedup = pgTable('ingestion_dedup', {
  deviceId: uuid('device_id').references(() => devices.id).notNull(),
  messageId: varchar('message_id', { length: 64 }).notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  unique('uq_device_message').on(table.deviceId, table.messageId),
]);

// --- alert_rules ---
export const alertRules = pgTable('alert_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').references(() => devices.id).notNull(),
  metric: varchar('metric', { length: 50 }).notNull(),
  operator: varchar('operator', { length: 4 }).notNull(),
  threshold: real('threshold').notNull(),
  isActive: boolean('is_active').default(true),
  cooldownMinutes: integer('cooldown_minutes').notNull().default(15),
  lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// --- alert_events ---
export const alertEvents = pgTable('alert_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  alertRuleId: uuid('alert_rule_id').references(() => alertRules.id).notNull(),
  deviceId: uuid('device_id').references(() => devices.id).notNull(),
  triggeredAt: timestamp('triggered_at', { withTimezone: true }).defaultNow(),
  readingValue: real('reading_value').notNull(),
  thresholdValue: real('threshold_value').notNull(),
  callbackAttempted: boolean('callback_attempted').default(false),
  callbackResponseCode: integer('callback_response_code'),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  acknowledgedBy: varchar('acknowledged_by', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// --- audit_log ---
export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow(),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: varchar('entity_id', { length: 100 }),
  actor: varchar('actor', { length: 255 }).notNull(),
  details: jsonb('details'),
});
