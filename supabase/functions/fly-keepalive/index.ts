import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

Deno.serve(handleRequest(async (req) => {
const flyUrl = Deno.env.get('FLY_RENDERER_URL');
  if (!flyUrl) {
    return new Response(JSON.stringify({ ok: false, error: 'FLY_RENDERER_URL not set' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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

    return new Response(JSON.stringify({ ok: alive, latencyMs, status: res.status }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[fly-keepalive] ❌ Ping failed: ${msg}`);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}));