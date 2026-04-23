/**
 * resolveAuditRoutes — Routes each parsed criterion to the appropriate backend function.
 * Determines matchType (exact/partial/custom_only) to avoid redundant calls.
 * Client-side, no network.
 */

export type MatchType = 'exact' | 'partial' | 'custom_only';

export type AuditMode = 'standard' | 'benchmark';

export interface AuditRoute {
  criterionId: string;
  criterionTitle: string;
  criterionCategory: string;
  fn: string;                    // Edge function to call
  matchType: MatchType;          // exact = 1 call, partial = 2 calls, custom_only = LLM only
  confidence: number;            // 0-1, how confident we are in this routing
  customPrompt?: string;         // If the user's file includes a specific prompt
  targetProvider?: string;       // Legacy single provider (kept for backward compat)
  targetProviders?: string[];    // Multi-LLM targeting (benchmark or fan-out)
  mode?: AuditMode;              // 'benchmark' = N LLMs ; 'standard' = single LLM
  costEstimate: number;          // Estimated cost in USD
}

export interface AuditPlan {
  routes: AuditRoute[];
  calls: AuditCall[];            // Deduplicated function calls
  totalEstimatedCost: number;
  estimatedDurationSec: number;
}

export interface AuditCall {
  fn: string;
  criteriaIds: string[];
  cost: number;
  type: 'technical' | 'llm';
}

// ── Routing dictionary ──────────────────────────────────────────────

interface RoutingRule {
  patterns: RegExp[];
  fn: string;
  type: 'technical' | 'llm';
  cost: number;
  confidence: number;
}

const ROUTING_RULES: RoutingRule[] = [
  // Technical — free (fetch HTML / API)
  {
    patterns: [/title/i, /meta.?desc/i, /h[1-6]/i, /canonical/i, /og:/i, /open.?graph/i, /viewport/i, /balise/i, /heading/i],
    fn: 'check-meta-tags', type: 'technical', cost: 0, confidence: 0.95,
  },
  {
    patterns: [/json.?ld/i, /schema\.?org/i, /structured.?data/i, /donn[eé]es.?structur[eé]es/i, /rich.?snippet/i, /breadcrumb/i, /faq.?page/i],
    fn: 'check-structured-data', type: 'technical', cost: 0, confidence: 0.95,
  },
  {
    patterns: [/robots/i, /sitemap/i, /noindex/i, /nofollow/i, /indexab/i, /crawl.?directive/i, /x.?robots/i],
    fn: 'check-robots-indexation', type: 'technical', cost: 0, confidence: 0.95,
  },
  {
    patterns: [/alt.?text/i, /image/i, /img/i, /lazy.?load/i, /webp/i, /avif/i, /format.?image/i],
    fn: 'check-images', type: 'technical', cost: 0, confidence: 0.9,
  },
  {
    patterns: [/pagespeed/i, /core.?web.?vital/i, /^lcp$/i, /^fcp$/i, /^cls$/i, /^tbt$/i, /^ttfb$/i, /lighthouse/i, /performance/i, /vitesse/i, /speed/i],
    fn: 'check-pagespeed', type: 'technical', cost: 0, confidence: 0.95,
  },
  {
    patterns: [/backlink/i, /referring.?domain/i, /domain.?rank/i, /autorit[eé]/i, /lien.?externe/i, /netlinking/i, /domaine.?r[eé]f[eé]r/i],
    fn: 'check-backlinks', type: 'technical', cost: 0.05, confidence: 0.9,
  },
  {
    patterns: [/bot.?ia/i, /gptbot/i, /claudebot/i, /googlebot/i, /ai.?crawler/i, /crawler.?ia/i, /perplexitybot/i, /accessibilit[eé].?ia/i],
    fn: 'check-crawlers', type: 'technical', cost: 0, confidence: 0.95,
  },
  {
    patterns: [/geo.?score/i, /citabilit[eé]/i, /geo.?ready/i, /ia.?ready/i, /geo/i],
    fn: 'check-geo', type: 'technical', cost: 0, confidence: 0.85,
  },

  // Direct answer in first 150 words
  {
    patterns: [/r[eé]ponse.?directe/i, /direct.?answer/i, /150.?mot/i, /150.?word/i, /introduction/i, /premier.?mot/i, /first.?word/i, /accroche/i, /hook/i, /opening/i],
    fn: 'check-direct-answer', type: 'technical', cost: 0, confidence: 0.9,
  },

  // LLM-based — cheap
  {
    patterns: [/e.?e.?a.?t/i, /expertise/i, /experience/i, /authoritativeness/i, /trustworthiness/i, /confiance/i, /auteur/i, /cr[eé]dibilit[eé]/i],
    fn: 'check-eeat', type: 'llm', cost: 0.003, confidence: 0.85,
  },
  {
    patterns: [/qualit[eé].?r[eé]daction/i, /lisibilit[eé]/i, /readability/i, /contenu.?mince/i, /thin.?content/i, /profondeur/i, /word.?count/i, /originalit[eé]/i],
    fn: 'check-content-quality', type: 'llm', cost: 0.002, confidence: 0.85,
  },
  {
    patterns: [/visibilit[eé].?llm/i, /llm/i, /chatgpt/i, /gemini/i, /perplexity/i, /claude/i, /mistral/i, /mention/i, /cit[eé]/i, /recommand/i],
    fn: 'check-llm', type: 'llm', cost: 0.016, confidence: 0.9,
  },

  // Existing heavy functions as fallback
  {
    patterns: [/s[eé]curit[eé]/i, /ssl/i, /https/i, /mixed.?content/i, /header.?s[eé]curit[eé]/i, /csp/i, /hsts/i],
    fn: 'expert-audit', type: 'technical', cost: 0, confidence: 0.7,
  },
  {
    patterns: [/maillage/i, /internal.?link/i, /lien.?interne/i, /orphan/i, /orpheline/i, /profondeur.?page/i],
    fn: 'expert-audit', type: 'technical', cost: 0, confidence: 0.6,
  },
];

// ── Helpers ──────────────────────────────────────────────────────────

function detectCustomPrompt(row: Record<string, any>): string | undefined {
  const promptKeys = ['prompt', 'question', 'requête', 'query', 'prompt_utilisateur'];
  for (const key of promptKeys) {
    for (const col of Object.keys(row)) {
      if (col.toLowerCase().includes(key) && row[col]) {
        return String(row[col]).trim();
      }
    }
  }
  return undefined;
}

function detectTargetProvider(row: Record<string, any>): string | undefined {
  const providerKeys = ['llm', 'moteur', 'engine', 'provider', 'cible', 'target'];
  const KNOWN_PROVIDERS = ['chatgpt', 'gpt', 'gemini', 'claude', 'perplexity', 'mistral', 'copilot'];
  for (const key of providerKeys) {
    for (const col of Object.keys(row)) {
      if (col.toLowerCase().includes(key) && row[col]) {
        const val = String(row[col]).trim().toLowerCase();
        const match = KNOWN_PROVIDERS.find(p => val.includes(p));
        if (match) return match;
      }
    }
  }
  return undefined;
}

function determineMatchType(fn: string, customPrompt?: string): MatchType {
  // If the user has a custom prompt AND the target is a LLM function, we need 2 calls
  if (customPrompt && ['check-llm', 'check-eeat', 'check-content-quality'].includes(fn)) {
    return 'partial';
  }
  // If the criterion doesn't map to any known function
  if (fn === 'unknown') return 'custom_only';
  // Otherwise, our function covers it exactly
  return 'exact';
}

// ── Main router ─────────────────────────────────────────────────────

export interface ParsedCriterion {
  id: string;
  title: string;
  category: string;
  rawRow?: Record<string, any>;
}

export function resolveAuditRoutes(criteria: ParsedCriterion[]): AuditPlan {
  const routes: AuditRoute[] = [];
  const callMap = new Map<string, AuditCall>();

  for (const criterion of criteria) {
    const searchText = `${criterion.title} ${criterion.category}`;
    const customPrompt = criterion.rawRow ? detectCustomPrompt(criterion.rawRow) : undefined;
    const targetProvider = criterion.rawRow ? detectTargetProvider(criterion.rawRow) : undefined;

    // Find best matching routing rule
    let bestRule: RoutingRule | null = null;
    let bestScore = 0;

    for (const rule of ROUTING_RULES) {
      const matchCount = rule.patterns.filter(p => p.test(searchText)).length;
      if (matchCount > bestScore) {
        bestScore = matchCount;
        bestRule = rule;
      }
    }

    const fn = bestRule?.fn || 'check-content-quality'; // fallback to LLM analysis
    const confidence = bestRule ? Math.min(1, bestRule.confidence * (bestScore / 2)) : 0.4;
    const matchType = determineMatchType(fn, customPrompt);
    const cost = bestRule?.cost ?? 0.002;

    routes.push({
      criterionId: criterion.id,
      criterionTitle: criterion.title,
      criterionCategory: criterion.category,
      fn,
      matchType,
      confidence,
      customPrompt,
      targetProvider,
      costEstimate: matchType === 'partial' ? cost * 2 : cost,
    });

    // Deduplicate calls
    if (!callMap.has(fn)) {
      callMap.set(fn, {
        fn,
        criteriaIds: [],
        cost: bestRule?.cost ?? 0.002,
        type: bestRule?.type ?? 'llm',
      });
    }
    callMap.get(fn)!.criteriaIds.push(criterion.id);
  }

  const calls = Array.from(callMap.values());
  const totalEstimatedCost = routes.reduce((sum, r) => sum + r.costEstimate, 0);
  const technicalCalls = calls.filter(c => c.type === 'technical').length;
  const llmCalls = calls.filter(c => c.type === 'llm').length;
  const estimatedDurationSec = technicalCalls * 3 + llmCalls * 8;

  return { routes, calls, totalEstimatedCost, estimatedDurationSec };
}
