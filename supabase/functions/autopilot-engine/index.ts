import { corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';

/**
 * Autopilot Engine — Moteur d'exécution autonome des cycles
 * 
 * Pipeline: Check cooldown → Call parmenion-orchestrator → Execute decided functions → Store results → Update counters
 * 
 * Key improvement: Execution results are stored in parmenion_decision_log.execution_results
 * so the next cycle's orchestrator can use them as input for the next pipeline phase.
 */

const COOLDOWN_HOURS = 2;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type AnalyticsPayload = Record<string, unknown>;

type IktrackerPushInput = {
  trackedSiteId: string;
  userId: string;
  domain: string;
  cycleNumber: number;
  pipelinePhase: string;
  finalStatus: string;
  executionSuccess: boolean;
  message: string;
  targetUrl?: string | null;
  functions?: string[];
  details?: Record<string, unknown>;
};

function isIktrackerDomain(domain: string): boolean {
  return domain.toLowerCase().includes('iktracker');
}

function normalizePageKey(targetUrl?: string | null): string | null {
  if (!targetUrl) return null;

  try {
    const parsed = new URL(targetUrl);
    const segments = parsed.pathname.split('/').filter(Boolean);
    return segments[segments.length - 1] || parsed.pathname || null;
  } catch {
    const normalized = targetUrl.trim().replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+|\/+$/g, '');
    if (!normalized) return null;
    const segments = normalized.split('/').filter(Boolean);
    return segments[segments.length - 1] || normalized;
  }
}

async function trackAnalyticsEvent(
  supabase: ReturnType<typeof getServiceClient>,
  eventType: string,
  eventData: AnalyticsPayload,
  userId?: string,
) {
  try {
    await supabase.from('analytics_events').insert({
      user_id: userId || null,
      event_type: eventType,
      event_data: eventData,
    });
  } catch (error) {
    console.warn(`[AutopilotEngine] Failed to store analytics event ${eventType}:`, error);
  }
}

async function pushIktrackerEvent(
  supabase: ReturnType<typeof getServiceClient>,
  input: IktrackerPushInput,
) {
  if (!isIktrackerDomain(input.domain)) {
    return { attempted: false, ok: false as const };
  }

  const payload = {
    action: 'push-event',
    event_type: `autopilot_${input.pipelinePhase}`,
    severity: input.executionSuccess ? 'info' : 'warning',
    page_key: normalizePageKey(input.targetUrl),
    message: input.message,
    details: {
      cycle_number: input.cycleNumber,
      phase: input.pipelinePhase,
      functions: input.functions || [],
      status: input.finalStatus,
      ...(input.details || {}),
    },
  };

  try {
    console.log('[AutopilotEngine] Pushing IKtracker event:', JSON.stringify({
      domain: input.domain,
      tracked_site_id: input.trackedSiteId,
      ...payload,
    }));

    const response = await fetch(`${SUPABASE_URL}/functions/v1/iktracker-actions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();
    let responseBody: unknown = rawText;

    try {
      responseBody = rawText ? JSON.parse(rawText) : null;
    } catch {
      // keep raw text for debugging
    }

    const downstreamStatus = typeof (responseBody as any)?.result?.status === 'number'
      ? (responseBody as any).result.status
      : undefined;
    const ok = response.ok && (downstreamStatus === undefined || downstreamStatus < 400);

    await trackAnalyticsEvent(
      supabase,
      'autopilot:iktracker_push',
      {
        tracked_site_id: input.trackedSiteId,
        domain: input.domain,
        cycle_number: input.cycleNumber,
        pipeline_phase: input.pipelinePhase,
        final_status: input.finalStatus,
        http_status: response.status,
        downstream_status: downstreamStatus,
        ok,
        page_key: payload.page_key,
        event_type: payload.event_type,
        response: responseBody,
      },
      input.userId,
    );

    if (!ok) {
      console.error('[AutopilotEngine] IKtracker push returned non-success response:', {
        http_status: response.status,
        downstream_status: downstreamStatus,
        response: responseBody,
      });
    } else {
      console.log('[AutopilotEngine] IKtracker push succeeded:', {
        http_status: response.status,
        downstream_status: downstreamStatus,
      });
    }

    return { attempted: true, ok, httpStatus: response.status, downstreamStatus, responseBody };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    console.error('[AutopilotEngine] IKtracker event push failed:', error);

    await trackAnalyticsEvent(
      supabase,
      'autopilot:iktracker_push',
      {
        tracked_site_id: input.trackedSiteId,
        domain: input.domain,
        cycle_number: input.cycleNumber,
        pipeline_phase: input.pipelinePhase,
        final_status: input.finalStatus,
        ok: false,
        error: message,
        page_key: payload.page_key,
        event_type: payload.event_type,
      },
      input.userId,
    );

    return { attempted: true, ok: false as const, error: message };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

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
        return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
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

    const results: Array<{ site_id: string; domain: string; status: string; decision_id?: string; pipeline_phase?: string; error?: string }> = [];

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
            user_id: config.user_id,
          }),
        });

        const orchestratorResult = await orchestratorResponse.json();

        if (!orchestratorResponse.ok || !orchestratorResult.decision_id) {
          await supabase.from('autopilot_configs').update({ status: 'error', updated_at: new Date().toISOString() }).eq('id', config.id);
          results.push({ site_id: config.tracked_site_id, domain: site.domain, status: 'error', error: orchestratorResult.error || 'Orchestrator failed' });

          const orchestratorErrorMessage = `Parménion orchestration failed: ${orchestratorResult.error || 'unknown'}`;

          const { error: modificationError } = await supabase.from('autopilot_modification_log').insert({
            tracked_site_id: config.tracked_site_id,
            config_id: config.id,
            user_id: config.user_id,
            phase: 'orchestration',
            action_type: 'error',
            cycle_number: cycleNumber,
            description: orchestratorErrorMessage,
            status: 'failed',
          });

          if (modificationError) {
            console.error('[AutopilotEngine] Failed to insert orchestration error log:', modificationError);
            await trackAnalyticsEvent(
              supabase,
              'autopilot:modification_log_error',
              {
                tracked_site_id: config.tracked_site_id,
                domain: site.domain,
                phase: 'orchestration',
                cycle_number: cycleNumber,
                error: modificationError.message,
              },
              config.user_id,
            );
          }

          await pushIktrackerEvent(supabase, {
            trackedSiteId: config.tracked_site_id,
            userId: config.user_id,
            domain: site.domain,
            cycleNumber,
            pipelinePhase: 'orchestration',
            finalStatus: 'error',
            executionSuccess: false,
            message: orchestratorErrorMessage,
            details: { orchestrator_error: orchestratorResult.error || 'unknown' },
          });
          continue;
        }

        const decision = orchestratorResult.decision;
        const pipelinePhase = orchestratorResult.pipeline_phase || 'diagnose';

        // ═══ Execute decided functions & capture results ═══
        let executionSuccess = true;
        const executionResults: any[] = [];

        if (config.implementation_mode !== 'dry_run' && decision.action?.functions?.length > 0) {
          for (const funcName of decision.action.functions) {
            try {
              // ── Special handling for iktracker-actions: iterate over cms_actions ──
              if (funcName === 'iktracker-actions' && Array.isArray(decision.action.payload?.cms_actions)) {
                console.log(`[AutopilotEngine] Executing ${decision.action.payload.cms_actions.length} CMS actions on IKtracker for ${site.domain}`);
                
                for (const cmsAction of decision.action.payload.cms_actions) {
                  try {
                    const actionBody = {
                      action: cmsAction.action,
                      ...(cmsAction.page_key ? { page_key: cmsAction.page_key } : {}),
                      ...(cmsAction.slug ? { slug: cmsAction.slug } : {}),
                      ...(cmsAction.updates ? { updates: cmsAction.updates } : {}),
                      ...(cmsAction.body ? { body: cmsAction.body } : {}),
                    };

                    console.log(`[AutopilotEngine] IKtracker CMS action: ${cmsAction.action}`, JSON.stringify(actionBody).slice(0, 500));

                    const funcResponse = await fetch(`${SUPABASE_URL}/functions/v1/iktracker-actions`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify(actionBody),
                    });

                    const funcResult = await funcResponse.json().catch(() => ({}));
                    executionResults.push({
                      function: 'iktracker-actions',
                      cms_action: cmsAction.action,
                      target: cmsAction.slug || cmsAction.page_key || 'new',
                      status: funcResponse.ok ? 'success' : 'error',
                      http_status: funcResponse.status,
                      result: funcResult,
                    });
                    if (!funcResponse.ok) executionSuccess = false;
                  } catch (actionErr) {
                    executionResults.push({
                      function: 'iktracker-actions',
                      cms_action: cmsAction.action,
                      target: cmsAction.slug || cmsAction.page_key || 'new',
                      status: 'error',
                      error: actionErr instanceof Error ? actionErr.message : 'unknown',
                    });
                    executionSuccess = false;
                  }
                }
              } else {
                // ── Special handling for generate-corrective-code: ensure fixes array ──
                let funcBody: Record<string, unknown> = {
                  tracked_site_id: config.tracked_site_id,
                  domain: site.domain,
                  url: `https://${site.domain}`,
                  user_id: config.user_id,
                  ...decision.action.payload,
                };

                if (funcName === 'generate-corrective-code') {
                  // Map autopilot payload to generate-corrective-code expected format
                  const payload = decision.action.payload || {};
                  let fixes = payload.fixes || payload.recommendations || [];
                  
                  // ── Fallback: build fixes from audit_recommendations_registry if LLM didn't provide them ──
                  if (!Array.isArray(fixes) || fixes.length === 0) {
                    console.log(`[AutopilotEngine] No fixes in payload for ${site.domain}, attempting fallback from recommendations registry`);
                    try {
                      const { data: recos } = await supabase
                        .from('audit_recommendations_registry')
                        .select('id, recommendation_id, title, description, category, priority, fix_type, fix_data, prompt_summary, audit_type')
                        .eq('domain', site.domain)
                        .eq('is_resolved', false)
                        .order('priority', { ascending: true })
                        .limit(10);
                      
                      if (recos && recos.length > 0) {
                        fixes = recos.map((r: any, i: number) => ({
                          id: r.recommendation_id || `registry-fix-${i}`,
                          label: r.title,
                          category: r.category || 'strategic',
                          prompt: r.prompt_summary || r.description,
                          enabled: true,
                          target_url: r.fix_data?.target_url || null,
                        }));
                        console.log(`[AutopilotEngine] Fallback: built ${fixes.length} fixes from recommendations registry for ${site.domain}`);
                      }
                    } catch (fallbackErr) {
                      console.error('[AutopilotEngine] Fallback registry lookup failed:', fallbackErr);
                    }
                  }
                  
                  // Convert recommendations to fixes format if needed
                  const normalizedFixes = Array.isArray(fixes) ? fixes.map((f: any, i: number) => ({
                    id: f.id || f.fix_id || `autopilot-fix-${i}`,
                    label: f.label || f.title || f.description || `Fix ${i + 1}`,
                    enabled: f.enabled !== false,
                    category: f.category || 'strategic',
                    prompt: f.prompt || f.prompt_summary || f.description || f.label || '',
                    ...(f.target_url ? { targetUrl: f.target_url } : {}),
                  })) : [];

                  if (normalizedFixes.length === 0) {
                    console.warn(`[AutopilotEngine] generate-corrective-code called with no fixes for ${site.domain}, skipping`);
                    executionResults.push({
                      function: funcName,
                      status: 'skipped',
                      error: 'No fixes available in payload or registry',
                    });
                    continue;
                  }

                  funcBody = {
                    siteName: site.domain,
                    siteUrl: `https://${site.domain}`,
                    fixes: normalizedFixes,
                    technologyContext: payload.technologyContext || payload.technology || null,
                    auditContext: payload.auditContext || null,
                    tracked_site_id: config.tracked_site_id,
                    user_id: config.user_id,
                  };
                  console.log(`[AutopilotEngine] Mapped ${normalizedFixes.length} fixes for generate-corrective-code on ${site.domain}`);
                }

                // ── Standard function execution ──
                console.log(`[AutopilotEngine] Executing ${funcName} for ${site.domain} (phase: ${pipelinePhase})`);
                const funcResponse = await fetch(`${SUPABASE_URL}/functions/v1/${funcName}`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(funcBody),
                });
                
                const funcResult = await funcResponse.json().catch(() => ({}));
                executionResults.push({ 
                  function: funcName, 
                  status: funcResponse.ok ? 'success' : 'error', 
                  http_status: funcResponse.status,
                  result: funcResult,
                });
                if (!funcResponse.ok) executionSuccess = false;
              }
            } catch (e) {
              executionResults.push({ function: funcName, status: 'error', error: e instanceof Error ? e.message : 'unknown' });
              executionSuccess = false;
            }
          }
        }

        // ═══ Store execution results in decision log (CRITICAL for pipeline progression) ═══
        const finalStatus = config.implementation_mode === 'dry_run' ? 'dry_run' : executionSuccess ? 'completed' : 'partial';
        
        await supabase
          .from('parmenion_decision_log')
          .update({
            status: finalStatus,
            execution_started_at: new Date().toISOString(),
            execution_completed_at: new Date().toISOString(),
            execution_results: executionResults,
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

        // ═══ Push event to IKtracker for traceability (must not depend on local registry insert) ═══
        await pushIktrackerEvent(supabase, {
          trackedSiteId: config.tracked_site_id,
          userId: config.user_id,
          domain: site.domain,
          cycleNumber,
          pipelinePhase,
          finalStatus,
          executionSuccess,
          message: `[Cycle #${cycleNumber}] ${decision.summary || decision.goal?.description || pipelinePhase}`,
          targetUrl: decision.tactic?.target_url || null,
          functions: decision.action?.functions || [],
          details: {
            decision_id: orchestratorResult.decision_id,
          },
        });

        // ═══ Log in modification registry ═══
        const { error: modificationError } = await supabase.from('autopilot_modification_log').insert({
          tracked_site_id: config.tracked_site_id,
          config_id: config.id,
          user_id: config.user_id,
          phase: pipelinePhase,
          action_type: decision.goal?.type || 'auto',
          page_url: decision.tactic?.target_url || null,
          cycle_number: cycleNumber,
          description: `[${pipelinePhase.toUpperCase()}] ${decision.summary || decision.goal?.description || `Cycle #${cycleNumber}`}`,
          diff_before: decision.tactic?.initial_scope || {},
          diff_after: { execution: executionResults, decision: decision.prudence },
          status: config.implementation_mode === 'dry_run' ? 'dry_run' : executionSuccess ? 'applied' : 'failed',
        });

        if (modificationError) {
          console.error('[AutopilotEngine] Failed to insert modification log:', modificationError);
          await trackAnalyticsEvent(
            supabase,
            'autopilot:modification_log_error',
            {
              tracked_site_id: config.tracked_site_id,
              domain: site.domain,
              phase: pipelinePhase,
              cycle_number: cycleNumber,
              decision_id: orchestratorResult.decision_id,
              error: modificationError.message,
            },
            config.user_id,
          );
        }

        results.push({
          site_id: config.tracked_site_id,
          domain: site.domain,
          status: finalStatus,
          decision_id: orchestratorResult.decision_id,
          pipeline_phase: pipelinePhase,
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
