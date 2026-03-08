import { z } from 'zod';

export const ProvisionRequestSchema = z.object({
  serial: z.string().regex(/^SENS-[A-Z]{1,2}-\d{5}$/, 'Invalid serial format'),
  displayName: z.string().max(255).optional(),
  powerSource: z.enum(['battery', 'wired']),
  zoneId: z.string().uuid().optional(),
  calibrationOffsetC: z.number().default(0),
});

export type ProvisionRequest = z.infer<typeof ProvisionRequestSchema>;

export const ClaimRequestSchema = z.object({
  serial: z.string().regex(/^SENS-[A-Z]{1,2}-\d{5}$/, 'Invalid serial format'),
  activationToken: z.string().min(1, 'Activation token required'),
  firmwareVersion: z.string().max(20).optional(),
  powerSource: z.enum(['battery', 'wired']).optional(),
});

export type ClaimRequest = z.infer<typeof ClaimRequestSchema>;

export const PatchDeviceSchema = z.object({
  displayName: z.string().max(255).optional(),
  zoneId: z.string().uuid().nullable().optional(),
  calibrationOffsetC: z.number().optional(),
});

export type PatchDevice = z.infer<typeof PatchDeviceSchema>;

export const DeviceResponseSchema = z.object({
  serial: z.string(),
  deviceType: z.string(),
  displayName: z.string().nullable(),
  zoneName: z.string().nullable(),
  locationName: z.string().nullable(),
  powerSource: z.string(),
  lastSeenAt: z.string().nullable(),
  lastTemperatureC: z.number().nullable(),
  lastHumidityPct: z.number().nullable(),
  lastBatteryPct: z.number().nullable(),
  connectivityStatus: z.enum(['online', 'offline']),
  alertStatus: z.enum(['normal', 'alert']),
  provisionedAt: z.string(),
});

export type DeviceResponse = z.infer<typeof DeviceResponseSchema>;
