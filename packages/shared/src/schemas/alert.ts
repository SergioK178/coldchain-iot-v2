import { z } from 'zod';

export const CreateAlertRuleSchema = z.object({
  metric: z.enum(['temperature_c', 'humidity_pct']),
  operator: z.enum(['gt', 'lt', 'gte', 'lte']),
  threshold: z.number(),
  cooldownMinutes: z.number().int().min(1).default(15),
});

export type CreateAlertRule = z.infer<typeof CreateAlertRuleSchema>;

export const PatchAlertRuleSchema = z.object({
  threshold: z.number().optional(),
  operator: z.enum(['gt', 'lt', 'gte', 'lte']).optional(),
  isActive: z.boolean().optional(),
  cooldownMinutes: z.number().int().min(1).optional(),
});

export type PatchAlertRule = z.infer<typeof PatchAlertRuleSchema>;

export const AcknowledgeSchema = z.object({
  acknowledgedBy: z.string().min(1).max(255),
});

export type Acknowledge = z.infer<typeof AcknowledgeSchema>;

export const AlertEventResponseSchema = z.object({
  id: z.string(),
  deviceSerial: z.string(),
  deviceName: z.string().nullable(),
  metric: z.string(),
  operator: z.string(),
  readingValue: z.number(),
  thresholdValue: z.number(),
  triggeredAt: z.string(),
  acknowledgedAt: z.string().nullable(),
  acknowledgedBy: z.string().nullable(),
});

export type AlertEventResponse = z.infer<typeof AlertEventResponseSchema>;
