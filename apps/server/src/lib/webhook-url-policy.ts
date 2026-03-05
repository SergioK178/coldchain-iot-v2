import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

type ValidationResult = { ok: true } | { ok: false; reason: string };

function parseAllowlist(raw: string): Set<string> {
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number.parseInt(octet, 10), 0) >>> 0;
}

function inIpv4Cidr(ip: string, cidrBase: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : ((0xffffffff << (32 - bits)) >>> 0);
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(cidrBase) & mask);
}

function isForbiddenIpv4(ip: string): boolean {
  return (
    inIpv4Cidr(ip, '0.0.0.0', 8) ||
    inIpv4Cidr(ip, '10.0.0.0', 8) ||
    inIpv4Cidr(ip, '127.0.0.0', 8) ||
    inIpv4Cidr(ip, '169.254.0.0', 16) ||
    inIpv4Cidr(ip, '172.16.0.0', 12) ||
    inIpv4Cidr(ip, '192.168.0.0', 16) ||
    inIpv4Cidr(ip, '100.64.0.0', 10) ||
    inIpv4Cidr(ip, '224.0.0.0', 4)
  );
}

function normalizeIpv6(ip: string): string {
  return ip.toLowerCase();
}

function isForbiddenIpv6(ip: string): boolean {
  const v = normalizeIpv6(ip);
  return (
    v === '::' ||
    v === '::1' ||
    v.startsWith('fc') ||
    v.startsWith('fd') ||
    v.startsWith('fe8') ||
    v.startsWith('fe9') ||
    v.startsWith('fea') ||
    v.startsWith('feb') ||
    v.startsWith('ff')
  );
}

function isForbiddenIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isForbiddenIpv4(ip);
  if (kind === 6) return isForbiddenIpv6(ip);
  return true;
}

async function resolveTargetIps(hostname: string): Promise<string[]> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((r) => r.address);
}

export async function validateWebhookUrl(inputUrl: string, allowlistRaw: string): Promise<ValidationResult> {
  let url: URL;
  try {
    url = new URL(inputUrl);
  } catch {
    return { ok: false, reason: 'Invalid URL' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'Only http/https are allowed' };
  }

  const hostname = url.hostname.trim().toLowerCase();
  if (!hostname) return { ok: false, reason: 'URL hostname is required' };
  if (hostname === 'localhost' || hostname.endsWith('.local')) {
    return { ok: false, reason: 'Localhost/local domain targets are forbidden' };
  }

  const allowlist = parseAllowlist(allowlistRaw);
  if (allowlist.size > 0 && !allowlist.has(hostname)) {
    return { ok: false, reason: 'Hostname is not in WEBHOOK_ALLOWLIST_HOSTS' };
  }

  if (isIP(hostname)) {
    if (isForbiddenIp(hostname)) {
      return { ok: false, reason: 'Internal/private IP target is forbidden' };
    }
    return { ok: true };
  }

  let addresses: string[];
  try {
    addresses = await resolveTargetIps(hostname);
  } catch {
    return { ok: false, reason: 'Unable to resolve webhook hostname' };
  }

  if (addresses.length === 0) {
    return { ok: false, reason: 'Webhook hostname has no DNS records' };
  }

  for (const ip of addresses) {
    if (isForbiddenIp(ip)) {
      return { ok: false, reason: `Resolved internal/private IP is forbidden: ${ip}` };
    }
  }

  return { ok: true };
}
