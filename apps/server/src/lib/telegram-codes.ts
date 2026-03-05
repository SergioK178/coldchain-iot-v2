/** In-memory one-time codes for Telegram linking. Code -> { userId, expiresAt } */
const store = new Map<string, { userId: string; expiresAt: number }>();

const TTL_MS = 5 * 60 * 1000; // 5 min

function cleanExpired(): void {
  const now = Date.now();
  for (const [code, data] of store.entries()) {
    if (data.expiresAt <= now) store.delete(code);
  }
}

export function createCode(userId: string): { code: string; expiresIn: number } {
  cleanExpired();
  const code = Math.floor(100_000 + Math.random() * 900_000).toString();
  store.set(code, { userId, expiresAt: Date.now() + TTL_MS });
  return { code, expiresIn: TTL_MS / 1000 };
}

export function consumeCode(code: string): string | null {
  cleanExpired();
  const entry = store.get(code);
  if (!entry || entry.expiresAt <= Date.now()) return null;
  store.delete(code);
  return entry.userId;
}
