/**
 * Matrice Type Detector — determines if imported data is SEO, GEO, Hybrid, or Benchmark.
 * Also detects variable sheets for identity card enrichment.
 * Runs client-side on column headers + sample values.
 */

export type MatriceType = 'seo' | 'geo' | 'hybrid' | 'benchmark';

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

// ── Benchmark-specific patterns (full prompt + engine columns) ───────
const BENCHMARK_PATTERNS = [
  /^full_prompt$/i, /^engine$/i, /^moteur$/i,
];

// ── Variable sheet patterns ──────────────────────────────────────────
const VARIABLE_PATTERNS = [
  /^variable$/i, /^var$/i, /^nom$/i,
];
const VALUE_PATTERNS = [
  /^valeur$/i, /^value$/i, /^val$/i,
];

export interface DetectionResult {
  type: MatriceType;
  confidence: number;       // 0-1
  geoScore: number;
  seoScore: number;
  benchmarkScore: number;
  matchedGeo: string[];     // headers that matched GEO
  matchedSeo: string[];     // headers that matched SEO
  isVariableSheet: boolean;
}

export function isVariableSheet(headers: string[]): boolean {
  return headers.some(h => VARIABLE_PATTERNS.some(p => p.test(h.trim()))) &&
    headers.some(h => VALUE_PATTERNS.some(p => p.test(h.trim())));
}

export function detectMatriceType(
  headers: string[],
  _sampleRows?: Record<string, any>[],
): DetectionResult {
  const matchedGeo: string[] = [];
  const matchedSeo: string[] = [];
  let benchmarkScore = 0;

  // Check if this is a variable sheet
  const varSheet = isVariableSheet(headers);

  for (const h of headers) {
    if (GEO_PATTERNS.some(p => p.test(h))) matchedGeo.push(h);
    if (SEO_PATTERNS.some(p => p.test(h))) matchedSeo.push(h);
    if (BENCHMARK_PATTERNS.some(p => p.test(h))) benchmarkScore++;
  }

  // Check for engine column + full_prompt → benchmark mode
  const hasEngine = headers.some(h => /^engine$/i.test(h.trim()) || /^moteur$/i.test(h.trim()));
  const hasFullPrompt = headers.some(h => /^full_prompt$/i.test(h.trim()));
  const hasTheme = headers.some(h => /^theme$/i.test(h.trim()) || /^thème$/i.test(h.trim()));

  const geoScore = matchedGeo.length;
  const seoScore = matchedSeo.length;
  const total = geoScore + seoScore;

  let type: MatriceType;
  let confidence: number;

  // Benchmark takes priority if engine + full_prompt detected
  if (hasEngine && hasFullPrompt) {
    type = 'benchmark';
    confidence = 0.95;
  } else if (hasEngine && hasTheme && geoScore > seoScore) {
    type = 'benchmark';
    confidence = 0.8;
  } else if (total === 0) {
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
      confidence = 1 - Math.abs(geoRatio - 0.5) * 2;
    }
  } else if (geoScore > 0) {
    type = 'geo';
    confidence = Math.min(1, geoScore / 3);
  } else {
    type = 'seo';
    confidence = Math.min(1, seoScore / 3);
  }

  return { type, confidence, geoScore, seoScore, benchmarkScore, matchedGeo, matchedSeo, isVariableSheet: varSheet };
}
