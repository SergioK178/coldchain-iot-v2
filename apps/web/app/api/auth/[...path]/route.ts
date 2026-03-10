const API_URL = process.env.API_URL || 'http://localhost:8080';

function extractSetCookies(headers: Headers): string[] {
  const withMethod = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withMethod.getSetCookie === 'function') {
    const values = withMethod.getSetCookie();
    if (values.length > 0) return values;
  }
  const single = headers.get('set-cookie');
  return single ? [single] : [];
}

async function proxy(
  path: string[],
  request: Request
): Promise<Response> {
  const pathStr = path.join('/');
  const url = new URL(`/api/v1/auth/${pathStr}`, API_URL);
  const headers = new Headers(request.headers);
  headers.delete('host');
  // Cookie и X-Forwarded-Proto пробрасываются для auth и Secure cookie
  const body = request.method !== 'GET' ? await request.text() : undefined;
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: request.method,
      headers,
      body,
      credentials: 'include',
    });
  } catch {
    return Response.json(
      { ok: false, error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Backend API is unavailable' } },
      { status: 503 }
    );
  }
  const resHeaders = new Headers(res.headers);
  const setCookies = extractSetCookies(res.headers);
  for (const sc of setCookies) resHeaders.append('set-cookie', sc);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: resHeaders,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(path, request);
}

export async function GET() {
  return Response.json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST for auth' } }, { status: 405 });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
