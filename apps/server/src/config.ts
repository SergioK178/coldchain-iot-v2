import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  MQTT_URL: z.string(),
  MQTT_ADMIN_USER: z.string().default('server'),
  MQTT_ADMIN_PASSWORD: z.string(),
  API_TOKEN: z.string().min(32),
  ALERT_CALLBACK_URL: z.string().url().optional().or(z.literal('')),
  DEVICE_OFFLINE_TIMEOUT_SEC: z.coerce.number().int().min(60).default(300),
  HTTP_HOST: z.string().default('0.0.0.0'),
  HTTP_PORT: z.coerce.number().int().default(8080),
  MOSQUITTO_DATA_DIR: z.string().default('/mosquitto-data'),
  MOSQUITTO_CONTAINER_NAME: z.string().default('mqtt'),
  DOCKER_SOCKET: z.string().default('/var/run/docker.sock'),
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
