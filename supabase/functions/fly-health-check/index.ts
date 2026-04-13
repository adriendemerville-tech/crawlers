import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * fly-health-check — Pings the Fly.io renderer to verify availability.
 */
Deno.serve(handleRequest(async (_req) => {
  const flyUrl = Deno.env.get('FLY_RENDERER_URL');
  const flySecret = Deno.env.get('FLY_RENDERER_SECRET');

  if (!flyUrl) {
    return jsonOk({ status: 'error', message: 'FLY_RENDERER_URL not configured' });
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (flySecret) headers['x-secret'] = flySecret;

    const res = await fetch(`${flyUrl}/health`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const body = await res.text();
      return jsonOk({ status: 'ok', message: `Fly.io OK (${res.status})`, detail: body.slice(0, 200) });
    }

    return jsonOk({ status: 'error', message: `Fly.io returned ${res.status}` });
  } catch (err) {
    return jsonOk({ status: 'error', message: err instanceof Error ? err.message : 'Fly.io unreachable' });
  }
}, 'fly-health-check'));
