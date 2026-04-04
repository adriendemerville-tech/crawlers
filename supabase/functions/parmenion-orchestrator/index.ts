import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { buildContentBrief, briefToPromptBlock, detectPageType as sharedDetectPageType } from '../_shared/contentBrief.ts';
import { getSiteContext } from '../_shared/getSiteContext.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

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

const MAX_RISK_NORMAL = 3;
const MAX_RISK_CONSERVATIVE = 2;

// Pipeline phases in strict order
const PIPELINE_PHASES = ['audit', 'diagnose', 'prescribe', 'execute', 'validate'] as const;
// Note: 'route' is handled inline by the engine, not as a separate orchestrator phase
type PipelinePhase = typeof PIPELINE_PHASES[number];

const PHASE_FUNCTIONS: Record<PipelinePhase, string[]> = {
  audit: ['audit-expert-seo', 'check-eeat', 'audit-strategique-ia', 'multi-page-crawl'],
  diagnose: ['cocoon-diag-content', 'cocoon-diag-semantic', 'cocoon-diag-structure', 'cocoon-diag-authority'],
  prescribe: ['cocoon-strategist', 'calculate-cocoon-logic', 'generate-corrective-code', 'content-architecture-advisor'],
  execute: ['wpsync', 'iktracker-actions', 'cms-push-draft', 'cms-push-code', 'cms-patch-content', 'cms-push-redirect', 'generate-corrective-code'],
  validate: ['audit-expert-seo', 'cocoon-diag-content', 'check-eeat'],
};

function isIktrackerDomain(domain: string): boolean {
  return domain.toLowerCase().includes('iktracker');
}

/** Normalize a page_key from LLM output: strip URLs, lowercase, extract last slug segment */
function sanitizePageKey(raw?: string | null): string {
  if (!raw) return 'homepage';
  const trimmed = raw.trim();
  // Already a clean slug
  if (/^[a-z0-9][a-z0-9-]*$/i.test(trimmed)) return trimmed.toLowerCase();
  // Full URL → extract path
  try {
    const parsed = new URL(trimmed);
    const segments = parsed.pathname.split('/').filter(Boolean);
    return segments.length > 0 ? segments[segments.length - 1].toLowerCase() : 'homepage';
  } catch {
    const normalized = trimmed.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+|\/+$/g, '');
    if (!normalized) return 'homepage';
    return normalized.split('/').filter(Boolean).pop()?.toLowerCase() || 'homepage';
  }
}

function getNextPhase(lastPhase: PipelinePhase | undefined): PipelinePhase {
  if (!lastPhase) return 'audit';
  const idx = PIPELINE_PHASES.indexOf(lastPhase);
  if (idx === -1 || idx >= PIPELINE_PHASES.length - 1) return 'audit'; // cycle complete → restart
  return PIPELINE_PHASES[idx + 1];
}

serve(async (req: Request) => {
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
    const currentPhase = (forced_phase && PIPELINE_PHASES.includes(forced_phase)) 
      ? (forced_phase as PipelinePhase) 
      : getNextPhase(lastPhase);

    console.log(`[Parménion] Domain: ${domain}, Cycle: ${cycle_number}, Phase: ${currentPhase}, LastPhase: ${lastPhase || 'none'}, IKtracker: ${isIktracker}`);

    // ═══ PHASE 1: Check error rate → conservative mode? ═══
    const { data: errorRateData } = await supabase.rpc('parmenion_error_rate', { p_domain: domain });
    const conservativeMode = errorRateData?.conservative_mode === true;
    const maxRisk = conservativeMode ? MAX_RISK_CONSERVATIVE : MAX_RISK_NORMAL;

    // ═══ PHASE 2: Gather context ═══
    const [diagnosticsRes, cocoonRes, errorsRes, recoRegistryRes, auditRawRes, siteKeywordsRes, siteInfoRes, identityCard] = await Promise.all([
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
    ]);

    const diagnostics = diagnosticsRes.data || [];
    const cocoon = cocoonRes.data;
    const pastErrors = errorsRes.data || [];
    const pendingRecommendations = recoRegistryRes.data || [];
    const rawAuditData = auditRawRes.data || [];

    const siteKeywords: string[] = [];
    const serpKpis = (siteKeywordsRes as any)?.data?.result_data;
    if (serpKpis?.sample_keywords) {
      for (const kw of serpKpis.sample_keywords) {
        if (kw.keyword) siteKeywords.push(kw.keyword);
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

    // ═══ PHASE 2b: DUAL-LANE ALGORITHMIC SCORING (prescribe phase) ═══
    let scoredWorkbenchItems: any[] = [];
    // PROACTIVE MODE: Always force content if not explicitly disabled — Parménion must always find something to do
    const forceContent = force_content_cycle === true || force_iktracker_article === true;
    const budgetPct = typeof content_budget_pct === 'number' ? content_budget_pct : (force_iktracker_article ? 50 : 30);
    
    if (currentPhase === 'prescribe') {
      const userId = authUserId || bodyUserId || tracked_site_id;
      
      // Option B: Query BOTH lanes independently in parallel
      const [techRes, contentRes] = await Promise.all([
        supabase.rpc('score_workbench_priority', {
          p_domain: domain,
          p_user_id: userId,
          p_limit: 8,
          p_lane: 'tech',
          p_force_content: false,
        }),
        supabase.rpc('score_workbench_priority', {
          p_domain: domain,
          p_user_id: userId,
          p_limit: 8,
          p_lane: 'content',
          p_force_content: forceContent,
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
        console.log(`[Parménion] 📊 Top tech: tier ${allocatedTech[0]?.tier ?? 'none'} score ${allocatedTech[0]?.total_score ?? 0} | Top content: tier ${allocatedContent[0]?.tier ?? 'none'} score ${allocatedContent[0]?.total_score ?? 0}`);
      }
    }

    // ═══ PHASE 3: LLM Decision ═══
    let decision: ParmenionDecision | null = null;
    
    if (currentPhase === 'prescribe' && (scoredWorkbenchItems.length > 0 || forceContent)) {
      // ═══ PRESCRIBE V2: 2 parallel prompts × 2 tools (with dual-lane support) ═══
      // Also triggered when force_content_cycle or force_iktracker_article is set (even with empty workbench)
      
      // If workbench is empty but content is forced, create a synthetic content item
      if (scoredWorkbenchItems.length === 0 && forceContent) {
        console.log(`[Parménion] ⚠️ Workbench empty but force_content=true, creating synthetic content item`);
        scoredWorkbenchItems.push({
          id: '00000000-0000-0000-0000-000000000000',
          title: `Création de contenu éditorial pour ${domain}`,
          description: `Article de blog ou page de contenu pour renforcer l'autorité sémantique du site ${domain}`,
          finding_category: 'missing_page',
          severity: 'high',
          target_url: `https://${domain}`,
          target_selector: null,
          target_operation: 'create',
          action_type: 'content',
          payload: { keyword: siteKeywords[0] || domain.replace(/\.\w+$/, '') },
          source_type: 'forced_cycle',
          tier: 9,
          base_score: 75,
          severity_bonus: 100,
          aging_bonus: 0,
          gate_malus: 0,
          total_score: 175,
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
    } else {
      // Non-prescribe phases or empty workbench without forced content: single LLM call
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
      });
    }

    if (!decision) {
      return jsonError('Parménion could not produce a decision', 500);
    }

    // ═══ PHASE 4: Validate functions against phase ═══
    const allowedFunctions = [...PHASE_FUNCTIONS[currentPhase]];
    const validatedFunctions = decision.action.functions.filter((f: string) => allowedFunctions.includes(f));
    if (validatedFunctions.length === 0) {
      console.warn(`[Parménion] LLM chose invalid functions for phase ${currentPhase}:`, decision.action.functions);
      // Fallback to appropriate function for the phase
      if (currentPhase === 'audit') validatedFunctions.push('audit-expert-seo');
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
    };

    const { data: logData, error: logError } = await supabase
      .from('parmenion_decision_log')
      .insert(logEntry)
      .select('id')
      .single();

    if (logError) {
      console.error('[Parménion] Failed to persist decision:', logError);
      return jsonError('Failed to persist decision', 500);
    }

    return jsonOk({
      decision_id: logData.id,
      decision,
      pipeline_phase: currentPhase,
      conservative_mode: conservativeMode,
      error_rate: errorRateData,
    });

  } catch (e) {
    console.error('[Parménion] Error:', e);
    return jsonError(e instanceof Error ? e.message : 'Unknown error', 500);
  }
});

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
            },
            required: ['title', 'slug', 'content', 'excerpt', 'meta_description', 'status'],
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
// Use shared detectPageType from _shared/contentBrief.ts
const detectPageType = sharedDetectPageType;

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

  const sorted = Array.from(keywordMap.entries())
    .sort((a, b) => (b[1].volume ?? 0) - (a[1].volume ?? 0))
    .slice(0, 40);

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
  const kwCtx = context.siteKeywords.length > 0
    ? `Mots-clés du site: ${context.siteKeywords.slice(0, 30).join(', ')}`
    : '';

  function buildItemsList(lot: any[]): string {
    return lot.map((it: any, i: number) =>
      `${i + 1}. [Tier ${it.tier}: ${TIER_NAMES[it.tier] || '?'}] Score: ${it.total_score} | ${it.severity}
   "${it.title}" → page: ${it.target_url || '?'} | champ: ${it.target_selector || 'auto'} | op: ${it.target_operation || 'replace'}
   ${it.description?.slice(0, 300) || ''}`
    ).join('\n\n');
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
    for (const item of contentItems) {
      const pageType = detectPageType(item);
      if (pageType && templates.has(pageType) && !typeInstructions.has(pageType)) {
        typeInstructions.set(pageType, buildTemplateInstructions(templates.get(pageType)));
      }
      item._detected_page_type = pageType;
    }
    
    const templateBlock = typeInstructions.size > 0
      ? `\n\nTEMPLATES PAR TYPE DE PAGE (APPLIQUE LE TEMPLATE CORRESPONDANT AU TYPE DÉTECTÉ):\n${Array.from(typeInstructions.values()).join('\n\n')}`
      : '';

    // ── KEYWORD ENRICHMENT: aggregate from multiple sources ──
    const keywordEnrichment = await enrichKeywordsForPrescribe(supabase, context.domain, context.tracked_site_id, contentItems);

    // ── CONTENT BRIEF: build deterministic brief for the top content item ──
    const topContentItem = contentItems[0];
    const briefPageType = topContentItem?._detected_page_type || 'article';
    const primaryKw = topContentItem?.payload?.keyword || topContentItem?.payload?.target_keyword || topContentItem?.title || '';
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
        ? Array.from({ length: Math.min(10, keywordEnrichment.totalKeywords) }).map((_, i) => '') // filled from kwEnrichment
        : [],
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

    const todayISO = new Date().toISOString().slice(0, 10);
    const contentPrompt = `Tu es un moteur de production de contenu SEO/GEO. Date du jour : ${todayISO}. Utilise TOUJOURS l'année en cours (${new Date().getFullYear()}) dans tes contenus — JAMAIS 2024 ou une autre année passée.
Génère les tool calls correspondants. Max 4 appels. Ne diagnostique pas, produis du contenu optimisé.

${siteCtx}
${kwCtx}

${briefBlock}

${keywordEnrichment.promptBlock}

ITEMS À TRAITER (par ordre de priorité):
${buildItemsList(contentItems)}

CONTEXTE SECTORIEL OBLIGATOIRE:
Le site traite de : ${context.siteInfo?.market_sector || 'inconnu'}.
${parsedTargetsPrimary ? `Sa cible prioritaire est : ${parsedTargetsPrimary}.` : ''}
${parsedTargetsSecondary ? `Sa cible secondaire est : ${parsedTargetsSecondary}.` : ''}
${context.siteInfo?.products_services ? `Ses produits/services : ${context.siteInfo.products_services}.` : ''}
⛔ Ne JAMAIS produire de contenu hors-sujet. Chaque article DOIT traiter du secteur ci-dessus. INTERDIT de créer du contenu générique sur le SEO, le marketing digital ou tout autre sujet non lié au métier du site.

RÈGLES:
- emit_corrective_content: pour MODIFIER du contenu existant (H1, H2, paragraphes, enrichissement)
- emit_editorial_content: pour CRÉER un nouvel article OU une nouvelle page (combler un gap)
  - Utilise action "create-post" pour les contenus blog éditoriaux (actualités, décryptages, comparatifs, procédures, analyses, FAQ éditoriales)
  - Utilise action "create-page" pour les pages statiques (landing pages, pages de conversion, FAQ globales)
  - DIVERSIFIE : ne crée pas uniquement des articles. Si un gap correspond à une page de service/conversion, utilise create-page.
${context.force_iktracker_article ? `\n⚠️ OBLIGATION ABSOLUE : Tu DOIS appeler emit_editorial_content pour créer UN NOUVEAU CONTENU pertinent pour le secteur du site. Privilégie "create-post" pour le blog, mais si le gap identifié correspond à une page de conversion, utilise "create-page". Cette directive est prioritaire et NON NÉGOCIABLE.\n` : ''}
- status TOUJOURS "draft". author_name: "Équipe ${context.siteInfo?.site_name || context.domain}"
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
      reasoning: `Scoring pyramidal: top item tier ${topItem.tier} (${TIER_NAMES[topItem.tier]}), score ${topItem.total_score}. ${allToolCalls.length} actions produites via dual-prompt.`,
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

async function callLLMWithTools(apiKey: string, prompt: string, tools: any[], model = 'google/gemini-2.5-flash'): Promise<any[]> {
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        tools,
        tool_choice: 'required',
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[Parménion] LLM tool call error:', response.status, err.slice(0, 300));
      return [];
    }

    const result = await response.json();
    const message = result.choices?.[0]?.message;
    const toolCalls = message?.tool_calls || [];
    
    if (toolCalls.length === 0) {
      // Log when LLM responds with text instead of tool calls
      const textContent = message?.content || '';
      console.warn(`[Parménion] ⚠️ LLM returned 0 tool calls (model: ${model}). Text response: ${textContent.slice(0, 200)}${textContent.length > 200 ? '…' : ''}`);
      console.warn(`[Parménion] finish_reason: ${result.choices?.[0]?.finish_reason}, tools count: ${tools.length}`);
    }
    
    return toolCalls.map((tc: any) => ({
      name: tc.function.name,
      arguments: typeof tc.function.arguments === 'string' 
        ? JSON.parse(tc.function.arguments) 
        : tc.function.arguments,
    }));
  } catch (e) {
    console.error('[Parménion] LLM tool call failed:', e);
    return [];
  }
}

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

## PRUDENCE
- Impact: faible | modéré | neutre | avancé | très_avancé
- Risque: 1 à ${context.maxRisk} MAXIMUM${context.conservativeMode ? ' (MODE CONSERVATEUR — erreurs > 20%)' : ''}
- Si risque ≥ 4 → réduis le scope
${errorHistory}${previousResults}${pendingRecos}${rawData}

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
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
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
                  required: ['type', 'payload', 'functions'],
                },
                summary: { type: 'string' },
              },
              required: ['goal', 'tactic', 'prudence', 'action', 'summary'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'parmenion_decide' } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Parménion] LLM error ${response.status}:`, errText);
      return null;
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error('[Parménion] No tool call in LLM response');
      return null;
    }

    const decision = JSON.parse(toolCall.function.arguments) as ParmenionDecision;

    // Enforce risk ceiling
    if (decision.prudence.risk_score > context.maxRisk) {
      decision.prudence.risk_score = context.maxRisk;
    }

    return decision;
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
      return `## PHASE ACTUELLE: AUDIT (AUDIT TECHNIQUE)
Tu dois lancer un audit technique complet du site pour identifier les problèmes SEO techniques (performance, indexabilité, erreurs HTTP, structure).
Fonction autorisée: audit-expert-seo
Cet audit fournira les données brutes nécessaires aux diagnostics stratégiques de la phase suivante.
IMPORTANT: C'est un scan technique pur. Ne fais PAS de recommandations stratégiques ici.`;

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
    `${i + 1}. [Tier ${it.tier}: ${tierNames[it.tier] || '?'}] Score: ${it.total_score} | ${it.severity} | ${it.finding_category}
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

function serve(handler: (req: Request) => Promise<Response>) {
  Deno.serve(handler);
}