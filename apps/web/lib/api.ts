export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let onUnauthorized: (() => void) | null = null;
let onUnauthorizedScheduled = false;
export function setOnUnauthorized(handler: (() => void) | null) {
  onUnauthorized = handler;
  if (!handler) onUnauthorizedScheduled = false;
}

/** Call when a raw fetch returns 401 (e.g. export, loadMoreReadings) */
export function triggerUnauthorized() {
  if (onUnauthorized && !onUnauthorizedScheduled) {
    onUnauthorizedScheduled = true;
    onUnauthorized();
  }
}

async function proxyFetch(path: string, options: { method?: string; body?: unknown } = {}) {
  const res = await fetch('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      path,
      method: options.method ?? 'GET',
      body: options.body,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && onUnauthorized && !onUnauthorizedScheduled) {
      onUnauthorizedScheduled = true;
      onUnauthorized();
    }
    const err = new ApiError(data?.error?.message ?? 'Request failed', res.status, data?.error?.code);
    throw err;
  }
  return data;
}

export async function apiGet<T = unknown>(path: string): Promise<{ ok: true; data: T }> {
  return proxyFetch(path) as Promise<{ ok: true; data: T }>;
}

export async function apiPost<T = unknown>(path: string, body: unknown): Promise<{ ok: true; data: T }> {
  return proxyFetch(path, { method: 'POST', body }) as Promise<{ ok: true; data: T }>;
}

export async function apiPatch<T = unknown>(path: string, body: unknown): Promise<{ ok: true; data: T }> {
  return proxyFetch(path, { method: 'PATCH', body }) as Promise<{ ok: true; data: T }>;
}

export async function apiDelete(path: string): Promise<{ ok: true }> {
  return proxyFetch(path, { method: 'DELETE' }) as Promise<{ ok: true }>;
}
