/**
 * _shared/citationBreakdownResolve.ts
 *
 * Résout le `citation_breakdown` (8 sous-signaux) utilisé par la décomposition
 * GEO en 10 sous-signaux du rapport Marina.
 *
 * Problème corrigé : sur les pages profondes (mode « contenu », donc la quasi-
 * totalité des URLs d'un audit multipages), la synthèse stratégique renvoyait
 * `llm_visibility` sous forme de texte et aucun `citation_breakdown` n'était
 * jamais produit. Les 8 sous-signaux correspondants sortaient donc en
 * « non mesuré » et le test GEO paraissait absent en multipages.
 *
 * Ici on repart des scores déterministes de `citationScorer` (SERP, données
 * structurées, fraîcheur, autorité) puis on complète avec ce qui est déjà
 * mesuré ailleurs dans l'audit (quotabilité, signaux Knowledge Graph via GMB)
 * et enfin avec les valeurs éventuellement renvoyées par le LLM. 0 token.
 */

export interface CitationBreakdownOut {
  serp_presence: number | null;
  structured_data_quality: number | null;
  content_quotability: number | null;
  brand_authority: number | null;
  content_freshness: number | null;
  business_intent_match: number | null;
  self_citation_signals: number | null;
  knowledge_graph_signals: number | null;
}

const clamp = (v: unknown): number | null => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
};

/** Extrait le breakdown éventuellement renvoyé par le LLM, quelle que soit sa place. */
function llmBreakdown(parsed: any): Record<string, unknown> {
  const candidates = [
    parsed?.llm_visibility?.citation_breakdown,
    parsed?.citation_breakdown,
    parsed?.llm_visibility_raw?.citation_breakdown,
  ];
  for (const c of candidates) {
    if (c && typeof c === 'object' && !Array.isArray(c)) return c as Record<string, unknown>;
  }
  return {};
}

export function resolveCitationBreakdown(opts: {
  /** breakdown déterministe de computeFactualCitationScores */
  factual?: Partial<CitationBreakdownOut> | null;
  /** objet d'analyse LLM (parsedAnalysis) */
  parsedAnalysis?: any;
  /** données GMB normalisées (facultatif) */
  gmbData?: any;
}): CitationBreakdownOut {
  const f = opts.factual || {};
  const llm = llmBreakdown(opts.parsedAnalysis);
  const parsed = opts.parsedAnalysis || {};

  // Quotabilité : déjà mesurée par le module dédié.
  const quotability =
    clamp(parsed?.quotability?.score) ??
    clamp(parsed?.quotability_score?.score) ??
    clamp(parsed?.geo_citability?.score);

  // Knowledge Graph : forte corrélation avec la présence GMB (note + volume d'avis).
  const g = opts.gmbData || null;
  const rating = clamp((g?.network_avg_rating ?? g?.rating) != null ? Number(g?.network_avg_rating ?? g?.rating) * 20 : null);
  const reviews = Number(g?.network_total_reviews ?? g?.totalReviews ?? g?.reviews_count ?? 0);
  const kg = g
    ? clamp(Math.min(100, (rating ?? 40) * 0.6 + Math.min(40, Math.log10(Math.max(1, reviews)) * 20)))
    : null;

  const pick = (...vals: (number | null | undefined)[]): number | null => {
    for (const v of vals) {
      const c = clamp(v);
      if (c !== null) return c;
    }
    return null;
  };

  return {
    serp_presence: pick(f.serp_presence, llm['serp_presence'] as number),
    structured_data_quality: pick(f.structured_data_quality, llm['structured_data_quality'] as number),
    content_quotability: pick(llm['content_quotability'] as number, quotability),
    brand_authority: pick(f.brand_authority, llm['brand_authority'] as number),
    content_freshness: pick(f.content_freshness, llm['content_freshness'] as number),
    business_intent_match: pick(llm['business_intent_match'] as number, clamp(parsed?.conversational_intent?.score)),
    self_citation_signals: pick(llm['self_citation_signals'] as number),
    knowledge_graph_signals: pick(llm['knowledge_graph_signals'] as number, kg),
  };
}
