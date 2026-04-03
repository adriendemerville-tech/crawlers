import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

Deno.serve(handleRequest(async (req) => {
  const flyUrl = Deno.env.get('FLY_RENDERER_URL');
  if (!flyUrl) {
    return jsonError('Error', 500);
  }

  try {
    const start = Date.now();
    const res = await fetch(`${flyUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(15000),
    });
    const latencyMs = Date.now() - start;
    const alive = res.ok;

    console.log(`[fly-keepalive] Ping ${alive ? '✅' : '❌'} (${latencyMs}ms, status ${res.status})`);

    return jsonOk({ ok: alive, latencyMs, status: res.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[fly-keepalive] ❌ Ping failed: ${msg}`);
    return jsonError('Error', 502);
  }
}));