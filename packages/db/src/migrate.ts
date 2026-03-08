import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const POST_MIGRATION_SQL = `
DO $$
BEGIN
  -- TimescaleDB warns on VARCHAR in hypertable tables; normalize to TEXT once.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'readings'
      AND column_name = 'message_id'
      AND data_type <> 'text'
  ) THEN
    ALTER TABLE readings ALTER COLUMN message_id TYPE text;
  END IF;

  -- Create hypertable if not already one
  IF NOT EXISTS (
    SELECT 1 FROM timescaledb_information.hypertables
    WHERE hypertable_name = 'readings'
  ) THEN
    PERFORM create_hypertable('readings', 'timestamp');
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS readings_device_ts_idx
  ON readings (device_id, "timestamp" DESC);

CREATE INDEX IF NOT EXISTS alert_events_device_unack_idx
  ON alert_events (device_id) WHERE acknowledged_at IS NULL;
`;

const P2_BACKFILL_SQL = `
-- Ensure P2 tables exist even if legacy DB/journal skipped 0001_p2
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(20) NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('admin', 'operator', 'viewer')),
  telegram_chat_id VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url VARCHAR(500) NOT NULL,
  secret VARCHAR(255) NOT NULL,
  events VARCHAR(100)[] NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1,
  response_code INTEGER,
  error TEXT,
  next_retry_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webhook_deliveries_retry_idx
  ON webhook_deliveries(next_retry_at)
  WHERE next_retry_at IS NOT NULL AND delivered_at IS NULL;

CREATE TABLE IF NOT EXISTS calibration_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id),
  calibrated_at TIMESTAMPTZ NOT NULL,
  reference_value_c REAL NOT NULL,
  device_value_c REAL NOT NULL,
  offset_c REAL NOT NULL,
  calibrated_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS calibration_records_device_idx
  ON calibration_records(device_id, calibrated_at DESC);
`;

export async function runMigrations(databaseUrl: string) {
  const sql = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sql);

  await migrate(db, {
    migrationsFolder: path.resolve(__dirname, '../migrations'),
  });

  // Post-migration: hypertable + index
  await sql.unsafe(POST_MIGRATION_SQL);
  // P2 schema safety net for legacy installations.
  await sql.unsafe(P2_BACKFILL_SQL);

  await sql.end();
}
