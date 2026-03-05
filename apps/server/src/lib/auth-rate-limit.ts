type LimitConfig = {
  max: number;
  windowSec: number;
  blockSec: number;
};

type Entry = {
  hits: number[];
  blockedUntil: number;
};

export class InMemoryRateLimiter {
  private readonly entries = new Map<string, Entry>();

  private getEntry(key: string): Entry {
    const existing = this.entries.get(key);
    if (existing) return existing;
    const created: Entry = { hits: [], blockedUntil: 0 };
    this.entries.set(key, created);
    return created;
  }

  private prune(nowMs: number, windowMs: number): void {
    for (const [k, v] of this.entries.entries()) {
      v.hits = v.hits.filter((ts) => ts > nowMs - windowMs);
      if (v.hits.length === 0 && v.blockedUntil <= nowMs) {
        this.entries.delete(k);
      }
    }
  }

  consume(key: string, cfg: LimitConfig): { allowed: boolean; retryAfterSec: number } {
    const now = Date.now();
    const windowMs = cfg.windowSec * 1000;
    const blockMs = cfg.blockSec * 1000;
    this.prune(now, windowMs);

    const entry = this.getEntry(key);
    if (entry.blockedUntil > now) {
      return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((entry.blockedUntil - now) / 1000)) };
    }

    entry.hits = entry.hits.filter((ts) => ts > now - windowMs);
    if (entry.hits.length >= cfg.max) {
      if (blockMs > 0) {
        entry.blockedUntil = now + blockMs;
        return { allowed: false, retryAfterSec: cfg.blockSec };
      }
      const oldest = entry.hits[0] ?? now;
      const retryMs = Math.max(1, windowMs - (now - oldest));
      return { allowed: false, retryAfterSec: Math.ceil(retryMs / 1000) };
    }

    entry.hits.push(now);
    return { allowed: true, retryAfterSec: 0 };
  }

  reset(key: string): void {
    this.entries.delete(key);
  }
}
