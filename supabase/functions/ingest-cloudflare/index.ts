import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { parseJSONLogFormat } from '../_shared/parsers.ts';
import { normalize } from '../_shared/normalizer.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * ingest-cloudflare — Webhook receiver for Cloudflare Logpush.
 * Validates CF-Logpush-Secret, parses NDJSON body, normalizes and stores.
 */
Deno.serve(handleRequest(async (req) => {
try {
    const cfSecret = req.headers.get('CF-Logpush-Secret') || req.headers.get('cf-logpush-secret');
    if (!cfSecret) {
      return new Response(JSON.stringify({ error: 'Missing CF-Logpush-Secret header', code: 'MISSING_SECRET' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Hash the incoming secret to match against stored hash
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(cfSecret));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const secretHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Find connector by secret hash
    const supabase = getServiceClient();
    const { data: connector, error: connError } = await supabase
      .from('log_connectors')
      .select('id, tracked_site_id, status')
      .eq('type', 'cloudflare')
      .eq('api_key_hash', secretHash)
      .single();

    if (connError || !connector) {
      return new Response(JSON.stringify({ error: 'Invalid secret', code: 'INVALID_SECRET' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse NDJSON body
    const body = await req.text();
    const lines = body.split('\n').filter(l => l.trim());

    const entries = lines.map(line => {
      const parsed = parseJSONLogFormat(line);
      if (!parsed) return null;

      // Map Cloudflare-specific fields
      try {
        const obj = JSON.parse(line);
        return {
          ...parsed,
          ip: parsed.ip || obj.ClientIP,
          user_agent: parsed.user_agent || obj.ClientRequestUserAgent,
          path: parsed.path || obj.ClientRequestURI,
          method: parsed.method || obj.ClientRequestMethod,
          status_code: parsed.status_code || obj.EdgeResponseStatus,
          bytes_sent: parsed.bytes_sent || obj.EdgeResponseBytes,
          referer: parsed.referer || obj.ClientRequestReferer,
          ts: parsed.ts || (obj.EdgeStartTimestamp ? new Date(obj.EdgeStartTimestamp * 1000) : new Date()),
        };
      } catch {
        return parsed;
      }
    }).filter(Boolean);

    const result = await normalize(
      entries as any[],
      connector.tracked_site_id,
      connector.id,
      'cloudflare'
    );

    // Update last_sync_at
    await supabase
      .from('log_connectors')
      .update({ last_sync_at: new Date().toISOString(), status: 'active', error_count: 0 })
      .eq('id', connector.id);

    return new Response(JSON.stringify({ ok: true, processed: result.inserted, errors: result.errors }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[ingest-cloudflare] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error', code: 'INTERNAL_ERROR' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}));