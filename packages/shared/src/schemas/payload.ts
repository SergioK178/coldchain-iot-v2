import { z } from 'zod';

export const DevicePayloadSchema = z.object({
  v:    z.literal(1),
  id:   z.string().regex(/^SENS-[A-Z]{1,2}-\d{5}$/),
  ts:   z.number().int().positive(),
  mid:  z.string().min(1).max(64),

  t:    z.number().min(-55).max(125).optional(),
  h:    z.number().min(0).max(100).optional(),

  bat:  z.number().int().min(0).max(100).optional(),
  rssi: z.number().int().min(-120).max(0).optional(),
  fw:   z.string().max(20).optional(),
  up:   z.number().int().min(0).optional(),
});

export type DevicePayload = z.infer<typeof DevicePayloadSchema>;
