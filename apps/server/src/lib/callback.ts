/**
 * HTTP POST with timeout. Returns status code or null on network error/timeout.
 */
export async function httpPost(
  url: string,
  body: object,
  timeoutMs: number,
): Promise<{ statusCode: number } | null> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { statusCode: response.status };
  } catch {
    return null;
  }
}
