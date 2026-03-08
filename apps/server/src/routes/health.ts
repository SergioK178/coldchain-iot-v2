import { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';

const startedAt = Date.now();

export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/v1/health', async () => {
    return {
      ok: true,
      data: {
        version: '0.1.0',
        uptime: Math.floor((Date.now() - startedAt) / 1000),
        mqttConnected: app.mqttConnected ?? false,
      },
    };
  });

  app.get('/api/v1/ready', async (request, reply) => {
    try {
      await app.db.execute(sql`SELECT 1`);
      return { ok: true };
    } catch (err) {
      request.log.error({ err }, 'Readiness check failed');
      return reply.code(503).send({ ok: false, error: 'Database unavailable' });
    }
  });
}
