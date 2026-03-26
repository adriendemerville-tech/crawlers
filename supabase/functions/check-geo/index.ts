import { DOMParser, Element } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { getGeoTranslations, parseLanguage, type Language } from '../_shared/translations.ts';
import { assertSafeUrl } from '../_shared/ssrf.ts';
import { fetchAndRenderPage } from '../_shared/renderPage.ts';
import { trackAnalyzedUrl } from '../_shared/trackUrl.ts';
import { trackEdgeFunctionError } from '../_shared/tokenTracker.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { saveRawAuditData } from '../_shared/saveRawAuditData.ts';
import { checkIpRate, getClientIp, rateLimitResponse, acquireConcurrency, releaseConcurrency, concurrencyResponse } from '../_shared/ipRateLimiter.ts';
import { checkFairUse, getUserContext } from '../_shared/fairUse.ts';

// ============================================================================
// INTERFACES EXPERT
// ============================================================================

interface GeoFactor {
  id: string;
  name: string;
  description: string;
  score: number;
  maxScore: number;
  status: 'good' | 'warning' | 'error';
  recommendation?: string;
  details?: string;
}

interface SelfAuditResult {
  isReliable: boolean;
  reliabilityScore: number; // 1.0 = 100% fiable, 0.5 = douteux
  reason?: string;
  renderingRequired: boolean;
}

interface AuditResult {
  success: boolean;
  reliabilityScore: number;
  data?: {
    url: string;
    totalScore: number;
    factors: GeoFactor[];
    renderingInfo: {
      isSPA: boolean;
      hasSSR: boolean;
      framework?: string;
    };
    scannedAt: string;
    auditMetadata: {
      htmlLength: number;
      textLength: number;
      reliabilityScore: number;
      selfAuditPassed: boolean;
    };
    misplacedHeadTags?: string[];
  };
  blockingError?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AI_BOTS = ['GPTBot', 'Google-Extended', 'ClaudeBot', 'PerplexityBot', 'CCBot', 'Applebot-Extended'];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function normalizeUrl(url: string): string {
  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  return normalized;
}

// ============================================================================
// 1. MÉCANISME D'AUTO-AUDIT (Le Garde-Fou)
// ============================================================================

function performSelfAudit(doc: ReturnType<DOMParser['parseFromString']>, htmlLength: number): SelfAuditResult {
  if (!doc) {
    return {
      isReliable: false,
      reliabilityScore: 0,
      reason: "CRITICAL: Impossible de parser le HTML. Document invalide.",
      renderingRequired: false
    };
  }

  const body = doc.querySelector('body');
  const bodyText = body?.textContent?.trim() || "";
  const textLength = bodyText.length;

  // Détection des frameworks SPA
  const hasSPAMarkers = detectSPAMarkers(doc);
  
  // Règle des 95% : Beaucoup de HTML mais peu de texte visible = JS non exécuté
  if (htmlLength > 500 && textLength < 50) {
    return {
      isReliable: false,
      reliabilityScore: 0.1,
      reason: `CRITICAL: DOM vide détecté (${textLength} caractères de texte pour ${htmlLength} de HTML). Le contenu est probablement généré par JavaScript (SPA). Impossible d'auditer sans rendu navigateur.`,
      renderingRequired: true
    };
  }

  // Cas intermédiaire : contenu faible mais pas vide
  if (htmlLength > 1000 && textLength < 200) {
    return {
      isReliable: true,
      reliabilityScore: 0.6,
      reason: `WARNING: Contenu textuel limité (${textLength} caractères). Le score peut être sous-estimé si le site utilise du rendu JavaScript.`,
      renderingRequired: hasSPAMarkers.isSPA && !hasSPAMarkers.hasSSR
    };
  }

  // Vérification des éléments essentiels
  const hasHead = !!doc.querySelector('head');
  const hasTitle = !!doc.querySelector('title');
  
  if (!hasHead || !hasTitle) {
    return {
      isReliable: true,
      reliabilityScore: 0.7,
      reason: "WARNING: Structure HTML incomplète (head ou title manquant).",
      renderingRequired: false
    };
  }

  // Tout est OK
  return {
    isReliable: true,
    reliabilityScore: 1.0,
    renderingRequired: false
  };
}

// ============================================================================
// 2. PARSING DOM RÉEL (remplacement des Regex)
// ============================================================================

function detectSPAMarkers(doc: ReturnType<DOMParser['parseFromString']>): { isSPA: boolean; hasSSR: boolean; framework?: string } {
  if (!doc) return { isSPA: false, hasSSR: false };

  // Recherche des conteneurs SPA vides (broader ID check)
  const rootDiv = doc.querySelector('#root') || doc.querySelector('#app') || doc.querySelector('#__next') || doc.querySelector('#__nuxt') || doc.querySelector('[data-reactroot]') || doc.querySelector('[id*="react"]') || doc.querySelector('[id*="app-root"]');
  const rootTextLen = rootDiv ? (rootDiv.textContent?.trim().length || 0) : -1;
  const hasEmptyRoot = rootDiv && rootTextLen < 50;

  // Détection des frameworks via scripts et attributs
  const scripts = doc.querySelectorAll('script');
  let hasReact = false;
  let hasVue = false;
  let hasNext = false;
  let hasNuxt = false;
  let hasAngular = false;

  scripts.forEach((script: Element) => {
    const src = script.getAttribute('src') || '';
    const content = script.textContent || '';
    
    if (src.includes('react') || content.includes('__REACT') || content.includes('React.createElement') || content.includes('ReactDOM')) hasReact = true;
    if (src.includes('vue') || content.includes('__VUE') || content.includes('Vue.createApp')) hasVue = true;
    if (src.includes('_next') || content.includes('__NEXT_DATA__')) hasNext = true;
    if (src.includes('nuxt') || content.includes('__NUXT__')) hasNuxt = true;
    if (src.includes('angular') || content.includes('ng-version')) hasAngular = true;
  });

  // Also check for data-reactroot attribute on body children
  if (!hasReact && doc.querySelector('[data-reactroot]')) hasReact = true;
  // Check for Angular app-root
  if (!hasAngular && doc.querySelector('app-root')) hasAngular = true;

  // Vérification du SSR via __NEXT_DATA__ ou __NUXT__
  const nextDataScript = doc.querySelector('script#__NEXT_DATA__');
  const nuxtScript = Array.from(scripts).find((s: Element) => s.textContent?.includes('__NUXT__'));
  const hasSSRContent = rootDiv && rootTextLen > 100;
  const hasSSR: boolean = !!(nextDataScript || nuxtScript || hasSSRContent);

  let framework: string | undefined;
  if (hasNext) framework = 'Next.js';
  else if (hasNuxt) framework = 'Nuxt';
  else if (hasReact) framework = 'React';
  else if (hasVue) framework = 'Vue';
  else if (hasAngular) framework = 'Angular';

  const isSPA = (hasReact || hasVue || hasAngular) && (hasEmptyRoot || rootTextLen < 200) && !hasSSR;

  return { isSPA, hasSSR, framework };
}

function analyzeMetaTags(doc: ReturnType<DOMParser['parseFromString']>): { 
  hasDescription: boolean; 
  hasKeywords: boolean; 
  hasRobots: boolean;
  hasCanonical: boolean;
  canonicalUrl?: string;
  description?: string;
} {
  if (!doc) {
    return { hasDescription: false, hasKeywords: false, hasRobots: false, hasCanonical: false };
  }

  const head = doc.querySelector('head');
  if (!head) {
    return { hasDescription: false, hasKeywords: false, hasRobots: false, hasCanonical: false };
  }

  // Meta description - utilisation du DOM
  const metaDesc = head.querySelector('meta[name="description"]') as Element | null;
  const description = metaDesc?.getAttribute('content') || '';
  const hasDescription = description.length > 50;

  // Meta keywords
  const metaKeywords = head.querySelector('meta[name="keywords"]') as Element | null;
  const hasKeywords = !!metaKeywords?.getAttribute('content');

  // Meta robots
  const metaRobots = head.querySelector('meta[name="robots"]') as Element | null;
  const hasRobots = !!metaRobots;

  // Canonical URL
  const canonicalLink = head.querySelector('link[rel="canonical"]') as Element | null;
  const canonicalUrl = canonicalLink?.getAttribute('href') || undefined;
  const hasCanonical = !!canonicalUrl;

  return {
    hasDescription,
    hasKeywords,
    hasRobots,
    hasCanonical,
    canonicalUrl,
    description: description || undefined
  };
}

// ============================================================================
// 3. VALIDATION STRICTE DES DONNÉES JSON-LD
// ============================================================================

interface JsonLdValidation {
  hasJsonLd: boolean;
  isValid: boolean;
  types: string[];
  parseErrors: string[];
  rawCount: number;
  isJsGenerated: boolean;
}

/**
 * Detect if JSON-LD / Schema.org is dynamically generated via JavaScript
 * rather than present as static HTML in the source.
 */
function detectJsGeneratedSchema(html: string): boolean {
  // 1. Check for JSON-LD string literals inside regular <script> tags (not type="application/ld+json")
  const regularScripts = html.match(/<script(?![^>]*type\s*=\s*["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/gi) || [];
  
  for (const script of regularScripts) {
    const content = script.replace(/<script[^>]*>|<\/script>/gi, '');
    // Detect JS that builds or injects JSON-LD dynamically
    if (
      /application\/ld\+json/i.test(content) ||
      (/@context.*schema\.org/i.test(content) && /JSON\.stringify|createElement|innerHTML|insertAdjacentHTML|appendChild/i.test(content)) ||
      /structured[_-]?data|jsonLd|json_ld|schemaMarkup|schema_markup/i.test(content)
    ) {
      return true;
    }
  }
  
  // 2. Check for common schema injection libraries/plugins patterns
  const jsSchemaPatterns = [
    /window\.__NEXT_DATA__[\s\S]*?@context/i,
    /nuxt[\s\S]*?jsonld|__NUXT__[\s\S]*?schema/i,
    /gtm.*application\/ld\+json/i,
    /tagmanager.*schema\.org/i,
  ];
  
  for (const pattern of jsSchemaPatterns) {
    if (pattern.test(html)) return true;
  }
  
  return false;
}

// ============================================================================
// DÉTECTION META TAGS INJECTÉS PAR JAVASCRIPT
// ============================================================================

interface JsMetaDetection {
  isTitleJsGenerated: boolean;
  isMetaDescJsGenerated: boolean;
  isOgJsGenerated: boolean;
  hasAnyJsMeta: boolean;
}

/**
 * Detect if title, meta description, or OG tags are injected via JavaScript
 * rather than present as static HTML. GEO crawlers (GPTBot, PerplexityBot, ClaudeBot)
 * do NOT execute JS — these tags would be invisible to them.
 */
function detectJsGeneratedMeta(rawHtml: string): JsMetaDetection {
  const regularScripts = rawHtml.match(/<script(?![^>]*type\s*=\s*["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/gi) || [];
  
  let isTitleJsGenerated = false;
  let isMetaDescJsGenerated = false;
  let isOgJsGenerated = false;

  for (const script of regularScripts) {
    const content = script.replace(/<script[^>]*>|<\/script>/gi, '');
    
    // Title JS injection patterns
    if (
      /document\.title\s*=/i.test(content) ||
      /\.setAttribute\s*\(\s*['"]title['"]/i.test(content) ||
      /useEffect[\s\S]*?document\.title/i.test(content)
    ) {
      isTitleJsGenerated = true;
    }
    
    // Meta description JS injection patterns
    if (
      /meta\s*\[\s*name\s*=\s*['"]description['"]\s*\]/i.test(content) ||
      /querySelector\s*\(\s*['"]meta\[name.*description/i.test(content) ||
      /\.setAttribute\s*\(\s*['"]content['"]\s*,[\s\S]*?description/i.test(content) ||
      /createElement\s*\(\s*['"]meta['"]\s*\)[\s\S]{0,200}description/i.test(content)
    ) {
      isMetaDescJsGenerated = true;
    }
    
    // OG tags JS injection patterns
    if (
      /property\s*=\s*['"]og:/i.test(content) && /createElement|setAttribute|innerHTML|appendChild/i.test(content) ||
      /querySelector\s*\(\s*['"]meta\[property.*og:/i.test(content)
    ) {
      isOgJsGenerated = true;
    }
  }
  
  // Also check for React Helmet patterns (bundled JS that manages <head>)
  const hasHelmetPattern = /react-helmet|helmet-async|Helmet|useHelmet/i.test(rawHtml);
  const isFrameworkSSR = /__NEXT_DATA__|__NUXT__|data-server-rendered/i.test(rawHtml);
  
  // If Helmet is used with SSR frameworks (Next.js, Nuxt), the meta is rendered server-side → OK
  // If Helmet is used with client-only React (no SSR), the meta IS JS-generated
  if (hasHelmetPattern && !isFrameworkSSR) {
    // Check if there's an empty root (client-only SPA)
    const hasEmptyRoot = /<div\s+id=["'](root|app)["'][^>]*>\s*<\/div>/i.test(rawHtml);
    if (hasEmptyRoot) {
      isTitleJsGenerated = true;
      isMetaDescJsGenerated = true;
      isOgJsGenerated = true;
    }
  }
  
  const hasAnyJsMeta = isTitleJsGenerated || isMetaDescJsGenerated || isOgJsGenerated;
  if (hasAnyJsMeta) {
    console.log(`[GEO-AUDIT] ⚠️ JS-generated meta detected — title:${isTitleJsGenerated} desc:${isMetaDescJsGenerated} og:${isOgJsGenerated}`);
  }
  
  return { isTitleJsGenerated, isMetaDescJsGenerated, isOgJsGenerated, hasAnyJsMeta };
}

function analyzeStructuredData(doc: ReturnType<DOMParser['parseFromString']>, rawHtml: string): JsonLdValidation {
  const isJsGenerated = detectJsGeneratedSchema(rawHtml);
  
  if (!doc) {
    return { hasJsonLd: false, isValid: false, types: [], parseErrors: [], rawCount: 0, isJsGenerated };
  }

  const jsonLdScripts = doc.querySelectorAll('script[type="application/ld+json"]');
  
  if (jsonLdScripts.length === 0) {
    return { hasJsonLd: false, isValid: false, types: [], parseErrors: [], rawCount: 0, isJsGenerated };
  }

  const types: string[] = [];
  const parseErrors: string[] = [];
  let validCount = 0;

  jsonLdScripts.forEach((script: Element, index: number) => {
    const content = script.textContent?.trim();
    if (!content) {
      parseErrors.push(`Script ${index + 1}: Contenu vide`);
      return;
    }

    try {
      const parsed = JSON.parse(content);
      validCount++;

      // Extraction des types
      const extractTypes = (obj: any) => {
        if (obj['@type']) {
          const type = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
          type.forEach((t: string) => {
            if (!types.includes(t)) types.push(t);
          });
        }
        if (obj['@graph'] && Array.isArray(obj['@graph'])) {
          obj['@graph'].forEach(extractTypes);
        }
      };

      extractTypes(parsed);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Erreur inconnue';
      parseErrors.push(`Script ${index + 1}: JSON invalide - ${errorMsg}`);
    }
  });

  return {
    hasJsonLd: true,
    isValid: validCount > 0 && parseErrors.length === 0,
    types,
    parseErrors,
    rawCount: jsonLdScripts.length,
    isJsGenerated
  };
}

// ============================================================================
// ANALYSE DU CONTENU
// ============================================================================

function analyzeContent(doc: ReturnType<DOMParser['parseFromString']>): {
  hasH1: boolean;
  h1Count: number;
  headingsCount: number;
  imagesWithAlt: number;
  imagesTotal: number;
  wordCount: number;
  h1Text: string;
  titleText: string;
  first150Words: string;
} {
  if (!doc) {
    return { hasH1: false, h1Count: 0, headingsCount: 0, imagesWithAlt: 0, imagesTotal: 0, wordCount: 0, h1Text: '', titleText: '', first150Words: '' };
  }

  // H1 count
  const h1Elements = doc.querySelectorAll('h1');
  const h1Count = h1Elements.length;
  const hasH1 = h1Count >= 1;
  const h1Text = h1Count > 0 ? (h1Elements[0] as Element).textContent?.trim() || '' : '';

  // Title tag
  const titleEl = doc.querySelector('title');
  const titleText = titleEl?.textContent?.trim() || '';

  // Extract first 150 words of visible body text (excluding nav, header, footer, script, style)
  const body = doc.querySelector('body');
  let first150Words = '';
  if (body) {
    const clone = body.cloneNode(true) as Element;
    // Remove non-content elements
    clone.querySelectorAll('script, style, noscript, nav, header, footer, [role="navigation"], [role="banner"], [role="contentinfo"]').forEach((el: Element) => el.remove());
    const visibleText = (clone.textContent || '').replace(/\s+/g, ' ').trim();
    const words = visibleText.split(/\s+/).filter(w => w.length > 0);
    first150Words = words.slice(0, 150).join(' ');
  }

  // All headings
  const allHeadings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const headingsCount = allHeadings.length;

  // Images
  const images = doc.querySelectorAll('img');
  const imagesTotal = images.length;
  let imagesWithAlt = 0;
  images.forEach((img: Element) => {
    const alt = img.getAttribute('alt');
    if (alt && alt.trim().length > 0) imagesWithAlt++;
  });

  // Word count from body
  let wordCount = 0;
  if (body) {
    const clone = body.cloneNode(true) as Element;
    clone.querySelectorAll('script, style, noscript').forEach((el: Element) => el.remove());
    const text = clone.textContent || '';
    wordCount = text.split(/\s+/).filter(w => w.length > 2).length;
  }

  return { hasH1, h1Count, headingsCount, imagesWithAlt, imagesTotal, wordCount, h1Text, titleText, first150Words };
}

// ============================================================================
// DÉTECTION INTENTION DANS LE TITRE + PREMIÈRE PHRASE
// ============================================================================

function analyzeDirectAnswer(titleText: string, h1Text: string, first150Words: string, metaDescription?: string): {
  found: boolean;
  inTitle: boolean;
  inH1: boolean;
  inFirst150Words: boolean;
  keywordDensity: number;
  detectedKeywords: string[];
  wordCount: number;
} {
  // Extract likely intent keywords from the title (longest meaningful words)
  const combinedTitle = `${titleText} ${h1Text}`.toLowerCase();
  const titleWords = combinedTitle.split(/[\s\-–—:|,]+/).filter(w => w.length >= 4);
  
  // Remove common stopwords
  const stopwords = new Set(['pour', 'dans', 'avec', 'plus', 'votre', 'notre', 'cette', 'comment', 'tout', 'what', 'your', 'this', 'that', 'with', 'from', 'about', 'como', 'para', 'todo', 'best', 'guide', 'complete']);
  const keywords = [...new Set(titleWords.filter(w => !stopwords.has(w)))].slice(0, 5);
  
  const words150 = first150Words.toLowerCase();
  const words150Count = first150Words.split(/\s+/).filter(w => w.length > 0).length;

  if (keywords.length === 0) {
    return { found: false, inTitle: false, inH1: false, inFirst150Words: false, keywordDensity: 0, detectedKeywords: [], wordCount: words150Count };
  }

  const title = titleText.toLowerCase();
  const h1 = h1Text.toLowerCase();

  // Check how many keywords from title appear in the first 150 words
  const matchesInFirst150 = keywords.filter(kw => words150.includes(kw));
  const keywordDensity = matchesInFirst150.length / keywords.length;
  const inFirst150Words = matchesInFirst150.length >= Math.min(2, keywords.length);
  
  const inTitle = keywords.some(kw => title.includes(kw));
  const inH1 = keywords.some(kw => h1.includes(kw));

  return {
    found: (inTitle || inH1) && inFirst150Words,
    inTitle,
    inH1,
    inFirst150Words,
    keywordDensity: Math.round(keywordDensity * 100),
    detectedKeywords: matchesInFirst150.length > 0 ? matchesInFirst150 : keywords.slice(0, 3),
    wordCount: words150Count,
  };
}

// ============================================================================
// DÉTECTION FAQ OU RÉSUMÉ EN DÉBUT D'ARTICLE
// ============================================================================

function analyzeFaqOrSummary(doc: ReturnType<DOMParser['parseFromString']>, structuredDataTypes: string[]): {
  hasFaq: boolean;
  hasSummary: boolean;
  hasFaqSchema: boolean;
  details: string;
} {
  if (!doc) {
    return { hasFaq: false, hasSummary: false, hasFaqSchema: false, details: '' };
  }

  const body = doc.querySelector('body');
  if (!body) {
    return { hasFaq: false, hasSummary: false, hasFaqSchema: false, details: '' };
  }

  // Check for FAQ Schema.org type
  const hasFaqSchema = structuredDataTypes.some(t => t.toLowerCase().includes('faq'));

  // Check for FAQ patterns in the DOM
  let hasFaq = hasFaqSchema;
  if (!hasFaq) {
    // Look for FAQ-like elements: details/summary, .faq, #faq, or FAQ headings in the top portion
    const faqSelectors = ['details', '.faq', '#faq', '[class*="faq"]', '[id*="faq"]', '.accordion', '[class*="accordion"]'];
    for (const sel of faqSelectors) {
      if (body.querySelector(sel)) {
        hasFaq = true;
        break;
      }
    }
  }

  // Look for FAQ heading in top section
  if (!hasFaq) {
    const headings = body.querySelectorAll('h2, h3');
    for (let i = 0; i < Math.min(headings.length, 5); i++) {
      const text = (headings[i] as Element).textContent?.toLowerCase() || '';
      if (text.includes('faq') || text.includes('questions fréquentes') || text.includes('frequently asked') || text.includes('preguntas frecuentes')) {
        hasFaq = true;
        break;
      }
    }
  }

  // Check for TL;DR / summary at the top
  let hasSummary = false;
  const summaryPatterns = ['tl;dr', 'tldr', 'en résumé', 'en bref', 'résumé', 'summary', 'key takeaways', 'points clés', 'in brief', 'en resumen', 'puntos clave'];
  
  // Check first few elements of the body for summary-like content
  const earlyElements = body.querySelectorAll('p, div, blockquote, section');
  for (let i = 0; i < Math.min(earlyElements.length, 10); i++) {
    const text = (earlyElements[i] as Element).textContent?.toLowerCase() || '';
    const classAttr = (earlyElements[i] as Element).getAttribute('class')?.toLowerCase() || '';
    const idAttr = (earlyElements[i] as Element).getAttribute('id')?.toLowerCase() || '';
    
    if (summaryPatterns.some(p => text.includes(p) || classAttr.includes(p) || idAttr.includes(p))) {
      hasSummary = true;
      break;
    }
  }

  // Also check for summary in headings
  if (!hasSummary) {
    const headings = body.querySelectorAll('h2, h3');
    for (let i = 0; i < Math.min(headings.length, 3); i++) {
      const text = (headings[i] as Element).textContent?.toLowerCase() || '';
      if (summaryPatterns.some(p => text.includes(p))) {
        hasSummary = true;
        break;
      }
    }
  }

  let details = '';
  if (hasFaq && hasSummary) details = 'FAQ + Résumé détectés';
  else if (hasFaq) details = hasFaqSchema ? 'FAQ détectée (+ Schema FAQPage)' : 'FAQ détectée';
  else if (hasSummary) details = 'Résumé/TL;DR détecté';
  else details = 'Ni FAQ ni résumé détecté';

  return { hasFaq, hasSummary, hasFaqSchema, details };
}

// ============================================================================
// ANALYSE OPEN GRAPH
// ============================================================================

function analyzeOpenGraph(doc: ReturnType<DOMParser['parseFromString']>): { hasOg: boolean; hasTwitter: boolean } {
  if (!doc) return { hasOg: false, hasTwitter: false };

  const head = doc.querySelector('head');
  if (!head) return { hasOg: false, hasTwitter: false };

  const ogMeta = head.querySelector('meta[property^="og:"]');
  const twitterMeta = head.querySelector('meta[name^="twitter:"]');

  return {
    hasOg: !!ogMeta,
    hasTwitter: !!twitterMeta
  };
}

// ============================================================================
// ANALYSE ROBOTS.TXT
// ============================================================================

/**
 * Parse robots.txt et vérifie si un bot spécifique est bloqué
 * Logique alignée avec check-crawlers pour garantir la cohérence
 */
function parseRobotsTxtForBot(robotsTxt: string, botUserAgent: string): { allowed: boolean } {
  const lines = robotsTxt.split('\n');
  let currentUserAgent = '';
  let isMatchingBot = false;
  let isWildcard = false;
  let wildcardDisallowed = false;
  let botSpecificAllowed: boolean | null = null; // null = pas de règle spécifique

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim().toLowerCase();
    const originalLine = lines[i].trim();
    
    // Skip comments and empty lines
    if (line.startsWith('#') || line === '') continue;

    if (line.startsWith('user-agent:')) {
      const agent = originalLine.substring(11).trim();
      currentUserAgent = agent.toLowerCase();
      isMatchingBot = currentUserAgent === botUserAgent.toLowerCase();
      isWildcard = currentUserAgent === '*';
    } else if (line.startsWith('disallow:')) {
      const path = originalLine.substring(9).trim();
      
      // Check for specific bot block
      if (isMatchingBot && path === '/') {
        botSpecificAllowed = false;
      }
      
      // Track wildcard disallow
      if (isWildcard && path === '/') {
        wildcardDisallowed = true;
      }
    } else if (line.startsWith('allow:')) {
      const path = originalLine.substring(6).trim();
      
      // Check for specific bot allow (overrides disallow)
      if (isMatchingBot && (path === '/' || path === '')) {
        botSpecificAllowed = true;
      }
    }
  }

  // Priorité : règle spécifique au bot > règle wildcard
  if (botSpecificAllowed !== null) {
    return { allowed: botSpecificAllowed };
  }
  
  // Si pas de règle spécifique, utiliser la règle wildcard
  if (wildcardDisallowed) {
    return { allowed: false };
  }

  return { allowed: true };
}

function checkAIBotsAllowed(robotsTxt: string | null): { allowed: number; total: number; blocked: string[] } {
  if (!robotsTxt) return { allowed: AI_BOTS.length, total: AI_BOTS.length, blocked: [] };
  
  const blocked: string[] = [];
  
  for (const bot of AI_BOTS) {
    const result = parseRobotsTxtForBot(robotsTxt, bot);
    if (!result.allowed) {
      blocked.push(bot);
    }
  }
  
  return { allowed: AI_BOTS.length - blocked.length, total: AI_BOTS.length, blocked };
}

function checkSitemap(robotsTxt: string | null): boolean {
  if (!robotsTxt) return false;
  return robotsTxt.toLowerCase().includes('sitemap:');
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ── IP Rate Limit ──
  const clientIp = getClientIp(req);
  const ipCheck = checkIpRate(clientIp, 'check-geo', 20, 60_000);
  if (!ipCheck.allowed) return rateLimitResponse(corsHeaders, ipCheck.retryAfterMs);

  if (!acquireConcurrency('check-geo', 50)) return concurrencyResponse(corsHeaders);

  try {
    // ── Fair Use ──
    const userCtx = await getUserContext(req);
    if (userCtx) {
      const fairUse = await checkFairUse(userCtx.userId, 'geo_check', userCtx.planType);
      if (!fairUse.allowed) {
        releaseConcurrency('check-geo');
        return new Response(JSON.stringify({ success: false, error: fairUse.reason }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    let reqBody: any;
    try {
      reqBody = await req.json();
    } catch {
      releaseConcurrency('check-geo');
      return new Response(
        JSON.stringify({ success: false, reliabilityScore: 0, blockingError: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const { url, lang: requestLang } = reqBody || {};
    const lang = parseLanguage(requestLang);
    const t = getGeoTranslations(lang);

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, reliabilityScore: 0, blockingError: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedUrl = normalizeUrl(url);
    assertSafeUrl(normalizedUrl);
    const urlObj = new URL(normalizedUrl);
    const robotsTxtUrl = `${urlObj.origin}/robots.txt`;

    console.log('[GEO-AUDIT] Starting analysis for:', normalizedUrl);

    // Fetch robots.txt
    let robotsTxt: string | null = null;
    try {
      const robotsResponse = await fetch(robotsTxtUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GEOChecker/1.0)' }
      });
      if (robotsResponse.ok) {
        robotsTxt = await robotsResponse.text();
      }
    } catch (e) {
      console.log('[GEO-AUDIT] Failed to fetch robots.txt:', e);
    }

    // Fetch the page (with JS rendering fallback for SPAs via shared renderPage)
    let pageHtml = '';
    let usedRendering = false;
    try {
      const renderResult = await fetchAndRenderPage(normalizedUrl, {
        timeout: 15000,
      });
      pageHtml = renderResult.html;
      usedRendering = renderResult.usedRendering;
      console.log(`[GEO-AUDIT] Page fetched: ${pageHtml.length} chars${usedRendering ? ' (JS rendered)' : ''}, framework: ${renderResult.framework || 'none'}`);
    } catch (e) {
      console.log('[GEO-AUDIT] Failed to fetch page:', e);
      return new Response(
        JSON.stringify({ 
          success: false, 
          reliabilityScore: 0, 
          blockingError: `Impossible de récupérer la page: ${e instanceof Error ? e.message : 'Erreur réseau'}` 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse HTML with deno-dom
    const parser = new DOMParser();
    const doc = parser.parseFromString(pageHtml, 'text/html');

    if (!doc) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          reliabilityScore: 0, 
          blockingError: 'Impossible de parser le HTML de la page' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // ÉTAPE 1 : AUTO-AUDIT (Le Garde-Fou)
    // =========================================================================
    const selfAudit = performSelfAudit(doc, pageHtml.length);
    console.log('[GEO-AUDIT] Self-audit result:', selfAudit);

    // IMPORTANT: Même pour les SPA, on continue l'analyse avec les données disponibles
    // (robots.txt, meta tags dans le head, etc.) mais on ajuste le score final
    let isSPAWithLimitedContent = !selfAudit.isReliable && selfAudit.reliabilityScore < 0.3;

    // =========================================================================
    // ÉTAPE 2 : ANALYSE COMPLÈTE
    // =========================================================================
    const aiBotsResult = checkAIBotsAllowed(robotsTxt);
    const metaResult = analyzeMetaTags(doc);
    const structuredData = analyzeStructuredData(doc, pageHtml);
    const contentResult = analyzeContent(doc);
    const spaInfo = detectSPAMarkers(doc);
    const ogResult = analyzeOpenGraph(doc);
    const hasSitemap = checkSitemap(robotsTxt);
    const jsMetaDetection = detectJsGeneratedMeta(pageHtml);
    const intentResult = analyzeDirectAnswer(contentResult.titleText, contentResult.h1Text, contentResult.first150Words, metaResult.description);
    const faqResult = analyzeFaqOrSummary(doc, structuredData.types);

    // POST-ANALYSIS HEURISTIC: Si le contenu analysé est quasi-vide malgré un HTML volumineux,
    // c'est un SPA/JS-heavy qui n'a pas été rendu correctement — appliquer scoring neutre
    if (!isSPAWithLimitedContent && contentResult.wordCount < 20 && pageHtml.length > 5000 && !usedRendering) {
      console.log(`[GEO-AUDIT] ⚠️ Post-analysis: content empty (${contentResult.wordCount} words) despite large HTML (${pageHtml.length}). Forcing SPA neutral scoring.`);
      isSPAWithLimitedContent = true;
    }


    const factors: GeoFactor[] = [];

    // Factor 1: AI Bots Access (15 points)
    const aiBotScore = Math.round((aiBotsResult.allowed / aiBotsResult.total) * 15);
    factors.push({
      id: 'ai-bots',
      name: t.factors.aiBots.name,
      description: t.factors.aiBots.description,
      score: aiBotScore,
      maxScore: 15,
      status: aiBotScore >= 13 ? 'good' : aiBotScore >= 8 ? 'warning' : 'error',
      recommendation: aiBotScore < 15 
        ? t.factors.aiBots.recommendation(aiBotsResult.blocked.join(', '))
        : undefined,
      details: t.details.botsAllowed(aiBotsResult.allowed, aiBotsResult.total)
    });

    // Factor 2: Meta Description (10 points)
    // For SPA without rendering, meta may be injected by JS — give neutral score
    let metaDescScore = metaResult.hasDescription ? 10 : (isSPAWithLimitedContent ? 5 : 0);
    let metaDescRecommendation: string | undefined;
    let metaDescDetails = metaResult.description 
      ? `"${metaResult.description.substring(0, 60)}..."` 
      : (isSPAWithLimitedContent ? '⚠️ SPA détecté — analyse limitée sans rendu JS' : t.details.noMetaDescription);
    
    // Penalize JS-generated meta description (invisible to GEO crawlers)
    if (jsMetaDetection.isMetaDescJsGenerated && metaDescScore > 0) {
      metaDescScore = Math.max(0, metaDescScore - 4);
      metaDescRecommendation = 'Meta description injectée par JavaScript — invisible pour les crawlers IA (GPTBot, PerplexityBot, ClaudeBot). Utilisez du HTML statique ou le SSR.';
      metaDescDetails += ' | ⚠️ JS-generated';
    } else if (!metaResult.hasDescription) {
      metaDescRecommendation = isSPAWithLimitedContent 
        ? 'SPA détecté — la meta description peut être injectée par JavaScript. Vérifiez le rendu côté serveur (SSR).' 
        : t.factors.metaDescription.recommendation;
    }
    
    factors.push({
      id: 'meta-description',
      name: t.factors.metaDescription.name,
      description: t.factors.metaDescription.description,
      score: metaDescScore,
      maxScore: 10,
      status: metaDescScore >= 8 ? 'good' : metaDescScore > 0 ? 'warning' : 'error',
      recommendation: metaDescRecommendation,
      details: metaDescDetails,
      isJsGenerated: jsMetaDetection.isMetaDescJsGenerated || undefined
    });

    // Factor 3: Structured Data (15 points) - VALIDATION STRICTE
    let structuredScore = 0;
    let structuredDetails = t.details.noStructuredData;
    
    if (structuredData.hasJsonLd) {
      if (structuredData.isValid) {
        structuredScore = 15;
        structuredDetails = t.details.foundTypes(structuredData.types.join(', '));
        if (structuredData.isJsGenerated) {
          structuredScore = Math.max(0, structuredScore - 3);
          console.log('[GEO-AUDIT] ⚠️ JSON-LD detected but JS-generated — score penalized (-3)');
        }
      } else {
        structuredScore = 5;
        structuredDetails = `JSON-LD détecté mais ${structuredData.parseErrors.length} erreur(s) de parsing. Types trouvés: ${structuredData.types.join(', ') || 'aucun'}`;
      }
    } else if (isSPAWithLimitedContent) {
      // SPA sans rendu : on ne peut pas savoir si JSON-LD est injecté par JS
      structuredScore = 8;
      structuredDetails = '⚠️ SPA détecté — les données structurées peuvent être injectées par JavaScript';
    }

    factors.push({
      id: 'structured-data',
      name: t.factors.structuredData.name,
      description: t.factors.structuredData.description,
      score: structuredScore,
      maxScore: 15,
      status: structuredScore === 15 ? 'good' : structuredScore > 0 ? 'warning' : 'error',
      recommendation: structuredScore < 15 
        ? (isSPAWithLimitedContent && !structuredData.hasJsonLd
          ? 'SPA détecté — vérifiez que vos données structurées sont accessibles sans JavaScript (SSR recommandé).'
          : structuredData.parseErrors.length > 0 
            ? `Corrigez les erreurs JSON-LD: ${structuredData.parseErrors[0]}`
            : t.factors.structuredData.recommendation)
        : undefined,
      details: structuredDetails,
      isJsGenerated: structuredData.isJsGenerated
    });

    // Factor 4: Content Structure (15 points)
    // Pour les SPA sans SSR, on donne un score neutre car l'analyse n'est pas fiable
    let contentScore = 0;
    const contentIssues: string[] = [];
    
    if (isSPAWithLimitedContent) {
      // SPA détecté : on ne peut pas analyser le contenu, score neutre
      contentScore = 8; // Score moyen pour ne pas pénaliser
      contentIssues.push(t.factors.contentStructure.spaWarning(spaInfo.framework || 'SPA'));
    } else {
      if (spaInfo.isSPA && !spaInfo.hasSSR) {
        contentIssues.push(t.factors.contentStructure.spaWarning(spaInfo.framework || 'SPA'));
      }
      
      if (contentResult.hasH1) contentScore += 5;
      if (contentResult.headingsCount >= 3) contentScore += 5;
      if (contentResult.wordCount >= 300) contentScore += 5;
      
      if (!contentResult.hasH1) contentIssues.push(t.factors.contentStructure.addH1);
      if (contentResult.headingsCount < 3) contentIssues.push(t.factors.contentStructure.moreHeadings);
      if (contentResult.wordCount < 300) {
        if (spaInfo.isSPA && !spaInfo.hasSSR) {
          contentIssues.push(t.factors.contentStructure.lowWordCountSPA);
        } else {
          contentIssues.push(t.factors.contentStructure.moreContent);
        }
      }
    }
    
    let contentDetails = isSPAWithLimitedContent
      ? `⚠️ SPA détecté - analyse limitée | ${spaInfo.framework || 'JavaScript'} (CSR)`
      : `H1: ${contentResult.hasH1 ? '✓' : '✗'} (${contentResult.h1Count}) | Headings: ${contentResult.headingsCount} | Words: ~${contentResult.wordCount}`;
    
    if (!isSPAWithLimitedContent && spaInfo.framework) {
      contentDetails += ` | ${spaInfo.framework}${spaInfo.hasSSR ? ' (SSR)' : ' (CSR)'}`;
    }
    
    factors.push({
      id: 'content-structure',
      name: t.factors.contentStructure.name,
      description: t.factors.contentStructure.description,
      score: contentScore,
      maxScore: 15,
      status: isSPAWithLimitedContent ? 'warning' : (contentScore >= 12 ? 'good' : contentScore >= 8 ? 'warning' : 'error'),
      recommendation: contentIssues.length > 0 ? contentIssues.join('. ') : undefined,
      details: contentDetails
    });

    // Factor 5: Image Alt Text (10 points)
    // Pour les SPA, on donne un score neutre car les images sont chargées en JS
    let altScore: number;
    let altDetails: string;
    let altStatus: 'good' | 'warning' | 'error';
    let altRecommendation: string | undefined;
    
    if (isSPAWithLimitedContent) {
      altScore = 5; // Score neutre
      altDetails = '⚠️ SPA détecté - images non analysables sans rendu JS';
      altStatus = 'warning';
      altRecommendation = undefined;
    } else {
      altScore = contentResult.imagesTotal === 0 
        ? 10 
        : Math.round((contentResult.imagesWithAlt / contentResult.imagesTotal) * 10);
      altDetails = contentResult.imagesTotal === 0 
        ? t.details.noImages 
        : t.details.imagesWithAlt(contentResult.imagesWithAlt, contentResult.imagesTotal);
      altStatus = altScore >= 8 ? 'good' : altScore >= 5 ? 'warning' : 'error';
      altRecommendation = altScore < 10 && contentResult.imagesTotal > 0
        ? t.factors.imageAlt.recommendation(contentResult.imagesTotal - contentResult.imagesWithAlt)
        : undefined;
    }
    
    factors.push({
      id: 'image-alt',
      name: t.factors.imageAlt.name,
      description: t.factors.imageAlt.description,
      score: altScore,
      maxScore: 10,
      status: altStatus,
      recommendation: altRecommendation,
      details: altDetails
    });

    // Factor 6: Open Graph (10 points)
    let ogScore = 0;
    if (ogResult.hasOg) ogScore += 5;
    if (ogResult.hasTwitter) ogScore += 5;
    
    // SPA neutral scoring for social meta
    if (isSPAWithLimitedContent && ogScore === 0) {
      ogScore = 5;
    }
    
    // Penalize JS-generated OG tags
    if (jsMetaDetection.isOgJsGenerated && ogScore > 0) {
      ogScore = Math.max(0, ogScore - 3);
    }
    
    let ogRecommendation: string | undefined;
    if (jsMetaDetection.isOgJsGenerated && ogResult.hasOg) {
      ogRecommendation = 'Balises Open Graph injectées par JavaScript — invisibles pour les crawlers IA et les previews sociaux sans rendu JS. Utilisez du HTML statique.';
    } else if (!ogResult.hasOg && !ogResult.hasTwitter) {
      ogRecommendation = isSPAWithLimitedContent 
        ? 'SPA détecté — les balises Open Graph peuvent être injectées par JavaScript. Vérifiez le rendu SSR.'
        : t.factors.socialMeta.addBoth;
    } else if (!ogResult.hasOg) {
      ogRecommendation = t.factors.socialMeta.addOg;
    } else if (!ogResult.hasTwitter) {
      ogRecommendation = t.factors.socialMeta.addTwitter;
    }
    
    factors.push({
      id: 'social-meta',
      name: t.factors.socialMeta.name,
      description: t.factors.socialMeta.description,
      score: ogScore,
      maxScore: 10,
      status: ogScore >= 8 ? 'good' : ogScore >= 5 ? 'warning' : 'error',
      recommendation: ogRecommendation,
      details: isSPAWithLimitedContent && !ogResult.hasOg && !ogResult.hasTwitter
        ? '⚠️ SPA détecté — analyse limitée sans rendu JS'
        : `OG: ${ogResult.hasOg ? '✓' : '✗'} | Twitter: ${ogResult.hasTwitter ? '✓' : '✗'}`
    });

    // Factor 7: Sitemap (10 points)
    const sitemapScore = hasSitemap ? 10 : 0;
    factors.push({
      id: 'sitemap',
      name: t.factors.sitemap.name,
      description: t.factors.sitemap.description,
      score: sitemapScore,
      maxScore: 10,
      status: sitemapScore === 10 ? 'good' : 'error',
      recommendation: !hasSitemap 
        ? t.factors.sitemap.recommendation
        : undefined,
      details: hasSitemap ? t.details.sitemapFound : t.details.noSitemap
    });

    // Factor 8: Canonical URL (5 points)
    const canonicalScore = metaResult.hasCanonical ? 5 : (isSPAWithLimitedContent ? 3 : 0);
    let canonicalDetails = t.factors.canonical.noCanonical;
    if (metaResult.hasCanonical) {
      canonicalDetails = metaResult.canonicalUrl 
        ? `Canonical: ${metaResult.canonicalUrl.length > 50 ? metaResult.canonicalUrl.substring(0, 50) + '...' : metaResult.canonicalUrl}`
        : t.factors.canonical.found;
    }
    
    factors.push({
      id: 'canonical',
      name: t.factors.canonical.name,
      description: t.factors.canonical.description,
      score: canonicalScore,
      maxScore: 5,
      status: canonicalScore === 5 ? 'good' : 'warning',
      recommendation: !metaResult.hasCanonical 
        ? t.factors.canonical.recommendation
        : undefined,
      details: canonicalDetails
    });

    // Factor 9: Direct Answer in First 150 Words (5 points)
    let intentScore = 0;
    let intentDetails = '';
    let intentStatus: 'good' | 'warning' | 'error' = 'error';
    
    if (isSPAWithLimitedContent) {
      intentScore = 3;
      intentDetails = '⚠️ SPA détecté — analyse limitée sans rendu JS';
      intentStatus = 'warning';
    } else {
      if (intentResult.found) {
        intentScore = 5;
        intentDetails = `Réponse directe détectée dans les 150 premiers mots (${intentResult.wordCount} mots analysés, densité ${intentResult.keywordDensity}%) | Mots-clés: ${intentResult.detectedKeywords.join(', ')}`;
        intentStatus = 'good';
      } else if (intentResult.inFirst150Words) {
        intentScore = 4;
        intentDetails = `Mots-clés présents dans les 150 premiers mots mais cohérence partielle (densité ${intentResult.keywordDensity}%) | Mots-clés: ${intentResult.detectedKeywords.join(', ')}`;
        intentStatus = 'warning';
      } else if (intentResult.inTitle || intentResult.inH1) {
        intentScore = 2;
        intentDetails = `Intention dans le titre mais absente des 150 premiers mots (${intentResult.wordCount} mots analysés) | Mots-clés: ${intentResult.detectedKeywords.join(', ')}`;
        intentStatus = 'warning';
      } else {
        intentScore = 0;
        intentDetails = `Aucune réponse directe dans les 150 premiers mots (${intentResult.wordCount} mots analysés)`;
        intentStatus = 'error';
      }
    }
    
    factors.push({
      id: 'intent-in-title',
      name: t.factors.intentInTitle.name,
      description: t.factors.intentInTitle.description,
      score: intentScore,
      maxScore: 5,
      status: intentStatus,
      recommendation: intentScore < 5 ? t.factors.intentInTitle.recommendation : undefined,
      details: intentDetails
    });

    // Factor 10: FAQ or Summary at Top (5 points)
    let faqScore = 0;
    let faqStatus: 'good' | 'warning' | 'error' = 'error';
    
    if (isSPAWithLimitedContent) {
      faqScore = 3;
      faqStatus = 'warning';
    } else {
      if (faqResult.hasFaq && faqResult.hasSummary) {
        faqScore = 5;
        faqStatus = 'good';
      } else if (faqResult.hasFaq || faqResult.hasSummary) {
        faqScore = 3;
        faqStatus = 'warning';
      } else {
        faqScore = 0;
        faqStatus = 'error';
      }
    }
    
    factors.push({
      id: 'faq-or-summary',
      name: t.factors.faqOrSummary.name,
      description: t.factors.faqOrSummary.description,
      score: faqScore,
      maxScore: 5,
      status: faqStatus,
      recommendation: faqScore < 5 ? t.factors.faqOrSummary.recommendation : undefined,
      details: isSPAWithLimitedContent ? '⚠️ SPA détecté — analyse limitée sans rendu JS' : faqResult.details
    });


    const rawTotalScore = factors.reduce((sum, f) => sum + f.score, 0);
    
    // Si le self-audit a détecté des problèmes, on pondère le score
    const adjustedScore = selfAudit.reliabilityScore < 1.0
      ? Math.round(rawTotalScore * selfAudit.reliabilityScore)
      : rawTotalScore;

    console.log(`[GEO-AUDIT] Score: ${rawTotalScore}/100 (adjusted: ${adjustedScore}, reliability: ${selfAudit.reliabilityScore})`);

    // ═══ MISPLACED STRUCTURAL TAGS DETECTION ═══
    const misplacedHeadTags: string[] = [];
    const bodyEl = doc.querySelector('body');
    if (bodyEl) {
      if (bodyEl.querySelector('link[rel="canonical"]')) misplacedHeadTags.push('canonical');
      if (bodyEl.querySelector('meta[name="robots"]')) misplacedHeadTags.push('robots');
      if (bodyEl.querySelector('link[hreflang]')) misplacedHeadTags.push('hreflang');
    }

    const result: AuditResult = {
      success: true,
      reliabilityScore: selfAudit.reliabilityScore,
      data: {
        url: normalizedUrl,
        totalScore: rawTotalScore,
        factors,
        renderingInfo: {
          isSPA: spaInfo.isSPA,
          hasSSR: spaInfo.hasSSR,
          framework: spaInfo.framework
        },
        scannedAt: new Date().toISOString(),
        auditMetadata: {
          htmlLength: pageHtml.length,
          textLength: doc.body?.textContent?.trim().length || 0,
          reliabilityScore: selfAudit.reliabilityScore,
          selfAuditPassed: selfAudit.isReliable
        },
        misplacedHeadTags,
      }
    };

    // Ajouter un avertissement si la fiabilité n'est pas à 100%
    if (selfAudit.reason) {
      result.blockingError = selfAudit.reason;
    }

    // Fire-and-forget URL tracking + raw data capture
    trackAnalyzedUrl(normalizedUrl).catch(() => {});
    saveRawAuditData({
      url: normalizedUrl,
      domain: new URL(normalizedUrl).hostname.replace(/^www\./, ''),
      auditType: 'lead_magnet_geo',
      rawPayload: { totalScore: rawTotalScore, factors: factors.map(f => ({ id: f.id, score: f.score, status: f.status })), reliabilityScore: selfAudit.reliabilityScore },
      sourceFunctions: ['check-geo'],
    }).catch(() => {});

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[GEO-AUDIT] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to analyze GEO';
    await trackEdgeFunctionError('check-geo', errorMessage).catch(() => {});
    return new Response(
      JSON.stringify({ success: false, reliabilityScore: 0, blockingError: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } finally {
    releaseConcurrency('check-geo');
  }
});
