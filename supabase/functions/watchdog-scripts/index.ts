import { getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { trackEdgeFunctionError } from '../_shared/tokenTracker.ts';

/**
 * Edge Function: watchdog-scripts
 * 
 * Cron job running every 15 minutes to supervise the fleet of generated scripts.
 * 
 * Rule 1 (Sanity Check): If payload_data > 50KB → deactivate rule + alert
 * Rule 2 (Ghost Telemetry): If active 48h+ with no ping → set status = 'warning'
 * Rule 3 (Garbage Collector): Clean expired domain_data_cache entries (sitemap_tree > 4h)
 */

const MAX_PAYLOAD_SIZE_BYTES = 50 * 1024; // 50 KB
const GHOST_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48 hours
const CACHE_MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getServiceClient();

  const report = {
    rule1_deactivated: 0,
    rule2_warnings: 0,
    rule3_cleaned: 0,
    errors: [] as string[],
  };

  try {
    // ═══ RULE 1: Sanity Check — oversized payloads ═══
    const { data: allRules, error: rulesErr } = await supabase
      .from('site_script_rules')
      .select('id, domain_id, payload_data, is_active, updated_at')
      .eq('is_active', true);

    if (rulesErr) {
      report.errors.push(`Rules fetch error: ${rulesErr.message}`);
    } else if (allRules) {
      for (const rule of allRules) {
        const payloadSize = new TextEncoder().encode(JSON.stringify(rule.payload_data)).length;
        if (payloadSize > MAX_PAYLOAD_SIZE_BYTES) {
          console.warn(`[watchdog] Rule ${rule.id}: payload ${payloadSize}B > 50KB — deactivating`);

          const { error: updateErr } = await supabase
            .from('site_script_rules')
            .update({ is_active: false, status: 'error' })
            .eq('id', rule.id);

          if (!updateErr) {
            report.rule1_deactivated++;
          } else {
            report.errors.push(`Failed to deactivate rule ${rule.id}: ${updateErr.message}`);
          }
        }
      }
    }

    // ═══ RULE 2: Ghost Telemetry — active but no ping ═══
    const ghostThreshold = new Date(Date.now() - GHOST_THRESHOLD_MS).toISOString();
    const { data: ghostRules, error: ghostErr } = await supabase
      .from('site_script_rules')
      .select('id')
      .eq('is_active', true)
      .eq('status', 'active')
      .lt('created_at', ghostThreshold)
      .is('telemetry_last_ping', null);

    if (ghostErr) {
      report.errors.push(`Ghost check error: ${ghostErr.message}`);
    } else if (ghostRules && ghostRules.length > 0) {
      const ids = ghostRules.map(r => r.id);
      const { error: warnErr } = await supabase
        .from('site_script_rules')
        .update({ status: 'warning' })
        .in('id', ids);

      if (!warnErr) {
        report.rule2_warnings = ids.length;
        console.log(`[watchdog] Set ${ids.length} rules to 'warning' (no telemetry ping)`);
      } else {
        report.errors.push(`Warning update error: ${warnErr.message}`);
      }
    }

    // ═══ RULE 3: Garbage Collector — expired cache entries ═══
    const cacheThreshold = new Date(Date.now() - CACHE_MAX_AGE_MS).toISOString();
    const { data: expiredCache, error: cacheErr } = await supabase
      .from('domain_data_cache')
      .delete()
      .eq('data_type', 'sitemap_tree')
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (cacheErr) {
      report.errors.push(`Cache cleanup error: ${cacheErr.message}`);
    } else {
      report.rule3_cleaned = expiredCache?.length || 0;
    }

    console.log(`[watchdog] Complete — deactivated: ${report.rule1_deactivated}, warnings: ${report.rule2_warnings}, cache cleaned: ${report.rule3_cleaned}`);

    return new Response(JSON.stringify({ success: true, report }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[watchdog] Fatal error:', error);
    await trackEdgeFunctionError('watchdog-scripts', String(error)).catch(() => {});
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
