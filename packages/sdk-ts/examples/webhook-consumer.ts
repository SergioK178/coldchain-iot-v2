/**
 * ColdChain SDK — Webhook consumer example (Node.js / Bun / Deno)
 *
 * Shows how to receive, verify, and dispatch ColdChain webhook events.
 *
 * For a real server replace the simple http.createServer with Express/Fastify/etc.
 */
import http from 'node:http';
import { verifyWebhookSignature } from '../src/index.js';
import type { AnyWebhookPayload } from '../src/index.js';

const PORT = Number(process.env.PORT ?? 4000);
const WEBHOOK_SECRET = process.env.COLDCHAIN_WEBHOOK_SECRET ?? '';

if (!WEBHOOK_SECRET) {
  console.error('Set COLDCHAIN_WEBHOOK_SECRET env variable');
  process.exit(1);
}

// ── Event handlers ────────────────────────────────────────────────────────────

function onAlertTriggered(payload: AnyWebhookPayload & { event: 'alert.triggered' }) {
  const { deviceSerial, deviceName, metric, readingValue, thresholdValue } = payload.data;
  console.log(
    `ALERT on ${deviceName ?? deviceSerial}: ` +
    `${metric} = ${readingValue} (threshold ${thresholdValue})`,
  );
}

function onDeviceOffline(payload: AnyWebhookPayload & { event: 'device.offline' }) {
  const { deviceSerial, deviceName, lastSeenAt } = payload.data;
  console.log(`OFFLINE: ${deviceName ?? deviceSerial} (last seen: ${lastSeenAt ?? 'never'})`);
}

function onDeviceOnline(payload: AnyWebhookPayload & { event: 'device.online' }) {
  const { deviceSerial, deviceName } = payload.data;
  console.log(`ONLINE: ${deviceName ?? deviceSerial}`);
}

function onAlertAcknowledged(payload: AnyWebhookPayload & { event: 'alert.acknowledged' }) {
  const { deviceSerial, acknowledgedBy } = payload.data;
  console.log(`ACK on ${deviceSerial} by ${acknowledgedBy}`);
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

function dispatch(payload: AnyWebhookPayload) {
  switch (payload.event) {
    case 'alert.triggered':    return onAlertTriggered(payload);
    case 'alert.acknowledged': return onAlertAcknowledged(payload);
    case 'device.offline':     return onDeviceOffline(payload);
    case 'device.online':      return onDeviceOnline(payload);
    default: {
      const _exhaustive: never = payload;
      console.warn('Unknown event:', (_exhaustive as AnyWebhookPayload).event);
    }
  }
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/webhook') {
    res.writeHead(404).end();
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const rawBody = Buffer.concat(chunks);
  const signature = req.headers['x-signature-256'];

  if (!signature || typeof signature !== 'string') {
    res.writeHead(400).end('Missing X-Signature-256');
    return;
  }

  const valid = await verifyWebhookSignature(WEBHOOK_SECRET, rawBody, signature);
  if (!valid) {
    res.writeHead(401).end('Invalid signature');
    return;
  }

  let payload: AnyWebhookPayload;
  try {
    payload = JSON.parse(rawBody.toString()) as AnyWebhookPayload;
  } catch {
    res.writeHead(400).end('Invalid JSON');
    return;
  }

  console.log(`[${new Date().toISOString()}] Event: ${payload.event}  Delivery: ${payload.deliveryId}`);

  try {
    dispatch(payload);
    res.writeHead(200).end('ok');
  } catch (err) {
    console.error('Handler error:', err);
    res.writeHead(500).end('Internal error');
  }
});

server.listen(PORT, () => {
  console.log(`Webhook consumer listening on http://localhost:${PORT}/webhook`);
});
