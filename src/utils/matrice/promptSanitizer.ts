/**
 * promptSanitizer — Strips hardcoded URLs and brand names from imported prompts,
 * replacing them with reusable placeholders so the matrix works for any site.
 */

// Placeholder tokens used in sanitized prompts
export const PLACEHOLDERS = {
  URL: '[URL_SITE]',
  BRAND: '[NOM_MARQUE]',
  DOMAIN: '[DOMAINE]',
} as const;

/**
 * Sanitize a single prompt string by replacing detected URLs and brand names
 * with generic placeholders.
 */
export function sanitizePrompt(
  prompt: string,
  knownBrandNames?: string[],
  knownDomains?: string[],
): string {
  if (!prompt || typeof prompt !== 'string') return prompt;
  let result = prompt;

  // 1. Replace full URLs (https://example.com/path or http://...)
  result = result.replace(
    /https?:\/\/[^\s,;)"'\]>]+/gi,
    PLACEHOLDERS.URL,
  );

  // 2. Replace www.domain.tld patterns (without protocol)
  result = result.replace(
    /www\.[a-z0-9\-]+\.[a-z]{2,}[^\s,;)"'\]>]*/gi,
    PLACEHOLDERS.URL,
  );

  // 3. Replace bare domain.tld patterns that look like websites
  //    (only well-known TLDs to avoid false positives)
  const tldPattern = /\b[a-z0-9\-]{2,}\.(com|fr|be|ch|ca|de|es|it|co\.uk|org|net|io|ai|dev|app)\b/gi;
  result = result.replace(tldPattern, PLACEHOLDERS.DOMAIN);

  // 4. Replace known brand names (case-insensitive, word boundary)
  if (knownBrandNames?.length) {
    for (const brand of knownBrandNames) {
      if (!brand || brand.length < 2) continue;
      const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      result = result.replace(regex, PLACEHOLDERS.BRAND);
    }
  }

  // 5. Replace known domains as plain text (e.g. "example" from "example.com")
  if (knownDomains?.length) {
    for (const domain of knownDomains) {
      if (!domain || domain.length < 3) continue;
      const slug = domain.replace(/^www\./, '').split('.')[0];
      if (slug.length < 3) continue;
      const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      result = result.replace(regex, PLACEHOLDERS.BRAND);
    }
  }

  // 6. Collapse repeated placeholders
  result = result.replace(/(\[URL_SITE\]\s*){2,}/g, PLACEHOLDERS.URL + ' ');
  result = result.replace(/(\[NOM_MARQUE\]\s*){2,}/g, PLACEHOLDERS.BRAND + ' ');
  result = result.replace(/(\[DOMAINE\]\s*){2,}/g, PLACEHOLDERS.DOMAIN + ' ');

  return result.trim();
}

/**
 * Sanitize all prompts in a batch of parsed rows.
 * Detects brand names and domains from the identity card if available.
 */
export function sanitizeAllPrompts(
  rows: Record<string, any>[],
  identityCard?: { brandName?: string; brandUrl?: string },
): Record<string, any>[] {
  // Build known names from identity card
  const knownBrands: string[] = [];
  const knownDomains: string[] = [];

  if (identityCard?.brandName) {
    knownBrands.push(identityCard.brandName);
  }
  if (identityCard?.brandUrl) {
    try {
      const url = new URL(identityCard.brandUrl);
      knownDomains.push(url.hostname);
    } catch {
      knownDomains.push(identityCard.brandUrl);
    }
  }

  // Auto-detect: scan first rows for recurring URLs/domains
  const detectedDomains = autoDetectDomains(rows);
  knownDomains.push(...detectedDomains);

  // Prompt column keys to sanitize
  const promptKeys = ['prompt', 'question', 'requête', 'query', 'full_prompt', 'prompt_utilisateur', 'kpi', 'critère', 'criterion'];

  return rows.map(row => {
    const sanitized = { ...row };
    for (const key of Object.keys(sanitized)) {
      const keyLower = key.toLowerCase();
      if (promptKeys.some(pk => keyLower.includes(pk))) {
        const val = sanitized[key];
        if (typeof val === 'string' && val.length > 0) {
          sanitized[key] = sanitizePrompt(val, knownBrands, knownDomains);
        }
      }
    }
    return sanitized;
  });
}

/**
 * Auto-detect domains that appear frequently across rows (likely the audited site).
 */
function autoDetectDomains(rows: Record<string, any>[]): string[] {
  const domainCounts = new Map<string, number>();
  const urlRegex = /https?:\/\/([^\s/]+)/gi;

  for (const row of rows.slice(0, 30)) {
    for (const val of Object.values(row)) {
      if (typeof val !== 'string') continue;
      let match: RegExpExecArray | null;
      while ((match = urlRegex.exec(val)) !== null) {
        const host = match[1].toLowerCase().replace(/^www\./, '');
        domainCounts.set(host, (domainCounts.get(host) || 0) + 1);
      }
    }
  }

  // Return domains appearing 3+ times (likely the target site)
  return [...domainCounts.entries()]
    .filter(([, count]) => count >= 3)
    .map(([domain]) => domain);
}

/**
 * Inject real values back into a sanitized prompt at execution time.
 */
export function hydratePrompt(
  sanitizedPrompt: string,
  url: string,
  brandName?: string,
): string {
  let result = sanitizedPrompt;
  const domain = (() => {
    try { return new URL(url).hostname; } catch { return url; }
  })();

  result = result.replace(/\[URL_SITE\]/g, url);
  result = result.replace(/\[DOMAINE\]/g, domain);
  result = result.replace(/\[NOM_MARQUE\]/g, brandName || domain.replace(/^www\./, '').split('.')[0]);

  return result;
}
