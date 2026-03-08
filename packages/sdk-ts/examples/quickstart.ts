/**
 * ColdChain SDK — Quickstart example
 *
 * Demonstrates: login, device listing, provisioning, reading history, and alert rules.
 *
 * Run with: npx tsx examples/quickstart.ts
 */
import { ColdChainClient } from '../src/index.js';

const BASE_URL = process.env.COLDCHAIN_URL ?? 'http://localhost:8080';
const ADMIN_EMAIL = process.env.COLDCHAIN_EMAIL ?? 'admin@coldchain.local';
const ADMIN_PASSWORD = process.env.COLDCHAIN_PASSWORD ?? '';

async function main() {
  // ── Authenticate ──────────────────────────────────────────────────────────
  console.log('Logging in...');
  const { client } = await ColdChainClient.login(BASE_URL, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  const me = await client.getMe();
  console.log(`Logged in as ${me.email} (${me.role})`);

  // ── List devices ──────────────────────────────────────────────────────────
  const devices = await client.listDevices();
  console.log(`\nDevices (${devices.length}):`);
  for (const d of devices) {
    console.log(
      `  ${d.serial} — ${d.displayName ?? '(no name)'} ` +
      `[${d.connectivityStatus}] temp=${d.lastTemperatureC ?? 'N/A'}°C`,
    );
  }

  // ── Provision a new device ─────────────────────────────────────────────────
  const serial = 'SENS-TH-99001';
  console.log(`\nProvisioning ${serial}...`);
  try {
    const { mqtt } = await client.provisionDevice({
      serial,
      displayName: 'Test Freezer',
      powerSource: 'battery',
    });
    console.log(`  MQTT username: ${mqtt.username}`);
    console.log(`  MQTT password: ${mqtt.password}  ← store securely, shown once`);
    console.log(`  Topic: ${mqtt.topic}`);
  } catch (err: any) {
    if (err.code === 'DEVICE_ALREADY_PROVISIONED') {
      console.log('  Device already provisioned, skipping.');
    } else {
      throw err;
    }
  }

  // ── Create alert rule ──────────────────────────────────────────────────────
  console.log('\nCreating alert rule: temperature > -15°C...');
  const rule = await client.createAlertRule(serial, {
    metric: 'temperature_c',
    operator: 'gt',
    threshold: -15,
    cooldownMinutes: 30,
  });
  console.log(`  Rule created: ${rule.id}`);

  // ── Read recent readings ──────────────────────────────────────────────────
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const page = await client.getReadings(serial, { limit: 5, since });
  console.log(`\nLast ${page.data.length} readings (past 24h):`);
  for (const r of page.data) {
    console.log(`  ${r.recordedAt}  ${r.temperatureC}°C  ${r.humidityPct}%`);
  }

  await client.logout();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
