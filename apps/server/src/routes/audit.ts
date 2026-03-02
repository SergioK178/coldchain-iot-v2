import { FastifyInstance } from 'fastify';

export async function auditRoutes(app: FastifyInstance) {
  app.get('/api/v1/audit-log', async (request) => {
    const { since, action, entityType, limit } = request.query as {
      since?: string;
      action?: string;
      entityType?: string;
      limit?: string;
    };

    const entries = await app.audit.query({
      since: since ? new Date(since) : undefined,
      action,
      entityType,
      limit: limit ? Math.min(parseInt(limit, 10), 1000) : 100,
    });

    return { ok: true, data: entries };
  });
}
