import { randomBytes, pbkdf2 as pbkdf2Cb } from 'node:crypto';
import { promisify } from 'node:util';
import { writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

const pbkdf2 = promisify(pbkdf2Cb);

const ITERATIONS = 101;
const KEY_LENGTH = 64; // 512 bits
const DIGEST = 'sha512';

/**
 * Generate a Mosquitto-compatible PBKDF2-SHA512 password hash.
 * Format: $7$iterations$base64salt$base64hash
 */
export async function generateMosquittoHash(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  return `$7$${ITERATIONS}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

/**
 * Generate a random MQTT password (32 hex chars).
 */
export function generateMqttPassword(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Generate MQTT username from serial.
 * Format: dev_{serial_lowercase}
 */
export function mqttUsernameFromSerial(serial: string): string {
  return `dev_${serial.toLowerCase().replace(/-/g, '_')}`;
}

export interface MosquittoUser {
  username: string;
  passwordHash: string;
}

export interface MosquittoAclEntry {
  username: string;
  serial: string;
}

/**
 * Build passwd file content from users list.
 */
function buildPasswdContent(users: MosquittoUser[]): string {
  return users.map((u) => `${u.username}:${u.passwordHash}`).join('\n') + '\n';
}

/**
 * Build ACL file content.
 * Admin user gets subscribe access to all device topics.
 * Device users get publish access only to their own topics.
 */
function buildAclContent(adminUsername: string, devices: MosquittoAclEntry[]): string {
  const lines: string[] = [];

  // Admin: subscribe to all telemetry and status
  lines.push(`user ${adminUsername}`);
  lines.push('topic read d/+/t');
  lines.push('topic read d/+/s');
  lines.push('');

  // Per-device ACL
  for (const dev of devices) {
    lines.push(`user ${dev.username}`);
    lines.push(`topic write d/${dev.serial}/t`);
    lines.push(`topic write d/${dev.serial}/s`);
    lines.push(`topic read d/${dev.serial}/s`);
    lines.push('');
  }

  return lines.join('\n') + '\n';
}

/**
 * Write content to a file atomically (tmp + rename in same directory).
 */
async function writeAtomically(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.tmp.${process.pid}`);
  await writeFile(tmpPath, content, 'utf-8');
  await rename(tmpPath, filePath);
}

/**
 * Rebuild both passwd and acl files from full state.
 */
export async function rebuildMosquittoFiles(opts: {
  dataDir: string;
  adminUsername: string;
  adminPasswordHash: string;
  devices: Array<{ username: string; passwordHash: string; serial: string }>;
}): Promise<void> {
  const { dataDir, adminUsername, adminPasswordHash, devices } = opts;

  // Build users list: admin + all active devices
  const users: MosquittoUser[] = [
    { username: adminUsername, passwordHash: adminPasswordHash },
    ...devices.map((d) => ({ username: d.username, passwordHash: d.passwordHash })),
  ];

  const aclEntries: MosquittoAclEntry[] = devices.map((d) => ({
    username: d.username,
    serial: d.serial,
  }));

  const passwdContent = buildPasswdContent(users);
  const aclContent = buildAclContent(adminUsername, aclEntries);

  const passwdPath = path.join(dataDir, 'passwd');
  const aclPath = path.join(dataDir, 'acl');

  await writeAtomically(passwdPath, passwdContent);
  await writeAtomically(aclPath, aclContent);
}
