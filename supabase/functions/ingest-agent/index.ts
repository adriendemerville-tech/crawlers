import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { autoDetectAndParse } from '../_shared/parsers.ts';
import { normalize } from '../_shared/normalizer.ts';

/**
 * ingest-agent — Receives log data from the crawlers.fr bash agent.
 * Auth: Bearer <api_key> → looks up connector by hashed key.
 * Accepts { lines: string[] } (raw) or { entries: object[] } (pre-parsed).
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth via Bearer token
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header', code: 'MISSING_AUTH' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = authHeader.replace('Bearer ', '');
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(apiKey));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const supabase = getServiceClient();
    const { data: connector, error: connError } = await supabase
      .from('log_connectors')
      .select('id, tracked_site_id, status')
      .eq('api_key_hash', keyHash)
      .single();

    if (connError || !connector) {
      return new Response(JSON.stringify({ error: 'Invalid API key', code: 'INVALID_KEY' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    let entries: any[] = [];

    if (body.lines && Array.isArray(body.lines)) {
      // Raw log lines → auto-detect and parse
      const content = body.lines.join('\n');
      const { entries: parsed } = autoDetectAndParse(content);
      entries = parsed;
    } else if (body.entries && Array.isArray(body.entries)) {
      // Pre-parsed entries
      entries = body.entries.map((e: any) => ({
        ts: new Date(e.ts || e.timestamp || Date.now()),
        ip: e.ip || e.remote_addr,
        user_agent: e.user_agent || e.ua || e.userAgent,
        method: e.method || 'GET',
        path: e.path || e.url || e.uri || '/',
        status_code: parseInt(e.status_code || e.status || '0', 10),
        bytes_sent: e.bytes_sent || e.bytes,
        referer: e.referer || e.referrer,
        raw: e,
      }));
    } else {
      return new Response(JSON.stringify({ error: 'Body must contain "lines" or "entries" array', code: 'INVALID_BODY' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await normalize(entries, connector.tracked_site_id, connector.id, 'agent');

    // Update connector status
    await supabase
      .from('log_connectors')
      .update({ last_sync_at: new Date().toISOString(), status: 'active', error_count: 0 })
      .eq('id', connector.id);

    return new Response(JSON.stringify({ ok: true, processed: result.inserted, errors: result.errors }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[ingest-agent] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error', code: 'INTERNAL_ERROR' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
