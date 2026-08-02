/**
 * autopilot/semanticGate.ts — Content identity verification gate.
 * Ensures AI-generated content aligns with the site's business identity.
 * Extracted from autopilot-engine monolith.
 */

import type { SiteInfo } from './types.ts';

export interface SemanticGateResult {
  passed: boolean;
  identityOverlap: number;
  matchedTerms: string[];
  totalTerms: string[];
}

/**
 * Verify that generated content matches the site's identity terms.
 * Returns false if overlap is below 15%, meaning content is likely hallucinated.
 */
export function checkSemanticGate(
  content: { title?: string; excerpt?: string; body?: string },
  site: SiteInfo,
  threshold = 0.15,
): SemanticGateResult {
  if (!site.market_sector) {
    return { passed: true, identityOverlap: 1, matchedTerms: [], totalTerms: [] };
  }

  // On analyse le corps réel (et pas seulement 500 caractères) : un article de
  // 2 000 mots place ses termes d'identité bien après l'introduction.
  const contentText = `${content.title || ''} ${content.excerpt || ''} ${(content.body || '').slice(0, 20000)}`
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ');

  const STOPWORDS = new Set([
    'pour', 'avec', 'dans', 'sans', 'plus', 'mais', 'donc', 'leur', 'leurs',
    'cette', 'ceux', 'celle', 'elles', 'nous', 'vous', 'être', 'etre', 'avoir',
    'tout', 'tous', 'toute', 'toutes', 'chez', 'entre', 'autre', 'autres',
  ]);

  const identityTerms = Array.from(new Set(
    [site.market_sector, site.products_services, site.target_audience, site.site_name]
      .filter(Boolean).join(' ').toLowerCase()
      .split(/[\s,;]+/)
      // retire les élisions type "d'indemnités" → "indemnités"
      .map(t => t.replace(/^[a-z]['’]/, '').replace(/[^\p{L}\p{N}-]/gu, ''))
      .filter(t => t.length > 3 && !STOPWORDS.has(t)),
  ));

  if (identityTerms.length === 0) {
    return { passed: true, identityOverlap: 1, matchedTerms: [], totalTerms: identityTerms };
  }

  // Stemming léger FR : tolère singulier/pluriel et variantes de terminaison
  // (« indemnités » ↔ « indemnité », « kilométriques » ↔ « kilométrique »).
  const stem = (t: string) => t.replace(/(aux|ales|eaux|ies|es|s|x)$/u, '');
  const matchedTerms = identityTerms.filter(term => contentText.includes(term) || contentText.includes(stem(term)));
  const identityOverlap = matchedTerms.length / identityTerms.length;


  return {
    passed: identityOverlap >= threshold,
    identityOverlap,
    matchedTerms,
    totalTerms: identityTerms,
  };
}
