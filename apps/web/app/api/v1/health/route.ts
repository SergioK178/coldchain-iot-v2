const API_URL = process.env.API_URL || 'http://localhost:8080';

const noCache = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

export async function GET() {
  try {
    const res = await fetch(`${API_URL}/api/v1/health`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    return Response.json(data, { status: res.status, headers: noCache });
  } catch {
    return Response.json(
      { ok: false, error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Backend unavailable' } },
      { status: 503, headers: noCache }
    );
  }
}
