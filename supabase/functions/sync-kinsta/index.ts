import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { parseCombinedLogFormat } from '../_shared/parsers.ts';
import { normalize } from '../_shared/normalizer.ts';

/**
 * sync-kinsta — Pulls access logs from Kinsta API (cron: hourly at :05).
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const token = authHeader.replace('Bearer ', '');
    if (!token || (token !== serviceKey && token !== anonKey)) {
      return new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getServiceClient();
    const { data: connectors } = await supabase
      .from('log_connectors')
      .select('*')
      .eq('type', 'kinsta')
      .eq('status', 'active');

    if (!connectors?.length) {
      return new Response(JSON.stringify({ ok: true, message: 'No active Kinsta connectors', synced: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: Array<{ connector_id: string; inserted: number; error?: string }> = [];

    for (const connector of connectors) {
      try {
        const config = connector.config as any;
        if (!config?.api_key || !config?.site_id || !config?.environment_id) {
          throw new Error('Missing api_key, site_id, or environment_id in config');
        }

        const url = `https://api.kinsta.com/v2/sites/${config.site_id}/environments/${config.environment_id}/logs`;

        const resp = await fetch(url, {
          headers: { 'Authorization': `Bearer ${config.api_key}` },
          signal: AbortSignal.timeout(30000),
        });

        if (!resp.ok) {
          throw new Error(`Kinsta API error: ${resp.status} ${resp.statusText}`);
        }

        const data = await resp.json();
        const logLines = data.environment?.container_info?.access_log || [];

        // Parse as combined log format
        const entries = (Array.isArray(logLines) ? logLines : [])
          .map((l: string) => parseCombinedLogFormat(l))
          .filter(Boolean);

        const result = await normalize(
          entries as any[],
          connector.tracked_site_id,
          connector.id,
          'kinsta'
        );

        await supabase
          .from('log_connectors')
          .update({ last_sync_at: new Date().toISOString(), error_count: 0 } as any)
          .eq('id', connector.id);

        results.push({ connector_id: connector.id, inserted: result.inserted });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[sync-kinsta] Connector ${connector.id}: ${errorMsg}`);

        const newErrorCount = (connector.error_count || 0) + 1;
        await supabase
          .from('log_connectors')
          .update({
            error_count: newErrorCount,
            status: newErrorCount >= 3 ? 'error' : 'active',
          } as any)
          .eq('id', connector.id);

        await supabase.from('log_connector_errors').insert({
          connector_id: connector.id,
          error: errorMsg,
        } as any);

        results.push({ connector_id: connector.id, inserted: 0, error: errorMsg });
      }
    }

    return new Response(JSON.stringify({ ok: true, synced: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[sync-kinsta] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error', code: 'INTERNAL_ERROR' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
