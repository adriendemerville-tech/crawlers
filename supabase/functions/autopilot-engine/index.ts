import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { isIktrackerDomain, isDictadeviDomain, normalizePageKey } from '../_shared/domainUtils.ts';

/** Resolve the right CMS bridge function for a given domain (IKtracker / Dictadevi). */
function resolveCmsBridge(domain: string): string {
  if (isDictadeviDomain(domain)) return 'dictadevi-actions';
  return 'iktracker-actions'; // default (covers IKtracker + back-compat)
}

/**
 * Call the appropriate CMS bridge for a domain. Adapts the payload shape:
 *   - iktracker-actions expects { action, page_key, slug, updates, body } at root
 *   - dictadevi-actions expects { action, params: { ... } }
 * Returns the raw fetch Response so callers can inspect status/headers.
 */
function callCmsBridge(
  domain: string,
  supabaseUrl: string,
  serviceRoleKey: string,
  actionBody: Record<string, unknown>,
): Promise<Response> {
  const bridge = resolveCmsBridge(domain);
  const { action, ...rest } = actionBody;
  const finalBody = bridge === 'dictadevi-actions'
    ? { action, params: rest }
    : actionBody;
  return fetch(`${supabaseUrl}/functions/v1/${bridge}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(finalBody),
  });
}

// ═══ Modular imports ═══
import {
  COOLDOWN_HOURS, CYCLE_DEADLINE_MS, MAX_CMS_ACTIONS_PER_CYCLE,
  computeCycleStatus,
  type ExecutionError, type CycleStatus, type AutopilotConfig, type SiteInfo, type RoutedActions,
} from '../_shared/autopilot/types.ts';
import { routeCmsActions } from '../_shared/autopilot/cmsActionRouter.ts';
import { trackAnalyticsEvent, pushIktrackerEvent } from '../_shared/autopilot/iktrackerBridge.ts';
import { runPostAudit, runPostDiagnose } from '../_shared/autopilot/postDiagnose.ts';
import { checkSemanticGate } from '../_shared/autopilot/semanticGate.ts';
import { markDeployedItems } from '../_shared/autopilot/postExecute.ts';

/**
 * Autopilot Engine — Moteur d'exécution autonome des cycles
 * 
 * Pipeline: Check cooldown → Call parmenion-orchestrator → Execute decided functions → Store results → Update counters
 * 
 * Modularized v2: Phase logic, CMS routing, semantic gate, and post-execute
 * are extracted to _shared/autopilot/ for testability and maintainability.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const PIPELINE_PHASES = ['audit', 'diagnose', 'prescribe', 'execute', 'validate'] as const;

Deno.serve(handleRequest(async (req) => {
try {
    const supabase = getServiceClient();
    let targetSiteId: string | null = null;

    const authHeader = req.headers.get('Authorization') || '';
    const isServiceRole = authHeader.includes(SERVICE_ROLE_KEY);
    
    const body = await req.json().catch(() => ({}));
    targetSiteId = body.tracked_site_id || null;

    if (!isServiceRole) {
      const auth = await getAuthenticatedUser(req);
      if (!auth) {
        // Allow anon key calls (from cron via pg_net)
      } else if (!auth.isAdmin) {
        return jsonError('Admin only', 403);
      }
    }

    // ═══ Fetch active autopilot configs ═══
    let query = supabase
      .from('autopilot_configs')
      .select('id, tracked_site_id, user_id, implementation_mode, max_pages_per_cycle, cooldown_hours, auto_pause_threshold, last_cycle_at, total_cycles_run, status, force_content_cycle, content_budget_pct, force_iktracker_article')
      .eq('is_active', true);

    if (targetSiteId) {
      query = query.eq('tracked_site_id', targetSiteId);
    }

    const { data: configs, error: configError } = await query;
    if (configError) throw configError;
    if (!configs || configs.length === 0) {
      return jsonOk({ message: 'No active autopilot configs', processed: 0 });
    }

    const results: Array<{ site_id: string; domain: string; status: string; decision_id?: string; pipeline_phase?: string; error?: string }> = [];

    for (const config of configs as AutopilotConfig[]) {
      try {
        // ═══ Get site domain ═══
        const { data: site } = await supabase
          .from('tracked_sites')
          .select('domain, site_name, market_sector, products_services, target_audience, entity_type, commercial_model')
          .eq('id', config.tracked_site_id)
          .single();

        if (!site) {
          results.push({ site_id: config.tracked_site_id, domain: '?', status: 'skipped', error: 'Site not found' });
          continue;
        }

        const siteInfo = site as SiteInfo;

        // ═══ Check cooldown (only after successful macro-cycles) ═══
        const cooldownMs = (config.cooldown_hours || COOLDOWN_HOURS) * 3600 * 1000;
        if (config.last_cycle_at && config.status !== 'error') {
          const elapsed = Date.now() - new Date(config.last_cycle_at).getTime();
          if (elapsed < cooldownMs) {
            const hoursLeft = Math.round((cooldownMs - elapsed) / 3600000);
            results.push({ site_id: config.tracked_site_id, domain: siteInfo.domain, status: 'cooldown', error: `${hoursLeft}h remaining` });
            continue;
          }
        }

        // ═══ Update status to 'running' ═══
        await supabase
          .from('autopilot_configs')
          .update({ status: 'running', updated_at: new Date().toISOString() })
          .eq('id', config.id);

        const cycleNumber = (config.total_cycles_run || 0) + 1;
        const cycleStartTime = Date.now();

        // ═══ FULL PIPELINE ═══
        let cycleSuccess = true;
        let hasCriticalError = false;
        const allPhaseErrors: ExecutionError[] = [];
        let lastDecisionId: string | null = null;
        let lastPipelinePhase = 'audit';
        let lastDecision: any = null;
        let routedCmsActions: RoutedActions | null = null;
        const allPhaseResults: Array<{ phase: string; decision_id: string; status: string; executionResults: any[] }> = [];

        for (const phase of PIPELINE_PHASES) {
          // Watchdog
          const elapsed = Date.now() - cycleStartTime;
          if (elapsed > CYCLE_DEADLINE_MS) {
            console.warn(`[AutopilotEngine] ⏰ Watchdog: cycle exceeded ${CYCLE_DEADLINE_MS / 1000}s (${Math.round(elapsed / 1000)}s elapsed), aborting at phase ${phase} for ${siteInfo.domain}`);
            allPhaseErrors.push({ phase, function: 'watchdog', severity: 'critical', message: `Cycle timeout after ${Math.round(elapsed / 1000)}s`, retryable: true });
            hasCriticalError = true;
            cycleSuccess = false;
            break;
          }

          console.log(`[AutopilotEngine] ═══ Phase ${phase.toUpperCase()} for ${siteInfo.domain}, cycle #${cycleNumber} ═══`);

          // ═══ Call Parménion orchestrator ═══
          const orchestratorResponse = await fetch(`${SUPABASE_URL}/functions/v1/parmenion-orchestrator`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tracked_site_id: config.tracked_site_id,
              domain: siteInfo.domain,
              cycle_number: cycleNumber,
              user_id: config.user_id,
              forced_phase: phase,
              force_content_cycle: config.force_content_cycle ?? true,
              content_budget_pct: config.content_budget_pct ?? 30,
              force_iktracker_article: config.force_iktracker_article ?? false,
            }),
          });

          const orchestratorResult = await orchestratorResponse.json();

          // Handle "skipped" gracefully
          if (orchestratorResponse.ok && orchestratorResult.status === 'skipped') {
            console.log(`[AutopilotEngine] Phase ${phase} skipped for ${siteInfo.domain}: ${orchestratorResult.reason || 'no items'}`);
            await supabase.from('autopilot_modification_log').insert({
              tracked_site_id: config.tracked_site_id, config_id: config.id, user_id: config.user_id,
              phase, action_type: 'skip', cycle_number: cycleNumber,
              description: `Phase ${phase} skipped: ${orchestratorResult.reason || 'nothing to do'}`,
              status: 'skipped',
            });
            allPhaseResults.push({ phase, decision_id: 'skipped', status: 'skipped', executionResults: [] });
            continue;
          }

          if (!orchestratorResponse.ok || !orchestratorResult.decision_id) {
            console.error(`[AutopilotEngine] Orchestrator failed at phase ${phase}:`, orchestratorResult.error);
            await supabase.from('autopilot_modification_log').insert({
              tracked_site_id: config.tracked_site_id, config_id: config.id, user_id: config.user_id,
              phase, action_type: 'error', cycle_number: cycleNumber,
              description: `Pipeline stopped at ${phase}: ${orchestratorResult.error || 'orchestrator failed'}`,
              status: 'failed',
            });
            hasCriticalError = true;
            cycleSuccess = false;
            break;
          }

          const decision = orchestratorResult.decision;
          const pipelinePhase = orchestratorResult.pipeline_phase || phase;
          lastDecisionId = orchestratorResult.decision_id;
          lastPipelinePhase = pipelinePhase;
          lastDecision = decision;

          let executionSuccess = true;
          const phaseErrors: ExecutionError[] = [];
          const executionResults: any[] = [];

          // ═══ POST-AUDIT ═══
          if (phase === 'audit' && executionSuccess) {
            await runPostAudit(supabase, config, siteInfo);
          }

          // ═══ POST-DIAGNOSE ═══
          if (phase === 'diagnose' && executionSuccess) {
            await runPostDiagnose(supabase, config, siteInfo);
          }

          // ═══ INLINE ROUTING after prescribe ═══
          if (phase === 'prescribe') {
            routedCmsActions = handlePrescribeRouting(decision, siteInfo, supabase, config, cycleNumber, lastDecisionId, allPhaseResults);
            
            await supabase.from('autopilot_modification_log').insert({
              tracked_site_id: config.tracked_site_id, config_id: config.id, user_id: config.user_id,
              phase: 'route', action_type: 'routing', cycle_number: cycleNumber,
              description: `[ROUTE${decision.action?.payload?._prescribe_v2 ? ' V2' : ''}] ${routedCmsActions?.content.length || 0} content + ${routedCmsActions?.code.length || 0} data + ${decision.action?.payload?.fixes?.length || 0} code fixes`,
              diff_before: { prescribe_v2: !!decision.action?.payload?._prescribe_v2, original_cms: decision.action?.payload?.cms_actions?.length || 0, original_fixes: decision.action?.payload?.fixes?.length || 0 },
              diff_after: { content: routedCmsActions?.content.length || 0, code: routedCmsActions?.code.length || 0, fixes: decision.action?.payload?.fixes?.length || 0 },
              status: 'applied',
            });
          }

          // ═══ EXECUTE PHASE: Prepare CMS actions ═══
          if (phase === 'execute') {
            prepareExecuteActions(decision, siteInfo, routedCmsActions, supabase, config);
          }

          // ═══ Function execution ═══
          // dry_run bloque UNIQUEMENT la phase 'execute' (push CMS).
          // Les phases audit/diagnose/prescribe/validate doivent toujours s'exécuter
          // pour alimenter audit_raw_data + architect_workbench, sinon dry_run = simulation à vide.
          const isPrescribeV2 = phase === 'prescribe' && decision.action?.payload?._prescribe_v2 === true;
          const isDryRunBlocked = config.implementation_mode === 'dry_run' && phase === 'execute';
          
          if (!isPrescribeV2 && !isDryRunBlocked && decision.action?.functions?.length > 0) {
            await executeFunctions(
              decision, siteInfo, config, phase, pipelinePhase, cycleNumber,
              supabase, executionResults, phaseErrors,
              (success: boolean) => { executionSuccess = success; },
            );
          }

          // ═══ Collect phase errors ═══
          allPhaseErrors.push(...phaseErrors);

          // ═══ POST-EXECUTE ═══
          if (phase === 'execute') {
            await markDeployedItems(supabase, siteInfo.domain, executionResults);
          }

          // ═══ Store execution results ═══
          // Statut 'dry_run' réservé à la phase execute en mode dry_run (seule phase réellement bloquée).
          // Les autres phases (audit/diagnose/prescribe/validate) reflètent leur exécution réelle.
          const phaseStatus = isDryRunBlocked ? 'dry_run' 
            : phaseErrors.some(e => e.severity === 'critical') ? 'failed'
            : phaseErrors.some(e => e.severity === 'degraded') ? 'degraded'
            : executionSuccess ? 'completed' : 'partial';
          
          await supabase.from('parmenion_decision_log').update({
            status: phaseStatus,
            execution_started_at: new Date().toISOString(),
            execution_completed_at: new Date().toISOString(),
            execution_results: {
              actions: executionResults,
              errors: phaseErrors,
              degraded: phaseErrors.some(e => e.severity === 'degraded'),
              has_ignorable: phaseErrors.some(e => e.severity === 'ignorable'),
            },
            execution_error: phaseErrors.length > 0 ? JSON.stringify(phaseErrors) : null,
          }).eq('id', lastDecisionId);

          allPhaseResults.push({ phase, decision_id: lastDecisionId!, status: phaseStatus, executionResults });

          await supabase.from('autopilot_modification_log').insert({
            tracked_site_id: config.tracked_site_id, config_id: config.id, user_id: config.user_id,
            phase: pipelinePhase, action_type: decision.goal?.type || 'auto',
            page_url: decision.tactic?.target_url || null, cycle_number: cycleNumber,
            description: `[${pipelinePhase.toUpperCase()}] ${decision.summary || decision.goal?.description || `Cycle #${cycleNumber}`}`,
            diff_before: decision.tactic?.initial_scope || {},
            diff_after: { execution: executionResults, decision: decision.prudence, errors: phaseErrors },
            status: config.implementation_mode === 'dry_run' ? 'dry_run' : phaseStatus,
          });

          if (phaseErrors.some(e => e.severity === 'critical')) {
            console.error(`[AutopilotEngine] Phase ${phase} had CRITICAL errors, stopping pipeline for ${siteInfo.domain}`);
            hasCriticalError = true;
            cycleSuccess = false;
            break;
          } else if (phaseErrors.length > 0) {
            console.warn(`[AutopilotEngine] Phase ${phase} had ${phaseErrors.length} non-critical errors, continuing pipeline for ${siteInfo.domain}`);
          }

          console.log(`[AutopilotEngine] Phase ${phase} completed for ${siteInfo.domain} (status: ${phaseStatus})`);
        } // end phase loop

        // ═══ Update config counters ═══
        const finalCycleStatus: CycleStatus = hasCriticalError ? 'failed' : computeCycleStatus(allPhaseErrors);

        await supabase.from('autopilot_configs').update({
          status: finalCycleStatus === 'failed' ? 'error' : 'idle',
          total_cycles_run: cycleNumber,
          ...(finalCycleStatus !== 'failed' ? { last_cycle_at: new Date().toISOString() } : {}),
          updated_at: new Date().toISOString(),
          force_iktracker_article: finalCycleStatus !== 'failed' ? false : config.force_iktracker_article,
        }).eq('id', config.id);

        // ═══ Observability ═══
        console.log(JSON.stringify({
          event: 'cycle_complete', domain: siteInfo.domain, cycle: cycleNumber,
          status: finalCycleStatus, phases_completed: allPhaseResults.length,
          phases: allPhaseResults.map(r => ({ phase: r.phase, status: r.status, errors: r.executionResults.filter((e: any) => e.status === 'error').length })),
          total_errors: allPhaseErrors.length,
          error_breakdown: {
            critical: allPhaseErrors.filter(e => e.severity === 'critical').length,
            degraded: allPhaseErrors.filter(e => e.severity === 'degraded').length,
            ignorable: allPhaseErrors.filter(e => e.severity === 'ignorable').length,
          },
          duration_ms: Date.now() - cycleStartTime,
          articles_created: allPhaseResults.flatMap(r => r.executionResults).filter((e: any) => e.cms_action === 'create-post' && e.status === 'success').length,
        }));

        // ═══ Push final event to IKtracker ═══
        await pushIktrackerEvent(supabase, {
          trackedSiteId: config.tracked_site_id, userId: config.user_id, domain: siteInfo.domain,
          cycleNumber, pipelinePhase: lastPipelinePhase, finalStatus: finalCycleStatus,
          executionSuccess: finalCycleStatus !== 'failed',
          message: `[Cycle #${cycleNumber} ${finalCycleStatus.toUpperCase()}] ${allPhaseResults.length} phases — ${lastDecision?.summary || lastPipelinePhase}`,
          targetUrl: lastDecision?.tactic?.target_url || null,
          functions: lastDecision?.action?.functions || [],
          details: {
            phases_completed: allPhaseResults.map(r => r.phase),
            decision_ids: allPhaseResults.map(r => r.decision_id),
            errors: allPhaseErrors.length,
          },
        });

        results.push({
          site_id: config.tracked_site_id, domain: siteInfo.domain, status: finalCycleStatus,
          decision_id: lastDecisionId || undefined,
          pipeline_phase: `full_cycle (${allPhaseResults.length} phases)`,
        });

      } catch (siteError) {
        console.error(`[AutopilotEngine] Error processing site ${config.tracked_site_id}:`, siteError);
        results.push({ site_id: config.tracked_site_id, domain: '?', status: 'error', error: siteError instanceof Error ? siteError.message : 'unknown' });
      }
    }

    return jsonOk({ processed: results.length, results });

  } catch (e) {
    console.error('[AutopilotEngine] Fatal error:', e);
    return jsonError(e instanceof Error ? e.message : 'Unknown error', 500);
  }
}));

// ═══════════════════════════════════════════════════════════════
// Helper functions (kept in index.ts — these manipulate `decision` object in-place)
// ═══════════════════════════════════════════════════════════════

function handlePrescribeRouting(
  decision: any, site: SiteInfo, supabase: any, config: AutopilotConfig,
  cycleNumber: number, lastDecisionId: string | null,
  allPhaseResults: Array<{ phase: string; decision_id: string; status: string; executionResults: any[] }>,
): RoutedActions | null {
  const payload = decision.action?.payload || {};
  
  if (payload._prescribe_v2) {
    const allCmsActions = payload.cms_actions || [];
    const allFixes = payload.fixes || [];
    const hasV2Output = allCmsActions.length > 0 || allFixes.length > 0;
    
    if (hasV2Output) {
      const routed: RoutedActions = {
        content: allCmsActions.filter((a: any) => a._channel === 'content_corrective' || a._channel === 'content_editorial'),
        code: allCmsActions.filter((a: any) => a._channel === 'data'),
        all: allCmsActions,
      };
      console.log(`[AutopilotEngine] Prescribe V2: ${allFixes?.length || 0} code fixes + ${routed.content.length} content + ${routed.code.length} data CMS actions`);
      
      allPhaseResults.push({ phase: 'route', decision_id: lastDecisionId || 'inline', status: 'completed', executionResults: [{
        function: 'prescribe-v2-router', status: 'success',
        code_fixes: allFixes?.length || 0, content_actions: routed.content.length,
        data_actions: routed.code.length, total_cms: allCmsActions.length,
      }] });
      return routed;
    } else {
      console.warn(`[AutopilotEngine] Prescribe V2 EMPTY for ${site.domain}: downgrading to V1`);
      payload._prescribe_v2 = false;
      decision.action.payload._prescribe_v2 = false;
    }
  }
  
  if (payload.cms_actions) {
    const routed = routeCmsActions(payload.cms_actions, site.domain);
    console.log(`[AutopilotEngine] Routed ${routed.content.length} content + ${routed.code.length} code actions for ${site.domain}`);
    
    allPhaseResults.push({ phase: 'route', decision_id: lastDecisionId || 'inline', status: 'completed', executionResults: [{
      function: 'cms-router', status: 'success',
      content_actions: routed.content.length, code_actions: routed.code.length, total: routed.all.length,
    }] });
    return routed;
  }
  
  return null;
}

async function prepareExecuteActions(
  decision: any, site: SiteInfo, routedCmsActions: RoutedActions | null,
  supabase: any, config: AutopilotConfig,
) {
  if (isIktrackerDomain(site.domain) || isDictadeviDomain(site.domain)) {
    if (!decision.action.payload) decision.action.payload = {};
    const hasCmsActions = Array.isArray(decision.action.payload.cms_actions) && decision.action.payload.cms_actions.length > 0;
    
    if (routedCmsActions && routedCmsActions.all.length > 0 && !hasCmsActions) {
      decision.action.payload.cms_actions = routedCmsActions.all;
      decision.action.payload._routed = routedCmsActions;
      console.log(`[AutopilotEngine] Injected ${routedCmsActions.all.length} routed CMS actions into execute phase for ${site.domain}`);
    } else if (!hasCmsActions) {
      // Fallback: build META-ONLY CMS actions from recommendations
      console.log(`[AutopilotEngine] No CMS actions available for ${site.domain}, building fallback META-ONLY from recommendations`);
      try {
        const { data: recos } = await supabase
          .from('audit_recommendations_registry')
          .select('id, title, description, category, priority, fix_type, fix_data, prompt_summary, url')
          .eq('domain', site.domain)
          .eq('is_resolved', false)
          .order('priority', { ascending: true })
          .limit(5);

        if (recos && recos.length > 0) {
          const fallbackCmsActions: Array<Record<string, unknown>> = [];
          for (const reco of recos) {
            const cat = (reco.category || '').toLowerCase();
            const isMeta = ['seo', 'meta_tags', 'technique', 'technical'].includes(cat) || reco.fix_type === 'meta';
            if (isMeta) {
              const pageKey = normalizePageKey(reco.url) || 'homepage';
              fallbackCmsActions.push({
                action: 'update-page', page_key: pageKey,
                updates: {
                  meta_description: reco.fix_data?.meta_description || (reco.description || reco.title || '').slice(0, 155),
                  ...(reco.fix_data?.meta_title ? { meta_title: reco.fix_data.meta_title } : {}),
                },
              });
            }
          }
          if (fallbackCmsActions.length > 0) {
            decision.action.payload.cms_actions = fallbackCmsActions;
            console.log(`[AutopilotEngine] Fallback: built ${fallbackCmsActions.length} META-ONLY CMS actions from recommendations for ${site.domain}`);
          }
        }
      } catch (fallbackErr) {
        console.error('[AutopilotEngine] CMS fallback failed:', fallbackErr);
      }
    }

    const finalHasCms = Array.isArray(decision.action.payload.cms_actions) && decision.action.payload.cms_actions.length > 0;
    if (finalHasCms && !decision.action.functions.includes('iktracker-actions')) {
      decision.action.functions.push('iktracker-actions');
    }
  } else if (routedCmsActions && routedCmsActions.all.length > 0) {
    // Non-IKtracker sites
    if (!decision.action.payload) decision.action.payload = {};
    if (!decision.action.payload.cms_actions || decision.action.payload.cms_actions.length === 0) {
      decision.action.payload.cms_actions = routedCmsActions.all;
      decision.action.payload._routed = routedCmsActions;
    }
    const createActions = routedCmsActions.all.filter((a: any) => a.action === 'create-post' || a.action === 'create-page');
    const patchActions = routedCmsActions.all.filter((a: any) => a.action === 'update-page' || a.action === 'patch-content' || a.action === 'update-h1' || a.action === 'update-faq' || a.action === 'update-meta');
    const redirectActions = routedCmsActions.all.filter((a: any) => a.action === 'create-redirect' || a.action === 'delete-redirect');
    
    decision.action.functions = decision.action.functions.filter((f: string) => f !== 'iktracker-actions');
    if (createActions.length > 0 && !decision.action.functions.includes('cms-push-draft')) decision.action.functions.push('cms-push-draft');
    if (patchActions.length > 0 && !decision.action.functions.includes('cms-patch-content')) {
      decision.action.functions.push('cms-patch-content');
      decision.action.payload.patch_actions = patchActions;
    }
    if (redirectActions.length > 0 && !decision.action.functions.includes('cms-push-redirect')) {
      decision.action.functions.push('cms-push-redirect');
      decision.action.payload.redirect_actions = redirectActions;
    }
  }
}

async function executeFunctions(
  decision: any, site: SiteInfo, config: AutopilotConfig,
  phase: string, pipelinePhase: string, cycleNumber: number,
  supabase: any, executionResults: any[], phaseErrors: ExecutionError[],
  setExecutionSuccess: (v: boolean) => void,
) {
  let executionSuccess = true;

  for (const funcName of decision.action.functions) {
    try {
      if (funcName === 'cms-push-code') {
        console.log(`[AutopilotEngine] Skipping standalone cms-push-code for ${site.domain}`);
        continue;
      }

      if (funcName === 'iktracker-actions' && Array.isArray(decision.action.payload?.cms_actions)) {
        await executeIktrackerActions(decision, site, config, phase, cycleNumber, supabase, executionResults, phaseErrors, (v) => { executionSuccess = v; setExecutionSuccess(v); });
      } else if (funcName === 'iktracker-actions') {
        await executeIktrackerReroute(decision, site, config, phase, supabase, executionResults, phaseErrors, (v) => { executionSuccess = v; setExecutionSuccess(v); });
      } else if (funcName === 'content-architecture-advisor') {
        await executeContentArchitect(decision, site, config, phase, supabase, executionResults, phaseErrors, (v) => { executionSuccess = v; setExecutionSuccess(v); });
      } else if (funcName === 'cms-push-draft' && Array.isArray(decision.action.payload?.cms_actions)) {
        await executeCmsPushDraft(decision, site, config, phase, supabase, executionResults, phaseErrors, (v) => { executionSuccess = v; setExecutionSuccess(v); });
        continue;
      } else if (funcName === 'cms-patch-content' && Array.isArray(decision.action.payload?.patch_actions)) {
        await executeCmsPatch(decision, site, config, phase, supabase, executionResults, phaseErrors, (v) => { executionSuccess = v; setExecutionSuccess(v); });
        continue;
      } else if (funcName === 'cms-push-redirect' && Array.isArray(decision.action.payload?.redirect_actions)) {
        await executeCmsRedirect(decision, site, config, phase, supabase, executionResults, phaseErrors, (v) => { executionSuccess = v; setExecutionSuccess(v); });
        continue;
      } else {
        await executeGenericFunction(funcName, decision, site, config, phase, pipelinePhase, cycleNumber, supabase, executionResults, phaseErrors, (v) => { executionSuccess = v; setExecutionSuccess(v); });
      }
    } catch (e) {
      executionResults.push({ function: funcName, status: 'error', error: e instanceof Error ? e.message : 'unknown' });
      phaseErrors.push({ phase, function: funcName, severity: 'degraded', message: e instanceof Error ? e.message : 'unknown', retryable: false });
      executionSuccess = false;
      setExecutionSuccess(false);
    }
  }
}

// ═══ Individual function executors ═══

async function executeIktrackerActions(
  decision: any, site: SiteInfo, config: AutopilotConfig,
  phase: string, cycleNumber: number,
  supabase: any, executionResults: any[], phaseErrors: ExecutionError[],
  setSuccess: (v: boolean) => void,
) {
  if (decision.action.payload.cms_actions.length > MAX_CMS_ACTIONS_PER_CYCLE) {
    console.warn(`[AutopilotEngine] Truncating ${decision.action.payload.cms_actions.length} CMS actions to ${MAX_CMS_ACTIONS_PER_CYCLE} for ${site.domain}`);
    decision.action.payload.cms_actions = decision.action.payload.cms_actions.slice(0, MAX_CMS_ACTIONS_PER_CYCLE);
  }
  console.log(`[AutopilotEngine] Executing ${decision.action.payload.cms_actions.length} CMS actions on IKtracker for ${site.domain}`);
  
  for (const cmsAction of decision.action.payload.cms_actions) {
    try {
      let inferredAction = cmsAction.action
        || (cmsAction.body ? 'create-post' : null)
        || (cmsAction.updates && cmsAction.slug ? 'update-post' : null)
        || (cmsAction.updates && cmsAction.page_key ? 'update-page' : null)
        || 'list-posts';

      if (!cmsAction.action) {
        console.warn(`[AutopilotEngine] CMS action missing 'action' field, inferred: ${inferredAction}`);
      }

      if (inferredAction === 'create-post' && cmsAction.body?.slug) {
        console.log(`[AutopilotEngine] create-post for slug "${cmsAction.body.slug}" — iktracker will auto-upsert if exists`);
      }

      const actionBody = {
        action: inferredAction,
        ...(cmsAction.page_key ? { page_key: cmsAction.page_key } : {}),
        ...(cmsAction.slug ? { slug: cmsAction.slug } : {}),
        ...(cmsAction.updates ? { updates: cmsAction.updates } : {}),
        ...(cmsAction.body ? { body: cmsAction.body } : {}),
      };

      const bridge = resolveCmsBridge(site.domain);
      console.log(`[AutopilotEngine] ${bridge} CMS action: ${cmsAction.action}`, JSON.stringify(actionBody).slice(0, 500));

      const funcResponse = await callCmsBridge(site.domain, SUPABASE_URL, SERVICE_ROLE_KEY, actionBody);

      const funcResult = await funcResponse.json().catch(() => ({}));
      
      // Semantic gate check
      if (funcResponse.ok && inferredAction === 'create-post' && cmsAction.body && site.market_sector) {
        const gate = checkSemanticGate({
          title: cmsAction.body.title,
          excerpt: cmsAction.body.excerpt || cmsAction.body.meta_description,
          body: cmsAction.body.body,
        }, site);

        if (!gate.passed) {
          console.error(`[AutopilotEngine] 🚫 SEMANTIC GATE BLOCKED: Content for "${cmsAction.body.title}" has only ${Math.round(gate.identityOverlap * 100)}% identity overlap (need ≥15%). Matched: [${gate.matchedTerms.join(', ')}] / Total: [${gate.totalTerms.slice(0, 10).join(', ')}]`);
          const slugToDelete = cmsAction.body.slug || funcResult?.result?.slug;
          if (slugToDelete) {
            await callCmsBridge(site.domain, SUPABASE_URL, SERVICE_ROLE_KEY, { action: 'delete-post', slug: slugToDelete })
              .catch((err) => console.warn('[AutopilotEngine] Failed to delete rejected post:', err));
            console.log(`[AutopilotEngine] 🗑️ Deleted hallucinated post: ${slugToDelete}`);
          }
          executionResults.push({
            function: 'iktracker-actions', cms_action: 'create-post', target: slugToDelete || 'unknown',
            status: 'rejected', reason: `Semantic gate: ${Math.round(gate.identityOverlap * 100)}% identity overlap (min 15%)`,
          });
          continue;
        }
        console.log(`[AutopilotEngine] ✅ Semantic gate passed: ${Math.round(gate.identityOverlap * 100)}% identity overlap for "${cmsAction.body.title}"`);
      }

      // Image generation after successful create-post
      let imageGenerated = false;
      if (funcResponse.ok && inferredAction === 'create-post' && cmsAction.body && !cmsAction.body.image_url) {
        imageGenerated = await generateAndAttachImage(cmsAction, funcResult, site, supabase);
      }
      
      executionResults.push({
        function: 'iktracker-actions', cms_action: cmsAction.action,
        target: cmsAction.slug || cmsAction.page_key || 'new',
        status: funcResponse.ok ? 'success' : 'error', http_status: funcResponse.status,
        result: funcResult, image_generated: imageGenerated,
      });
      if (!funcResponse.ok) {
        phaseErrors.push({ phase, function: 'iktracker-actions', severity: 'degraded', message: `CMS action ${cmsAction.action} failed: HTTP ${funcResponse.status}`, retryable: true });
        setSuccess(false);
      }
    } catch (actionErr) {
      executionResults.push({
        function: 'iktracker-actions', cms_action: cmsAction.action,
        target: cmsAction.slug || cmsAction.page_key || 'new', status: 'error',
        error: actionErr instanceof Error ? actionErr.message : 'unknown',
      });
      phaseErrors.push({ phase, function: 'iktracker-actions', severity: 'degraded', message: actionErr instanceof Error ? actionErr.message : 'unknown', retryable: true });
      setSuccess(false);
    }
  }
}

async function generateAndAttachImage(cmsAction: any, funcResult: any, site: SiteInfo, supabase: any): Promise<boolean> {
  try {
    const articleTitle = cmsAction.body.title || '';
    const articleExcerpt = cmsAction.body.excerpt || cmsAction.body.meta_description || '';
    const imagePrompt = `Evocative visual illustration for a blog article about: ${articleTitle}. Context: ${articleExcerpt}. Do NOT include any text, title or lettering.`.slice(0, 500);
    
    console.log(`[AutopilotEngine] Generating image for article: "${articleTitle}" (post-dedup)`);
    
    const imgResponse = await fetch(`${SUPABASE_URL}/functions/v1/generate-image`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: imagePrompt, style: 'cinematic' }),
      signal: AbortSignal.timeout(30000),
    });

    if (imgResponse.ok) {
      const imgResult = await imgResponse.json().catch(() => null);
      if (imgResult?.dataUri) {
        const imgFileName = `parmenion/${site.domain}/${Date.now()}_${(cmsAction.body.slug || 'article').slice(0, 30)}.png`;
        const base64Match = imgResult.dataUri.match(/^data:image\/\w+;base64,(.+)$/);
        
        if (base64Match) {
          const binaryStr = atob(base64Match[1]);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
          
          const { error: uploadErr } = await supabase.storage
            .from('image-references')
            .upload(imgFileName, bytes, { contentType: 'image/png', upsert: true });

          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from('image-references').getPublicUrl(imgFileName);
            const slug = cmsAction.body.slug || funcResult?.result?.slug;
            if (slug) {
              await callCmsBridge(site.domain, SUPABASE_URL, SERVICE_ROLE_KEY, { action: 'update-post', slug, updates: { image_url: urlData.publicUrl } })
                .catch((err) => console.warn('[AutopilotEngine] Image URL update failed:', err));
            }
            console.log(`[AutopilotEngine] Image uploaded for "${cmsAction.body.title}": ${urlData.publicUrl}`);
            return true;
          }
        }
      }
    }
  } catch (imgErr) {
    console.warn(`[AutopilotEngine] Image generation error (non-blocking):`, imgErr);
  }
  return false;
}

async function executeIktrackerReroute(
  decision: any, site: SiteInfo, config: AutopilotConfig, phase: string,
  supabase: any, executionResults: any[], phaseErrors: ExecutionError[],
  setSuccess: (v: boolean) => void,
) {
  const payload = decision.action.payload || {};
  const hasFixes = Array.isArray(payload.fixes) && payload.fixes.length > 0;
  const hasRecommendations = Array.isArray(payload.recommendations) && payload.recommendations.length > 0;

  if (hasFixes || hasRecommendations) {
    console.log(`[AutopilotEngine] Rerouting iktracker-actions → generate-corrective-code for ${site.domain}`);
    const fixes = hasFixes ? payload.fixes : payload.recommendations;
    const normalizedFixes = fixes.map((f: any, i: number) => ({
      id: f.id || `rerouted-fix-${i}`, label: f.label || f.title || f.description || `Fix ${i + 1}`,
      enabled: f.enabled !== false, category: f.category || 'strategic',
      prompt: f.prompt || f.prompt_summary || f.description || f.label || '',
      ...(f.target_url ? { targetUrl: f.target_url } : {}),
    }));

    const rerouteResponse = await fetch(`${SUPABASE_URL}/functions/v1/generate-corrective-code`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteName: site.domain, siteUrl: `https://${site.domain}`, fixes: normalizedFixes,
        technologyContext: payload.technologyContext || null,
        tracked_site_id: config.tracked_site_id, user_id: config.user_id,
      }),
    });

    const rerouteResult = await rerouteResponse.json().catch(() => ({}));
    executionResults.push({
      function: 'generate-corrective-code', rerouted_from: 'iktracker-actions',
      status: rerouteResponse.ok ? 'success' : 'error', http_status: rerouteResponse.status,
      fixes_count: normalizedFixes.length, result: rerouteResult,
    });
    if (!rerouteResponse.ok) {
      phaseErrors.push({ phase, function: 'generate-corrective-code', severity: 'degraded', message: 'Rerouted corrective code generation failed', retryable: true });
      setSuccess(false);
    }
  } else {
    console.warn(`[AutopilotEngine] iktracker-actions called without cms_actions or fixes for ${site.domain}, skipping`);
    executionResults.push({ function: 'iktracker-actions', status: 'skipped', detail: 'No cms_actions and no JS fixes in payload' });
  }
}

async function executeContentArchitect(
  decision: any, site: SiteInfo, config: AutopilotConfig, phase: string,
  supabase: any, executionResults: any[], phaseErrors: ExecutionError[],
  setSuccess: (v: boolean) => void,
) {
  const payload = decision.action.payload || {};
  const funcBody = {
    url: payload.url || `https://${site.domain}`, keyword: payload.keyword || payload.target_keyword || 'SEO',
    page_type: payload.page_type || 'article', tracked_site_id: config.tracked_site_id,
    user_id: config.user_id, language_code: payload.language_code || 'fr',
    location_code: payload.location_code || 2250, async: true,
    ...(payload.strategic_objectives && { strategic_objectives: payload.strategic_objectives }),
    ...(payload.target_internal_links && { target_internal_links: payload.target_internal_links }),
    ...(payload.cannibalization_data && { cannibalization_data: payload.cannibalization_data }),
    ...(payload.silo_context && { silo_context: payload.silo_context }),
  };

  console.log(`[AutopilotEngine] Calling content-architecture-advisor (ASYNC) for ${site.domain}, keyword: ${funcBody.keyword}`);

  const funcResponse = await fetch(`${SUPABASE_URL}/functions/v1/content-architecture-advisor`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(funcBody),
  });

  const funcResult = await funcResponse.json().catch(() => ({}));
  
  if (funcResponse.status === 202 && funcResult.job_id) {
    const jobId = funcResult.job_id;
    console.log(`[AutopilotEngine] content-architecture-advisor job queued: ${jobId}, polling...`);
    const pollDeadline = Date.now() + 180 * 1000;
    let jobResult: any = null;
    let jobStatus = 'pending';
    
    while (Date.now() < pollDeadline) {
      await new Promise(r => setTimeout(r, 5000));
      try {
        const pollResp = await fetch(`${SUPABASE_URL}/functions/v1/content-architecture-advisor?job_id=${jobId}`, {
          method: 'GET', headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` },
        });
        const pollData = await pollResp.json().catch(() => ({}));
        if (pollData.status === 'completed') { jobResult = pollData.data; jobStatus = 'completed'; break; }
        else if (pollData.status === 'failed') { jobStatus = 'failed'; jobResult = { error: pollData.error || 'Job failed' }; break; }
        console.log(`[AutopilotEngine] Job ${jobId} progress: ${pollData.progress || 0}%`);
      } catch (pollErr) {
        console.warn(`[AutopilotEngine] Poll error for job ${jobId}:`, pollErr);
      }
    }
    
    if (jobStatus === 'completed') {
      executionResults.push({ function: 'content-architecture-advisor', status: 'success', http_status: 200, keyword: funcBody.keyword, result: { data: jobResult } });
    } else {
      executionResults.push({ function: 'content-architecture-advisor', status: 'error', http_status: jobStatus === 'failed' ? 500 : 408, keyword: funcBody.keyword, result: jobResult || { error: 'Job timed out after 180s' } });
      phaseErrors.push({ phase, function: 'content-architecture-advisor', severity: 'degraded', message: `content-architecture-advisor ${jobStatus === 'failed' ? 'failed' : 'timed out after 180s'}`, retryable: true });
      setSuccess(false);
    }
  } else {
    executionResults.push({ function: 'content-architecture-advisor', status: funcResponse.ok ? 'success' : 'error', http_status: funcResponse.status, keyword: funcBody.keyword, result: funcResult });
    if (!funcResponse.ok) {
      phaseErrors.push({ phase, function: 'content-architecture-advisor', severity: 'degraded', message: `content-architecture-advisor sync failed: HTTP ${funcResponse.status}`, retryable: true });
      setSuccess(false);
    }
  }
}

async function executeCmsPushDraft(
  decision: any, site: SiteInfo, config: AutopilotConfig, phase: string,
  supabase: any, executionResults: any[], phaseErrors: ExecutionError[],
  setSuccess: (v: boolean) => void,
) {
  const cmsActions = decision.action.payload.cms_actions.slice(0, MAX_CMS_ACTIONS_PER_CYCLE);
  console.log(`[AutopilotEngine] Executing ${cmsActions.length} CMS push-draft actions for ${site.domain}`);

  for (const cmsAction of cmsActions) {
    try {
      const pushBody = {
        tracked_site_id: config.tracked_site_id,
        content_type: cmsAction.action?.includes('page') ? 'page' : 'post',
        title: cmsAction.body?.title || cmsAction.title || 'Draft',
        body: cmsAction.body?.content || cmsAction.body?.body || '',
        slug: cmsAction.body?.slug || cmsAction.slug,
        excerpt: cmsAction.body?.excerpt, meta_title: cmsAction.body?.meta_title,
        meta_description: cmsAction.body?.meta_description, tags: cmsAction.body?.tags,
        category: cmsAction.body?.category, author_name: cmsAction.body?.author_name,
      };

      const funcResponse = await fetch(`${SUPABASE_URL}/functions/v1/cms-push-draft`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(pushBody),
      });

      const funcResult = await funcResponse.json().catch(() => ({}));
      executionResults.push({
        function: 'cms-push-draft', cms_action: cmsAction.action,
        target: cmsAction.body?.title || 'draft',
        status: funcResponse.ok && funcResult.success ? 'success' : 'error',
        http_status: funcResponse.status, result: funcResult,
      });
      if (!funcResponse.ok || !funcResult.success) {
        phaseErrors.push({ phase, function: 'cms-push-draft', severity: 'degraded', message: `Draft push failed: ${funcResult.error || funcResponse.status}`, retryable: true });
        setSuccess(false);
      }
    } catch (actionErr) {
      executionResults.push({ function: 'cms-push-draft', cms_action: cmsAction.action, status: 'error', detail: actionErr instanceof Error ? actionErr.message : String(actionErr) });
      phaseErrors.push({ phase, function: 'cms-push-draft', severity: 'degraded', message: actionErr instanceof Error ? actionErr.message : 'unknown', retryable: true });
      setSuccess(false);
    }
  }
}

async function executeCmsPatch(
  decision: any, site: SiteInfo, config: AutopilotConfig, phase: string,
  supabase: any, executionResults: any[], phaseErrors: ExecutionError[],
  setSuccess: (v: boolean) => void,
) {
  const patchActions = decision.action.payload.patch_actions.slice(0, MAX_CMS_ACTIONS_PER_CYCLE);
  console.log(`[AutopilotEngine] Executing ${patchActions.length} CMS patch-content actions for ${site.domain}`);

  for (const patchAction of patchActions) {
    try {
      const patches = patchAction.patches || [{
        zone: patchAction.zone || 'body_section', action: 'replace',
        value: patchAction.body?.content || patchAction.value || '',
        old_value: patchAction.body?.old_value || patchAction.old_value,
      }];

      const patchBody = {
        tracked_site_id: config.tracked_site_id,
        target_url: patchAction.target_url || patchAction.url || `https://${site.domain}`,
        cms_post_id: patchAction.cms_post_id, patches,
      };

      const funcResponse = await fetch(`${SUPABASE_URL}/functions/v1/cms-patch-content`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
      });

      const funcResult = await funcResponse.json().catch(() => ({}));
      executionResults.push({
        function: 'cms-patch-content', target_url: patchBody.target_url,
        status: funcResponse.ok && funcResult.success ? 'success' : 'error',
        patches_applied: funcResult.patches_applied, patches_failed: funcResult.patches_failed, result: funcResult,
      });
      if (!funcResponse.ok || !funcResult.success) {
        phaseErrors.push({ phase, function: 'cms-patch-content', severity: 'degraded', message: `Patch failed: ${funcResult.error || funcResponse.status}`, retryable: true });
        setSuccess(false);
      }
    } catch (actionErr) {
      executionResults.push({ function: 'cms-patch-content', status: 'error', detail: actionErr instanceof Error ? actionErr.message : String(actionErr) });
      phaseErrors.push({ phase, function: 'cms-patch-content', severity: 'degraded', message: actionErr instanceof Error ? actionErr.message : 'unknown', retryable: true });
      setSuccess(false);
    }
  }
}

async function executeCmsRedirect(
  decision: any, site: SiteInfo, config: AutopilotConfig, phase: string,
  supabase: any, executionResults: any[], phaseErrors: ExecutionError[],
  setSuccess: (v: boolean) => void,
) {
  const redirectActions = decision.action.payload.redirect_actions.slice(0, 10);
  for (const rAction of redirectActions) {
    try {
      const redirectBody = {
        tracked_site_id: config.tracked_site_id,
        action: rAction.action === 'delete-redirect' ? 'delete' : 'create',
        from: rAction.from || rAction.source_url, to: rAction.to || rAction.target_url,
        type: rAction.redirect_type || 301, redirect_id: rAction.redirect_id,
      };

      const funcResponse = await fetch(`${SUPABASE_URL}/functions/v1/cms-push-redirect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'x-autopilot-user-id': config.user_id },
        body: JSON.stringify(redirectBody), signal: AbortSignal.timeout(30000),
      });

      const funcResult = await funcResponse.json().catch(() => ({}));
      executionResults.push({
        function: 'cms-push-redirect', from: redirectBody.from, to: redirectBody.to,
        status: funcResponse.ok && funcResult.success ? 'success' : 'error',
        detail: funcResult.error || funcResult.platform,
      });
    } catch (actionErr) {
      executionResults.push({ function: 'cms-push-redirect', status: 'error', detail: actionErr instanceof Error ? actionErr.message : String(actionErr) });
      phaseErrors.push({ phase, function: 'cms-push-redirect', severity: 'ignorable', message: actionErr instanceof Error ? actionErr.message : 'unknown', retryable: false });
      setSuccess(false);
    }
  }
}

async function executeGenericFunction(
  funcName: string, decision: any, site: SiteInfo, config: AutopilotConfig,
  phase: string, pipelinePhase: string, cycleNumber: number,
  supabase: any, executionResults: any[], phaseErrors: ExecutionError[],
  setSuccess: (v: boolean) => void,
) {
  let funcBody: Record<string, unknown> = {
    tracked_site_id: config.tracked_site_id, domain: site.domain,
    url: `https://${site.domain}`, user_id: config.user_id,
    ...decision.action.payload,
  };

  if (funcName === 'generate-corrective-code') {
    const payload = decision.action.payload || {};
    let fixes = payload.fixes || payload.recommendations || [];
    
    if (!Array.isArray(fixes) || fixes.length === 0) {
      console.log(`[AutopilotEngine] No fixes in payload for ${site.domain}, attempting fallback from recommendations registry`);
      try {
        const { data: recos } = await supabase
          .from('audit_recommendations_registry')
          .select('id, recommendation_id, title, description, category, priority, fix_type, fix_data, prompt_summary, audit_type')
          .eq('domain', site.domain).eq('is_resolved', false)
          .order('priority', { ascending: true }).limit(10);
        
        if (recos && recos.length > 0) {
          fixes = recos.map((r: any, i: number) => ({
            id: r.recommendation_id || `registry-fix-${i}`, label: r.title,
            category: r.category || 'strategic', prompt: r.prompt_summary || r.description,
            enabled: true, target_url: r.fix_data?.target_url || null,
          }));
          console.log(`[AutopilotEngine] Fallback: built ${fixes.length} fixes from recommendations registry`);
        }
      } catch (fallbackErr) {
        console.error('[AutopilotEngine] Fallback registry lookup failed:', fallbackErr);
      }
    }
    
    const normalizedFixes = Array.isArray(fixes) ? fixes.map((f: any, i: number) => ({
      id: f.id || `fix-${i}`, label: f.label || f.title || f.description || `Fix ${i + 1}`,
      enabled: f.enabled !== false, category: f.category || 'strategic',
      prompt: f.prompt || f.prompt_summary || f.description || f.label || '',
      ...(f.target_url ? { targetUrl: f.target_url } : {}),
    })) : [];

    if (normalizedFixes.length === 0) {
      console.warn(`[AutopilotEngine] generate-corrective-code called with no fixes for ${site.domain}, skipping`);
      executionResults.push({ function: funcName, status: 'skipped', error: 'No fixes available in payload or registry' });
      return;
    }

    funcBody = {
      siteName: site.domain, siteUrl: `https://${site.domain}`, fixes: normalizedFixes,
      technologyContext: payload.technologyContext || payload.technology || null,
      auditContext: payload.auditContext || null,
      tracked_site_id: config.tracked_site_id, user_id: config.user_id,
    };
    console.log(`[AutopilotEngine] Mapped ${normalizedFixes.length} fixes for generate-corrective-code on ${site.domain}`);
  }

  // Strategic orchestrator needs specific payload format (sync mode, no async)
  if (funcName === 'strategic-orchestrator') {
    funcBody = {
      url: `https://${site.domain}`,
      async: false, // Force sync so Parmenion waits for result
      lang: 'fr',
    };
    console.log(`[AutopilotEngine] Strategic orchestrator (sync) for ${site.domain}`);
  }

  // check-eeat needs url format
  if (funcName === 'check-eeat') {
    funcBody = {
      url: `https://${site.domain}`,
      domain: site.domain,
      tracked_site_id: config.tracked_site_id,
      user_id: config.user_id,
    };
  }
  const funcResponse = await fetch(`${SUPABASE_URL}/functions/v1/${funcName}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(funcBody),
  });
  
  const funcResult = await funcResponse.json().catch(() => ({}));
  executionResults.push({ function: funcName, status: funcResponse.ok ? 'success' : 'error', http_status: funcResponse.status, result: funcResult });
  if (!funcResponse.ok) {
    phaseErrors.push({ phase, function: funcName, severity: 'degraded', message: `${funcName} failed: HTTP ${funcResponse.status}`, retryable: true });
    setSuccess(false);
  }

  // Auto-push generated code to CMS
  if (funcName === 'generate-corrective-code' && funcResponse.ok && funcResult.success && funcResult.code) {
    console.log(`[AutopilotEngine] Auto-pushing corrective code to CMS for ${site.domain}`);
    try {
      const pushResp = await fetch(`${SUPABASE_URL}/functions/v1/cms-push-code`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracked_site_id: config.tracked_site_id, code: funcResult.code,
          code_minified: funcResult.codeMinified || funcResult.code,
          label: `Autopilot Cycle #${cycleNumber} (${funcResult.fixesApplied || 0} fixes)`,
          placement: 'footer', fixes_summary: funcResult.fixesSummary || [],
        }),
      });

      const pushResult = await pushResp.json().catch(() => ({}));
      executionResults.push({
        function: 'cms-push-code', triggered_by: 'generate-corrective-code',
        status: pushResp.ok && pushResult.success ? 'success' : 'error',
        http_status: pushResp.status, platform: pushResult.platform || 'unknown',
        method: pushResult.method || 'unknown', result: pushResult,
      });
      if (pushResp.ok && pushResult.success) {
        console.log(`[AutopilotEngine] Code pushed to ${pushResult.platform} via ${pushResult.method}`);
      } else {
        console.warn(`[AutopilotEngine] cms-push-code failed for ${site.domain}: ${pushResult.detail || pushResult.error}`);
      }
    } catch (pushErr) {
      console.warn(`[AutopilotEngine] cms-push-code error for ${site.domain}:`, pushErr);
    }
  }
}
