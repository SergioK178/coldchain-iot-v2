import { FastifyInstance } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { locations, zones, devices, organizations } from '@sensor/db';
import { z } from 'zod';
import { ErrorCode } from '@sensor/shared';

const CreateLocationSchema = z.object({
  name: z.string().min(1).max(255),
  address: z.string().max(500).optional(),
});

const PatchLocationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  address: z.string().max(500).optional(),
});

const CreateZoneSchema = z.object({
  name: z.string().min(1).max(255),
});

const PatchZoneSchema = z.object({
  name: z.string().min(1).max(255),
});

function requireAdmin(request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply): boolean {
  if (request.user?.role !== 'admin') {
    reply.code(403).send({
      ok: false,
      error: { code: ErrorCode.FORBIDDEN, message: 'Admin role required', messageKey: 'admin_required' },
    });
    return false;
  }
  return true;
}

export async function locationRoutes(app: FastifyInstance) {
  app.get('/api/v1/locations', async (request, reply) => {
    const list = await app.db.select().from(locations).orderBy(locations.name);
    return reply.send({ ok: true, data: list });
  });

  app.post('/api/v1/locations', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const parsed = CreateLocationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: ErrorCode.VALIDATION_ERROR, message: parsed.error.message },
      });
    }
    const [org] = await app.db.select().from(organizations).limit(1);
    if (!org) {
      return reply.code(500).send({
        ok: false,
        error: { code: ErrorCode.INTERNAL_ERROR, message: 'No organization' },
      });
    }
    const [created] = await app.db
      .insert(locations)
      .values({
        orgId: org.id,
        name: parsed.data.name,
        address: parsed.data.address ?? null,
      })
      .returning();
    await app.audit.append({
      action: 'location.created',
      entityType: 'location',
      entityId: created!.id,
      actor: request.actor ?? 'system',
      details: { name: created!.name },
    });
    return reply.code(201).send({ ok: true, data: created });
  });

  app.patch('/api/v1/locations/:id', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const parsed = PatchLocationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: ErrorCode.VALIDATION_ERROR, message: parsed.error.message },
      });
    }
    const [existing] = await app.db.select().from(locations).where(eq(locations.id, id));
    if (!existing) {
      return reply.code(404).send({
        ok: false,
        error: { code: ErrorCode.LOCATION_NOT_FOUND, message: 'Location not found' },
      });
    }
    const updates: { name?: string; address?: string } = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.address !== undefined) updates.address = parsed.data.address;
    const [updated] = await app.db.update(locations).set(updates).where(eq(locations.id, id)).returning();
    await app.audit.append({
      action: 'location.updated',
      entityType: 'location',
      entityId: id,
      actor: request.actor ?? 'system',
      details: updates,
    });
    return reply.send({ ok: true, data: updated });
  });

  app.delete('/api/v1/locations/:id', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const [existing] = await app.db.select().from(locations).where(eq(locations.id, id));
    if (!existing) {
      return reply.code(404).send({
        ok: false,
        error: { code: ErrorCode.LOCATION_NOT_FOUND, message: 'Location not found' },
      });
    }
    const zoneRows = await app.db.select({ id: zones.id }).from(zones).where(eq(zones.locationId, id));
    for (const zoneRow of zoneRows) {
      const devCount = await app.db
        .select({ count: sql<number>`count(*)::int` })
        .from(devices)
        .where(eq(devices.zoneId, zoneRow.id));
      if ((devCount[0]?.count ?? 0) > 0) {
        return reply.code(409).send({
          ok: false,
          error: { code: ErrorCode.HAS_ATTACHED_DEVICES, message: 'Location has zones with devices' },
        });
      }
    }
    await app.db.delete(zones).where(eq(zones.locationId, id));
    await app.db.delete(locations).where(eq(locations.id, id));
    await app.audit.append({
      action: 'location.deleted',
      entityType: 'location',
      entityId: id,
      actor: request.actor ?? 'system',
      details: { name: existing.name },
    });
    return reply.send({ ok: true, data: {} });
  });

  app.get('/api/v1/locations/:id/zones', async (request, reply) => {
    const { id } = request.params as { id: string };
    const [loc] = await app.db.select().from(locations).where(eq(locations.id, id));
    if (!loc) {
      return reply.code(404).send({
        ok: false,
        error: { code: ErrorCode.LOCATION_NOT_FOUND, message: 'Location not found' },
      });
    }
    const list = await app.db.select().from(zones).where(eq(zones.locationId, id)).orderBy(zones.name);
    return reply.send({ ok: true, data: list });
  });

  app.post('/api/v1/locations/:id/zones', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const parsed = CreateZoneSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: ErrorCode.VALIDATION_ERROR, message: parsed.error.message },
      });
    }
    const [loc] = await app.db.select().from(locations).where(eq(locations.id, id));
    if (!loc) {
      return reply.code(404).send({
        ok: false,
        error: { code: ErrorCode.LOCATION_NOT_FOUND, message: 'Location not found' },
      });
    }
    const [created] = await app.db
      .insert(zones)
      .values({ locationId: id, name: parsed.data.name })
      .returning();
    await app.audit.append({
      action: 'zone.created',
      entityType: 'zone',
      entityId: created!.id,
      actor: request.actor ?? 'system',
      details: { name: created!.name, locationId: id },
    });
    return reply.code(201).send({ ok: true, data: created });
  });

  app.patch('/api/v1/zones/:id', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const parsed = PatchZoneSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        error: { code: ErrorCode.VALIDATION_ERROR, message: parsed.error.message },
      });
    }
    const [existing] = await app.db.select().from(zones).where(eq(zones.id, id));
    if (!existing) {
      return reply.code(404).send({
        ok: false,
        error: { code: ErrorCode.ZONE_NOT_FOUND, message: 'Zone not found' },
      });
    }
    const [updated] = await app.db.update(zones).set({ name: parsed.data.name }).where(eq(zones.id, id)).returning();
    await app.audit.append({
      action: 'zone.updated',
      entityType: 'zone',
      entityId: id,
      actor: request.actor ?? 'system',
      details: { name: parsed.data.name },
    });
    return reply.send({ ok: true, data: updated });
  });

  app.delete('/api/v1/zones/:id', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { id } = request.params as { id: string };
    const [existing] = await app.db.select().from(zones).where(eq(zones.id, id));
    if (!existing) {
      return reply.code(404).send({
        ok: false,
        error: { code: ErrorCode.ZONE_NOT_FOUND, message: 'Zone not found' },
      });
    }
    const devCount = await app.db
      .select({ count: sql<number>`count(*)::int` })
      .from(devices)
      .where(eq(devices.zoneId, id));
    if ((devCount[0]?.count ?? 0) > 0) {
      return reply.code(409).send({
        ok: false,
        error: { code: ErrorCode.HAS_ATTACHED_DEVICES, message: 'Zone has attached devices' },
      });
    }
    await app.db.delete(zones).where(eq(zones.id, id));
    await app.audit.append({
      action: 'zone.deleted',
      entityType: 'zone',
      entityId: id,
      actor: request.actor ?? 'system',
      details: { name: existing.name },
    });
    return reply.send({ ok: true, data: {} });
  });
}
