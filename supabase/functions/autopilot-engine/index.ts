import { corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';

/**
 * Autopilot Engine — Moteur d'exécution des cycles
 * 
 * Deux modes d'invocation:
 * 1. POST { tracked_site_id } → exécution manuelle d'un site spécifique
 * 2. POST {} (vide / cron) → scan de toutes les configs actives
 * 
 * Pipeline: 
 *   Check cooldown → Call parmenion-orchestrator → Execute decided functions → Update counters
 */

const COOLDOWN_HOURS = 48;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = getServiceClient();
    let targetSiteId: string | null = null;
    let userId: string | null = null;

    // Check if manual invocation (authenticated) or cron (service role via header)
    const isCron = req.headers.get('Authorization')?.includes(Deno.env.get('SUPABASE_ANON_KEY') || '___');
    
    if (!isCron) {
      const auth = await getAuthenticatedUser(req);
      if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (!auth.isAdmin) return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      
      const body = await req.json().catch(() => ({}));
      targetSiteId = body.tracked_site_id || null;
      userId = auth.userId;
    }

    // ═══ Fetch active autopilot configs ═══
    let query = supabase
      .from('autopilot_configs')
      .select('id, tracked_site_id, user_id, implementation_mode, max_pages_per_cycle, cooldown_hours, auto_pause_threshold, last_cycle_at, total_cycles_run, status')
      .eq('is_active', true);

    if (targetSiteId) {
      query = query.eq('tracked_site_id', targetSiteId);
    }

    const { data: configs, error: configError } = await query;
    if (configError) throw configError;
    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ message: 'No active autopilot configs', processed: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results: Array<{ site_id: string; domain: string; status: string; decision_id?: string; error?: string }> = [];

    for (const config of configs) {
      try {
        // ═══ Get site domain ═══
        const { data: site } = await supabase
          .from('tracked_sites')
          .select('domain')
          .eq('id', config.tracked_site_id)
          .single();

        if (!site) {
          results.push({ site_id: config.tracked_site_id, domain: '?', status: 'skipped', error: 'Site not found' });
          continue;
        }

        // ═══ Check cooldown ═══
        const cooldownMs = (config.cooldown_hours || COOLDOWN_HOURS) * 3600 * 1000;
        if (config.last_cycle_at) {
          const elapsed = Date.now() - new Date(config.last_cycle_at).getTime();
          if (elapsed < cooldownMs) {
            const hoursLeft = Math.round((cooldownMs - elapsed) / 3600000);
            results.push({ site_id: config.tracked_site_id, domain: site.domain, status: 'cooldown', error: `${hoursLeft}h remaining` });
            continue;
          }
        }

        // ═══ Update status to 'running' ═══
        await supabase
          .from('autopilot_configs')
          .update({ status: 'running', updated_at: new Date().toISOString() })
          .eq('id', config.id);

        const cycleNumber = (config.total_cycles_run || 0) + 1;

        // ═══ Call Parménion orchestrator ═══
        console.log(`[AutopilotEngine] Invoking Parménion for ${site.domain}, cycle #${cycleNumber}`);
        
        const orchestratorResponse = await fetch(`${SUPABASE_URL}/functions/v1/parmenion-orchestrator`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tracked_site_id: config.tracked_site_id,
            domain: site.domain,
            cycle_number: cycleNumber,
          }),
        });

        const orchestratorResult = await orchestratorResponse.json();

        if (!orchestratorResponse.ok || !orchestratorResult.decision_id) {
          await supabase.from('autopilot_configs').update({ status: 'error', updated_at: new Date().toISOString() }).eq('id', config.id);
          results.push({ site_id: config.tracked_site_id, domain: site.domain, status: 'error', error: orchestratorResult.error || 'Orchestrator failed' });
          
          // Log in modification registry
          await supabase.from('autopilot_modification_log').insert({
            tracked_site_id: config.tracked_site_id,
            config_id: config.id,
            user_id: config.user_id,
            phase: 'orchestration',
            action_type: 'error',
            cycle_number: cycleNumber,
            description: `Parménion orchestration failed: ${orchestratorResult.error || 'unknown'}`,
            status: 'failed',
          });
          continue;
        }

        const decision = orchestratorResult.decision;

        // ═══ Execute decided functions ═══
        let executionSuccess = true;
        const executionResults: any[] = [];

        if (config.implementation_mode !== 'dry_run' && decision.action?.functions?.length > 0) {
          for (const funcName of decision.action.functions) {
            try {
              console.log(`[AutopilotEngine] Executing ${funcName} for ${site.domain}`);
              const funcResponse = await fetch(`${SUPABASE_URL}/functions/v1/${funcName}`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  tracked_site_id: config.tracked_site_id,
                  domain: site.domain,
                  url: `https://${site.domain}`,
                  ...decision.action.payload,
                }),
              });
              const funcResult = await funcResponse.json().catch(() => ({}));
              executionResults.push({ function: funcName, status: funcResponse.ok ? 'success' : 'error', result: funcResult });
              if (!funcResponse.ok) executionSuccess = false;
            } catch (e) {
              executionResults.push({ function: funcName, status: 'error', error: e instanceof Error ? e.message : 'unknown' });
              executionSuccess = false;
            }
          }
        }

        // ═══ Update decision status ═══
        await supabase
          .from('parmenion_decision_log')
          .update({
            status: config.implementation_mode === 'dry_run' ? 'dry_run' : executionSuccess ? 'completed' : 'partial',
            execution_started_at: new Date().toISOString(),
            execution_completed_at: new Date().toISOString(),
            execution_error: executionSuccess ? null : JSON.stringify(executionResults.filter(r => r.status === 'error')),
          })
          .eq('id', orchestratorResult.decision_id);

        // ═══ Update config counters ═══
        await supabase
          .from('autopilot_configs')
          .update({
            status: executionSuccess ? 'idle' : 'error',
            total_cycles_run: cycleNumber,
            last_cycle_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', config.id);

        // ═══ Log in modification registry ═══
        await supabase.from('autopilot_modification_log').insert({
          tracked_site_id: config.tracked_site_id,
          config_id: config.id,
          user_id: config.user_id,
          phase: decision.action?.type || 'diagnostic',
          action_type: decision.goal?.type || 'auto',
          cycle_number: cycleNumber,
          description: decision.summary || `Cycle #${cycleNumber}: ${decision.goal?.description || 'auto'}`,
          diff_before: decision.tactic?.initial_scope || {},
          diff_after: { execution: executionResults, decision: decision.prudence },
          status: config.implementation_mode === 'dry_run' ? 'dry_run' : executionSuccess ? 'applied' : 'failed',
        });

        results.push({
          site_id: config.tracked_site_id,
          domain: site.domain,
          status: config.implementation_mode === 'dry_run' ? 'dry_run' : executionSuccess ? 'completed' : 'partial',
          decision_id: orchestratorResult.decision_id,
        });

      } catch (siteError) {
        console.error(`[AutopilotEngine] Error processing site ${config.tracked_site_id}:`, siteError);
        results.push({ site_id: config.tracked_site_id, domain: '?', status: 'error', error: siteError instanceof Error ? siteError.message : 'unknown' });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('[AutopilotEngine] Fatal error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
