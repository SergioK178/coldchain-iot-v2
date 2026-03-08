import type { WebhookEvent } from './types.js';

// ── Webhook payload types ─────────────────────────────────────────────────────

export interface WebhookPayloadBase {
  event: WebhookEvent;
  timestamp: string;
  webhookId: string;
  deliveryId: string;
}

export interface AlertTriggeredPayload extends WebhookPayloadBase {
  event: 'alert.triggered';
  data: {
    alertEventId: string;
    deviceSerial: string;
    deviceName: string | null;
    metric: string;
    operator: string;
    readingValue: number;
    thresholdValue: number;
    triggeredAt: string;
  };
}

export interface AlertAcknowledgedPayload extends WebhookPayloadBase {
  event: 'alert.acknowledged';
  data: {
    alertEventId: string;
    deviceSerial: string;
    acknowledgedBy: string;
    acknowledgedAt: string;
  };
}

export interface DeviceOfflinePayload extends WebhookPayloadBase {
  event: 'device.offline';
  data: {
    deviceSerial: string;
    deviceName: string | null;
    lastSeenAt: string | null;
  };
}

export interface DeviceOnlinePayload extends WebhookPayloadBase {
  event: 'device.online';
  data: {
    deviceSerial: string;
    deviceName: string | null;
  };
}

export type AnyWebhookPayload =
  | AlertTriggeredPayload
  | AlertAcknowledgedPayload
  | DeviceOfflinePayload
  | DeviceOnlinePayload;

// ── HMAC verification ─────────────────────────────────────────────────────────

/**
 * Verify an incoming webhook request signature.
 *
 * Use this in your webhook receiver to ensure the request originated from ColdChain.
 *
 * @param secret   The webhook signing secret (set when creating the webhook).
 * @param rawBody  The raw request body bytes (do NOT parse JSON before calling this).
 * @param signature The value of the `X-Signature-256` header (format: `sha256=<hex>`).
 */
export async function verifyWebhookSignature(
  secret: string,
  rawBody: Uint8Array | string,
  signature: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = typeof secret === 'string' ? encoder.encode(secret) : secret;
  const bodyData = typeof rawBody === 'string' ? encoder.encode(rawBody) : rawBody;

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, bodyData);
  const hex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const expected = `sha256=${hex}`;

  if (expected.length !== signature.length) return false;

  // Constant-time comparison
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}
