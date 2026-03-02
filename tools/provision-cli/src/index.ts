import { readFileSync, writeFileSync } from 'node:fs';

const API_URL = process.env.API_URL ?? getArg('--api-url') ?? 'http://localhost:8080';
const API_TOKEN = process.env.API_TOKEN ?? getArg('--api-token') ?? '';
const CSV_FILE = process.env.CSV_FILE ?? getArg('--file') ?? '';
const OUTPUT_FILE = getArg('--output-file');

if (!CSV_FILE) {
  console.error('Usage: provision --file <csv> --api-url <url> --api-token <token>');
  console.error('  CSV format: serial,displayName,powerSource,zoneId');
  process.exit(1);
}

if (!API_TOKEN) {
  console.error('Error: --api-token or API_TOKEN is required');
  process.exit(1);
}

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

interface ProvisionResult {
  serial: string;
  success: boolean;
  mqttUsername?: string;
  mqttPassword?: string;
  error?: string;
}

async function provisionDevice(
  serial: string,
  displayName: string,
  powerSource: string,
  zoneId: string | undefined,
): Promise<ProvisionResult> {
  const body: Record<string, unknown> = { serial, displayName, powerSource };
  if (zoneId) body.zoneId = zoneId;

  try {
    const res = await fetch(`${API_URL}/api/v1/devices/provision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify(body),
    });

    const json = await res.json() as any;

    if (json.ok) {
      return {
        serial,
        success: true,
        mqttUsername: json.data.mqtt.username,
        mqttPassword: json.data.mqtt.password,
      };
    }

    return { serial, success: false, error: `${json.error.code}: ${json.error.message}` };
  } catch (err: any) {
    return { serial, success: false, error: err.message };
  }
}

async function main() {
  const csvContent = readFileSync(CSV_FILE, 'utf-8');
  const lines = csvContent.trim().split('\n');

  // Skip header if present
  const header = lines[0].toLowerCase();
  const startIdx = header.includes('serial') ? 1 : 0;

  const results: ProvisionResult[] = [];

  for (let i = startIdx; i < lines.length; i++) {
    const parts = lines[i].split(',').map((s) => s.trim());
    const [serial, displayName, powerSource, zoneId] = parts;

    if (!serial || !powerSource) {
      results.push({ serial: serial || `line_${i + 1}`, success: false, error: 'Missing serial or powerSource' });
      continue;
    }

    console.log(`Provisioning ${serial}...`);
    const result = await provisionDevice(serial, displayName || '', powerSource, zoneId || undefined);
    results.push(result);

    if (result.success) {
      console.log(`  OK: ${result.mqttUsername} / ${result.mqttPassword}`);
    } else {
      console.log(`  FAIL: ${result.error}`);
    }
  }

  // Summary
  const ok = results.filter((r) => r.success).length;
  const fail = results.filter((r) => !r.success).length;
  console.log(`\nDone: ${ok} provisioned, ${fail} failed out of ${results.length}`);

  // Output file
  if (OUTPUT_FILE) {
    const outputLines = ['serial,mqtt_username,mqtt_password,status,error'];
    for (const r of results) {
      outputLines.push(
        `${r.serial},${r.mqttUsername ?? ''},${r.mqttPassword ?? ''},${r.success ? 'ok' : 'fail'},${r.error ?? ''}`,
      );
    }
    writeFileSync(OUTPUT_FILE, outputLines.join('\n') + '\n', 'utf-8');
    console.log(`Credentials saved to ${OUTPUT_FILE}`);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
