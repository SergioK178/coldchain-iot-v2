import Fastify from 'fastify';
import { type Env } from './config.js';
import { createDb, type Db } from '@sensor/db';
import { swaggerPlugin } from './plugins/swagger.js';
import { authPlugin } from './plugins/auth.js';
import { createAuditService, type AuditService } from './services/audit.js';
import { healthRoutes } from './routes/health.js';
import { auditRoutes } from './routes/audit.js';

// Extend Fastify with custom properties
declare module 'fastify' {
  interface FastifyInstance {
    env: Env;
    db: Db;
    audit: AuditService;
  }
}

export async function buildApp(env: Env) {
  const app = Fastify({ logger: true });

  // Decorate with env
  app.decorate('env', env);

  // Database
  const { db, sql } = createDb(env.DATABASE_URL);
  app.decorate('db', db);
  app.addHook('onClose', async () => {
    await sql.end();
  });

  // Audit service
  const audit = createAuditService(db);
  app.decorate('audit', audit);

  // Plugins
  await app.register(swaggerPlugin);
  await app.register(authPlugin);

  // Routes
  await app.register(healthRoutes);
  await app.register(auditRoutes);

  return app;
}
