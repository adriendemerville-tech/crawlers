import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { buildContentBrief, briefToPromptBlock, detectPageType as sharedDetectPageType, computeArticleDistribution, determineSemanticRing, buildDiversityPromptBlock, detectArticleType, type ArticleDistribution, type SemanticRing } from '../_shared/contentBrief.ts';
import { getSiteContext } from '../_shared/getSiteContext.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { scanCmsContent, type CmsContentInventory } from '../_shared/cmsContentScanner.ts';
import { isIktrackerDomain, normalizePageKey } from '../_shared/domainUtils.ts';
import { computeSeoScoreV2, extractTextContent, type SeoScoreV2, type BusinessProfile } from '../_shared/seoScoringV2.ts';

// ═══ Modular imports ═══
import {
  MAX_RISK_NORMAL, MAX_RISK_CONSERVATIVE,
  PIPELINE_PHASES, PHASE_FUNCTIONS, TIER_NAMES,
  getNextPhase,
  type PipelinePhase, type ParmenionDecision, type ScoredWorkbenchItem, type SiteInfo as ParmenionSiteInfo, type ActionReliability,
} from '../_shared/parmenion/types.ts';
import { TECH_TOOLS, CONTENT_TOOLS, DECISION_TOOL } from '../_shared/parmenion/toolSchemas.ts';
import { buildPhaseInstructions } from '../_shared/parmenion/prompts.ts';
import { enrichKeywordsForPrescribe } from '../_shared/parmenion/keywordEnrichment.ts';
import { callLLMWithTools } from '../_shared/parmenion/llmClient.ts';
import { runEditorialPipeline, type ContentType } from '../_shared/editorialPipeline.ts';
import { loadPersonaRotation, buildPersonaPromptBlock, recordPersonaServed } from '../_shared/parmenion/personaEngine.ts';

/**
 * Parménion — Orchestrateur stratégique autonome pour Autopilot
 * 
 * Pipeline obligatoire en 5 phases:
 *   1. AUDIT: audit-expert-seo (audit technique pur)
 *   2. DIAGNOSE: cocoon-diag-* (diagnostic stratégique sémantique)
 *   3. PRESCRIBE: cocoon-strategist, calculate-cocoon-logic, generate-corrective-code
 *   4. EXECUTE: wpsync (WordPress) OU iktracker-actions (IKtracker)
 *   5. VALIDATE: re-crawl ciblé, comparaison avant/après
 * 
 * Chaque cycle avance d'une phase. Parménion ne recule jamais.
 * Les résultats de chaque phase alimentent la suivante.
 */

// Constants, types, and helpers now imported from _shared/parmenion/ and _shared/domainUtils.ts

/** Normalize a page_key from LLM output — delegates to shared normalizePageKey */
function sanitizePageKey(raw?: string | null): string {
  return normalizePageKey(raw) || 'homepage';
}

const detectPageType = sharedDetectPageType;

Deno.serve(handleRequest(async (req: Request) => {
try {
    const authHeader = req.headers.get('Authorization') || '';
    const isServiceRole = authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '___none___');
    
    let authUserId: string | null = null;
    if (!isServiceRole) {
      const auth = await getAuthenticatedUser(req);
      if (!auth) return jsonError('Unauthorized', 401);
      if (!auth.isAdmin) return jsonError('Admin only', 403);
      authUserId = auth.userId;
    }

    const { tracked_site_id, domain, cycle_number = 1, user_id: bodyUserId, forced_phase, force_content_cycle, content_budget_pct, force_iktracker_article } = await req.json();
    if (!tracked_site_id || !domain) {
      return jsonError('tracked_site_id and domain required', 400);
    }

    const supabase = getServiceClient();
    const isIktracker = isIktrackerDomain(domain);

    // ═══ PHASE 0: Determine current pipeline phase ═══
    const { data: lastCompletedDecisions } = await supabase
      .from('parmenion_decision_log')
      .select('pipeline_phase, status, execution_results, goal_type, goal_description, action_type, functions_called, execution_error, created_at')
      .eq('domain', domain)
      .in('status', ['completed', 'dry_run'])
      .order('created_at', { ascending: false })
      .limit(10);

    const lastPhase = (lastCompletedDecisions || [])[0]?.pipeline_phase as PipelinePhase | undefined;
    // Use forced_phase from engine if provided, otherwise auto-detect
    let currentPhase = (forced_phase && PIPELINE_PHASES.includes(forced_phase)) 
      ? (forced_phase as PipelinePhase) 
      : getNextPhase(lastPhase);

    // ═══ SKIP AUDIT: If workbench already has fresh agent-seo findings, skip audit → prescribe ═══
    if (currentPhase === 'audit') {
      const { data: agentSeoItems, error: skipErr } = await supabase
        .from('architect_workbench')
        .select('id, source_function, created_at')
        .eq('domain', domain)
        .eq('source_function', 'agent-seo')
        .in('status', ['pending', 'in_progress'])
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);
      
      if (!skipErr && agentSeoItems && agentSeoItems.length > 0) {
        console.log(`[Parménion] ⏭️ Skipping audit — ${agentSeoItems.length}+ fresh workbench items from agent-seo found, jumping to prescribe`);
        currentPhase = 'prescribe';
      }
    }

    let baselineSeoScore: SeoScoreV2 | null = null;
    console.log(`[Parménion] Domain: ${domain}, Cycle: ${cycle_number}, Phase: ${currentPhase}, LastPhase: ${lastPhase || 'none'}, IKtracker: ${isIktracker}`);

    // ═══ PHASE 1: Segmented feedback — Check error rate by action type ═══
    const { data: errorRateData } = await supabase.rpc('parmenion_error_rate', { p_domain: domain });
    
    // Segmented reliability: track error rates per action_type for smarter gating
    const { data: segmentedFeedback } = await supabase
      .from('parmenion_decision_log')
      .select('action_type, is_error, status, impact_predicted, impact_actual')
      .eq('domain', domain)
      .in('status', ['completed'])
      .not('action_type', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);
    
    // Build per-action-type reliability scores
    const actionReliability: Record<string, { total: number; errors: number; rate: number }> = {};
    if (segmentedFeedback) {
      for (const entry of segmentedFeedback) {
        const at = entry.action_type || 'unknown';
        if (!actionReliability[at]) actionReliability[at] = { total: 0, errors: 0, rate: 0 };
        actionReliability[at].total++;
        if (entry.is_error) actionReliability[at].errors++;
      }
      for (const [key, val] of Object.entries(actionReliability)) {
        val.rate = val.total > 0 ? Math.round((val.errors / val.total) * 100) : 0;
      }
    }
    
    // Conservative mode: triggered if overall error rate > 20% OR if current phase's action types are unreliable
    const overallConservative = errorRateData?.conservative_mode === true;
    const phaseActionTypes = currentPhase === 'execute' ? ['code_fix', 'content_push', 'redirect'] : [];
    const phaseUnreliable = phaseActionTypes.some(at => (actionReliability[at]?.rate || 0) > 30);
    const conservativeMode = overallConservative || phaseUnreliable;
    const maxRisk = conservativeMode ? MAX_RISK_CONSERVATIVE : MAX_RISK_NORMAL;
    
    console.log(`[Parménion] Segmented feedback: ${JSON.stringify(actionReliability)}, conservative: ${conservativeMode}`);

    // ═══ PHASE 2: Gather context ═══
    const [diagnosticsRes, cocoonRes, errorsRes, recoRegistryRes, auditRawRes, siteKeywordsRes, siteInfoRes, identityCard, kwUniverseRes] = await Promise.all([
      supabase.from('cocoon_diagnostic_results')
        .select('diagnostic_type, scores, findings, created_at')
        .eq('tracked_site_id', tracked_site_id)
        .order('created_at', { ascending: false })
        .limit(4),
      supabase.from('cocoon_sessions')
        .select('cluster_summary, nodes_count, clusters_count, intent_distribution, avg_geo_score, avg_eeat_score, avg_content_gap, avg_cannibalization_risk')
        .eq('tracked_site_id', tracked_site_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.rpc('parmenion_recent_errors', { p_domain: domain }),
      supabase.from('audit_recommendations_registry')
        .select('title, category, priority, fix_type, fix_data, is_resolved')
        .eq('domain', domain)
        .eq('is_resolved', false)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('audit_raw_data')
        .select('audit_type, raw_payload, source_functions, created_at')
        .eq('domain', domain)
        .order('created_at', { ascending: false })
        .limit(3),
      supabase.from('domain_data_cache')
        .select('result_data')
        .eq('domain', domain)
        .eq('data_type', 'serp_kpis')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('tracked_sites')
        .select('site_name, market_sector, business_type, client_targets, site_context')
        .eq('id', tracked_site_id)
        .maybeSingle(),
      getSiteContext(supabase, { trackedSiteId: tracked_site_id }),
      // ═══ P4: Read keyword_universe SSOT for diversified keywords ═══
      supabase.from('keyword_universe')
        .select('keyword, search_volume, current_position, opportunity_score, intent')
        .eq('domain', domain)
        .order('opportunity_score', { ascending: false })
        .limit(50),
    ]);

    const diagnostics = diagnosticsRes.data || [];
    const cocoon = cocoonRes.data;
    const pastErrors = errorsRes.data || [];
    const pendingRecommendations = recoRegistryRes.data || [];
    const rawAuditData = auditRawRes.data || [];

    // ═══ P4: Merge keyword_universe into siteKeywords (SSOT priority) ═══
    const siteKeywords: string[] = [];
    const kwUniverseData = kwUniverseRes.data || [];
    
    // First: keyword_universe keywords (SSOT, highest priority)
    for (const kw of kwUniverseData) {
      if (kw.keyword && !siteKeywords.includes(kw.keyword)) {
        siteKeywords.push(kw.keyword);
      }
    }
    
    // Then: legacy SERP KPI keywords (fallback)
    const serpKpis = (siteKeywordsRes as any)?.data?.result_data;
    if (serpKpis?.sample_keywords) {
      for (const kw of serpKpis.sample_keywords) {
        if (kw.keyword && !siteKeywords.includes(kw.keyword)) siteKeywords.push(kw.keyword);
      }
    }
    const siteInfo = (siteInfoRes as any)?.data || null;
    // Enrich siteInfo with identity card fields (auto-enriched via getSiteContext)
    if (identityCard) {
      if (!siteInfo) {
        // fallback: use identity card as siteInfo
      }
      // Merge identity card into siteInfo for downstream use
      const enrichedSiteInfo = {
        ...(siteInfo || {}),
        market_sector: identityCard.market_sector || siteInfo?.market_sector,
        entity_type: identityCard.entity_type || siteInfo?.business_type,
        commercial_model: identityCard.commercial_model,
        target_audience: identityCard.target_audience,
        products_services: identityCard.products_services,
        commercial_area: identityCard.commercial_area,
        identity_confidence: identityCard.identity_confidence,
      };
      Object.assign(siteInfo || {}, enrichedSiteInfo);
    }

    const previousPhaseResults = (lastCompletedDecisions || [])
      .filter(d => d.execution_results)
      .slice(0, 5)
      .map(d => ({
        phase: d.pipeline_phase,
        goal: d.goal_description,
        functions: d.functions_called,
        results: d.execution_results,
      }));

    // ═══ PRE-SCORE: Fast deterministic page scoring (0 LLM tokens) ═══
    if (currentPhase === 'audit' || currentPhase === 'prescribe') {
      try {
        const targetUrl = `https://${domain}`;
        const fetchRes = await fetch(targetUrl, {
          headers: { 'User-Agent': 'CrawlersBot/1.0 (SEO Audit)' },
          signal: AbortSignal.timeout(8000),
        });
        if (fetchRes.ok) {
          const html = await fetchRes.text();
          const textContent = extractTextContent(html);
          // Map tracked_sites.business_type to BusinessProfile
          const bizType = (siteInfo?.business_type || siteInfo?.entity_type || '').toLowerCase();
          const businessProfile: BusinessProfile = 
            bizType.includes('ecommerce') || bizType.includes('boutique') || bizType.includes('shop') ? 'ecommerce' :
            bizType.includes('local') || bizType.includes('artisan') || bizType.includes('restaurant') || bizType.includes('commerce') || bizType.includes('cabinet') || bizType.includes('médecin') || bizType.includes('avocat') || bizType.includes('plombier') || bizType.includes('boulang') ? 'local_business' :
            bizType.includes('saas') || bizType.includes('logiciel') || bizType.includes('software') || bizType.includes('app') ? 'saas' :
            bizType.includes('media') || bizType.includes('presse') || bizType.includes('blog') || bizType.includes('journal') ? 'media' :
            bizType.includes('agence') || bizType.includes('agency') || bizType.includes('consultant') ? 'agency' :
            'generic';
          baselineSeoScore = computeSeoScoreV2(html, textContent, {
            pageType: 'landing',
            businessProfile,
            customKeywords: siteKeywords.length > 0 ? siteKeywords.slice(0, 15) : undefined,
          });
          console.log(`[Parménion] 📐 Profile: ${businessProfile} | Baseline SEO: ${baselineSeoScore.overall}/100`);
          console.log(`[Parménion] 📐 Axes: content_depth=${baselineSeoScore.axes.content_depth} heading=${baselineSeoScore.axes.heading_structure} keywords=${baselineSeoScore.axes.keyword_relevance} linking=${baselineSeoScore.axes.internal_linking} meta=${baselineSeoScore.axes.meta_quality} eeat=${baselineSeoScore.axes.eeat_signals}`);
        }
      } catch (e) {
        console.warn('[Parménion] Pre-score fetch failed (non-blocking):', e instanceof Error ? e.message : e);
      }
    }

    // ═══ PHASE 2b: DUAL-LANE ALGORITHMIC SCORING (prescribe phase) ═══
    let scoredWorkbenchItems: any[] = [];
    // PROACTIVE MODE: Always force content if not explicitly disabled — Parménion must always find something to do
    const forceContent = force_content_cycle === true || force_iktracker_article === true;
    const budgetPct = typeof content_budget_pct === 'number' ? content_budget_pct : (force_iktracker_article ? 50 : 30);
    
    if (currentPhase === 'prescribe') {
      const userId = authUserId || bodyUserId || tracked_site_id;
      
      // Option B: Query BOTH lanes independently in parallel via Breathing Spiral scoring
      const [techRes, contentRes] = await Promise.all([
        supabase.rpc('score_spiral_priority', {
          p_domain: domain,
          p_user_id: userId,
          p_limit: 8,
          p_lane: 'tech',
          p_exclude_assigned: false,
        }),
        supabase.rpc('score_spiral_priority', {
          p_domain: domain,
          p_user_id: userId,
          p_limit: 8,
          p_lane: 'content',
          p_exclude_assigned: false,
        }),
      ]);
      
      if (techRes.error) console.warn('[Parménion] Tech lane scoring failed:', techRes.error.message);
      if (contentRes.error) console.warn('[Parménion] Content lane scoring failed:', contentRes.error.message);
      
      const techItems = techRes.data || [];
      const contentItems = contentRes.data || [];
      
      // Option A: Budget partagé — allocate items proportionally
      // Default: 70% tech budget, 30% content budget (configurable via content_budget_pct)
      const totalSlots = 8;
      const contentSlots = forceContent 
        ? totalSlots  // Option D: force content → all slots to content
        : Math.max(2, Math.round(totalSlots * budgetPct / 100));
      const techSlots = forceContent ? 0 : totalSlots - contentSlots;
      
      const allocatedTech = techItems.slice(0, techSlots);
      const allocatedContent = contentItems.slice(0, contentSlots);
      scoredWorkbenchItems = [...allocatedTech, ...allocatedContent];
      
      console.log(`[Parménion] 📊 Dual-lane scoring: ${allocatedTech.length}/${techItems.length} tech (${techSlots} slots) + ${allocatedContent.length}/${contentItems.length} content (${contentSlots} slots). Force content: ${forceContent}, Budget: ${budgetPct}%`);
      if (scoredWorkbenchItems.length > 0) {
        console.log(`[Parménion] 📊 Top tech: tier ${allocatedTech[0]?.tier ?? 'none'} spiral_score ${allocatedTech[0]?.spiral_score ?? 0} | Top content: tier ${allocatedContent[0]?.tier ?? 'none'} spiral_score ${allocatedContent[0]?.spiral_score ?? 0}`);
      }
    }

    // ═══ PHASE 3: LLM Decision ═══
    let decision: ParmenionDecision | null = null;
    
    if (currentPhase === 'prescribe') {
      // ═══ PRESCRIBE V2: 2 parallel prompts × 2 tools (with dual-lane support) ═══
      // Also triggered when force_content_cycle or force_iktracker_article is set (even with empty workbench)
      
      // If workbench is empty but content is forced, create a synthetic content item
      if (scoredWorkbenchItems.length === 0 && forceContent) {
        console.log(`[Parménion] ⚠️ Workbench empty but force_content=true, creating synthetic content item`);
        // FIX: Inject full identity card context into synthetic item to prevent hallucinations
        const identitySummary = siteInfo ? [
          siteInfo.site_name && `Site: ${siteInfo.site_name}`,
          siteInfo.market_sector && `Secteur: ${siteInfo.market_sector}`,
          siteInfo.products_services && `Produits/Services: ${siteInfo.products_services}`,
          siteInfo.target_audience && `Cible: ${siteInfo.target_audience}`,
          siteInfo.commercial_area && `Zone: ${siteInfo.commercial_area}`,
          siteInfo.entity_type && `Type: ${siteInfo.entity_type}`,
          siteInfo.commercial_model && `Modèle: ${siteInfo.commercial_model}`,
        ].filter(Boolean).join('. ') : '';
        
        const syntheticKeyword = siteKeywords[0] || siteInfo?.products_services?.split(',')[0]?.trim() || domain.replace(/\.\w+$/, '');
        const syntheticDescription = identitySummary
          ? `Article de blog pertinent pour ${siteInfo?.site_name || domain}. CONTEXTE IDENTITAIRE OBLIGATOIRE: ${identitySummary}. Le contenu DOIT correspondre à cette identité.`
          : `Article de blog ou page de contenu pour renforcer l'autorité sémantique du site ${domain}`;
        
        scoredWorkbenchItems.push({
          id: '00000000-0000-0000-0000-000000000000',
          title: `Création de contenu éditorial pour ${siteInfo?.site_name || domain}`,
          description: syntheticDescription,
          finding_category: 'missing_page',
          severity: 'high',
          target_url: `https://${domain}`,
          target_selector: null,
          target_operation: 'create',
          action_type: 'content',
          payload: {
            keyword: syntheticKeyword,
            identity_context: identitySummary || null,
            market_sector: siteInfo?.market_sector || null,
            target_audience: siteInfo?.target_audience || null,
            products_services: siteInfo?.products_services || null,
          },
          source_type: 'forced_cycle',
          tier: 9,
          base_score: 75,
          severity_bonus: 100,
          aging_bonus: 0,
          gate_malus: 0,
          spiral_score: 175,
          created_at: new Date().toISOString(),
          lane: 'content',
        });
      }
      
      decision = await prescribeWithDualPrompts({
        domain,
        cycle_number,
        conservativeMode,
        maxRisk,
        scoredWorkbenchItems,
        siteKeywords,
        siteInfo,
        isIktracker,
        tracked_site_id,
        force_content: forceContent,
        force_iktracker_article: force_iktracker_article === true,
      });
      if (!decision) {
        return jsonOk({
          cycle: cycle_number,
          phase: currentPhase,
          status: 'skipped',
          reason: 'No workbench items available for prescribe phase',
          domain,
        });
      }
    } else {
      // Non-prescribe phases or empty workbench without forced content: single LLM call
      // For execute phase, scan CMS to provide inventory of existing content (avoid duplicates)
      let cmsInventory: CmsContentInventory | null = null;
      if (currentPhase === 'execute') {
        try {
          const authUserId2 = authUserId || bodyUserId || tracked_site_id;
          cmsInventory = await scanCmsContent(tracked_site_id, authUserId2);
          if (cmsInventory.items.length > 0) {
            console.log(`[Parménion] 📦 CMS inventory for execute: ${cmsInventory.items.length} items (${cmsInventory.drafts.length} drafts)`);
          }
        } catch (e) {
          console.warn('[Parménion] CMS scan failed (non-blocking):', e);
        }
      }
      decision = await askParmenionLLM({
        domain,
        cycle_number,
        currentPhase,
        conservativeMode,
        maxRisk,
        diagnostics,
        cocoon,
        pastErrors,
        previousPhaseResults,
        pendingRecommendations,
        rawAuditData,
        isIktracker,
        siteKeywords,
        siteInfo,
        scoredWorkbenchItems,
        cmsInventory,
        baselineSeoScore,
      });
    }

    if (!decision) {
      return jsonOk({ ok: false, error: 'no_decision', message: 'Parménion n\'a pas pu produire de décision. Vérifiez les crédits LLM.' });
    }

    // ═══ PHASE 4: Validate functions against phase ═══
    const allowedFunctions = [...PHASE_FUNCTIONS[currentPhase]];
    const validatedFunctions = decision.action.functions.filter((f: string) => allowedFunctions.includes(f));
    if (validatedFunctions.length === 0) {
      console.warn(`[Parménion] LLM chose invalid functions for phase ${currentPhase}:`, decision.action.functions);
      // Fallback to appropriate function for the phase
      if (currentPhase === 'audit') {
        validatedFunctions.push('audit-expert-seo', 'strategic-orchestrator', 'check-eeat');
      }
      else if (currentPhase === 'diagnose') validatedFunctions.push('cocoon-diag-content');
      else if (currentPhase === 'prescribe') {
        // Force content if force_content_cycle or force_iktracker_article
        if (forceContent) {
          validatedFunctions.push('content-architecture-advisor');
        } else if (cycle_number % 2 === 1) {
          // Alternate: odd cycles → content, even → tech
          validatedFunctions.push('content-architecture-advisor');
        } else {
          validatedFunctions.push('generate-corrective-code');
        }
      }
      else if (currentPhase === 'execute') validatedFunctions.push(isIktracker ? 'iktracker-actions' : 'wpsync');
      else if (currentPhase === 'validate') validatedFunctions.push('audit-expert-seo');
    }
    decision.action.functions = validatedFunctions;

    // ═══ PHASE 5: Persist decision ═══
    const logEntry = {
      tracked_site_id,
      user_id: authUserId || bodyUserId || tracked_site_id,
      domain,
      cycle_number,
      pipeline_phase: currentPhase,
      goal_type: decision.goal.type,
      goal_cluster_id: decision.goal.cluster_id || null,
      goal_description: decision.goal.description,
      initial_scope: decision.tactic.initial_scope,
      final_scope: decision.tactic.final_scope,
      scope_reductions: decision.tactic.scope_reductions,
      estimated_tokens: decision.tactic.estimated_tokens,
      impact_level: decision.prudence.impact_level,
      impact_predicted: decision.prudence.impact_level,
      risk_predicted: decision.prudence.risk_score,
      risk_iterations: decision.prudence.iterations,
      goal_changed: decision.prudence.goal_changed,
      action_type: decision.action.type,
      action_payload: decision.action.payload,
      functions_called: decision.action.functions,
      status: 'planned',
      spiral_score_at_decision: scoredWorkbenchItems[0]?.spiral_score ?? null,
    };

    const { data: logData, error: logError } = await supabase
      .from('parmenion_decision_log')
      .insert(logEntry)
      .select('id')
      .single();

    if (logError) {
      console.error('[Parménion] Failed to persist decision:', logError);
      return jsonOk({ ok: false, error: 'persist_failed', message: 'Échec de la persistance de la décision.' });
    }

    return jsonOk({
      decision_id: logData.id,
      decision,
      pipeline_phase: currentPhase,
      conservative_mode: conservativeMode,
      error_rate: errorRateData,
      baseline_seo_score: baselineSeoScore ? {
        overall: baselineSeoScore.overall,
        axes: baselineSeoScore.axes,
        issues_count: baselineSeoScore.issues.length,
        top_issues: baselineSeoScore.issues.slice(0, 5),
        opportunities: baselineSeoScore.opportunities.slice(0, 3),
      } : null,
    });

  } catch (e) {
    console.error('[Parménion] Error:', e);
    const msg = e instanceof Error ? e.message : 'Unknown error';
    const isCredits = msg === 'LLM_CREDITS_EXHAUSTED';
    return jsonOk({
      ok: false,
      error: isCredits ? 'credits_exhausted' : 'internal_error',
      message: isCredits ? 'Crédits LLM épuisés. Rechargez votre solde Lovable AI.' : msg,
    });
  }
}));

// ═══════════════════════════════════════════════════════════════
// PRESCRIBE V2: DUAL PROMPT ENGINE (tech + content in parallel)
// ═══════════════════════════════════════════════════════════════

const TECH_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'emit_code',
      description: 'Emit injectable JS code fix (lazy loading, CLS, performance, etc.)',
      parameters: {
        type: 'object',
        properties: {
          fix_id: { type: 'string' },
          label: { type: 'string', description: 'Short human-readable description' },
          category: { type: 'string', enum: ['performance', 'seo', 'accessibility', 'security'] },
          prompt: { type: 'string', description: 'Detailed instructions for JS code generation' },
          target_url: { type: 'string' },
          target_selector: { type: 'string', description: 'CSS selector or DOM element to target' },
        },
        required: ['fix_id', 'label', 'category', 'prompt'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'emit_corrective_data',
      description: 'Emit corrective metadata: meta_description, canonical, schema_org, robots, JSON-LD',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['update-page', 'update-post'] },
          page_key: { type: 'string', description: 'Page slug or identifier' },
          slug: { type: 'string', description: 'Post slug (for update-post)' },
          field: { type: 'string', enum: ['meta_description', 'meta_title', 'canonical_url', 'schema_org', 'robots'] },
          value: { type: 'string', description: 'New value for the field' },
          schema_org_value: { type: 'object', description: 'JSON-LD object (when field=schema_org)' },
        },
        required: ['action', 'field', 'value'],
      },
    },
  },
];

const CONTENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'emit_corrective_content',
      description: 'Emit corrective content for an existing page: fix H1, H2, enrich paragraphs, add FAQ, etc.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['update-page', 'update-post'] },
          page_key: { type: 'string' },
          slug: { type: 'string' },
          updates: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              content: { type: 'string', description: 'Markdown content to replace/append' },
              excerpt: { type: 'string' },
            },
          },
          target_selector: { type: 'string', description: 'Which section to update (e.g. h1, h2#section, content)' },
          operation: { type: 'string', enum: ['replace', 'append', 'insert_after'] },
        },
        required: ['action', 'updates'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'emit_editorial_content',
      description: 'Create a new article or page from scratch to fill a content gap',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['create-post', 'create-page'] },
          body: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              slug: { type: 'string' },
              content: { type: 'string', description: 'Full Markdown content with ## H2, ### H3, lists, internal links [ancre](url). MINIMUM 800 mots (environ 5000 caractères). Un article de qualité fait entre 800 et 1500 mots. Ne JAMAIS produire moins de 600 mots.', minLength: 3000 },
              excerpt: { type: 'string' },
              meta_description: { type: 'string' },
              meta_title: { type: 'string' },
              status: { type: 'string', enum: ['draft'] },
              author_name: { type: 'string' },
              category: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
              schema_org: { type: 'object' },
              article_type: { type: 'string', enum: ['presentation', 'actualite', 'comparatif', 'tutoriel', 'opinion', 'guide'], description: 'Type d\'article selon la taxonomie éditoriale. OBLIGATOIRE.' },
              semantic_ring: { type: 'integer', enum: [1, 2, 3], description: 'Anneau sémantique: 1=cœur de cible, 2=second cercle, 3=expansion large' },
            },
            required: ['title', 'slug', 'content', 'excerpt', 'meta_description', 'status', 'article_type', 'semantic_ring'],
          },
        },
        required: ['action', 'body'],
      },
    },
  },
];

const TIER_NAMES: Record<number, string> = {
  0: 'Accessibilité critique', 1: 'Performance', 2: 'Crawl mineur',
  3: 'Données structurées GEO', 4: 'On-page mineur (meta)',
  5: 'On-page majeur (contenu)', 6: 'Maillage interne',
  7: 'Cannibalisation', 8: 'Gap par modification',
  9: 'Gap par création', 10: 'Expansion sémantique',
};

// ═══ PAGE TYPE DETECTION ═══
// detectPageType is aliased at line 42 from sharedDetectPageType

async function loadPromptTemplates(supabase: ReturnType<typeof getServiceClient>): Promise<Map<string, any>> {
  const { data, error } = await supabase
    .from('content_prompt_templates')
    .select('*')
    .eq('is_active', true);
  
  const map = new Map<string, any>();
  if (data && !error) {
    for (const t of data) map.set(t.page_type, t);
  }
  return map;
}

function buildTemplateInstructions(template: any): string {
  if (!template) return '';
  return `
═══ TEMPLATE DE CONTENU: ${template.label.toUpperCase()} ═══

${template.system_prompt}

STRUCTURE OBLIGATOIRE:
${template.structure_template}

RÈGLES SEO:
${template.seo_rules}

RÈGLES GEO (OPTIMISATION IA GÉNÉRATIVE):
${template.geo_rules}

TON ET STYLE:
${template.tone_guidelines}

EXEMPLES DE RÉFÉRENCE:
${JSON.stringify(template.examples, null, 2)}

FRAÎCHEUR & DÉNOMINATION:
- N'utilise PAS automatiquement "Guide" dans le title, le H1, les H2, les H3, le résumé, la FAQ, les tableaux ou le corps du texte.
- Choisis l'intitulé le plus juste selon l'intention réelle : barème, simulation, comparatif, mode d'emploi, procédure, actualité, checklist, FAQ, décryptage, mise à jour, analyse, etc.
- Si une date est pertinente, elle doit être exacte et cohérente PARTOUT dans le livrable : title, H1/H2/H3, paragraphes, FAQ, tableaux, résumés, meta_title, meta_description, excerpt et schema_org.
- Si la date n'apporte rien, n'en ajoute pas artificiellement.
═══ FIN TEMPLATE ═══`;
}

// ═══ KEYWORD ENRICHMENT FOR PRESCRIBE ═══
interface KeywordEnrichment {
  promptBlock: string;
  totalKeywords: number;
  sources: string[];
}

async function enrichKeywordsForPrescribe(
  supabase: ReturnType<typeof getServiceClient>,
  domain: string,
  tracked_site_id: string,
  contentItems: any[],
): Promise<KeywordEnrichment> {
  const sources: string[] = [];
  const keywordMap = new Map<string, { volume?: number; position?: number; source: string }>();

  // 1. Extract keywords from workbench item payloads
  for (const item of contentItems) {
    if (item.payload) {
      const p = typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload;
      const kwFields = [p.keyword, p.keywords, p.target_keyword, p.suggested_keyword, p.term];
      for (const f of kwFields) {
        if (typeof f === 'string' && f.length > 1) {
          keywordMap.set(f.toLowerCase(), { source: 'workbench', volume: p.search_volume, position: p.current_rank });
        }
        if (Array.isArray(f)) {
          for (const k of f) {
            if (typeof k === 'string') keywordMap.set(k.toLowerCase(), { source: 'workbench' });
          }
        }
      }
    }
  }
  if (keywordMap.size > 0) sources.push('workbench_payload');

  // 2. Keyword rankings (current positions)
  const [rankingsRes, serpRes, auditRes] = await Promise.all([
    supabase
      .from('keyword_rankings')
      .select('keyword, position, search_volume, url')
      .eq('tracked_site_id', tracked_site_id)
      .order('position', { ascending: true })
      .limit(30),
    supabase
      .from('serpapi_cache')
      .select('query_text, organic_results, related_searches')
      .eq('tracked_site_id', tracked_site_id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('audit_raw_data')
      .select('raw_payload')
      .eq('domain', domain)
      .eq('audit_type', 'strategic')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (rankingsRes.data?.length) {
    sources.push('keyword_rankings');
    for (const r of rankingsRes.data) {
      const k = r.keyword?.toLowerCase();
      if (k) {
        const existing = keywordMap.get(k);
        keywordMap.set(k, {
          source: existing?.source ? `${existing.source}+rankings` : 'rankings',
          volume: r.search_volume ?? existing?.volume,
          position: r.position ?? existing?.position,
        });
      }
    }
  }

  // 3. SERP cache (related searches = opportunity keywords)
  if (serpRes.data?.length) {
    sources.push('serp_cache');
    for (const s of serpRes.data) {
      const related = s.related_searches;
      if (Array.isArray(related)) {
        for (const r of related) {
          const q = (r.query || r.title || '').toLowerCase();
          if (q && !keywordMap.has(q)) {
            keywordMap.set(q, { source: 'serp_related' });
          }
        }
      }
    }
  }

  // 4. Strategic audit (keyword_positioning)
  if (auditRes.data?.raw_payload) {
    const payload = auditRes.data.raw_payload as any;
    const kp = payload.keyword_positioning || payload.strategic?.keyword_positioning;
    if (kp) {
      sources.push('audit_strategic');
      const lists = [kp.high_opportunity, kp.quick_wins, kp.primary_keywords, kp.secondary_keywords];
      for (const list of lists) {
        if (Array.isArray(list)) {
          for (const item of list) {
            const k = (item.keyword || item.term || item.query || '').toLowerCase();
            if (k && !keywordMap.has(k)) {
              keywordMap.set(k, { source: 'audit_strategic', volume: item.volume, position: item.position });
            }
          }
        }
      }
    }
  }

  // Build prompt block
  if (keywordMap.size === 0) {
    return { promptBlock: '', totalKeywords: 0, sources: [] };
  }

  // FIX #1: Limit keywords from 40 to 15 to reduce prompt bloat causing 0 tool calls
  const sorted = Array.from(keywordMap.entries())
    .sort((a, b) => (b[1].volume ?? 0) - (a[1].volume ?? 0))
    .slice(0, 15);

  const kwLines = sorted.map(([kw, data]) => {
    const parts = [kw];
    if (data.volume) parts.push(`vol:${data.volume}`);
    if (data.position) parts.push(`pos:${data.position}`);
    return parts.join(' | ');
  });

  const quickWins = sorted.filter(([, d]) => d.position && d.position >= 8 && d.position <= 25);

  const promptBlock = `═══ MOTS-CLÉS STRATÉGIQUES (${keywordMap.size} identifiés, sources: ${sources.join(', ')}) ═══

MOTS-CLÉS PRIORITAIRES (à intégrer dans le contenu):
${kwLines.join('\n')}

${quickWins.length > 0 ? `🎯 QUICK WINS (positions 8-25, effort minimal pour top 10):
${quickWins.map(([kw, d]) => `- "${kw}" → position ${d.position}${d.volume ? `, vol ${d.volume}/mois` : ''}`).join('\n')}
RÈGLE: Optimise le contenu PRIORITAIREMENT pour ces quick wins.
` : ''}
═══ FIN MOTS-CLÉS ═══`

  return { promptBlock, totalKeywords: keywordMap.size, sources };
}

async function prescribeWithDualPrompts(context: {
  domain: string;
  cycle_number: number;
  conservativeMode: boolean;
  maxRisk: number;
  scoredWorkbenchItems: any[];
  siteKeywords: string[];
  siteInfo: any;
  isIktracker: boolean;
  tracked_site_id: string;
  force_content?: boolean;
  force_iktracker_article?: boolean;
  user_id?: string;
}): Promise<ParmenionDecision | null> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const supabase = getServiceClient();
  if (!LOVABLE_API_KEY) return null;

  const items = context.scoredWorkbenchItems;
  // Use lane field from scoring function (dual-lane) or fallback to tier-based split
  const techItems = items.filter((it: any) => (it.lane || (it.tier <= 4 ? 'tech' : 'content')) === 'tech');
  const contentItems = items.filter((it: any) => (it.lane || (it.tier <= 4 ? 'tech' : 'content')) === 'content');
  
  console.log(`[Parménion] Prescribe V2 dual-lane: ${techItems.length} tech + ${contentItems.length} content items. Force content: ${context.force_content}`);

  // ── Parse client_targets for readable injection ──
  let parsedTargetsPrimary = '';
  let parsedTargetsSecondary = '';
  if (context.siteInfo?.client_targets) {
    try {
      const ct = typeof context.siteInfo.client_targets === 'string'
        ? JSON.parse(context.siteInfo.client_targets)
        : context.siteInfo.client_targets;
      if (ct?.primary?.[0]) {
        const p = ct.primary[0];
        const market = Object.keys(p).find(k => k !== 'confidence' && k !== 'evidence' && k !== 'geo_country' && k !== 'geo_scope' && k !== 'intent' && k !== 'market' && k !== 'maturity');
        parsedTargetsPrimary = p.market ? `${p.market}` : '';
        if (market && p[market]) {
          const details = p[market];
          parsedTargetsPrimary += details.age_range ? ` (${details.age_range})` : '';
          parsedTargetsPrimary += details.csp ? ` — ${details.csp}` : '';
          parsedTargetsPrimary += details.segment ? ` — ${details.segment}` : '';
        }
        if (p.intent) parsedTargetsPrimary += ` | Intent: ${p.intent}`;
      }
      if (ct?.secondary?.[0]) {
        const s = ct.secondary[0];
        const market = Object.keys(s).find(k => k !== 'confidence' && k !== 'evidence' && k !== 'geo_country' && k !== 'geo_scope' && k !== 'intent' && k !== 'market' && k !== 'maturity');
        parsedTargetsSecondary = s.market ? `${s.market}` : '';
        if (market && s[market]) {
          const details = s[market];
          parsedTargetsSecondary += details.segment ? ` — ${details.segment}` : '';
          parsedTargetsSecondary += details.role ? ` (${details.role})` : '';
        }
        if (s.intent) parsedTargetsSecondary += ` | Intent: ${s.intent}`;
      }
    } catch (e) {
      console.warn('[Parménion] Failed to parse client_targets:', e);
    }
  }

  const siteCtx = context.siteInfo
    ? `Site: ${context.siteInfo.site_name || context.domain} | Secteur: ${context.siteInfo.market_sector || '?'} | Audience: ${context.siteInfo.target_audience || '?'}`
    : `Site: ${context.domain}`;
  // FIX #1: Truncate keywords to 15 to reduce prompt bloat
  const kwCtx = context.siteKeywords.length > 0
    ? `Mots-clés du site: ${context.siteKeywords.slice(0, 15).join(', ')}`
    : '';

  function buildItemsList(lot: any[]): string {
    return lot.map((it: any, i: number) =>
      `${i + 1}. [Tier ${it.tier}: ${TIER_NAMES[it.tier] || '?'}] Score: ${it.spiral_score} | ${it.severity}
   "${it.title}" → page: ${it.target_url || '?'} | champ: ${it.target_selector || 'auto'} | op: ${it.target_operation || 'replace'}
   ${it.description?.slice(0, 150) || ''}`
    ).join('\n\n');
  }

  // ── TOPIC SUGGESTION ENGINE: generate business-relevant topic ideas based on audience ──
  function generateTopicSuggestions(audience: string, sector: string, saturatedTopics: string[]): string[] {
    // Map common audience segments to relevant business topics
    const AUDIENCE_TOPICS: Record<string, string[]> = {
      'indépendant': ['facturation électronique', 'cotisations sociales', 'prévoyance', 'retraite complémentaire', 'TVA auto-entrepreneur', 'comptabilité simplifiée', 'régime micro-entreprise'],
      'entrepreneur': ['financement', 'business plan', 'levée de fonds', 'droit des sociétés', 'assurance RC pro', 'gestion de trésorerie', 'recrutement premier salarié'],
      'artisan': ['apprentissage', 'qualifications professionnelles', 'label RGE', 'devis et facturation', 'assurance décennale', 'marchés publics', 'normes et réglementations'],
      'agent immobilier': ['diagnostics obligatoires', 'loi Alur', 'mandats exclusifs', 'estimation immobilière', 'prospection digitale', 'gestion locative'],
      'infirmier': ['convention CPAM', 'remplacements', 'cabinet libéral', 'cotisations CARPIMKO', 'télétransmission', 'formation continue DPC'],
      'commerçant': ['bail commercial', 'caisse enregistreuse certifiée', 'soldes et promotions', 'droit de la consommation', 'fidélisation client', 'commerce en ligne'],
      'avocat': ['déontologie', 'fixation des honoraires', 'marketing juridique', 'RPVA', 'aide juridictionnelle', 'spécialisation'],
      'vrp': ['statut VRP', 'commissions', 'clause de non-concurrence', 'indemnité de clientèle', 'frais professionnels', 'secteur exclusif'],
      'profession libérale': ['BNC', 'AGA', 'CFE', 'prévoyance Madelin', 'SCM', 'rétrocession honoraires'],
    };

    const SECTOR_TOPICS: Record<string, string[]> = {
      'mobilité': ['prix des carburants', 'passage à l\'électrique', 'bonus écologique', 'ZFE', 'covoiturage professionnel', 'vélo de fonction', 'forfait mobilité durable'],
      'comptabilité': ['facturation électronique 2026', 'archivage numérique', 'rapprochement bancaire', 'déclaration de TVA', 'bilan comptable', 'amortissements'],
      'fiscalité': ['impôt sur le revenu', 'crédit d\'impôt', 'exonérations', 'contrôle fiscal', 'optimisation fiscale légale'],
      'transport': ['carte grise', 'contrôle technique', 'leasing vs achat', 'flotte automobile', 'éco-conduite', 'assurance auto pro'],
    };

    const suggestions: string[] = [];
    const saturatedSet = new Set(saturatedTopics.map(t => t.toLowerCase()));

    // Match audience segments
    for (const [key, topics] of Object.entries(AUDIENCE_TOPICS)) {
      if (audience.includes(key)) {
        for (const topic of topics) {
          if (!saturatedSet.has(topic) && suggestions.length < 10) {
            suggestions.push(topic);
          }
        }
      }
    }

    // Match sector topics
    for (const [key, topics] of Object.entries(SECTOR_TOPICS)) {
      if (sector.includes(key)) {
        for (const topic of topics) {
          if (!saturatedSet.has(topic) && suggestions.length < 12) {
            suggestions.push(topic);
          }
        }
      }
    }

    // If no match, provide generic business topics
    if (suggestions.length === 0) {
      return ['facturation électronique', 'obligations légales', 'digitalisation', 'productivité', 'gestion administrative'];
    }

    return suggestions;
  }

  // For content items: strip SEO jargon from titles/descriptions so LLM focuses on business topics
  const SEO_JARGON_PATTERNS = [
    /gap\s*(de\s*)?(citabilit[ée]|s[ée]mantique|de\s*contenu)/gi,
    /cannibalisation/gi,
    /maillage\s*interne/gi,
    /cocon\s*s[ée]mantique/gi,
    /e[\-\s]?e[\-\s]?a[\-\s]?t/gi,
    /backlink[s]?/gi,
    /strat[ée]gie\s*seo/gi,
    /campagne\s*de\s*partenariats?\s*(seo)?/gi,
    /linking\s*(interne|externe)/gi,
    /content\s*gap/gi,
    /cluster\s*(optimization|sémantique)/gi,
  ];

  function sanitizeForContent(text: string): string {
    let cleaned = text;
    for (const pattern of SEO_JARGON_PATTERNS) {
      cleaned = cleaned.replace(pattern, '');
    }
    return cleaned.replace(/\s{2,}/g, ' ').trim();
  }

  function buildContentItemsList(lot: any[], sector: string): string {
    return lot.map((it: any, i: number) => {
      // Extract the business-relevant part: target URL and description
      const pageUrl = it.target_url || '?';
      const rawTitle = sanitizeForContent(it.title || '');
      const rawDesc = sanitizeForContent((it.description || '').slice(0, 300));
      return `${i + 1}. OPPORTUNITÉ ÉDITORIALE pour "${sector}"
   Page concernée: ${pageUrl}
   Thématique à couvrir: ${rawTitle || rawDesc || 'contenu à enrichir'}
   Action: ${it.target_operation || 'create'} | Priorité: ${it.severity}`;
    }).join('\n\n');
  }

  const promises: Promise<any[]>[] = [];

  // ── PROMPT TECHNIQUE (tiers 0-3) ──
  if (techItems.length > 0) {
    const techTodayISO = new Date().toISOString().slice(0, 10);
    const techPrompt = `Tu es un moteur d'exécution SEO technique. Date du jour : ${techTodayISO}.
Tu reçois des items prioritaires à corriger. Génère les tool calls correspondants. Max 4 appels. Ne diagnostique pas, produis.

${siteCtx}

ITEMS À TRAITER (par ordre de priorité):
${buildItemsList(techItems)}

RÈGLES:
- emit_code: pour du JS injectable (performance, lazy loading, CLS, etc.)
- emit_corrective_data: pour des métadonnées CMS (meta_description, canonical, schema_org, etc.)
- Pour IKtracker: les page_key sont les slugs des pages (ex: "bareme-ik", "calcul-trajet")
- Chaque item a un champ cible (target_selector) et une opération (target_operation) — respecte-les
- Ne crée PAS de contenu éditorial ici`;

    promises.push(callLLMWithTools(LOVABLE_API_KEY, techPrompt, TECH_TOOLS));
  } else {
    promises.push(Promise.resolve([]));
  }

  // ── PROMPT CONTENU (tiers 4-10) avec templates SEO/GEO + enrichissement keywords ──
  if (contentItems.length > 0) {
    // Load prompt templates from DB
    const templates = await loadPromptTemplates(supabase);
    
    // Detect page types for each content item and build per-type instructions
    const typeInstructions = new Map<string, string>();
    // FIX #1: Only process first 3 content items to reduce prompt size
    for (const item of contentItems.slice(0, 3)) {
      const pageType = detectPageType(item);
      if (pageType && templates.has(pageType) && !typeInstructions.has(pageType)) {
        typeInstructions.set(pageType, buildTemplateInstructions(templates.get(pageType)));
      }
      item._detected_page_type = pageType;
    }
    // Detect page type for remaining items without loading templates
    for (const item of contentItems.slice(3)) {
      item._detected_page_type = detectPageType(item);
    }
    
    // FIX #1: Only inject the first template to keep prompt under token limit
    const templateBlock = typeInstructions.size > 0
      ? `\n\nTEMPLATE DE CONTENU (APPLIQUE CE TEMPLATE):\n${Array.from(typeInstructions.values()).slice(0, 1).join('\n')}`
      : '';

    // ── KEYWORD ENRICHMENT: aggregate from multiple sources ──
    const keywordEnrichment = await enrichKeywordsForPrescribe(supabase, context.domain, context.tracked_site_id, contentItems);

    // ── CONTENT BRIEF: build deterministic brief for the top content item ──
    const topContentItem = contentItems[0];
    const briefPageType = topContentItem?._detected_page_type || 'article';
    const primaryKw = topContentItem?.payload?.keyword || topContentItem?.payload?.target_keyword || topContentItem?.title || '';
    
    // Load Voice DNA
    let voiceDna: any = null;
    try {
      const { data: siteVoice } = await supabase.from('tracked_sites').select('voice_dna').eq('id', context.tracked_site_id).single();
      voiceDna = siteVoice?.voice_dna || null;
    } catch {}

    const contentBrief = await buildContentBrief({
      page_type: briefPageType,
      keyword: primaryKw,
      target_url: topContentItem?.target_url || `https://${context.domain}`,
      domain: context.domain,
      tracked_site_id: context.tracked_site_id,
      title: topContentItem?.title || '',
      finding_category: topContentItem?.finding_category || '',
      sector: context.siteInfo?.market_sector || '',
      jargon_distance: context.siteInfo?.jargon_distance ?? null,
      language: 'fr',
      secondary_keywords: keywordEnrichment.totalKeywords > 0
        ? Array.from({ length: Math.min(10, keywordEnrichment.totalKeywords) }).map((_, i) => '')
        : [],
      voice_dna: voiceDna,
      supabase,
    });
    const briefBlock = briefToPromptBlock(contentBrief);

    // ── PRESET INJECTION: load user's default preset for this site+pageType (admin only) ──
    let presetBlock = '';
    {
      const { data: preset } = await supabase
        .from('content_prompt_presets')
        .select('prompt_text, name')
        .eq('tracked_site_id', context.tracked_site_id)
        .eq('page_type', briefPageType)
        .eq('is_default', true)
        .maybeSingle();
      if (preset?.prompt_text) {
        presetBlock = `\n## INSTRUCTIONS CUSTOM (preset "${preset.name}")\n${preset.prompt_text}\n`;
        console.log(`[Parménion] 📝 Preset injecté: "${preset.name}" (${preset.prompt_text.length} car.)`);
      }
    }

    console.log(`[Parménion] 📄 Content items: ${contentItems.map((it: any) => `${it.title?.slice(0, 30)}→${it._detected_page_type || 'auto'}`).join(', ')}`);
    console.log(`[Parménion] 🔑 Keyword enrichment: ${keywordEnrichment.totalKeywords} keywords from ${keywordEnrichment.sources.join(', ')}`);
    console.log(`[Parménion] 📋 ContentBrief: type=${contentBrief.page_type}, tone=${contentBrief.tone}, angle=${contentBrief.angle}, h2=${contentBrief.h2_count.min}-${contentBrief.h2_count.max}`);

    // ── ARTICLE TYPE DIVERSITY & SEMANTIC RING ──
    let diversityBlock = '';
    let existingArticleTitles: string[] = [];
    let topicExplorationBlock = '';
    let personaBlock = '';
    
    // ── PERSONA DECOMPOSITION: strategic pre-processing ──
    try {
      const personas = await loadPersonaRotation(supabase, context.tracked_site_id, context.siteInfo || {});
      if (personas.length > 0) {
        personaBlock = buildPersonaPromptBlock(personas, context.siteInfo?.site_name || context.domain);
        console.log(`[Parménion] 🎭 Persona engine: ${personas.length} personas, next="${personas[0].label}" (${personas[0].articles_count} articles, last=${personas[0].last_served_at || 'never'})`);
      }
    } catch (e) {
      console.warn('[Parménion] Persona decomposition failed:', e);
    }
    try {
      // Query ALL existing articles (published + drafts) via CMS scanner or direct DB
      const { data: existingPosts } = await supabase
        .from('iktracker_content_cache')
        .select('title, category, tags, status')
        .eq('tracked_site_id', context.tracked_site_id)
        .eq('content_type', 'post');
      
      let allArticles = (existingPosts || []).map((p: any) => ({
        title: p.title, category: p.category, tags: p.tags,
      }));

      if (context.domain === 'crawlers.fr') {
        const { data: blogPosts } = await supabase
          .from('blog_articles')
          .select('title, slug, status')
          .in('status', ['published', 'draft']);
        if (blogPosts) {
          allArticles = [...allArticles, ...blogPosts.map((b: any) => ({ title: b.title, category: '', tags: [] }))];
        }
      }

      // Fallback: fetch from IKtracker API if CMS cache is empty
      if (allArticles.length === 0 && context.cms_api_key) {
        try {
          const iktRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/iktracker-actions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'list-posts', limit: 300, all: true }),
          });
          if (iktRes.ok) {
            const iktData = await iktRes.json();
            const posts = Array.isArray(iktData?.data?.posts) ? iktData.data.posts : Array.isArray(iktData?.data) ? iktData.data : [];
            allArticles = posts.map((p: any) => ({ title: p.title, category: p.category || '', tags: p.tags || [] }));
          }
        } catch (e) {
          console.warn('[Parménion] IKtracker API fallback failed:', e);
        }
      }

      // computeArticleDistribution now also extracts saturatedTopics from titles
      const distribution = computeArticleDistribution(allArticles);
      
      // Compute semantic ring coverage
      const ringCounts = { ring1: 0, ring2: 0, ring3: 0 };
      for (const article of allArticles) {
        const tags = (article.tags || []).map((t: string) => t.toLowerCase());
        if (tags.includes('ring_3') || tags.includes('semantic_ring:3')) ringCounts.ring3++;
        else if (tags.includes('ring_2') || tags.includes('semantic_ring:2')) ringCounts.ring2++;
        else ringCounts.ring1++;
      }
      
      // Compute spiral phase from workbench items to allow R2 during contraction
      const avgSpiralScore = scoredWorkbenchItems.length > 0
        ? Math.round(scoredWorkbenchItems.reduce((s: number, it: any) => s + (it.spiral_score || 0), 0) / scoredWorkbenchItems.length)
        : 0;
      const currentSpiralPhase: 'contraction' | 'expansion' | 'neutral' = 
        avgSpiralScore >= 50 ? 'contraction' : avgSpiralScore >= 25 ? 'neutral' : 'expansion';
      
      const ringInfo = determineSemanticRing(ringCounts, 8, 15, currentSpiralPhase);
      
      // Find parent pages for linking
      const parentRing = Math.max(1, ringInfo.ring - 1) as SemanticRing;
      const { data: parentNodes } = await supabase
        .from('cocoon_sessions')
        .select('nodes_snapshot')
        .eq('tracked_site_id', context.tracked_site_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      const parentPages: string[] = [];
      if (parentNodes?.nodes_snapshot && Array.isArray(parentNodes.nodes_snapshot)) {
        const sortedNodes = parentNodes.nodes_snapshot
          .filter((n: any) => n.url && n.pagerank_score > 0)
          .sort((a: any, b: any) => (b.pagerank_score || 0) - (a.pagerank_score || 0));
        for (const node of sortedNodes.slice(0, 10)) {
          parentPages.push(`${node.url} (${node.title || 'sans titre'})`);
        }
      }
      
      diversityBlock = buildDiversityPromptBlock(distribution, ringInfo, parentPages);
      existingArticleTitles = allArticles.map((a: any) => a.title).filter(Boolean);

      // ═══ TOPIC EXPLORATION: Query cluster_definitions to map ALL available thematic territories ═══
      const { data: allClusters } = await supabase
        .from('cluster_definitions')
        .select('id, cluster_name, ring, maturity_pct, keywords')
        .eq('tracked_site_id', context.tracked_site_id)
        .order('ring', { ascending: true });
      
      if (allClusters && allClusters.length > 0) {
        // Count existing articles per cluster by keyword matching
        const clusterCoverage = allClusters.map((c: any) => {
          const clusterKws = (c.keywords || []).map((k: string) => k.toLowerCase());
          let articleCount = 0;
          for (const art of allArticles) {
            const titleLower = (art.title || '').toLowerCase();
            if (clusterKws.some((kw: string) => titleLower.includes(kw))) articleCount++;
          }
          return {
            name: c.cluster_name,
            ring: c.ring || 0,
            maturity: c.maturity_pct || 0,
            keywords: clusterKws.slice(0, 5),
            articleCount,
          };
        });

        // Detect monotopic workbench: all content items from same cluster?
        const workbenchClusterIds = new Set(contentItems.map((it: any) => it.cluster_id).filter(Boolean));
        const isMonotopic = workbenchClusterIds.size <= 1;

        // Find underserved clusters (few articles, low maturity)
        const underserved = clusterCoverage
          .filter((c: any) => c.articleCount < 2 && c.maturity < 70)
          .sort((a: any, b: any) => a.articleCount - b.articleCount || a.maturity - b.maturity)
          .slice(0, 8);

        // Find overserved clusters
        const overserved = clusterCoverage
          .filter((c: any) => c.articleCount >= 3)
          .map((c: any) => `${c.name} (${c.articleCount} articles)`)
          .slice(0, 5);

        const lines: string[] = [];
        lines.push(`\n═══ RÉDACTEUR EN CHEF — STRATÉGIE THÉMATIQUE ═══`);
        lines.push(`Le blog couvre actuellement ${allArticles.length} articles répartis sur ${allClusters.length} clusters thématiques.`);
        
        if (overserved.length > 0) {
          lines.push(`\nCLUSTERS SATURÉS (trop d'articles, ÉVITER): ${overserved.join(', ')}`);
        }

        if (underserved.length > 0) {
          lines.push(`\nCLUSTERS À EXPLORER (peu ou pas d'articles) :`);
          for (const c of underserved) {
            lines.push(`  → ${c.name} (Ring ${c.ring}, ${c.articleCount} articles, maturité ${c.maturity}%) — mots-clés: ${c.keywords.join(', ')}`);
          }
        }

        if (isMonotopic && underserved.length > 0) {
          lines.push(`\n*** DIRECTIVE PRIORITAIRE ***`);
          lines.push(`Tous les items du workbench ciblent le MÊME cluster. C'est un signal de monotopie.`);
          lines.push(`Tu DOIS choisir un cluster DIFFÉRENT parmi les clusters à explorer ci-dessus.`);
          lines.push(`L'audience de ce site (${context.siteInfo?.target_audience || 'professionnels'}) a des besoins variés :`);
          // Inject audience-aware topic suggestions
          const audience = (context.siteInfo?.target_audience || '').toLowerCase();
          const sector = (context.siteInfo?.market_sector || '').toLowerCase();
          const suggestions = generateTopicSuggestions(audience, sector, distribution.saturatedTopics);
          if (suggestions.length > 0) {
            lines.push(`Pistes thématiques à considérer :`);
            for (const s of suggestions) {
              lines.push(`  - ${s}`);
            }
          }
        }

        lines.push(`═══ FIN STRATÉGIE THÉMATIQUE ═══\n`);
        topicExplorationBlock = lines.join('\n');
        console.log(`[Parménion] 🗺️ Topic exploration: ${allClusters.length} clusters, ${underserved.length} underserved, monotopic=${isMonotopic}, overserved=${overserved.length}`);
      }

      console.log(`[Parménion] 🎯 Diversity: recommended=${distribution.recommended}, ring=${ringInfo.ring}, overrep=[${distribution.overRepresented.join(',')}], saturated=[${distribution.saturatedTopics.join(',')}], existing_titles=${existingArticleTitles.length}`);
    } catch (e) {
      console.warn('[Parménion] Diversity computation failed:', e);
    }

    // ── LOG GENERATION for performance correlation training ──
    try {
      const siteInfo = context.siteInfo || {};
      await supabase.from('content_generation_logs').insert({
        user_id: context.user_id,
        tracked_site_id: context.tracked_site_id,
        domain: context.domain,
        market_sector: siteInfo.market_sector || null,
        page_type: briefPageType,
        target_url: topContentItem?.target_url || `https://${context.domain}`,
        keyword: primaryKw,
        brief_tone: contentBrief.tone,
        brief_angle: contentBrief.angle,
        brief_length_target: contentBrief.target_length,
        brief_h2_count: contentBrief.h2_count.max,
        brief_h3_count: contentBrief.h3_count.max,
        brief_cta_count: contentBrief.cta.length,
        brief_internal_links_count: contentBrief.internal_links.length,
        brief_schema_types: contentBrief.schema_types,
        brief_eeat_signals: contentBrief.eeat_signals,
        brief_geo_passages: contentBrief.geo_citable_passages,
        preset_id: null, // TODO: link when preset is loaded
        source: 'parmenion',
      });
      console.log(`[Parménion] 📊 Generation logged for correlation training`);
    } catch (e) {
      console.warn('[Parménion] Failed to log generation:', e);
    }

    // ── EXISTING TITLES BLOCKLIST: prevent LLM from regenerating same topics ──
    let existingTitlesBlock = '';
    if (existingArticleTitles.length > 0) {
      const unique = [...new Set(existingArticleTitles)].slice(0, 30);
      existingTitlesBlock = `\n⛔⛔⛔ ARTICLES EXISTANTS — NE PAS DUPLIQUER ⛔⛔⛔\nLe blog contient DÉJÀ ces ${unique.length} articles. Tu NE DOIS PAS créer d'article sur le même sujet, même avec un titre différent :\n${unique.map(t => `- ${t}`).join('\n')}\nSi le sujet que tu veux traiter est couvert ci-dessus → utilise update-post pour enrichir l'existant OU choisis un sujet TOTALEMENT différent.\n`;
    }

    const todayISO = new Date().toISOString().slice(0, 10);
    const sectorName = context.siteInfo?.market_sector || 'inconnu';
    const siteName = context.siteInfo?.site_name || context.domain;
    const productsServices = context.siteInfo?.products_services || '';
    const contentPrompt = `Tu es un rédacteur expert du secteur "${sectorName}". Date du jour : ${todayISO}. Utilise TOUJOURS l'année en cours (${new Date().getFullYear()}) dans tes contenus — JAMAIS 2024 ou une autre année passée.
Génère les tool calls correspondants. Max 4 appels.

${siteCtx}
${kwCtx}

${briefBlock}

${diversityBlock}

${topicExplorationBlock}

${existingTitlesBlock}

${keywordEnrichment.promptBlock}

⚠️⚠️⚠️ RÈGLE CRITIQUE — SÉPARATION DIAGNOSTIC / CONTENU ⚠️⚠️⚠️
Les "ITEMS À TRAITER" ci-dessous sont des DIAGNOSTICS SEO internes. Ils décrivent des PROBLÈMES techniques à résoudre (gaps sémantiques, cannibalisation, citabilité, etc.).
Ces termes SEO NE DOIVENT JAMAIS apparaître dans le titre, le slug ou le corps des articles que tu produis.
Tu dois TRADUIRE chaque diagnostic en un SUJET MÉTIER concret pour le secteur "${sectorName}".

⚠️⚠️⚠️ RÈGLE CRITIQUE — DIVERSIFICATION DES ANGLES ÉDITORIAUX ⚠️⚠️⚠️
Tu NE DOIS PAS produire uniquement des "guides complets". Les titres type "X : Le Guide Complet" sont INTERDITS si d'autres articles similaires existent déjà.
Tu DOIS varier les ANGLES d'attaque selon 5 stratégies :

1. **ANGLE PERSONA** (ciblage par métier/profil) :
   Écrire pour un segment précis de l'audience. Le métier ou le profil apparaît dans le titre.
   Exemples : "Comment les infirmières libérales gèrent leurs indemnités kilométriques"
             "Frais de déplacement des VRP : ce que votre employeur doit rembourser"
             "Auto-entrepreneurs : 3 erreurs sur la déclaration des frais réels"

2. **ANGLE ACTUALITÉ** (lié à un événement récent, une réforme, une annonce) :
   Accrocher sur un fait d'actualité vérifiable. Mentionner des noms propres, des dates, des décisions.
   Exemples : "Barème kilométrique 2026 : ce qui change avec la loi de finances"
             "Électrification des flottes : les nouvelles aides annoncées par le gouvernement"
             "PLF 2026 : impact sur les frais professionnels des indépendants"

3. **ANGLE NICHE ÉTROIT** (une question ultra-spécifique) :
   Répondre à UNE question précise que se pose un utilisateur. Format court et direct.
   Exemples : "Peut-on déduire les péages de ses frais kilométriques ?"
             "Vélo électrique : a-t-on droit à des indemnités kilométriques ?"
             "Aller-retour domicile-travail : comment calculer la distance fiscale ?"

4. **ANGLE COMPARATIF / DÉCRYPTAGE** :
   Opposer deux options, décrypter une idée reçue, démystifier un sujet complexe.
   Exemples : "Frais réels vs abattement forfaitaire : simulation pour 3 profils types"
             "Idée reçue : un salarié ne peut pas déduire ses frais kilométriques"
             "Diesel vs électrique : quel impact sur vos indemnités kilométriques en 2026 ?"

5. **ANGLE TUTORIEL PRATIQUE** (pas un "guide complet" — une procédure concrète) :
   Décrire étape par étape une action précise avec captures, chiffres, formulaires.
   Exemples : "Remplir le formulaire 2042 : déclarer ses frais kilométriques en 5 minutes"
             "Configurer ${siteName} pour suivre ses trajets professionnels"

CHOISIS l'angle le MOINS représenté parmi les articles existants. Alterne systématiquement.

INTERDIT ABSOLU : les mots "gap de citabilité", "gap sémantique", "cannibalisation", "maillage interne", "E-E-A-T", "cocon sémantique", "campagne de partenariats SEO", "stratégie SEO", "backlinks" ou tout jargon SEO dans le contenu destiné aux lecteurs du site.
Le lecteur final est un UTILISATEUR du site (${parsedTargetsPrimary || 'grand public'}), PAS un expert SEO.

ITEMS À TRAITER (opportunités éditoriales — PAS des diagnostics SEO) :
${buildContentItemsList(contentItems, sectorName)}

IDENTITÉ DU SITE (OBLIGATOIRE — guide le sujet de chaque article) :
- Nom : ${siteName}
- Secteur : ${sectorName}
${parsedTargetsPrimary ? `- Cible prioritaire : ${parsedTargetsPrimary}` : ''}
${parsedTargetsSecondary ? `- Cible secondaire : ${parsedTargetsSecondary}` : ''}
${productsServices ? `- Produits/services : ${productsServices}` : ''}
Chaque contenu produit DOIT être un article/page que les clients de ${siteName} trouveraient utile et pertinent.

RÈGLES:
- emit_corrective_content: pour MODIFIER du contenu existant (H1, H2, paragraphes, enrichissement)
- emit_editorial_content: pour CRÉER un nouvel article OU une nouvelle page (combler un gap)
  - Utilise action "create-post" pour les contenus blog éditoriaux (actualités, décryptages, comparatifs, procédures, analyses, FAQ éditoriales)
  - Utilise action "create-page" pour les pages statiques (landing pages, pages de conversion, FAQ globales)
  - DIVERSIFIE les types d'articles : présentation, actualité, comparatif, tutoriel, opinion, guide. Respecte les quotas indiqués dans le bloc DIVERSITÉ ci-dessus.
  - OBLIGATOIRE : chaque article DOIT inclure "article_type" (presentation|actualite|comparatif|tutoriel|opinion|guide) et "semantic_ring" (1|2|3)
  - Les GUIDES ne doivent JAMAIS représenter plus de 5% des articles. Si le quota est atteint, choisis un AUTRE type.
  - MAILLAGE MÈRE-FILLE : chaque article d'un ring supérieur DOIT contenir un lien vers une page du ring inférieur.
  - ANGLE ÉDITORIAL : Applique l'un des 5 angles décrits ci-dessus (persona, actualité, niche, comparatif, tutoriel). Ne choisis JAMAIS "guide complet" par défaut.
${context.force_iktracker_article ? `\n⚠️ OBLIGATION ABSOLUE : Tu DOIS appeler emit_editorial_content pour créer UN NOUVEAU CONTENU pertinent pour le secteur "${sectorName}". Cette directive est prioritaire et NON NÉGOCIABLE.\n` : ''}
- status TOUJOURS "draft". author_name: "Équipe ${siteName}"
- LONGUEUR OBLIGATOIRE: chaque article DOIT faire MINIMUM 800 mots (environ 5000 caractères Markdown). Un bon article fait 1000-1500 mots. Ne JAMAIS produire un contenu de moins de 600 mots.
- FORMAT OBLIGATOIRE: tout le contenu DOIT être en **Markdown** (pas de HTML). Utilise ## pour H2, ### pour H3, **gras**, *italique*, - pour listes, [ancre](url) pour liens, > pour citations.
- RESPECTE les contraintes du CONTENT BRIEF ci-dessus (longueur, H2, ton, CTA, liens internes)
- UTILISE les mots-clés stratégiques ci-dessus dans le contenu (titres, H2, corps)
- Intègre les liens internes pré-calculés dans le brief de manière naturelle dans le texte
${presetBlock}
${templateBlock}`;

    promises.push(callLLMWithTools(LOVABLE_API_KEY, contentPrompt, CONTENT_TOOLS, 'google/gemini-2.5-pro'));
  } else {
    promises.push(Promise.resolve([]));
  }

  // ── PARALLEL EXECUTION ──
  console.log(`[Parménion] 🔀 Prescribe V2: ${techItems.length} tech items + ${contentItems.length} content items → 2 parallel LLM calls`);
  const [techResults, contentResults] = await Promise.all(promises);

  const allToolCalls = [...techResults, ...contentResults];
  console.log(`[Parménion] ✅ Prescribe V2: ${techResults.length} tech + ${contentResults.length} content = ${allToolCalls.length} tool calls total`);

  // ── BUILD DECISION FROM TOOL CALLS ──
  if (items.length === 0) {
    console.warn('[Parménion] Prescribe V2: no workbench items — skipping decision build');
    return null;
  }
  const topItem = items[0];
  const cmsActions: any[] = [];
  const fixes: any[] = [];

  for (const tc of allToolCalls) {
    const args = tc.arguments;
    switch (tc.name) {
      case 'emit_code':
        fixes.push({
          id: args.fix_id,
          label: args.label,
          category: args.category,
          prompt: args.prompt,
          enabled: true,
          target_url: args.target_url,
          target_selector: args.target_selector,
        });
        break;
      case 'emit_corrective_data':
        cmsActions.push({
          action: args.action || 'update-page',
          page_key: sanitizePageKey(args.page_key || args.slug),
          slug: args.slug,
          updates: args.field === 'schema_org'
            ? { schema_org: args.schema_org_value || args.value }
            : { [args.field]: args.value },
          _channel: 'data',
        });
        break;
      case 'emit_corrective_content':
        cmsActions.push({
          action: args.action || 'update-page',
          page_key: sanitizePageKey(args.page_key || args.slug),
          slug: args.slug,
          updates: args.updates,
          _channel: 'content_corrective',
          _target_selector: args.target_selector,
          _operation: args.operation,
        });
        break;
      case 'emit_editorial_content':
        cmsActions.push({
          action: args.action || 'create-post',
          body: { ...args.body, status: 'draft' },
          _channel: 'content_editorial',
        });
        break;
    }
  }

  // ── EDITORIAL PIPELINE ENRICHMENT (opt-in via autopilot_configs.use_editorial_pipeline) ──
  // For each create-post / create-page action, optionally regenerate the body via the
  // shared 4-stage pipeline (Briefing → Strategist → Writer → Tonalizer).
  try {
    const { data: cfg } = await supabase
      .from('autopilot_configs')
      .select('use_editorial_pipeline')
      .eq('tracked_site_id', context.tracked_site_id)
      .maybeSingle();
    const usePipeline = (cfg as { use_editorial_pipeline?: boolean } | null)?.use_editorial_pipeline === true;
    if (usePipeline && context.user_id) {
      const editorialActions = cmsActions.filter(
        (a) => a._channel === 'content_editorial' && (a.action === 'create-post' || a.action === 'create-page'),
      );
      for (const action of editorialActions) {
        try {
          const ct: ContentType = action.action === 'create-page' ? 'seo_page' : 'blog_article';
          const brief = action.body?.title || action.body?.meta_title || 'Nouveau contenu';
          const result = await runEditorialPipeline(supabase, {
            user_id: context.user_id,
            domain: context.domain,
            tracked_site_id: context.tracked_site_id,
            content_type: ct,
            user_brief: brief,
          });
          // Replace body content with pipeline output, keep CMS-specific fields
          action.body = {
            ...action.body,
            title: result.final.title || action.body?.title,
            content: result.final.content || action.body?.content,
            excerpt: result.final.excerpt || action.body?.excerpt,
            _pipeline_run_id: result.pipeline_run_id,
            _pipeline_models: {
              strategist: result.strategy.model_used,
              writer: result.draft.model_used,
              tonalizer: result.final.model_used,
            },
          };
          console.log(`[Parménion] Pipeline enriched action "${action.body.title}" in ${result.total_latency_ms}ms`);
        } catch (e) {
          console.error('[Parménion] Pipeline enrichment failed for one action, keeping legacy content:', e);
        }
      }
    }
  } catch (e) {
    console.error('[Parménion] Pipeline opt-in check failed:', e);
  }

  const functions: string[] = [];
  if (fixes.length > 0) functions.push('generate-corrective-code');
  if (cmsActions.length > 0) functions.push('iktracker-actions');

  return {
    goal: {
      type: topItem.tier <= 3 ? 'technical_fix' : topItem.tier <= 7 ? 'content_gap' : 'content_creation',
      description: `[Prescribe V2] Tier ${topItem.tier} (${TIER_NAMES[topItem.tier]}): ${topItem.title}. ${fixes.length} code fixes + ${cmsActions.length} CMS actions.`,
    },
    tactic: {
      initial_scope: { items_scored: items.length, tech: techItems.length, content: contentItems.length },
      final_scope: { fixes: fixes.length, cms_actions: cmsActions.length, tool_calls: allToolCalls.length },
      scope_reductions: 0,
      estimated_tokens: 0,
      target_url: topItem.target_url,
    },
    prudence: {
      impact_level: topItem.tier <= 1 ? 'avancé' : topItem.tier <= 4 ? 'modéré' : 'faible',
      risk_score: Math.min(context.maxRisk, topItem.tier <= 1 ? 2 : 1),
      iterations: 0,
      goal_changed: false,
      reasoning: `Breathing Spiral scoring: top item tier ${topItem.tier} (${TIER_NAMES[topItem.tier]}), spiral_score ${topItem.spiral_score}. ${allToolCalls.length} actions produites via dual-prompt.`,
    },
    action: {
      type: fixes.length > 0 && cmsActions.length > 0 ? 'mixed' : fixes.length > 0 ? 'code' : 'cms',
      payload: {
        fixes: fixes.length > 0 ? fixes : undefined,
        cms_actions: cmsActions.length > 0 ? cmsActions : undefined,
        _prescribe_v2: true,
        _tool_calls_raw: allToolCalls,
      },
      functions,
    },
    summary: `Prescribe V2: ${fixes.length} fixes code + ${cmsActions.length} actions CMS (${techResults.length} tech + ${contentResults.length} content tool calls). Top: Tier ${topItem.tier} — ${topItem.title}`,
  };
}

// Local callLLMWithTools removed — uses shared import from _shared/parmenion/llmClient.ts

// ═══════════════════════════════════════════════════════════════
// LLM REASONING ENGINE (for non-prescribe phases)
// ═══════════════════════════════════════════════════════════════

interface ParmenionDecision {
  goal: { type: string; cluster_id?: string; description: string };
  tactic: { initial_scope: any; final_scope: any; scope_reductions: number; estimated_tokens: number; target_url?: string };
  prudence: { impact_level: string; risk_score: number; iterations: number; goal_changed: boolean; reasoning: string };
  action: { type: string; payload: any; functions: string[] };
  summary: string;
}

async function askParmenionLLM(context: {
  domain: string;
  cycle_number: number;
  currentPhase: PipelinePhase;
  conservativeMode: boolean;
  maxRisk: number;
  diagnostics: any[];
  cocoon: any;
  pastErrors: any[];
  previousPhaseResults: any[];
  pendingRecommendations: any[];
  rawAuditData: any[];
  isIktracker: boolean;
  siteKeywords: string[];
  siteInfo: any;
  scoredWorkbenchItems: any[];
  cmsInventory?: CmsContentInventory | null;
  baselineSeoScore?: SeoScoreV2 | null;
}): Promise<ParmenionDecision | null> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.error('[Parménion] LOVABLE_API_KEY not configured');
    return null;
  }

  const errorHistory = context.pastErrors.length > 0
    ? `\n\nHISTORIQUE D'ERREURS (calibre ton risque en conséquence):\n${context.pastErrors.map((e: any) => 
        `- Cycle #${e.cycle_number}: risque estimé ${e.risk_predicted} → réel ${e.risk_calibrated}. Cause: ${e.calibration_note || 'inconnue'}.`
      ).join('\n')}`
    : '';

  const previousResults = context.previousPhaseResults.length > 0
    ? `\n\nRÉSULTATS DES PHASES PRÉCÉDENTES (utilise ces données pour ta décision):\n${context.previousPhaseResults.map(r => 
        `- Phase "${r.phase}" — ${r.goal}\n  Fonctions: ${r.functions?.join(', ')}\n  Résultats: ${JSON.stringify(r.results).slice(0, 2000)}`
      ).join('\n\n')}`
    : '';

  const pendingRecos = context.pendingRecommendations.length > 0
    ? `\n\nRECOMMANDATIONS EN ATTENTE D'APPLICATION (${context.pendingRecommendations.length}):\n${context.pendingRecommendations.slice(0, 10).map(r =>
        `- [${r.priority}] ${r.title} (${r.category}) — fix_type: ${r.fix_type || 'none'}${r.fix_data ? ' ✓ code disponible' : ''}`
      ).join('\n')}`
    : '';

  const rawData = context.rawAuditData.length > 0
    ? `\n\nDONNÉES D'AUDIT BRUTES DISPONIBLES:\n${context.rawAuditData.map(d =>
        `- ${d.audit_type} (${d.source_functions?.join(', ')}) — ${JSON.stringify(d.raw_payload).slice(0, 1000)}`
      ).join('\n')}`
    : '';

  const phaseInstructions = buildPhaseInstructions(context);

  const systemPrompt = `Tu es Parménion, moteur d'exécution AUTONOME de l'autopilote Crawlers.fr. Tu NE RECOMMANDES PAS, tu AGIS.

${phaseInstructions}

## RÈGLES ABSOLUES
1. Tu ne peux utiliser QUE les fonctions de la phase actuelle
2. Tu ne reviens JAMAIS en arrière dans le pipeline (audit → diagnose → prescribe → execute → validate)
3. Tu ne répètes JAMAIS une action déjà complétée avec succès
4. Tu utilises les résultats des phases précédentes comme INPUT, pas comme prétexte pour re-diagnostiquer
5. INTERDICTIONS: supprimer des pages, modifier la charte graphique

## CONVERSION OPTIMIZER (source: analyze-ux-context)
Le Workbench peut contenir des prescriptions UX/CRO issues du Conversion Optimizer (source_type='ux_context', finding_category='ux_optimization').
Ces items contiennent des corrections de ton, de CTAs, de lisibilité et de conversion avec current_text → suggested_text.
En phase EXECUTE, si tu rencontres ces items, route-les vers content-architecture-advisor pour application via Content Architect ou cms-patch-content.

## PRUDENCE
- Impact: faible | modéré | neutre | avancé | très_avancé
- Risque: 1 à ${context.maxRisk} MAXIMUM${context.conservativeMode ? ' (MODE CONSERVATEUR — erreurs > 20%)' : ''}
- Si risque ≥ 4 → réduis le scope
${errorHistory}${previousResults}${pendingRecos}${rawData}${context.baselineSeoScore ? `\n\n## SCORE SEO BASELINE (déterministe, 0 token LLM)\nScore global: ${context.baselineSeoScore.overall}/100\nAxes: content_depth=${context.baselineSeoScore.axes.content_depth}, heading=${context.baselineSeoScore.axes.heading_structure}, keywords=${context.baselineSeoScore.axes.keyword_relevance}, linking=${context.baselineSeoScore.axes.internal_linking}, meta=${context.baselineSeoScore.axes.meta_quality}, eeat=${context.baselineSeoScore.axes.eeat_signals}\nIssues: ${context.baselineSeoScore.issues.slice(0, 5).join(' | ')}\nOpportunités: ${context.baselineSeoScore.opportunities.slice(0, 3).join(' | ')}` : ''}

## FORMAT DE RÉPONSE (JSON strict, sans texte autour)
{
  "goal": { "type": "...", "cluster_id": "...", "description": "..." },
  "tactic": { "initial_scope": {...}, "final_scope": {...}, "scope_reductions": 0, "estimated_tokens": 0, "target_url": "..." },
  "prudence": { "impact_level": "...", "risk_score": 1, "iterations": 0, "goal_changed": false, "reasoning": "..." },
  "action": { "type": "...", "payload": {...}, "functions": ["..."] },
  "summary": "..."
}`;

  const siteIdentityBlock = context.siteInfo
    ? `\nIDENTITÉ DU SITE:
Nom: ${context.siteInfo.site_name || context.domain}
Secteur: ${context.siteInfo.market_sector || 'Non défini'}
Type: ${context.siteInfo.business_type || 'Non défini'}
Cibles: ${context.siteInfo.client_targets || 'Non définies'}
Contexte: ${context.siteInfo.site_context || 'Non disponible'}`
    : '';

  const keywordsBlock = context.siteKeywords.length > 0
    ? `\nUNIVERS MOTS-CLÉS DU SITE (mots-clés sur lesquels le site se positionne réellement):
${context.siteKeywords.slice(0, 50).join(', ')}

⚠️ RÈGLE CRITIQUE: Tout contenu créé DOIT cibler un mot-clé pertinent pour cet univers sémantique. 
INTERDIT de créer du contenu sur un sujet hors de l'activité du site (ex: ne pas écrire sur le SEO pour un site de comptabilité).
Le mot-clé choisi dans le payload content-architecture-advisor DOIT être en rapport direct avec le secteur d'activité ci-dessus.`
    : '';

  const userPrompt = `Domaine: ${context.domain}
Cycle: ${context.cycle_number}
Phase pipeline: ${context.currentPhase.toUpperCase()}
Mode conservateur: ${context.conservativeMode ? 'OUI' : 'NON'}
CMS cible: ${context.isIktracker ? 'IKtracker (API Supabase)' : 'WordPress (wpsync)'}
${siteIdentityBlock}${keywordsBlock}
${context.cmsInventory && context.cmsInventory.items.length > 0 ? `
CMS_INVENTORY (${context.cmsInventory.items.length} contenus existants, ${context.cmsInventory.drafts.length} brouillons):
${context.cmsInventory.drafts.map(d => `- [BROUILLON] "${d.title}" (slug: ${d.slug}, plateforme: ${d.platform})`).join('\n')}
${context.cmsInventory.published.slice(0, 20).map(d => `- [PUBLIÉ] "${d.title}" (slug: ${d.slug})`).join('\n')}
⚠️ Si tu veux créer un article sur un sujet déjà couvert par un brouillon ci-dessus, utilise "update-post" avec le slug du brouillon au lieu de "create-post".
` : ''}

DIAGNOSTICS DISPONIBLES:
${JSON.stringify(context.diagnostics.map(d => ({ type: d.diagnostic_type, scores: d.scores })), null, 2)}

COCON SÉMANTIQUE:
${context.cocoon ? JSON.stringify({
  clusters: context.cocoon.clusters_count,
  nodes: context.cocoon.nodes_count,
  geo_score: context.cocoon.avg_geo_score,
  eeat_score: context.cocoon.avg_eeat_score,
  content_gap: context.cocoon.avg_content_gap,
  cannibalization: context.cocoon.avg_cannibalization_risk,
  cluster_summary: context.cocoon.cluster_summary,
}, null, 2) : 'Aucun cocon calculé'}

Quelle action concrète exécutes-tu pour la phase ${context.currentPhase.toUpperCase()} ?`;

  try {
    // Try OpenRouter first, then Lovable AI
    const gateways: Array<{ url: string; key: string; label: string }> = [];
    const orKey = Deno.env.get('OPENROUTER_API_KEY');
    if (orKey) gateways.push({ url: 'https://openrouter.ai/api/v1/chat/completions', key: orKey, label: 'OpenRouter' });
    if (LOVABLE_API_KEY) gateways.push({ url: 'https://ai.gateway.lovable.dev/v1/chat/completions', key: LOVABLE_API_KEY, label: 'Lovable' });

    for (const gw of gateways) {
      try {
        const response = await fetch(gw.url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${gw.key}`,
            'Content-Type': 'application/json',
            ...(gw.label === 'OpenRouter' ? { 'HTTP-Referer': 'https://crawlers.fr', 'X-Title': 'Crawlers Parmenion' } : {}),
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.3,
            tools: [{
              type: 'function',
              function: {
                name: 'parmenion_decide',
                description: 'Submit Parménion autonomous action for this autopilot cycle',
                parameters: {
                  type: 'object',
                  properties: {
                    goal: {
                      type: 'object',
                      properties: {
                        type: { type: 'string', enum: ['audit_technical', 'diagnostic_semantic', 'cluster_optimization', 'content_gap', 'content_creation', 'linking', 'technical_fix', 'deployment', 'meta_optimization', 'validation_post_deploy'] },
                        cluster_id: { type: 'string' },
                        description: { type: 'string' },
                      },
                      required: ['type', 'description'],
                    },
                    tactic: {
                      type: 'object',
                      properties: {
                        initial_scope: { type: 'object' },
                        final_scope: { type: 'object' },
                        scope_reductions: { type: 'integer' },
                        estimated_tokens: { type: 'integer' },
                        target_url: { type: 'string' },
                      },
                      required: ['initial_scope', 'final_scope', 'scope_reductions', 'estimated_tokens'],
                    },
                    prudence: {
                      type: 'object',
                      properties: {
                        impact_level: { type: 'string', enum: ['faible', 'modéré', 'neutre', 'avancé', 'très_avancé'] },
                        risk_score: { type: 'integer', minimum: 1, maximum: 3 },
                        iterations: { type: 'integer' },
                        goal_changed: { type: 'boolean' },
                        reasoning: { type: 'string' },
                      },
                      required: ['impact_level', 'risk_score', 'iterations', 'goal_changed', 'reasoning'],
                    },
                    action: {
                      type: 'object',
                      properties: {
                        type: { type: 'string' },
                        payload: { type: 'object' },
                        functions: { type: 'array', items: { type: 'string' } },
                      },
                      required: ['type', 'functions'],
                    },
                  },
                  required: ['goal', 'tactic', 'prudence', 'action'],
                },
              },
            }],
            tool_choice: { type: 'function', function: { name: 'parmenion_decide' } },
          }),
          signal: AbortSignal.timeout(90_000),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`[Parménion] ${gw.label} LLM error ${response.status}:`, errText.slice(0, 300));
          if (response.status === 402 || response.status === 429) continue; // try next gateway
          return null;
        }

        const result = await response.json();
        const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall) {
          console.error(`[Parménion] ${gw.label}: No tool call in LLM response`);
          continue;
        }

        console.log(`[Parménion] ✅ Decision via ${gw.label}`);
        const decision = JSON.parse(toolCall.function.arguments) as ParmenionDecision;
        if (decision.prudence.risk_score > context.maxRisk) {
          decision.prudence.risk_score = context.maxRisk;
        }
        return decision;
      } catch (e) {
        console.error(`[Parménion] ${gw.label} reasoning failed:`, e);
        continue;
      }
    }

    console.error('[Parménion] ❌ All gateways exhausted for reasoning');
    return null;
  } catch (e) {
    console.error('[Parménion] LLM call failed:', e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// PHASE INSTRUCTION BUILDER
// ═══════════════════════════════════════════════════════════════

function buildPhaseInstructions(context: {
  currentPhase: PipelinePhase;
  isIktracker: boolean;
  scoredWorkbenchItems: any[];
}): string {
  switch (context.currentPhase) {
    case 'audit':
      return `## PHASE ACTUELLE: AUDIT (AUDIT MULTI-DIMENSIONNEL)
Tu dois lancer un audit complet du site en combinant PLUSIEURS fonctions pour obtenir une vision 360°.

Fonctions autorisées (lance-les TOUTES les 3):
1. audit-expert-seo — Audit technique pur (performance, indexabilité, erreurs HTTP, structure)
2. strategic-orchestrator — Audit stratégique GEO complet (mots-clés, quick wins, concurrents, positionnement marché, SERP)
3. check-eeat — Évaluation E-E-A-T (expertise, expérience, autorité, fiabilité)

IMPORTANT: Tu DOIS appeler les 3 fonctions dans ta décision pour alimenter le workbench avec des données riches.
Le strategic-orchestrator remonte les mots-clés manquants, les quick wins et la vision marché.
Le check-eeat évalue la crédibilité et l'autorité du site.
Ces données sont ESSENTIELLES pour que les phases suivantes (diagnose, prescribe) produisent des contenus variés et pertinents.

Dans action.functions, liste: ["audit-expert-seo", "strategic-orchestrator", "check-eeat"]`;

    case 'diagnose':
      return `## PHASE ACTUELLE: DIAGNOSE (DIAGNOSTIC STRATÉGIQUE)
L'audit technique est terminé. Tu as les résultats ci-dessous.
Tu dois maintenant lancer UN diagnostic stratégique pour analyser la sémantique, le contenu, la structure ou l'autorité du site.
Fonctions autorisées: cocoon-diag-content, cocoon-diag-semantic, cocoon-diag-structure, cocoon-diag-authority
Choisis la fonction la plus pertinente selon les problèmes révélés par l'audit technique.
IMPORTANT: Ne refais PAS d'audit technique. Les données sont là, utilise-les pour choisir le bon diagnostic.`;

    case 'prescribe':
      return buildPrescribeInstructions(context);

    case 'execute':
      return context.isIktracker ? buildIktrackerExecuteInstructions() : buildWpsyncExecuteInstructions();

    case 'validate':
      return `## PHASE ACTUELLE: VALIDATE (VÉRIFICATION POST-DÉPLOIEMENT)
Les correctifs ont été déployés sur le CMS. Tu dois maintenant VÉRIFIER que les changements sont bien appliqués et mesurer l'impact initial.
Fonctions autorisées: audit-expert-seo, cocoon-diag-content

Tu dois:
1. Lancer un audit-expert-seo ciblé sur les URLs modifiées pour vérifier que les correctifs sont en place
2. OU lancer un cocoon-diag-content pour mesurer l'amélioration du score de contenu

Le payload doit inclure:
- Les URLs ciblées par l'exécution précédente (disponibles dans les résultats des phases précédentes)
- Le type de vérification: "post_deploy_check"

Dans ton goal, utilise le type "validation_post_deploy".
Dans ton summary, compare les métriques avant/après si disponibles.

IMPORTANT: C'est une vérification READ-ONLY. Tu ne modifies RIEN. Tu constates et tu mesures.
Si la validation échoue (correctifs non appliqués), signale-le dans le reasoning avec un risk_score élevé.`;
  }
}

function buildPrescribeInstructions(context: { isIktracker: boolean; scoredWorkbenchItems: any[] }): string {
  const items = context.scoredWorkbenchItems;
  
  if (items.length === 0) {
    return `## PHASE ACTUELLE: PRESCRIBE (GÉNÉRER LES CORRECTIFS)
Aucun item prioritaire n'a été identifié dans le workbench. 
Alterne entre correctif technique et contenu éditorial :
- Si le dernier cycle était technique → utilise content-architecture-advisor pour créer du contenu
- Si le dernier cycle était contenu → utilise generate-corrective-code pour un correctif technique
- En cas de doute, privilégie content-architecture-advisor (le contenu est sous-représenté)
Fonctions autorisées: generate-corrective-code, content-architecture-advisor`;
  }

  const tierNames: Record<number, string> = {
    0: 'Accessibilité critique', 1: 'Performance', 2: 'Crawl mineur',
    3: 'Données structurées GEO', 4: 'On-page mineur (meta)',
    5: 'On-page majeur (contenu)', 6: 'Maillage interne',
    7: 'Cannibalisation', 8: 'Gap par modification',
    9: 'Gap par création', 10: 'Expansion sémantique',
  };

  const itemsTable = items.map((it: any, i: number) => 
    `${i + 1}. [Tier ${it.tier}: ${tierNames[it.tier] || '?'}] Score: ${it.spiral_score} | ${it.severity} | ${it.finding_category}
   "${it.title}" → ${it.target_url || 'N/A'}
   ${it.description?.slice(0, 200) || ''}
   action_type: ${it.action_type} | payload: ${JSON.stringify(it.payload)?.slice(0, 500)}`
  ).join('\n\n');

  // Determine if top items are code or content
  const topItem = items[0];
  const isCodeAction = ['code', 'both'].includes(topItem.action_type) && 
    [0, 1, 2, 3, 4].includes(topItem.tier);
  const isContentAction = ['content', 'both'].includes(topItem.action_type) && 
    topItem.tier >= 5;

  let channelInstruction = '';
  if (isCodeAction) {
    channelInstruction = `→ L'item #1 est de type TECHNIQUE (tier ${topItem.tier}). Utilise generate-corrective-code avec un payload "fixes".`;
  } else if (isContentAction) {
    channelInstruction = `→ L'item #1 est de type CONTENU (tier ${topItem.tier}). Utilise content-architecture-advisor.`;
  } else {
    channelInstruction = `→ Choisis generate-corrective-code (technique) ou content-architecture-advisor (contenu) selon le type de l'item #1.`;
  }

  return `## PHASE ACTUELLE: PRESCRIBE (GÉNÉRER LES CORRECTIFS)

## PRIORITÉS ALGORITHMIQUES (scoring pyramidal — NE CHANGE PAS L'ORDRE)
L'algorithme de scoring a classé les items suivants par priorité. Tu DOIS traiter l'item #1 en priorité.
Tu ne décides PAS quoi faire — l'algorithme l'a déjà décidé. Tu génères le payload correct.

${itemsTable}

## CANAL DE DÉPLOIEMENT
${channelInstruction}

Fonctions autorisées: generate-corrective-code, content-architecture-advisor

## RÈGLES
1. Traite l'item #1. Si tu peux aussi traiter #2 dans le même payload, fais-le.
2. Pour generate-corrective-code: payload DOIT contenir "fixes": [{ "id", "label", "category", "prompt", "enabled": true, "target_url" }]
3. Pour content-architecture-advisor: payload DOIT contenir "url", "keyword" (pertinent au secteur du site), "page_type", "tracked_site_id"
4. Ne refais PAS de diagnostic. Les données sont classées, exécute.
5. Le "goal.description" doit mentionner le tier et l'item traité.`;
}

function buildIktrackerExecuteInstructions(): string {
  return `## PHASE ACTUELLE: EXECUTE (DÉPLOYER SUR IKTRACKER)
Les correctifs sont générés. Tu dois maintenant les APPLIQUER concrètement.

## IMPORTANT: CHOISIS LE BON CANAL DE DÉPLOIEMENT

Tu as DEUX canaux possibles. Choisis selon le TYPE de correctif:

### CANAL 1: CMS CRUD (iktracker-actions)
Pour: modifier title, meta_description, contenu de page/article, créer des articles/pages.
→ functions: ["iktracker-actions"]
→ payload DOIT contenir "cms_actions": [...]

### CANAL 2: JS Injectable (generate-corrective-code)
Pour: scripts techniques (lazy loading, CLS fixes, schema JSON-LD, optimisations performance, etc.)
→ functions: ["generate-corrective-code"]
→ payload DOIT contenir "fixes": [{ "id": "...", "label": "...", "category": "...", "prompt": "...", "enabled": true }]
→ Le code généré sera poussé vers le CMS via cms-push-code si connexion CMS active, sinon via site_script_rules (widget.js)

### CANAL 3: Déploiement natif du code correctif (cms-push-code)
Pour: pousser le JS généré par generate-corrective-code directement dans le CMS de l'utilisateur
→ functions: ["cms-push-code"]
→ payload: { "tracked_site_id", "code", "code_minified", "label", "placement": "header"|"footer", "fixes_summary": [...] }
→ Supporte: WordPress, Shopify, Drupal, Webflow, PrestaShop, Odoo (fallback widget.js si échec ou Wix)

## RÈGLE CRITIQUE
- Si tes correctifs sont du contenu (texte, méta, articles) → CANAL 1 (iktracker-actions + cms_actions)
- Si tes correctifs sont du code technique (JS, performance, schema) → CANAL 2 (generate-corrective-code + fixes)
- NE METS JAMAIS iktracker-actions dans functions si tu n'as pas de cms_actions concrètes
- Tu peux utiliser LES DEUX canaux en parallèle si tu as les deux types de correctifs

## CHAMPS DISPONIBLES SUR IKTRACKER

### Champs PAGES (create-page / update-page)
| Champ | Type | Description |
|-------|------|-------------|
| title | string | Titre affiché de la page |
| meta_title | string | Balise <title> SEO (si différent du title) |
| meta_description | string | Meta description SEO |
| content | object/string | Contenu Markdown de la page |
| canonical_url | string | URL canonique (si cross-posting ou duplicate) |
| schema_org | object | Données structurées JSON-LD (FAQPage, HowTo, etc.) |
| page_key | string | Identifiant unique / slug de la page |

### Champs POSTS (create-post / update-post)
| Champ | Type | Description |
|-------|------|-------------|
| title | string | Titre de l'article |
| slug | string | URL slug en kebab-case sans accents |
| content | string | Contenu Markdown complet et riche |
| excerpt | string | Résumé court affiché en listing/cards (2-3 phrases) |
| meta_description | string | Meta description SEO (max 160 chars) |
| meta_title | string | Balise <title> SEO si différent du title |
| status | string | TOUJOURS "draft" — JAMAIS "published" |
| author_name | string | Nom de l'auteur affiché (ex: "Équipe IKtracker") |
| image_url | string | URL de l'image à la une (hero image) |
| category | string | Catégorie de l'article (ex: "Actualités", "Conseils fiscaux", "Comparatifs") |
| tags | string[] | Tags/mots-clés associés |
| canonical_url | string | URL canonique si republication |
| schema_org | object | Données structurées JSON-LD (Article, BlogPosting, FAQPage) |

## ACTIONS CMS CONCRÈTES (CANAL 1 uniquement)

### Modifier une page existante
{ "action": "update-page", "page_key": "slug-de-la-page", "updates": { "title": "...", "meta_title": "...", "meta_description": "...", "content": "...", "canonical_url": "...", "schema_org": {...} } }

### Modifier un article existant
{ "action": "update-post", "slug": "slug-de-larticle", "updates": { "title": "...", "meta_title": "...", "meta_description": "...", "content": "...", "excerpt": "...", "author_name": "...", "image_url": "...", "category": "...", "tags": [...], "schema_org": {...} } }

### Créer un nouvel article de blog (TOUJOURS EN BROUILLON)
{ "action": "create-post", "body": { "title": "...", "slug": "...", "content": "...", "excerpt": "...", "status": "draft", "meta_description": "...", "meta_title": "...", "author_name": "Équipe IKtracker", "category": "...", "tags": ["...", "..."], "schema_org": { "@context": "https://schema.org", "@type": "BlogPosting", "headline": "...", "description": "...", "author": { "@type": "Organization", "name": "IKtracker" } } } }

### Créer une nouvelle page
{ "action": "create-page", "body": { "title": "...", "page_key": "...", "content": "...", "meta_title": "...", "meta_description": "...", "schema_org": {...} } }

## RÈGLES POUR LA CRÉATION DE CONTENU (create-post)
Quand tu crées un article pour combler un gap de contenu:
1. Le contenu DOIT être en **Markdown** (PAS de HTML) avec :
   - Des titres ## H2 et ### H3 bien structurés
   - Des paragraphes de 3-4 phrases max
   - Des listes à puces (- item) ou numérotées (1. item) quand pertinent
   - Un chapô introductif en **gras**
2. Le contenu DOIT inclure des LIENS INTERNES concrets sous forme [ancre descriptive](https://iktracker.fr/chemin)
   - Utilise les URLs existantes du site trouvées dans les diagnostics et le cocon sémantique
   - Vise 3 à 5 liens internes par article, vers les pages stratégiquement liées
   - Les ancres doivent être naturelles et descriptives (pas "cliquez ici")
3. Inclus 1-2 liens EXTERNES vers des sources de référence si pertinent (documentation officielle, études)
4. Rédige un excerpt ET une meta_description — ce sont DEUX champs distincts:
   - excerpt: résumé affiché en listing (2-3 phrases, engageant)
   - meta_description: optimisé SEO (max 160 chars, avec mot-clé principal)
5. Le status DOIT être "draft" — JAMAIS "published". L'utilisateur validera manuellement.
6. Le slug doit être court, en kebab-case, sans accents
7. Longueur cible: 800-1500 mots minimum
8. TOUJOURS remplir: title, slug, content, excerpt, meta_description, status, author_name, category
9. ⚠️ INDEXABILITÉ : dans le schema_org, ajoute "isAccessibleForFree": true et "datePublished" avec la date du jour (format ISO) si une date est mentionnée
10. Si pertinent, ajouter: meta_title (si différent du title), tags, schema_org (BlogPosting)
11. author_name par défaut: "Équipe IKtracker"
12. ⚠️ FORMAT: N'utilise JAMAIS de balises HTML (<h2>, <p>, <a>, <ul>, etc.). Tout DOIT être en syntaxe Markdown pure.
13. ⚠️ DATES: quand une date / année / millésime est pertinente, elle doit être exacte et cohérente partout : title, H1, H2, H3, paragraphes, FAQ, tableaux, résumés, meta_title, meta_description, excerpt et schema_org. N'ajoute PAS de date si elle n'apporte rien.
14. ⚠️ TITRE / H1: n'utilise PAS automatiquement le mot "Guide". Choisis la forme éditoriale la plus juste selon l'intention réelle : barème, comparatif, procédure, tutoriel, FAQ, actualité, décryptage, mise à jour, analyse, checklist, simulateur, etc.

## RÈGLES SPÉCIFIQUES IKTRACKER
- Le contenu DOIT être pertinent pour l'activité du site. Consulte l'UNIVERS MOTS-CLÉS et l'IDENTITÉ DU SITE fournis dans le contexte.
- Pour IKtracker spécifiquement: indemnités kilométriques, frais réels, gestion de trajets, fiscalité auto-entrepreneur
- INTERDIT de créer du contenu hors-sujet (ex: article sur le SEO, le marketing digital, ou tout autre sujet non lié à l'activité du site)
- Utilise les résultats des diagnostics précédents pour décider QUOI modifier/créer
- Priorise: meta descriptions manquantes → titres non optimisés → contenu thin → nouveaux articles ciblant des content gaps
- Diversifie les actions: mélange modifications de pages existantes ET création de nouveaux contenus quand c'est pertinent
- INTERDIT: supprimer des pages/articles, modifier du contenu qui fonctionne déjà bien
- INTERDIT: publier directement un article (toujours draft)

## INVENTAIRE CMS — CONTENU EXISTANT (brouillons + publié)
⚠️ AVANT DE CRÉER UN ARTICLE, vérifie dans cet inventaire si un brouillon similaire existe déjà.
Si oui, utilise "update-post" pour l'enrichir/modifier au lieu de "create-post".
L'inventaire sera injecté dans le contexte ci-dessous sous la clé CMS_INVENTORY.

- Catégories suggérées: "Actualités", "Conseils fiscaux", "Comparatifs", "Tutoriels", "FAQ", "Décryptages"
- Tags pertinents: "indemnités kilométriques", "frais réels", "barème IK", "déclaration impôts", "auto-entrepreneur", "trajets professionnels"`;
}

function buildWpsyncExecuteInstructions(): string {
  return `## PHASE ACTUELLE: EXECUTE (DÉPLOYER SUR LE SITE)
Les correctifs sont générés. Tu dois maintenant les APPLIQUER via le CMS.
Fonction autorisée: wpsync
Le payload doit contenir:
- Les pages à modifier (URLs)
- Le code correctif à injecter (meta tags, schema, contenu, liens internes)
- Le mode de déploiement (update_post, update_meta, inject_schema)
IMPORTANT: C'est l'étape finale de déploiement. Tu dois déployer, pas diagnostiquer ni prescrire.`;
}

