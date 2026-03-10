import { FastifyInstance } from 'fastify';
import { AcknowledgeSchema, ErrorCode } from '@sensor/shared';

function requireOperator(request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply): boolean {
  const role = request.user?.role;
  if (role !== 'admin' && role !== 'operator') {
    reply.code(403).send({
      ok: false,
      error: { code: ErrorCode.FORBIDDEN, message: 'Operator or admin role required', messageKey: 'operator_or_admin_required' },
    });
    return false;
  }
  return true;
}

export async function alertEventsRoutes(app: FastifyInstance) {
  // GET /api/v1/alert-events
  app.get('/api/v1/alert-events', async (request) => {
    const { deviceSerial, acknowledged, since, limit } = request.query as {
      deviceSerial?: string;
      acknowledged?: string;
      since?: string;
      limit?: string;
    };

    const data = await app.alertService.queryEvents({
      deviceSerial,
      acknowledged: acknowledged === 'true' ? true : acknowledged === 'false' ? false : undefined,
      since: since ? new Date(since) : undefined,
      limit: limit ? Math.min(parseInt(limit, 10), 1000) : 100,
    });

    return { ok: true, data };
  });

  // PATCH /api/v1/alert-events/:id/acknowledge
  app.patch('/api/v1/alert-events/:id/acknowledge', async (request, reply) => {
    if (!requireOperator(request, reply)) return;
    const { id } = request.params as { id: string };
    const parsed = AcknowledgeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: ErrorCode.VALIDATION_ERROR, message: parsed.error.message },
      });
    }
    const result = await app.alertService.acknowledge(id, parsed.data.acknowledgedBy);

    if ('error' in result) {
      const status = result.error === ErrorCode.ALREADY_ACKNOWLEDGED ? 409 : 404;
      return reply.code(status).send({
        ok: false,
        error: { code: result.error, message: result.error },
      });
    }

    return { ok: true, data: result.data };
  });
}
