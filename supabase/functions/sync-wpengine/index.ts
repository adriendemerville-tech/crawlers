import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { parseCombinedLogFormat } from '../_shared/parsers.ts';
import { normalize } from '../_shared/normalizer.ts';

/**
 * sync-wpengine — Pulls access logs from WP Engine API (cron: hourly).
 * Iterates all active 'wpengine' connectors.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify service role auth
    const authHeader = req.headers.get('Authorization') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceKey || !authHeader.includes(serviceKey)) {
      return new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getServiceClient();
    const { data: connectors } = await supabase
      .from('log_connectors')
      .select('*')
      .eq('type', 'wpengine')
      .eq('status', 'active');

    if (!connectors?.length) {
      return new Response(JSON.stringify({ ok: true, message: 'No active WP Engine connectors', synced: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: Array<{ connector_id: string; inserted: number; error?: string }> = [];

    for (const connector of connectors) {
      try {
        const config = connector.config as any;
        if (!config?.api_key || !config?.install_name) {
          throw new Error('Missing api_key or install_name in config');
        }

        const basicAuth = btoa(`${config.api_key}:`);
        const url = `https://api.wpengineapi.com/v1/installs/${config.install_name}/logs`;

        const resp = await fetch(url, {
          headers: { 'Authorization': `Basic ${basicAuth}` },
          signal: AbortSignal.timeout(30000),
        });

        if (!resp.ok) {
          throw new Error(`WP Engine API error: ${resp.status} ${resp.statusText}`);
        }

        const data = await resp.text();
        const lines = data.split('\n').filter((l: string) => l.trim());

        // Filter lines after last_cursor if available
        let newLines = lines;
        if (config.last_cursor) {
          const cursorIdx = lines.findIndex((l: string) => l.includes(config.last_cursor));
          if (cursorIdx >= 0) {
            newLines = lines.slice(cursorIdx + 1);
          }
        }

        const entries = newLines
          .map((l: string) => parseCombinedLogFormat(l))
          .filter(Boolean);

        const result = await normalize(
          entries as any[],
          connector.tracked_site_id,
          connector.id,
          'wpengine'
        );

        // Update connector
        const lastLine = newLines[newLines.length - 1] || '';
        await supabase
          .from('log_connectors')
          .update({
            last_sync_at: new Date().toISOString(),
            error_count: 0,
            config: { ...config, last_cursor: lastLine.slice(0, 100) },
          } as any)
          .eq('id', connector.id);

        results.push({ connector_id: connector.id, inserted: result.inserted });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[sync-wpengine] Connector ${connector.id}: ${errorMsg}`);

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
    console.error('[sync-wpengine] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error', code: 'INTERNAL_ERROR' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
