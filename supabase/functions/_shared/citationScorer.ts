/**
 * citationScorer.ts
 *
 * Pre-computes factual citation sub-scores from real data sources
 * before LLM evaluation. The LLM only scores what it can't measure.
 *
 * Factual (computed here):
 *   - serp_presence        (20%) — from DataForSEO rankings
 *   - structured_data_quality (10%) — from crawl HTML analysis
 *   - content_freshness    (5%)  — from crawl date signals
 *   - brand_authority      (15%) — from backlinks/domain rank
 *
 * LLM-evaluated (injected as null, LLM fills them):
 *   - content_quotability  (15%) — requires semantic analysis
 *   - business_intent_match (15%) — requires sector understanding
 *   - self_citation_signals (10%) — detectable in HTML but LLM is better
 *   - knowledge_graph_signals (10%) — LLM estimates from entity signals
 */

export interface CitationBreakdown {
  serp_presence: number | null;
  structured_data_quality: number | null;
  content_quotability: number | null;
  brand_authority: number | null;
  content_freshness: number | null;
  business_intent_match: number | null;
  self_citation_signals: number | null;
  knowledge_graph_signals: number | null;
}

export interface FactualCitationContext {
  breakdown: CitationBreakdown;
  factual_summary: string; // Injected into the prompt as context
}

interface RankingData {
  total_ranked_keywords?: number;
  average_position_global?: number;
  average_position_top10?: number;
  distribution?: {
    top3?: number;
    top10?: number;
    top20?: number;
    top50?: number;
    top100?: number;
  };
  etv?: number;
}

interface BacklinkData {
  domain_rank?: number;
  referring_domains?: number;
  backlinks_total?: number;
}

interface CrawlToolsData {
  overallScore?: number;
  scores?: {
    structured_data?: number;
    structuredData?: number;
    [key: string]: any;
  };
  rawData?: {
    htmlAnalysis?: {
      structuredData?: {
        jsonLd?: any[];
        hasJsonLd?: boolean;
        schemaTypes?: string[];
      };
      insights?: {
        freshness?: {
          lastModifiedDate?: string;
          hasCurrentYearMention?: boolean;
        };
      };
    };
    lastModified?: string;
    [key: string]: any;
  };
}

interface GmbData {
  completeness_score?: number;
  rating?: number;
  total_reviews?: number;
  [key: string]: any;
}

/**
 * Compute SERP presence score (0-100) from real ranking data.
 */
function scoreSerpPresence(ranking?: RankingData | null): number | null {
  if (!ranking || !ranking.distribution) return null;

  const d = ranking.distribution;
  const top3 = d.top3 ?? 0;
  const top10 = d.top10 ?? 0;
  const top20 = d.top20 ?? 0;
  const total = ranking.total_ranked_keywords ?? 0;

  if (total === 0) return 5; // Site exists but no rankings

  // Weighted: top3 keywords are most valuable for LLM citation
  let score = 0;
  score += Math.min(40, top3 * 13);       // Up to 40pts for top3 presence (3 kw = 39)
  score += Math.min(30, (top10 - top3) * 4); // Up to 30pts for rest of top10
  score += Math.min(15, (top20 - top10) * 2); // Up to 15pts for top20
  score += Math.min(15, Math.sqrt(total) * 3); // Up to 15pts for breadth

  return Math.min(100, Math.round(score));
}

/**
 * Compute structured data quality (0-100) from crawl data.
 */
function scoreStructuredData(crawlData?: CrawlToolsData | null): number | null {
  if (!crawlData) return null;

  // Use crawl's own structured_data score if available
  const sdScore = crawlData.scores?.structured_data ?? crawlData.scores?.structuredData;
  if (typeof sdScore === 'number') return Math.min(100, Math.round(sdScore));

  // Fallback: check raw HTML analysis
  const sd = crawlData.rawData?.htmlAnalysis?.structuredData;
  if (!sd) return 10; // No structured data info = poor

  let score = 0;
  if (sd.hasJsonLd || (sd.jsonLd && sd.jsonLd.length > 0)) score += 40;
  if (sd.schemaTypes && sd.schemaTypes.length > 0) {
    score += Math.min(40, sd.schemaTypes.length * 10);
    // Bonus for high-value schema types
    const highValue = ['FAQPage', 'HowTo', 'Product', 'LocalBusiness', 'Organization', 'Person', 'Article'];
    const hasHighValue = sd.schemaTypes.some((t: string) => highValue.some(hv => t.includes(hv)));
    if (hasHighValue) score += 20;
  }

  return Math.min(100, score);
}

/**
 * Compute content freshness (0-100) from date signals.
 */
function scoreContentFreshness(crawlData?: CrawlToolsData | null): number | null {
  if (!crawlData) return null;

  const freshness = crawlData.rawData?.htmlAnalysis?.insights?.freshness;
  const lastModStr = freshness?.lastModifiedDate || crawlData.rawData?.lastModified;

  if (!lastModStr && !freshness?.hasCurrentYearMention) return 30; // Unknown = mediocre

  let score = 0;

  if (freshness?.hasCurrentYearMention) score += 40;

  if (lastModStr) {
    try {
      const lastMod = new Date(lastModStr);
      const ageMs = Date.now() - lastMod.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);

      if (ageDays < 30) score += 60;
      else if (ageDays < 90) score += 45;
      else if (ageDays < 180) score += 30;
      else if (ageDays < 365) score += 15;
      else score += 5;
    } catch {
      score += 20;
    }
  }

  return Math.min(100, score);
}

/**
 * Compute brand authority (0-100) from backlink data.
 */
function scoreBrandAuthority(backlinks?: BacklinkData | null): number | null {
  if (!backlinks) return null;

  const dr = backlinks.domain_rank ?? 0;
  const refDomains = backlinks.referring_domains ?? 0;

  if (dr === 0 && refDomains === 0) return 5;

  let score = 0;

  // Domain rank (0-100 scale, already normalized by DataForSEO)
  score += Math.min(50, dr * 0.5);

  // Referring domains (logarithmic — diminishing returns)
  if (refDomains > 0) {
    score += Math.min(50, Math.round(Math.log10(refDomains) * 20));
  }

  return Math.min(100, Math.round(score));
}

/**
 * Main entry: compute all factual scores and generate prompt context.
 */
export function computeFactualCitationScores(opts: {
  rankingOverview?: RankingData | null;
  crawlData?: CrawlToolsData | null;
  backlinkData?: BacklinkData | null;
  gmbData?: GmbData | null;
}): FactualCitationContext {
  const serp = scoreSerpPresence(opts.rankingOverview);
  const sd = scoreStructuredData(opts.crawlData);
  const freshness = scoreContentFreshness(opts.crawlData);
  const authority = scoreBrandAuthority(opts.backlinkData);

  const breakdown: CitationBreakdown = {
    serp_presence: serp,
    structured_data_quality: sd,
    content_freshness: freshness,
    brand_authority: authority,
    // These are left to the LLM
    content_quotability: null,
    business_intent_match: null,
    self_citation_signals: null,
    knowledge_graph_signals: null,
  };

  // Build a compact summary for prompt injection
  const parts: string[] = ['📊 SCORES DE CITABILITÉ PRÉ-CALCULÉS (données réelles — NE PAS deviner ces valeurs):'];

  if (serp !== null) parts.push(`- serp_presence = ${serp}/100 (basé sur ${opts.rankingOverview?.total_ranked_keywords || 0} mots-clés positionnés, top3=${opts.rankingOverview?.distribution?.top3 || 0}, top10=${opts.rankingOverview?.distribution?.top10 || 0})`);
  if (sd !== null) parts.push(`- structured_data_quality = ${sd}/100 (basé sur analyse JSON-LD/Schema.org du HTML crawlé)`);
  if (freshness !== null) parts.push(`- content_freshness = ${freshness}/100 (basé sur dates détectées dans le contenu)`);
  if (authority !== null) parts.push(`- brand_authority = ${authority}/100 (basé sur domain_rank=${opts.backlinkData?.domain_rank || 0}, referring_domains=${opts.backlinkData?.referring_domains || 0})`);

  if (opts.gmbData) {
    const gmbScore = opts.gmbData.completeness_score ?? 0;
    const gmbRating = opts.gmbData.rating ?? 0;
    const gmbReviews = opts.gmbData.total_reviews ?? 0;
    parts.push(`- GMB: complétude=${gmbScore}%, note=${gmbRating}/5, ${gmbReviews} avis (utilise ces données pour knowledge_graph_signals et brand_authority si > valeur pré-calculée)`);
  }

  const nullSignals = Object.entries(breakdown).filter(([_, v]) => v === null).map(([k]) => k);
  if (nullSignals.length > 0) {
    parts.push(`⚠️ Signaux À ÉVALUER par toi (analyse le contenu crawlé): ${nullSignals.join(', ')}`);
  }

  parts.push('IMPORTANT: Pour citation_breakdown, UTILISE les valeurs pré-calculées ci-dessus telles quelles. Évalue UNIQUEMENT les signaux marqués null.');

  return {
    breakdown,
    factual_summary: parts.join('\n'),
  };
}
