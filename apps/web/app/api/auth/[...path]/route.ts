const API_URL = process.env.API_URL || 'http://localhost:8080';

async function proxy(
  path: string[],
  request: Request
): Promise<Response> {
  const pathStr = path.join('/');
  const url = new URL(`/api/v1/auth/${pathStr}`, API_URL);
  const headers = new Headers(request.headers);
  headers.delete('host');
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
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) resHeaders.set('set-cookie', setCookie);
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
