/* ================================================================== */
/*  Crawl Page Quality — Deterministic page-level scoring from        */
/*  crawl_pages data (no HTML needed, 0 LLM token)                    */
/*  Used by: cocoon-strategist, cocoon-auto-linking                   */
/*  Philosophy: mirrors seoScoringV2 axes but works with persisted    */
/*  crawl fields instead of raw HTML.                                 */
/* ================================================================== */

export type BusinessProfile = 'saas' | 'ecommerce' | 'local_business' | 'media' | 'agency' | 'generic';

export interface CrawlPageInput {
  url: string;
  title: string | null;
  h1: string | null;
  meta_description?: string | null;
  word_count?: number | null;
  seo_score?: number | null;
  has_schema_org?: boolean | null;
  has_canonical?: boolean | null;
  has_og?: boolean | null;
  has_noindex?: boolean | null;
  has_nofollow?: boolean | null;
  is_indexable?: boolean | null;
  images_total?: number | null;
  images_without_alt?: number | null;
  internal_links?: number | null;
  external_links?: number | null;
  h2_count?: number | null;
  h3_count?: number | null;
  crawl_depth?: number | null;
  http_status?: number | null;
  issues?: string[] | null;
}

export interface CrawlPageQualityResult {
  overall: number;  // 0-100
  axes: {
    content_depth: number;
    structure: number;
    meta_quality: number;
    linking: number;
    technical: number;
    accessibility: number;
  };
  weaknesses: string[];
  strengths: string[];
}

interface ProfileWeights {
  content_depth: number;
  structure: number;
  meta_quality: number;
  linking: number;
  technical: number;
  accessibility: number;
  idealWords: number;
}

const PROFILES: Record<BusinessProfile, ProfileWeights> = {
  local_business: { content_depth: 0.10, structure: 0.10, meta_quality: 0.25, linking: 0.15, technical: 0.20, accessibility: 0.20, idealWords: 500 },
  ecommerce:      { content_depth: 0.10, structure: 0.15, meta_quality: 0.25, linking: 0.20, technical: 0.20, accessibility: 0.10, idealWords: 400 },
  saas:           { content_depth: 0.25, structure: 0.15, meta_quality: 0.15, linking: 0.15, technical: 0.15, accessibility: 0.15, idealWords: 1500 },
  media:          { content_depth: 0.30, structure: 0.15, meta_quality: 0.10, linking: 0.15, technical: 0.15, accessibility: 0.15, idealWords: 1800 },
  agency:         { content_depth: 0.20, structure: 0.15, meta_quality: 0.15, linking: 0.15, technical: 0.20, accessibility: 0.15, idealWords: 1200 },
  generic:        { content_depth: 0.20, structure: 0.15, meta_quality: 0.15, linking: 0.15, technical: 0.20, accessibility: 0.15, idealWords: 1000 },
};

/**
 * Compute a deterministic quality score from crawl_pages fields.
 * Returns 0-100 with per-axis breakdown.
 */
export function computeCrawlPageQuality(
  page: CrawlPageInput,
  businessProfile: BusinessProfile = 'generic',
): CrawlPageQualityResult {
  const profile = PROFILES[businessProfile];
  const weaknesses: string[] = [];
  const strengths: string[] = [];

  // 1. CONTENT DEPTH (word count vs ideal)
  const wc = page.word_count || 0;
  let contentScore = 0;
  if (wc === 0) {
    contentScore = 0;
    weaknesses.push('no_content');
  } else {
    const ratio = wc / profile.idealWords;
    if (ratio >= 0.8 && ratio <= 2.0) {
      contentScore = 100;
      strengths.push('good_content_depth');
    } else if (ratio >= 0.5) {
      contentScore = 60 + (ratio - 0.5) * 133; // 60-100 range
    } else if (ratio > 2.0) {
      contentScore = Math.max(60, 100 - (ratio - 2.0) * 20);
    } else {
      contentScore = Math.max(10, ratio * 120);
      weaknesses.push('thin_content');
    }
  }

  // 2. STRUCTURE (headings)
  let structureScore = 50; // baseline
  if (page.h1) {
    structureScore += 20;
    if (page.title && page.h1 !== page.title) structureScore += 5; // differentiation
  } else {
    weaknesses.push('missing_h1');
  }
  const h2 = page.h2_count || 0;
  const h3 = page.h3_count || 0;
  if (h2 >= 2) { structureScore += 15; strengths.push('good_heading_hierarchy'); }
  else if (h2 === 1) structureScore += 8;
  if (h3 >= 1 && h2 >= 1) structureScore += 10;
  else if (h3 >= 1 && h2 === 0) weaknesses.push('heading_gap_h1_h3');

  // 3. META QUALITY
  let metaScore = 0;
  if (page.title) {
    const tLen = page.title.length;
    metaScore += tLen >= 30 && tLen <= 60 ? 35 : tLen > 0 ? 20 : 0;
  } else {
    weaknesses.push('missing_title');
  }
  if (page.meta_description) {
    const mdLen = page.meta_description.length;
    metaScore += mdLen >= 120 && mdLen <= 160 ? 25 : mdLen > 0 ? 15 : 0;
  } else {
    weaknesses.push('missing_meta_description');
  }
  if (page.has_og) metaScore += 15;
  if (page.has_canonical) metaScore += 15;
  if (page.has_schema_org) { metaScore += 10; strengths.push('structured_data'); }

  // 4. LINKING
  const il = page.internal_links || 0;
  const el = page.external_links || 0;
  let linkScore = 0;
  if (il >= 3 && il <= 50) { linkScore += 50; strengths.push('good_internal_linking'); }
  else if (il > 0) linkScore += 25;
  else weaknesses.push('no_internal_links');
  if (el >= 1 && el <= 10) linkScore += 30;
  else if (el > 10) linkScore += 20;
  if (il + el > 0) linkScore += 20; // non-orphan bonus

  // 5. TECHNICAL
  let techScore = 50;
  if (page.http_status === 200) techScore += 20;
  else if (page.http_status && page.http_status >= 300) { techScore -= 30; weaknesses.push('non_200_status'); }
  if (page.is_indexable !== false) techScore += 15;
  else weaknesses.push('noindex');
  if (page.has_nofollow) { techScore -= 10; weaknesses.push('nofollow'); }
  const depth = page.crawl_depth ?? 0;
  if (depth <= 2) techScore += 15;
  else if (depth <= 3) techScore += 5;
  else { techScore -= 10; weaknesses.push('deep_page'); }

  // 6. ACCESSIBILITY (images alt)
  let accessScore = 70; // baseline
  const totalImg = page.images_total || 0;
  const noAlt = page.images_without_alt || 0;
  if (totalImg > 0) {
    const altRatio = 1 - (noAlt / totalImg);
    accessScore = Math.round(altRatio * 100);
    if (altRatio >= 0.9) strengths.push('good_alt_coverage');
    else if (altRatio < 0.5) weaknesses.push('many_images_without_alt');
  }

  // Clamp all scores to 0-100
  const axes = {
    content_depth: clamp(contentScore),
    structure: clamp(structureScore),
    meta_quality: clamp(metaScore),
    linking: clamp(linkScore),
    technical: clamp(techScore),
    accessibility: clamp(accessScore),
  };

  // Weighted overall
  const overall = Math.round(
    axes.content_depth * profile.content_depth +
    axes.structure * profile.structure +
    axes.meta_quality * profile.meta_quality +
    axes.linking * profile.linking +
    axes.technical * profile.technical +
    axes.accessibility * profile.accessibility
  );

  return { overall: clamp(overall), axes, weaknesses, strengths };
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

/**
 * Map a business_type/entity_type string to a BusinessProfile.
 * Reuses the same keyword mapping as parmenion-orchestrator.
 */
export function resolveBusinessProfile(businessType?: string | null): BusinessProfile {
  if (!businessType) return 'generic';
  const bt = businessType.toLowerCase();
  if (/artisan|restaurant|cabinet|médecin|avocat|plombier|boulang|coiffeur|garage|local/i.test(bt)) return 'local_business';
  if (/ecommerce|boutique|shop|magasin|store/i.test(bt)) return 'ecommerce';
  if (/saas|logiciel|software|app/i.test(bt)) return 'saas';
  if (/media|presse|journal|blog|magazine/i.test(bt)) return 'media';
  if (/agence|agency|consultant|freelance/i.test(bt)) return 'agency';
  return 'generic';
}
