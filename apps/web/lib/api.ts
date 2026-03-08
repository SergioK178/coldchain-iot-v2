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

/** Raw fetch to /api/proxy with 401 retry. Use for export, loadMoreReadings. */
export async function proxyFetchRaw(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<Response> {
  const doReq = () =>
    fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ path, method: options.method ?? 'GET', body: options.body }),
    });
  let res = await doReq();
  if (res.status === 401) {
    await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    await new Promise((r) => setTimeout(r, 400));
    res = await doReq();
    if (res.status === 401) triggerUnauthorized();
  }
  return res;
}

async function doProxyRequest(path: string, options: { method?: string; body?: unknown } = {}) {
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
  return { res, data };
}

async function proxyFetch(path: string, options: { method?: string; body?: unknown } = {}) {
  const { res, data } = await doProxyRequest(path, options);
  if (res.ok) return data;

  if (res.status === 401) {
    // Явный refresh + retry: при ротации токена запрос мог уйти со старым cookie
    await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    await new Promise((r) => setTimeout(r, 400));
    const retry = await doProxyRequest(path, options);
    if (retry.res.ok) return retry.data;
    if (retry.res.status === 401 && onUnauthorized && !onUnauthorizedScheduled) {
      onUnauthorizedScheduled = true;
      onUnauthorized();
    }
  }

  throw new ApiError(data?.error?.message ?? 'Request failed', res.status, data?.error?.code);
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
