import { z } from 'zod';

function isStrongPassword(value: string): boolean {
  if (value.length < 16) return false;
  if (!/[a-z]/.test(value)) return false;
  if (!/[A-Z]/.test(value)) return false;
  if (!/[0-9]/.test(value)) return false;
  if (!/[^A-Za-z0-9]/.test(value)) return false;
  return true;
}

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  MQTT_URL: z.string(),
  MQTT_ADMIN_USER: z.string().default('server'),
  MQTT_ADMIN_PASSWORD: z.string(),
  JWT_SECRET: z.string().min(32),
  ADMIN_EMAIL: z.string().email().optional().or(z.literal('')),
  ADMIN_PASSWORD: z.string().optional().default(''),
  DEVICE_OFFLINE_TIMEOUT_SEC: z.coerce.number().int().min(60).default(300),
  HTTP_HOST: z.string().default('0.0.0.0'),
  HTTP_PORT: z.coerce.number().int().default(8080),
  /** F6 (P2): server POSTs here to trigger auth-sync reload. Required in P2 runtime. */
  MOSQUITTO_RELOAD_URL: z.string().url(),
  TELEGRAM_BOT_TOKEN: z.string().optional().default(''),
  AUTH_RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().min(1).default(8),
  AUTH_RATE_LIMIT_LOGIN_WINDOW_SEC: z.coerce.number().int().min(1).default(300),
  AUTH_RATE_LIMIT_REFRESH_MAX: z.coerce.number().int().min(1).default(20),
  AUTH_RATE_LIMIT_REFRESH_WINDOW_SEC: z.coerce.number().int().min(1).default(300),
  AUTH_RATE_LIMIT_BLOCK_SEC: z.coerce.number().int().min(0).default(300),
  AUTH_COOKIE_SECURE: z.enum(['true', 'false', 'auto']).default('auto'),
  WEBHOOK_ALLOWLIST_HOSTS: z.string().optional().default(''),
  /** When false, Swagger UI at /api/docs is disabled (recommended for production). */
  SWAGGER_UI_ENABLED: z.enum(['true', 'false']).default('true'),
}).superRefine((env, ctx) => {
  if (env.ADMIN_PASSWORD && !isStrongPassword(env.ADMIN_PASSWORD)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ADMIN_PASSWORD'],
      message: 'ADMIN_PASSWORD is too weak (min 16 chars with lower/upper/digit/special).',
    });
  }
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}
