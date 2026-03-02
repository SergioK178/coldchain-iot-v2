import { loadEnv } from './config.js';
import { runMigrations, createDb, seed } from '@sensor/db';
import { buildApp } from './app.js';

async function main() {
  const env = loadEnv();

  // 1. Migrate
  console.log('Running migrations...');
  await runMigrations(env.DATABASE_URL);
  console.log('Migrations complete.');

  // 2. Seed
  console.log('Running seed...');
  const { db, sql } = createDb(env.DATABASE_URL);
  await seed(db);
  await sql.end();
  console.log('Seed complete.');

  // 3. Build app
  const app = await buildApp(env);

  // 4. TODO: reconcile mosquitto passwd/acl (Этап 2B)

  // 5. Listen
  await app.listen({ host: env.HTTP_HOST, port: env.HTTP_PORT });
  console.log(`Server listening on ${env.HTTP_HOST}:${env.HTTP_PORT}`);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');
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
