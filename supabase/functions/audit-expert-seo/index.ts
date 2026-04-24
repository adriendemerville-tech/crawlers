import { DOMParser, Element, HTMLDocument } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts"
import { stealthFetch } from '../_shared/stealthFetch.ts'
import { assertSafeUrl } from '../_shared/ssrf.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { checkIpRate, getClientIp, rateLimitResponse, acquireConcurrency, releaseConcurrency, concurrencyResponse } from '../_shared/ipRateLimiter.ts'
import { checkFairUse, getUserContext } from '../_shared/fairUse.ts'
import { saveRawAuditData } from '../_shared/saveRawAuditData.ts'
import { trackPaidApiCall } from '../_shared/tokenTracker.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_PAGESPEED_API_KEY') || '';

// ==================== INTERFACES ====================

interface SelfAuditResult {
  isReliable: boolean;
  reason?: string;
  reliabilityScore: number;
}

interface SmartFetchResult {
  html: string;
  renderingMode: 'static_fast' | 'dynamic_rendered';
  selfAudit: SelfAuditResult;
}

interface SemanticConsistency {
  titleH1Similarity: number;
  verdict: string;
  details: string;
}

interface ContentDensity {
  ratio: number;
  verdict: string;
  htmlSize: number;
  textSize: number;
}

interface LinkProfile {
  internal: number;
  external: number;
  total: number;
  toxicAnchors: string[];
  toxicAnchorsCount: number;
}

interface BrokenLink {
  url: string;
  status: number;
  anchor: string;
  type: 'internal' | 'external';
}

interface BrokenLinksAnalysis {
  total: number;
  broken: BrokenLink[];
  checked: number;
  corsBlocked: number;
  verdict: 'optimal' | 'warning' | 'critical';
}

interface JsonLdValidation {
  valid: boolean;
  types: string[];
  parseErrors: string[];
  count: number;
  isJsGenerated: boolean;
}

interface HeadingHierarchy {
  levels: number[]; // all heading levels found (1,2,3,4,5,6)
  gaps: string[];   // e.g. ["H1→H3 (H2 manquant)"]
  hasMultipleH1: boolean;
  verdict: 'optimal' | 'warning' | 'critical';
}

interface SitemapRobotsCoherence {
  sitemapExists: boolean;
  sitemapUrls: string[];
  sitemapDeclaredInRobots: boolean;
  issues: { type: string; description: string; severity: 'critical' | 'important' }[];
  verdict: 'optimal' | 'warning' | 'critical';
}

interface ExpertInsights {
  semanticConsistency: SemanticConsistency;
  contentDensity: ContentDensity;
  linkProfile: LinkProfile;
  jsonLdValidation: JsonLdValidation;
  brokenLinks?: BrokenLinksAnalysis;
  headingHierarchy?: HeadingHierarchy;
  sitemapRobotsCoherence?: SitemapRobotsCoherence;
}

interface HtmlAnalysis {
  hasTitle: boolean;
  titleLength: number;
  titleContent: string;
  hasMetaDesc: boolean;
  metaDescLength: number;
  metaDescContent: string;
  h1Count: number;
  h1Contents: string[];
  h2Count: number;
  h2Contents: string[];
  wordCount: number;
  hasSchemaOrg: boolean;
  schemaTypes: string[];
  isHttps: boolean;
  insights: ExpertInsights;
  imagesTotal: number;
  imagesMissingAlt: number;
  htmlSizeBytes: number;
}

interface RobotsAnalysis {
  exists: boolean;
  permissive: boolean;
  content: string;
  allowsAIBots: {
    gptBot: boolean;
    claudeBot: boolean;
    perplexityBot: boolean;
  };
}

interface AuditMeta {
  scannedAt: string;
  renderingMode: 'static_fast' | 'dynamic_rendered';
  reliabilityScore: number;
  blockingError?: string;
}

interface RecommendationItem {
  id: string;
  priority: 'critical' | 'important' | 'optional';
  category: string;
  icon: string;
  title: string;
  description: string;
  strengths?: string[];
  weaknesses?: string[];
  fixes?: string[];
  target_selector?: string;
  target_operation?: 'replace' | 'insert_after' | 'append' | 'create' | 'delete_element';
}

// ==================== TOXIC ANCHORS LIST ====================

const TOXIC_ANCHORS = [
  'cliquez ici', 'click here', 'here', 'ici', 'lire la suite', 'read more',
  'en savoir plus', 'learn more', 'plus', 'more', 'voir', 'see', 'link',
  'lien', 'suite', 'continuer', 'continue', 'suivant', 'next', 'details',
  'détails', 'cliquer', 'click', 'allez', 'go', 'page', 'article'
];

// ==================== UTILITY FUNCTIONS ====================

/**
 * Normalisation robuste d'URL avec correction automatique des erreurs courantes
 * - Ajoute https:// si absent
 * - Corrige les doubles slashes
 * - Supprime les espaces et caractères invisibles
 * - Gère les URLs mal formatées
 */
function normalizeUrl(url: string): string {
  // Nettoyage basique
  let normalized = url
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width chars
    .replace(/\s+/g, '') // Remove all whitespace
    .toLowerCase();
  
  // Corriger les protocoles mal écrits
  normalized = normalized
    .replace(/^https?:\/+/i, 'https://') // Fix http:/// or https:/// 
    .replace(/^htt[ps]?:(?!\/\/)/i, 'https://') // Fix http: without slashes
    .replace(/^htpps?:\/\//i, 'https://') // Fix typos like htpps://
    .replace(/^hhttps?:\/\//i, 'https://') // Fix hhttps://
    .replace(/^wwww?\./i, 'www.'); // Fix wwww.
  
  // Ajouter https:// si aucun protocole
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    // Si commence par www., ajouter https://
    if (normalized.startsWith('www.')) {
      normalized = `https://${normalized}`;
    } else {
      // Sinon, ajouter https://www. si ça ressemble à un domaine court
      // Ex: google.fr → https://www.google.fr
      // Ex: my-site.example.com → https://my-site.example.com (pas de www)
      const parts = normalized.split('.');
      if (parts.length === 2 && parts[0].length <= 15 && !parts[0].includes('-')) {
        normalized = `https://www.${normalized}`;
      } else {
        normalized = `https://${normalized}`;
      }
    }
  }
  
  // Valider la structure URL finale
  try {
    const urlObj = new URL(normalized);
    // S'assurer que le hostname est valide
    if (!urlObj.hostname || urlObj.hostname.length < 4) {
      throw new Error('Invalid hostname');
    }
    return urlObj.toString().replace(/\/$/, ''); // Remove trailing slash
  } catch {
    // Si toujours invalide, retourner tel quel (sera géré par l'erreur fetch)
    return normalized;
  }
}

/**
 * Tente de résoudre l'URL correcte en testant plusieurs variantes
 * Retourne l'URL qui répond, ou la première par défaut
 */
async function resolveWorkingUrl(baseUrl: string): Promise<{ url: string; resolved: boolean }> {
  const normalized = normalizeUrl(baseUrl);
  
  // Parse pour générer des variantes
  let urlObj: URL;
  try {
    urlObj = new URL(normalized);
  } catch {
    return { url: normalized, resolved: false };
  }
  
  const hostname = urlObj.hostname;
  const pathname = urlObj.pathname;
  
  // Générer des variantes à tester
  const variants: string[] = [normalized];
  
  // Variante sans www si présent
  if (hostname.startsWith('www.')) {
    variants.push(`https://${hostname.slice(4)}${pathname}`);
  } else {
    // Variante avec www si absent
    variants.push(`https://www.${hostname}${pathname}`);
  }
  
  // Variante http si https échoue (rare mais possible)
  variants.push(normalized.replace('https://', 'http://'));
  
  console.log(`[URL-Resolver] Testing ${variants.length} URL variants...`);
  
  // Tester chaque variante avec un HEAD request rapide
  for (const variant of variants) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(variant, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CrawlersAI/2.0; +https://crawlers.fr)',
        },
        redirect: 'follow'
      });
      
      clearTimeout(timeoutId);
      
      // Récupérer l'URL finale après redirections
      const finalUrl = response.url || variant;
      
      if (response.ok || response.status === 405 || response.status === 403) {
        // 405 = Method Not Allowed (some sites block HEAD but allow GET)
        // 403 = Forbidden (WAF/Cloudflare but site is real — will try GET in smartFetch)
        console.log(`[URL-Resolver] ✅ Found working URL: ${finalUrl} (status: ${response.status})`);
        return { url: finalUrl, resolved: true };
      }
    } catch (e) {
      // Continue to next variant
      console.log(`[URL-Resolver] ❌ Failed: ${variant}`);
    }
  }
  
  // Aucune variante n'a fonctionné, retourner l'originale
  console.log(`[URL-Resolver] ⚠️ No working variant found, using original: ${normalized}`);
  return { url: normalized, resolved: false };
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-zàâäéèêëïîôùûüç0-9\s]/g, '').trim();
  const words1 = new Set(normalize(text1).split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(normalize(text2).split(/\s+/).filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = [...words1].filter(w => words2.has(w));
  const union = new Set([...words1, ...words2]);
  
  return Math.round((intersection.length / union.size) * 100);
}

// ==================== SELF-AUDIT MECHANISM ====================

function performSelfAudit(doc: HTMLDocument, htmlLength: number): SelfAuditResult {
  const bodyText = doc.body?.textContent?.trim() || "";
  const bodyTextLength = bodyText.length;
  
  // Rule 1: Large HTML but minimal visible text = SPA not rendered
  if (htmlLength > 2000 && bodyTextLength < 200) {
    return {
      isReliable: false,
      reliabilityScore: 0.2,
      reason: "CRITICAL: DOM vide détecté. Le contenu est probablement généré par JavaScript (SPA/React/Vue). Le fallback de rendu sera utilisé."
    };
  }
  
  // Rule 2: Check for SPA framework indicators without content
  const hasSpaIndicators = doc.querySelector('[data-reactroot], [ng-app], [data-v-], #__next, #__nuxt, #app[data-server-rendered]') !== null;
  const hasNoscriptWarning = doc.querySelector('noscript')?.textContent?.includes('JavaScript') || false;
  
  if (hasSpaIndicators && bodyTextLength < 500) {
    return {
      isReliable: false,
      reliabilityScore: 0.3,
      reason: "WARNING: Framework SPA détecté avec contenu limité. Le rendu JavaScript est probablement requis."
    };
  }
  
  // Rule 3: Very short content overall
  if (bodyTextLength < 100) {
    return {
      isReliable: false,
      reliabilityScore: 0.4,
      reason: "WARNING: Contenu textuel très faible. La page pourrait être en erreur ou requérir JavaScript."
    };
  }
  
  // All checks passed
  return {
    isReliable: true,
    reliabilityScore: 1.0
  };
}

// ==================== SMART FETCHER WITH CASCADING WAF BYPASS ====================

/**
 * Cascade optimisée (75% natif / 22% Spider / 3% Firecrawl) :
 * stealthFetch → Spider.cloud → Browserless → Firecrawl
 * Fly.io Playwright conservé comme helper mais retiré de la cascade principale.
 */

async function tryBrowserless(url: string): Promise<string | null> {
  const RENDERING_KEY = Deno.env.get('RENDERING_API_KEY') || Deno.env.get('BROWSERLESS_API_KEY');
  if (!RENDERING_KEY) return null;

  try {
    console.log('[SmartFetch] 🔄 Tentative Browserless.io...');
    const renderUrl = `https://production-sfo.browserless.io/content?token=${RENDERING_KEY}`;
    const response = await fetch(renderUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        rejectResourceTypes: ['image', 'media', 'font'],
        gotoOptions: { waitUntil: 'networkidle2', timeout: 25000 },
        waitForSelector: { selector: 'body', timeout: 5000 },
      }),
      signal: AbortSignal.timeout(35000),
    });

    if (response.ok) {
      const html = await response.text();
      if (html.length > 500) {
        console.log(`[SmartFetch] ✅ Browserless OK (${html.length} chars)`);
        await trackPaidApiCall('audit-expert-seo', 'browserless', '/content', url).catch(() => {});
        return html;
      }
    } else {
      console.log(`[SmartFetch] ⚠️ Browserless erreur ${response.status}`);
    }
  } catch (e: unknown) {
    const err = e as Error;
    console.log(`[SmartFetch] ⚠️ Browserless exception: ${err.message}`);
  }
  return null;
}

async function tryFlyPlaywright(url: string): Promise<string | null> {
  const flyUrl = Deno.env.get('FLY_RENDERER_URL');
  const flySecret = Deno.env.get('FLY_RENDERER_SECRET');
  if (!flyUrl) return null;

  try {
    console.log(`[SmartFetch] 🔄 Tentative Fly.io Playwright...`);
    const response = await fetch(`${flyUrl}/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(flySecret ? { 'x-secret': flySecret } : {}),
      },
      body: JSON.stringify({ url, timeout: 30000, waitFor: 3000 }),
      signal: AbortSignal.timeout(40000),
    });

    if (response.ok) {
      const html = await response.text();
      if (html.length > 500) {
        console.log(`[SmartFetch] ✅ Fly.io Playwright OK (${html.length} chars)`);
        return html;
      }
    } else {
      console.log(`[SmartFetch] ⚠️ Fly.io erreur ${response.status}`);
    }
  } catch (e: unknown) {
    const err = e as Error;
    console.log(`[SmartFetch] ⚠️ Fly.io exception: ${err.message}`);
  }
  return null;
}

async function trySpider(url: string): Promise<string | null> {
  const apiKey = Deno.env.get('SPIDER_API_KEY');
  if (!apiKey) return null;

  try {
    console.log(`[SmartFetch] 🕷️ Tentative Spider.cloud...`);
    const response = await fetch('https://api.spider.cloud/crawl', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, limit: 1, return_format: 'raw', request: 'http' }),
      signal: AbortSignal.timeout(30000),
    });

    if (response.ok) {
      const data = await response.json();
      const page = Array.isArray(data) ? data[0] : data;
      const html = page?.content || '';
      if (html.length > 500) {
        console.log(`[SmartFetch] ✅ Spider.cloud OK (${html.length} chars)`);
        return html;
      }
    } else {
      console.log(`[SmartFetch] ⚠️ Spider.cloud erreur ${response.status}`);
    }
  } catch (e: unknown) {
    const err = e as Error;
    console.log(`[SmartFetch] ⚠️ Spider.cloud exception: ${err.message}`);
  }
  return null;
}

async function tryFirecrawl(url: string): Promise<string | null> {
  const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!apiKey) return null;

  try {
    console.log(`[SmartFetch] 🔄 Tentative Firecrawl (fallback)...`);
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['html'],
        onlyMainContent: false,
        waitFor: 3000,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (response.ok) {
      const data = await response.json();
      const html = data?.data?.html || data?.html || '';
      if (html.length > 500) {
        console.log(`[SmartFetch] ✅ Firecrawl OK (${html.length} chars)`);
        return html;
      }
    } else {
      console.log(`[SmartFetch] ⚠️ Firecrawl erreur ${response.status}`);
    }
  } catch (e: unknown) {
    const err = e as Error;
    console.log(`[SmartFetch] ⚠️ Firecrawl exception: ${err.message}`);
  }
  return null;
}

async function smartFetch(url: string): Promise<SmartFetchResult> {
  assertSafeUrl(url);
  
  // ── ÉTAPE 1 : stealthFetch (gratuit, UA rotation + anti-détection) ──
  console.log('[SmartFetch] Étape 1: stealthFetch (UA rotation)...');
  let html = '';
  let fetchStatus = 0;
  
  try {
    const { response } = await stealthFetch(url, {
      timeout: 15000,
      maxRetries: 2,
    });
    fetchStatus = response.status;
    
    if (response.ok || response.status === 403) {
      html = await response.text();
      if (response.status === 403 && html.length < 500) {
        console.log(`[SmartFetch] 403 avec contenu insuffisant (${html.length} chars)`);
        html = '';  // Force fallback
      } else if (response.ok) {
        console.log(`[SmartFetch] stealthFetch OK (${html.length} chars, status ${fetchStatus})`);
      }
    } else {
      console.log(`[SmartFetch] stealthFetch HTTP ${fetchStatus}`);
    }
  } catch (e: unknown) {
    const err = e as Error;
    console.log(`[SmartFetch] stealthFetch échoué: ${err.message}`);
  }
  
  // Check if stealthFetch result is usable
  let needsFallback = !html || html.length < 500;
  let usedRendering = false;
  
  if (!needsFallback) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (doc) {
      const selfAudit = performSelfAudit(doc, html.length);
      if (selfAudit.isReliable) {
        console.log('[SmartFetch] ✅ stealthFetch fiable — pas de fallback nécessaire');
        return { html, renderingMode: 'static_fast', selfAudit };
      }
      console.log('[SmartFetch] stealthFetch non fiable:', selfAudit.reason);
    }
    needsFallback = true;
  }
  
  // ── ÉTAPE 2 : Spider.cloud (peu coûteux, rend le JS, bonne couverture) ──
  const spiderHtml = await trySpider(url);
  if (spiderHtml) {
    const doc = new DOMParser().parseFromString(spiderHtml, 'text/html');
    if (doc) {
      const selfAudit = performSelfAudit(doc, spiderHtml.length);
      if (selfAudit.isReliable || spiderHtml.length > (html?.length || 0)) {
        return {
          html: spiderHtml,
          renderingMode: 'dynamic_rendered',
          selfAudit: { ...selfAudit, reliabilityScore: Math.max(selfAudit.reliabilityScore, 0.85) },
        };
      }
    }
  }
  
  // ── ÉTAPE 3 : Browserless.io (headless Chrome — résout les challenges JS lourds) ──
  const browserlessHtml = await tryBrowserless(url);
  if (browserlessHtml) {
    const doc = new DOMParser().parseFromString(browserlessHtml, 'text/html');
    if (doc) {
      const selfAudit = performSelfAudit(doc, browserlessHtml.length);
      if (selfAudit.isReliable || browserlessHtml.length > (html?.length || 0)) {
        return {
          html: browserlessHtml,
          renderingMode: 'dynamic_rendered',
          selfAudit: { ...selfAudit, reliabilityScore: Math.max(selfAudit.reliabilityScore, 0.85) },
        };
      }
    }
  }

  // ── ÉTAPE 4 : Firecrawl (dernier recours anti-WAF, ~3% des pages) ──
  const firecrawlHtml = await tryFirecrawl(url);
  if (firecrawlHtml) {
    const doc = new DOMParser().parseFromString(firecrawlHtml, 'text/html');
    if (doc) {
      const selfAudit = performSelfAudit(doc, firecrawlHtml.length);
      return {
        html: firecrawlHtml,
        renderingMode: 'dynamic_rendered',
        selfAudit: { ...selfAudit, reliabilityScore: Math.max(selfAudit.reliabilityScore, 0.75) },
      };
    }
  }
  
  // ── Dernier recours : retourner ce qu'on a, même dégradé ──
  if (html && html.length > 0) {
    console.log('[SmartFetch] ⚠️ Tous les fallbacks ont échoué — utilisation du HTML dégradé');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const selfAudit = doc ? performSelfAudit(doc, html.length) : { isReliable: false, reason: 'No DOM', reliabilityScore: 0.3 };
    return {
      html,
      renderingMode: 'static_fast',
      selfAudit: { ...selfAudit, reliabilityScore: Math.max(selfAudit.reliabilityScore, 0.3) },
    };
  }
  
  throw new Error(`Impossible de récupérer le contenu de ${url} (toutes les méthodes ont échoué)`);
}

// ==================== DOM-BASED HTML ANALYSIS ====================

function analyzeHtmlWithDOM(html: string, url: string): HtmlAnalysis {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  
  if (!doc) {
    return createEmptyAnalysis(url);
  }
  
  // === ÉTAPE 1 : Extraction des métadonnées (DOM complet) ===
  
  // Extract title using DOM (no regex!)
  const titleElement = doc.querySelector('title');
  const titleContent = titleElement?.textContent?.trim() || '';
  
  // Extract meta description using DOM
  const metaDescElement = doc.querySelector('meta[name="description"]');
  const metaDescContent = metaDescElement?.getAttribute('content')?.trim() || '';
  
  // ═══════════════════════════════════════════════════════════════
  // EXTRACTION H1 - APPROCHE HYBRIDE DOM + REGEX FALLBACK
  // ═══════════════════════════════════════════════════════════════
  
  const h1Contents: string[] = [];
  
  // Méthode 1: DOM standard
  const h1Elements = doc.querySelectorAll('h1');
  for (let i = 0; i < h1Elements.length; i++) {
    const h1Text = (h1Elements[i] as Element).textContent?.trim() || '';
    if (h1Text && h1Text.length > 0) {
      h1Contents.push(h1Text);
    }
  }
  
  // Méthode 2: Fallback regex si DOM n'a rien trouvé
  // (gère les H1 avec attributs complexes, style inline, etc.)
  if (h1Contents.length === 0) {
    console.log('[H1] DOM vide, tentative regex fallback...');
    const h1Regex = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
    let h1Match;
    while ((h1Match = h1Regex.exec(html)) !== null) {
      const h1Html = h1Match[1];
      const h1Text = cleanHtmlToText(h1Html);
      if (h1Text && h1Text.length > 0) {
        h1Contents.push(h1Text);
        console.log(`[H1-Regex] Trouvé: "${h1Text.substring(0, 60)}${h1Text.length > 60 ? '...' : ''}"`);
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // EXTRACTION H2 - APPROCHE HYBRIDE DOM + REGEX FALLBACK
  // ═══════════════════════════════════════════════════════════════
  
  const h2Contents: string[] = [];
  
  // Méthode 1: DOM standard
  const h2Elements = doc.querySelectorAll('h2');
  for (let i = 0; i < h2Elements.length; i++) {
    const h2Text = (h2Elements[i] as Element).textContent?.trim() || '';
    if (h2Text && h2Text.length > 0) {
      h2Contents.push(h2Text);
    }
  }
  
  // Méthode 2: Fallback regex si DOM n'a rien trouvé
  if (h2Contents.length === 0) {
    console.log('[H2] DOM vide, tentative regex fallback...');
    const h2Regex = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
    let h2Match;
    while ((h2Match = h2Regex.exec(html)) !== null) {
      const h2Html = h2Match[1];
      const h2Text = cleanHtmlToText(h2Html);
      if (h2Text && h2Text.length > 0) {
        h2Contents.push(h2Text);
        console.log(`[H2-Regex] Trouvé: "${h2Text.substring(0, 60)}${h2Text.length > 60 ? '...' : ''}"`);
      }
    }
  }
  
  console.log(`[Headings] H1: ${h1Contents.length}, H2: ${h2Contents.length}`);
  
  // === ÉTAPE 2 : Analyse JSON-LD AVANT suppression des scripts ===
  const jsonLdValidation = analyzeJsonLd(doc, html);
  console.log(`[JSON-LD] Trouvé ${jsonLdValidation.count} scripts, types: ${jsonLdValidation.types.join(', ') || 'aucun'}`);
  
  // === ÉTAPE 3 : Analyse du profil de liens (DOM complet) ===
  const linkProfile = analyzeLinkProfile(doc, url);
  
  // === ÉTAPE 4 : Analyse des images via REGEX (Deno DOMParser ne supporte pas querySelectorAll pour img) ===
  const imgRegex = /<(?:img|amp-img|image)\b([^>]*)(?:\/?>|>[^<]*<\/(?:img|amp-img|image)>)/gi;
  let imagesTotal = 0;
  let imagesMissingAlt = 0;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    imagesTotal++;
    const attrs = imgMatch[1] || '';
    // Check for alt attribute with non-empty value
    const altMatch = attrs.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/i);
    if (!altMatch || (altMatch[1] ?? altMatch[2] ?? altMatch[3] ?? '').trim().length === 0) {
      imagesMissingAlt++;
    }
  }
  // Also count <source> with image types or srcset
  const sourceRegex = /<source\b[^>]*(?:type\s*=\s*["']image\/|srcset\s*=)[^>]*\/?>/gi;
  let sourceCount = 0;
  while (sourceRegex.exec(html) !== null) sourceCount++;
  imagesTotal += sourceCount;
  console.log(`[analyzeHtml] 🖼️ Images (regex): ${imagesTotal} total, ${imagesMissingAlt} missing alt`);

  // === ÉTAPE 5 : Nettoyage du DOM pour calcul du texte ===
  const scriptsAndStyles = doc.querySelectorAll('script, style, noscript, template');
  scriptsAndStyles.forEach(el => (el as Element).remove());
  
  // === ÉTAPE 6 : Calcul du word count sur le texte propre ===
  const bodyText = doc.body?.textContent || '';
  const cleanText = bodyText.replace(/\s+/g, ' ').trim();
  const wordCount = cleanText.split(' ').filter(w => w.length > 2).length;
  
  // Semantic consistency (title vs H1)
  const semanticConsistency = analyzeSemanticConsistency(titleContent, h1Contents[0] || '');
  
  // Content density (code vs text ratio)
  const contentDensity = analyzeContentDensity(html, cleanText);

  // Heading hierarchy analysis (before DOM cleanup removed headings)
  // Re-parse since we already cleaned the DOM above
  const freshDoc = new DOMParser().parseFromString(html, 'text/html');
  const headingHierarchy = freshDoc ? analyzeHeadingHierarchy(freshDoc) : undefined;

  // HTML size in bytes
  const htmlSizeBytes = new TextEncoder().encode(html).length;
  
  const insights: ExpertInsights = {
    semanticConsistency,
    contentDensity,
    linkProfile,
    jsonLdValidation,
    headingHierarchy
  };
  
  return {
    hasTitle: titleContent.length > 0,
    titleLength: titleContent.length,
    titleContent,
    hasMetaDesc: metaDescContent.length > 0,
    metaDescLength: metaDescContent.length,
    metaDescContent,
    h1Count: h1Contents.length,
    h1Contents,
    h2Count: h2Contents.length,
    h2Contents,
    wordCount,
    hasSchemaOrg: jsonLdValidation.valid && jsonLdValidation.count > 0,
    schemaTypes: jsonLdValidation.types,
    isHttps: url.startsWith('https://'),
    insights,
    imagesTotal,
    imagesMissingAlt,
    htmlSizeBytes,
  };
}

// Helper: Nettoyer le HTML interne pour extraire le texte brut
function cleanHtmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, '') // Supprimer les balises HTML internes
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/\s+/g, ' ')
    .trim();
}

function createEmptyAnalysis(url: string): HtmlAnalysis {
  return {
    hasTitle: false,
    titleLength: 0,
    titleContent: '',
    hasMetaDesc: false,
    metaDescLength: 0,
    metaDescContent: '',
    h1Count: 0,
    h1Contents: [],
    h2Count: 0,
    h2Contents: [],
    wordCount: 0,
    hasSchemaOrg: false,
    schemaTypes: [],
    isHttps: url.startsWith('https://'),
    insights: {
      semanticConsistency: { titleH1Similarity: 0, verdict: 'unknown', details: 'Analyse impossible' },
      contentDensity: { ratio: 0, verdict: 'unknown', htmlSize: 0, textSize: 0 },
      linkProfile: { internal: 0, external: 0, total: 0, toxicAnchors: [], toxicAnchorsCount: 0 },
      jsonLdValidation: { valid: false, types: [], parseErrors: [], count: 0 }
    },
    imagesTotal: 0,
    imagesMissingAlt: 0,
    htmlSizeBytes: 0,
  };
}

// ==================== EXPERT INSIGHTS FUNCTIONS ====================

function detectJsGeneratedSchema(html: string): boolean {
  const regularScripts = html.match(/<script(?![^>]*type\s*=\s*["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const script of regularScripts) {
    const content = script.replace(/<script[^>]*>|<\/script>/gi, '');
    if (
      /application\/ld\+json/i.test(content) ||
      (/@context.*schema\.org/i.test(content) && /JSON\.stringify|createElement|innerHTML|insertAdjacentHTML|appendChild/i.test(content)) ||
      /structured[_-]?data|jsonLd|json_ld|schemaMarkup|schema_markup/i.test(content)
    ) {
      return true;
    }
  }
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

function analyzeJsonLd(doc: HTMLDocument, rawHtml: string): JsonLdValidation {
  const isJsGenerated = detectJsGeneratedSchema(rawHtml);
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  const types: string[] = [];
  const parseErrors: string[] = [];
  let validCount = 0;
  
  console.log(`[JSON-LD] Analyse de ${scripts.length} balises script[type="application/ld+json"], JS-generated: ${isJsGenerated}`);
  
  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i] as Element;
    const content = script.textContent || '';
    
    try {
      const parsed = JSON.parse(content);
      validCount++;
      
      const findTypes = (node: any): void => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
          node.forEach(item => findTypes(item));
          return;
        }
        if (node['@type']) {
          if (Array.isArray(node['@type'])) {
            types.push(...node['@type']);
          } else {
            types.push(node['@type']);
          }
        }
        if (node['@graph'] && Array.isArray(node['@graph'])) {
          findTypes(node['@graph']);
        }
        for (const key in node) {
          if (key !== '@graph' && node[key] && typeof node[key] === 'object') {
            findTypes(node[key]);
          }
        }
      };
      
      findTypes(parsed);
      
    } catch (e) {
      parseErrors.push(`Script ${i + 1}: JSON invalide`);
      console.log(`[JSON-LD] Erreur parsing script ${i + 1}:`, e);
    }
  }
  
  const uniqueTypes = [...new Set(types)];
  console.log(`[JSON-LD] Résultat: ${validCount} valides, ${uniqueTypes.length} types uniques: ${uniqueTypes.join(', ')}`);
  
  return {
    valid: parseErrors.length === 0 && validCount > 0,
    types: uniqueTypes,
    parseErrors,
    count: scripts.length,
    isJsGenerated
  };
}

function analyzeLinkProfile(doc: HTMLDocument, baseUrl: string): LinkProfile {
  const links = doc.querySelectorAll('a[href]');
  const baseDomain = extractDomain(baseUrl);
  
  let internal = 0;
  let external = 0;
  const toxicAnchors: string[] = [];
  
  for (let i = 0; i < links.length; i++) {
    const link = links[i] as Element;
    const href = link.getAttribute('href') || '';
    const anchorText = link.textContent?.toLowerCase().trim() || '';
    
    // Skip empty, javascript, and anchor links
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) {
      continue;
    }
    
    // Determine if internal or external
    try {
      const linkUrl = new URL(href, baseUrl);
      if (linkUrl.hostname === baseDomain || linkUrl.hostname.endsWith('.' + baseDomain)) {
        internal++;
      } else {
        external++;
      }
    } catch {
      // Relative link = internal
      internal++;
    }
    
    // Check for toxic anchors
    if (anchorText && TOXIC_ANCHORS.some(toxic => anchorText === toxic || anchorText.includes(toxic))) {
      if (!toxicAnchors.includes(anchorText) && toxicAnchors.length < 10) {
        toxicAnchors.push(anchorText);
      }
    }
  }
  
  return {
    internal,
    external,
    total: internal + external,
    toxicAnchors,
    toxicAnchorsCount: toxicAnchors.length
  };
}

// ==================== HEADING HIERARCHY ANALYSIS ====================

function analyzeHeadingHierarchy(doc: HTMLDocument): HeadingHierarchy {
  const headings: { level: number; text: string }[] = [];
  const allHeadings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
  
  for (let i = 0; i < allHeadings.length; i++) {
    const el = allHeadings[i] as Element;
    const tagName = el.tagName?.toLowerCase() || '';
    const level = parseInt(tagName.replace('h', ''), 10);
    const text = el.textContent?.trim() || '';
    if (level >= 1 && level <= 6 && text.length > 0) {
      headings.push({ level, text });
    }
  }
  
  const levels = [...new Set(headings.map(h => h.level))].sort();
  const gaps: string[] = [];
  const hasMultipleH1 = headings.filter(h => h.level === 1).length > 1;
  
  // Check for hierarchy gaps (e.g. H1→H3 without H2)
  for (let i = 0; i < headings.length - 1; i++) {
    const current = headings[i].level;
    const next = headings[i + 1].level;
    // Only flag when going deeper (e.g. H1→H3 is a gap, H3→H1 is not)
    if (next > current + 1) {
      const missing = [];
      for (let m = current + 1; m < next; m++) missing.push(`H${m}`);
      const gap = `H${current}→H${next} (${missing.join(', ')} manquant${missing.length > 1 ? 's' : ''})`;
      if (!gaps.includes(gap)) gaps.push(gap);
    }
  }
  
  let verdict: 'optimal' | 'warning' | 'critical' = 'optimal';
  if (hasMultipleH1 && gaps.length > 0) verdict = 'critical';
  else if (hasMultipleH1 || gaps.length > 2) verdict = 'critical';
  else if (gaps.length > 0) verdict = 'warning';
  
  console.log(`[HeadingHierarchy] ${headings.length} headings, ${gaps.length} gaps, multiH1: ${hasMultipleH1}`);
  
  return { levels, gaps, hasMultipleH1, verdict };
}

// ==================== SITEMAP / ROBOTS.TXT COHERENCE ====================

async function checkSitemapRobotsCoherence(url: string, robotsContent: string, robotsExists: boolean): Promise<SitemapRobotsCoherence> {
  console.log('[SitemapCoherence] Vérification cohérence sitemap/robots.txt...');
  
  const origin = new URL(url).origin;
  const isHttpsSite = url.startsWith('https://');
  const issues: { type: string; description: string; severity: 'critical' | 'important' }[] = [];
  let sitemapUrls: string[] = [];
  let sitemapExists = false;
  let sitemapDeclaredInRobots = false;
  
  // 1. Check if sitemap is declared in robots.txt
  if (robotsExists && robotsContent) {
    const sitemapDeclarations = robotsContent.match(/^Sitemap:\s*(.+)/gmi) || [];
    sitemapDeclaredInRobots = sitemapDeclarations.length > 0;
    
    // Check for HTTP sitemap URLs on HTTPS site
    for (const decl of sitemapDeclarations) {
      const sitemapUrl = decl.replace(/^Sitemap:\s*/i, '').trim();
      if (isHttpsSite && sitemapUrl.startsWith('http://')) {
        issues.push({
          type: 'http_sitemap_on_https',
          description: `Sitemap déclaré en HTTP (${sitemapUrl}) sur un site HTTPS. Google pourrait ignorer ce sitemap.`,
          severity: 'important'
        });
      }
    }
    
    // Check if robots.txt blocks CSS/JS resources
    const blocksCSS = /Disallow:.*\.css/i.test(robotsContent);
    const blocksJS = /Disallow:.*\.js/i.test(robotsContent);
    if (blocksCSS || blocksJS) {
      const blocked = [blocksCSS && 'CSS', blocksJS && 'JS'].filter(Boolean).join(' et ');
      issues.push({
        type: 'blocks_rendering_resources',
        description: `Le robots.txt bloque des ressources ${blocked} nécessaires au rendu. Google ne peut pas rendre correctement les pages.`,
        severity: 'critical'
      });
    }
  } else if (robotsExists && !robotsContent) {
    // robots exists but empty - not ideal but not a coherence issue
  }
  
  // 2. Fetch and parse sitemap.xml
  try {
    const sitemapUrl = `${origin}/sitemap.xml`;
    const resp = await fetch(sitemapUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CrawlersFR/2.0)' },
      redirect: 'follow',
    });
    
    if (resp.ok) {
      sitemapExists = true;
      const sitemapXml = await resp.text();
      
      // Extract URLs from sitemap
      const locMatches = sitemapXml.match(/<loc>([^<]+)<\/loc>/gi) || [];
      sitemapUrls = locMatches.map(m => m.replace(/<\/?loc>/gi, '').trim()).slice(0, 100);
      
      // Check for HTTP URLs in sitemap on HTTPS site
      if (isHttpsSite) {
        const httpUrls = sitemapUrls.filter(u => u.startsWith('http://'));
        if (httpUrls.length > 0) {
          issues.push({
            type: 'http_urls_in_sitemap',
            description: `${httpUrls.length} URL(s) en HTTP dans le sitemap d'un site HTTPS. Ces URLs créent des signaux contradictoires.`,
            severity: 'critical'
          });
        }
      }
      
      // 3. Check for noindex pages in sitemap (sample up to 10 pages)
      const samplesToCheck = sitemapUrls.slice(0, 10);
      let noindexInSitemap = 0;
      const noindexUrls: string[] = [];
      
      const checkPromises = samplesToCheck.map(async (sUrl) => {
        try {
          const pageResp = await fetch(sUrl, {
            method: 'GET',
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CrawlersFR/2.0)' },
            redirect: 'follow',
          });
          if (pageResp.ok) {
            const pageHtml = await pageResp.text();
            const hasNoindex = /<meta[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex[^"']*["']/i.test(pageHtml)
              || /<meta[^>]*content=["'][^"']*noindex[^"']*["'][^>]*name=["']robots["']/i.test(pageHtml);
            if (hasNoindex) {
              return sUrl;
            }
          }
        } catch { /* skip */ }
        return null;
      });
      
      const noindexResults = await Promise.all(checkPromises);
      for (const result of noindexResults) {
        if (result) {
          noindexInSitemap++;
          noindexUrls.push(result);
        }
      }
      
      if (noindexInSitemap > 0) {
        issues.push({
          type: 'noindex_in_sitemap',
          description: `${noindexInSitemap} page(s) en noindex trouvée(s) dans le sitemap. Le sitemap et les meta robots se contredisent.${noindexUrls.length > 0 ? ` Ex: ${noindexUrls[0].substring(0, 60)}` : ''}`,
          severity: 'critical'
        });
      }
      
      // Check if sitemap is not declared in robots.txt
      if (!sitemapDeclaredInRobots) {
        issues.push({
          type: 'sitemap_not_in_robots',
          description: 'Le sitemap.xml existe mais n\'est pas déclaré dans le robots.txt. Les moteurs comptent sur cette déclaration pour le découvrir.',
          severity: 'important'
        });
      }
    }
  } catch (e) {
    console.log('[SitemapCoherence] Erreur fetch sitemap:', e);
  }
  
  let verdict: 'optimal' | 'warning' | 'critical' = 'optimal';
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  if (criticalCount > 0) verdict = 'critical';
  else if (issues.length > 0) verdict = 'warning';
  
  console.log(`[SitemapCoherence] ✅ ${issues.length} issues trouvées (${criticalCount} critiques)`);
  
  return { sitemapExists, sitemapUrls, sitemapDeclaredInRobots, issues, verdict };
}

function analyzeSemanticConsistency(title: string, h1: string): SemanticConsistency {
  const similarity = calculateTextSimilarity(title, h1);
  
  let verdict: string;
  let details: string;
  
  if (similarity === 100) {
    verdict = 'redundant';
    details = 'Title et H1 identiques : opportunité sémantique perdue. Diversifiez pour cibler plus de mots-clés.';
  } else if (similarity >= 70) {
    verdict = 'optimal';
    details = 'Excellente cohérence sémantique entre Title et H1 avec variation suffisante.';
  } else if (similarity >= 40) {
    verdict = 'acceptable';
    details = 'Cohérence correcte. Considérez un meilleur alignement pour renforcer le signal sémantique.';
  } else if (similarity > 0) {
    verdict = 'inconsistent';
    details = 'Incohérence sémantique détectée. Le Title et le H1 semblent traiter de sujets différents.';
  } else {
    verdict = 'missing';
    details = 'Analyse impossible : Title ou H1 manquant.';
  }
  
  return { titleH1Similarity: similarity, verdict, details };
}

function analyzeContentDensity(html: string, visibleText: string): ContentDensity {
  const htmlSize = html.length;
  const textSize = visibleText.length;
  const ratio = htmlSize > 0 ? Math.round((textSize / htmlSize) * 100) : 0;
  
  let verdict: string;
  if (ratio < 10) {
    verdict = 'critical';
  } else if (ratio < 15) {
    verdict = 'warning';
  } else if (ratio < 25) {
    verdict = 'acceptable';
  } else {
    verdict = 'optimal';
  }
  
  return { ratio, verdict, htmlSize, textSize };
}

// ==================== BROKEN LINKS CHECKER ====================

// Social media & platforms that systematically block bots — auto-whitelist
const SOCIAL_WHITELIST_DOMAINS = new Set([
  'facebook.com', 'www.facebook.com', 'fb.com', 'm.facebook.com',
  'instagram.com', 'www.instagram.com',
  'twitter.com', 'x.com', 'www.twitter.com',
  'linkedin.com', 'www.linkedin.com', 'fr.linkedin.com',
  'tiktok.com', 'www.tiktok.com',
  'pinterest.com', 'www.pinterest.com', 'pinterest.fr',
  'youtube.com', 'www.youtube.com', 'youtu.be',
  'snapchat.com', 'www.snapchat.com',
  'threads.net', 'www.threads.net',
  'wa.me', 'api.whatsapp.com', 'web.whatsapp.com',
  'discord.gg', 'discord.com',
  'reddit.com', 'www.reddit.com',
  'tumblr.com', 'www.tumblr.com',
  'vimeo.com', 'www.vimeo.com',
  'dailymotion.com', 'www.dailymotion.com',
  'play.google.com', 'apps.apple.com',
]);

function isSocialWhitelisted(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (SOCIAL_WHITELIST_DOMAINS.has(hostname)) return true;
    // Check parent domain (e.g. m.facebook.com → facebook.com)
    for (const domain of SOCIAL_WHITELIST_DOMAINS) {
      if (hostname.endsWith('.' + domain)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function checkBrokenLinks(doc: HTMLDocument, baseUrl: string, userFalsePositiveDomains?: string[]): Promise<BrokenLinksAnalysis & { skipped_social: number }> {
  console.log('[BrokenLinks] Vérification des liens cassés...');
  
  // Build combined whitelist
  const userWhitelist = new Set((userFalsePositiveDomains || []).map(d => d.toLowerCase()));
  
  const links = doc.querySelectorAll('a[href]');
  const baseDomain = extractDomain(baseUrl);
  const linksToCheck: { url: string; anchor: string; type: 'internal' | 'external' }[] = [];
  const checkedUrls = new Set<string>();
  let skippedSocial = 0;
  
  // Collect unique links (limit to 30 for performance)
  for (let i = 0; i < links.length && linksToCheck.length < 30; i++) {
    const link = links[i] as Element;
    const href = link.getAttribute('href') || '';
    const anchorText = link.textContent?.trim().substring(0, 50) || '';
    
    // Skip empty, javascript, anchor, mailto, tel links
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || 
        href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('data:')) {
      continue;
    }
    
    try {
      const absoluteUrl = new URL(href, baseUrl).href;
      
      // Skip if already checked
      if (checkedUrls.has(absoluteUrl)) continue;
      checkedUrls.add(absoluteUrl);
      
      // Skip social media domains (auto-whitelist)
      if (isSocialWhitelisted(absoluteUrl)) {
        skippedSocial++;
        continue;
      }
      
      // Skip user-defined false positive domains
      const linkHostname = new URL(absoluteUrl).hostname.toLowerCase();
      if (userWhitelist.has(linkHostname) || [...userWhitelist].some(d => linkHostname.endsWith('.' + d))) {
        skippedSocial++;
        continue;
      }
      
      const linkDomain = new URL(absoluteUrl).hostname;
      const isInternal = linkDomain === baseDomain || linkDomain.endsWith('.' + baseDomain);
      
      linksToCheck.push({
        url: absoluteUrl,
        anchor: anchorText,
        type: isInternal ? 'internal' : 'external'
      });
    } catch {
      // Invalid URL, skip
    }
  }
  
  console.log(`[BrokenLinks] Vérification de ${linksToCheck.length} liens...`);
  
  const brokenLinks: BrokenLink[] = [];
  let corsBlocked = 0;
  
  // Check links in parallel with stealth headers and retry logic
  const checkPromises = linksToCheck.map(async (link) => {
    // Try HEAD first, then GET as fallback (many WAFs block HEAD)
    for (const method of ['HEAD', 'GET'] as const) {
      try {
        const { response } = await stealthFetch(link.url, {
          method,
          timeout: 10_000,
          maxRetries: method === 'HEAD' ? 0 : 1,
        });
        
        // 4xx and 5xx are broken (but not 403 which is often WAF blocking bots)
        if (response.status >= 400 && response.status !== 403) {
          return {
            url: link.url,
            status: response.status,
            anchor: link.anchor,
            type: link.type
          };
        }
        // Success or 403 (WAF) — not broken
        return null;
      } catch (error) {
        // If HEAD failed, try GET
        if (method === 'HEAD') continue;
        
        // Both methods failed — treat as unverifiable, not broken
        corsBlocked++;
        return null;
      }
    }
    return null;
  });
  
  const results = await Promise.all(checkPromises);
  
  for (const result of results) {
    if (result) {
      brokenLinks.push(result);
    }
  }
  
  // Determine verdict
  let verdict: 'optimal' | 'warning' | 'critical';
  if (brokenLinks.length === 0) {
    verdict = 'optimal';
  } else if (brokenLinks.length <= 2) {
    verdict = 'warning';
  } else {
    verdict = 'critical';
  }
  
  console.log(`[BrokenLinks] ✅ ${brokenLinks.length} cassés, ${skippedSocial} réseaux sociaux ignorés, sur ${linksToCheck.length + skippedSocial} liens`);
  
  return {
    total: linksToCheck.length,
    broken: brokenLinks,
    checked: linksToCheck.length,
    corsBlocked,
    skipped_social: skippedSocial,
    verdict
  };
}

// ==================== ROBOTS.TXT ANALYSIS ====================

async function checkRobotsTxt(url: string): Promise<RobotsAnalysis> {
  console.log('[Robots] Vérification robots.txt...');
  
  try {
    const domain = new URL(url).origin;
    const robotsUrl = `${domain}/robots.txt`;
    
    const response = await fetch(robotsUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CrawlersFR/2.0)' }
    });
    
    if (!response.ok) {
      return { 
        exists: false, 
        permissive: true, 
        content: '',
        allowsAIBots: { gptBot: true, claudeBot: true, perplexityBot: true }
      };
    }
    
    const content = await response.text();
    const contentLower = content.toLowerCase();
    
    // Check if robots.txt blocks everything
    const hasDisallowAll = /disallow:\s*\/\s*$/m.test(contentLower) && /user-agent:\s*\*/m.test(contentLower);
    
    // Check AI bot permissions
    const blocksGPTBot = /user-agent:\s*gptbot[\s\S]*?disallow:\s*\//mi.test(content);
    const blocksClaudeBot = /user-agent:\s*claude/mi.test(content) && /disallow:\s*\//mi.test(content);
    const blocksPerplexityBot = /user-agent:\s*perplexitybot[\s\S]*?disallow:\s*\//mi.test(content);
    
    return {
      exists: true,
      permissive: !hasDisallowAll,
      content: content.substring(0, 1000),
      allowsAIBots: {
        gptBot: !blocksGPTBot,
        claudeBot: !blocksClaudeBot,
        perplexityBot: !blocksPerplexityBot
      }
    };
  } catch {
    return { 
      exists: false, 
      permissive: true, 
      content: '',
      allowsAIBots: { gptBot: true, claudeBot: true, perplexityBot: true }
    };
  }
}

// ==================== PAGESPEED & SAFE BROWSING ====================

async function fetchPageSpeedData(url: string): Promise<any | null> {
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=PERFORMANCE&category=SEO&category=BEST_PRACTICES&key=${GOOGLE_API_KEY}`;
  
  // Try up to 2 attempts (initial + 1 retry)
  for (let attempt = 1; attempt <= 2; attempt++) {
    console.log(`[PSI] Tentative ${attempt}/2 — Récupération données PageSpeed...`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      const response = await fetch(apiUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error(`[PSI] Erreur HTTP ${response.status} (tentative ${attempt}):`, error?.error?.message || response.status);
        
        // If rate limited (429), wait before retry
        if (response.status === 429 && attempt < 2) {
          console.log('[PSI] Rate limited, attente 3s avant retry...');
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        if (attempt < 2) continue;
        return null;
      }
      
      const data = await response.json();
      
      // Validate that we actually got lighthouse data
      if (!data?.lighthouseResult?.categories?.performance) {
        console.warn('[PSI] Réponse reçue mais sans données Lighthouse valides');
        if (attempt < 2) continue;
        return null;
      }
      
      console.log('[PSI] ✅ Données PageSpeed récupérées avec succès');
      return data;
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError';
      console.error(`[PSI] ${isAbort ? 'Timeout' : 'Erreur réseau'} (tentative ${attempt}):`, error);
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      return null;
    }
  }
  return null;
}

async function checkSafeBrowsing(url: string): Promise<{ safe: boolean; threats: string[] }> {
  const apiUrl = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${GOOGLE_API_KEY}`;
  
  console.log('[SafeBrowsing] Vérification sécurité...');
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: { clientId: "crawlers-fr", clientVersion: "2.0" },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url }]
        }
      })
    });
    
    if (!response.ok) {
      console.error('[SafeBrowsing] Erreur API:', response.status);
      return { safe: true, threats: [] };
    }
    
    const data = await response.json();
    const threats = data.matches?.map((m: any) => m.threatType) || [];
    
    return { safe: threats.length === 0, threats };
  } catch (error) {
    console.error('[SafeBrowsing] Erreur:', error);
    return { safe: true, threats: [] };
  }
}

// ==================== RECOMMENDATIONS GENERATOR ====================

function generateRecommendations(
  scores: any, 
  htmlAnalysis: HtmlAnalysis, 
  psiData: any,
  insights: ExpertInsights
): RecommendationItem[] {
  const recommendations: RecommendationItem[] = [];
  const audits = psiData?.lighthouseResult?.audits || {};
  
  // === PERFORMANCE RECOMMENDATIONS ===
  const lcpMs = audits['largest-contentful-paint']?.numericValue || 0;
  const lcpSeconds = (lcpMs / 1000).toFixed(1);
  
  if (lcpMs > 2500) {
    recommendations.push({
      id: 'lcp-slow',
      priority: 'critical',
      category: 'performance',
      icon: '🔴',
      title: 'LCP trop lent : contenu principal inaccessible rapidement',
      description: `Votre Largest Contentful Paint (LCP) est de ${lcpSeconds}s, bien au-delà du seuil recommandé de 2.5s.`,
      strengths: ["La page se charge et répond au serveur"],
      weaknesses: [
        `LCP actuel : ${lcpSeconds}s (objectif < 2.5s)`,
        "Les crawlers IA peuvent abandonner avant chargement complet"
      ],
      fixes: [
        "Convertir les images en WebP/AVIF",
        "Implémenter le lazy loading",
        "Activer la compression Brotli",
        "Utiliser un CDN"
      ],
      target_selector: 'performance_lcp',
      target_operation: 'replace',
    });
  }
  
  const tbtMs = audits['total-blocking-time']?.numericValue || 0;
  if (tbtMs > 300) {
    recommendations.push({
      id: 'tbt-high',
      priority: 'critical',
      category: 'performance',
      icon: '🔴',
      title: 'JavaScript bloquant : interactivité dégradée',
      description: `Le TBT de ${Math.round(tbtMs)}ms dépasse le seuil de 200ms.`,
      weaknesses: [`TBT actuel : ${Math.round(tbtMs)}ms (objectif < 200ms)`],
      fixes: ["Code splitting", "Différer les scripts non critiques", "Utiliser SSR"],
      target_selector: 'performance_tbt',
      target_operation: 'replace',
    });
  }
  
  // === CONTENT DENSITY RECOMMENDATION ===
  if (insights.contentDensity.verdict === 'critical' || insights.contentDensity.verdict === 'warning') {
    recommendations.push({
      id: 'thin-content-ratio',
      priority: insights.contentDensity.verdict === 'critical' ? 'critical' : 'important',
      category: 'contenu',
      icon: insights.contentDensity.verdict === 'critical' ? '🔴' : '🟠',
      title: 'Ratio code/texte trop faible (Thin Content)',
      description: `Seulement ${insights.contentDensity.ratio}% du HTML correspond à du texte visible. Les moteurs de recherche et LLM peinent à extraire du contenu pertinent.`,
      weaknesses: [
        `Ratio actuel : ${insights.contentDensity.ratio}% (recommandé > 15%)`,
        `HTML total : ${Math.round(insights.contentDensity.htmlSize / 1024)}KB`,
        `Texte visible : ${Math.round(insights.contentDensity.textSize / 1024)}KB`
      ],
      fixes: [
        "Réduire le JavaScript et CSS inline",
        "Supprimer le code HTML inutile",
        "Enrichir le contenu textuel visible"
      ],
      target_selector: 'content',
      target_operation: 'replace',
    });
  }
  
  // === SEMANTIC CONSISTENCY RECOMMENDATION ===
  if (insights.semanticConsistency.verdict === 'redundant') {
    recommendations.push({
      id: 'semantic-cannibalization',
      priority: 'important',
      category: 'contenu',
      icon: '🟠',
      title: 'Cannibalisation sémantique Title/H1',
      description: insights.semanticConsistency.details,
      weaknesses: [
        `Similarité : ${insights.semanticConsistency.titleH1Similarity}% (Title et H1 identiques)`,
        "Opportunité de mots-clés longue traîne perdue"
      ],
      fixes: [
        "Varier le H1 pour inclure des synonymes ou des variantes",
        "Garder le mot-clé principal dans les deux mais formuler différemment"
      ],
      target_selector: 'h1',
      target_operation: 'replace',
    });
  } else if (insights.semanticConsistency.verdict === 'inconsistent') {
    recommendations.push({
      id: 'semantic-inconsistent',
      priority: 'important',
      category: 'contenu',
      icon: '🟠',
      title: 'Incohérence sémantique Title/H1',
      description: insights.semanticConsistency.details,
      weaknesses: [
        `Similarité : ${insights.semanticConsistency.titleH1Similarity}% seulement`,
        "Les moteurs peuvent confondre le sujet de la page"
      ],
      fixes: [
        "Aligner le H1 sur le sujet principal du Title",
        "S'assurer que les deux traitent du même sujet"
      ],
      target_selector: 'h1',
      target_operation: 'replace',
    });
  }
  
  // === LINK PROFILE RECOMMENDATIONS ===
  if (insights.linkProfile.toxicAnchorsCount > 3) {
    recommendations.push({
      id: 'toxic-anchors',
      priority: 'important',
      category: 'technique',
      icon: '🟠',
      title: 'Ancres de liens génériques détectées',
      description: `${insights.linkProfile.toxicAnchorsCount} liens utilisent des ancres non-descriptives ("cliquez ici", "en savoir plus"). Ces ancres n'apportent aucune valeur SEO.`,
      weaknesses: [
        `Ancres toxiques : ${insights.linkProfile.toxicAnchors.slice(0, 5).join(', ')}`,
        "Aucun contexte sémantique pour les crawlers"
      ],
      fixes: [
        "Remplacer par des ancres descriptives contenant des mots-clés",
        "Exemple : 'Découvrez nos services SEO' au lieu de 'cliquez ici'"
      ],
      target_selector: 'a',
      target_operation: 'replace',
    });
  }
  
  // === JSON-LD RECOMMENDATIONS ===
  if (insights.jsonLdValidation.parseErrors.length > 0) {
    recommendations.push({
      id: 'jsonld-errors',
      priority: 'critical',
      category: 'ia',
      icon: '🔴',
      title: 'Données structurées JSON-LD invalides',
      description: 'Des erreurs de syntaxe JSON ont été détectées. Google et les LLM ne peuvent pas lire ces données.',
      weaknesses: insights.jsonLdValidation.parseErrors,
      fixes: [
        "Valider le JSON avec jsonlint.com",
        "Vérifier les virgules et guillemets manquants",
        "Tester avec Google Rich Results Test"
      ],
      target_selector: 'schema_org',
      target_operation: 'replace',
    });
  } else if (insights.jsonLdValidation.count === 0) {
    recommendations.push({
      id: 'no-schema',
      priority: 'important',
      category: 'ia',
      icon: '🟠',
      title: 'Données structurées absentes',
      description: 'Aucun balisage Schema.org détecté. Les LLM manquent de contexte structuré.',
      fixes: [
        "Implémenter Organization et WebSite au minimum",
        "Ajouter FAQPage pour les sections FAQ"
      ],
      target_selector: 'schema_org',
      target_operation: 'create',
    });
  }

  // === FAQ DETECTION (deux signaux distincts) ===
  // 1) faq_content_present : présence visible de Q/R dans le HTML rendu
  //    On combine plusieurs patterns pour éviter les faux négatifs (sites JS, <details>, listes…)
  //    et les faux positifs (mot "faq" dans une classe CSS ou un lien isolé).
  const rawHtml = htmlAnalysis.rawHtml || '';
  const faqHeadingRegex = /<h[1-6][^>]*>[^<]{0,120}(faq|questions?\s+fr[ée]quentes?|foire\s+aux\s+questions|frequently\s+asked|preguntas\s+frecuentes)[^<]{0,120}<\/h[1-6]>/i;
  const faqDetailsRegex = /<details[^>]*>\s*<summary[^>]*>[\s\S]{1,200}\?[\s\S]{0,200}<\/summary>/i;
  // Heuristique Q/R : au moins 2 questions interrogatives (terminées par "?") dans des balises de heading/strong/dt
  const qaPairCount = (rawHtml.match(/<(?:h[2-6]|strong|dt|p)[^>]*>[^<]{8,180}\?\s*<\/(?:h[2-6]|strong|dt|p)>/gi) || []).length;
  const faqLandmarkRegex = /(?:id|class|role|aria-label)\s*=\s*["'][^"']*\bfaq\b[^"']*["']/i;
  const faqContentPresent =
    faqHeadingRegex.test(rawHtml) ||
    faqDetailsRegex.test(rawHtml) ||
    qaPairCount >= 3 ||
    faqLandmarkRegex.test(rawHtml);

  // 2) faq_schema_present : JSON-LD FAQPage détecté
  const faqSchemaPresent = !!htmlAnalysis.schemaTypes?.some((t: string) => t.toLowerCase().includes('faqpage'));

  // Cas A — contenu visible mais schema absent : prioritaire (P1)
  if (faqContentPresent && !faqSchemaPresent) {
    recommendations.push({
      id: 'faq-content-without-schema',
      priority: 'important',
      category: 'ia',
      icon: '🟠',
      title: 'FAQ présente mais non balisée en FAQPage schema.org',
      description: 'Une section FAQ est détectée dans le HTML, mais sans balisage structuré FAQPage. Les moteurs IA (ChatGPT, Gemini, Perplexity) ne peuvent pas extraire vos Q&R de manière fiable et Google ne peut pas afficher les rich snippets FAQ.',
      fixes: [
        "Ajouter un script JSON-LD de type FAQPage avec mainEntity",
        "Chaque question doit être un objet Question avec acceptedAnswer",
        "Les réponses doivent être complètes (2-4 phrases minimum, pas décoratives)",
        "Valider avec Google Rich Results Test : search.google.com/test/rich-results",
      ],
      target_selector: 'schema_org',
      target_operation: 'create',
    });
  }

  // Cas B — schema présent mais aucun contenu visible : signe d'un balisage orphelin ou rendu JS différé
  if (!faqContentPresent && faqSchemaPresent) {
    recommendations.push({
      id: 'faq-schema-without-content',
      priority: 'important',
      category: 'ia',
      icon: '🟠',
      title: 'Balisage FAQPage présent sans FAQ visible côté HTML',
      description: 'Un schéma FAQPage est déclaré, mais aucune section FAQ n\'a été repérée dans le HTML servi. Cela peut indiquer un balisage orphelin, un contenu rendu uniquement en JavaScript (non vu par les crawlers IA) ou un schéma désynchronisé du contenu réel — ce qui peut être pénalisé par Google.',
      fixes: [
        "Vérifier que les Q/R du JSON-LD apparaissent réellement dans le HTML rendu (SSR ou pré-rendu)",
        "S'assurer que le contenu visible reproduit fidèlement les questions et réponses du schéma",
        "Tester l'URL avec l'outil de test des résultats enrichis Google et l'inspecteur d'URL Search Console",
      ],
      target_selector: 'content',
      target_operation: 'update',
    });
  }

  // Cas C — ni l'un ni l'autre, sur une page suffisamment dense : suggestion d'ajout
  if (!faqContentPresent && !faqSchemaPresent && htmlAnalysis.wordCount > 500) {
    recommendations.push({
      id: 'no-faq-section',
      priority: 'suggestion',
      category: 'ia',
      icon: '💡',
      title: 'Aucune section FAQ détectée (contenu et balisage absents)',
      description: 'Aucun contenu FAQ visible et aucun schéma FAQPage détectés. Les pages sans FAQ structurée perdent un levier de citabilité GEO majeur : les LLM extraient prioritairement les réponses directes aux questions.',
      fixes: [
        "Ajouter une section FAQ avec 3-6 questions réelles (People Also Ask)",
        "Baliser avec FAQPage schema.org pour la citabilité IA",
        "Les questions doivent refléter les recherches utilisateurs réelles",
      ],
      target_selector: 'content',
      target_operation: 'append',
    });
  }
  // Cas D — contenu + schema : tout va bien, aucune reco émise.

  // === BRAND AUTO-CITATION CHECK ===
  const brandName = htmlAnalysis.siteName || htmlAnalysis.domain?.split('.')[0] || '';
  const brandPatterns = [
    new RegExp(`chez\\s+${brandName}`, 'i'),
    new RegExp(`selon\\s+(l'analyse\\s+)?${brandName}`, 'i'),
    new RegExp(`l'équipe\\s+${brandName}`, 'i'),
    new RegExp(`${brandName}\\s+recommande`, 'i'),
    new RegExp(`notre\\s+approche\\s+chez`, 'i'),
  ];
  const hasBrandCitations = brandName.length > 2 && brandPatterns.some(p => p.test(htmlAnalysis.rawHtml || ''));
  if (!hasBrandCitations && htmlAnalysis.wordCount > 300 && !htmlAnalysis.isHomePage) {
    recommendations.push({
      id: 'no-brand-auto-citation',
      priority: 'suggestion',
      category: 'ia',
      icon: '💡',
      title: 'Aucune auto-citation de la marque dans le contenu',
      description: `Les LLM reprennent les formulations de type "Chez ${brandName || '[Marque]'}, notre approche consiste à..." lorsqu'ils citent une source. Intégrer 2-3 auto-citations naturelles renforce la brand entity recognition et la citabilité GEO.`,
      fixes: [
        `Ajouter des formulations comme "Chez ${brandName || '[Marque]'}, notre approche..."`,
        `"L'équipe ${brandName || '[Marque]'} recommande..."`,
        `"Selon l'analyse ${brandName || '[Marque]'}..."`,
        "Les auto-citations doivent être naturelles et informatives, pas forcées"
      ],
      target_selector: 'content',
      target_operation: 'append',
    });
  }

  // === INTRO SUMMARY CHECK (150 words) ===
  if (!htmlAnalysis.isHomePage && htmlAnalysis.wordCount > 500) {
    const introText = (htmlAnalysis.rawHtml || '').replace(/<[^>]+>/g, ' ').substring(0, 1500);
    const introWords = introText.trim().split(/\s+/).slice(0, 150);
    const hasSubstantiveIntro = introWords.length >= 80 && (
      /résumé|en bref|dans cet article|cette page|vous découvrirez|nous expliquons|guide complet|tout savoir/i.test(introWords.join(' ')) ||
      /summary|in this article|this page|you'll learn|we explain|complete guide|everything you need/i.test(introWords.join(' '))
    );
    if (!hasSubstantiveIntro) {
      recommendations.push({
        id: 'no-intro-summary',
        priority: 'suggestion',
        category: 'ia',
        icon: '💡',
        title: 'Pas de résumé éditorial dans les 150 premiers mots',
        description: 'Les LLM extraient prioritairement les premiers paragraphes comme snippet. Un résumé de 100-150 mots en tête de page (contenant le mot-clé principal + nom de la marque + proposition de valeur) maximise la citabilité.',
        fixes: [
          "Ajouter un chapô de 100-150 mots résumant le contenu et l'angle éditorial",
          "Inclure le mot-clé principal naturellement",
          "Mentionner le nom de la marque/entreprise",
          "Formuler la proposition de valeur unique de cette page"
        ],
        target_selector: 'content',
        target_operation: 'prepend',
      });
    }
  }
  
  if (!htmlAnalysis.hasTitle) {
    recommendations.push({
      id: 'no-title',
      priority: 'critical',
      category: 'technique',
      icon: '🔴',
      title: 'Balise Title absente',
      description: 'Aucune balise <title> détectée.',
      fixes: ["Ajouter une balise <title> unique de 50-60 caractères"],
      target_selector: 'title',
      target_operation: 'create',
    });
  }
  
  if (htmlAnalysis.h1Count === 0) {
    recommendations.push({
      id: 'no-h1',
      priority: 'critical',
      category: 'contenu',
      icon: '🔴',
      title: 'Balise H1 absente',
      description: 'Aucune balise H1 détectée.',
      fixes: ["Ajouter exactement une balise <h1> par page"],
      target_selector: 'h1',
      target_operation: 'create',
    });
  }
  
  if (!htmlAnalysis.isHttps) {
    recommendations.push({
      id: 'no-https',
      priority: 'critical',
      category: 'securite',
      icon: '🔴',
      title: 'HTTPS non activé',
      description: 'Le site utilise HTTP non sécurisé.',
      fixes: ["Obtenir un certificat SSL via Let's Encrypt"],
      target_selector: 'ssl_config',
      target_operation: 'replace',
    });
  }
  
  // === BROKEN LINKS RECOMMENDATION ===
  if (insights.brokenLinks && insights.brokenLinks.broken.length > 0) {
    const brokenCount = insights.brokenLinks.broken.length;
    const brokenUrls = insights.brokenLinks.broken.slice(0, 3).map(b => `${b.anchor || b.url.substring(0, 40)} (${b.status || 'timeout'})`);
    
    recommendations.push({
      id: 'broken-links',
      priority: brokenCount > 2 ? 'critical' : 'important',
      category: 'technique',
      icon: brokenCount > 2 ? '🔴' : '🟠',
      title: `${brokenCount} lien${brokenCount > 1 ? 's' : ''} cassé${brokenCount > 1 ? 's' : ''} détecté${brokenCount > 1 ? 's' : ''}`,
      description: `Des liens pointent vers des pages inexistantes (erreur 404/500). Cela nuit à l'expérience utilisateur et au crawl SEO.`,
      weaknesses: [
        `${brokenCount} lien${brokenCount > 1 ? 's' : ''} cassé${brokenCount > 1 ? 's' : ''} sur ${insights.brokenLinks.checked} vérifiés`,
        ...brokenUrls
      ],
      fixes: [
        "Supprimer ou corriger les liens vers les pages inexistantes",
        "Mettre en place des redirections 301 si les pages ont été déplacées",
        "Utiliser un outil de monitoring des liens cassés"
      ],
      target_selector: 'a[href]',
      target_operation: 'replace',
    });
  }
  
  // === HEADING HIERARCHY RECOMMENDATIONS ===
  if (insights.headingHierarchy) {
    const hh = insights.headingHierarchy;
    if (hh.gaps.length > 0) {
      recommendations.push({
        id: 'heading-hierarchy-gaps',
        priority: hh.gaps.length > 2 ? 'critical' : 'important',
        category: 'contenu',
        icon: hh.gaps.length > 2 ? '🔴' : '🟠',
        title: 'Structure Hn cassée : sauts de niveaux détectés',
        description: `La hiérarchie des titres comporte ${hh.gaps.length} saut(s) de niveau. Une page sans hiérarchie Hn claire est une page que Google comprend moins bien que ses concurrents.`,
        weaknesses: [
          ...hh.gaps.slice(0, 4),
          hh.hasMultipleH1 ? `${htmlAnalysis.h1Count} balises H1 détectées (une seule recommandée)` : ''
        ].filter(Boolean),
        fixes: [
          "Utiliser une hiérarchie stricte : H1 → H2 → H3 (sans sauter de niveau)",
          "Ne pas utiliser les balises Hn pour le style visuel — utiliser CSS à la place",
          "Vérifier que le H1 est unique et que chaque section a son propre H2"
        ],
        target_selector: 'h2,h3,h4',
        target_operation: 'replace',
      });
    }
  }
  
  // === SITEMAP / ROBOTS.TXT COHERENCE RECOMMENDATIONS ===
  if (insights.sitemapRobotsCoherence) {
    const src = insights.sitemapRobotsCoherence;
    for (const issue of src.issues) {
      const idMap: Record<string, string> = {
        'noindex_in_sitemap': 'sitemap-noindex-conflict',
        'http_urls_in_sitemap': 'sitemap-http-urls',
        'http_sitemap_on_https': 'sitemap-http-declaration',
        'blocks_rendering_resources': 'robots-blocks-resources',
        'sitemap_not_in_robots': 'sitemap-undeclared',
      };
      const selectorMap: Record<string, string> = {
        'noindex_in_sitemap': 'sitemap_xml',
        'http_urls_in_sitemap': 'sitemap_xml',
        'http_sitemap_on_https': 'sitemap_xml',
        'blocks_rendering_resources': 'robots_txt',
        'sitemap_not_in_robots': 'robots_txt',
      };
      recommendations.push({
        id: idMap[issue.type] || `sitemap-${issue.type}`,
        priority: issue.severity,
        category: 'technique',
        icon: issue.severity === 'critical' ? '🔴' : '🟠',
        title: issue.type === 'noindex_in_sitemap' 
          ? 'Sitemap et robots se contredisent'
          : issue.type === 'blocks_rendering_resources'
          ? 'Robots.txt bloque des ressources de rendu'
          : issue.type === 'http_urls_in_sitemap'
          ? 'URLs HTTP dans le sitemap d\'un site HTTPS'
          : issue.type === 'sitemap_not_in_robots'
          ? 'Sitemap non déclaré dans robots.txt'
          : 'Incohérence sitemap/robots.txt',
        description: issue.description,
        fixes: issue.type === 'noindex_in_sitemap' 
          ? ["Retirer les pages noindex du sitemap.xml", "Ou supprimer la directive noindex si ces pages doivent être indexées"]
          : issue.type === 'blocks_rendering_resources'
          ? ["Retirer les règles Disallow ciblant les fichiers CSS et JS", "Google a besoin de ces ressources pour rendre et comprendre les pages"]
          : issue.type === 'http_urls_in_sitemap'
          ? ["Mettre à jour toutes les URLs du sitemap en HTTPS", "Vérifier que les redirections 301 HTTP→HTTPS sont en place"]
          : issue.type === 'sitemap_not_in_robots'
          ? ["Ajouter 'Sitemap: https://votre-site.com/sitemap.xml' dans robots.txt", "Soumettre le sitemap dans Google Search Console"]
          : ["Corriger l'incohérence entre le sitemap et le robots.txt"],
        target_selector: selectorMap[issue.type] || 'sitemap_xml',
        target_operation: 'replace',
      });
    }
  }
  
  // Sort by priority
  const priorityOrder = { critical: 0, important: 1, optional: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  
  return recommendations;
}

// ==================== AI NARRATIVE GENERATION ====================

async function generateNarrativeIntroduction(
  domain: string,
  url: string,
  totalScore: number,
  scores: any,
  htmlAnalysis: HtmlAnalysis,
  insights: ExpertInsights,
  meta: AuditMeta,
  lang: string = 'fr'
): Promise<{ presentation: string; strengths: string; improvement: string } | null> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) return null;
  
  try {
    console.log('[AI] Génération introduction narrative...');
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { 
            role: 'system', 
            content: `Tu es un consultant SEO senior. Tu dois générer une introduction structurée en 3 paragraphes pour un audit technique SEO Expert. RÈGLE ABSOLUE: Tu DOIS désigner le site analysé EXCLUSIVEMENT par son NOM DE DOMAINE fourni dans le prompt. Ne jamais inventer, déduire ou halluciner un nom de marque ou une description générique. Réponds UNIQUEMENT en JSON valide. LANGUE DE RÉDACTION: ${lang === 'fr' ? 'français' : lang === 'es' ? 'espagnol' : 'anglais'}. Rédige TOUT le contenu dans cette langue.`
          },
          { 
            role: 'user', 
            content: `Analyse pour le site "${domain}" (${url}). ⚠️ Le nom à utiliser dans le texte est "${domain}", jamais un autre nom.

DONNÉES TECHNIQUES:
- Score total: ${totalScore}/200 (Fiabilité audit: ${Math.round(meta.reliabilityScore * 100)}%)
- Mode de rendu: ${meta.renderingMode === 'dynamic_rendered' ? 'JavaScript rendu' : 'Statique'}
- Performance: ${scores.performance.score}/40 (LCP: ${(scores.performance.lcp / 1000).toFixed(1)}s)
- Technique: ${scores.technical.score}/50
- Sémantique: ${scores.semantic.score}/60 (Mots: ${htmlAnalysis.wordCount})
- IA/GEO: ${scores.aiReady.score}/30 (Schema: ${htmlAnalysis.schemaTypes.join(', ') || 'aucun'})

INSIGHTS EXPERTS:
- Ratio code/texte: ${insights.contentDensity.ratio}% (${insights.contentDensity.verdict})
- Cohérence Title/H1: ${insights.semanticConsistency.titleH1Similarity}% (${insights.semanticConsistency.verdict})
- Liens internes: ${insights.linkProfile.internal}, externes: ${insights.linkProfile.external}
- Ancres toxiques: ${insights.linkProfile.toxicAnchorsCount}
- JSON-LD valide: ${insights.jsonLdValidation.valid ? 'Oui' : 'Non'}

Titre: "${htmlAnalysis.titleContent}"
Meta: "${htmlAnalysis.metaDescContent?.substring(0, 100) || 'absente'}"

LANGUE: Rédige en ${lang === 'fr' ? 'français' : lang === 'es' ? 'espagnol' : 'anglais'}.

Réponds avec ce JSON:
{
  "presentation": "Paragraphe 1: Présentation du site, secteur d'activité déduit, zone géo, publics cibles.",
  "strengths": "Paragraphe 2: Un point technique positif ET un point sémantique positif avec contexte concurrentiel.",
  "improvement": "Paragraphe 3: Une donnée moins bonne, sa conséquence technique/SEO/GEO, pourquoi c'est prioritaire."
}`
          }
        ],
        temperature: 0.4,
      }),
    });

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content;
      if (content) {
        let jsonContent = content;
        if (content.includes('```json')) {
          jsonContent = content.split('```json')[1].split('```')[0].trim();
        } else if (content.includes('```')) {
          jsonContent = content.split('```')[1].split('```')[0].trim();
        }
        console.log('[AI] ✅ Introduction générée');
        return JSON.parse(jsonContent);
      }
    }
  } catch (error) {
    console.error('[AI] Erreur génération:', error);
  }
  
  return null;
}

// ==================== MAIN SERVER ====================

Deno.serve(handleRequest(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIp = getClientIp(req);
  const ipCheck = checkIpRate(clientIp, 'audit-expert-seo', 15, 60_000);
  if (!ipCheck.allowed) return rateLimitResponse(corsHeaders, ipCheck.retryAfterMs);

  if (!acquireConcurrency('audit-expert-seo', 40)) return concurrencyResponse(corsHeaders);

  try {
    const { url, lang } = await req.json();
    const outputLang = lang || 'fr';
    
    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validation de base de l'URL
    const trimmedUrl = url.trim();
    if (trimmedUrl.length < 4 || !trimmedUrl.includes('.')) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `URL invalide: "${trimmedUrl}" n'est pas une adresse web valide. Veuillez entrer une URL complète (ex: example.com)`
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Étape 1: Normalisation et résolution de l'URL
    console.log('='.repeat(60));
    console.log('[AUDIT-EXPERT-SEO] Résolution URL pour:', trimmedUrl);
    
    const { url: resolvedUrl, resolved } = await resolveWorkingUrl(trimmedUrl);
    const normalizedUrl = resolvedUrl;
    const domain = extractDomain(normalizedUrl);
    
    console.log(`[AUDIT-EXPERT-SEO] URL résolue: ${normalizedUrl} (résolu automatiquement: ${resolved})`);
    console.log('='.repeat(60));
    
    // Step 2: Smart Fetch with JS fallback
    let smartFetchResult: SmartFetchResult;
    try {
      smartFetchResult = await smartFetch(normalizedUrl);
    } catch (fetchError) {
      console.error('[SmartFetch] Erreur critique:', fetchError);
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Erreur inconnue';
      const isConnectionError = errorMessage.includes('ECONNREFUSED') || 
                                 errorMessage.includes('Connection refused') ||
                                 errorMessage.includes('timeout') ||
                                 errorMessage.includes('abort') ||
                                 errorMessage.includes('ENOTFOUND') ||
                                 errorMessage.includes('getaddrinfo');
      
      // Si la résolution a échoué, essayer une dernière fois avec www
      if (!resolved && !normalizedUrl.includes('www.')) {
        console.log('[SmartFetch] Tentative avec www...');
        const wwwUrl = normalizedUrl.replace('https://', 'https://www.');
        try {
          smartFetchResult = await smartFetch(wwwUrl);
          // Si ça marche, on continue avec cette URL
          console.log('[SmartFetch] ✅ Succès avec www');
        } catch {
          // Échec définitif
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: isConnectionError 
                ? `Site inaccessible: Le serveur de "${domain}" ne répond pas. Vérifiez que l'URL est correcte et que le site est en ligne.`
                : `Impossible d'accéder à "${domain}": ${errorMessage}. Vérifiez l'orthographe de l'URL.` 
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: isConnectionError 
              ? `Site inaccessible: Le serveur de "${domain}" ne répond pas. Vérifiez que l'URL est correcte et que le site est en ligne.`
              : `Impossible d'accéder à "${domain}": ${errorMessage}. Vérifiez l'orthographe de l'URL.` 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Check for blocking error
    if (!smartFetchResult.selfAudit.isReliable && smartFetchResult.selfAudit.reliabilityScore < 0.4) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'RENDERING_REQUIRED',
          message: smartFetchResult.selfAudit.reason,
          meta: {
            scannedAt: new Date().toISOString(),
            renderingMode: smartFetchResult.renderingMode,
            reliabilityScore: smartFetchResult.selfAudit.reliabilityScore,
            blockingError: smartFetchResult.selfAudit.reason
          }
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Step 2: Run all checks in parallel (including broken links)
    const doc = new DOMParser().parseFromString(smartFetchResult.html, 'text/html');
    
    const [psiData, safeBrowsing, robotsAnalysis, brokenLinksAnalysis] = await Promise.all([
      fetchPageSpeedData(normalizedUrl),
      checkSafeBrowsing(normalizedUrl),
      checkRobotsTxt(normalizedUrl),
      doc ? checkBrokenLinks(doc, normalizedUrl) : Promise.resolve({ total: 0, broken: [], checked: 0, corsBlocked: 0, verdict: 'optimal' as const })
    ]);
    
    // Step 2b: Check sitemap/robots.txt coherence (depends on robotsAnalysis)
    const sitemapRobotsCoherence = await checkSitemapRobotsCoherence(normalizedUrl, robotsAnalysis.content, robotsAnalysis.exists);
    
    // Step 3: DOM-based HTML analysis
    const htmlAnalysis = analyzeHtmlWithDOM(smartFetchResult.html, normalizedUrl);
    
    // Gestion gracieuse si PageSpeed a échoué (psiData peut être null)
    const psiAvailable = psiData?.lighthouseResult?.categories?.performance != null;
    const categories = psiData?.lighthouseResult?.categories || {};
    const audits = psiData?.lighthouseResult?.audits || {};
    
    // Calculate scores
    // When PSI is unavailable, give a neutral score (50% of max) instead of 0 to avoid unfair penalization
    const psiPerformance = psiAvailable ? (categories.performance?.score || 0) : null;
    const psiSeo = psiAvailable ? (categories.seo?.score || 0) : null;
    
    const performanceScore = psiPerformance !== null ? Math.round(psiPerformance * 40) : 20; // 50% fallback
    const technicalScore = (psiSeo !== null ? Math.round(psiSeo * 30) : 15) + 20; // 50% of PSI SEO part as fallback
    
    if (!psiAvailable) {
      console.warn('[Audit-Expert-SEO] ⚠️ PSI indisponible — scores Performance et Technique estimés (fallback 50%)');
    }
    
    let semanticScore = 0;
    if (htmlAnalysis.hasTitle && htmlAnalysis.titleLength <= 70) semanticScore += 10;
    if (htmlAnalysis.hasMetaDesc) semanticScore += 10;
    if (htmlAnalysis.h1Count === 1) semanticScore += 20;
    if (htmlAnalysis.wordCount >= 500) semanticScore += 20;
    
    let aiReadyScore = 0;
    if (htmlAnalysis.hasSchemaOrg) {
      aiReadyScore += 15;
      if (htmlAnalysis.insights?.jsonLdValidation?.isJsGenerated) {
        aiReadyScore -= 3;
        console.log('[Audit-Expert-SEO] ⚠️ Schema is JS-generated — AI Ready score penalized (-3)');
      }
    }
    if (robotsAnalysis.exists && robotsAnalysis.permissive) aiReadyScore += 15;
    
    // Bonus/penalty for broken links (affects technical score)
    let brokenLinksBonus = 0;
    if (brokenLinksAnalysis.verdict === 'optimal') {
      brokenLinksBonus = 5; // Bonus for no broken links
    } else if (brokenLinksAnalysis.verdict === 'critical') {
      brokenLinksBonus = -10; // Penalty for many broken links
    } else {
      brokenLinksBonus = -3; // Small penalty for few broken links
    }
    
    let securityScore = 0;
    if (htmlAnalysis.isHttps) securityScore += 10;
    if (safeBrowsing.safe) securityScore += 10;
    
    // Apply reliability factor to total score (with broken links adjustment)
    const rawTotalScore = performanceScore + technicalScore + semanticScore + aiReadyScore + securityScore + brokenLinksBonus;
    const totalScore = Math.round(Math.max(0, rawTotalScore) * smartFetchResult.selfAudit.reliabilityScore);
    
    const scores = {
      performance: {
        score: performanceScore,
        maxScore: 40,
        psiPerformance: psiPerformance !== null ? Math.round(psiPerformance * 100) : null,
        psiUnavailable: !psiAvailable,
        lcp: audits['largest-contentful-paint']?.numericValue || null,
        fcp: audits['first-contentful-paint']?.numericValue || null,
        cls: audits['cumulative-layout-shift']?.numericValue || null,
        tbt: audits['total-blocking-time']?.numericValue || null,
      },
      technical: {
        score: technicalScore + brokenLinksBonus,
        maxScore: 50,
        psiSeo: psiSeo !== null ? Math.round(psiSeo * 100) : null,
        psiUnavailable: !psiAvailable,
        httpStatus: 200,
        isHttps: htmlAnalysis.isHttps,
        brokenLinksCount: brokenLinksAnalysis.broken.length,
        brokenLinksChecked: brokenLinksAnalysis.checked,
      },
      semantic: {
        score: semanticScore,
        maxScore: 60,
        hasTitle: htmlAnalysis.hasTitle,
        titleLength: htmlAnalysis.titleLength,
        hasMetaDesc: htmlAnalysis.hasMetaDesc,
        metaDescLength: htmlAnalysis.metaDescLength,
        hasUniqueH1: htmlAnalysis.h1Count === 1,
        h1Count: htmlAnalysis.h1Count,
        wordCount: htmlAnalysis.wordCount,
      },
      aiReady: {
        score: aiReadyScore,
        maxScore: 30,
        hasSchemaOrg: htmlAnalysis.hasSchemaOrg,
        schemaTypes: htmlAnalysis.schemaTypes,
        hasRobotsTxt: robotsAnalysis.exists,
        robotsPermissive: robotsAnalysis.permissive,
        allowsAIBots: robotsAnalysis.allowsAIBots,
      },
      security: {
        score: securityScore,
        maxScore: 20,
        isHttps: htmlAnalysis.isHttps,
        safeBrowsingOk: safeBrowsing.safe,
        threats: safeBrowsing.threats,
      },
    };
    
    const meta: AuditMeta = {
      scannedAt: new Date().toISOString(),
      renderingMode: smartFetchResult.renderingMode,
      reliabilityScore: smartFetchResult.selfAudit.reliabilityScore,
    };
    
    // Add broken links + sitemap coherence to insights
    const enrichedInsights = {
      ...htmlAnalysis.insights,
      brokenLinks: brokenLinksAnalysis,
      sitemapRobotsCoherence
    };
    
    const recommendations = generateRecommendations(scores, htmlAnalysis, psiData, enrichedInsights);
    
    // Generate AI narrative
    const introduction = await generateNarrativeIntroduction(
      domain, normalizedUrl, totalScore, scores, htmlAnalysis, enrichedInsights, meta, outputLang
    );
    
    console.log('='.repeat(60));
    console.log(`[AUDIT-EXPERT-SEO] ✅ Audit terminé. Score: ${totalScore}/200 (Fiabilité: ${Math.round(meta.reliabilityScore * 100)}%)`);
    console.log('='.repeat(60));
    
    const responseData = {
      success: true,
      data: {
        url: normalizedUrl,
        domain,
        meta,
        totalScore,
        maxScore: 200,
        scores,
        insights: enrichedInsights,
        recommendations,
        introduction,
        rawData: {
          psi: { categories, audits: Object.keys(audits).slice(0, 10) },
          safeBrowsing,
          htmlAnalysis: {
            ...htmlAnalysis,
            insights: undefined // Already in insights field
          },
          robotsAnalysis
        }
      }
    };

    // Save raw audit data (fire-and-forget)
    try {
      const authHeader = req.headers.get('Authorization') || '';
      if (authHeader) {
        const { getUserClient } = await import('../_shared/supabaseClient.ts');
        const sb = getUserClient(authHeader);
        const { data: { user } } = await sb.auth.getUser();
        if (user) {
          saveRawAuditData({
            userId: user.id, url: normalizedUrl, domain,
            auditType: 'technical',
            rawPayload: responseData.data,
            sourceFunctions: ['audit-expert-seo'],
          }).catch(() => {});
        }
      }
    } catch {}

    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[AUDIT-EXPERT-SEO] Erreur:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Audit failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } finally {
    releaseConcurrency('audit-expert-seo');
  }
}, 'audit-expert-seo'))
