import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

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

// ═══ Error severity classification ═══
type ErrorSeverity = 'ignorable' | 'degraded' | 'critical';

interface ExecutionError {
  phase: string;
  function: string;
  severity: ErrorSeverity;
  message: string;
  retryable: boolean;
  detail?: unknown;
}

type CycleStatus = 'completed' | 'degraded' | 'partial' | 'failed';

function computeCycleStatus(errors: ExecutionError[]): CycleStatus {
  if (errors.some(e => e.severity === 'critical')) return 'failed';
  if (errors.some(e => e.severity === 'degraded')) return 'degraded';
  return 'completed';
}

function classifyFuncError(funcName: string, isOnlyFailure: boolean): ErrorSeverity {
  // Ignorable: non-blocking auxiliary functions
  if (['generate-image', 'cms-push-code'].includes(funcName)) return 'ignorable';
  // Critical only if ALL actions in a batch failed
  if (['iktracker-actions', 'cms-push-draft', 'cms-patch-content'].includes(funcName) && isOnlyFailure) return 'critical';
  // Default: degraded
  return 'degraded';
}

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

  // Already a clean slug (no slashes, no protocol) → return as-is
  const trimmed = targetUrl.trim();
  if (/^[a-z0-9][a-z0-9-]*$/i.test(trimmed)) return trimmed.toLowerCase();

  try {
    const parsed = new URL(trimmed);
    const segments = parsed.pathname.split('/').filter(Boolean);
    // Homepage → return 'homepage' (IKtracker needs a real slug, not '/')
    if (segments.length === 0) return 'homepage';
    return segments[segments.length - 1].toLowerCase();
  } catch {
    // Not a valid URL — strip protocol/domain if present
    const normalized = trimmed.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+|\/+$/g, '');
    if (!normalized) return 'homepage';
    const segments = normalized.split('/').filter(Boolean);
    return (segments[segments.length - 1] || 'homepage').toLowerCase();
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

// ═══ CMS Action Router ═══
// Categorizes each CMS action as 'content' (visible page elements) or 'code' (metadata/structured data)

type RoutedActions = {
  content: Array<Record<string, unknown>>;
  code: Array<Record<string, unknown>>;
  all: Array<Record<string, unknown>>;
};

const CONTENT_FIELDS = new Set([
  'body', 'content', 'title', 'excerpt', 'heading', 'h1', 'h2', 'paragraphs', 'faq', 'summary',
]);

const CODE_FIELDS = new Set([
  'meta_title', 'meta_description', 'canonical_url', 'schema_org', 'json_ld',
  'og_title', 'og_description', 'og_image', 'robots', 'hreflang',
]);

function classifyAction(action: Record<string, unknown>): 'content' | 'code' | 'both' {
  const actionName = (action.action as string) || '';
  
  // Create/delete are both channels
  if (actionName.startsWith('create-') || actionName.startsWith('delete-')) return 'both';

  // Check the updates object for field-level classification
  const updates = (action.updates || action.body || {}) as Record<string, unknown>;
  const fields = Object.keys(updates);
  
  const hasContent = fields.some(f => CONTENT_FIELDS.has(f));
  const hasCode = fields.some(f => CODE_FIELDS.has(f));
  
  if (hasContent && hasCode) return 'both';
  if (hasCode) return 'code';
  if (hasContent) return 'content';
  
  // Default by action type
  if (actionName.includes('post') || actionName.includes('page')) return 'content';
  return 'both';
}

function routeCmsActions(actions: Array<Record<string, unknown>>, domain: string): RoutedActions {
  const content: Array<Record<string, unknown>> = [];
  const code: Array<Record<string, unknown>> = [];
  const all: Array<Record<string, unknown>> = [];

  for (const action of actions) {
    const channel = classifyAction(action);
    const taggedAction = { ...action, _channel: channel };
    all.push(taggedAction);
    
    if (channel === 'content' || channel === 'both') content.push(taggedAction);
    if (channel === 'code' || channel === 'both') code.push(taggedAction);
  }

  console.log(`[CMS Router] ${domain}: ${content.length} content, ${code.length} code, ${all.length} total actions`);
  return { content, code, all };
}

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

        // ═══ Check cooldown (only after successful macro-cycles) ═══
        const cooldownMs = (config.cooldown_hours || COOLDOWN_HOURS) * 3600 * 1000;
        if (config.last_cycle_at && config.status !== 'error') {
          const elapsed = Date.now() - new Date(config.last_cycle_at).getTime();
          if (elapsed < cooldownMs) {
            const hoursLeft = Math.round((cooldownMs - elapsed) / 3600000);
            results.push({ site_id: config.tracked_site_id, domain: site.domain, status: 'cooldown', error: `${hoursLeft}h remaining` });
            continue;
          }
        }
        // If last cycle failed (status === 'error'), skip cooldown and retry immediately

        // ═══ Update status to 'running' ═══
        await supabase
          .from('autopilot_configs')
          .update({ status: 'running', updated_at: new Date().toISOString() })
          .eq('id', config.id);

        const cycleNumber = (config.total_cycles_run || 0) + 1;
        const cycleStartTime = Date.now();

        // ═══ FULL PIPELINE: Loop through ALL phases in a single cycle ═══
        // 'route' is handled inline after 'prescribe', not as a separate orchestrator call
        const PIPELINE_PHASES = ['audit', 'diagnose', 'prescribe', 'execute', 'validate'] as const;
        let cycleSuccess = true;
        let hasCriticalError = false;
        const allPhaseErrors: ExecutionError[] = [];
        let lastDecisionId: string | null = null;
        let lastPipelinePhase = 'audit';
        let lastDecision: any = null;
        let routedCmsActions: RoutedActions | null = null;
        const allPhaseResults: Array<{ phase: string; decision_id: string; status: string; executionResults: any[] }> = [];

        for (const phase of PIPELINE_PHASES) {
          console.log(`[AutopilotEngine] ═══ Phase ${phase.toUpperCase()} for ${site.domain}, cycle #${cycleNumber} ═══`);

          // ═══ Call Parménion orchestrator for this phase (with forced_phase) ═══
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
              forced_phase: phase, // ← Engine drives the phase, not auto-detection
              force_content_cycle: config.force_content_cycle ?? true,
              content_budget_pct: config.content_budget_pct ?? 30,
              force_iktracker_article: config.force_iktracker_article ?? false,
            }),
          });

          const orchestratorResult = await orchestratorResponse.json();

          if (!orchestratorResponse.ok || !orchestratorResult.decision_id) {
            console.error(`[AutopilotEngine] Orchestrator failed at phase ${phase}:`, orchestratorResult.error);
            
            await supabase.from('autopilot_modification_log').insert({
              tracked_site_id: config.tracked_site_id,
              config_id: config.id,
              user_id: config.user_id,
              phase,
              action_type: 'error',
              cycle_number: cycleNumber,
              description: `Pipeline stopped at ${phase}: ${orchestratorResult.error || 'orchestrator failed'}`,
              status: 'failed',
            });

            hasCriticalError = true;
            cycleSuccess = false;
            break; // Critical: orchestrator failed, can't continue
          }

          const decision = orchestratorResult.decision;
          const pipelinePhase = orchestratorResult.pipeline_phase || phase;
          lastDecisionId = orchestratorResult.decision_id;
          lastPipelinePhase = pipelinePhase;
          lastDecision = decision;

          // ═══ Execute decided functions & capture results ═══
          let executionSuccess = true;
          const phaseErrors: ExecutionError[] = [];
          const executionResults: any[] = [];

        // ═══ POST-AUDIT: Auto-inject audit findings into architect_workbench ═══
        if (phase === 'audit' && executionSuccess) {
          try {
            console.log(`[AutopilotEngine] 🔄 Auto-populating workbench from audit results for ${site.domain}`);
            const { data: populateResult, error: populateErr } = await supabase.rpc('populate_architect_workbench', {
              p_domain: site.domain,
              p_user_id: config.user_id,
              p_tracked_site_id: config.tracked_site_id,
            });
            if (populateErr) {
              console.warn('[AutopilotEngine] Workbench populate error:', populateErr.message);
            } else {
              console.log(`[AutopilotEngine] ✅ Workbench populated: ${JSON.stringify(populateResult)}`);
            }
          } catch (popE) {
            console.warn('[AutopilotEngine] Workbench populate exception:', popE);
          }
        }

        // ═══ POST-DIAGNOSE: Re-populate workbench + recycle stale items + proactive opportunity scan ═══
        if (phase === 'diagnose' && executionSuccess) {
          try {
            // 1. Re-populate workbench with latest diagnostic findings
            console.log(`[AutopilotEngine] 🔄 Re-populating workbench after diagnose for ${site.domain}`);
            const { data: populateResult2, error: populateErr2 } = await supabase.rpc('populate_architect_workbench', {
              p_domain: site.domain,
              p_user_id: config.user_id,
              p_tracked_site_id: config.tracked_site_id,
            });
            if (populateErr2) console.warn('[AutopilotEngine] Post-diagnose populate error:', populateErr2.message);
            else console.log(`[AutopilotEngine] ✅ Post-diagnose workbench: ${JSON.stringify(populateResult2)}`);

            // 2. Recycle stale consumed workbench items (>24h)
            const { data: recycled, error: recycleErr } = await supabase
              .from('architect_workbench')
              .update({ 
                status: 'pending', 
                consumed_by_code: false, 
                consumed_by_content: false,
                consumed_at: null,
                updated_at: new Date().toISOString(),
              })
              .eq('domain', site.domain)
              .eq('status', 'in_progress')
              .lt('consumed_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
              .select('id');
            
            if (recycled && recycled.length > 0) {
              console.log(`[AutopilotEngine] ♻️ Recycled ${recycled.length} stale workbench items for ${site.domain}`);
            }
            if (recycleErr) console.warn('[AutopilotEngine] Workbench recycle error:', recycleErr.message);

            // 3. PROACTIVE: Check content freshness — inject "stale content" items for pages not updated in 90+ days
            try {
              const { data: stalePages } = await supabase
                .from('url_registry')
                .select('url, title, last_crawled_at')
                .eq('domain', site.domain)
                .lt('last_crawled_at', new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString())
                .not('url', 'ilike', '%/wp-admin%')
                .not('url', 'ilike', '%/feed%')
                .order('last_crawled_at', { ascending: true })
                .limit(5);

              if (stalePages && stalePages.length > 0) {
                const staleItems = stalePages.map(p => ({
                  domain: site.domain,
                  tracked_site_id: config.tracked_site_id,
                  user_id: config.user_id,
                  source_type: 'proactive_scan' as const,
                  source_function: 'autopilot-engine',
                  source_record_id: `freshness_${site.domain}_${p.url}`,
                  finding_category: 'content_freshness',
                  severity: 'medium',
                  title: `Contenu obsolète: ${p.title || p.url}`,
                  description: `Cette page n'a pas été mise à jour depuis plus de 90 jours. Une actualisation améliorerait le signal de fraîcheur pour Google et les moteurs IA.`,
                  target_url: p.url,
                  target_operation: 'replace',
                  action_type: 'content' as const,
                  status: 'pending' as const,
                }));

                for (const item of staleItems) {
                  await supabase.from('architect_workbench').upsert(item, { 
                    onConflict: 'source_type,source_record_id',
                    ignoreDuplicates: true,
                  });
                }
                console.log(`[AutopilotEngine] 🔍 Proactive: injected ${staleItems.length} stale content items for ${site.domain}`);
              }
            } catch (freshErr) {
              console.warn('[AutopilotEngine] Freshness scan error:', freshErr);
            }

            // 4. PROACTIVE: Check if EEAT audit is stale (>14 days) → inject EEAT gap items
            try {
              const { data: lastEeat } = await supabase
                .from('audit_raw_data')
                .select('created_at')
                .eq('domain', site.domain)
                .eq('audit_type', 'eeat')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              const eeatAge = lastEeat?.created_at 
                ? Date.now() - new Date(lastEeat.created_at).getTime()
                : Infinity;

              if (eeatAge > 14 * 24 * 3600 * 1000) {
                await supabase.from('architect_workbench').upsert({
                  domain: site.domain,
                  tracked_site_id: config.tracked_site_id,
                  user_id: config.user_id,
                  source_type: 'proactive_scan' as const,
                  source_function: 'autopilot-engine',
                  source_record_id: `eeat_refresh_${site.domain}`,
                  finding_category: 'eeat',
                  severity: 'medium',
                  title: `Rafraîchir l'audit E-E-A-T (${lastEeat ? `dernier: ${new Date(lastEeat.created_at).toLocaleDateString('fr')}` : 'jamais fait'})`,
                  description: `L'audit E-E-A-T date de plus de 14 jours. Un nouvel audit permettrait d'identifier les signaux de confiance à renforcer.`,
                  target_url: `https://${site.domain}`,
                  target_operation: 'replace',
                  action_type: 'content' as const,
                  status: 'pending' as const,
                }, { onConflict: 'source_type,source_record_id', ignoreDuplicates: true });
                console.log(`[AutopilotEngine] 🔍 Proactive: EEAT refresh needed for ${site.domain}`);
              }
            } catch (eeatErr) {
              console.warn('[AutopilotEngine] EEAT check error:', eeatErr);
            }

          } catch (recycleE) {
            console.warn('[AutopilotEngine] Post-diagnose processing exception:', recycleE);
          }
        }

        // ═══ INLINE ROUTING: After prescribe, detect V2 structured payload ═══
        if (phase === 'prescribe') {
          const payload = decision.action?.payload || {};
          
          if (payload._prescribe_v2) {
            // V2: Tool calls already structured with _channel tags
            const allCmsActions = payload.cms_actions || [];
            const allFixes = payload.fixes || [];
            
            // ═══ GUARD: If V2 produced ZERO tool calls, treat as V1 fallback ═══
            // This prevents the execute phase from being skipped when the LLM
            // sets _prescribe_v2 but doesn't actually produce any tool calls.
            const hasV2Output = allCmsActions.length > 0 || allFixes.length > 0;
            
            if (hasV2Output) {
              routedCmsActions = {
                content: allCmsActions.filter((a: any) => a._channel === 'content_corrective' || a._channel === 'content_editorial'),
                code: allCmsActions.filter((a: any) => a._channel === 'data'),
                all: allCmsActions,
              };
              
              console.log(`[AutopilotEngine] Prescribe V2: ${allFixes?.length || 0} code fixes + ${routedCmsActions.content.length} content + ${routedCmsActions.code.length} data CMS actions`);
            } else {
              // V2 flag set but no output → downgrade to non-V2 so functions execute normally
              console.warn(`[AutopilotEngine] Prescribe V2 EMPTY for ${site.domain}: _tool_calls_raw is empty, downgrading to V1 execution mode`);
              payload._prescribe_v2 = false;
              decision.action.payload._prescribe_v2 = false;
            }
            
            if (hasV2Output) {
              allPhaseResults.push({ phase: 'route', decision_id: lastDecisionId || 'inline', status: 'completed', executionResults: [{
                function: 'prescribe-v2-router',
                status: 'success',
                code_fixes: allFixes?.length || 0,
                content_actions: routedCmsActions!.content.length,
                data_actions: routedCmsActions!.code.length,
                total_cms: allCmsActions.length,
              }] });
            }
          } else if (payload.cms_actions) {
            // Legacy V1: route by field inspection
            routedCmsActions = routeCmsActions(payload.cms_actions, site.domain);
            console.log(`[AutopilotEngine] Routed ${routedCmsActions.content.length} content + ${routedCmsActions.code.length} code actions for ${site.domain}`);
            
            allPhaseResults.push({ phase: 'route', decision_id: lastDecisionId || 'inline', status: 'completed', executionResults: [{
              function: 'cms-router',
              status: 'success',
              content_actions: routedCmsActions.content.length,
              code_actions: routedCmsActions.code.length,
              total: routedCmsActions.all.length,
            }] });
          }
          
          await supabase.from('autopilot_modification_log').insert({
            tracked_site_id: config.tracked_site_id,
            config_id: config.id,
            user_id: config.user_id,
            phase: 'route',
            action_type: 'routing',
            cycle_number: cycleNumber,
            description: `[ROUTE${payload._prescribe_v2 ? ' V2' : ''}] ${routedCmsActions?.content.length || 0} content + ${routedCmsActions?.code.length || 0} data + ${payload.fixes?.length || 0} code fixes`,
            diff_before: { prescribe_v2: !!payload._prescribe_v2, original_cms: payload.cms_actions?.length || 0, original_fixes: payload.fixes?.length || 0 },
            diff_after: { content: routedCmsActions?.content.length || 0, code: routedCmsActions?.code.length || 0, fixes: payload.fixes?.length || 0 },
            status: 'applied',
          });
        }

        // ═══ EXECUTE PHASE: Inject routed CMS actions or build fallback CMS actions ═══
        if (phase === 'execute' && isIktrackerDomain(site.domain)) {
          if (!decision.action.payload) decision.action.payload = {};
          const hasCmsActions = Array.isArray(decision.action.payload.cms_actions) && decision.action.payload.cms_actions.length > 0;
          
          if (routedCmsActions && routedCmsActions.all.length > 0 && !hasCmsActions) {
            // Inject routed actions from prescribe
            decision.action.payload.cms_actions = routedCmsActions.all;
            decision.action.payload._routed = routedCmsActions;
            console.log(`[AutopilotEngine] Injected ${routedCmsActions.all.length} routed CMS actions into execute phase for ${site.domain}`);
          } else if (!hasCmsActions) {
            // ═══ FALLBACK: Build CMS actions from pending recommendations ═══
            // IMPORTANT: Only build META corrections (update-page) from recommendations.
            // Content creation (create-post) is NEVER done in fallback because recommendations
            // contain SEO strategy descriptions, NOT actual articles about the site's business topic.
            // Editorial content must ONLY be created via prescribe V2 dual-prompt engine which
            // has the full site identity context (sector, products, audience) to produce on-topic articles.
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
                      action: 'update-page',
                      page_key: pageKey,
                      updates: {
                        meta_description: reco.fix_data?.meta_description || (reco.description || reco.title || '').slice(0, 155),
                        ...(reco.fix_data?.meta_title ? { meta_title: reco.fix_data.meta_title } : {}),
                      },
                    });
                  }
                  // Content recommendations (contenu, content_gap, eeat, autorité, identité, social)
                  // are SKIPPED here. They should be handled by prescribe V2 which has the full
                  // site identity context to generate on-topic content, not SEO strategy articles.
                }

                if (fallbackCmsActions.length > 0) {
                  decision.action.payload.cms_actions = fallbackCmsActions;
                  console.log(`[AutopilotEngine] Fallback: built ${fallbackCmsActions.length} META-ONLY CMS actions from recommendations for ${site.domain}`);
                } else {
                  console.log(`[AutopilotEngine] Fallback: no META recommendations found for ${site.domain}, skipping content creation (requires prescribe V2)`);
                }
              }
            } catch (fallbackErr) {
              console.error('[AutopilotEngine] CMS fallback failed:', fallbackErr);
            }
          }

          // Ensure iktracker-actions is in the function list if we have CMS actions
          const finalHasCms = Array.isArray(decision.action.payload.cms_actions) && decision.action.payload.cms_actions.length > 0;
          if (finalHasCms && !decision.action.functions.includes('iktracker-actions')) {
            decision.action.functions.push('iktracker-actions');
          }
        } else if (phase === 'execute' && routedCmsActions && routedCmsActions.all.length > 0) {
          // Non-IKtracker sites with routed CMS actions → use cms-push-draft + cms-patch-content
          if (!decision.action.payload) decision.action.payload = {};
          if (!decision.action.payload.cms_actions || decision.action.payload.cms_actions.length === 0) {
            decision.action.payload.cms_actions = routedCmsActions.all;
            decision.action.payload._routed = routedCmsActions;
          }
          // Separate create vs patch actions
          const createActions = routedCmsActions.all.filter((a: any) => a.action === 'create-post' || a.action === 'create-page');
          const patchActions = routedCmsActions.all.filter((a: any) => a.action === 'update-page' || a.action === 'patch-content' || a.action === 'update-h1' || a.action === 'update-faq' || a.action === 'update-meta');
          const redirectActions = routedCmsActions.all.filter((a: any) => a.action === 'create-redirect' || a.action === 'delete-redirect');
          
          decision.action.functions = decision.action.functions.filter((f: string) => f !== 'iktracker-actions');
          if (createActions.length > 0 && !decision.action.functions.includes('cms-push-draft')) {
            decision.action.functions.push('cms-push-draft');
          }
          if (patchActions.length > 0 && !decision.action.functions.includes('cms-patch-content')) {
            decision.action.functions.push('cms-patch-content');
            decision.action.payload.patch_actions = patchActions;
          }
          if (redirectActions.length > 0 && !decision.action.functions.includes('cms-push-redirect')) {
            decision.action.functions.push('cms-push-redirect');
            decision.action.payload.redirect_actions = redirectActions;
          }
        }

        // ═══ SKIP function execution during prescribe V2 phase ═══
        // Prescribe V2 produces cms_actions/fixes via LLM tool calls in the orchestrator itself.
        // These are stored in the payload and will be executed during the 'execute' phase.
        // Running functions (like content-architecture-advisor) here is redundant and causes errors.
        const isPrescribeV2 = phase === 'prescribe' && decision.action?.payload?._prescribe_v2 === true;
        
        if (!isPrescribeV2 && config.implementation_mode !== 'dry_run' && decision.action?.functions?.length > 0) {
          for (const funcName of decision.action.functions) {
            try {
              // ── Skip cms-push-code: it's auto-chained after generate-corrective-code ──
              if (funcName === 'cms-push-code') {
                console.log(`[AutopilotEngine] Skipping standalone cms-push-code for ${site.domain} (auto-triggered after generate-corrective-code)`);
                continue;
              }
              // ── Special handling for iktracker-actions: iterate over cms_actions ──
              if (funcName === 'iktracker-actions' && Array.isArray(decision.action.payload?.cms_actions)) {
                // ── Guard: max 10 CMS actions per cycle ──
                const MAX_CMS_ACTIONS_PER_CYCLE = 10;
                if (decision.action.payload.cms_actions.length > MAX_CMS_ACTIONS_PER_CYCLE) {
                  console.warn(`[AutopilotEngine] Truncating ${decision.action.payload.cms_actions.length} CMS actions to ${MAX_CMS_ACTIONS_PER_CYCLE} for ${site.domain}`);
                  decision.action.payload.cms_actions = decision.action.payload.cms_actions.slice(0, MAX_CMS_ACTIONS_PER_CYCLE);
                }
                console.log(`[AutopilotEngine] Executing ${decision.action.payload.cms_actions.length} CMS actions on IKtracker for ${site.domain}`);
                
                for (const cmsAction of decision.action.payload.cms_actions) {
                  try {
                    // Infer action from available fields if LLM omitted it
                    let inferredAction = cmsAction.action
                      || (cmsAction.body ? 'create-post' : null)
                      || (cmsAction.updates && cmsAction.slug ? 'update-post' : null)
                      || (cmsAction.updates && cmsAction.page_key ? 'update-page' : null)
                      || 'list-posts';

                    if (!cmsAction.action) {
                      console.warn(`[AutopilotEngine] CMS action missing 'action' field, inferred: ${inferredAction}`);
                    }

                    // ── Smart upsert: if create-post with a slug, check if it already exists ──
                    // iktracker-actions handles this server-side too, but we log the correct action here
                    if (inferredAction === 'create-post' && cmsAction.body?.slug) {
                      console.log(`[AutopilotEngine] create-post for slug "${cmsAction.body.slug}" — iktracker will auto-upsert if exists`);
                    }

                    // ── Auto-generate image for new articles ──
                    if (inferredAction === 'create-post' && cmsAction.body) {
                      try {
                        const articleTitle = cmsAction.body.title || '';
                        const articleExcerpt = cmsAction.body.excerpt || cmsAction.body.meta_description || '';
                        const imagePrompt = `Evocative visual illustration for a blog article about: ${articleTitle}. Context: ${articleExcerpt}. Do NOT include any text, title or lettering.`.slice(0, 500);
                        
                        console.log(`[AutopilotEngine] Generating image for IKtracker article: "${articleTitle}"`);
                        
                        const imgResponse = await fetch(`${SUPABASE_URL}/functions/v1/generate-image`, {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            prompt: imagePrompt,
                            style: 'cinematic',
                          }),
                        });

                        if (imgResponse.ok) {
                          const imgResult = await imgResponse.json().catch(() => null);
                          if (imgResult?.dataUri) {
                            // Upload to storage bucket for a persistent URL
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
                                const { data: urlData } = supabase.storage
                                  .from('image-references')
                                  .getPublicUrl(imgFileName);
                                
                                cmsAction.body.image_url = urlData.publicUrl;
                                console.log(`[AutopilotEngine] Image generated and uploaded for "${articleTitle}": ${urlData.publicUrl}`);
                              } else {
                                console.warn(`[AutopilotEngine] Image upload failed:`, uploadErr);
                                // Fallback: embed as data URI
                                cmsAction.body.image_url = imgResult.dataUri;
                              }
                            }
                          }
                        } else {
                          console.warn(`[AutopilotEngine] Image generation failed for "${articleTitle}": ${imgResponse.status}`);
                        }
                      } catch (imgErr) {
                        console.warn(`[AutopilotEngine] Image generation error (non-blocking):`, imgErr);
                      }
                    }

                    const actionBody = {
                      action: inferredAction,
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
                      image_generated: !!cmsAction.body?.image_url,
                    });
                    if (!funcResponse.ok) {
                      phaseErrors.push({ phase, function: 'iktracker-actions', severity: 'degraded', message: `CMS action ${cmsAction.action} failed: HTTP ${funcResponse.status}`, retryable: true });
                      executionSuccess = false;
                    }
                  } catch (actionErr) {
                    executionResults.push({
                      function: 'iktracker-actions',
                      cms_action: cmsAction.action,
                      target: cmsAction.slug || cmsAction.page_key || 'new',
                      status: 'error',
                      error: actionErr instanceof Error ? actionErr.message : 'unknown',
                    });
                    phaseErrors.push({ phase, function: 'iktracker-actions', severity: 'degraded', message: actionErr instanceof Error ? actionErr.message : 'unknown', retryable: true });
                    executionSuccess = false;
                  }
                }
              } else if (funcName === 'iktracker-actions') {
                // iktracker-actions called without cms_actions → check if we have JS fixes to reroute
                const payload = decision.action.payload || {};
                const hasFixes = Array.isArray(payload.fixes) && payload.fixes.length > 0;
                const hasRecommendations = Array.isArray(payload.recommendations) && payload.recommendations.length > 0;

                if (hasFixes || hasRecommendations) {
                  // ── Reroute: JS corrections should go to generate-corrective-code, not iktracker ──
                  console.log(`[AutopilotEngine] Rerouting iktracker-actions → generate-corrective-code for ${site.domain} (JS fixes detected)`);
                  
                  const fixes = hasFixes ? payload.fixes : payload.recommendations;
                  const normalizedFixes = fixes.map((f: any, i: number) => ({
                    id: f.id || `rerouted-fix-${i}`,
                    label: f.label || f.title || f.description || `Fix ${i + 1}`,
                    enabled: f.enabled !== false,
                    category: f.category || 'strategic',
                    prompt: f.prompt || f.prompt_summary || f.description || f.label || '',
                    ...(f.target_url ? { targetUrl: f.target_url } : {}),
                  }));

                  const rerouteBody = {
                    siteName: site.domain,
                    siteUrl: `https://${site.domain}`,
                    fixes: normalizedFixes,
                    technologyContext: payload.technologyContext || null,
                    tracked_site_id: config.tracked_site_id,
                    user_id: config.user_id,
                  };

                  const rerouteResponse = await fetch(`${SUPABASE_URL}/functions/v1/generate-corrective-code`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(rerouteBody),
                  });

                  const rerouteResult = await rerouteResponse.json().catch(() => ({}));
                  executionResults.push({
                    function: 'generate-corrective-code',
                    rerouted_from: 'iktracker-actions',
                    status: rerouteResponse.ok ? 'success' : 'error',
                    http_status: rerouteResponse.status,
                    fixes_count: normalizedFixes.length,
                    result: rerouteResult,
                  });
                  if (!rerouteResponse.ok) {
                    phaseErrors.push({ phase, function: 'generate-corrective-code', severity: 'degraded', message: 'Rerouted corrective code generation failed', retryable: true });
                    executionSuccess = false;
                  }
                } else {
                  // No cms_actions AND no JS fixes → truly nothing to do
                  console.warn(`[AutopilotEngine] iktracker-actions called without cms_actions or fixes for ${site.domain}, skipping`);
                  executionResults.push({
                    function: funcName,
                    status: 'skipped',
                    detail: 'No cms_actions and no JS fixes in payload – nothing to execute',
                  });
                }
                continue;
              } else if (funcName === 'content-architecture-advisor') {
                // ── Async handling for content-architecture-advisor ──
                const payload = decision.action.payload || {};
                const funcBody = {
                  url: payload.url || `https://${site.domain}`,
                  keyword: payload.keyword || payload.target_keyword || 'SEO',
                  page_type: payload.page_type || 'article',
                  tracked_site_id: config.tracked_site_id,
                  user_id: config.user_id, // ← Pass real user_id for async job creation
                  language_code: payload.language_code || 'fr',
                  location_code: payload.location_code || 2250,
                  async: true, // ← Force async mode
                  ...(payload.strategic_objectives && { strategic_objectives: payload.strategic_objectives }),
                  ...(payload.target_internal_links && { target_internal_links: payload.target_internal_links }),
                  ...(payload.cannibalization_data && { cannibalization_data: payload.cannibalization_data }),
                  ...(payload.silo_context && { silo_context: payload.silo_context }),
                };

                console.log(`[AutopilotEngine] Calling content-architecture-advisor (ASYNC) for ${site.domain}, keyword: ${funcBody.keyword}`);

                const funcResponse = await fetch(`${SUPABASE_URL}/functions/v1/content-architecture-advisor`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(funcBody),
                });

                const funcResult = await funcResponse.json().catch(() => ({}));
                
                if (funcResponse.status === 202 && funcResult.job_id) {
                  // Poll for result (max 5 minutes, every 10s)
                  const jobId = funcResult.job_id;
                  console.log(`[AutopilotEngine] content-architecture-advisor job queued: ${jobId}, polling...`);
                  const pollDeadline = Date.now() + 90 * 1000; // 90s max — sous la limite Edge de 150s
                  let jobResult: any = null;
                  let jobStatus = 'pending';
                  
                  while (Date.now() < pollDeadline) {
                    await new Promise(r => setTimeout(r, 5000)); // 5s poll interval
                    
                    try {
                      const pollResp = await fetch(`${SUPABASE_URL}/functions/v1/content-architecture-advisor?job_id=${jobId}`, {
                        method: 'GET',
                        headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` },
                      });
                      const pollData = await pollResp.json().catch(() => ({}));
                      
                      if (pollData.status === 'completed') {
                        jobResult = pollData.data;
                        jobStatus = 'completed';
                        console.log(`[AutopilotEngine] content-architecture-advisor job ${jobId} completed`);
                        break;
                      } else if (pollData.status === 'failed') {
                        jobStatus = 'failed';
                        jobResult = { error: pollData.error || 'Job failed' };
                        console.error(`[AutopilotEngine] content-architecture-advisor job ${jobId} failed: ${pollData.error}`);
                        break;
                      }
                      // Still processing, continue polling
                      console.log(`[AutopilotEngine] Job ${jobId} progress: ${pollData.progress || 0}%`);
                    } catch (pollErr) {
                      console.warn(`[AutopilotEngine] Poll error for job ${jobId}:`, pollErr);
                    }
                  }
                  
                  if (jobStatus === 'completed') {
                    executionResults.push({
                      function: funcName,
                      status: 'success',
                      http_status: 200,
                      keyword: funcBody.keyword,
                      result: { data: jobResult },
                    });
                  } else {
                    executionResults.push({
                      function: funcName,
                      status: 'error',
                      http_status: jobStatus === 'failed' ? 500 : 408,
                      keyword: funcBody.keyword,
                      result: jobResult || { error: 'Job timed out after 90s' },
                    });
                    phaseErrors.push({ phase, function: funcName, severity: 'degraded', message: `content-architecture-advisor ${jobStatus === 'failed' ? 'failed' : 'timed out after 90s'}`, retryable: true });
                    executionSuccess = false;
                  }
                } else {
                  // Non-async fallback (shouldn't happen but safe)
                  executionResults.push({
                    function: funcName,
                    status: funcResponse.ok ? 'success' : 'error',
                    http_status: funcResponse.status,
                    keyword: funcBody.keyword,
                    result: funcResult,
                  });
                  if (!funcResponse.ok) {
                    phaseErrors.push({ phase, function: funcName, severity: 'degraded', message: `content-architecture-advisor sync failed: HTTP ${funcResponse.status}`, retryable: true });
                    executionSuccess = false;
                  }
                }
              } else if (funcName === 'cms-push-draft' && Array.isArray(decision.action.payload?.cms_actions)) {
                // ── CMS Push Draft: unified draft push for non-IKTracker CMS ──
                const MAX_CMS_ACTIONS = 10;
                const cmsActions = decision.action.payload.cms_actions.slice(0, MAX_CMS_ACTIONS);
                console.log(`[AutopilotEngine] Executing ${cmsActions.length} CMS push-draft actions for ${site.domain}`);

                for (const cmsAction of cmsActions) {
                  try {
                    const pushBody = {
                      tracked_site_id: config.tracked_site_id,
                      content_type: cmsAction.action?.includes('page') ? 'page' : 'post',
                      title: cmsAction.body?.title || cmsAction.title || 'Draft',
                      body: cmsAction.body?.content || cmsAction.body?.body || '',
                      slug: cmsAction.body?.slug || cmsAction.slug,
                      excerpt: cmsAction.body?.excerpt,
                      meta_title: cmsAction.body?.meta_title,
                      meta_description: cmsAction.body?.meta_description,
                      tags: cmsAction.body?.tags,
                      category: cmsAction.body?.category,
                      author_name: cmsAction.body?.author_name,
                    };

                    const funcResponse = await fetch(`${SUPABASE_URL}/functions/v1/cms-push-draft`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify(pushBody),
                    });

                    const funcResult = await funcResponse.json().catch(() => ({}));
                    executionResults.push({
                      function: 'cms-push-draft',
                      cms_action: cmsAction.action,
                      target: cmsAction.body?.title || 'draft',
                      status: funcResponse.ok && funcResult.success ? 'success' : 'error',
                      http_status: funcResponse.status,
                      result: funcResult,
                    });
                    if (!funcResponse.ok || !funcResult.success) {
                      phaseErrors.push({ phase, function: 'cms-push-draft', severity: 'degraded', message: `Draft push failed: ${funcResult.error || funcResponse.status}`, retryable: true });
                      executionSuccess = false;
                    }
                  } catch (actionErr) {
                    executionResults.push({
                      function: 'cms-push-draft',
                      cms_action: cmsAction.action,
                      status: 'error',
                      detail: actionErr instanceof Error ? actionErr.message : String(actionErr),
                    });
                    phaseErrors.push({ phase, function: 'cms-push-draft', severity: 'degraded', message: actionErr instanceof Error ? actionErr.message : 'unknown', retryable: true });
                    executionSuccess = false;
                  }
                }
                continue;
              } else if (funcName === 'cms-patch-content' && Array.isArray(decision.action.payload?.patch_actions)) {
                // ── CMS Patch Content: partial content updates on existing pages ──
                const MAX_PATCH_ACTIONS = 10;
                const patchActions = decision.action.payload.patch_actions.slice(0, MAX_PATCH_ACTIONS);
                console.log(`[AutopilotEngine] Executing ${patchActions.length} CMS patch-content actions for ${site.domain}`);

                for (const patchAction of patchActions) {
                  try {
                    const patches = patchAction.patches || [{
                      zone: patchAction.zone || 'body_section',
                      action: 'replace',
                      value: patchAction.body?.content || patchAction.value || '',
                      old_value: patchAction.body?.old_value || patchAction.old_value,
                    }];

                    const patchBody = {
                      tracked_site_id: config.tracked_site_id,
                      target_url: patchAction.target_url || patchAction.url || `https://${site.domain}`,
                      cms_post_id: patchAction.cms_post_id,
                      patches,
                    };

                    const funcResponse = await fetch(`${SUPABASE_URL}/functions/v1/cms-patch-content`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify(patchBody),
                    });

                    const funcResult = await funcResponse.json().catch(() => ({}));
                    executionResults.push({
                      function: 'cms-patch-content',
                      target_url: patchBody.target_url,
                      status: funcResponse.ok && funcResult.success ? 'success' : 'error',
                      patches_applied: funcResult.patches_applied,
                      patches_failed: funcResult.patches_failed,
                      result: funcResult,
                    });
                    if (!funcResponse.ok || !funcResult.success) {
                      phaseErrors.push({ phase, function: 'cms-patch-content', severity: 'degraded', message: `Patch failed: ${funcResult.error || funcResponse.status}`, retryable: true });
                      executionSuccess = false;
                    }
                  } catch (actionErr) {
                    executionResults.push({
                      function: 'cms-patch-content',
                      status: 'error',
                      detail: actionErr instanceof Error ? actionErr.message : String(actionErr),
                    });
                    phaseErrors.push({ phase, function: 'cms-patch-content', severity: 'degraded', message: actionErr instanceof Error ? actionErr.message : 'unknown', retryable: true });
                    executionSuccess = false;
                  }
                }
                continue;
              } else if (funcName === 'cms-push-redirect' && Array.isArray(decision.action.payload?.redirect_actions)) {
                // ── CMS Redirect: create/delete redirections via CMS API ──
                const redirectActions = decision.action.payload.redirect_actions.slice(0, 10);
                for (const rAction of redirectActions) {
                  try {
                    const redirectBody = {
                      tracked_site_id: config.tracked_site_id,
                      action: rAction.action === 'delete-redirect' ? 'delete' : 'create',
                      from: rAction.from || rAction.source_url,
                      to: rAction.to || rAction.target_url,
                      type: rAction.redirect_type || 301,
                      redirect_id: rAction.redirect_id,
                    };

                    const funcResponse = await fetch(`${SUPABASE_URL}/functions/v1/cms-push-redirect`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                        'x-autopilot-user-id': config.user_id,
                      },
                      body: JSON.stringify(redirectBody),
                      signal: AbortSignal.timeout(30000),
                    });

                    const funcResult = await funcResponse.json().catch(() => ({}));
                    executionResults.push({
                      function: 'cms-push-redirect',
                      from: redirectBody.from,
                      to: redirectBody.to,
                      status: funcResponse.ok && funcResult.success ? 'success' : 'error',
                      detail: funcResult.error || funcResult.platform,
                    });
                  } catch (actionErr) {
                    executionResults.push({
                      function: 'cms-push-redirect',
                      status: 'error',
                      detail: actionErr instanceof Error ? actionErr.message : String(actionErr),
                    });
                    phaseErrors.push({ phase, function: 'cms-push-redirect', severity: 'ignorable', message: actionErr instanceof Error ? actionErr.message : 'unknown', retryable: false });
                    executionSuccess = false;
                  }
                }
                continue;
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
                if (!funcResponse.ok) {
                  phaseErrors.push({ phase, function: funcName, severity: 'degraded', message: `${funcName} failed: HTTP ${funcResponse.status}`, retryable: true });
                  executionSuccess = false;
                }

                // ── Auto-push generated code to CMS via cms-push-code ──
                if (funcName === 'generate-corrective-code' && funcResponse.ok && funcResult.success && funcResult.code) {
                  console.log(`[AutopilotEngine] Auto-pushing corrective code to CMS for ${site.domain}`);
                  try {
                    const pushCodeBody = {
                      tracked_site_id: config.tracked_site_id,
                      code: funcResult.code,
                      code_minified: funcResult.codeMinified || funcResult.code,
                      label: `Autopilot Cycle #${cycleNumber} (${funcResult.fixesApplied || 0} fixes)`,
                      placement: 'footer',
                      fixes_summary: funcResult.fixesSummary || [],
                    };

                    const pushResp = await fetch(`${SUPABASE_URL}/functions/v1/cms-push-code`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify(pushCodeBody),
                    });

                    const pushResult = await pushResp.json().catch(() => ({}));
                    executionResults.push({
                      function: 'cms-push-code',
                      triggered_by: 'generate-corrective-code',
                      status: pushResp.ok && pushResult.success ? 'success' : 'error',
                      http_status: pushResp.status,
                      platform: pushResult.platform || 'unknown',
                      method: pushResult.method || 'unknown',
                      result: pushResult,
                    });
                    if (pushResp.ok && pushResult.success) {
                      console.log(`[AutopilotEngine] Code pushed to ${pushResult.platform} via ${pushResult.method}`);
                    } else {
                      console.warn(`[AutopilotEngine] cms-push-code failed for ${site.domain}: ${pushResult.detail || pushResult.error}`);
                      // Don't fail the whole pipeline for code push failure
                    }
                  } catch (pushErr) {
                    console.warn(`[AutopilotEngine] cms-push-code error for ${site.domain}:`, pushErr);
                    // Non-blocking: code was generated successfully, push is a bonus
                  }
                }
              }
            } catch (e) {
              executionResults.push({ function: funcName, status: 'error', error: e instanceof Error ? e.message : 'unknown' });
              phaseErrors.push({ phase, function: funcName, severity: 'degraded', message: e instanceof Error ? e.message : 'unknown', retryable: false });
              executionSuccess = false;
            }
          }
        }

          // ═══ Collect phase errors into cycle-level array ═══
          allPhaseErrors.push(...phaseErrors);

          // ═══ POST-EXECUTE: Mark workbench items as consumed_by_content ═══
          if (phase === 'execute' && executionSuccess) {
            try {
              const contentActions = executionResults.filter(
                (r: any) => r.status === 'success' && (
                  r.cms_action === 'create-post' || r.cms_action === 'update-post' ||
                  r.cms_action === 'update-page' || r.cms_action === 'create-page' ||
                  r.function === 'content-architecture-advisor' || r.function === 'cms-push-draft'
                )
              );
              if (contentActions.length > 0) {
                const { data: markedItems, error: markErr } = await supabase
                  .from('architect_workbench')
                  .update({
                    consumed_by_content: true,
                    consumed_at: new Date().toISOString(),
                    status: 'in_progress' as any,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('domain', site.domain)
                  .eq('status', 'pending')
                  .in('finding_category', ['missing_page', 'content_gap', 'content_upgrade', 'missing_terms'])
                  .select('id');

                if (markedItems && markedItems.length > 0) {
                  console.log(`[AutopilotEngine] ✅ Marked ${markedItems.length} workbench items as consumed_by_content for ${site.domain}`);
                }
                if (markErr) console.warn('[AutopilotEngine] consumed_by_content mark error:', markErr.message);
              }
            } catch (markE) {
              console.warn('[AutopilotEngine] consumed_by_content exception:', markE);
            }
          }

          // ═══ Store execution results in decision log (CRITICAL for pipeline progression) ═══
          const phaseStatus = config.implementation_mode === 'dry_run' ? 'dry_run' 
            : phaseErrors.some(e => e.severity === 'critical') ? 'failed'
            : phaseErrors.some(e => e.severity === 'degraded') ? 'degraded'
            : executionSuccess ? 'completed' : 'partial';
          
          await supabase
            .from('parmenion_decision_log')
            .update({
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
            })
            .eq('id', lastDecisionId);

          allPhaseResults.push({ phase, decision_id: lastDecisionId!, status: phaseStatus, executionResults });

          // Log each phase in modification registry
          await supabase.from('autopilot_modification_log').insert({
            tracked_site_id: config.tracked_site_id,
            config_id: config.id,
            user_id: config.user_id,
            phase: pipelinePhase,
            action_type: decision.goal?.type || 'auto',
            page_url: decision.tactic?.target_url || null,
            cycle_number: cycleNumber,
            description: `[${pipelinePhase.toUpperCase()}] ${decision.summary || decision.goal?.description || `Cycle #${cycleNumber}`}`,
            diff_before: decision.tactic?.initial_scope || {},
            diff_after: { execution: executionResults, decision: decision.prudence, errors: phaseErrors },
            status: config.implementation_mode === 'dry_run' ? 'dry_run' : phaseStatus,
          });

          if (phaseErrors.some(e => e.severity === 'critical')) {
            console.error(`[AutopilotEngine] Phase ${phase} had CRITICAL errors, stopping pipeline for ${site.domain}`);
            hasCriticalError = true;
            cycleSuccess = false;
            break;
          } else if (phaseErrors.length > 0) {
            console.warn(`[AutopilotEngine] Phase ${phase} had ${phaseErrors.length} non-critical errors, continuing pipeline for ${site.domain}`);
          }

          console.log(`[AutopilotEngine] Phase ${phase} completed for ${site.domain} (status: ${phaseStatus})`);
        } // end phase loop

        // ═══ Update config counters (once per full cycle) ═══
        const finalCycleStatus: CycleStatus = hasCriticalError ? 'failed' : computeCycleStatus(allPhaseErrors);

        await supabase
          .from('autopilot_configs')
          .update({
            status: finalCycleStatus === 'failed' ? 'error' : 'idle',
            total_cycles_run: cycleNumber,
            last_cycle_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            // force_content_cycle stays true by default (proactive mode)
            // Only reset force_iktracker_article which is a one-shot toggle
            force_iktracker_article: finalCycleStatus !== 'failed' ? false : config.force_iktracker_article,
          })
          .eq('id', config.id);

        // ═══ Observability: structured cycle summary ═══
        console.log(JSON.stringify({
          event: 'cycle_complete',
          domain: site.domain,
          cycle: cycleNumber,
          status: finalCycleStatus,
          phases_completed: allPhaseResults.length,
          phases: allPhaseResults.map(r => ({
            phase: r.phase,
            status: r.status,
            errors: r.executionResults.filter((e: any) => e.status === 'error').length,
          })),
          total_errors: allPhaseErrors.length,
          error_breakdown: {
            critical: allPhaseErrors.filter(e => e.severity === 'critical').length,
            degraded: allPhaseErrors.filter(e => e.severity === 'degraded').length,
            ignorable: allPhaseErrors.filter(e => e.severity === 'ignorable').length,
          },
          duration_ms: Date.now() - cycleStartTime,
          articles_created: allPhaseResults
            .flatMap(r => r.executionResults)
            .filter((e: any) => e.cms_action === 'create-post' && e.status === 'success').length,
        }));

        // ═══ Push final event to IKtracker ═══
        await pushIktrackerEvent(supabase, {
          trackedSiteId: config.tracked_site_id,
          userId: config.user_id,
          domain: site.domain,
          cycleNumber,
          pipelinePhase: lastPipelinePhase,
          finalStatus: finalCycleStatus,
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
          site_id: config.tracked_site_id,
          domain: site.domain,
          status: finalCycleStatus,
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