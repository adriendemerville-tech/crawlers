/**
 * sentenceCase.ts — Deterministic French sentence-case normalizer for titles.
 *
 * Rule: in French, titles must use sentence case (only the first word + proper
 * nouns capitalized). The Anglo-Saxon "Title Case" (every word capitalized)
 * hurts CTR, confuses Named Entity Recognition for LLMs, and signals low
 * editorial quality (E-E-A-T).
 *
 * This module is the last line of defense applied AFTER the LLM call to
 * guarantee compliance even if the model ignores prompt instructions.
 */

// Words that should keep their initial capital regardless of position
// (proper nouns, brands, acronyms common in our domain).
const ALWAYS_CAPITALIZED = new Set([
  // Brands / products
  'google', 'bing', 'yandex', 'baidu', 'duckduckgo', 'ecosia',
  'chatgpt', 'gpt', 'claude', 'gemini', 'perplexity', 'mistral', 'llama',
  'openai', 'anthropic', 'meta', 'microsoft', 'apple', 'amazon', 'shopify',
  'wordpress', 'wix', 'webflow', 'drupal', 'odoo', 'prestashop',
  'iktracker', 'crawlers', 'lovable', 'supabase', 'cloudflare', 'vercel',
  'youtube', 'linkedin', 'facebook', 'instagram', 'tiktok', 'twitter', 'x',
  'github', 'stripe', 'paypal', 'paddle',
  // Standards / technologies
  'seo', 'geo', 'aeo', 'sea', 'sem', 'serp', 'ctr', 'ux', 'ui', 'cms',
  'api', 'sdk', 'json', 'html', 'css', 'js', 'ts', 'php', 'sql',
  'rgpd', 'gdpr', 'ssl', 'tls', 'http', 'https', 'dns', 'cdn', 'spa',
  'ai', 'ia', 'llm', 'llms', 'rag', 'nlp', 'ner', 'sge', 'aio',
  'gsc', 'ga4', 'gmb', 'eeat', 'mcp',
  'core', 'web', 'vitals', 'lcp', 'cls', 'inp', 'fid', 'ttfb',
  // Months / weekdays would also stay lowercase in French — do nothing
  // Countries / regions
  'france', 'europe', 'paris', 'lyon', 'marseille', 'toulouse', 'bordeaux',
  'nantes', 'lille', 'strasbourg', 'nice', 'rennes', 'usa', 'uk',
]);

// Detect if a string is "Title Case" (suspicious): >= 4 words AND
// >= 60% of words start with an uppercase letter.
export function isAnglicizedTitleCase(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;

  // Skip ALL-CAPS strings (acronyms, intentional shouting)
  if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) return false;

  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 4) return false;

  let capitalized = 0;
  for (const w of words) {
    // Strip leading punctuation (« " ' ( [)
    const stripped = w.replace(/^[«"'`(\[{]+/, '');
    const first = stripped.charAt(0);
    if (first && first === first.toUpperCase() && first !== first.toLowerCase()) {
      capitalized++;
    }
  }
  return capitalized / words.length >= 0.6;
}

/**
 * Normalize a title to French sentence case.
 * - First word: capitalized
 * - All other words: lowercased UNLESS they are in ALWAYS_CAPITALIZED
 *   or look like a proper noun heuristically (single uppercase letter
 *   followed by lowercase, length >= 3, not in stopword list).
 *
 * The function is conservative: if the input does NOT look like Title Case,
 * it is returned unchanged. This avoids destroying intentional capitalization.
 */
export function toFrenchSentenceCase(text: string): string {
  if (!text || typeof text !== 'string') return text;
  if (!isAnglicizedTitleCase(text)) return text;

  const trimmed = text.trim();
  // Tokenize while preserving spaces and punctuation
  const tokens = trimmed.split(/(\s+)/);

  let firstWordSeen = false;
  return tokens
    .map((token) => {
      if (/^\s+$/.test(token)) return token;

      // Detach leading punctuation
      const leadingMatch = token.match(/^([«"'`(\[{]+)?(.*)$/);
      const leading = leadingMatch?.[1] ?? '';
      const rest = leadingMatch?.[2] ?? token;

      // Detach trailing punctuation
      const trailingMatch = rest.match(/^(.*?)([»"')\]},.;:!?]*)$/);
      const word = trailingMatch?.[1] ?? rest;
      const trailing = trailingMatch?.[2] ?? '';

      if (word.length === 0) return token;

      const lower = word.toLowerCase();
      let normalized: string;

      if (!firstWordSeen) {
        // First word: capitalize
        normalized = lower.charAt(0).toUpperCase() + lower.slice(1);
        firstWordSeen = true;
      } else if (ALWAYS_CAPITALIZED.has(lower)) {
        // Known proper noun / brand / acronym: keep capitalized
        // Acronyms: uppercase if length <= 4 and was originally uppercase
        if (lower.length <= 4 && word === word.toUpperCase()) {
          normalized = word.toUpperCase();
        } else {
          normalized = lower.charAt(0).toUpperCase() + lower.slice(1);
        }
      } else if (word === word.toUpperCase() && word.length >= 2 && /[A-Z]/.test(word)) {
        // ALL-CAPS token (likely acronym not in our list): preserve
        normalized = word;
      } else {
        // Regular word: lowercase
        normalized = lower;
      }

      return leading + normalized + trailing;
    })
    .join('');
}

/**
 * Normalize all <h2> and <h3> headings inside an HTML string to sentence case.
 * Leaves the rest of the HTML untouched.
 */
export function normalizeHtmlHeadings(html: string): string {
  if (!html || typeof html !== 'string') return html;
  return html.replace(/<(h[1-6])([^>]*)>([\s\S]*?)<\/\1>/gi, (_full, tag, attrs, inner) => {
    // Skip if heading contains other HTML tags (links, spans, etc.)
    // We still apply normalization to text content but preserve structure.
    const stripped = String(inner).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!stripped) return `<${tag}${attrs}>${inner}</${tag}>`;
    if (!isAnglicizedTitleCase(stripped)) return `<${tag}${attrs}>${inner}</${tag}>`;
    // Plain-text heading: safe to fully replace
    if (!/<[^>]+>/.test(inner)) {
      return `<${tag}${attrs}>${toFrenchSentenceCase(String(inner))}</${tag}>`;
    }
    // Heading with embedded HTML: only normalize text nodes
    const normalizedInner = String(inner).replace(/>([^<]+)</g, (_m, txt) => {
      return `>${toFrenchSentenceCase(txt)}<`;
    });
    return `<${tag}${attrs}>${normalizedInner}</${tag}>`;
  });
}
