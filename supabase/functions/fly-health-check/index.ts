import { getServiceClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

async function tryFlyRender(flyUrl: string, flySecret: string | undefined): Promise<{ ok: boolean; status?: number; chars?: number; error?: string }> {
  try {
    const response = await fetch(`${flyUrl}/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(flySecret ? { 'x-secret': flySecret } : {}),
      },
      body: JSON.stringify({ url: 'https://example.com', timeout: 20000, waitFor: 1000 }),
      signal: AbortSignal.timeout(60000),
    });

    if (response.ok) {
      const html = await response.text();
      return { ok: true, status: response.status, chars: html.length };
    }
    return { ok: false, status: response.status, error: `HTTP ${response.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check — admin only
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
  const isAdmin = roles?.some((r: any) => r.role === 'admin');
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const flyUrl = Deno.env.get('FLY_RENDERER_URL');
  const flySecret = Deno.env.get('FLY_RENDERER_SECRET');

  if (!flyUrl) {
    return new Response(JSON.stringify({ status: 'error', message: 'FLY_RENDERER_URL not configured' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Attempt 1
  let result = await tryFlyRender(flyUrl, flySecret);

  // Retry once if failed (cold start)
  if (!result.ok) {
    console.log(`[fly-health-check] Attempt 1 failed: ${result.error}. Retrying in 5s...`);
    await new Promise(r => setTimeout(r, 5000));
    result = await tryFlyRender(flyUrl, flySecret);
  }

  if (result.ok) {
    return new Response(JSON.stringify({
      status: 'ok',
      message: `Fly.io Playwright opérationnel (${result.chars} chars rendus)`,
      rendered_chars: result.chars,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } else {
    return new Response(JSON.stringify({
      status: 'error',
      message: result.status
        ? `Fly.io a répondu avec HTTP ${result.status}`
        : `Fly.io inaccessible: ${result.error}`,
      http_status: result.status || null,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
