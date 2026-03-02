import { FastifyInstance } from 'fastify';
import mqtt from 'mqtt';
import { MQTT } from '@sensor/shared';

export async function mqttPlugin(app: FastifyInstance) {
  const { MQTT_URL, MQTT_ADMIN_USER, MQTT_ADMIN_PASSWORD } = app.env;

  const client = mqtt.connect(MQTT_URL, {
    username: MQTT_ADMIN_USER,
    password: MQTT_ADMIN_PASSWORD,
    clientId: `server_${process.pid}`,
  });

  client.on('connect', () => {
    app.log.info('MQTT connected');
    client.subscribe([MQTT.sub.allTelemetry, MQTT.sub.allStatus], { qos: 1 });
  });

  client.on('error', (err) => {
    app.log.error({ err }, 'MQTT error');
  });

  client.on('message', async (topic, message) => {
    try {
      const payload = message.toString('utf-8');

      // Parse topic: d/{serial}/t or d/{serial}/s
      const parts = topic.split('/');
      if (parts.length !== 3 || parts[0] !== 'd') return;

      const serial = parts[1];
      const type = parts[2];

      if (type === 't') {
        // Telemetry
        await app.ingestion.handleTelemetry(payload);
      } else if (type === 's') {
        // Status
        await app.deviceService.handleStatusMessage(serial, payload);
      }
    } catch (err) {
      app.log.error({ err, topic }, 'Error processing MQTT message');
    }
  });

  app.addHook('onClose', async () => {
    await client.endAsync();
  });
}
