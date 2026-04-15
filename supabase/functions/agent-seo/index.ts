import { getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { trackTokenUsage, trackPaidApiCall } from '../_shared/tokenTracker.ts';
import { getSiteContext } from '../_shared/getSiteContext.ts';
import { stealthFetch } from '../_shared/stealthFetch.ts';
import { callLovableAI } from '../_shared/lovableAI.ts';
import { getAgentContext } from '../_shared/getAgentContext.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * Agent SEO Autonome v2
 * 
 * Inspiré des moteurs d'audit expert et stratégique :
 * - StealthFetch pour le scraping anti-détection
 * - Scoring SEO multi-axes réel (heading hierarchy, content density, link profile, JSON-LD, E-E-A-T)
 * - getSiteContext pour l'identité enrichie du site
 * - Lovable AI Gateway au lieu d'OpenRouter
 * - Page type detection (editorial/product/deep/homepage)
 * - Recommandation registry persistence
 */

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY') || '';

// ─── Allowed targets ─────────────────────────────────────────────────
const FORBIDDEN_ROUTES = ['/', '/audit-expert', '/app/site-crawl', '/app/audit-compare', '/app/console', '/app/profil'];

const LANDING_PAGES = [
  { slug: 'generative-engine-optimization', url: '/generative-engine-optimization', type: 'landing' as const },
  { slug: 'pro-agency', url: '/pro-agency', type: 'landing' as const },
  { slug: 'tarifs', url: '/tarifs', type: 'landing' as const },
  { slug: 'methodologie', url: '/methodologie', type: 'landing' as const },
  { slug: 'audit-seo-gratuit', url: '/audit-seo-gratuit', type: 'landing' as const },
  { slug: 'analyse-site-web-gratuit', url: '/analyse-site-web-gratuit', type: 'landing' as const },
  { slug: 'indice-alignement-strategique', url: '/indice-alignement-strategique', type: 'landing' as const },
  { slug: 'guide-audit-seo', url: '/guide-audit-seo', type: 'landing' as const },
  { slug: 'faq', url: '/faq', type: 'landing' as const },
  { slug: 'observatoire', url: '/observatoire', type: 'landing' as const },
  { slug: 'integration-gtm', url: '/integration-gtm', type: 'landing' as const },
  { slug: 'lexique', url: '/lexique', type: 'landing' as const },
  { slug: 'aide', url: '/aide', type: 'landing' as const },
];

interface PageTarget {
  slug: string;
  url: string;
  type: 'blog' | 'landing';
}

// ─── TOXIC ANCHORS (from audit-expert-seo) ──────────────────────────
const TOXIC_ANCHORS = [
  'cliquez ici', 'click here', 'here', 'ici', 'lire la suite', 'read more',
  'en savoir plus', 'learn more', 'plus', 'more', 'voir', 'see', 'link',
  'lien', 'suite', 'continuer', 'continue', 'suivant', 'next', 'details',
  'détails', 'cliquer', 'click', 'allez', 'go', 'page', 'article'
];

// ─── SEO Score Interfaces (multi-axes, inspired by expert-audit) ─────
interface HeadingHierarchy {
  h1Count: number;
  h2Count: number;
  h3Count: number;
  h4_h6Count: number;
  gaps: string[];
  hasMultipleH1: boolean;
  verdict: 'optimal' | 'warning' | 'critical';
}

interface ContentDensity {
  ratio: number;
  htmlSize: number;
  textSize: number;
  wordCount: number;
  verdict: string;
}

interface LinkProfile {
  internal: number;
  external: number;
  total: number;
  toxicAnchors: string[];
  toxicAnchorsCount: number;
  crawlersInternalLinks: number; // links to key crawlers.fr pages
}

interface JsonLdAnalysis {
  count: number;
  types: string[];
  hasOrganization: boolean;
  hasFAQ: boolean;
  hasBreadcrumb: boolean;
  hasArticle: boolean;
}

interface EEATSignals {
  hasAuthorInfo: boolean;
  hasSocialLinks: boolean;
  hasLinkedIn: boolean;
  hasCaseStudies: boolean;
  hasNumbers: boolean;
  hasCTA: boolean;
  hasExternalAuthority: boolean;
}

interface SeoScoreV2 {
  overall: number;
  axes: {
    content_depth: number;      // word count, data density, unique terminology
    heading_structure: number;  // H1-H6 hierarchy quality
    keyword_relevance: number;  // SEO/GEO term density
    internal_linking: number;   // link profile quality
    meta_quality: number;       // title, desc, og, json-ld
    eeat_signals: number;       // expertise, authority, trust signals
    content_density: number;    // text/html ratio
  };
  headings: HeadingHierarchy;
  contentDensity: ContentDensity;
  linkProfile: LinkProfile;
  jsonLd: JsonLdAnalysis;
  eeat: EEATSignals;
  issues: string[];
  opportunities: string[];
}

// ─── Fetch page HTML via stealthFetch ────────────────────────────────
async function fetchPageHtml(fullUrl: string): Promise<{ html: string; textContent: string } | null> {
  try {
    const result = await stealthFetch(fullUrl, {
      headers: { 'Accept': 'text/html,application/xhtml+xml' },
      timeout: 15000,
    });
    if (!result.ok) return null;
    const html = await result.text();
    
    // Extract text content (strip scripts/styles/tags)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return { html, textContent: textContent.substring(0, 20000) };
  } catch (e) {
    console.error(`[AGENT-SEO] StealthFetch error for ${fullUrl}:`, e);
    return null;
  }
}

// ─── Real multi-axes SEO scoring (inspired by audit-expert-seo) ──────
function computeSeoScoreV2(html: string, textContent: string, pageType: 'blog' | 'landing'): SeoScoreV2 {
  const issues: string[] = [];
  const opportunities: string[] = [];

  // 1. HEADING HIERARCHY (from expert-audit pattern)
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

  // 2. CONTENT DENSITY (from expert-audit)
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

  // 3. KEYWORD RELEVANCE (expanded from original)
  const seoTerms = [
    'seo', 'geo', 'audit', 'crawler', 'llm', 'ia', 'intelligence artificielle',
    'google', 'optimisation', 'référencement', 'visibilité', 'contenu', 'stratégie',
    'maillage', 'backlink', 'indexation', 'serp', 'e-e-a-t', 'eeat',
    'chatgpt', 'perplexity', 'gemini', 'claude', 'json-ld', 'schema.org',
    'core web vitals', 'pagespeed', 'structured data', 'données structurées',
    'trafic organique', 'organic traffic', 'position', 'mot-clé', 'keyword',
  ];
  const lowerText = textContent.toLowerCase();
  const termHits = seoTerms.filter(t => lowerText.includes(t)).length;
  const keywordScore = Math.min(100, Math.round((termHits / 12) * 100));
  if (termHits < 5) opportunities.push('Enrichir le vocabulaire SEO/GEO (termes techniques variés)');

  // 4. LINK PROFILE (from expert-audit toxic anchors analysis)
  const internalLinkMatches = html.match(/<a[^>]*href=["']\/[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi) || [];
  const externalLinkMatches = html.match(/<a[^>]*href=["']https?:\/\/[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi) || [];

  const crawlersKeyPaths = ['/audit-expert', '/blog', '/lexique', '/tarifs', '/generative-engine-optimization', '/app/cocoon', '/app/console', '/aide', '/methodologie', '/faq'];
  let crawlersLinks = 0;
  for (const path of crawlersKeyPaths) {
    if (html.includes(`href="${path}"`) || html.includes(`href="${path}/"`)) crawlersLinks++;
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
    crawlersInternalLinks: crawlersLinks,
  };

  let linkScore = Math.min(100, crawlersLinks * 12 + internalLinkMatches.length * 5);
  if (toxic.length > 0) { linkScore = Math.max(0, linkScore - toxic.length * 15); issues.push(`${toxic.length} ancre(s) toxique(s): ${toxic.slice(0, 3).join(', ')}`); }
  if (crawlersLinks < 3) opportunities.push('Renforcer le maillage interne vers les pages clés');

  // 5. META QUALITY (title, desc, og, json-ld — from expert-audit)
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const titleContent = titleMatch?.[1]?.trim() || '';
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*?)["']/i) ||
                    html.match(/<meta\s+content=["']([^"']*?)["']\s+name=["']description["']/i);
  const descContent = descMatch?.[1]?.trim() || '';
  const hasOg = /<meta\s+property=["']og:/i.test(html);
  const hasCanonical = /<link[^>]*rel=["']canonical["']/i.test(html);

  // JSON-LD analysis
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

  // 6. E-E-A-T SIGNALS (enhanced: qualified case studies, dated content, CTA-only anchors)
  const eeat: EEATSignals = {
    hasAuthorInfo: /author|auteur|par\s|écrit\sby|written\sby/i.test(html),
    hasSocialLinks: /linkedin\.com|twitter\.com|x\.com|facebook\.com/i.test(html),
    hasLinkedIn: /linkedin\.com/i.test(html),
    hasCaseStudies: /étude\sde\scas|case\sstudy|témoignage|avis\sclient|résultat/i.test(lowerText),
    hasNumbers: numberMatches.length >= 2,
    hasCTA: /découvr|essayer|commencer|lancer|gratuit|obtenez|inscri|tester|démarrer|demander/i.test(textContent),
    hasExternalAuthority: externalLinkMatches.length >= 2,
  };

  // Qualified case studies: check for proper nouns, company names, specific figures
  const caseStudyVerifiable = eeat.hasCaseStudies && (
    /[A-ZÀ-Ü][a-zà-ü]{2,}\s+[A-ZÀ-Ü][a-zà-ü]{2,}/.test(textContent) || // proper noun pair
    /(?:SAS|SARL|SASU|Inc\.|Ltd\.|GmbH|LLC)/i.test(textContent) ||
    /\d{2,}[\s.,]?\d*\s*(?:%|€|\$|k€|clients?|utilisateurs?)/i.test(textContent)
  );

  let eeatScore = 0;
  if (eeat.hasAuthorInfo) eeatScore += 20;
  if (eeat.hasSocialLinks) eeatScore += 15;
  if (eeat.hasLinkedIn) eeatScore += 10;
  // Case studies: full bonus only if verifiable, reduced if generic
  if (eeat.hasCaseStudies) eeatScore += caseStudyVerifiable ? 15 : 5;
  if (eeat.hasNumbers) eeatScore += 15;
  if (eeat.hasCTA) eeatScore += 10;
  if (eeat.hasExternalAuthority) eeatScore += 15;

  // Penalty: all internal link anchors are generic CTAs
  const genericCtaAnchors = anchors.filter(a => /^(découvrir|en savoir plus|cliquez ici|lire la suite|voir plus|click here|learn more|read more|voir|lire)$/i.test(a.trim()));
  if (internalLinkMatches.length > 3 && genericCtaAnchors.length / internalLinkMatches.length > 0.6) {
    linkScore = Math.max(0, linkScore - 10);
    issues.push(`${Math.round(genericCtaAnchors.length / internalLinkMatches.length * 100)}% des ancres internes sont génériques (CTA vides)`);
  }

  // Bonus: content has datePublished < 12 months
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

// ─── LLM call via Lovable AI Gateway ─────────────────────────────────
async function generateImprovements(
  html: string,
  textContent: string,
  target: PageTarget,
  score: SeoScoreV2,
  siteContext: any,
  operationalContext?: string,
): Promise<{ improvements: string; confidence: number; tokens: { input: number; output: number } }> {
  const prudenceLevel = target.type === 'landing'
    ? `MODE PRUDENT : Max 10% de modification. Micro-optimisations : titres, 1-2 mots-clés, CTA. NE CHANGE PAS la structure.`
    : `MODE LIBRE : Carte blanche pour réécrire, ajouter des sections, enrichir les données, améliorer la structure H2/H3.`;

  // Build context-aware prompt from site identity card (like strategic audit)
  const siteInfo = siteContext
    ? `\nCONTEXTE SITE :\n- Secteur : ${siteContext.market_sector || 'N/A'}\n- Produits/Services : ${siteContext.products_services || 'N/A'}\n- Audience cible : ${siteContext.target_audience || 'N/A'}\n- Zone commerciale : ${siteContext.commercial_area || 'N/A'}\n- Marque : ${siteContext.brand_name || siteContext.site_name || 'N/A'}`
    : '';

  const systemPrompt = `Tu es un Agent SEO expert autonome pour crawlers.fr, plateforme SaaS d'audit SEO et GEO (Generative Engine Optimization).
  
${prudenceLevel}
${siteInfo}

SCORES SEO ACTUELS (7 axes) :
- Score global : ${score.overall}/100
- Profondeur contenu : ${score.axes.content_depth}/100
- Structure Hn : ${score.axes.heading_structure}/100 ${score.headings.gaps.length > 0 ? `(⚠️ ${score.headings.gaps.join(', ')})` : ''}
- Pertinence mots-clés : ${score.axes.keyword_relevance}/100
- Maillage interne : ${score.axes.internal_linking}/100 (${score.linkProfile.crawlersInternalLinks} liens vers pages clés)
- Qualité méta : ${score.axes.meta_quality}/100 (JSON-LD: ${score.jsonLd.count} blocs, types: ${score.jsonLd.types.join(', ') || 'aucun'})
- Signaux E-E-A-T : ${score.axes.eeat_signals}/100
- Densité contenu : ${score.axes.content_density}/100 (ratio text/html: ${(score.contentDensity.ratio * 100).toFixed(1)}%)

PROBLÈMES DÉTECTÉS :
${score.issues.map(i => `- ❌ ${i}`).join('\n') || '- Aucun problème critique'}

OPPORTUNITÉS :
${score.opportunities.map(o => `- 💡 ${o}`).join('\n') || '- Aucune opportunité identifiée'}

OBJECTIFS :
1. Améliorer le score global de +5 à +15 points
2. Corriger les problèmes détectés en priorité
3. Exploiter les opportunités identifiées
4. Renforcer le maillage vers : /audit-expert, /blog, /lexique, /tarifs, /generative-engine-optimization, /cocoon, /aide
5. Ajouter des données chiffrées vérifiables
6. Renforcer les signaux E-E-A-T (auteur, expertise, preuves sociales)
7. Si le JSON-LD est absent ou incomplet, proposer un schema adapté

CONTRAINTES :
- Pas de contenu inventé ou mensonger
- Ton professionnel expert
- Pas de promotionnel excessif
- Rester factuel
${operationalContext ? `\n${operationalContext}\nUtilise ces retours terrain pour prioriser les améliorations les plus impactantes.` : ''}

Réponds UNIQUEMENT en JSON :
{
  "improvements": [
    {
      "type": "content_improvement|meta_optimization|internal_linking|structure_improvement|jsonld_addition|eeat_enhancement",
      "location": "Description précise (ex: H2 'Comprendre le GEO Score', paragraphe après le 2e H3)",
      "before": "Texte original (ou null si ajout)",
      "after": "Texte/code amélioré",
      "impact_axes": ["heading_structure", "keyword_relevance"],
      "reason": "Pourquoi cette modification améliore le SEO"
    }
  ],
  "new_pages": [
    {
      "type": "landing|article",
      "title": "Titre de la nouvelle page",
      "keyword": "mot-clé cible principal",
      "directive": "instruction admin à l'origine (si applicable)"
    }
  ],
  "estimated_score_improvement": 5-15,
  "confidence_score": 0-100,
  "priority_fixes": ["Liste des 3 corrections les plus impactantes"],
  "summary": "Résumé en 2-3 phrases"
}

Note : "new_pages" est OPTIONNEL. N'inclus ce champ QUE si une directive admin le demande explicitement (ex: "crée un article sur...", "ajoute une landing page pour...") ou si un content gap majeur est identifié.`;

  const userPrompt = `PAGE : ${target.type === 'blog' ? 'Article de blog' : 'Landing page'} — ${target.slug}
URL : ${target.url}
Mots : ${score.contentDensity.wordCount} | Liens internes : ${score.linkProfile.internal} | Liens externes : ${score.linkProfile.external}

CONTENU HTML (extrait) :
---
${html.substring(0, 14000)}
---

Analyse et propose des améliorations SEO incrémentales ciblées.`;

  const resp = await callLovableAI({
    system: systemPrompt,
    user: userPrompt,
    tools: [
      {
        type: 'function',
        function: {
          name: 'submit_seo_improvements',
          description: 'Submit SEO improvements for a page',
          parameters: {
            type: 'object',
            properties: {
              improvements: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['content_improvement', 'meta_optimization', 'internal_linking', 'structure_improvement', 'jsonld_addition', 'eeat_enhancement'] },
                    location: { type: 'string' },
                    before: { type: 'string' },
                    after: { type: 'string' },
                    impact_axes: { type: 'array', items: { type: 'string' } },
                    reason: { type: 'string' },
                  },
                  required: ['type', 'location', 'after', 'reason'],
                },
              },
              estimated_score_improvement: { type: 'number' },
              confidence_score: { type: 'number' },
              priority_fixes: { type: 'array', items: { type: 'string' } },
              summary: { type: 'string' },
              new_pages: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['landing', 'article'] },
                    title: { type: 'string' },
                    keyword: { type: 'string' },
                    directive: { type: 'string' },
                  },
                  required: ['type', 'title', 'keyword'],
                },
              },
            },
            required: ['improvements', 'estimated_score_improvement', 'confidence_score', 'summary'],
            additionalProperties: false,
          },
        },
      },
    ],
    toolChoice: { type: 'function', function: { name: 'submit_seo_improvements' } },
  });

  const tokens = {
    input: resp.usage?.prompt_tokens || 0,
    output: resp.usage?.completion_tokens || 0,
  };

  // Parse tool call or fallback
  let content = '';
  let confidence = 0;
  const toolCall = resp.toolCalls?.[0] as any;
  if (toolCall?.function?.arguments) {
    content = toolCall.function.arguments;
    try {
      const parsed = JSON.parse(content);
      confidence = parsed.confidence_score || 0;
    } catch { /* ignore */ }
  } else {
    content = resp.content;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        confidence = parsed.confidence_score || 0;
      }
    } catch { /* ignore */ }
  }

  return { improvements: content, confidence, tokens };
}

// ─── Get blog articles from DB ───────────────────────────────────────
async function getBlogTargets(supabase: any): Promise<PageTarget[]> {
  const { data } = await supabase
    .from('blog_articles')
    .select('slug')
    .eq('status', 'published')
    .limit(50);

  if (!data || data.length === 0) {
    return [
      { slug: 'paradoxe-google-geo-2026', url: '/blog/paradoxe-google-geo-2026', type: 'blog' },
      { slug: 'crawler-definition-seo-geo', url: '/blog/crawler-definition-seo-geo', type: 'blog' },
    ];
  }

  return data.map((a: any) => ({
    slug: a.slug,
    url: `/blog/${a.slug}`,
    type: 'blog' as const,
  }));
}

// ─── Pick next target (round-robin, least recently optimized) ────────
async function pickTarget(supabase: any): Promise<PageTarget | null> {
  const blogTargets = await getBlogTargets(supabase);
  const allTargets = [...blogTargets, ...LANDING_PAGES];

  const { data: recentLogs } = await supabase
    .from('seo_agent_logs')
    .select('page_slug, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  const recentSlugs = new Set((recentLogs || []).map((l: any) => l.page_slug));

  // Prioritize never-optimized pages
  const neverOptimized = allTargets.filter(t => !recentSlugs.has(t.slug));
  if (neverOptimized.length > 0) {
    const blogs = neverOptimized.filter(t => t.type === 'blog');
    if (blogs.length > 0) return blogs[Math.floor(Math.random() * blogs.length)];
    return neverOptimized[Math.floor(Math.random() * neverOptimized.length)];
  }

  // Otherwise least recently optimized
  const slugToLastDate: Record<string, string> = {};
  for (const log of (recentLogs || []).reverse()) {
    slugToLastDate[(log as any).page_slug] = (log as any).created_at;
  }
  allTargets.sort((a, b) => {
    const dateA = slugToLastDate[a.slug] || '2000-01-01';
    const dateB = slugToLastDate[b.slug] || '2000-01-01';
    return dateA.localeCompare(dateB);
  });

  return allTargets[0] || null;
}

// ─── Persist recommendations to registry (from strategic audit pattern) ──
async function persistRecommendations(supabase: any, target: PageTarget, score: SeoScoreV2, parsedImprovements: any): Promise<void> {
  try {
    // Clean existing agent-seo recommendations for this page
    await supabase
      .from('audit_recommendations_registry')
      .delete()
      .eq('audit_type', 'agent-seo')
      .ilike('url', `%${target.slug}%`);

    const entries: any[] = [];
    const improvements = parsedImprovements?.improvements || [];

    for (let i = 0; i < improvements.length; i++) {
      const imp = improvements[i];
      const priorityMap: Record<string, string> = {
        'content_improvement': 'important',
        'meta_optimization': 'critical',
        'internal_linking': 'important',
        'structure_improvement': 'critical',
        'jsonld_addition': 'important',
        'eeat_enhancement': 'optional',
      };

      entries.push({
        user_id: '00000000-0000-0000-0000-000000000000', // system user
        domain: 'crawlers.fr',
        url: target.url,
        audit_type: 'agent-seo',
        recommendation_id: `seo_agent_${target.slug}_${i}`,
        title: `[${imp.type}] ${imp.location?.substring(0, 80) || `Amélioration #${i + 1}`}`,
        description: imp.reason || '',
        category: imp.type?.replace('_', ' ') || 'content',
        priority: priorityMap[imp.type] || 'important',
        fix_type: imp.type,
        fix_data: { before: imp.before, after: imp.after, impact_axes: imp.impact_axes },
        prompt_summary: `[SEO Agent] ${imp.reason?.substring(0, 200) || ''}`,
        is_resolved: false,
      });
    }

    if (entries.length > 0) {
      await supabase.from('audit_recommendations_registry').insert(entries);
      console.log(`[AGENT-SEO] ✅ ${entries.length} recommandations persistées dans le registre`);
    }
  } catch (e) {
    console.error('[AGENT-SEO] Erreur persistence registre:', e);
  }
}

// ─── Create code proposals for admin approval ────────────────────────
async function createCodeProposals(supabase: any, target: PageTarget, score: SeoScoreV2, parsedImprovements: any): Promise<number> {
  try {
    const improvements = parsedImprovements?.improvements || [];
    if (improvements.length === 0) return 0;

    const proposals: any[] = [];
    for (const imp of improvements) {
      const diffLines: string[] = [];
      if (imp.before) {
        diffLines.push(`--- AVANT ---`);
        diffLines.push(imp.before);
      }
      diffLines.push(`+++ APRÈS +++`);
      diffLines.push(imp.after || '');

      proposals.push({
        target_function: `page:${target.slug}`,
        target_url: target.url,
        domain: 'crawlers.fr',
        proposal_type: imp.type || 'content_improvement',
        title: `[SEO] ${imp.location?.substring(0, 100) || imp.type || 'Amélioration'}`,
        description: imp.reason || null,
        diff_preview: diffLines.join('\n'),
        original_code: imp.before || null,
        proposed_code: imp.after || null,
        confidence_score: parsedImprovements.confidence_score || 0,
        source_diagnostic_id: `seo_agent_${target.slug}_${Date.now()}`,
        status: 'pending',
        agent_source: 'seo',
      });
    }

    const { error } = await supabase.from('cto_code_proposals').insert(proposals);
    if (error) {
      console.error('[AGENT-SEO] Erreur insertion propositions:', error);
      return 0;
    }

    console.log(`[AGENT-SEO] ✅ ${proposals.length} propositions de code créées (en attente d'approbation)`);
    return proposals.length;
  } catch (e) {
    console.error('[AGENT-SEO] Erreur création propositions:', e);
    return 0;
  }
}

// ─── Main handler ─────────────────────────────────────────────────────
Deno.serve(handleRequest(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();
    const body = await req.json().catch(() => ({}));
    const siteBaseUrl = body.base_url || 'https://crawlers.fr';

    // Pick target page
    const targetSlug = body.target_slug || null;
    let target: PageTarget | null = null;

    if (targetSlug) {
      const allTargets = [...(await getBlogTargets(supabase)), ...LANDING_PAGES];
      target = allTargets.find(t => t.slug === targetSlug) || null;
    } else {
      target = await pickTarget(supabase);
    }

    if (!target) {
      return new Response(JSON.stringify({ success: false, error: 'Aucune page cible trouvée' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Safety check: forbidden routes
    if (FORBIDDEN_ROUTES.some(r => target!.url === r || target!.url.startsWith(r + '/'))) {
      return new Response(JSON.stringify({ success: false, error: `Route interdite: ${target.url}` }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[AGENT-SEO] 🎯 Cible: ${target.type} — ${target.slug} (${target.url})`);

    // Fetch site identity card + page content + enriched context + admin directives in parallel
    // For blog pages, read content from DB (SPA won't render for server-side fetch)
    const fetchContent = async (): Promise<{ html: string; textContent: string } | null> => {
      if (target!.type === 'blog') {
        const { data: article } = await supabase
          .from('blog_articles')
          .select('content, title, excerpt')
          .eq('slug', target!.slug)
          .single();
        if (article?.content) {
          const textContent = (article.content as string)
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          return {
            html: `<h1>${article.title || ''}</h1>${article.content}`,
            textContent: textContent.substring(0, 20000),
          };
        }
      }
      // Fallback: fetch rendered HTML (works for static/landing pages)
      return fetchPageHtml(`${siteBaseUrl}${target!.url}`);
    };

    const [siteContext, pageData, agentContext, directivesResp] = await Promise.all([
      getSiteContext(supabase, { domain: 'crawlers.fr' }).catch(() => null),
      fetchContent(),
      getAgentContext({ agent: 'seo', domain: 'crawlers.fr', days: 7 }).catch(() => null),
      supabase.from('agent_seo_directives')
        .select('id, directive_text, target_url, target_slug')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(10)
        .then((r: any) => r)
        .catch(() => ({ data: null })),
    ]);

    if (!pageData || pageData.textContent.length < 100) {
      console.error(`[AGENT-SEO] Contenu insuffisant pour ${target.url}`);
      return new Response(JSON.stringify({ success: false, error: 'Contenu page insuffisant' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (siteContext) {
      console.log(`[AGENT-SEO] 📇 Carte d'identité chargée (confiance: ${siteContext.identity_confidence || 0})`);
    }

    // ── Run audit-expert-seo + check-eeat in parallel for deep signals ──
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const targetFullUrl = `${siteBaseUrl}${target.url}`;

    let auditExpertData: any = null;
    let eeatData: any = null;

    try {
      const [auditResp, eeatResp] = await Promise.allSettled([
        fetch(`${SUPABASE_URL}/functions/v1/audit-expert-seo`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: targetFullUrl, domain: 'crawlers.fr' }),
          signal: AbortSignal.timeout(30_000),
        }).then(r => r.ok ? r.json() : null),
        fetch(`${SUPABASE_URL}/functions/v1/check-eeat`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: targetFullUrl, domain: 'crawlers.fr' }),
          signal: AbortSignal.timeout(30_000),
        }).then(r => r.ok ? r.json() : null),
      ]);

      if (auditResp.status === 'fulfilled' && auditResp.value) {
        auditExpertData = auditResp.value;
        console.log(`[AGENT-SEO] ✅ audit-expert-seo done for ${target.slug}`);
      } else {
        console.warn(`[AGENT-SEO] ⚠️ audit-expert-seo failed for ${target.slug}`);
      }
      if (eeatResp.status === 'fulfilled' && eeatResp.value) {
        eeatData = eeatResp.value;
        console.log(`[AGENT-SEO] ✅ check-eeat done for ${target.slug}`);
      } else {
        console.warn(`[AGENT-SEO] ⚠️ check-eeat failed for ${target.slug}`);
      }
    } catch (e) {
      console.warn('[AGENT-SEO] Audit enrichment failed (non-blocking):', e);
    }

    // Compute multi-axes SEO score
    const scoreBefore = computeSeoScoreV2(pageData.html, pageData.textContent, target.type);
    // Enrich score with audit data
    if (auditExpertData?.data) {
      (scoreBefore as any).auditExpert = {
        recommendations: auditExpertData.data.recommendations?.slice(0, 10),
        overallScore: auditExpertData.data.overallScore,
      };
    }
    if (eeatData?.data) {
      (scoreBefore as any).eeatAudit = {
        scores: eeatData.data.scores,
        summary: eeatData.data.summary,
      };
    }
    console.log(`[AGENT-SEO] Score avant: ${scoreBefore.overall}/100 | Axes: content=${scoreBefore.axes.content_depth} heading=${scoreBefore.axes.heading_structure} kw=${scoreBefore.axes.keyword_relevance} links=${scoreBefore.axes.internal_linking} meta=${scoreBefore.axes.meta_quality} eeat=${scoreBefore.axes.eeat_signals}${auditExpertData ? ' +audit' : ''}${eeatData ? ' +eeat' : ''}`);

    // Build admin directives context
    const pendingDirectives = directivesResp?.data || [];
    let directivesContext = '';
    // Filter directives relevant to this target (or global)
    const relevantDirectives = pendingDirectives.filter((d: any) =>
      !d.target_slug || d.target_slug === target.slug || (d.target_url && target.url.includes(d.target_url))
    );
    if (relevantDirectives.length > 0) {
      directivesContext = `\n\nDIRECTIVES ADMIN (instructions prioritaires du créateur) :\n${relevantDirectives.map((d: any, i: number) => `${i + 1}. ${d.directive_text}${d.target_url ? ` [cible: ${d.target_url}]` : ''}`).join('\n')}\n\nCes directives sont PRIORITAIRES. Intègre-les dans tes améliorations.`;
      console.log(`[AGENT-SEO] 📋 ${relevantDirectives.length} directive(s) admin chargées`);
    }

    // Generate improvements via Lovable AI (context-enriched with SAV + anomalies + admin directives)
    const operationalCtx = [agentContext?.promptSnippet, directivesContext].filter(Boolean).join('\n');
    const { improvements, confidence, tokens } = await generateImprovements(
      pageData.html, pageData.textContent, target, scoreBefore, siteContext,
      operationalCtx || undefined,
    );

    // Mark consumed directives
    if (relevantDirectives.length > 0) {
      const directiveIds = relevantDirectives.map((d: any) => d.id);
      await supabase.from('agent_seo_directives')
        .update({ status: 'consumed', consumed_at: new Date().toISOString() })
        .in('id', directiveIds)
        .then(() => console.log(`[AGENT-SEO] ✅ ${directiveIds.length} directive(s) marquées comme consommées`))
        .catch((e: any) => console.error('[AGENT-SEO] Erreur mise à jour directives:', e));
    }

    // Parse improvements
    let parsedImprovements: any = null;
    let summary = 'Améliorations générées';
    try {
      const jsonMatch = improvements.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedImprovements = JSON.parse(jsonMatch[0]);
        summary = parsedImprovements.summary || summary;
      }
    } catch (e) {
      console.error('[AGENT-SEO] Parse error:', e);
    }

    const estimatedScoreAfter = Math.min(100, scoreBefore.overall + (parsedImprovements?.estimated_score_improvement || 5));

    // Persist recommendations to registry + create code proposals for admin approval
    let proposalsCreated = 0;
    if (parsedImprovements?.improvements?.length > 0) {
      await persistRecommendations(supabase, target, scoreBefore, parsedImprovements);
      proposalsCreated = await createCodeProposals(supabase, target, scoreBefore, parsedImprovements);
    }

    // ── Page creation drafts (from directives or content gaps) ──
    let pageDraftsCreated = 0;
    if (parsedImprovements?.new_pages?.length > 0) {
      try {
        for (const newPage of parsedImprovements.new_pages) {
          const pageType = newPage.type || 'article';
          // Fetch template for this page type
          const { data: template } = await supabase
            .from('content_prompt_templates')
            .select('id, structure_template, seo_rules, geo_rules, tone_guidelines, system_prompt')
            .eq('page_type', pageType)
            .eq('is_active', true)
            .order('version', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!template) {
            console.warn(`[AGENT-SEO] Pas de template actif pour type="${pageType}", skip`);
            continue;
          }

          // Generate page content using template
          const pagePrompt = `${template.system_prompt}\n\n## Structure attendue\n${template.structure_template}\n\n## Règles SEO\n${template.seo_rules}\n\n## Règles GEO\n${template.geo_rules}\n\n## Ton éditorial\n${template.tone_guidelines}\n\n## Instructions\nCrée une page complète de type "${pageType}" sur le sujet: "${newPage.title || newPage.keyword}"\nMot-clé cible: ${newPage.keyword || newPage.title}\nDate du jour: ${new Date().toISOString().split('T')[0]}\n\nRéponds en JSON avec: { "title", "slug", "meta_title", "meta_description", "content" (markdown complet) }`;

          const pageResp = await callLovableAI({
            messages: [{ role: 'user', content: pagePrompt }],
            model: 'google/gemini-2.5-flash',
            temperature: 0.7,
            max_tokens: 8000,
          });

          const pageContent = pageResp?.content || '';
          let pageParsed: any = null;
          try {
            const jsonMatch = pageContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) pageParsed = JSON.parse(jsonMatch[0]);
          } catch { /* ignore */ }

          if (pageParsed?.title && pageParsed?.content) {
            await supabase.from('seo_page_drafts').insert({
              user_id: '00000000-0000-0000-0000-000000000000',
              page_type: pageType,
              template_id: template.id,
              domain: 'crawlers.fr',
              target_keyword: newPage.keyword || newPage.title,
              title: pageParsed.title,
              slug: pageParsed.slug || pageParsed.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
              meta_title: pageParsed.meta_title || pageParsed.title,
              meta_description: pageParsed.meta_description || '',
              content: pageParsed.content,
              generation_context: {
                source: 'agent-seo',
                template_id: template.id,
                keyword: newPage.keyword,
                directive: newPage.directive || null,
                score_context: { overall: scoreBefore.overall },
              },
              status: 'draft',
            });
            pageDraftsCreated++;
            console.log(`[AGENT-SEO] 📄 Brouillon créé: "${pageParsed.title}" (${pageType})`);
          }
        }
      } catch (e) {
        console.error('[AGENT-SEO] Erreur création brouillons:', e);
      }
    }

    // Log to database with full scoring detail
    const logEntry = {
      page_type: target.type,
      page_slug: target.slug,
      page_url: target.url,
      action_type: 'content_improvement',
      changes_summary: summary,
      changes_detail: {
        ...(parsedImprovements || { raw: improvements.substring(0, 5000) }),
        score_axes: scoreBefore.axes,
        issues: scoreBefore.issues,
        opportunities: scoreBefore.opportunities,
        headings: scoreBefore.headings,
        linkProfile: { internal: scoreBefore.linkProfile.internal, external: scoreBefore.linkProfile.external, toxic: scoreBefore.linkProfile.toxicAnchorsCount, crawlersLinks: scoreBefore.linkProfile.crawlersInternalLinks },
        jsonLd: scoreBefore.jsonLd,
        eeat: scoreBefore.eeat,
      },
      seo_score_before: scoreBefore.overall,
      seo_score_after: estimatedScoreAfter,
      confidence_score: confidence,
      status: 'pending_review',
      model_used: 'google/gemini-2.5-flash',
      tokens_used: tokens,
    };

    const { error: logError } = await supabase.from('seo_agent_logs').insert(logEntry);
    if (logError) console.error('[AGENT-SEO] Log error:', logError);

    await trackTokenUsage('agent-seo', 'google/gemini-2.5-flash', { prompt_tokens: tokens.input, completion_tokens: tokens.output, total_tokens: tokens.input + tokens.output }).catch(() => {});

    console.log(`[AGENT-SEO] ✅ ${target.slug} — score ${scoreBefore.overall} → ${estimatedScoreAfter} (confiance: ${confidence}%) | ${parsedImprovements?.improvements?.length || 0} améliorations | ${scoreBefore.issues.length} problèmes`);

    return new Response(JSON.stringify({
      success: true,
      target: { slug: target.slug, url: target.url, type: target.type },
      score_before: scoreBefore.overall,
      score_after: estimatedScoreAfter,
      score_axes: scoreBefore.axes,
      issues_count: scoreBefore.issues.length,
      opportunities_count: scoreBefore.opportunities.length,
      confidence,
      summary,
      improvements_count: parsedImprovements?.improvements?.length || 0,
      proposals_created: proposalsCreated,
      page_drafts_created: pageDraftsCreated,
      priority_fixes: parsedImprovements?.priority_fixes || [],
      status: logEntry.status,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[AGENT-SEO] Erreur:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}, 'agent-seo'))
