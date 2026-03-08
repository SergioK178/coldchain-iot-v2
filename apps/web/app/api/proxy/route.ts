const API_URL = process.env.API_URL || 'http://localhost:8080';

type RefreshResult = {
  accessToken?: string;
  refreshSetCookie?: string | null;
};

const refreshInflight = new Map<string, Promise<RefreshResult>>();

function extractRefreshToken(rawCookie: string): string | null {
  const m = rawCookie.match(/(?:^|;\s*)refreshToken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function runRefresh(cookie: string): Promise<RefreshResult> {
  let refreshRes: Response;
  try {
    refreshRes = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { cookie },
    });
  } catch {
    throw new Error('UPSTREAM_UNAVAILABLE');
  }

  const refreshData = await refreshRes.json().catch(() => null);
  // Fetch API hides Set-Cookie (forbidden header); use getSetCookie() in Node.js
  const setCookies = 'getSetCookie' in refreshRes.headers ? (refreshRes.headers as Headers & { getSetCookie(): string[] }).getSetCookie() : [];
  const refreshSetCookie = setCookies[0] ?? null;
  return {
    accessToken: refreshData?.data?.accessToken as string | undefined,
    refreshSetCookie,
  };
}

async function refreshWithSingleFlight(cookie: string): Promise<RefreshResult> {
  const key = extractRefreshToken(cookie) ?? `raw:${cookie}`;
  const existing = refreshInflight.get(key);
  if (existing) return existing;
  const promise = runRefresh(cookie).finally(() => {
    refreshInflight.delete(key);
  });
  refreshInflight.set(key, promise);
  return promise;
}

export async function POST(request: Request) {
  const cookie = request.headers.get('cookie') || '';

  // Refresh through backend auth route and rotate refresh cookie if needed.
  let refresh: RefreshResult;
  try {
    refresh = await refreshWithSingleFlight(cookie);
  } catch {
    return Response.json(
      { ok: false, error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Backend API is unavailable' } },
      { status: 503 },
    );
  }
  const accessToken = refresh.accessToken;
  const refreshSetCookie = refresh.refreshSetCookie;

  if (!accessToken) {
    const headers = new Headers();
    if (refreshSetCookie) headers.set('set-cookie', refreshSetCookie);
    return Response.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401, headers },
    );
  }

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

  const targetUrl = `${API_URL}${path}`;
  const headers = new Headers({
    Authorization: `Bearer ${accessToken}`,
  });
  const body = payload?.body !== undefined ? JSON.stringify(payload.body) : undefined;
  if (body) headers.set('Content-Type', 'application/json');

  let res: Response;
  try {
    res = await fetch(targetUrl, { method, headers, body });
  } catch {
    const headers = new Headers();
    if (refreshSetCookie) headers.set('set-cookie', refreshSetCookie);
    return Response.json(
      { ok: false, error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Backend API is unavailable' } },
      { status: 503, headers },
    );
  }
  const resHeaders = new Headers();
  if (refreshSetCookie) resHeaders.set('set-cookie', refreshSetCookie);
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
