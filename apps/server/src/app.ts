import Fastify from 'fastify';
import { type Env } from './config.js';
import { createDb, type Db, webhooks } from '@sensor/db';
import { randomBytes } from 'node:crypto';
import { swaggerPlugin } from './plugins/swagger.js';
import { authPlugin } from './plugins/auth.js';
import { mqttPlugin } from './plugins/mqtt.js';
import { createAuditService, type AuditService } from './services/audit.js';
import { createDeviceService, type DeviceService } from './services/device.js';
import { createIngestionService, type IngestionService } from './services/ingestion.js';
import { createAlertService, type AlertService } from './services/alert.js';
import { createWebhookService, type WebhookService } from './services/webhook.js';
import * as provision from './services/provision.js';
import { type ProvisionDeps } from './services/provision.js';
import { createAuthService, type AuthService } from './services/auth.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { locationRoutes } from './routes/locations.js';
import { calibrationRoutes } from './routes/calibrations.js';
import { auditRoutes } from './routes/audit.js';
import { deviceRoutes } from './routes/devices.js';
import { readingsRoutes } from './routes/readings.js';
import { alertRulesRoutes } from './routes/alert-rules.js';
import { alertEventsRoutes } from './routes/alert-events.js';
import { webhookRoutes } from './routes/webhooks.js';
import { exportRoutes } from './routes/export.js';

// Extend Fastify with custom properties
declare module 'fastify' {
  interface FastifyRequest {
    user?: { type: 'jwt'; sub: string; email: string; role: string } | { type: 'api_token'; role: 'admin'; email: 'api_token' };
    actor?: string;
  }
  interface FastifyInstance {
    env: Env;
    db: Db;
    audit: AuditService;
    authService: AuthService;
    deviceService: DeviceService;
    ingestion: IngestionService;
    alertService: AlertService;
    webhookService: WebhookService;
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

  const authService = createAuthService({ db, jwtSecret: env.JWT_SECRET });
  app.decorate('authService', authService);

  // Device service
  const deviceService = createDeviceService(db, audit);
  app.decorate('deviceService', deviceService);

  // Alert service
  const webhookService = createWebhookService({ db, webhookAllowlistHosts: env.WEBHOOK_ALLOWLIST_HOSTS });
  app.decorate('webhookService', webhookService);

  // P2: legacy migration — if ALERT_CALLBACK_URL set and no webhooks, create one
  const existingWebhooks = await db.select({ id: webhooks.id }).from(webhooks).limit(1);
  if (existingWebhooks.length === 0 && env.ALERT_CALLBACK_URL) {
    const secret = randomBytes(32).toString('hex');
    await db.insert(webhooks).values({
      url: env.ALERT_CALLBACK_URL,
      secret,
      events: ['alert.triggered'],
      isActive: true,
    });
    app.log.info('Created legacy webhook from ALERT_CALLBACK_URL');
  }

  const alertService = createAlertService({
    db,
    audit,
    webhookService,
    telegramBotToken: env.TELEGRAM_BOT_TOKEN || undefined,
  });
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
  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(locationRoutes);
  await app.register(calibrationRoutes);
  await app.register(auditRoutes);
  await app.register(deviceRoutes);
  await app.register(readingsRoutes);
  await app.register(alertRulesRoutes);
  await app.register(alertEventsRoutes);
  await app.register(webhookRoutes);
  await app.register(exportRoutes);

  const stopRetryLoop = webhookService.startRetryLoop();
  app.addHook('onClose', () => stopRetryLoop());

  if (env.TELEGRAM_BOT_TOKEN) {
    const { startTelegramBot } = await import('./lib/telegram-bot.js');
    const stopBot = startTelegramBot(db, env.TELEGRAM_BOT_TOKEN);
    app.addHook('onClose', () => stopBot());
  }

  // P2: API-only server; UI served by Next.js (web container)
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.code(404).send({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Endpoint not found' },
      });
    }
    return reply.code(404).send('Not Found');
  });

  return app;
}
