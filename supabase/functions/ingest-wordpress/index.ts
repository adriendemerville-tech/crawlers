import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { normalize } from '../_shared/normalizer.ts';

/**
 * ingest-wordpress — Webhook receiver for the crawlers.fr WordPress plugin.
 * Auth: X-Crawlers-Key header, matched against hashed API key in connectors.
 * Receives pre-parsed entries from PHP plugin (limited — misses cached requests).
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = req.headers.get('X-Crawlers-Key') || req.headers.get('x-crawlers-key');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing X-Crawlers-Key header', code: 'MISSING_KEY' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Hash the key
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(apiKey));
    const keyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    const supabase = getServiceClient();
    const { data: connector, error: connError } = await supabase
      .from('log_connectors')
      .select('id, tracked_site_id')
      .eq('type', 'wordpress_plugin')
      .eq('api_key_hash', keyHash)
      .single();

    if (connError || !connector) {
      return new Response(JSON.stringify({ error: 'Invalid API key', code: 'INVALID_KEY' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const rawEntries = body.entries;

    if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
      return new Response(JSON.stringify({ error: 'entries array required', code: 'INVALID_BODY' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const entries = rawEntries.map((e: any) => ({
      ts: new Date(e.ts || e.timestamp || Date.now()),
      ip: e.ip,
      user_agent: e.ua || e.user_agent || '',
      method: e.method || 'GET',
      path: e.url || e.path || '/',
      status_code: parseInt(e.status || '200', 10),
      raw: e,
    }));

    const result = await normalize(entries, connector.tracked_site_id, connector.id, 'wordpress_plugin');

    await supabase
      .from('log_connectors')
      .update({ last_sync_at: new Date().toISOString(), error_count: 0 } as any)
      .eq('id', connector.id);

    return new Response(JSON.stringify({ ok: true, processed: result.inserted, errors: result.errors }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[ingest-wordpress] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error', code: 'INTERNAL_ERROR' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
