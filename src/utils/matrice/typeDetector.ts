/**
 * Matrice Type Detector — determines if imported data is SEO, GEO, or Hybrid.
 * Runs client-side on column headers + sample values.
 */

export type MatriceType = 'seo' | 'geo' | 'hybrid';

// ── GEO-specific header patterns ─────────────────────────────────────
const GEO_PATTERNS = [
  /chatgpt/i, /gemini/i, /perplexity/i, /copilot/i, /claude/i, /mistral/i,
  /citabilit[eé]/i, /mentionne/i, /recommand/i, /rang_/i, /cit[eé]/i,
  /score_citabilite/i, /type_de_source/i, /score_moyen_prompt/i,
  /prompt_prioritaire/i, /aller_vite/i, /geo/i, /ia_ready/i,
  /ai.ready/i, /llm_score/i, /visibility_ai/i,
];

// ── SEO-specific header patterns ─────────────────────────────────────
const SEO_PATTERNS = [
  /balise/i, /^h[1-6]$/i, /meta.?desc/i, /canonical/i, /schema/i,
  /json.?ld/i, /robots/i, /sitemap/i, /^lcp$/i, /^fcp$/i, /^cls$/i,
  /^tbt$/i, /pagespeed/i, /lighthouse/i, /core.?web.?vital/i,
  /structured.?data/i, /donn[eé]es.?structur[eé]es/i,
  /hreflang/i, /og:/i, /viewport/i, /alt.?text/i,
  /backlink/i, /maillage/i, /internal.?link/i, /crawl/i,
  /indexab/i, /noindex/i, /nofollow/i, /seo/i,
  /performance/i, /s[eé]curit[eé]/i, /ssl/i, /https/i,
];

export interface DetectionResult {
  type: MatriceType;
  confidence: number;       // 0-1
  geoScore: number;
  seoScore: number;
  matchedGeo: string[];     // headers that matched GEO
  matchedSeo: string[];     // headers that matched SEO
}

export function detectMatriceType(
  headers: string[],
  _sampleRows?: Record<string, any>[],
): DetectionResult {
  const matchedGeo: string[] = [];
  const matchedSeo: string[] = [];

  for (const h of headers) {
    if (GEO_PATTERNS.some(p => p.test(h))) matchedGeo.push(h);
    if (SEO_PATTERNS.some(p => p.test(h))) matchedSeo.push(h);
  }

  const geoScore = matchedGeo.length;
  const seoScore = matchedSeo.length;
  const total = geoScore + seoScore;

  let type: MatriceType;
  let confidence: number;

  if (total === 0) {
    // No strong signal — default to SEO (most common)
    type = 'seo';
    confidence = 0.3;
  } else if (geoScore > 0 && seoScore > 0) {
    const geoRatio = geoScore / total;
    if (geoRatio > 0.7) {
      type = 'geo';
      confidence = geoRatio;
    } else if (geoRatio < 0.3) {
      type = 'seo';
      confidence = 1 - geoRatio;
    } else {
      type = 'hybrid';
      confidence = 1 - Math.abs(geoRatio - 0.5) * 2; // highest near 50/50
    }
  } else if (geoScore > 0) {
    type = 'geo';
    confidence = Math.min(1, geoScore / 3);
  } else {
    type = 'seo';
    confidence = Math.min(1, seoScore / 3);
  }

  return { type, confidence, geoScore, seoScore, matchedGeo, matchedSeo };
}
