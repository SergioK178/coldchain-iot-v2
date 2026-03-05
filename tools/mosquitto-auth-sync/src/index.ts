import { spawn, execFileSync } from 'node:child_process';
import http from 'node:http';
import { isNull } from 'drizzle-orm';
import { createDb, type Db } from '@sensor/db';
import { devices } from '@sensor/db';
import { hashPassword } from './hash.js';
import { writePasswdAcl } from './rebuild.js';

const DATA_DIR = process.env.MOSQUITTO_DATA_DIR || '/data';
const RELOAD_PORT = parseInt(process.env.RELOAD_PORT || '9080', 10);
const DATABASE_URL = process.env.DATABASE_URL!;
const MQTT_ADMIN_USER = process.env.MQTT_ADMIN_USER || 'server';
const MQTT_ADMIN_PASSWORD = process.env.MQTT_ADMIN_PASSWORD!;
const MOSQUITTO_CONF = process.env.MOSQUITTO_CONF || '/app/mosquitto.conf';

let mosquittoPid: number | null = null;
let adminHashCache: string | null = null;
let mosquittoOwner: { uid: number; gid: number } | undefined;

function detectMosquittoOwner(): { uid: number; gid: number } | undefined {
  try {
    const uid = Number.parseInt(execFileSync('id', ['-u', 'mosquitto'], { encoding: 'utf-8' }).trim(), 10);
    const gid = Number.parseInt(execFileSync('id', ['-g', 'mosquitto'], { encoding: 'utf-8' }).trim(), 10);
    if (Number.isFinite(uid) && Number.isFinite(gid)) return { uid, gid };
  } catch (err) {
    console.error('Failed to detect mosquitto uid/gid, fallback to no chown:', err);
  }
  return undefined;
}

async function rebuild(db: Db): Promise<void> {
  if (!adminHashCache) adminHashCache = await hashPassword(MQTT_ADMIN_PASSWORD);
  const activeDevices = await db
    .select({
      serial: devices.serial,
      username: devices.mqttUsername,
      passwordHash: devices.mqttPasswordHash,
    })
    .from(devices)
    .where(isNull(devices.decommissionedAt));

  await writePasswdAcl(
    DATA_DIR,
    MQTT_ADMIN_USER,
    adminHashCache,
    activeDevices.map((d) => ({
      username: d.username,
      passwordHash: d.passwordHash,
      serial: d.serial,
    })),
    mosquittoOwner
  );

  if (mosquittoPid) {
    process.kill(mosquittoPid, 'SIGHUP');
  }
}

function startMosquitto(): void {
  const child = spawn('mosquitto', ['-c', MOSQUITTO_CONF], {
    stdio: 'inherit',
    detached: false,
  });
  mosquittoPid = child.pid ?? null;
  child.on('exit', (code, signal) => {
    if (code != null && code !== 0) {
      console.error(`Mosquitto exited with code ${code}`);
      process.exit(1);
    }
  });
}

async function main(): Promise<void> {
  if (!DATABASE_URL || !MQTT_ADMIN_PASSWORD) {
    console.error('Set DATABASE_URL and MQTT_ADMIN_PASSWORD');
    process.exit(1);
  }

  const { db } = createDb(DATABASE_URL);
  mosquittoOwner = detectMosquittoOwner();
  await rebuild(db);
  startMosquitto();

  const server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/reload') {
      try {
        await rebuild(db);
        res.writeHead(204);
        res.end();
      } catch (err) {
        console.error('Reload failed:', err);
        res.writeHead(500);
        res.end(String(err));
      }
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(RELOAD_PORT, '0.0.0.0', () => {
    console.log(`Auth-sync reload listener on port ${RELOAD_PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
