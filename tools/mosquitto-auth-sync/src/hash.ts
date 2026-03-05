import { randomBytes, pbkdf2 } from 'node:crypto';
import { promisify } from 'node:util';

const pbkdf2Async = promisify(pbkdf2);

const ITERATIONS = 101;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';
const SALT_BYTES = 12;

/** Mosquitto-compatible PBKDF2-SHA512 hash for admin password. */
export async function hashPassword(password: string): Promise<string> {
  const saltBytes = randomBytes(SALT_BYTES);
  const saltBase64 = saltBytes.toString('base64').replace(/=+$/g, '');
  const derived = await pbkdf2Async(
    password,
    Buffer.from(saltBase64, 'base64'),
    ITERATIONS,
    KEY_LENGTH,
    DIGEST
  );
  return `$7$${ITERATIONS}$${saltBase64}$${derived.toString('base64')}`;
}
