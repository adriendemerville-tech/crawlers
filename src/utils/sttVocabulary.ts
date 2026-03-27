/**
 * Post-processing dictionary for Speech-to-Text transcriptions.
 * Corrects common phonetic misrecognitions of Crawlers terminology,
 * feature names, and user-tracked domain names.
 * Auto-enriches from user's tracked site identity data.
 */

// ── Static Crawlers vocabulary ──────────────────────────────────────────
const CRAWLERS_VOCAB: [RegExp, string][] = [
  // Brand & product
  [/\bcrawler(?:s?)\b/gi, 'Crawlers'],
  [/\bfé ?li(?:x|ks)\b/gi, 'Félix'],
  [/\bpar ?mén(?:i|y)on\b/gi, 'Parménion'],

  // Features — prevent word splitting
  [/\bauto ?pil(?:ote?|ot)\b/gi, 'Autopilot'],
  [/\bco ?coo?n\b/gi, 'Cocoon'],
  [/\bmatrice\b/gi, 'Matrice'],
  [/\barchitecte? géné?rati(?:f|ve)\b/gi, 'Code Architect'],
  [/\bcontent? architecte?\b/gi, 'Content Architect'],
  [/\bstratège\b/gi, 'Stratège'],
  [/\baudit (?:exper(?:t|te?))\b/gi, 'Audit Expert'],
  [/\baudit compar(?:é|er|ée)\b/gi, 'Audit Comparé'],
  [/\baudit stratégi(?:que|c)\b/gi, 'Audit Stratégique'],
  [/\bpage ?speed\b/gi, 'PageSpeed'],
  [/\bcore ?web ?vita(?:l|ls|ux)\b/gi, 'Core Web Vitals'],

  // Technical terms
  [/\bjson ?l ?d\b/gi, 'JSON-LD'],
  [/\bschéma? ?\.?org\b/gi, 'Schema.org'],
  [/\brobots? ?\.?txt\b/gi, 'robots.txt'],
  [/\bsite ?map\b/gi, 'sitemap'],
  [/\bg ?s ?c\b/gi, 'GSC'],
  [/\bg ?a ?4\b/gi, 'GA4'],
  [/\bg ?m ?b\b/gi, 'GMB'],
  [/\bg ?t ?m\b/gi, 'GTM'],
  [/\bs ?e ?o\b/gi, 'SEO'],
  [/\bg ?e ?o\b/gi, 'GEO'],
  [/\be ?e? ?a ?t\b/gi, 'E-E-A-T'],
  [/\ba ?e ?o\b/gi, 'AEO'],
  [/\bi ?a ?s\b/gi, 'IAS'],
  [/\bl ?l ?m\b/gi, 'LLM'],

  // Common Crawlers UI terms
  [/\bpro agen(?:cy|si|cie)\b/gi, 'Pro Agency'],
  [/\bcrédi(?:t|ts) ?coi(?:n|ns)\b/gi, 'CreditCoin'],
  [/\bconsol(?:e|le)\b/gi, 'Console'],
  [/\bmes? sites?\b/gi, 'Mes sites'],
  [/\bplan(?:s?) d'action\b/gi, "plan d'action"],
  [/\bcodes? correcti(?:f|fs|ve|ves)\b/gi, 'code correctif'],

  // AI bots
  [/\bgpt ?bot\b/gi, 'GPTBot'],
  [/\bchat ?g ?p ?t\b/gi, 'ChatGPT'],
  [/\bgemini\b/gi, 'Gemini'],
  [/\bclaude\b/gi, 'Claude'],
  [/\bperplexity\b/gi, 'Perplexity'],

  // Tools
  [/\bdata ?for ?s ?e ?o\b/gi, 'DataForSEO'],
  [/\bfire ?crawl\b/gi, 'Firecrawl'],
  [/\bsem ?rush\b/gi, 'Semrush'],
  [/\bah ?refs?\b/gi, 'Ahrefs'],
  [/\bscreaming ?frog\b/gi, 'Screaming Frog'],
];

// ── Site identity data for dynamic enrichment ───────────────────────────
export interface SiteIdentity {
  domain: string;
  products_services?: string | null;
  market_sector?: string | null;
  target_audience?: string | null;
  main_serp_competitor?: string | null;
  confusion_risk?: string | null;
  business_type?: string | null;
}

/**
 * Extract meaningful multi-word terms from free-text identity fields.
 * Returns terms ≥ 3 chars that are likely proper nouns or brand names.
 */
function extractTerms(text: string | null | undefined): string[] {
  if (!text) return [];
  // Split on commas, semicolons, slashes, "et", "and", pipes
  const chunks = text.split(/[,;/|]|\bet\b|\band\b/gi).map(s => s.trim()).filter(s => s.length >= 3);
  // Keep each chunk as-is (preserve casing from the DB)
  return chunks;
}

/**
 * Build phonetic-tolerant regex for a term (allows spaces/hyphens between words).
 */
function termToRegex(term: string): RegExp | null {
  const words = term.trim().split(/[\s\-]+/).filter(w => w.length > 0);
  if (words.length === 0) return null;
  const pattern = words.map(w => escapeRegex(w)).join('[\\s\\-]*');
  try {
    return new RegExp(`\\b${pattern}\\b`, 'gi');
  } catch {
    return null;
  }
}

/**
 * Build dynamic correction patterns from site identity data.
 * Auto-enriches the vocabulary with products, competitors, sectors, etc.
 */
export function buildIdentityPatterns(sites: SiteIdentity[]): [RegExp, string][] {
  const patterns: [RegExp, string][] = [];
  const seen = new Set<string>();

  for (const site of sites) {
    // Extract terms from all identity fields
    const fields = [
      site.products_services,
      site.market_sector,
      site.target_audience,
      site.main_serp_competitor,
      site.confusion_risk,
      site.business_type,
    ];

    for (const field of fields) {
      for (const term of extractTerms(field)) {
        const key = term.toLowerCase();
        if (seen.has(key) || key.length < 3) continue;
        seen.add(key);

        const re = termToRegex(term);
        if (re) {
          patterns.push([re, term]);
        }
      }
    }
  }

  return patterns;
}

/**
 * Build domain-specific regex patterns from user's tracked sites.
 * Handles common phonetic splits (e.g. "ik tracker" → "iktracker.com").
 */
export function buildDomainPatterns(domains: string[]): [RegExp, string][] {
  const patterns: [RegExp, string][] = [];

  for (const domain of domains) {
    const base = domain.replace(/\.(com|fr|net|org|io|dev|co|ai|app|xyz|tech|eu|info|biz|me)$/i, '');
    if (base.length < 3) continue;

    const parts = base
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([a-zA-Z])(\d)/g, '$1 $2')
      .replace(/(\d)([a-zA-Z])/g, '$1 $2')
      .replace(/-/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(p => p.length > 0);

    if (parts.length >= 1) {
      const regexStr = parts.map(p => escapeRegex(p)).join('[\\s\\-]*');
      try {
        const re = new RegExp(`\\b${regexStr}\\b`, 'gi');
        patterns.push([re, domain]);
      } catch {
        // Invalid regex, skip
      }
    }

    // French phonetic variants
    const phoneticBase = base.toLowerCase()
      .replace(/tracker/g, '(?:tracker?|trackeur|traqueur)')
      .replace(/crawl/g, '(?:crawl|krol|crol)')
      .replace(/tech/g, '(?:tech|tek)')
      .replace(/web/g, '(?:web|ouèbe?)');

    if (phoneticBase !== base.toLowerCase()) {
      try {
        const re = new RegExp(`\\b${phoneticBase}\\b`, 'gi');
        patterns.push([re, domain]);
      } catch {
        // Skip invalid
      }
    }
  }

  return patterns;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Apply all vocabulary corrections to a raw STT transcript.
 * @param raw - The raw transcript from Web Speech API
 * @param userDomains - Optional list of domains tracked by the user
 * @param siteIdentities - Optional identity data for auto-enrichment
 * @returns Corrected transcript
 */
export function correctTranscript(
  raw: string,
  userDomains?: string[],
  siteIdentities?: SiteIdentity[],
): string {
  let text = raw;

  // 1. Domain corrections (most specific)
  if (userDomains?.length) {
    const domainPatterns = buildDomainPatterns(userDomains);
    for (const [regex, replacement] of domainPatterns) {
      text = text.replace(regex, replacement);
    }
  }

  // 2. Identity-enriched corrections (products, competitors, sectors)
  if (siteIdentities?.length) {
    const identityPatterns = buildIdentityPatterns(siteIdentities);
    for (const [regex, replacement] of identityPatterns) {
      text = text.replace(regex, replacement);
    }
  }

  // 3. Static Crawlers vocabulary corrections
  for (const [regex, replacement] of CRAWLERS_VOCAB) {
    text = text.replace(regex, replacement);
  }

  return text;
}
