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

  const contentText = `${content.title || ''} ${content.excerpt || ''} ${(content.body || '').slice(0, 500)}`.toLowerCase();
  
  const identityTerms = [
    site.market_sector,
    site.products_services,
    site.target_audience,
    site.site_name,
  ].filter(Boolean).join(' ').toLowerCase().split(/[\s,;]+/).filter(t => t.length > 3);

  if (identityTerms.length === 0) {
    return { passed: true, identityOverlap: 1, matchedTerms: [], totalTerms: identityTerms };
  }

  const matchedTerms = identityTerms.filter(term => contentText.includes(term));
  const identityOverlap = matchedTerms.length / identityTerms.length;

  return {
    passed: identityOverlap >= threshold,
    identityOverlap,
    matchedTerms,
    totalTerms: identityTerms,
  };
}
