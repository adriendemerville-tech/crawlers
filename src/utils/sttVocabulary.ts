/**
 * Post-processing dictionary for Speech-to-Text transcriptions.
 * Corrects common phonetic misrecognitions of Crawlers terminology,
 * feature names, and user-tracked domain names.
 */

// ── Static Crawlers vocabulary ──────────────────────────────────────────
// Map of common STT mistakes (lowercase) → correct form
const CRAWLERS_VOCAB: [RegExp, string][] = [
  // Brand & product
  [/\bcrawler(?:s?)\b/gi, 'Crawlers'],
  [/\bfé ?li(?:x|ks)\b/gi, 'Félix'],
  [/\bpar ?mén(?:i|y)on\b/gi, 'Parménion'],

  // Features — prevent word splitting
  [/\bauto ?pil(?:ote?|ot)\b/gi, 'Autopilot'],
  [/\bco ?coo?n\b/gi, 'Cocoon'],
  [/\bmatrice\b/gi, 'Matrice'],
  [/\barchitecte? géné?rati(?:f|ve)\b/gi, 'Architecte Génératif'],
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

/**
 * Build domain-specific regex patterns from user's tracked sites.
 * Handles common phonetic splits (e.g. "ik tracker" → "iktracker.com").
 */
export function buildDomainPatterns(domains: string[]): [RegExp, string][] {
  const patterns: [RegExp, string][] = [];

  for (const domain of domains) {
    // Strip TLD for the base name
    const base = domain.replace(/\.(com|fr|net|org|io|dev|co|ai|app|xyz|tech|eu|info|biz|me)$/i, '');
    if (base.length < 3) continue;

    // Create a regex that matches the domain name with optional spaces between characters
    // e.g. "iktracker" → matches "ik tracker", "i k tracker", "iktracker"
    // Split on natural word boundaries (camelCase, numbers, hyphens)
    const parts = base
      .replace(/([a-z])([A-Z])/g, '$1 $2')   // camelCase split
      .replace(/([a-zA-Z])(\d)/g, '$1 $2')    // letter-number split
      .replace(/(\d)([a-zA-Z])/g, '$1 $2')    // number-letter split
      .replace(/-/g, ' ')                       // hyphen split
      .toLowerCase()
      .split(/\s+/)
      .filter(p => p.length > 0);

    if (parts.length >= 1) {
      // Build flexible regex: each part can be separated by optional spaces/hyphens
      const regexStr = parts.map(p => escapeRegex(p)).join('[\\s\\-]*');
      try {
        const re = new RegExp(`\\b${regexStr}\\b`, 'gi');
        patterns.push([re, domain]);
      } catch {
        // Invalid regex, skip
      }
    }

    // Also catch phonetic variants: add common French phonetic confusions
    // e.g. "tracker" might become "trackeur" or "traqueur"
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
 * @returns Corrected transcript
 */
export function correctTranscript(raw: string, userDomains?: string[]): string {
  let text = raw;

  // Apply domain corrections first (more specific)
  if (userDomains?.length) {
    const domainPatterns = buildDomainPatterns(userDomains);
    for (const [regex, replacement] of domainPatterns) {
      text = text.replace(regex, replacement);
    }
  }

  // Apply Crawlers vocabulary corrections
  for (const [regex, replacement] of CRAWLERS_VOCAB) {
    text = text.replace(regex, replacement);
  }

  return text;
}
