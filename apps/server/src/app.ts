import Fastify from 'fastify';
import { type Env } from './config.js';
import { createDb, type Db } from '@sensor/db';
import { swaggerPlugin } from './plugins/swagger.js';
import { authPlugin } from './plugins/auth.js';
import { mqttPlugin } from './plugins/mqtt.js';
import { createAuditService, type AuditService } from './services/audit.js';
import { createDeviceService, type DeviceService } from './services/device.js';
import { createIngestionService, type IngestionService } from './services/ingestion.js';
import { createAlertService, type AlertService } from './services/alert.js';
import * as provision from './services/provision.js';
import { type ProvisionDeps } from './services/provision.js';
import { healthRoutes } from './routes/health.js';
import { auditRoutes } from './routes/audit.js';
import { deviceRoutes } from './routes/devices.js';
import { readingsRoutes } from './routes/readings.js';
import { alertRulesRoutes } from './routes/alert-rules.js';
import { alertEventsRoutes } from './routes/alert-events.js';
import { staticPlugin } from './plugins/static.js';

// Extend Fastify with custom properties
declare module 'fastify' {
  interface FastifyInstance {
    env: Env;
    db: Db;
    audit: AuditService;
    deviceService: DeviceService;
    ingestion: IngestionService;
    alertService: AlertService;
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

  // Alert service
  const callbackUrl = env.ALERT_CALLBACK_URL || undefined;
  const alertService = createAlertService({ db, audit, callbackUrl });
  app.decorate('alertService', alertService);

  // Provision deps
  const provisionDeps: ProvisionDeps = { db, audit, env, adminPasswordHash };
  app.decorate('provisionDeps', provisionDeps);
  app.decorate('provision', provision);

  // Ingestion service — wired to alert check (I8)
  const ingestion = createIngestionService({
    db,
    audit,
    onReading: async (deviceId, reading) => {
      await alertService.checkAlertRules(deviceId, reading);
    },
  });
  app.decorate('ingestion', ingestion);

  // Plugins
  await app.register(swaggerPlugin);
  // Register auth hook on root instance to enforce token on all API routes.
  await authPlugin(app);
  await app.register(mqttPlugin);

  // Routes
  await app.register(healthRoutes);
  await app.register(auditRoutes);
  await app.register(deviceRoutes);
  await app.register(readingsRoutes);
  await app.register(alertRulesRoutes);
  await app.register(alertEventsRoutes);

  // Static UI (must be last — has setNotFoundHandler)
  await app.register(staticPlugin);

  return app;
}
