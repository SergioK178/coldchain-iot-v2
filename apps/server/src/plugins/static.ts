import { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function staticPlugin(app: FastifyInstance) {
  // Serve ui/dist/ on / — resolved relative to apps/server/dist/plugins/
  const uiRoot = path.resolve(__dirname, '../../../../ui/dist');

  await app.register(fastifyStatic, {
    root: uiRoot,
    prefix: '/',
    wildcard: false,
    decorateReply: false,
  });

  // SPA fallback: serve index.html for non-API routes
  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.code(404).send({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Endpoint not found' },
      });
    }
    return reply.sendFile('index.html', uiRoot);
  });
}
