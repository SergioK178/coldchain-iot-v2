const API_URL = process.env.API_URL || 'http://localhost:8080';

export async function POST(request: Request) {
  const cookie = request.headers.get('cookie') || '';

  // Refresh through backend auth route and rotate refresh cookie if needed.
  let refreshRes: Response;
  try {
    refreshRes = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { cookie },
    });
  } catch {
    return Response.json(
      { ok: false, error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Backend API is unavailable' } },
      { status: 503 },
    );
  }
  const refreshData = await refreshRes.json().catch(() => null);
  const accessToken = refreshData?.data?.accessToken as string | undefined;
  const refreshSetCookie = refreshRes.headers.get('set-cookie');

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

  if (!path || !path.startsWith('/api/v1/')) {
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
