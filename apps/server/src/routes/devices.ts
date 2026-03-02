import { FastifyInstance } from 'fastify';
import { ProvisionRequestSchema, PatchDeviceSchema, ErrorCode, parseSerial } from '@sensor/shared';

export async function deviceRoutes(app: FastifyInstance) {
  // POST /api/v1/devices/provision
  app.post('/api/v1/devices/provision', async (request, reply) => {
    const parsed = ProvisionRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      // Distinguish serial format vs general validation
      const serialIssue = parsed.error.issues.find((i) => i.path.includes('serial'));
      if (serialIssue) {
        return reply.code(400).send({
          ok: false,
          error: { code: ErrorCode.INVALID_SERIAL_FORMAT, message: serialIssue.message },
        });
      }
      return reply.code(400).send({
        ok: false,
        error: { code: ErrorCode.VALIDATION_ERROR, message: parsed.error.message },
      });
    }

    // Validate device type from serial
    try {
      parseSerial(parsed.data.serial);
    } catch (err: any) {
      const code = err.message.includes('Unknown device type')
        ? ErrorCode.UNKNOWN_DEVICE_TYPE
        : ErrorCode.INVALID_SERIAL_FORMAT;
      return reply.code(400).send({
        ok: false,
        error: { code, message: err.message },
      });
    }

    const actor = (request.query as { actor?: string }).actor || 'system';

    const result = await app.provision.provisionDevice(
      app.provisionDeps,
      parsed.data,
      actor,
    );

    if ('error' in result) {
      const statusMap: Record<string, number> = {
        [ErrorCode.DEVICE_ALREADY_PROVISIONED]: 409,
        [ErrorCode.ZONE_NOT_FOUND]: 404,
      };
      const status = statusMap[result.error as string] ?? 400;
      return reply.code(status).send({
        ok: false,
        error: { code: result.error, message: result.error },
      });
    }

    return reply.code(201).send({ ok: true, data: result.data });
  });

  // GET /api/v1/devices
  app.get('/api/v1/devices', async () => {
    const data = await app.deviceService.list();
    return { ok: true, data };
  });

  // GET /api/v1/devices/:serial
  app.get('/api/v1/devices/:serial', async (request, reply) => {
    const { serial } = request.params as { serial: string };
    const device = await app.deviceService.getBySerial(serial);
    if (!device) {
      return reply.code(404).send({
        ok: false,
        error: { code: ErrorCode.DEVICE_NOT_FOUND, message: 'Device not found' },
      });
    }
    return { ok: true, data: device };
  });

  // PATCH /api/v1/devices/:serial
  app.patch('/api/v1/devices/:serial', async (request, reply) => {
    const { serial } = request.params as { serial: string };
    const parsed = PatchDeviceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: ErrorCode.VALIDATION_ERROR, message: parsed.error.message },
      });
    }
    const actor = (request.query as { actor?: string }).actor || 'system';
    const result = await app.deviceService.patch(serial, parsed.data, actor);
    if ('error' in result) {
      return reply.code(404).send({
        ok: false,
        error: { code: result.error, message: 'Device not found' },
      });
    }
    return { ok: true, data: result.data };
  });

  // DELETE /api/v1/devices/:serial
  app.delete('/api/v1/devices/:serial', async (request, reply) => {
    const { serial } = request.params as { serial: string };
    const actor = (request.query as { actor?: string }).actor || 'system';
    const result = await app.provision.decommissionDevice(
      app.provisionDeps,
      serial,
      actor,
    );
    if ('error' in result) {
      return reply.code(404).send({
        ok: false,
        error: { code: result.error, message: 'Device not found' },
      });
    }
    return { ok: true, data: result.data };
  });
}
