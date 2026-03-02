import { FastifyInstance } from 'fastify';

const startedAt = Date.now();

export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/v1/health', async () => {
    return {
      ok: true,
      data: {
        version: '0.1.0',
        uptime: Math.floor((Date.now() - startedAt) / 1000),
      },
    };
  });
}
