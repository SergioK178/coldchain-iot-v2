import { loadEnv } from './config.js';
import { runMigrations, createDb, seed, users } from '@sensor/db';
import { buildApp } from './app.js';
import { generateMosquittoHash } from './lib/mosquitto-files.js';
import { reconcileMosquitto } from './services/provision.js';
import { createAuditService } from './services/audit.js';
import { hashPassword } from './lib/auth.js';

async function main() {
  const env = loadEnv();
  if (env.API_TOKEN) {
    console.warn('API_TOKEN is enabled (deprecated fallback in P2). Prefer JWT user auth where possible.');
  }

  // 1. Migrate
  console.log('Running migrations...');
  await runMigrations(env.DATABASE_URL);
  console.log('Migrations complete.');

  // 2. Seed
  console.log('Running seed...');
  const { db, sql } = createDb(env.DATABASE_URL);
  const seedOptions: { adminEmail?: string; adminPasswordHash?: string } = {};
  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
    seedOptions.adminEmail = env.ADMIN_EMAIL;
    seedOptions.adminPasswordHash = await hashPassword(env.ADMIN_PASSWORD);
  } else {
    const userCount = await db.select({ id: users.id }).from(users).limit(1);
    if (userCount.length === 0) {
      console.warn('No users in DB and ADMIN_EMAIL/ADMIN_PASSWORD not set — login disabled, use API_TOKEN only.');
    }
  }
  await seed(db, seedOptions);
  console.log('Seed complete.');

  // 3. Generate admin password hash for Mosquitto
  const adminPasswordHash = await generateMosquittoHash(env.MQTT_ADMIN_PASSWORD);

  // 4. Startup reconcile (P7)
  console.log('Running Mosquitto reconcile...');
  const audit = createAuditService(db);
  try {
    await reconcileMosquitto({ db, audit, env, adminPasswordHash });
    console.log('Mosquitto reconcile complete.');
  } catch (err) {
    console.error('Mosquitto reconcile failed (non-fatal at startup):', err);
  }

  await sql.end();

  // 5. Build app
  const app = await buildApp(env, adminPasswordHash);

  // 6. Listen
  await app.listen({ host: env.HTTP_HOST, port: env.HTTP_PORT });

  // 7. Offline check timer (every 60s)
  const offlineTimer = setInterval(async () => {
    try {
      const count = await app.deviceService.checkOfflineDevices(env.DEVICE_OFFLINE_TIMEOUT_SEC);
      if (count > 0) {
        app.log.info({ count }, 'Marked devices offline by timeout');
      }
    } catch (err) {
      app.log.error({ err }, 'Offline check error');
    }
  }, 60_000);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');
    clearInterval(offlineTimer);
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
