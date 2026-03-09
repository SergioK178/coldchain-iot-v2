const API_URL = process.env.API_URL || 'http://localhost:8080';

export async function GET() {
  try {
    const res = await fetch(`${API_URL}/api/v1/health`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json(
      { ok: false, error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Backend unavailable' } },
      { status: 503 }
    );
  }
}
