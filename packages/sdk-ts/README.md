# @coldchain/sdk

TypeScript SDK for the ColdChain IoT monitoring platform.

**P2 baseline — single language, typed client.**  
Scope: P2 SHOULD/D1 (Track D, one typed client as DX baseline).

---

## Installation

```bash
npm install @coldchain/sdk
# or
pnpm add @coldchain/sdk
```

No external runtime dependencies — uses native `fetch` and `crypto.subtle` (Node.js 18+, Bun, Deno, modern browsers).

---

## Authentication

### JWT (recommended)

```typescript
import { ColdChainClient } from '@coldchain/sdk';

const { client } = await ColdChainClient.login('https://api.example.com', {
  email: 'admin@example.com',
  password: 'your-password',
});
```

### Legacy API_TOKEN

```typescript
const client = new ColdChainClient({
  baseUrl: 'https://api.example.com',
  auth: { type: 'token', apiToken: process.env.COLDCHAIN_API_TOKEN! },
});
```

---

## Usage

### List devices

```typescript
const devices = await client.listDevices();
for (const d of devices) {
  console.log(d.serial, d.connectivityStatus, d.lastTemperatureC);
}
```

### Provision a device

```typescript
const { mqtt } = await client.provisionDevice({
  serial: 'SENS-TH-00001',
  displayName: 'Freezer #1',
  powerSource: 'battery',
  zoneId: '...', // optional
});
// Store mqtt.password securely — returned only once
console.log(mqtt.username, mqtt.password);
```

### Read telemetry (paginated)

```typescript
// Single page
const page = await client.getReadings('SENS-TH-00001', {
  since: '2026-01-01T00:00:00Z',
  until: '2026-01-02T00:00:00Z',
  limit: 100,
});

// Iterate all pages automatically
for await (const reading of client.readingsIterator('SENS-TH-00001', { since: '...' })) {
  console.log(reading.recordedAt, reading.temperatureC);
}
```

### Alert rules

```typescript
await client.createAlertRule('SENS-TH-00001', {
  metric: 'temperature_c',
  operator: 'gt',
  threshold: -15,
  cooldownMinutes: 30,
});
```

### Webhooks

```typescript
const webhook = await client.createWebhook({
  url: 'https://your-receiver.example.com/webhook',
  secret: 'your-hmac-secret',
  events: ['alert.triggered', 'device.offline'],
});
```

### Export CSV

```typescript
const response = await client.exportReadings({
  deviceSerial: 'SENS-TH-00001',
  since: '2026-01-01T00:00:00Z',
  until: '2026-02-01T00:00:00Z',
  format: 'csv',
});
const csv = await response.text();
```

---

## Webhook Consumer

```typescript
import { verifyWebhookSignature } from '@coldchain/sdk';

// In your HTTP handler:
const rawBody = await request.arrayBuffer();
const signature = request.headers.get('X-Signature-256') ?? '';
const valid = await verifyWebhookSignature(
  process.env.COLDCHAIN_WEBHOOK_SECRET!,
  new Uint8Array(rawBody),
  signature,
);
if (!valid) throw new Error('Invalid signature');
```

See [`examples/webhook-consumer.ts`](./examples/webhook-consumer.ts) for a complete Node.js receiver.

---

## Error handling

```typescript
import { ColdChainClient, ColdChainError } from '@coldchain/sdk';

try {
  await client.getDevice('SENS-TH-99999');
} catch (err) {
  if (err instanceof ColdChainError) {
    console.log(err.code);   // 'DEVICE_NOT_FOUND'
    console.log(err.status); // 404
  }
}
```

---

## Examples

- [`examples/quickstart.ts`](./examples/quickstart.ts) — Login, list devices, provision, alert rules, readings.
- [`examples/webhook-consumer.ts`](./examples/webhook-consumer.ts) — Receive and verify webhook events.

Run an example:
```bash
COLDCHAIN_URL=http://localhost:8080 \
COLDCHAIN_EMAIL=admin@coldchain.local \
COLDCHAIN_PASSWORD=your-password \
npx tsx examples/quickstart.ts
```

---

## Compatibility

- ColdChain API v1 (P2 baseline)
- Node.js 18+ / Bun / Deno (native fetch + crypto.subtle required)
- No breaking changes to `/api/v1` in P2 scope
