import { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { devices, calibrationRecords } from '@sensor/db';
import { z } from 'zod';
import { ErrorCode } from '@sensor/shared';

const CreateCalibrationSchema = z.object({
  referenceValueC: z.number(),
  deviceValueC: z.number(),
  notes: z.string().optional(),
});

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

export async function calibrationRoutes(app: FastifyInstance) {
  app.post('/api/v1/devices/:serial/calibrations', async (request, reply) => {
    if (!requireOperator(request, reply)) return;
    const { serial } = request.params as { serial: string };
    const parsed = CreateCalibrationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: ErrorCode.VALIDATION_ERROR, message: parsed.error.message },
      });
    }
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
    const offsetC = parsed.data.referenceValueC - parsed.data.deviceValueC;
    const calibratedAt = new Date();
    const [record] = await app.db
      .insert(calibrationRecords)
      .values({
        deviceId: device.id,
        calibratedAt,
        referenceValueC: parsed.data.referenceValueC,
        deviceValueC: parsed.data.deviceValueC,
        offsetC,
        calibratedBy: request.user?.type === 'jwt' ? request.user.sub : null,
        notes: parsed.data.notes ?? null,
      })
      .returning();
    await app.db.update(devices).set({ calibrationOffsetC: offsetC }).where(eq(devices.id, device.id));
    await app.audit.append({
      action: 'calibration.recorded',
      entityType: 'calibration_record',
      entityId: record!.id,
      actor: request.actor ?? 'system',
      details: { deviceSerial: serial, offsetC },
    });
    return reply.code(201).send({
      ok: true,
      data: {
        id: record!.id,
        calibratedAt: calibratedAt.toISOString(),
        referenceValueC: parsed.data.referenceValueC,
        deviceValueC: parsed.data.deviceValueC,
        offsetC,
      },
    });
  });

  app.get('/api/v1/devices/:serial/calibrations', async (request, reply) => {
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
    const list = await app.db
      .select()
      .from(calibrationRecords)
      .where(eq(calibrationRecords.deviceId, device.id))
      .orderBy(desc(calibrationRecords.calibratedAt))
      .limit(100);
    return reply.send({
      ok: true,
      data: list.map((r) => ({
        id: r.id,
        calibratedAt: r.calibratedAt?.toISOString(),
        referenceValueC: r.referenceValueC,
        deviceValueC: r.deviceValueC,
        offsetC: r.offsetC,
        notes: r.notes,
        calibratedBy: r.calibratedBy,
      })),
    });
  });
}
