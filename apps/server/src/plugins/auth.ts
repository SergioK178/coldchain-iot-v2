import { FastifyInstance } from 'fastify';
import { ErrorCode } from '@sensor/shared';

export async function authPlugin(app: FastifyInstance) {
  const apiToken = app.env.API_TOKEN;

  app.addHook('onRequest', async (request, reply) => {
    // Health endpoint is public
    if (request.url === '/api/v1/health') return;
    // Swagger docs are public
    if (request.url.startsWith('/api/docs')) return;
    // Static UI files are public
    if (!request.url.startsWith('/api/')) return;

    const auth = request.headers.authorization;
    if (!auth || auth !== `Bearer ${apiToken}`) {
      reply.code(401).send({
        ok: false,
        error: { code: ErrorCode.UNAUTHORIZED, message: 'Invalid or missing API token' },
      });
    }
  });
}
