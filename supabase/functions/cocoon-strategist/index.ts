import { corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';

/**
 * cocoon-strategist: Orchestrateur Stratège 360°
 * 
 * 1. Lance les 4 diagnostics en parallèle (ou récupère les résultats récents)
 * 2. Consolide les findings, détecte les conflits
 * 3. Priorise et génère un plan stratégique (max 8 tâches/cycle)
 * 4. Persiste dans cocoon_strategy_plans
 * 5. Renvoie le plan + résumé pour l'assistant Cocoon
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
  | 'add_internal_link'
  | 'remove_internal_link'
  | 'add_backlink_target'
  | 'fix_redirect_chain'
  | 'restructure_tree'
  | 'enrich_metadata'
  | 'fix_technical'
  | 'fix_cannibalization'
  | 'improve_eeat'
  | 'optimize_keyword_placement';

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

interface StrategicTask {
  id: string;
  action_type: ActionType;
  priority: number; // 0-100
  title: string;
  description: string;
  affected_urls: string[];
  source_diagnostics: string[]; // which diag modules produced this
  execution_mode: 'content_architect' | 'code_architect' | 'operational_queue';
  is_destructive: boolean;
  depends_on: string[]; // task ids that must complete first
  estimated_impact: 'high' | 'medium' | 'low';
  metadata?: Record<string, any>;
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
    backlink_target: 'Cibler des backlinks vers cette page',
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
    backlink_target: 'Target backlinks to this page',
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
    backlink_target: 'Apuntar backlinks a esta página',
  },
};

function label(key: string, lang: string): string {
  return LABELS[lang]?.[key] || LABELS['fr'][key] || key;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { tracked_site_id, domain, force_refresh = false, lang = 'fr', task_budget } = await req.json();
    if (!tracked_site_id || !domain) {
      return new Response(JSON.stringify({ error: 'tracked_site_id and domain required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const budget = Math.min(task_budget || DEFAULT_TASK_BUDGET, 12);
    const supabase = getServiceClient();

    // ═══════════════════════════════════════════════════════════
    // PHASE 1: Collecter les diagnostics (parallèle)
    // ═══════════════════════════════════════════════════════════
    const diagTypes = ['content', 'semantic', 'structure', 'authority'];
    const cutoff = new Date(Date.now() - MAX_DIAG_AGE_HOURS * 3600 * 1000).toISOString();

    // Fetch recent diagnostics
    const { data: existingDiags } = await supabase
      .from('cocoon_diagnostic_results')
      .select('*')
      .eq('tracked_site_id', tracked_site_id)
      .gte('created_at', cutoff)
      .in('diagnostic_type', diagTypes);

    const existingByType: Record<string, any> = {};
    (existingDiags || []).forEach((d: any) => {
      // Keep the most recent per type
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
    // PHASE 3: Transformer findings en tâches stratégiques
    // ═══════════════════════════════════════════════════════════
    const rawTasks: StrategicTask[] = [];
    let taskCounter = 0;

    const activeFindings = allFindings.filter(f => !f._suppressed);

    for (const finding of activeFindings) {
      const tasks = findingToTasks(finding, lang, taskCounter);
      for (const task of tasks) {
        rawTasks.push(task);
        taskCounter++;
      }
    }

    // Score and sort tasks
    for (const task of rawTasks) {
      const sevWeight = SEVERITY_WEIGHTS[task.estimated_impact === 'high' ? 'critical' : task.estimated_impact === 'medium' ? 'warning' : 'info'] || 1;
      const catWeight = Math.max(...task.source_diagnostics.map(d => CATEGORY_WEIGHTS[d] || 1));
      task.priority = Math.round(sevWeight * catWeight * 10);
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
    // PHASE 4: Persistance
    // ═══════════════════════════════════════════════════════════
    const strategyPayload = {
      tasks: selectedTasks,
      editorial_calendar: editorial_tasks.map(t => ({
        ...t,
        suggested_week: null, // Will be set by content architect
      })),
      code_fixes: code_tasks,
      operational_queue: ops_tasks,
      summary: {
        total_findings: allFindings.length,
        conflicts_resolved: conflicts.length,
        tasks_prescribed: selectedTasks.length,
        tasks_dropped: rawTasks.length - selectedTasks.length,
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
    // RESPONSE
    // ═══════════════════════════════════════════════════════════
    return new Response(JSON.stringify({
      plan_id: plan?.id || null,
      strategy: strategyPayload,
      diagnostics_summary: diagnosticsSummary,
      conflicts_resolved: conflicts,
      lang,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Strategist error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// MAPPING: Finding → Strategic Task(s)
// ═══════════════════════════════════════════════════════════════
function findingToTasks(finding: any, lang: string, counter: number): StrategicTask[] {
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
          metadata: { target_keywords: gaps.slice(0, 5) },
        });
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

    case 'deep_pages':
      tasks.push({
        id: `${baseId}_deep`,
        action_type: 'restructure_tree',
        priority: 0,
        title: label('deep_page', lang),
        description: finding.description || '',
        affected_urls: urls.slice(0, 5),
        source_diagnostics: [sourceType],
        execution_mode: 'operational_queue',
        is_destructive: true,
        depends_on: [],
        estimated_impact: impact,
      });
      break;

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
      tasks.push({
        id: `${baseId}_auth`,
        action_type: 'add_backlink_target',
        priority: 0,
        title: label('low_authority', lang),
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
