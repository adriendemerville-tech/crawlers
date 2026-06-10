import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const key = Deno.env.get('RENDERING_API_KEY') || Deno.env.get('BROWSERLESS_API_KEY');
  if (!key) {
    return new Response(JSON.stringify({ ok: false, error: 'NO_KEY' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const started = Date.now();
  try {
    const r = await fetch(`https://production-sfo.browserless.io/content?token=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com',
        gotoOptions: { waitUntil: 'networkidle2', timeout: 15000 },
      }),
      signal: AbortSignal.timeout(20000),
    });
    const text = await r.text();
    return new Response(JSON.stringify({
      ok: r.ok,
      status: r.status,
      ms: Date.now() - started,
      keyPreview: `${key.slice(0, 4)}…${key.slice(-4)} (len ${key.length})`,
      bodyPreview: text.slice(0, 300),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      ms: Date.now() - started,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
