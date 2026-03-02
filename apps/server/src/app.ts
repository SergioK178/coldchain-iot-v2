import Fastify from 'fastify';
import { type Env } from './config.js';
import { createDb, type Db } from '@sensor/db';
import { swaggerPlugin } from './plugins/swagger.js';
import { authPlugin } from './plugins/auth.js';
import { mqttPlugin } from './plugins/mqtt.js';
import { createAuditService, type AuditService } from './services/audit.js';
import { createDeviceService, type DeviceService } from './services/device.js';
import { createIngestionService, type IngestionService } from './services/ingestion.js';
import * as provision from './services/provision.js';
import { type ProvisionDeps } from './services/provision.js';
import { healthRoutes } from './routes/health.js';
import { auditRoutes } from './routes/audit.js';
import { deviceRoutes } from './routes/devices.js';
import { readingsRoutes } from './routes/readings.js';

// Extend Fastify with custom properties
declare module 'fastify' {
  interface FastifyInstance {
    env: Env;
    db: Db;
    audit: AuditService;
    deviceService: DeviceService;
    ingestion: IngestionService;
    provision: typeof provision;
    provisionDeps: ProvisionDeps;
  }
}

export async function buildApp(env: Env, adminPasswordHash: string) {
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

  // Device service
  const deviceService = createDeviceService(db, audit);
  app.decorate('deviceService', deviceService);

  // Provision deps
  const provisionDeps: ProvisionDeps = { db, audit, env, adminPasswordHash };
  app.decorate('provisionDeps', provisionDeps);
  app.decorate('provision', provision);

  // Ingestion service (alert check will be wired in Этап 3)
  const ingestion = createIngestionService({
    db,
    audit,
    onReading: undefined,
  });
  app.decorate('ingestion', ingestion);

  // Plugins
  await app.register(swaggerPlugin);
  await app.register(authPlugin);
  await app.register(mqttPlugin);

  // Routes
  await app.register(healthRoutes);
  await app.register(auditRoutes);
  await app.register(deviceRoutes);
  await app.register(readingsRoutes);

  return app;
}
