/* ================================================================== */
/*  Shared SEO Scoring V2 — Multi-axes page-level prioritization       */
/*  Used by: agent-seo, parmenion-orchestrator                         */
/* ================================================================== */

// ─── TOXIC ANCHORS ──────────────────────────────────────────────────
export const TOXIC_ANCHORS = [
  'cliquez ici', 'click here', 'here', 'ici', 'lire la suite', 'read more',
  'en savoir plus', 'learn more', 'plus', 'more', 'voir', 'see', 'link',
  'lien', 'suite', 'continuer', 'continue', 'suivant', 'next', 'details',
  'détails', 'cliquer', 'click', 'allez', 'go', 'page', 'article'
];

// ─── Interfaces ─────────────────────────────────────────────────────
export interface HeadingHierarchy {
  h1Count: number;
  h2Count: number;
  h3Count: number;
  h4_h6Count: number;
  gaps: string[];
  hasMultipleH1: boolean;
  verdict: 'optimal' | 'warning' | 'critical';
}

export interface ContentDensity {
  ratio: number;
  htmlSize: number;
  textSize: number;
  wordCount: number;
  verdict: string;
}

export interface LinkProfile {
  internal: number;
  external: number;
  total: number;
  toxicAnchors: string[];
  toxicAnchorsCount: number;
  crawlersInternalLinks: number;
}

export interface JsonLdAnalysis {
  count: number;
  types: string[];
  hasOrganization: boolean;
  hasFAQ: boolean;
  hasBreadcrumb: boolean;
  hasArticle: boolean;
}

export interface EEATSignals {
  hasAuthorInfo: boolean;
  hasSocialLinks: boolean;
  hasLinkedIn: boolean;
  hasCaseStudies: boolean;
  hasNumbers: boolean;
  hasCTA: boolean;
  hasExternalAuthority: boolean;
}

export interface SeoScoreV2 {
  overall: number;
  axes: {
    content_depth: number;
    heading_structure: number;
    keyword_relevance: number;
    internal_linking: number;
    meta_quality: number;
    eeat_signals: number;
    content_density: number;
  };
  headings: HeadingHierarchy;
  contentDensity: ContentDensity;
  linkProfile: LinkProfile;
  jsonLd: JsonLdAnalysis;
  eeat: EEATSignals;
  issues: string[];
  opportunities: string[];
}

export interface SeoScoringOptions {
  pageType: 'blog' | 'landing';
  /** Optional custom keyword list to replace default SEO terms */
  customKeywords?: string[];
  /** Optional key paths for internal link scoring (defaults to crawlers.fr paths) */
  keyPaths?: string[];
}

// ─── Default keyword list ───────────────────────────────────────────
const DEFAULT_SEO_TERMS = [
  'seo', 'geo', 'audit', 'crawler', 'llm', 'ia', 'intelligence artificielle',
  'google', 'optimisation', 'référencement', 'visibilité', 'contenu', 'stratégie',
  'maillage', 'backlink', 'indexation', 'serp', 'e-e-a-t', 'eeat',
  'chatgpt', 'perplexity', 'gemini', 'claude', 'json-ld', 'schema.org',
  'core web vitals', 'pagespeed', 'structured data', 'données structurées',
  'trafic organique', 'organic traffic', 'position', 'mot-clé', 'keyword',
];

const DEFAULT_KEY_PATHS = [
  '/audit-expert', '/blog', '/lexique', '/tarifs', '/generative-engine-optimization',
  '/app/cocoon', '/app/console', '/aide', '/methodologie', '/faq',
];

// ─── Main scoring function ──────────────────────────────────────────
export function computeSeoScoreV2(
  html: string,
  textContent: string,
  options: SeoScoringOptions,
): SeoScoreV2 {
  const { pageType, customKeywords, keyPaths } = options;
  const issues: string[] = [];
  const opportunities: string[] = [];

  // 1. HEADING HIERARCHY
  const h1Matches = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
  const h2Matches = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi) || [];
  const h3Matches = html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/gi) || [];
  const h4_h6Matches = html.match(/<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi) || [];

  const headings: HeadingHierarchy = {
    h1Count: h1Matches.length,
    h2Count: h2Matches.length,
    h3Count: h3Matches.length,
    h4_h6Count: h4_h6Matches.length,
    gaps: [],
    hasMultipleH1: h1Matches.length > 1,
    verdict: 'optimal',
  };

  if (h1Matches.length === 0) { headings.gaps.push('H1 manquant'); headings.verdict = 'critical'; issues.push('Pas de balise H1'); }
  if (h1Matches.length > 1) { headings.gaps.push('H1 multiples'); headings.verdict = 'warning'; issues.push(`${h1Matches.length} balises H1 (devrait être 1)`); }
  if (h2Matches.length === 0 && textContent.split(/\s+/).length > 300) { headings.gaps.push('H2 manquants'); headings.verdict = 'warning'; issues.push('Pas de H2 pour structurer un contenu long'); }
  if (h1Matches.length > 0 && h3Matches.length > 0 && h2Matches.length === 0) {
    headings.gaps.push('H1→H3 (H2 manquant)');
    headings.verdict = 'critical';
    issues.push('Saut de hiérarchie: H1 → H3 sans H2');
  }

  let headingScore = 100;
  if (headings.verdict === 'critical') headingScore = 25;
  else if (headings.verdict === 'warning') headingScore = 60;
  headingScore = Math.min(100, headingScore + Math.min(h2Matches.length * 8, 30));

  // 2. CONTENT DENSITY
  const htmlSize = html.length;
  const textSize = textContent.length;
  const ratio = htmlSize > 0 ? textSize / htmlSize : 0;
  const wordCount = textContent.split(/\s+/).filter(w => w.length > 1).length;
  const idealLength = pageType === 'blog' ? 1500 : 800;

  const contentDensity: ContentDensity = {
    ratio,
    htmlSize,
    textSize,
    wordCount,
    verdict: ratio > 0.25 ? 'Optimal' : ratio > 0.1 ? 'Acceptable' : 'Faible',
  };

  let contentDepthScore = Math.min(100, Math.round((wordCount / idealLength) * 70));
  if (wordCount < idealLength * 0.5) issues.push(`Contenu court: ${wordCount} mots (cible: ${idealLength}+)`);
  if (wordCount > idealLength * 2) contentDepthScore = Math.min(100, contentDepthScore + 15);

  // Numbers/data density bonus
  const numberMatches = textContent.match(/\d+[\.,]?\d*\s*(%|€|\$|x|fois|points?|jours?|mois|ans?)/gi) || [];
  if (numberMatches.length >= 3) contentDepthScore = Math.min(100, contentDepthScore + 10);
  else opportunities.push('Ajouter des données chiffrées pour renforcer la crédibilité');

  let contentDensityScore = Math.min(100, Math.round(ratio * 300));

  // 3. KEYWORD RELEVANCE
  const seoTerms = customKeywords || DEFAULT_SEO_TERMS;
  const lowerText = textContent.toLowerCase();
  const termHits = seoTerms.filter(t => lowerText.includes(t)).length;
  const keywordScore = Math.min(100, Math.round((termHits / Math.max(12, seoTerms.length * 0.4)) * 100));
  if (termHits < 5) opportunities.push('Enrichir le vocabulaire SEO/GEO (termes techniques variés)');

  // 4. LINK PROFILE
  const internalLinkMatches = html.match(/<a[^>]*href=["']\/[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi) || [];
  const externalLinkMatches = html.match(/<a[^>]*href=["']https?:\/\/[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi) || [];

  const activePaths = keyPaths || DEFAULT_KEY_PATHS;
  let keyPathLinks = 0;
  for (const path of activePaths) {
    if (html.includes(`href="${path}"`) || html.includes(`href="${path}/"`)) keyPathLinks++;
  }

  const anchors: string[] = [];
  for (const match of internalLinkMatches) {
    const anchorMatch = match.match(/>([^<]+)</);
    if (anchorMatch) anchors.push(anchorMatch[1].trim().toLowerCase());
  }
  const toxic = anchors.filter(a => TOXIC_ANCHORS.some(t => a === t || a.startsWith(t)));

  const linkProfile: LinkProfile = {
    internal: internalLinkMatches.length,
    external: externalLinkMatches.length,
    total: internalLinkMatches.length + externalLinkMatches.length,
    toxicAnchors: toxic,
    toxicAnchorsCount: toxic.length,
    crawlersInternalLinks: keyPathLinks,
  };

  let linkScore = Math.min(100, keyPathLinks * 12 + internalLinkMatches.length * 5);
  if (toxic.length > 0) { linkScore = Math.max(0, linkScore - toxic.length * 15); issues.push(`${toxic.length} ancre(s) toxique(s): ${toxic.slice(0, 3).join(', ')}`); }
  if (keyPathLinks < 3) opportunities.push('Renforcer le maillage interne vers les pages clés');

  // 5. META QUALITY
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const titleContent = titleMatch?.[1]?.trim() || '';
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*?)["']/i) ||
                    html.match(/<meta\s+content=["']([^"']*?)["']\s+name=["']description["']/i);
  const descContent = descMatch?.[1]?.trim() || '';
  const hasOg = /<meta\s+property=["']og:/i.test(html);
  const hasCanonical = /<link[^>]*rel=["']canonical["']/i.test(html);

  const jsonLdMatches = html.match(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  const jsonLdTypes: string[] = [];
  for (const m of jsonLdMatches) {
    try {
      const content = m.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
      const parsed = JSON.parse(content);
      if (parsed['@type']) jsonLdTypes.push(parsed['@type']);
      if (Array.isArray(parsed['@graph'])) {
        for (const item of parsed['@graph']) {
          if (item['@type']) jsonLdTypes.push(item['@type']);
        }
      }
    } catch { /* ignore parse errors */ }
  }

  const jsonLd: JsonLdAnalysis = {
    count: jsonLdMatches.length,
    types: jsonLdTypes,
    hasOrganization: jsonLdTypes.some(t => t === 'Organization'),
    hasFAQ: jsonLdTypes.some(t => t === 'FAQPage'),
    hasBreadcrumb: jsonLdTypes.some(t => t === 'BreadcrumbList'),
    hasArticle: jsonLdTypes.some(t => ['Article', 'BlogPosting', 'TechArticle', 'NewsArticle'].includes(t)),
  };

  let metaScore = 0;
  if (titleContent && titleContent.length >= 20 && titleContent.length <= 60) metaScore += 25;
  else if (titleContent) { metaScore += 10; issues.push(`Titre: ${titleContent.length} car. (optimal: 20-60)`); }
  else { issues.push('Pas de balise <title>'); }

  if (descContent && descContent.length >= 70 && descContent.length <= 160) metaScore += 25;
  else if (descContent) { metaScore += 10; issues.push(`Meta description: ${descContent.length} car. (optimal: 70-160)`); }
  else { issues.push('Pas de meta description'); opportunities.push('Ajouter une meta description optimisée'); }

  if (hasOg) metaScore += 15; else opportunities.push('Ajouter les balises Open Graph');
  if (hasCanonical) metaScore += 10;
  if (jsonLd.count > 0) metaScore += 15;
  if (jsonLd.hasArticle && pageType === 'blog') metaScore += 10;
  else if (pageType === 'blog' && !jsonLd.hasArticle) opportunities.push('Ajouter un schema BlogPosting ou Article');

  // 6. E-E-A-T SIGNALS
  const eeat: EEATSignals = {
    hasAuthorInfo: /author|auteur|par\s|écrit\sby|written\sby/i.test(html),
    hasSocialLinks: /linkedin\.com|twitter\.com|x\.com|facebook\.com/i.test(html),
    hasLinkedIn: /linkedin\.com/i.test(html),
    hasCaseStudies: /étude\sde\scas|case\sstudy|témoignage|avis\sclient|résultat/i.test(lowerText),
    hasNumbers: numberMatches.length >= 2,
    hasCTA: /découvr|essayer|commencer|lancer|gratuit|obtenez|inscri|tester|démarrer|demander/i.test(textContent),
    hasExternalAuthority: externalLinkMatches.length >= 2,
  };

  // Qualified case studies
  const caseStudyVerifiable = eeat.hasCaseStudies && (
    /[A-ZÀ-Ü][a-zà-ü]{2,}\s+[A-ZÀ-Ü][a-zà-ü]{2,}/.test(textContent) ||
    /(?:SAS|SARL|SASU|Inc\.|Ltd\.|GmbH|LLC)/i.test(textContent) ||
    /\d{2,}[\s.,]?\d*\s*(?:%|€|\$|k€|clients?|utilisateurs?)/i.test(textContent)
  );

  let eeatScore = 0;
  if (eeat.hasAuthorInfo) eeatScore += 20;
  if (eeat.hasSocialLinks) eeatScore += 15;
  if (eeat.hasLinkedIn) eeatScore += 10;
  if (eeat.hasCaseStudies) eeatScore += caseStudyVerifiable ? 15 : 5;
  if (eeat.hasNumbers) eeatScore += 15;
  if (eeat.hasCTA) eeatScore += 10;
  if (eeat.hasExternalAuthority) eeatScore += 15;

  // Penalty: generic CTA anchors
  const genericCtaAnchors = anchors.filter(a => /^(découvrir|en savoir plus|cliquez ici|lire la suite|voir plus|click here|learn more|read more|voir|lire)$/i.test(a.trim()));
  if (internalLinkMatches.length > 3 && genericCtaAnchors.length / internalLinkMatches.length > 0.6) {
    linkScore = Math.max(0, linkScore - 10);
    issues.push(`${Math.round(genericCtaAnchors.length / internalLinkMatches.length * 100)}% des ancres internes sont génériques (CTA vides)`);
  }

  // Bonus: fresh content
  const datePublishedMatch = html.match(/datePublished["']\s*:\s*["'](\d{4}-\d{2}-\d{2})/i) ||
    html.match(/datetime=["'](\d{4}-\d{2}-\d{2})/i);
  if (datePublishedMatch) {
    const pubDate = new Date(datePublishedMatch[1]);
    const monthsAgo = (Date.now() - pubDate.getTime()) / (30 * 24 * 60 * 60 * 1000);
    if (monthsAgo <= 12) {
      contentDepthScore = Math.min(100, contentDepthScore + 8);
    } else if (monthsAgo > 24) {
      issues.push(`Contenu daté de ${Math.round(monthsAgo)} mois — signal de "content decay"`);
    }
  }

  if (eeatScore < 40) opportunities.push('Renforcer les signaux E-E-A-T (auteur, preuves sociales, données)');

  // OVERALL SCORE (weighted)
  const overall = Math.round(
    contentDepthScore * 0.20 +
    headingScore * 0.15 +
    keywordScore * 0.15 +
    linkScore * 0.15 +
    metaScore * 0.15 +
    eeatScore * 0.10 +
    contentDensityScore * 0.10
  );

  return {
    overall,
    axes: {
      content_depth: contentDepthScore,
      heading_structure: headingScore,
      keyword_relevance: keywordScore,
      internal_linking: linkScore,
      meta_quality: metaScore,
      eeat_signals: eeatScore,
      content_density: contentDensityScore,
    },
    headings,
    contentDensity,
    linkProfile,
    jsonLd,
    eeat,
    issues,
    opportunities,
  };
}

/**
 * Extract text content from HTML (strip scripts, styles, tags)
 * Utility for consumers that receive raw HTML
 */
export function extractTextContent(html: string, maxLength = 20000): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, maxLength);
}
