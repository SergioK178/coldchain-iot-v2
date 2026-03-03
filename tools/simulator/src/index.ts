import mqtt from 'mqtt';

const DEVICE_SERIAL = process.env.DEVICE_SERIAL ?? process.argv[2];
const MQTT_URL = process.env.MQTT_URL ?? 'mqtt://localhost:1883';
const MQTT_USERNAME = process.env.MQTT_USERNAME ?? process.argv[3];
const MQTT_PASSWORD = process.env.MQTT_PASSWORD ?? process.argv[4];
const INTERVAL_SEC = parseInt(process.env.INTERVAL_SEC ?? '60', 10);
const BASE_TEMP = parseFloat(process.env.BASE_TEMP ?? '-18');
const TEMP_JITTER = parseFloat(process.env.TEMP_JITTER ?? '3');
const BASE_HUMIDITY = parseFloat(process.env.BASE_HUMIDITY ?? '45');
const HUMIDITY_JITTER = parseFloat(process.env.HUMIDITY_JITTER ?? '10');

if (!DEVICE_SERIAL || !MQTT_USERNAME || !MQTT_PASSWORD) {
  console.error('Usage: simulate <DEVICE_SERIAL> <MQTT_USERNAME> <MQTT_PASSWORD>');
  console.error('  or set env: DEVICE_SERIAL, MQTT_URL, MQTT_USERNAME, MQTT_PASSWORD');
  process.exit(1);
}

// Determine capabilities from serial
const typeMatch = DEVICE_SERIAL.match(/^SENS-([A-Z]{1,2})-\d{5}$/);
const deviceType = typeMatch?.[1] ?? 'TH';
const hasTemp = ['TH', 'TP', 'T'].includes(deviceType);
const hasHumidity = ['TH', 'HM'].includes(deviceType);
const isBattery = !['TP'].includes(deviceType); // TP is typically wired

const telemetryTopic = `d/${DEVICE_SERIAL}/t`;
const statusTopic = `d/${DEVICE_SERIAL}/s`;

let midCounter = 0;
let battery = 100;

function jitter(base: number, range: number): number {
  return Math.round((base + (Math.random() * 2 - 1) * range) * 10) / 10;
}

function buildPayload(): object {
  midCounter++;
  const payload: Record<string, unknown> = {
    v: 1,
    id: DEVICE_SERIAL,
    ts: Math.floor(Date.now() / 1000),
    mid: String(midCounter),
  };

  if (hasTemp) payload.t = jitter(BASE_TEMP, TEMP_JITTER);
  if (hasHumidity) payload.h = jitter(BASE_HUMIDITY, HUMIDITY_JITTER);
  if (isBattery) {
    battery = Math.max(0, battery - Math.random() * 0.1);
    payload.bat = Math.round(battery);
  }
  payload.rssi = Math.round(-40 - Math.random() * 50);
  payload.fw = '0.1.0';

  return payload;
}

console.log(`Simulator starting: ${DEVICE_SERIAL}`);
console.log(`  MQTT: ${MQTT_URL}, user: ${MQTT_USERNAME}`);
console.log(`  Interval: ${INTERVAL_SEC}s, type: ${deviceType}`);

const client = mqtt.connect(MQTT_URL, {
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  clientId: `sim_${DEVICE_SERIAL}_${process.pid}`,
  will: {
    topic: statusTopic,
    payload: Buffer.from('0'),
    retain: true,
    qos: 1,
  },
});

let interval: ReturnType<typeof setInterval> | null = null;

client.on('connect', () => {
  console.log('MQTT connected');

  // Publish online status
  client.publish(statusTopic, '1', { retain: true, qos: 1 });

  // Send first telemetry immediately
  const first = JSON.stringify(buildPayload());
  client.publish(telemetryTopic, first, { qos: 1 });
  console.log(`Published: ${first}`);

  // Then on interval
  interval = setInterval(() => {
    const msg = JSON.stringify(buildPayload());
    client.publish(telemetryTopic, msg, { qos: 1 });
    console.log(`Published: ${msg}`);
  }, INTERVAL_SEC * 1000);
});

client.on('error', (err) => {
  console.error('MQTT error:', err.message);
});

// Graceful shutdown: explicitly publish offline status, then disconnect.
// This is NOT LWT — LWT fires only on ungraceful disconnect (kill, crash, network loss).
const shutdown = () => {
  console.log('Shutting down simulator...');
  if (interval) clearInterval(interval);
  client.publish(statusTopic, '0', { retain: true, qos: 1 }, () => {
    console.log('Published offline status (explicit, not LWT)');
    client.end(false, () => {
      console.log('Disconnected.');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
