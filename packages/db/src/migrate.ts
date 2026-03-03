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
`;

export async function runMigrations(databaseUrl: string) {
  const sql = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sql);

  await migrate(db, {
    migrationsFolder: path.resolve(__dirname, '../migrations'),
  });

  // Post-migration: hypertable + index
  await sql.unsafe(POST_MIGRATION_SQL);

  await sql.end();
}
