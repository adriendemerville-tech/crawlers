import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { parseJSONLogFormat } from '../_shared/parsers.ts';
import { normalize } from '../_shared/normalizer.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * ingest-vercel — Webhook receiver for Vercel Log Drains.
 * Validates x-vercel-signature (HMAC-SHA1), filters edge/lambda logs.
 */
Deno.serve(handleRequest(async (req) => {
try {
    const signature = req.headers.get('x-vercel-signature');
    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing x-vercel-signature', code: 'MISSING_SIGNATURE' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const bodyText = await req.text();

    // Find connector by checking signature against all vercel connectors
    const supabase = getServiceClient();
    const { data: connectors } = await supabase
      .from('log_connectors')
      .select('*')
      .eq('type', 'vercel')
      .eq('status', 'active');

    let matchedConnector: any = null;

    for (const conn of connectors || []) {
      const config = conn.config as any;
      if (!config?.secret) continue;

      // HMAC-SHA1 verification
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(config.secret),
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
      );
      const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(bodyText));
      const computedSig = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');

      if (computedSig === signature) {
        matchedConnector = conn;
        break;
      }
    }

    if (!matchedConnector) {
      return new Response(JSON.stringify({ error: 'Invalid signature', code: 'INVALID_SIGNATURE' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse body (array of log entries or NDJSON)
    let logEntries: any[] = [];
    try {
      const parsed = JSON.parse(bodyText);
      logEntries = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // Try NDJSON
      logEntries = bodyText.split('\n')
        .filter(l => l.trim())
        .map(l => { try { return JSON.parse(l); } catch { return null; } })
        .filter(Boolean);
    }

    // Filter: only edge and lambda sources
    const filtered = logEntries.filter((e: any) =>
      e.source === 'edge' || e.source === 'lambda' || e.source === 'static'
    );

    const entries = filtered.map((e: any) => ({
      ts: new Date(e.timestamp || e.ts || Date.now()),
      ip: e.clientIp || e.ip,
      user_agent: e.userAgent || e.user_agent || '',
      method: e.method || 'GET',
      path: e.path || e.url || '/',
      status_code: e.statusCode || e.status_code || 0,
      bytes_sent: e.bytes,
      referer: e.referer,
      raw: { ...e, host: e.host },
    }));

    const result = await normalize(entries, matchedConnector.tracked_site_id, matchedConnector.id, 'vercel');

    await supabase
      .from('log_connectors')
      .update({ last_sync_at: new Date().toISOString(), error_count: 0 } as any)
      .eq('id', matchedConnector.id);

    return new Response(JSON.stringify({ ok: true, processed: result.inserted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[ingest-vercel] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error', code: 'INTERNAL_ERROR' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}));