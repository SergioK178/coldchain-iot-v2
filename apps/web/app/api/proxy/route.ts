const API_URL = process.env.API_URL || 'http://localhost:8080';

type RefreshResult = {
  accessToken?: string;
  refreshSetCookies: string[];
};

const refreshInflight = new Map<string, Promise<RefreshResult>>();
const accessCache = new Map<string, { token: string; expMs: number; updatedAt: number }>();
const ACCESS_EXP_SKEW_MS = 60_000;
const ACCESS_CACHE_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const ACCESS_CACHE_MAX_ENTRIES = 5_000;

function extractSetCookies(headers: Headers): string[] {
  const withMethod = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withMethod.getSetCookie === 'function') {
    const values = withMethod.getSetCookie();
    if (values.length > 0) return values;
  }
  const single = headers.get('set-cookie');
  return single ? [single] : [];
}

function extractRefreshToken(rawCookie: string): string | null {
  let token: string | null = null;
  for (const part of rawCookie.split(';')) {
    const [name, ...valueParts] = part.trim().split('=');
    if (name !== 'refreshToken' || valueParts.length === 0) continue;
    const rawValue = valueParts.join('=').trim();
    if (!rawValue) continue;
    try {
      token = decodeURIComponent(rawValue);
    } catch {
      token = rawValue;
    }
  }
  return token;
}

function extractRefreshTokenFromSetCookies(setCookies: string[]): string | null {
  for (const sc of setCookies) {
    const m = sc.match(/^refreshToken=([^;]+)/i);
    if (!m) continue;
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }
  return null;
}

function parseJwtExpMs(accessToken: string): number | null {
  const parts = accessToken.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { exp?: number };
    if (typeof payload.exp !== 'number') return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

function readCachedAccess(refreshKey: string | null): string | null {
  if (!refreshKey) return null;
  const now = Date.now();
  const cached = accessCache.get(refreshKey);
  if (!cached) return null;

  const expiredByExp = now >= cached.expMs - ACCESS_EXP_SKEW_MS;
  const expiredByAge = now - cached.updatedAt >= ACCESS_CACHE_MAX_AGE_MS;
  if (expiredByExp || expiredByAge) {
    accessCache.delete(refreshKey);
    return null;
  }

  cached.updatedAt = now;
  return cached.token;
}

function pruneAccessCache(now = Date.now()): void {
  if (accessCache.size === 0) return;
  for (const [key, value] of accessCache.entries()) {
    const expiredByExp = now >= value.expMs - ACCESS_EXP_SKEW_MS;
    const expiredByAge = now - value.updatedAt >= ACCESS_CACHE_MAX_AGE_MS;
    if (expiredByExp || expiredByAge) accessCache.delete(key);
  }
  if (accessCache.size <= ACCESS_CACHE_MAX_ENTRIES) return;

  const entriesByAge = [...accessCache.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt);
  const excess = accessCache.size - ACCESS_CACHE_MAX_ENTRIES;
  for (let i = 0; i < excess; i += 1) {
    const key = entriesByAge[i]?.[0];
    if (key) accessCache.delete(key);
  }
}

function writeCachedAccess(refreshKey: string | null, accessToken: string): void {
  if (!refreshKey) return;
  const expMs = parseJwtExpMs(accessToken);
  if (!expMs) return;
  pruneAccessCache();
  accessCache.set(refreshKey, { token: accessToken, expMs, updatedAt: Date.now() });
}

function appendSetCookies(target: Headers, setCookies: string[]): void {
  for (const sc of setCookies) {
    target.append('set-cookie', sc);
  }
}

async function runRefresh(cookie: string, forwardedProto?: string | null): Promise<RefreshResult> {
  const headers: Record<string, string> = { cookie };
  if (forwardedProto) headers['x-forwarded-proto'] = forwardedProto;
  let refreshRes: Response;
  try {
    refreshRes = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers,
    });
  } catch {
    throw new Error('UPSTREAM_UNAVAILABLE');
  }

  const refreshData = await refreshRes.json().catch(() => null);
  const refreshSetCookies = extractSetCookies(refreshRes.headers);
  return {
    accessToken: refreshData?.data?.accessToken as string | undefined,
    refreshSetCookies,
  };
}

async function refreshWithSingleFlight(cookie: string, forwardedProto?: string | null): Promise<RefreshResult> {
  const key = extractRefreshToken(cookie) ?? `raw:${cookie}`;
  const existing = refreshInflight.get(key);
  if (existing) return existing;
  const promise = runRefresh(cookie, forwardedProto).finally(() => {
    refreshInflight.delete(key);
  });
  refreshInflight.set(key, promise);
  return promise;
}

function responseWithCookies(
  body: unknown,
  status: number,
  setCookies: string[],
): Response {
  const headers = new Headers();
  appendSetCookies(headers, setCookies);
  return Response.json(body, { status, headers });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null) as
    | { path?: string; method?: string; body?: unknown }
    | null;
  const path = payload?.path;
  const method = (payload?.method ?? 'GET').toUpperCase();

  if (!path || typeof path !== 'string') {
    return Response.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid path' } },
      { status: 400 },
    );
  }
  if (!path.startsWith('/api/v1/') || path.includes('..') || path.includes('//')) {
    return Response.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid path' } },
      { status: 400 },
    );
  }
  if (path.startsWith('/api/v1/auth/')) {
    return Response.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Auth path is not allowed via /api/proxy' } },
      { status: 400 },
    );
  }
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) {
    return Response.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid method' } },
      { status: 400 },
    );
  }

  const cookie = request.headers.get('cookie') || '';
  const forwardedProto = request.headers.get('x-forwarded-proto');
  let refreshKey = extractRefreshToken(cookie);
  const refreshSetCookies: string[] = [];

  const refreshAccessToken = async (): Promise<string | null> => {
    let refresh: RefreshResult;
    try {
      refresh = await refreshWithSingleFlight(cookie, forwardedProto);
    } catch {
      throw new Error('UPSTREAM_UNAVAILABLE');
    }

    refreshSetCookies.push(...refresh.refreshSetCookies);
    if (!refresh.accessToken) {
      if (refreshKey) accessCache.delete(refreshKey);
      return null;
    }

    const nextRefreshKey = extractRefreshTokenFromSetCookies(refresh.refreshSetCookies) ?? refreshKey;
    if (refreshKey && nextRefreshKey && refreshKey !== nextRefreshKey) {
      accessCache.delete(refreshKey);
    }
    refreshKey = nextRefreshKey;
    writeCachedAccess(refreshKey, refresh.accessToken);
    return refresh.accessToken;
  };

  let accessToken = readCachedAccess(refreshKey);
  if (!accessToken && !refreshKey) {
    return responseWithCookies(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      401,
      refreshSetCookies,
    );
  }
  if (!accessToken) {
    try {
      accessToken = await refreshAccessToken();
    } catch {
      return responseWithCookies(
        { ok: false, error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Backend API is unavailable' } },
        503,
        refreshSetCookies,
      );
    }
  }

  if (!accessToken) {
    return responseWithCookies(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      401,
      refreshSetCookies,
    );
  }

  const targetUrl = `${API_URL}${path}`;
  const body = payload?.body !== undefined ? JSON.stringify(payload.body) : undefined;
  const buildHeaders = (token: string) => {
    const headers = new Headers({ Authorization: `Bearer ${token}` });
    if (body) headers.set('Content-Type', 'application/json');
    return headers;
  };
  let headers = buildHeaders(accessToken);

  let res: Response;
  try {
    res = await fetch(targetUrl, { method, headers, body });
  } catch {
    return responseWithCookies(
      { ok: false, error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Backend API is unavailable' } },
      503,
      refreshSetCookies,
    );
  }

  if (res.status === 401) {
    if (refreshKey) accessCache.delete(refreshKey);
    try {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        return responseWithCookies(
          { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
          401,
          refreshSetCookies,
        );
      }
      headers = buildHeaders(refreshed);
      res = await fetch(targetUrl, { method, headers, body });
    } catch {
      return responseWithCookies(
        { ok: false, error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Backend API is unavailable' } },
        503,
        refreshSetCookies,
      );
    }
  }

  const resHeaders = new Headers();
  appendSetCookies(resHeaders, refreshSetCookies);
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const data = await res.json().catch(() => ({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Invalid JSON response' } }));
    return Response.json(data, { status: res.status, headers: resHeaders });
  }
  const text = await res.text();
  const cd = res.headers.get('content-disposition');
  if (ct) resHeaders.set('content-type', ct);
  if (cd) resHeaders.set('content-disposition', cd);
  return new Response(text, { status: res.status, headers: resHeaders });
}
