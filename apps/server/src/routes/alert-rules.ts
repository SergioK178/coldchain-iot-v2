import { FastifyInstance } from 'fastify';
import { eq, isNull } from 'drizzle-orm';
import { devices } from '@sensor/db';
import {
  CreateAlertRuleSchema,
  PatchAlertRuleSchema,
  ErrorCode,
  parseSerial,
  DEVICE_TYPES,
} from '@sensor/shared';

export async function alertRulesRoutes(app: FastifyInstance) {
  // POST /api/v1/devices/:serial/alert-rules
  app.post('/api/v1/devices/:serial/alert-rules', async (request, reply) => {
    const { serial } = request.params as { serial: string };
    const parsed = CreateAlertRuleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: ErrorCode.VALIDATION_ERROR, message: parsed.error.message },
      });
    }

    // Find device
    const [device] = await app.db
      .select({ id: devices.id, decommissionedAt: devices.decommissionedAt })
      .from(devices)
      .where(eq(devices.serial, serial));

    if (!device || device.decommissionedAt) {
      return reply.code(404).send({
        ok: false,
        error: { code: ErrorCode.DEVICE_NOT_FOUND, message: 'Device not found' },
      });
    }

    // Validate metric vs capabilities
    try {
      const { type } = parseSerial(serial);
      const capabilities: readonly string[] = DEVICE_TYPES[type].capabilities;
      if (!capabilities.includes(parsed.data.metric)) {
        return reply.code(400).send({
          ok: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: `Device type ${type} does not support metric ${parsed.data.metric}`,
          },
        });
      }
    } catch {
      return reply.code(400).send({
        ok: false,
        error: { code: ErrorCode.INVALID_SERIAL_FORMAT, message: 'Invalid serial' },
      });
    }

    const actor = (request.query as { actor?: string }).actor || 'system';
    const rule = await app.alertService.createRule(device.id, parsed.data, actor);

    return reply.code(201).send({ ok: true, data: rule });
  });

  // GET /api/v1/devices/:serial/alert-rules
  app.get('/api/v1/devices/:serial/alert-rules', async (request, reply) => {
    const { serial } = request.params as { serial: string };

    const [device] = await app.db
      .select({ id: devices.id, decommissionedAt: devices.decommissionedAt })
      .from(devices)
      .where(eq(devices.serial, serial));

    if (!device || device.decommissionedAt) {
      return reply.code(404).send({
        ok: false,
        error: { code: ErrorCode.DEVICE_NOT_FOUND, message: 'Device not found' },
      });
    }

    const rules = await app.alertService.getRulesForDevice(device.id);
    return { ok: true, data: rules };
  });

  // PATCH /api/v1/alert-rules/:id
  app.patch('/api/v1/alert-rules/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = PatchAlertRuleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: ErrorCode.VALIDATION_ERROR, message: parsed.error.message },
      });
    }

    const actor = (request.query as { actor?: string }).actor || 'system';
    const result = await app.alertService.patchRule(id, parsed.data, actor);

    if ('error' in result) {
      return reply.code(404).send({
        ok: false,
        error: { code: result.error, message: 'Alert rule not found' },
      });
    }

    return { ok: true, data: result.data };
  });

  // DELETE /api/v1/alert-rules/:id
  app.delete('/api/v1/alert-rules/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = (request.query as { actor?: string }).actor || 'system';
    const result = await app.alertService.deleteRule(id, actor);

    if ('error' in result) {
      return reply.code(404).send({
        ok: false,
        error: { code: result.error, message: 'Alert rule not found' },
      });
    }

    return { ok: true, data: result.data };
  });
}
