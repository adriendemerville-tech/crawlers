import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { readSiteMemory, writeSiteMemory, applyIdentityUpdates } from '../_shared/siteMemory.ts';
import { getSiteContext } from '../_shared/getSiteContext.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { scanCmsContent, findMatchingContent, type CmsContentInventory } from '../_shared/cmsContentScanner.ts';
import { getSavPatternsForStrategist } from '../_shared/crossAgentContext.ts';
import { computeCrawlPageQuality, resolveBusinessProfile, type CrawlPageInput } from '../_shared/crawlPageQuality.ts';

/**
 * cocoon-strategist: Orchestrateur Stratège 360°
 * 
 * 1. Lance les 4 diagnostics en parallèle (ou récupère les résultats récents)
 * 2. Consolide les findings, détecte les conflits
 * 3. Priorise et génère un plan stratégique (max 8 tâches/cycle)
 * 4. Persiste dans cocoon_strategy_plans
 * 5. Renvoie le plan + résumé pour l'assistant Cocoon
 * 
 * Content Architect awareness (v5 — layout Canva):
 * - Les tâches execution_mode='content_architect' sont routées vers le Content Architect UI
 * - L'UI dispose de 7 panneaux: Prompt, Structure, Images, Données structurées, Brouillon, Bibliothèque, Options
 * - Le stratège prescrit des image_recommendation (styles, count, placements) adaptées au secteur
 * - Le stratège peut prendre la main dans /cocoon pour guider l'utilisateur dans Content Architect
 * - Hors /cocoon, c'est Félix (SAV) qui assiste l'utilisateur dans Content Architect
 * 
 * Input: { tracked_site_id, domain, force_refresh?: boolean, lang?: 'fr'|'en'|'es', task_budget?: number }
 * Output: { strategy, diagnostics_summary, conflicts_resolved, plan_id }
 */

const MAX_DIAG_AGE_HOURS = 24;
const DEFAULT_TASK_BUDGET = 8;

// Priority weights for scoring
const SEVERITY_WEIGHTS = { critical: 10, warning: 5, info: 1 };
const CATEGORY_WEIGHTS: Record<string, number> = {
  content: 1.2,
  semantic: 1.3,
  structure: 1.1,
  authority: 1.0,
};

// Action types the strategist can prescribe
type ActionType = 
  | 'create_content'
  | 'rewrite_content'
  | 'delete_content'
  | 'publish_draft'
  | 'add_internal_link'
  | 'remove_internal_link'
  | 'fix_redirect_chain'
  | 'restructure_tree'
  | 'enrich_metadata'
  | 'fix_technical'
  | 'fix_cannibalization'
  | 'improve_eeat'
  | 'optimize_keyword_placement'
  | 'optimize_conversion';  // UX/CRO optimization via Conversion Optimizer

// ═══════════════════════════════════════════════════════════
// KEYWORD PLACEMENT ENGINE
// Determines optimal keyword position in title & first sentence
// ═══════════════════════════════════════════════════════════

interface KeywordPlacement {
  keyword: string;
  current_title: string;
  suggested_title: string;
  keyword_position: 'front' | 'mid' | 'end';
  title_length: number;
  reasoning: string;
  first_sentence_instruction: string;
}

/**
 * SEO best practices for keyword placement in titles:
 * 1. Front-loading (first 3 words) = strongest signal, preferred for short-tail competitive KW
 * 2. Mid-placement = natural reading, good for long-tail or branded queries
 * 3. End-placement = weakest signal, only acceptable if front/mid breaks readability
 * 
 * Title length arbitration:
 * - Ideal: 50-60 chars (Google truncates at ~60)
 * - If keyword at front pushes title > 60 chars → consider mid-placement
 * - If keyword is long (>25 chars) → mid or split across title
 * 
 * First sentence rule:
 * - Keyword MUST appear in first 160 chars (meta description zone)
 * - Ideally in first sentence, naturally integrated
 * - Must echo the title's keyword without exact duplication
 */
function computeKeywordPlacement(
  keyword: string,
  currentTitle: string,
  parentKeywords: string[],
): KeywordPlacement {
  const kwLower = keyword.toLowerCase();
  const titleLower = currentTitle.toLowerCase();
  const kwLen = keyword.length;
  const titleLen = currentTitle.length;

  const kwIndex = titleLower.indexOf(kwLower);
  const kwAlreadyPresent = kwIndex >= 0;
  const kwInFront = kwAlreadyPresent && kwIndex < 20;

  let bestPosition: 'front' | 'mid' | 'end' = 'front';
  let reasoning = '';

  // Short keyword → front-load for max signal
  if (kwLen <= 20) {
    const frontTitle = `${keyword} : ${currentTitle.replace(new RegExp(keyword, 'i'), '').trim()}`;
    if (frontTitle.length <= 60) {
      bestPosition = 'front';
      reasoning = `Mot-clé court (${kwLen}c) → front-loading, signal SEO max. Title: ${frontTitle.length}c (≤60).`;
    } else {
      bestPosition = 'mid';
      reasoning = `Mot-clé court mais front-loading → ${frontTitle.length}c (>60). Placement central.`;
    }
  } else {
    bestPosition = 'mid';
    reasoning = `Mot-clé long (${kwLen}c) → placement central pour lisibilité.`;
    if (titleLen < 30) {
      bestPosition = 'front';
      reasoning = `Mot-clé long mais title court (${titleLen}c). Front-loading possible.`;
    }
  }

  // Parent overlap → mid for hierarchical differentiation
  const parentOverlap = parentKeywords.some(pk => 
    kwLower.includes(pk.toLowerCase()) || pk.toLowerCase().includes(kwLower)
  );
  if (parentOverlap && bestPosition === 'front') {
    bestPosition = 'mid';
    reasoning += ` Chevauchement parent → mid-placement pour différenciation.`;
  }

  // Build suggested title
  let suggestedTitle = currentTitle;
  if (!kwAlreadyPresent) {
    switch (bestPosition) {
      case 'front':
        suggestedTitle = `${keyword} : ${currentTitle}`;
        break;
      case 'mid': {
        const words = currentTitle.split(' ');
        const midIdx = Math.floor(words.length / 2);
        words.splice(midIdx, 0, `– ${keyword} –`);
        suggestedTitle = words.join(' ');
        break;
      }
      case 'end':
        suggestedTitle = `${currentTitle} | ${keyword}`;
        break;
    }
    if (suggestedTitle.length > 60) suggestedTitle = suggestedTitle.slice(0, 57) + '...';
  } else if (!kwInFront && bestPosition === 'front') {
    const stripped = currentTitle.replace(new RegExp(keyword, 'i'), '').replace(/\s{2,}/g, ' ').trim();
    suggestedTitle = `${keyword} : ${stripped}`;
    if (suggestedTitle.length > 60) suggestedTitle = suggestedTitle.slice(0, 57) + '...';
  }

  const firstSentenceInstruction = bestPosition === 'front'
    ? `Commencer la 1ère phrase par une reformulation naturelle de "${keyword}". Ex: "Le/La ${keyword} est..." ou "Découvrez comment ${keyword}..."`
    : `Intégrer "${keyword}" dans les 2 premières phrases naturellement, sans répéter le title exact. Varier: synonyme, question, contexte.`;

  return {
    keyword,
    current_title: currentTitle,
    suggested_title: suggestedTitle,
    keyword_position: bestPosition,
    title_length: suggestedTitle.length,
    reasoning,
    first_sentence_instruction: firstSentenceInstruction,
  };
}

interface ImageRecommendation {
  suggested_styles: string[];   // e.g. ['photo', 'infographic', 'flat_illustration']
  image_count: number;          // 1-3
  placements: ('header' | 'body')[];
  reasoning: string;
}

type TaskUrgency = 'critical' | 'high' | 'medium' | 'low';

interface StrategicTask {
  id: string;
  action_type: ActionType;
  priority: number; // 0-100
  urgency: TaskUrgency;
  executor_function: string; // exact edge function for deterministic routing
  title: string;
  description: string;
  affected_urls: string[];
  source_diagnostics: string[]; // which diag modules produced this
  execution_mode: 'content_architect' | 'code_architect' | 'operational_queue';
  is_destructive: boolean;
  depends_on: string[]; // task ids that must complete first
  estimated_impact: 'high' | 'medium' | 'low';
  metadata?: Record<string, any>;
  image_recommendation?: ImageRecommendation;
}

// Content-creation action types that get boosted when content_priority_mode is ON
const CONTENT_PRIORITY_ACTIONS: ActionType[] = [
  'create_content', 'rewrite_content', 'publish_draft', 'improve_eeat',
  'optimize_keyword_placement',
];

/** Map execution_mode + action_type to the exact function to call */
function resolveExecutorFn(task: StrategicTask, isIktracker: boolean): string {
  if (task.execution_mode === 'content_architect') return 'content-architecture-advisor';
  if (task.execution_mode === 'code_architect') return 'generate-corrective-code';
  if (task.action_type === 'add_internal_link' || task.action_type === 'remove_internal_link') {
    return isIktracker ? 'iktracker-actions' : 'cms-push-code';
  }
  if (task.action_type === 'fix_redirect_chain') return 'cms-push-redirect';
  if (task.action_type === 'publish_draft') return isIktracker ? 'iktracker-actions' : 'cms-push-draft';
  return isIktracker ? 'iktracker-actions' : 'cms-push-code';
}

/** Derive urgency from impact + severity */
function deriveUrgency(impact: 'high' | 'medium' | 'low', isDestructive: boolean): TaskUrgency {
  if (impact === 'high' && !isDestructive) return 'critical';
  if (impact === 'high') return 'high';
  if (impact === 'medium') return 'medium';
  return 'low';
}

interface ConflictResolution {
  conflict_type: string;
  finding_a: string;
  finding_b: string;
  resolution: string;
  chosen_action: string;
}

// ═══════════════════════════════════════════════════════════
// LABELS MULTILINGUES
// ═══════════════════════════════════════════════════════════
const LABELS: Record<string, Record<string, string>> = {
  fr: {
    thin_content: 'Étoffer le contenu de la page',
    missing_h1: 'Ajouter un H1 optimisé',
    missing_meta: 'Rédiger la meta description',
    duplicate_content: 'Dédupliquer ou consolider le contenu',
    content_decay: 'Rafraîchir le contenu obsolète',
    missing_alt: 'Ajouter les attributs alt aux images',
    cannibalization: 'Résoudre la cannibalisation de mots-clés',
    keyword_gap: 'Créer du contenu pour combler le gap sémantique',
    intent_mismatch: 'Réaligner l\'intention de recherche',
    orphan_page: 'Intégrer la page orpheline au maillage',
    deep_page: 'Réduire la profondeur de crawl',
    redirect_chain: 'Corriger la chaîne de redirections',
    broken_link: 'Réparer les liens cassés (404)',
    low_authority: 'Renforcer l\'autorité de la page',
    anchor_over_optimized: 'Diversifier les ancres de liens',
    low_pagerank: 'Améliorer le maillage interne vers cette page',
    eeat_weak: 'Renforcer les signaux E-E-A-T',
    restructure: 'Réorganiser l\'arborescence du site',
    create_pillar: 'Créer une page pilier pour ce cluster',
    backlink_target: 'Améliorer le maillage interne vers cette page',
    optimize_kw_placement: 'Optimiser le placement du mot-clé dans le title',
  },
  en: {
    thin_content: 'Expand page content',
    missing_h1: 'Add an optimized H1',
    missing_meta: 'Write the meta description',
    duplicate_content: 'Deduplicate or consolidate content',
    content_decay: 'Refresh outdated content',
    missing_alt: 'Add alt attributes to images',
    cannibalization: 'Resolve keyword cannibalization',
    keyword_gap: 'Create content to fill the semantic gap',
    intent_mismatch: 'Realign search intent',
    orphan_page: 'Integrate orphan page into internal linking',
    deep_page: 'Reduce crawl depth',
    redirect_chain: 'Fix redirect chain',
    broken_link: 'Fix broken links (404)',
    low_authority: 'Strengthen page authority',
    anchor_over_optimized: 'Diversify link anchors',
    low_pagerank: 'Improve internal linking to this page',
    eeat_weak: 'Strengthen E-E-A-T signals',
    restructure: 'Restructure site architecture',
    create_pillar: 'Create a pillar page for this cluster',
    backlink_target: 'Improve internal linking to this page',
    optimize_kw_placement: 'Optimize keyword placement in title',
  },
  es: {
    thin_content: 'Ampliar el contenido de la página',
    missing_h1: 'Añadir un H1 optimizado',
    missing_meta: 'Redactar la meta descripción',
    duplicate_content: 'Deduplicar o consolidar el contenido',
    content_decay: 'Actualizar el contenido obsoleto',
    missing_alt: 'Añadir atributos alt a las imágenes',
    cannibalization: 'Resolver la canibalización de palabras clave',
    keyword_gap: 'Crear contenido para llenar el gap semántico',
    intent_mismatch: 'Realinear la intención de búsqueda',
    orphan_page: 'Integrar la página huérfana en el enlazado',
    deep_page: 'Reducir la profundidad de rastreo',
    redirect_chain: 'Corregir la cadena de redirecciones',
    broken_link: 'Reparar los enlaces rotos (404)',
    low_authority: 'Reforzar la autoridad de la página',
    anchor_over_optimized: 'Diversificar los anclajes de enlaces',
    low_pagerank: 'Mejorar el enlazado interno a esta página',
    eeat_weak: 'Reforzar las señales E-E-A-T',
    restructure: 'Reorganizar la arquitectura del sitio',
    create_pillar: 'Crear una página pilar para este cluster',
    backlink_target: 'Mejorar el enlazado interno a esta página',
    optimize_kw_placement: 'Optimizar la ubicación de la palabra clave en el título',
  },
};

// ═══════════════════════════════════════════════════════════
// IMAGE RECOMMENDATION ENGINE
// Determines optimal visual strategy per page type & identity
// ═══════════════════════════════════════════════════════════

const PAGE_TYPE_IMAGE_MAP: Record<string, { styles: string[]; count: number; placements: ('header' | 'body')[] }> = {
  article:  { styles: ['photo', 'infographic'],           count: 2, placements: ['header', 'body'] },
  product:  { styles: ['photo', 'cinematic'],              count: 2, placements: ['header', 'body'] },
  landing:  { styles: ['cinematic', 'flat_illustration'],  count: 1, placements: ['header'] },
  faq:      { styles: ['flat_illustration', 'infographic'],count: 1, placements: ['body'] },
  category: { styles: ['photo'],                           count: 1, placements: ['header'] },
  homepage: { styles: ['cinematic', 'photo'],              count: 1, placements: ['header'] },
  pillar:   { styles: ['infographic', 'photo'],            count: 3, placements: ['header', 'body'] },
};

const SECTOR_STYLE_OVERRIDES: Record<string, string[]> = {
  'food':         ['photo', 'cinematic'],
  'restaurant':   ['photo', 'cinematic'],
  'tech':         ['flat_illustration', 'infographic'],
  'saas':         ['flat_illustration', 'infographic'],
  'fashion':      ['photo', 'cinematic', 'artistic'],
  'luxury':       ['cinematic', 'artistic'],
  'health':       ['photo', 'flat_illustration'],
  'education':    ['infographic', 'flat_illustration'],
  'finance':      ['infographic', 'typography'],
  'real_estate':  ['photo', 'cinematic'],
  'travel':       ['photo', 'cinematic', 'watercolor'],
  'art':          ['artistic', 'watercolor', 'classic_painting'],
};

function computeImageRecommendation(
  pageType: string,
  contentLength: string | null,
  sector: string | null,
  lang: string,
): ImageRecommendation {
  const base = PAGE_TYPE_IMAGE_MAP[pageType] || PAGE_TYPE_IMAGE_MAP['article'];
  let styles = [...base.styles];
  let count = base.count;
  const placements = [...base.placements];

  // Override styles based on sector
  if (sector) {
    const sectorLower = sector.toLowerCase();
    for (const [key, overrideStyles] of Object.entries(SECTOR_STYLE_OVERRIDES)) {
      if (sectorLower.includes(key)) {
        styles = overrideStyles;
        break;
      }
    }
  }

  // More images for longer content
  if (contentLength === 'long' || contentLength === 'pillar') {
    count = Math.min(count + 1, 3);
    if (!placements.includes('body')) placements.push('body');
  }

  const reasonings: Record<string, string> = {
    fr: `${count} image(s) recommandée(s) en style ${styles.join('/')} — placement: ${placements.join(' + ')}`,
    en: `${count} image(s) recommended in ${styles.join('/')} style — placement: ${placements.join(' + ')}`,
    es: `${count} imagen(es) recomendada(s) en estilo ${styles.join('/')} — ubicación: ${placements.join(' + ')}`,
  };

  return {
    suggested_styles: styles,
    image_count: count,
    placements,
    reasoning: reasonings[lang] || reasonings['fr'],
  };
}

function label(key: string, lang: string): string {
  return LABELS[lang]?.[key] || LABELS['fr'][key] || key;
}

Deno.serve(handleRequest(async (req) => {
try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return jsonError('Unauthorized', 401);
    }

    const { tracked_site_id, domain, force_refresh = false, lang = 'fr', task_budget, content_priority_mode = false, is_iktracker = false } = await req.json();
    if (!tracked_site_id || !domain) {
      return jsonError('tracked_site_id and domain required', 400);
    }

    const budget = Math.min(task_budget || DEFAULT_TASK_BUDGET, 12);
    const supabase = getServiceClient();

    // ═══════════════════════════════════════════════════════════
    // PHASE 0: Read persistent site memory for context
    // ═══════════════════════════════════════════════════════════
    let siteMemoryContext = '';
    try {
      const { promptSnippet, entries } = await readSiteMemory(tracked_site_id);
      siteMemoryContext = promptSnippet;
      if (entries.length > 0) {
        console.log(`[strategist] Loaded ${entries.length} memory entries for ${domain}`);
      }
    } catch (e) {
      console.error('[strategist] Memory read error:', e);
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 0b: Read SAV conversation patterns (cross-agent)
    // ═══════════════════════════════════════════════════════════
    let savPatternsContext = '';
    try {
      const { snippet: savSnippet, patterns } = await getSavPatternsForStrategist(auth.userId, domain);
      if (savSnippet) {
        savPatternsContext = savSnippet;
        console.log(`[strategist] Loaded ${patterns.length} SAV patterns for ${domain}`);
      }
    } catch (e) {
      console.error('[strategist] SAV patterns read error:', e);
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 1: Collecter les diagnostics + audit stratégique (parallèle)
    // ═══════════════════════════════════════════════════════════
    const diagTypes = ['content', 'semantic', 'structure', 'authority'];
    const cutoff = new Date(Date.now() - MAX_DIAG_AGE_HOURS * 3600 * 1000).toISOString();

    // Fetch recent diagnostics + strategic audit data + keyword cloud + EEAT data + spiral scores in parallel
    const [diagsResult, strategicAuditResult, siteContextResult, serpKeywordsResult, eeatAuditResult, spiralDataResult] = await Promise.all([
      supabase
        .from('cocoon_diagnostic_results')
        .select('*')
        .eq('tracked_site_id', tracked_site_id)
        .gte('created_at', cutoff)
        .in('diagnostic_type', diagTypes),
      // Load strategic audit SERP recommendations (content_gaps, missing_terms, keyword_positioning)
      supabase
        .from('audit_raw_data')
        .select('raw_payload, audit_type')
        .eq('domain', domain)
        .in('audit_type', ['strategic', 'strategic_parallel'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Load site identity card via getSiteContext (auto-enrichment)
      getSiteContext(supabase, { trackedSiteId: tracked_site_id, userId: auth.userId }).catch(e => {
        console.warn('[strategist] Could not fetch site context:', e);
        return null;
      }),
      // Load keyword cloud from SERP snapshots (reference universe)
      supabase
        .from('serp_snapshots')
        .select('sample_keywords')
        .eq('tracked_site_id', tracked_site_id)
        .order('measured_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Load latest EEAT audit data
      supabase
        .from('audit_raw_data')
        .select('raw_payload, created_at')
        .eq('domain', domain)
        .eq('audit_type', 'eeat')
        .eq('user_id', auth.userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Load spiral_score data from workbench (Breathing Spiral context)
      supabase
        .from('architect_workbench')
        .select('target_url, spiral_score, velocity_decay_score, cluster_maturity_pct, conversion_weight, finding_category')
        .eq('tracked_site_id', tracked_site_id)
        .in('status', ['pending', 'in_progress'])
        .not('spiral_score', 'is', null)
        .order('spiral_score', { ascending: false })
        .limit(50),
    ]);

    // ═══════════════════════════════════════════════════════════
    // PHASE 0c: Extract Breathing Spiral context
    // ═══════════════════════════════════════════════════════════
    const spiralItems = (spiralDataResult as any)?.data || [];
    const spiralUrlScoreMap = new Map<string, number>();
    let avgSpiralScore = 0;
    let spiralPhase: 'contraction' | 'expansion' | 'neutral' = 'neutral';

    if (spiralItems.length > 0) {
      for (const item of spiralItems) {
        if (item.target_url && item.spiral_score != null) {
          spiralUrlScoreMap.set(item.target_url, item.spiral_score);
        }
      }
      avgSpiralScore = Math.round(spiralItems.reduce((s: number, it: any) => s + (it.spiral_score || 0), 0) / spiralItems.length);
      // High avg spiral_score = many declining signals → contraction phase (consolidate core)
      // Low avg spiral_score = stable → expansion phase (grow to new topics)
      spiralPhase = avgSpiralScore >= 50 ? 'contraction' : avgSpiralScore >= 25 ? 'neutral' : 'expansion';
      console.log(`[strategist] 🌀 Breathing Spiral: ${spiralItems.length} items, avg score ${avgSpiralScore}, phase: ${spiralPhase}`);
    }

    // Extract keyword cloud as reference universe
    const keywordCloud: string[] = [];
    const serpKwData = (serpKeywordsResult as any)?.data?.sample_keywords;
    if (Array.isArray(serpKwData)) {
      for (const kw of serpKwData) {
        if (kw?.keyword) keywordCloud.push(kw.keyword);
      }
      if (keywordCloud.length > 0) {
        console.log(`[strategist] ☁️ Keyword cloud loaded: ${keywordCloud.length} keywords (${keywordCloud.slice(0, 5).join(', ')}...)`);
      }
    }

    // Extract identity data from site context
    const siteIdentityData = siteContextResult ? {
      site_name: siteContextResult.site_name,
      market_sector: siteContextResult.market_sector,
      business_type: siteContextResult.business_type,
      entity_type: siteContextResult.entity_type,
      commercial_model: siteContextResult.commercial_model,
      products_services: siteContextResult.products_services,
      target_audience: siteContextResult.target_audience,
      commercial_area: siteContextResult.commercial_area,
      company_size: siteContextResult.company_size,
      competitors: siteContextResult.competitors,
      client_targets: (siteContextResult as any).client_targets,
      jargon_distance: (siteContextResult as any).jargon_distance,
      identity_confidence: siteContextResult.identity_confidence,
    } : null;

    if (siteIdentityData) {
      console.log(`[strategist] Identity card loaded: sector=${siteIdentityData.market_sector || 'unknown'}, confidence=${siteIdentityData.identity_confidence || 0}`);
    }

    // Extract strategic audit SERP data
    let strategicSerpData: {
      content_gaps: any[];
      missing_terms: any[];
      keyword_positioning: any;
      priority_content: any;
      market_sector: string;
    } | null = null;

    if (strategicAuditResult.data?.raw_payload) {
      const payload = strategicAuditResult.data.raw_payload as any;
      const kp = payload?.keyword_positioning;
      const pc = payload?.priority_content;
      if (kp || pc) {
        strategicSerpData = {
          content_gaps: kp?.content_gaps || [],
          missing_terms: kp?.missing_terms || [],
          keyword_positioning: kp ? {
            main_keywords: (kp.main_keywords || []).slice(0, 10),
            quick_wins: kp.quick_wins || [],
            opportunities: kp.opportunities || [],
            competitive_gaps: kp.competitive_gaps || [],
            serp_recommendations: kp.serp_recommendations || [],
          } : null,
          priority_content: pc || null,
          market_sector: siteIdentityData?.market_sector || '',
        };
        console.log(`[strategist] Loaded strategic audit SERP data: ${strategicSerpData.content_gaps.length} gaps, ${strategicSerpData.missing_terms.length} missing terms, ${strategicSerpData.keyword_positioning?.main_keywords?.length || 0} keywords`);
      }
    }

    const existingByType: Record<string, any> = {};
    (diagsResult.data || []).forEach((d: any) => {
      if (!existingByType[d.diagnostic_type] || d.created_at > existingByType[d.diagnostic_type].created_at) {
        existingByType[d.diagnostic_type] = d;
      }
    });

    // Determine which diagnostics need refreshing
    const missingTypes = force_refresh ? diagTypes : diagTypes.filter(t => !existingByType[t]);

    // Launch missing diagnostics in parallel via internal function calls
    if (missingTypes.length > 0) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

      const diagPromises = missingTypes.map(async (diagType) => {
        const fnName = `cocoon-diag-${diagType}`;
        try {
          const resp = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({ tracked_site_id, domain, lang }),
          });
          if (resp.ok) {
            const result = await resp.json();
            existingByType[diagType] = {
              diagnostic_type: diagType,
              findings: result.findings || [],
              scores: result.scores || {},
              metadata: result.metadata || {},
            };
          }
        } catch (err) {
          console.error(`Diagnostic ${diagType} failed:`, err);
        }
      });

      await Promise.all(diagPromises);
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 2: Consolidation & Détection de conflits
    // ═══════════════════════════════════════════════════════════
    const allFindings: Array<any & { source_type: string }> = [];
    const diagnosticsSummary: Record<string, any> = {};

    for (const dtype of diagTypes) {
      const diag = existingByType[dtype];
      if (!diag) continue;

      diagnosticsSummary[dtype] = {
        scores: diag.scores || {},
        finding_count: (diag.findings || []).length,
        critical_count: (diag.findings || []).filter((f: any) => f.severity === 'critical').length,
      };

      for (const finding of (diag.findings || [])) {
        allFindings.push({ ...finding, source_type: dtype });
      }
    }

    // Detect conflicts (e.g., "delete page X" from structure vs "enrich page X" from content)
    const conflicts: ConflictResolution[] = [];
    const urlActionMap: Record<string, Array<{ finding: any; source: string }>> = {};

    for (const f of allFindings) {
      for (const url of (f.affected_urls || [])) {
        if (!urlActionMap[url]) urlActionMap[url] = [];
        urlActionMap[url].push({ finding: f, source: f.source_type });
      }
    }

    // Check for contradictions per URL
    for (const [url, entries] of Object.entries(urlActionMap)) {
      const categories = entries.map(e => e.finding.category);
      
      // Conflict: orphan_pages (suggests removal) vs thin_content (suggests enrichment)
      const hasOrphan = categories.includes('orphan_pages');
      const hasThin = categories.includes('thin_content');
      if (hasOrphan && hasThin) {
        conflicts.push({
          conflict_type: 'orphan_vs_enrich',
          finding_a: 'orphan_pages',
          finding_b: 'thin_content',
          resolution: 'Priorité à l\'enrichissement puis intégration au maillage',
          chosen_action: 'rewrite_then_link',
        });
        // Remove the orphan finding for this URL to avoid double-prescription
        const orphanIdx = allFindings.findIndex(
          f => f.category === 'orphan_pages' && (f.affected_urls || []).includes(url)
        );
        if (orphanIdx >= 0) {
          allFindings[orphanIdx]._suppressed = true;
        }
      }

      // Conflict: cannibalization (merge) vs keyword_gap (new content)
      const hasCannib = categories.includes('cannibalization');
      if (hasCannib && entries.length > 2) {
        conflicts.push({
          conflict_type: 'cannibalization_vs_expansion',
          finding_a: 'cannibalization',
          finding_b: 'multiple_findings',
          resolution: 'Résoudre la cannibalisation avant de créer du nouveau contenu',
          chosen_action: 'fix_cannibalization_first',
        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 2b: Inject strategic audit SERP data into content findings
    // ═══════════════════════════════════════════════════════════
    if (strategicSerpData) {
      // Enrich keyword_gaps findings with strategic audit context
      for (const f of allFindings) {
        if (f.category === 'keyword_gaps' && f.data) {
          f.data.strategic_serp_context = {
            strategic_content_gaps: strategicSerpData.content_gaps,
            strategic_missing_terms: strategicSerpData.missing_terms,
            strategic_priorities: strategicSerpData.priority_content,
          };
        }
        // Enrich thin_content / content_decay with relevant keywords
        if (['thin_content', 'content_decay', 'duplicate_content'].includes(f.category) && f.data) {
          f.data.strategic_serp_context = {
            market_sector: strategicSerpData.market_sector,
            recommended_keywords: strategicSerpData.keyword_positioning?.main_keywords?.map((k: any) => k.keyword).filter(Boolean) || [],
            missing_terms: strategicSerpData.missing_terms?.map((t: any) => t.term).filter(Boolean) || [],
          };
        }
      }

      // If strategic audit has content_gaps but no keyword_gaps finding exists, create one
      const hasKeywordGapFinding = allFindings.some(f => f.category === 'keyword_gaps');
      if (!hasKeywordGapFinding && strategicSerpData.content_gaps.length > 0) {
        allFindings.push({
          category: 'keyword_gaps',
          severity: 'warning',
          description: `Gaps de contenu identifiés par l'audit stratégique: ${strategicSerpData.content_gaps.map((g: any) => g.keyword || g.title).join(', ')}`,
          affected_urls: [],
          source_type: 'strategic_audit',
          data: {
            top_gaps: strategicSerpData.content_gaps.map((g: any) => g.keyword || g.title).filter(Boolean),
            strategic_serp_context: {
              strategic_content_gaps: strategicSerpData.content_gaps,
              strategic_missing_terms: strategicSerpData.missing_terms,
              strategic_priorities: strategicSerpData.priority_content,
            },
          },
        });
        console.log(`[strategist] Added ${strategicSerpData.content_gaps.length} content gaps from strategic audit`);
      }
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 2c-bis: Inject EEAT audit data into findings
    // ═══════════════════════════════════════════════════════════
    const eeatPayload = (eeatAuditResult as any)?.data?.raw_payload;
    if (eeatPayload) {
      console.log(`[strategist] 🏅 EEAT data loaded: score ${eeatPayload.score}/100`);
      if (eeatPayload.score < 60) {
        allFindings.push({
          category: 'eeat_signals',
          severity: eeatPayload.score < 30 ? 'critical' : 'warning',
          description: `Score E-E-A-T: ${eeatPayload.score}/100. Experience: ${eeatPayload.experience}, Expertise: ${eeatPayload.expertise}, Authoritativeness: ${eeatPayload.authoritativeness}, Trustworthiness: ${eeatPayload.trustworthiness}. Problèmes: ${(eeatPayload.issues || []).slice(0, 5).join('; ')}`,
          affected_urls: [],
          source_type: 'eeat_audit',
          data: {
            score: eeatPayload.score,
            experience: eeatPayload.experience,
            expertise: eeatPayload.expertise,
            authoritativeness: eeatPayload.authoritativeness,
            trustworthiness: eeatPayload.trustworthiness,
            issues: eeatPayload.issues,
            strengths: eeatPayload.strengths,
            recommendations: eeatPayload.recommendations,
            signals: eeatPayload.signals,
          },
        });
      }
      for (const f of allFindings) {
        if (f.data) {
          f.data.eeat_context = {
            score: eeatPayload.score,
            weakest_pillar: ['experience', 'expertise', 'authoritativeness', 'trustworthiness']
              .reduce((min, p) => (eeatPayload[p] < eeatPayload[min] ? p : min), 'experience'),
          };
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 2c-ter: Scan CMS for existing content (drafts + published)
    // ═══════════════════════════════════════════════════════════
    let cmsInventory: CmsContentInventory | null = null;
    try {
      cmsInventory = await scanCmsContent(tracked_site_id, auth.userId);
      if (cmsInventory.items.length > 0) {
        console.log(`[strategist] 📦 CMS inventory: ${cmsInventory.items.length} items (${cmsInventory.drafts.length} drafts) from ${cmsInventory.scanned_platforms.join(', ')}`);
      }
    } catch (e) {
      console.warn('[strategist] CMS scan failed (non-blocking):', e);
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 2c: Inject keyword cloud as reference universe
    // ═══════════════════════════════════════════════════════════
    if (keywordCloud.length > 0) {
      for (const f of allFindings) {
        if (f.data) {
          f.data.keyword_cloud_universe = keywordCloud;
        }
      }
      // If no keyword_gaps finding exists, add one from the keyword cloud
      const hasKeywordFinding = allFindings.some(f => f.category === 'keyword_gaps');
      if (!hasKeywordFinding) {
        allFindings.push({
          category: 'keyword_gaps',
          severity: 'info',
          description: `Univers de mots-clés de référence (${keywordCloud.length} termes): ${keywordCloud.slice(0, 10).join(', ')}`,
          affected_urls: [],
          source_type: 'serp_snapshots',
          data: { keyword_cloud_universe: keywordCloud },
        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 2d: Crawl Page Quality scoring (deterministic, 0 LLM)
    // ═══════════════════════════════════════════════════════════
    const allAffectedUrls = [...new Set(allFindings.flatMap(f => f.affected_urls || []))];
    const urlQualityMap = new Map<string, number>();
    const bizProfile = resolveBusinessProfile(siteIdentityData?.business_type || siteIdentityData?.entity_type);

    if (allAffectedUrls.length > 0) {
      // Find the latest completed crawl for this site
      const siteDomain = domain.replace(/^www\./, '');
      const { data: latestCrawl } = await supabase
        .from('site_crawls')
        .select('id')
        .or(`domain.eq.${siteDomain},domain.eq.www.${siteDomain}`)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1);

      if (latestCrawl?.[0]?.id) {
        const { data: crawlPages } = await supabase
          .from('crawl_pages')
          .select('url, title, h1, meta_description, word_count, seo_score, has_schema_org, has_canonical, has_og, has_noindex, has_nofollow, is_indexable, images_total, images_without_alt, internal_links, external_links, h2_count, h3_count, crawl_depth, http_status')
          .eq('crawl_id', latestCrawl[0].id)
          .in('url', allAffectedUrls.slice(0, 100));

        if (crawlPages && crawlPages.length > 0) {
          for (const cp of crawlPages) {
            const quality = computeCrawlPageQuality(cp as CrawlPageInput, bizProfile);
            urlQualityMap.set(cp.url, quality.overall);
          }
          console.log(`[strategist] 📊 Quality scored ${urlQualityMap.size} pages (profile: ${bizProfile}, avg: ${Math.round([...urlQualityMap.values()].reduce((a, b) => a + b, 0) / urlQualityMap.size)})`);
        }
      }
    }

    // PHASE 3: Transformer findings en tâches stratégiques
    // ═══════════════════════════════════════════════════════════
    const rawTasks: StrategicTask[] = [];
    let taskCounter = 0;

    const activeFindings = allFindings.filter(f => !f._suppressed);

    const sectorForImages = siteIdentityData?.market_sector || strategicSerpData?.market_sector || null;

    for (const finding of activeFindings) {
      const tasks = findingToTasks(finding, lang, taskCounter, sectorForImages, cmsInventory);
      for (const task of tasks) {
        // Auto-inject image recommendation for content_architect tasks
        if (task.execution_mode === 'content_architect' && !task.image_recommendation) {
          const guessedPageType = task.action_type === 'create_content' ? 'article' : 'article';
          task.image_recommendation = computeImageRecommendation(guessedPageType, null, sectorForImages, lang);
        }
        rawTasks.push(task);
        taskCounter++;
      }
    }

    // Score and sort tasks — with depth-aware + spiral-aware + quality-aware priority boost
    for (const task of rawTasks) {
      const sevWeight = SEVERITY_WEIGHTS[task.estimated_impact === 'high' ? 'critical' : task.estimated_impact === 'medium' ? 'warning' : 'info'] || 1;
      const catWeight = Math.max(...task.source_diagnostics.map(d => CATEGORY_WEIGHTS[d] || 1));

      // Depth boost
      let depthBoost = 1.0;
      const deepDetail = task.metadata?.deep_pages_detail;
      if (deepDetail && Array.isArray(deepDetail) && deepDetail.length > 0) {
        const maxDepth = Math.max(...deepDetail.map((p: any) => p.depth || 0));
        depthBoost = maxDepth >= 5 ? 1.5 : maxDepth >= 4 ? 1.3 : 1.1;
      }

      // Quality boost: low-quality pages get higher priority for improvement tasks
      // High-quality pages get higher priority as link sources
      let qualityBoost = 1.0;
      if (urlQualityMap.size > 0 && task.affected_urls.length > 0) {
        const avgQuality = task.affected_urls
          .map((u: string) => urlQualityMap.get(u))
          .filter((q): q is number => q !== undefined)
          .reduce((sum, q, _, arr) => sum + q / arr.length, 0);
        
        if (avgQuality > 0) {
          if (['rewrite_content', 'enrich_metadata', 'fix_technical', 'improve_eeat', 'fix_cannibalization'].includes(task.action_type)) {
            // Improvement tasks: boost when page quality is low (inverse relationship)
            qualityBoost = avgQuality <= 30 ? 1.4 : avgQuality <= 50 ? 1.2 : avgQuality <= 70 ? 1.0 : 0.9;
          } else if (['add_internal_link'].includes(task.action_type)) {
            // Linking tasks: boost when target is weak (needs authority transfer)
            qualityBoost = avgQuality <= 40 ? 1.3 : 1.0;
          }
          // Inject quality score into metadata for downstream consumers
          if (!task.metadata) task.metadata = {};
          task.metadata.page_quality_avg = Math.round(avgQuality);
          task.metadata.business_profile = bizProfile;
        }
      }

      // Breathing Spiral boost
      let spiralBoost = 1.0;
      const taskRing = task.metadata?.semantic_ring || task.metadata?.ring || 1;
      if (spiralPhase === 'contraction') {
        if (['rewrite_content', 'fix_technical', 'fix_cannibalization', 'enrich_metadata', 'add_internal_link', 'improve_eeat'].includes(task.action_type)) {
          spiralBoost = 1.3;
        } else if (task.action_type === 'create_content') {
          spiralBoost = taskRing === 1 ? 1.15 : taskRing === 2 ? 1.0 : 0.85;
        }
      } else if (spiralPhase === 'expansion') {
        if (['create_content', 'publish_draft'].includes(task.action_type)) {
          spiralBoost = taskRing >= 2 ? 1.3 : 1.1;
        } else if (['fix_technical', 'enrich_metadata'].includes(task.action_type)) {
          spiralBoost = 0.9;
        }
      }

      // Per-URL spiral boost
      const urlSpiralMax = Math.max(0, ...task.affected_urls.map((u: string) => spiralUrlScoreMap.get(u) || 0));
      if (urlSpiralMax >= 60) spiralBoost *= 1.2;

      // Content priority mode: boost content creation/modification tasks
      let contentPriorityBoost = 1.0;
      if (content_priority_mode && CONTENT_PRIORITY_ACTIONS.includes(task.action_type as ActionType)) {
        contentPriorityBoost = 1.8; // Strong boost to push content tasks to top
      }

      task.priority = Math.round(sevWeight * catWeight * depthBoost * qualityBoost * spiralBoost * contentPriorityBoost * 10);
      task.urgency = deriveUrgency(task.estimated_impact, task.is_destructive);
      task.executor_function = resolveExecutorFn(task, is_iktracker);
      if (!task.metadata) task.metadata = {};
      task.metadata.spiral_phase = spiralPhase;
      task.metadata.spiral_score_avg = avgSpiralScore;
      task.metadata.content_priority_mode = content_priority_mode;
    }

    rawTasks.sort((a, b) => b.priority - a.priority);

    // Apply budget: keep top N tasks
    const selectedTasks = rawTasks.slice(0, budget);

    // Build dependency graph (simple: content creation before linking)
    const contentCreationIds = selectedTasks
      .filter(t => t.action_type === 'create_content')
      .map(t => t.id);

    for (const task of selectedTasks) {
      if (task.action_type === 'add_internal_link' && contentCreationIds.length > 0) {
        // Link tasks depend on content being created first
        const relatedCreation = contentCreationIds.find(cid => {
          const ct = selectedTasks.find(t => t.id === cid);
          return ct && task.affected_urls.some(u => ct.affected_urls.includes(u));
        });
        if (relatedCreation) {
          task.depends_on = [relatedCreation];
        }
      }
    }

    // Classify tasks by execution channel
    const editorial_tasks = selectedTasks.filter(t => t.execution_mode === 'content_architect');
    const code_tasks = selectedTasks.filter(t => t.execution_mode === 'code_architect');
    const ops_tasks = selectedTasks.filter(t => t.execution_mode === 'operational_queue');

    // ═══════════════════════════════════════════════════════════
    // PHASE 3b: Feedback Loop — Analyse des recommandations passées
    // ═══════════════════════════════════════════════════════════
    const { data: pastRecos } = await supabase
      .from('strategist_recommendations')
      .select('*')
      .eq('tracked_site_id', tracked_site_id)
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false })
      .limit(50);

    const feedbackAnalysis: {
      successful: any[];
      failed: any[];
      to_rollback: any[];
      axes: Array<{ id: string; label: Record<string, string>; description: Record<string, string>; priority: number }>;
    } = {
      successful: [],
      failed: [],
      to_rollback: [],
      axes: [],
    };

    if (pastRecos && pastRecos.length > 0) {
      for (const reco of pastRecos) {
        if (reco.status === 'applied' && reco.impact_score !== null) {
          if (reco.impact_score > 0) {
            feedbackAnalysis.successful.push({ url: reco.url, action: reco.action_type, impact: reco.impact_score });
          } else {
            feedbackAnalysis.failed.push({ url: reco.url, action: reco.action_type, impact: reco.impact_score });
            // If negative impact, flag for potential rollback
            if (reco.impact_score < -10) {
              feedbackAnalysis.to_rollback.push({ id: reco.id, url: reco.url, action: reco.action_type, impact: reco.impact_score });
            }
          }
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 3c: Propose 3 strategic development axes
    // ═══════════════════════════════════════════════════════════
    const axesCandidates = [
      {
        id: 'content_authority',
        condition: () => editorial_tasks.length >= 2 || allFindings.some(f => f.category === 'thin_content' || f.category === 'eeat_signals'),
        priority: editorial_tasks.length * 10 + (allFindings.filter(f => f.category === 'thin_content').length * 5),
        label: { fr: 'Autorité éditoriale', en: 'Editorial Authority', es: 'Autoridad Editorial' },
        description: {
          fr: 'Renforcer la profondeur et l\'expertise du contenu existant, combler les gaps sémantiques, améliorer les signaux E-E-A-T.',
          en: 'Strengthen depth and expertise of existing content, fill semantic gaps, improve E-E-A-T signals.',
          es: 'Reforzar la profundidad y experiencia del contenido existente, llenar gaps semánticos, mejorar señales E-E-A-T.',
        },
      },
      {
        id: 'technical_performance',
        condition: () => code_tasks.length >= 2 || allFindings.some(f => ['redirect_chains', 'broken_links', 'deep_pages'].includes(f.category)),
        priority: code_tasks.length * 10 + (allFindings.filter(f => f.category === 'broken_links').length * 8),
        label: { fr: 'Performance technique', en: 'Technical Performance', es: 'Rendimiento Técnico' },
        description: {
          fr: 'Corriger les erreurs techniques (404, redirections, crawl profond), optimiser la vitesse et l\'indexabilité.',
          en: 'Fix technical errors (404, redirects, deep crawl), optimize speed and indexability.',
          es: 'Corregir errores técnicos (404, redirecciones, crawl profundo), optimizar velocidad e indexabilidad.',
        },
      },
      {
        id: 'semantic_architecture',
        condition: () => ops_tasks.length >= 1 || allFindings.some(f => ['orphan_pages', 'cannibalization', 'keyword_gaps'].includes(f.category)),
        priority: (allFindings.filter(f => f.category === 'orphan_pages').length * 7) + (allFindings.filter(f => f.category === 'cannibalization').length * 9),
        label: { fr: 'Architecture sémantique', en: 'Semantic Architecture', es: 'Arquitectura Semántica' },
        description: {
          fr: 'Restructurer le maillage interne, résoudre les cannibalisations, intégrer les pages orphelines et créer des pages piliers.',
          en: 'Restructure internal linking, resolve cannibalizations, integrate orphan pages and create pillar pages.',
          es: 'Reestructurar el enlazado interno, resolver canibalizaciones, integrar páginas huérfanas y crear páginas pilar.',
        },
      },
      // Note: backlink/off-site growth removed — the strategist cannot execute off-site actions
      {
        id: 'conversion_optimization',
        condition: () => feedbackAnalysis.successful.length > 0 || allFindings.some(f => f.category === 'keyword_mismatch'),
        priority: feedbackAnalysis.successful.length * 6,
        label: { fr: 'Optimisation des conversions', en: 'Conversion Optimization', es: 'Optimización de Conversiones' },
        description: {
          fr: 'Capitaliser sur les pages performantes, optimiser les CTAs et le parcours utilisateur depuis les pages SEO vers la conversion.',
          en: 'Capitalize on performing pages, optimize CTAs and user journey from SEO pages to conversion.',
          es: 'Capitalizar las páginas con buen rendimiento, optimizar CTAs y el recorrido del usuario desde SEO hacia conversión.',
        },
      },
    ];

    // Pick top 3 matching axes
    const matchingAxes = axesCandidates
      .filter(a => a.condition())
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3)
      .map(a => ({ id: a.id, label: a.label, description: a.description, priority: a.priority }));

    // Fallback: always provide 3 axes
    if (matchingAxes.length < 3) {
      const remaining = axesCandidates
        .filter(a => !matchingAxes.some(m => m.id === a.id))
        .sort((a, b) => b.priority - a.priority);
      while (matchingAxes.length < 3 && remaining.length > 0) {
        const ax = remaining.shift()!;
        matchingAxes.push({ id: ax.id, label: ax.label, description: ax.description, priority: ax.priority });
      }
    }

    feedbackAnalysis.axes = matchingAxes;

    // ═══════════════════════════════════════════════════════════
    // PHASE 4: Persistance
    // ═══════════════════════════════════════════════════════════
    const strategyPayload = {
      tasks: selectedTasks,
      editorial_calendar: editorial_tasks.map(t => ({
        ...t,
        suggested_week: null,
      })),
      code_fixes: code_tasks,
      operational_queue: ops_tasks,
      feedback: feedbackAnalysis,
      summary: {
        total_findings: allFindings.length,
        conflicts_resolved: conflicts.length,
        tasks_prescribed: selectedTasks.length,
        tasks_dropped: rawTasks.length - selectedTasks.length,
        past_recos_analyzed: pastRecos?.length || 0,
        successful_past: feedbackAnalysis.successful.length,
        failed_past: feedbackAnalysis.failed.length,
        rollback_candidates: feedbackAnalysis.to_rollback.length,
        content_priority_mode: content_priority_mode,
        spiral_phase: spiralPhase,
        breakdown: {
          editorial: editorial_tasks.length,
          code: code_tasks.length,
          operational: ops_tasks.length,
        },
      },
    };

    const { data: plan, error: planError } = await supabase
      .from('cocoon_strategy_plans')
      .insert({
        user_id: auth.userId,
        tracked_site_id,
        domain,
        strategy: strategyPayload,
        diagnostic_ids: diagTypes
          .map(t => existingByType[t]?.id)
          .filter(Boolean),
        task_budget: budget,
        status: 'pending_validation',
      })
      .select('id')
      .single();

    if (planError) {
      console.error('Strategy plan insert error:', planError);
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 5: Persist individual recommendations for memory
    // ═══════════════════════════════════════════════════════════
    if (plan?.id) {
      const recoInserts = selectedTasks.flatMap(task =>
        (task.affected_urls.length > 0 ? task.affected_urls : [domain]).map(url => ({
          user_id: auth.userId,
          tracked_site_id,
          domain,
          url,
          strategy_plan_id: plan.id,
          action_type: task.action_type,
          title: task.title,
          description: task.description || '',
          priority: task.priority,
          status: 'prescribed',
          execution_mode: task.execution_mode,
          metadata: task.metadata || {},
        }))
      );

      if (recoInserts.length > 0) {
        const { error: recoError } = await supabase
          .from('strategist_recommendations')
          .insert(recoInserts);
        if (recoError) console.error('Reco insert error:', recoError);
      }
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 6: Persist strategic insights to site memory
    // ═══════════════════════════════════════════════════════════
    try {
      const memoryEntries = [];

      // Save key diagnostic findings as insights
      if (diagnosticsSummary.content?.critical_count > 0) {
        memoryEntries.push({ memory_key: 'diag_content_critical', memory_value: `${diagnosticsSummary.content.critical_count} problèmes contenu critiques détectés`, category: 'insight', confidence: 0.9 });
      }
      if (diagnosticsSummary.semantic?.critical_count > 0) {
        memoryEntries.push({ memory_key: 'diag_semantic_critical', memory_value: `${diagnosticsSummary.semantic.critical_count} problèmes sémantiques critiques détectés`, category: 'insight', confidence: 0.9 });
      }
      if (conflicts.length > 0) {
        memoryEntries.push({ memory_key: 'strategy_conflicts', memory_value: `${conflicts.length} conflits résolus entre diagnostics`, category: 'insight', confidence: 0.8 });
      }
      if (matchingAxes.length > 0) {
        memoryEntries.push({ memory_key: 'axes_strategiques', memory_value: matchingAxes.map(a => a.label[lang] || a.label.fr).join(', '), category: 'objective', confidence: 0.7 });
      }
      if (feedbackAnalysis.successful.length > 0) {
        memoryEntries.push({ memory_key: 'recos_reussies', memory_value: `${feedbackAnalysis.successful.length} recommandations passées ont eu un impact positif`, category: 'insight', confidence: 1.0 });
      }

      if (memoryEntries.length > 0) {
        await writeSiteMemory(tracked_site_id, auth.userId, memoryEntries, 'stratege');
      }

      // Auto-enrich identity card from diagnostic data if missing (reuse already-fetched data)
      if (siteIdentityData) {
        const identityUpdates = [];
        const contentFindings = allFindings.filter(f => f.source_type === 'content');
        const semanticFindings = allFindings.filter(f => f.source_type === 'semantic');

        if (!siteIdentityData.target_audience && semanticFindings.length > 0) {
          const keywords = semanticFindings
            .flatMap((f: any) => f.data?.keywords || [])
            .slice(0, 5)
            .join(', ');
          if (keywords) {
            identityUpdates.push({
              field_name: 'target_audience',
              value: `Audience ciblant: ${keywords}`,
              reason: 'Déduit de l\'analyse sémantique du site',
            });
          }
        }

        if (identityUpdates.length > 0) {
          await applyIdentityUpdates(tracked_site_id, auth.userId, identityUpdates, 'stratege');
        }
      }
    } catch (e) {
      console.error('[strategist] Memory/identity update error:', e);
    }

    // ═══════════════════════════════════════════════════════════
    // RESPONSE
    // ═══════════════════════════════════════════════════════════
    return jsonOk({
      plan_id: plan?.id || null,
      strategy: strategyPayload,
      diagnostics_summary: diagnosticsSummary,
      conflicts_resolved: conflicts,
      feedback: feedbackAnalysis,
      development_axes: matchingAxes,
      cms_inventory_summary: cmsInventory ? {
        total: cmsInventory.items.length,
        drafts: cmsInventory.drafts.length,
        published: cmsInventory.published.length,
        platforms: cmsInventory.scanned_platforms,
      } : null,
      site_memory_context: siteMemoryContext ? true : false,
      lang,
    });

  } catch (err) {
    console.error('Strategist error:', err);
    return jsonError(err.message, 500);
  }
}));

// ═══════════════════════════════════════════════════════════════
// MAPPING: Finding → Strategic Task(s)
// ═══════════════════════════════════════════════════════════════
function findingToTasks(finding: any, lang: string, counter: number, sector?: string | null, cmsInventory?: CmsContentInventory | null): StrategicTask[] {
  const tasks: StrategicTask[] = [];
  const baseId = `strat_${counter}`;
  const cat = finding.category || '';
  const sev = finding.severity || 'info';
  const urls = finding.affected_urls || [];
  const sourceType = finding.source_type || 'unknown';

  const impact: 'high' | 'medium' | 'low' = sev === 'critical' ? 'high' : sev === 'warning' ? 'medium' : 'low';

  switch (cat) {
    case 'thin_content':
      tasks.push({
        id: `${baseId}_thin`,
        action_type: 'rewrite_content',
        priority: 0,
        title: label('thin_content', lang),
        description: finding.description || '',
        affected_urls: urls.slice(0, 5),
        source_diagnostics: [sourceType],
        execution_mode: 'content_architect',
        is_destructive: false,
        depends_on: [],
        estimated_impact: impact,
        metadata: { min_word_count: 600, current_avg: finding.data?.avg_word_count },
      });
      break;

    case 'missing_h1':
    case 'multi_h1':
      tasks.push({
        id: `${baseId}_h1`,
        action_type: 'enrich_metadata',
        priority: 0,
        title: label('missing_h1', lang),
        description: finding.description || '',
        affected_urls: urls.slice(0, 10),
        source_diagnostics: [sourceType],
        execution_mode: 'code_architect',
        is_destructive: false,
        depends_on: [],
        estimated_impact: 'medium',
      });
      break;

    case 'missing_meta':
      tasks.push({
        id: `${baseId}_meta`,
        action_type: 'enrich_metadata',
        priority: 0,
        title: label('missing_meta', lang),
        description: finding.description || '',
        affected_urls: urls.slice(0, 10),
        source_diagnostics: [sourceType],
        execution_mode: 'code_architect',
        is_destructive: false,
        depends_on: [],
        estimated_impact: 'medium',
      });
      break;

    case 'duplicate_content':
      tasks.push({
        id: `${baseId}_dedup`,
        action_type: 'rewrite_content',
        priority: 0,
        title: label('duplicate_content', lang),
        description: finding.description || '',
        affected_urls: urls.slice(0, 5),
        source_diagnostics: [sourceType],
        execution_mode: 'content_architect',
        is_destructive: true,
        depends_on: [],
        estimated_impact: impact,
      });
      break;

    case 'content_decay':
      tasks.push({
        id: `${baseId}_decay`,
        action_type: 'rewrite_content',
        priority: 0,
        title: label('content_decay', lang),
        description: finding.description || '',
        affected_urls: urls.slice(0, 5),
        source_diagnostics: [sourceType],
        execution_mode: 'content_architect',
        is_destructive: false,
        depends_on: [],
        estimated_impact: 'medium',
      });
      break;

    case 'missing_alt':
      tasks.push({
        id: `${baseId}_alt`,
        action_type: 'enrich_metadata',
        priority: 0,
        title: label('missing_alt', lang),
        description: finding.description || '',
        affected_urls: urls.slice(0, 10),
        source_diagnostics: [sourceType],
        execution_mode: 'code_architect',
        is_destructive: false,
        depends_on: [],
        estimated_impact: 'low',
      });
      break;

    case 'cannibalization':
      tasks.push({
        id: `${baseId}_cannib`,
        action_type: 'fix_cannibalization',
        priority: 0,
        title: label('cannibalization', lang),
        description: finding.description || '',
        affected_urls: urls.slice(0, 5),
        source_diagnostics: [sourceType],
        execution_mode: 'content_architect',
        is_destructive: true,
        depends_on: [],
        estimated_impact: impact,
        metadata: finding.data,
      });
      break;

    case 'keyword_gaps':
      // Create new content for semantic gaps
      const gaps = finding.data?.top_gaps || [];
      if (gaps.length > 0) {
        // Check if any gap topic already exists as a draft in the CMS
        const gapTasksFromDrafts: StrategicTask[] = [];
        const genuineNewGaps: string[] = [];

        if (cmsInventory && cmsInventory.drafts.length > 0) {
          for (const gap of gaps.slice(0, 5) as string[]) {
            const matches = findMatchingContent(
              { ...cmsInventory, items: cmsInventory.drafts } as CmsContentInventory,
              gap,
              0.4,
            );
            if (matches.length > 0) {
              const best = matches[0];
              gapTasksFromDrafts.push({
                id: `${baseId}_draft_${gapTasksFromDrafts.length}`,
                action_type: 'publish_draft',
                priority: 0,
                title: lang === 'fr'
                  ? `Publier le brouillon existant : "${best.title}"`
                  : `Publish existing draft: "${best.title}"`,
                description: lang === 'fr'
                  ? `Un brouillon couvrant "${gap}" existe déjà dans votre CMS (${best.platform}, slug: ${best.slug}, similarité: ${Math.round(best.similarity * 100)}%). Relisez-le et publiez-le plutôt que d'en créer un nouveau.`
                  : `A draft covering "${gap}" already exists in your CMS (${best.platform}, slug: ${best.slug}, similarity: ${Math.round(best.similarity * 100)}%). Review and publish it instead of creating a new one.`,
                affected_urls: best.url ? [best.url] : [],
                source_diagnostics: [sourceType],
                execution_mode: 'content_architect',
                is_destructive: false,
                depends_on: [],
                estimated_impact: 'high',
                metadata: {
                  existing_draft_slug: best.slug,
                  existing_draft_platform: best.platform,
                  existing_draft_title: best.title,
                  similarity: best.similarity,
                  target_keyword: gap,
                },
              });
            } else {
              genuineNewGaps.push(gap);
            }
          }
        } else {
          genuineNewGaps.push(...(gaps.slice(0, 5) as string[]));
        }

        // Add draft-publish tasks
        tasks.push(...gapTasksFromDrafts);

        // Create new content only for gaps without existing drafts
        if (genuineNewGaps.length > 0) {
        tasks.push({
          id: `${baseId}_gap`,
          action_type: 'create_content',
          priority: 0,
          title: label('keyword_gap', lang),
          description: finding.description || '',
          affected_urls: [],
          source_diagnostics: [sourceType],
          execution_mode: 'content_architect',
          is_destructive: false,
          depends_on: [],
          estimated_impact: 'high',
          metadata: {
            target_keywords: genuineNewGaps,
            // Inject strategic audit SERP context if available
            ...(finding.data?.strategic_serp_context || {}),
          },
        });
        }
      }
      break;

    case 'orphan_pages':
      tasks.push({
        id: `${baseId}_orphan`,
        action_type: 'add_internal_link',
        priority: 0,
        title: label('orphan_page', lang),
        description: finding.description || '',
        affected_urls: urls.slice(0, 5),
        source_diagnostics: [sourceType],
        execution_mode: 'operational_queue',
        is_destructive: false,
        depends_on: [],
        estimated_impact: 'medium',
      });
      break;

    case 'deep_pages': {
      const deepDetail = finding.data?.deep_pages_detail || [];
      const linkSources = finding.data?.suggested_link_sources || [];
      const avgSiteDepth = finding.data?.avg_site_depth || 0;
      const pctDeep = finding.data?.pct_deep || 0;

      // Primary task: add internal links from shallow pages to reduce depth
      tasks.push({
        id: `${baseId}_deep_link`,
        action_type: 'add_internal_link',
        priority: 0,
        title: label('deep_page', lang),
        description: lang === 'fr'
          ? `${urls.length} pages à profondeur > 3 (${pctDeep}% du site, moy. ${avgSiteDepth}). Ajouter des liens depuis les pages peu profondes pour ramener ces pages à ≤ 3 clics de la home.`
          : `${urls.length} pages at depth > 3 (${pctDeep}% of site, avg ${avgSiteDepth}). Add links from shallow pages to bring these within 3 clicks of home.`,
        affected_urls: urls.slice(0, 10),
        source_diagnostics: [sourceType],
        execution_mode: 'operational_queue',
        is_destructive: false,
        depends_on: [],
        estimated_impact: impact,
        metadata: {
          deep_pages_detail: deepDetail.slice(0, 10),
          suggested_link_sources: linkSources,
          avg_site_depth: avgSiteDepth,
          target_max_depth: 3,
          depth_distribution: finding.data?.depth_distribution,
        },
      });

      // If > 30% of pages are deep, also suggest restructuring
      if (pctDeep > 30) {
        tasks.push({
          id: `${baseId}_deep_restructure`,
          action_type: 'restructure_tree',
          priority: 0,
          title: label('restructure', lang),
          description: lang === 'fr'
            ? `${pctDeep}% des pages sont à profondeur > 3 — une restructuration de l'arborescence est recommandée.`
            : `${pctDeep}% of pages are at depth > 3 — site architecture restructuring is recommended.`,
          affected_urls: urls.slice(0, 5),
          source_diagnostics: [sourceType],
          execution_mode: 'operational_queue',
          is_destructive: true,
          depends_on: [],
          estimated_impact: 'high',
        });
      }
      break;
    }

    case 'redirect_chains':
      tasks.push({
        id: `${baseId}_redir`,
        action_type: 'fix_redirect_chain',
        priority: 0,
        title: label('redirect_chain', lang),
        description: finding.description || '',
        affected_urls: urls.slice(0, 10),
        source_diagnostics: [sourceType],
        execution_mode: 'code_architect',
        is_destructive: false,
        depends_on: [],
        estimated_impact: 'medium',
      });
      break;

    case 'broken_links':
      tasks.push({
        id: `${baseId}_404`,
        action_type: 'fix_technical',
        priority: 0,
        title: label('broken_link', lang),
        description: finding.description || '',
        affected_urls: urls.slice(0, 10),
        source_diagnostics: [sourceType],
        execution_mode: 'code_architect',
        is_destructive: false,
        depends_on: [],
        estimated_impact: impact,
      });
      break;

    case 'backlink_health':
    case 'domain_authority':
      // Off-site actions removed — redirect to internal linking improvement instead
      tasks.push({
        id: `${baseId}_auth`,
        action_type: 'add_internal_link',
        priority: 0,
        title: label('low_pagerank', lang),
        description: finding.description || '',
        affected_urls: urls.slice(0, 3),
        source_diagnostics: [sourceType],
        execution_mode: 'operational_queue',
        is_destructive: false,
        depends_on: [],
        estimated_impact: impact,
      });
      break;

    case 'anchor_diversity':
      tasks.push({
        id: `${baseId}_anchor`,
        action_type: 'fix_technical',
        priority: 0,
        title: label('anchor_over_optimized', lang),
        description: finding.description || '',
        affected_urls: urls.slice(0, 5),
        source_diagnostics: [sourceType],
        execution_mode: 'operational_queue',
        is_destructive: false,
        depends_on: [],
        estimated_impact: 'medium',
      });
      break;

    case 'pagerank_distribution':
      tasks.push({
        id: `${baseId}_pr`,
        action_type: 'add_internal_link',
        priority: 0,
        title: label('low_pagerank', lang),
        description: finding.description || '',
        affected_urls: urls.slice(0, 5),
        source_diagnostics: [sourceType],
        execution_mode: 'operational_queue',
        is_destructive: false,
        depends_on: [],
        estimated_impact: 'medium',
      });
      break;

    case 'eeat_signals':
      tasks.push({
        id: `${baseId}_eeat`,
        action_type: 'improve_eeat',
        priority: 0,
        title: label('eeat_weak', lang),
        description: finding.description || '',
        affected_urls: urls.slice(0, 5),
        source_diagnostics: [sourceType],
        execution_mode: 'content_architect',
        is_destructive: false,
        depends_on: [],
        estimated_impact: 'high',
      });
      break;

    case 'keyword_mismatch':
    case 'semantic_drift': {
      // Use the keyword placement engine to prescribe optimal title & first-sentence
      const mismatchPages = finding.data?.pages || [];
      for (const page of mismatchPages.slice(0, 5)) {
        const targetKw = page.expected_keyword || page.keyword || keyword || '';
        const currentTitle = page.title || '';
        const parentKws = page.parent_keywords || [];
        if (!targetKw || !currentTitle) continue;

        const placement = computeKeywordPlacement(targetKw, currentTitle, parentKws);
        
        tasks.push({
          id: `${baseId}_kwplace_${tasks.length}`,
          action_type: 'optimize_keyword_placement',
          priority: 0,
          title: label('optimize_kw_placement', lang),
          description: placement.reasoning,
          affected_urls: [page.url || ''].filter(Boolean),
          source_diagnostics: [sourceType],
          execution_mode: 'content_architect',
          is_destructive: false,
          depends_on: [],
          estimated_impact: impact,
          metadata: {
            keyword: placement.keyword,
            current_title: placement.current_title,
            suggested_title: placement.suggested_title,
            keyword_position: placement.keyword_position,
            title_length: placement.title_length,
            first_sentence_instruction: placement.first_sentence_instruction,
          },
        });
      }

      // Fallback if no structured pages data — still create a generic task
      if (mismatchPages.length === 0 && urls.length > 0) {
        tasks.push({
          id: `${baseId}_kwplace`,
          action_type: 'optimize_keyword_placement',
          priority: 0,
          title: label('optimize_kw_placement', lang),
          description: finding.description || '',
          affected_urls: urls.slice(0, 5),
          source_diagnostics: [sourceType],
          execution_mode: 'content_architect',
          is_destructive: false,
          depends_on: [],
          estimated_impact: impact,
          metadata: { manual_review: true },
        });
      }
      break;
    }

    default:
      // Generic fallback
      if (sev === 'critical' || sev === 'warning') {
        tasks.push({
          id: `${baseId}_gen`,
          action_type: 'fix_technical',
          priority: 0,
          title: finding.title || cat,
          description: finding.description || '',
          affected_urls: urls.slice(0, 5),
          source_diagnostics: [sourceType],
          execution_mode: 'code_architect',
          is_destructive: false,
          depends_on: [],
          estimated_impact: impact,
        });
      }
      break;
  }

  return tasks;
}