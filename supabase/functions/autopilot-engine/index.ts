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

        // ═══ FULL PIPELINE: Loop through ALL phases in a single cycle ═══
        // 'route' is handled inline after 'prescribe', not as a separate orchestrator call
        const PIPELINE_PHASES = ['audit', 'diagnose', 'prescribe', 'execute', 'validate'] as const;
        let cycleSuccess = true;
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

            cycleSuccess = false;
            break; // Stop pipeline on error but don't skip the whole site
          }

          const decision = orchestratorResult.decision;
          const pipelinePhase = orchestratorResult.pipeline_phase || phase;
          lastDecisionId = orchestratorResult.decision_id;
          lastPipelinePhase = pipelinePhase;
          lastDecision = decision;

          // ═══ Execute decided functions & capture results ═══
          let executionSuccess = true;
          const executionResults: any[] = [];

        // ═══ INLINE ROUTING: After prescribe, detect V2 structured payload ═══
        if (phase === 'prescribe') {
          const payload = decision.action?.payload || {};
          
          if (payload._prescribe_v2) {
            // V2: Tool calls already structured with _channel tags
            const allCmsActions = payload.cms_actions || [];
            const allFixes = payload.fixes || [];
            
            routedCmsActions = {
              content: allCmsActions.filter((a: any) => a._channel === 'content_corrective' || a._channel === 'content_editorial'),
              code: allCmsActions.filter((a: any) => a._channel === 'data'),
              all: allCmsActions,
            };
            
            console.log(`[AutopilotEngine] Prescribe V2: ${allFixes?.length || 0} code fixes + ${routedCmsActions.content.length} content + ${routedCmsActions.code.length} data CMS actions`);
            
            allPhaseResults.push({ phase: 'route', decision_id: lastDecisionId || 'inline', status: 'completed', executionResults: [{
              function: 'prescribe-v2-router',
              status: 'success',
              code_fixes: allFixes?.length || 0,
              content_actions: routedCmsActions.content.length,
              data_actions: routedCmsActions.code.length,
              total_cms: allCmsActions.length,
            }] });
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
            console.log(`[AutopilotEngine] No CMS actions available for ${site.domain}, building fallback from recommendations`);
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
                  const isContent = ['contenu', 'content', 'content_gap', 'thin_content', 'eeat', 'autorité', 'identité', 'social'].includes(cat);

                  if (isMeta) {
                    let pageKey = '/';
                    try { pageKey = reco.url ? new URL(reco.url).pathname.replace(/^\/|\/$/g, '') || '/' : '/'; } catch {}
                    fallbackCmsActions.push({
                      action: 'update-page',
                      page_key: pageKey,
                      updates: {
                        meta_description: reco.fix_data?.meta_description || (reco.description || reco.title || '').slice(0, 155),
                        ...(reco.fix_data?.meta_title ? { meta_title: reco.fix_data.meta_title } : {}),
                      },
                    });
                  } else if (isContent) {
                    const slug = (reco.title || 'article')
                      .toLowerCase()
                      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-|-$/g, '')
                      .slice(0, 60);
                    fallbackCmsActions.push({
                      action: 'create-post',
                      body: {
                        title: reco.title,
                        slug,
                        content: `<p>${reco.description || reco.prompt_summary || ''}</p>`,
                        excerpt: (reco.description || '').slice(0, 200),
                        status: 'draft',
                        meta_description: (reco.description || '').slice(0, 155),
                        author_name: 'Équipe IKtracker',
                        category: 'Guides',
                      },
                    });
                  }
                }

                if (fallbackCmsActions.length > 0) {
                  decision.action.payload.cms_actions = fallbackCmsActions;
                  console.log(`[AutopilotEngine] Fallback: built ${fallbackCmsActions.length} CMS actions from recommendations for ${site.domain}`);
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

        if (config.implementation_mode !== 'dry_run' && decision.action?.functions?.length > 0) {
          for (const funcName of decision.action.functions) {
            try {
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
                    const inferredAction = cmsAction.action
                      || (cmsAction.body ? 'create-post' : null)
                      || (cmsAction.updates && cmsAction.slug ? 'update-post' : null)
                      || (cmsAction.updates && cmsAction.page_key ? 'update-page' : null)
                      || 'list-posts';

                    if (!cmsAction.action) {
                      console.warn(`[AutopilotEngine] CMS action missing 'action' field, inferred: ${inferredAction}`);
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
                  if (!rerouteResponse.ok) executionSuccess = false;
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
                // ── Special handling for content-architecture-advisor: needs auth header ──
                const payload = decision.action.payload || {};
                const funcBody = {
                  url: payload.url || `https://${site.domain}`,
                  keyword: payload.keyword || payload.target_keyword || 'SEO',
                  page_type: payload.page_type || 'article',
                  tracked_site_id: config.tracked_site_id,
                  language_code: payload.language_code || 'fr',
                  location_code: payload.location_code || 2250,
                  // Multi-objective fields
                  ...(payload.strategic_objectives && { strategic_objectives: payload.strategic_objectives }),
                  ...(payload.target_internal_links && { target_internal_links: payload.target_internal_links }),
                  ...(payload.cannibalization_data && { cannibalization_data: payload.cannibalization_data }),
                  ...(payload.silo_context && { silo_context: payload.silo_context }),
                };

                console.log(`[AutopilotEngine] Calling content-architecture-advisor for ${site.domain}, keyword: ${funcBody.keyword}`);

                const funcResponse = await fetch(`${SUPABASE_URL}/functions/v1/content-architecture-advisor`, {
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
                  keyword: funcBody.keyword,
                  result: funcResult,
                });
                if (!funcResponse.ok) executionSuccess = false;
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
                    if (!funcResponse.ok || !funcResult.success) executionSuccess = false;
                  } catch (actionErr) {
                    executionResults.push({
                      function: 'cms-push-draft',
                      cms_action: cmsAction.action,
                      status: 'error',
                      detail: actionErr instanceof Error ? actionErr.message : String(actionErr),
                    });
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
                    if (!funcResponse.ok || !funcResult.success) executionSuccess = false;
                  } catch (actionErr) {
                    executionResults.push({
                      function: 'cms-patch-content',
                      status: 'error',
                      detail: actionErr instanceof Error ? actionErr.message : String(actionErr),
                    });
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
                if (!funcResponse.ok) executionSuccess = false;

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
              executionSuccess = false;
            }
          }
        }

          // ═══ Store execution results in decision log (CRITICAL for pipeline progression) ═══
          const phaseStatus = config.implementation_mode === 'dry_run' ? 'dry_run' : executionSuccess ? 'completed' : 'partial';
          
          await supabase
            .from('parmenion_decision_log')
            .update({
              status: phaseStatus,
              execution_started_at: new Date().toISOString(),
              execution_completed_at: new Date().toISOString(),
              execution_results: executionResults,
              execution_error: executionSuccess ? null : JSON.stringify(executionResults.filter(r => r.status === 'error')),
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
            diff_after: { execution: executionResults, decision: decision.prudence },
            status: config.implementation_mode === 'dry_run' ? 'dry_run' : executionSuccess ? 'applied' : 'failed',
          });

          if (!executionSuccess) {
            console.warn(`[AutopilotEngine] Phase ${phase} had errors, stopping pipeline for ${site.domain}`);
            cycleSuccess = false;
            break;
          }

          console.log(`[AutopilotEngine] Phase ${phase} completed successfully for ${site.domain}`);
        } // end phase loop

        // ═══ Update config counters (once per full cycle) ═══
        const finalCycleStatus = cycleSuccess ? 'completed' : 'partial';

        await supabase
          .from('autopilot_configs')
          .update({
            status: cycleSuccess ? 'idle' : 'error',
            total_cycles_run: cycleNumber,
            last_cycle_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', config.id);

        // ═══ Push final event to IKtracker ═══
        await pushIktrackerEvent(supabase, {
          trackedSiteId: config.tracked_site_id,
          userId: config.user_id,
          domain: site.domain,
          cycleNumber,
          pipelinePhase: lastPipelinePhase,
          finalStatus: finalCycleStatus,
          executionSuccess: cycleSuccess,
          message: `[Cycle #${cycleNumber} COMPLET] ${allPhaseResults.length} phases — ${lastDecision?.summary || lastPipelinePhase}`,
          targetUrl: lastDecision?.tactic?.target_url || null,
          functions: lastDecision?.action?.functions || [],
          details: {
            phases_completed: allPhaseResults.map(r => r.phase),
            decision_ids: allPhaseResults.map(r => r.decision_id),
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
