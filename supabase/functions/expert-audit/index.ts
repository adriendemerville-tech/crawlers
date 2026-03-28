import { getUserClient } from '../_shared/supabaseClient.ts'
import { trackTokenUsage, trackPaidApiCall, trackEdgeFunctionError } from '../_shared/tokenTracker.ts'
import { assertSafeUrl } from '../_shared/ssrf.ts'
import { fetchAndRenderPage } from '../_shared/renderPage.ts'
import { cacheKey, getCached, setCache, checkRateLimit } from '../_shared/auditCache.ts'
import { trackAnalyzedUrl } from '../_shared/trackUrl.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { checkIpRate, getClientIp, rateLimitResponse, acquireConcurrency, releaseConcurrency, concurrencyResponse } from '../_shared/ipRateLimiter.ts'
import { checkFairUse, getUserContext } from '../_shared/fairUse.ts'
import { getSiteContext } from '../_shared/getSiteContext.ts'

// Mapping des recommandations vers les types de fix pour le générateur de code
const RECOMMENDATION_TO_FIX_MAP: Record<string, { fixType: string | null; category: string }> = {
  'title_too_long': { fixType: 'fix_title', category: 'seo' },
  'missing_title': { fixType: 'fix_title', category: 'seo' },
  'missing_meta_desc': { fixType: 'fix_meta_desc', category: 'seo' },
  'short_meta_desc': { fixType: 'fix_meta_desc', category: 'seo' },
  'multiple_h1': { fixType: 'fix_h1', category: 'seo' },
  'missing_h1': { fixType: 'fix_h1', category: 'seo' },
  'no_schema_org': { fixType: 'fix_jsonld', category: 'seo' },
  'not_https': { fixType: 'fix_https_redirect', category: 'performance' },
  'low_content': { fixType: null, category: 'seo' },
  'performance_critical': { fixType: 'fix_lazy_images', category: 'performance' },
  'robots_restrictive': { fixType: null, category: 'seo' },
};

// Fonction pour générer un résumé promptable
function generatePromptSummary(rec: { id: string; title: string; description: string; priority: string; fixes?: string[] }): string {
  const priorityLabel = rec.priority === 'critical' ? '🔴 CRITIQUE' : rec.priority === 'important' ? '🟠 IMPORTANT' : '🟢 OPTIONNEL';
  const fixesText = rec.fixes && rec.fixes.length > 0 ? ` Actions: ${rec.fixes.slice(0, 2).join('; ')}` : '';
  return `[${priorityLabel}] ${rec.title} - ${rec.description.substring(0, 150)}${fixesText}`;
}

// Fonction pour sauvegarder les recommandations dans le registre
async function saveRecommendationsToRegistry(
  supabaseUrl: string,
  supabaseKey: string,
  authHeader: string,
  domain: string,
  url: string,
  auditType: 'technical' | 'strategic',
  recommendations: Array<{ id: string; title: string; description: string; priority: string; category: string; fixes?: string[] }>
): Promise<void> {
  try {
    // Créer un client avec le token de l'utilisateur
    const supabase = getUserClient(authHeader);
    
    // Récupérer l'utilisateur
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.log('⚠️ Utilisateur non authentifié - registre non mis à jour');
      return;
    }
    
    // Supprimer les anciennes recommandations pour ce domaine/type
    await supabase
      .from('audit_recommendations_registry')
      .delete()
      .eq('user_id', user.id)
      .eq('domain', domain)
      .eq('audit_type', auditType);
    
    // Préparer les nouvelles recommandations
    const registryEntries = recommendations.map(rec => {
      const mapping = RECOMMENDATION_TO_FIX_MAP[rec.id] || { fixType: null, category: rec.category };
      return {
        user_id: user.id,
        domain,
        url,
        audit_type: auditType,
        recommendation_id: rec.id,
        title: rec.title,
        description: rec.description,
        category: rec.category,
        priority: rec.priority,
        fix_type: mapping.fixType,
        fix_data: { fixes: rec.fixes || [] },
        prompt_summary: generatePromptSummary(rec),
        is_resolved: false,
      };
    });
    
    // Insérer les nouvelles recommandations
    const { error: insertError } = await supabase
      .from('audit_recommendations_registry')
      .insert(registryEntries);
    
    if (insertError) {
      console.error('❌ Erreur sauvegarde registre:', insertError);
    } else {
      console.log(`✅ ${registryEntries.length} recommandations sauvegardées dans le registre (${auditType})`);
    }
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde du registre:', error);
  }
}

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_PAGESPEED_API_KEY') || '';

interface HtmlAnalysis {
  hasTitle: boolean;
  titleLength: number;
  titleContent: string;
  hasMetaDesc: boolean;
  metaDescLength: number;
  metaDescContent: string;
  h1Count: number;
  h1Contents: string[];
  wordCount: number;
  hasSchemaOrg: boolean;
  schemaTypes: string[];
  isSchemaJsGenerated?: boolean;
  isMetaJsGenerated?: boolean;
  isHttps: boolean;
  hasGTM?: boolean;
  hasGA4?: boolean;
  imagesTotal?: number;
  imagesMissingAlt?: number;
  // Content freshness
  mostRecentDate?: string | null;
  contentAgeDays?: number | null;
  dateSignalsCount?: number;
  // JS dependency
  isContentJSDependent?: boolean;
  staticWordCount?: number;
  jsContentRatio?: number;
  hasSPAMarkers?: boolean;
  // Schema complexity
  schemaDepth?: number;
  schemaFieldCount?: number;
  schemaHasGraph?: boolean;
  // AI-favored formats
  hasTLDR?: boolean;
  tableCount?: number;
  listCount?: number;
  hasFAQSection?: boolean;
  // Schema entity validation
  schemaEntities?: {
    hasOrganization: boolean;
    hasProduct: boolean;
    hasArticle: boolean;
    hasReview: boolean;
    hasFAQPage: boolean;
    hasWebSite: boolean;
    hasBreadcrumb: boolean;
    hasPerson: boolean;
  };
  // FAQ + FAQPage coupling
  hasFAQWithSchema?: boolean;
  // E-E-A-T signals
  hasAuthorBio?: boolean;
  authorBioCount?: number;
  hasExpertCitations?: boolean;
  expertCitationCount?: number;
  // Data density
  dataDensityScore?: number;
  statisticCount?: number;
  percentageCount?: number;
  // Social / LinkedIn links
  hasSocialLinks?: boolean;
  hasLinkedInLinks?: boolean;
  socialLinksCount?: number;
  linkedInLinksCount?: number;
  // Case studies
  hasCaseStudies?: boolean;
  caseStudySignals?: number;
  // Internal linking (maillage)
  internalLinksCount?: number;
  externalLinksCount?: number;
  totalLinksCount?: number;
  internalLinkRatio?: number;
  uniqueInternalPaths?: number;
  orphanRisk?: boolean; // page has < 3 internal links
  // Misplaced structural tags (outside <head>)
  misplacedHeadTags?: string[];
  // CMS / Platform detection
  detectedCMS?: string | null;
}

interface RobotsAnalysis {
  exists: boolean;
  permissive: boolean;
  content: string;
}

function normalizeUrl(url: string): string {
  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  return normalized;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

async function fetchPageSpeedData(url: string): Promise<any | null> {
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=PERFORMANCE&category=SEO&category=BEST_PRACTICES&key=${GOOGLE_API_KEY}`;
  
  for (let attempt = 1; attempt <= 2; attempt++) {
    console.log(`[PSI] Tentative ${attempt}/2 — Fetching PageSpeed data...`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(apiUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error(`[PSI] Erreur HTTP ${response.status} (tentative ${attempt}):`, error?.error?.message || response.status);
        if (response.status === 429 && attempt < 2) {
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        if (attempt < 2) continue;
        return null;
      }
      
      const data = await response.json();
      if (!data?.lighthouseResult?.categories?.performance) {
        console.warn('[PSI] Réponse sans données Lighthouse valides');
        if (attempt < 2) continue;
        return null;
      }
      
      console.log('[PSI] ✅ Données PageSpeed récupérées');
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
  
  console.log('Checking Safe Browsing...');
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: {
          clientId: "crawlers-fr",
          clientVersion: "1.0"
        },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url }]
        }
      })
    });
    
    if (!response.ok) {
      console.error('Safe Browsing API error:', response.status);
      return { safe: true, threats: [] }; // Assume safe if API fails
    }
    
    const data = await response.json();
    const threats = data.matches?.map((m: any) => m.threatType) || [];
    
    return { safe: threats.length === 0, threats };
  } catch (error) {
    console.error('Safe Browsing check failed:', error);
    return { safe: true, threats: [] };
  }
}

async function analyzeHtml(url: string): Promise<HtmlAnalysis> {
  console.log('Analyzing HTML...');
  assertSafeUrl(url);
  
  try {
    // Use shared rendering utility with SPA/CSR support
    const renderResult = await fetchAndRenderPage(url, { timeout: 15000 });
    let html = renderResult.html;
    
    if (renderResult.usedRendering) {
      console.log(`[analyzeHtml] ✅ Used JS rendering (framework: ${renderResult.framework || 'unknown'})`);
    }
    
    // For response headers, we need a separate HEAD/GET request
    const headResponse = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      redirect: 'follow',
    }).catch(() => null);
    
    // ═══ HSTS DETECTION ═══
    const hstsHeader = headResponse?.headers.get('Strict-Transport-Security') || null;
    const hasHSTS = !!hstsHeader;

    // ═══ CMS / PLATFORM DETECTION ═══
    const detectedCMS = (() => {
      const xPowered = headResponse?.headers.get('X-Powered-By')?.toLowerCase() || '';
      const serverHeader = headResponse?.headers.get('Server')?.toLowerCase() || '';
      const generator = (html.match(/<meta[^>]*name=["']generator["'][^>]*content=["']([^"']*)["']/i) || [])[1] || '';
      const lowerHtml = html.toLowerCase();
      
      if (/wp-content|wp-includes|wordpress/i.test(html) || /wordpress/i.test(generator)) return 'WordPress';
      if (/shopify/i.test(html) || /shopify/i.test(xPowered)) return 'Shopify';
      if (/wix\.com/i.test(html)) return 'Wix';
      if (/squarespace/i.test(html)) return 'Squarespace';
      if (/webflow/i.test(html)) return 'Webflow';
      if (/prestashop/i.test(html) || /prestashop/i.test(generator)) return 'PrestaShop';
      if (/magento|mage/i.test(html) || /magento/i.test(xPowered)) return 'Magento';
      if (/drupal/i.test(html) || /drupal/i.test(generator) || /drupal/i.test(xPowered)) return 'Drupal';
      if (/joomla/i.test(generator) || /joomla/i.test(xPowered)) return 'Joomla';
      if (/ghost/i.test(xPowered) || /ghost/i.test(generator)) return 'Ghost';
      if (/hubspot/i.test(html)) return 'HubSpot';
      if (/typo3/i.test(generator)) return 'TYPO3';
      if (/contentful/i.test(html)) return 'Contentful';
      if (/strapi/i.test(xPowered)) return 'Strapi';
      if (/__NEXT_DATA__/i.test(html)) return 'Next.js';
      if (/__NUXT__/i.test(html)) return 'Nuxt.js';
      if (/gatsby/i.test(html) || /gatsby/i.test(generator)) return 'Gatsby';
      if (/framer/i.test(html)) return 'Framer';
      if (lowerHtml.includes('duda.co')) return 'Duda';
      if (lowerHtml.includes('jimdo')) return 'Jimdo';
      return null;
    })();
    if (detectedCMS) console.log(`[analyzeHtml] 🔧 CMS detected: ${detectedCMS}`);

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const titleContent = titleMatch ? titleMatch[1].trim() : '';
    
    // Extract meta description
    const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) 
      || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
    const metaDescContent = metaDescMatch ? metaDescMatch[1].trim() : '';
    
    // Extract H1 tags (supports nested HTML inside <h1>)
    const h1Matches = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/gi) || [];
    const h1Contents = h1Matches.map(h1 => {
      const content = h1.replace(/<[^>]*>/g, '').trim();
      return content;
    }).filter(c => c.length > 0);
    
    // Count words (simple approximation)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const wordCount = textContent.split(' ').filter(w => w.length > 2).length;
    
    // Check for Schema.org JSON-LD
    const schemaMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
    const schemaTypes: string[] = [];
    
    for (const match of schemaMatches) {
      try {
        const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, '');
        const parsed = JSON.parse(jsonContent);
        if (parsed['@type']) {
          schemaTypes.push(parsed['@type']);
        }
        if (parsed['@graph']) {
          for (const item of parsed['@graph']) {
            if (item['@type']) schemaTypes.push(item['@type']);
          }
        }
      } catch {
        // Invalid JSON-LD
      }
    }

    // Detect if schema is JS-generated
    const isSchemaJsGenerated = (() => {
      const regularScripts = html.match(/<script(?![^>]*type\s*=\s*["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/gi) || [];
      for (const script of regularScripts) {
        const content = script.replace(/<script[^>]*>|<\/script>/gi, '');
        if (
          /application\/ld\+json/i.test(content) ||
          (/@context.*schema\.org/i.test(content) && /JSON\.stringify|createElement|innerHTML|insertAdjacentHTML|appendChild/i.test(content)) ||
          /structured[_-]?data|jsonLd|json_ld|schemaMarkup|schema_markup/i.test(content)
        ) return true;
      }
      if (/window\.__NEXT_DATA__[\s\S]*?@context/i.test(html)) return true;
      if (/nuxt[\s\S]*?jsonld|__NUXT__[\s\S]*?schema/i.test(html)) return true;
      if (/gtm.*application\/ld\+json/i.test(html) || /tagmanager.*schema\.org/i.test(html)) return true;
      return false;
    })();
    if (isSchemaJsGenerated) console.log('[analyzeHtml] ⚠️ Schema/JSON-LD appears to be JS-generated');
    
    // Detect JS-generated title/meta/OG
    const isMetaJsGenerated = (() => {
      const scripts = html.match(/<script(?![^>]*type\s*=\s*["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/gi) || [];
      for (const script of scripts) {
        const c = script.replace(/<script[^>]*>|<\/script>/gi, '');
        if (/document\.title\s*=/i.test(c)) return true;
        if (/querySelector\s*\(\s*['"]meta\[name.*description/i.test(c)) return true;
        if (/createElement\s*\(\s*['"]meta['"]\s*\)[\s\S]{0,200}description/i.test(c)) return true;
        if (/property\s*=\s*['"]og:/i.test(c) && /createElement|setAttribute|innerHTML|appendChild/i.test(c)) return true;
      }
      // Client-only React with Helmet
      const hasHelmet = /react-helmet|helmet-async/i.test(html);
      const hasSSR = /__NEXT_DATA__|__NUXT__|data-server-rendered/i.test(html);
      const hasEmptyRoot = /<div\s+id=["'](root|app)["'][^>]*>\s*<\/div>/i.test(html);
      if (hasHelmet && !hasSSR && hasEmptyRoot) return true;
      return false;
    })();
    if (isMetaJsGenerated) console.log('[analyzeHtml] ⚠️ Title/Meta/OG appears to be JS-generated');

    const hasGTM = /googletagmanager\.com\/gtm\.js/i.test(html) || /GTM-[A-Z0-9]+/i.test(html);
    const hasGA4 = /googletagmanager\.com\/gtag\/js\?id=G-/i.test(html) || /gtag\s*\(\s*['"]config['"]\s*,\s*['"]G-/i.test(html);
    
    // Detect images missing alt text
    // Strip script/style/noscript/template to avoid counting non-visible tags
    const htmlForImages = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
      .replace(/<template[^>]*>[\s\S]*?<\/template>/gi, '');
    // Match <img>, <img/>, data-src lazy images, <picture> source, <amp-img>, <image> (SVG)
    const imgTagRegex = /<(?:img|amp-img|image)\b[^>]*(?:src|data-src|srcset|xlink:href)\s*=\s*[^>]*>/gi;
    const allImages = htmlForImages.match(imgTagRegex) || [];
    // Also count <source> inside <picture> with image srcset (type="image/...")
    const pictureSourceImages = htmlForImages.match(/<source\b[^>]*(?:type\s*=\s*["']image\/[^"']*["']|srcset\s*=\s*["'][^"']+\.(?:webp|avif|png|jpe?g|gif|svg)[^"']*["'])[^>]*>/gi) || [];
    const totalImageElements = allImages.length + pictureSourceImages.length;
    const imagesMissingAlt = allImages.filter(img => {
      // Match alt with non-empty content (quoted or unquoted)
      const hasAlt = /\balt\s*=\s*["'][^"']+["']/i.test(img) || /\balt\s*=\s*[^\s"'>]+/i.test(img);
      return !hasAlt;
    }).length;
    console.log(`[analyzeHtml] 🖼️ Images: ${totalImageElements} total (${allImages.length} img + ${pictureSourceImages.length} picture/source), ${imagesMissingAlt} missing alt`);

    // ═══ CONTENT FRESHNESS DETECTION ═══
    // Check for date signals in meta tags and HTML
    const lastModifiedMeta = html.match(/<meta[^>]*name=["'](?:last-modified|article:modified_time|og:updated_time)["'][^>]*content=["']([^"']*)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["'](?:last-modified|article:modified_time|og:updated_time)["']/i)
      || html.match(/<meta[^>]*property=["'](?:article:modified_time|og:updated_time)["'][^>]*content=["']([^"']*)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["'](?:article:modified_time|og:updated_time)["']/i);
    const publishedMeta = html.match(/<meta[^>]*(?:name|property)=["'](?:article:published_time|og:article:published_time|date|DC\.date)["'][^>]*content=["']([^"']*)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["'](?:article:published_time|date)["']/i);

    // Check dateModified in JSON-LD
    let jsonLdDateModified: string | null = null;
    let jsonLdDatePublished: string | null = null;
    for (const match of schemaMatches) {
      try {
        const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, '');
        const parsed = JSON.parse(jsonContent);
        const items = parsed['@graph'] ? parsed['@graph'] : [parsed];
        for (const item of items) {
          if (item.dateModified) jsonLdDateModified = item.dateModified;
          if (item.datePublished) jsonLdDatePublished = item.datePublished;
        }
      } catch { /* skip */ }
    }

    // Get Last-Modified HTTP header
    const lastModifiedHeader = headResponse?.headers.get('Last-Modified') || null;

    // Determine most recent date signal
    const dateSignals: string[] = [
      lastModifiedMeta?.[1],
      publishedMeta?.[1],
      jsonLdDateModified,
      jsonLdDatePublished,
      lastModifiedHeader,
    ].filter(Boolean) as string[];

    let mostRecentDate: string | null = null;
    let contentAgeDays: number | null = null;
    const now = new Date();
    for (const ds of dateSignals) {
      try {
        const d = new Date(ds);
        if (!isNaN(d.getTime())) {
          if (!mostRecentDate || d > new Date(mostRecentDate)) {
            mostRecentDate = d.toISOString();
            contentAgeDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
          }
        }
      } catch { /* skip */ }
    }

    // ═══ JS-DEPENDENCY DETECTION (Is content readable without JS?) ═══
    // Heuristic: SPA frameworks render into an empty div; check if body has minimal text outside scripts
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyHtml = bodyMatch ? bodyMatch[1] : html;
    const bodyWithoutScripts = bodyHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const staticWordCount = bodyWithoutScripts.split(' ').filter(w => w.length > 2).length;
    // Detect SPA markers
    const hasSPAMarkers = /<div\s+id=["'](app|root|__next|__nuxt)["'][^>]*>\s*<\/div>/i.test(html)
      || /<div\s+id=["'](app|root|__next|__nuxt)["'][^>]*>\s*<noscript/i.test(html);
    const jsContentRatio = wordCount > 0 ? staticWordCount / wordCount : 1;
    const isContentJSDependent = hasSPAMarkers || (staticWordCount < 50 && jsContentRatio < 0.3);

    // ═══ SCHEMA.ORG COMPLEXITY / NESTING ═══
    let schemaDepth = 0;
    let schemaFieldCount = 0;
    let schemaHasGraph = false;
    for (const match of schemaMatches) {
      try {
        const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, '');
        const parsed = JSON.parse(jsonContent);
        if (parsed['@graph']) schemaHasGraph = true;
        const countFields = (obj: any, depth: number): void => {
          if (depth > schemaDepth) schemaDepth = depth;
          if (!obj || typeof obj !== 'object') return;
          if (Array.isArray(obj)) { obj.forEach(i => countFields(i, depth)); return; }
          for (const [k, v] of Object.entries(obj)) {
            schemaFieldCount++;
            if (typeof v === 'object' && v !== null) countFields(v, depth + 1);
          }
        };
        countFields(parsed, 0);
      } catch { /* skip */ }
    }

    // ═══ AI-FAVORED FORMATS DETECTION ═══
    // TL;DR / Summary at top
    const hasTLDR = /tl;?dr|résumé|en bref|key takeaway|points clés/i.test(
      html.substring(0, Math.min(html.length, html.indexOf('</body>') > 0 ? html.indexOf('</body>') : html.length)).substring(0, 5000)
    );
    // Tables
    const tableCount = (html.match(/<table[\s>]/gi) || []).length;
    // Bullet lists
    const ulCount = (html.match(/<ul[\s>]/gi) || []).length;
    const olCount = (html.match(/<ol[\s>]/gi) || []).length;
    const listCount = ulCount + olCount;
    // FAQ sections (common patterns)
    const hasFAQSection = /faq|questions? fréquentes|frequently asked/i.test(html);

    // ═══ SCHEMA ENTITY VALIDATION (Enhanced) ═══
    const schemaEntities = {
      hasOrganization: schemaTypes.some(t => /organization/i.test(t)),
      hasProduct: schemaTypes.some(t => /product/i.test(t)),
      hasArticle: schemaTypes.some(t => /article|blogposting|newsarticle/i.test(t)),
      hasReview: schemaTypes.some(t => /review/i.test(t)),
      hasFAQPage: schemaTypes.some(t => /faqpage/i.test(t)),
      hasWebSite: schemaTypes.some(t => /website/i.test(t)),
      hasBreadcrumb: schemaTypes.some(t => /breadcrumb/i.test(t)),
      hasPerson: schemaTypes.some(t => /person/i.test(t)),
      hasProfilePage: schemaTypes.some(t => /profilepage/i.test(t)),
      hasAuthor: false, // set below
    };

    // ═══ sameAs / WIKIDATA / AUTHOR DETECTION IN JSON-LD ═══
    let hasSameAs = false;
    let hasWikidataSameAs = false;
    let hasAuthorInJsonLd = false;
    for (const match of schemaMatches) {
      try {
        const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, '');
        const parsed = JSON.parse(jsonContent);
        const checkNode = (node: any): void => {
          if (!node || typeof node !== 'object') return;
          if (Array.isArray(node)) { node.forEach(checkNode); return; }
          if (node.sameAs) {
            hasSameAs = true;
            const sameAsArr = Array.isArray(node.sameAs) ? node.sameAs : [node.sameAs];
            if (sameAsArr.some((s: string) => typeof s === 'string' && /wikidata\.org/i.test(s))) {
              hasWikidataSameAs = true;
            }
          }
          if (node.author || node['@type'] === 'Author') {
            hasAuthorInJsonLd = true;
          }
          if (node['@graph']) checkNode(node['@graph']);
          for (const k in node) {
            if (k !== '@graph' && node[k] && typeof node[k] === 'object') checkNode(node[k]);
          }
        };
        checkNode(parsed);
      } catch { /* skip */ }
    }
    schemaEntities.hasAuthor = hasAuthorInJsonLd;

    // FAQ + FAQPage coupling check
    const hasFAQWithSchema = hasFAQSection && schemaEntities.hasFAQPage;

    // ═══ E-E-A-T SIGNALS ═══
    // Author bios: look for common patterns
    const authorPatterns = [
      /(?:author|auteur|écrit par|rédigé par|by)\s*[:：]?\s*[A-ZÀ-Ü][a-zà-ü]+/gi,
      /<[^>]*class=["'][^"']*(?:author|auteur|bio|expert)[^"']*["'][^>]*>/gi,
      /itemprop=["']author["']/gi,
    ];
    let authorBioCount = 0;
    for (const pattern of authorPatterns) {
      const matches = html.match(pattern) || [];
      authorBioCount += matches.length;
    }
    const hasAuthorBio = authorBioCount > 0;

    // Expert citations: quotes, expert names, study references
    const expertCitationPatterns = [
      /(?:selon|d'après|affirme|explique|déclare)\s+[A-ZÀ-Ü][a-zà-ü]+\s+[A-ZÀ-Ü][a-zà-ü]+/gi,
      /(?:according to|says|explains|notes)\s+[A-Z][a-z]+\s+[A-Z][a-z]+/gi,
      /<blockquote[^>]*>/gi,
      /(?:étude|study|research|rapport|report)\s+(?:de|by|from|du|publiée?)/gi,
    ];
    let expertCitationCount = 0;
    for (const pattern of expertCitationPatterns) {
      const matches = textContent.match(pattern) || [];
      expertCitationCount += matches.length;
    }
    const hasExpertCitations = expertCitationCount > 0;

    // ═══ DATA DENSITY (statistics, percentages, numbers) ═══
    const percentageMatches = textContent.match(/\d+[\.,]?\d*\s*%/g) || [];
    const percentageCount = percentageMatches.length;
    const statisticPatterns = [
      /\d+[\s ]?(?:millions?|milliards?|billion|million|k€|M€|k\$|M\$)/gi,
      /(?:×|x)\s*\d+/gi,
      /\+\s*\d+[\.,]?\d*\s*%/gi,
      /\d+[\.,]?\d*\s*(?:fois|times)/gi,
      /(?:de|from)\s+\d+\s+(?:à|to)\s+\d+/gi,
    ];
    let statisticCount = percentageCount;
    for (const pattern of statisticPatterns) {
      const matches = textContent.match(pattern) || [];
      statisticCount += matches.length;
    }
    // Score: 0-100, based on data points per 500 words
    const dataDensityScore = Math.min(100, Math.round((statisticCount / Math.max(1, wordCount / 500)) * 25));

    // ═══ SOCIAL / LINKEDIN LINKS ═══
    const socialLinkPatterns = [
      /href=["'][^"']*linkedin\.com[^"']*["']/gi,
      /href=["'][^"']*twitter\.com[^"']*["']/gi,
      /href=["'][^"']*x\.com[^"']*["']/gi,
      /href=["'][^"']*facebook\.com[^"']*["']/gi,
      /href=["'][^"']*youtube\.com[^"']*["']/gi,
      /href=["'][^"']*instagram\.com[^"']*["']/gi,
    ];
    let socialLinksCount = 0;
    for (const pattern of socialLinkPatterns) {
      socialLinksCount += (html.match(pattern) || []).length;
    }
    const linkedInLinks = html.match(/href=["'][^"']*linkedin\.com\/(?:in|company)\/[^"']*["']/gi) || [];
    const linkedInLinksCount = linkedInLinks.length;
    const hasSocialLinks = socialLinksCount > 0;
    const hasLinkedInLinks = linkedInLinksCount > 0;

    // ═══ INTERNAL LINKING (MAILLAGE) ═══
    const allHrefs = html.match(/<a\s[^>]*href=["']([^"'#]*?)["'][^>]*>/gi) || [];
    let internalLinksCount = 0;
    let externalLinksCount = 0;
    const internalPathsSet = new Set<string>();
    const pageDomain = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
    for (const tag of allHrefs) {
      const hrefMatch = tag.match(/href=["']([^"'#]*?)["']/i);
      if (!hrefMatch || !hrefMatch[1]) continue;
      const href = hrefMatch[1].trim();
      if (!href || href === '/' || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
      if (href.startsWith('/') || href.startsWith('#')) {
        internalLinksCount++;
        internalPathsSet.add(href.split('?')[0].split('#')[0]);
      } else {
        try {
          const linkHost = new URL(href).hostname.replace(/^www\./, '');
          if (linkHost === pageDomain) {
            internalLinksCount++;
            internalPathsSet.add(new URL(href).pathname);
          } else {
            externalLinksCount++;
          }
        } catch {
          externalLinksCount++;
        }
      }
    }
    const totalLinksCount = internalLinksCount + externalLinksCount;
    const internalLinkRatio = totalLinksCount > 0 ? Math.round((internalLinksCount / totalLinksCount) * 100) : 0;
    const uniqueInternalPaths = internalPathsSet.size;
    const orphanRisk = internalLinksCount < 3;

    // ═══ CASE STUDIES DETECTION ═══
    const caseStudyPatterns = [
      /(?:étude[s]?\s+de\s+cas|case\s+stud(?:y|ies))/gi,
      /(?:résultat[s]?\s+client|client\s+result|success\s+stor(?:y|ies)|témoignage[s]?\s+client)/gi,
      /(?:avant[\s\/]+après|before[\s\/]+after)/gi,
      /(?:ROI|retour sur investissement)\s*[:：]?\s*[\+]?\d/gi,
    ];
    let caseStudySignals = 0;
    for (const pattern of caseStudyPatterns) {
      caseStudySignals += (textContent.match(pattern) || []).length;
    }
    const hasCaseStudies = caseStudySignals > 0;

    return {
      hasTitle: titleContent.length > 0,
      titleLength: titleContent.length,
      titleContent,
      hasMetaDesc: metaDescContent.length > 0,
      metaDescLength: metaDescContent.length,
      metaDescContent,
      h1Count: h1Contents.length,
      h1Contents,
      wordCount,
      hasSchemaOrg: schemaTypes.length > 0,
      schemaTypes,
      isSchemaJsGenerated,
      isMetaJsGenerated,
      isHttps: url.startsWith('https://'),
      hasGTM,
      hasGA4,
      imagesTotal: totalImageElements,
      imagesMissingAlt,
      // Content freshness
      mostRecentDate,
      contentAgeDays,
      dateSignalsCount: dateSignals.length,
      // JS dependency
      isContentJSDependent,
      staticWordCount,
      jsContentRatio: Math.round(jsContentRatio * 100) / 100,
      hasSPAMarkers,
      // Schema complexity
      schemaDepth,
      schemaFieldCount,
      schemaHasGraph,
      // AI-favored formats
      hasTLDR,
      tableCount,
      listCount,
      hasFAQSection,
      // Schema entities
      schemaEntities,
      hasFAQWithSchema,
      // E-E-A-T
      hasAuthorBio,
      authorBioCount,
      hasExpertCitations,
      expertCitationCount,
      // Data density
      dataDensityScore,
      statisticCount,
      percentageCount,
      // Social links
      hasSocialLinks,
      hasLinkedInLinks,
      socialLinksCount,
      linkedInLinksCount,
      // Case studies
      // HSTS
      hasHSTS,
      // Schema enhanced
      hasSameAs,
      hasWikidataSameAs,
      hasAuthorInJsonLd,
      hasCaseStudies,
      caseStudySignals,
      // Internal linking (maillage)
      internalLinksCount,
      externalLinksCount,
      totalLinksCount,
      internalLinkRatio,
      uniqueInternalPaths,
      orphanRisk,
      // ═══ MISPLACED STRUCTURAL TAGS DETECTION ═══
      misplacedHeadTags: (() => {
        const misplaced: string[] = [];
        const bodyMatch2 = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        const bodyContent = bodyMatch2 ? bodyMatch2[1] : '';
        if (/<link[^>]*rel=["']canonical["'][^>]*>/i.test(bodyContent)) misplaced.push('canonical');
        if (/<meta[^>]*name=["']robots["'][^>]*>/i.test(bodyContent)) misplaced.push('robots');
        if (/<link[^>]*hreflang[^>]*>/i.test(bodyContent)) misplaced.push('hreflang');
        return misplaced;
      })(),
      // ═══ DARK SOCIAL READINESS ═══
      ...(() => {
        try {
          const ogTitle = (html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i) || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["']/i) || [])[1] || '';
          const ogDesc = (html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i) || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i) || [])[1] || '';
          const ogImage = (html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i) || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:image["']/i) || [])[1] || '';
          const twitterCard = (html.match(/<meta[^>]*name=["']twitter:card["'][^>]*content=["']([^"']*)["']/i) || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']twitter:card["']/i) || [])[1] || '';

          let darkSocialScore = 0;
          if (ogTitle) darkSocialScore += 30;
          if (ogDesc) darkSocialScore += 30;
          if (ogImage) {
            let imgScore = 40;
            if (!/\.(jpg|jpeg|png|webp|gif|svg)/i.test(ogImage)) imgScore = 20;
            darkSocialScore += imgScore;
          }

          return {
            darkSocial: {
              ogTitle,
              ogDescription: ogDesc,
              ogImage,
              twitterCard,
              score: darkSocialScore,
            },
          };
        } catch { return { darkSocial: { ogTitle: '', ogDescription: '', ogImage: '', twitterCard: '', score: 0 } }; }
      })(),
      // ═══ FRESHNESS SIGNALS (Preuve de Vie) ═══
      ...(() => {
        try {
          const lastModHeader = headResponse?.headers.get('Last-Modified') || null;
          const revisedMeta = (html.match(/<meta[^>]*name=["']revised["'][^>]*content=["']([^"']*)["']/i) || [])[1] || null;
          
          let freshnessScore = 0;
          let freshnessLabel: 'fresh' | 'acceptable' | 'stale' = 'stale';
          let lastModifiedDate: string | null = null;

          // Check Last-Modified or revised meta
          const dateStr = lastModHeader || revisedMeta || mostRecentDate;
          if (dateStr) {
            try {
              const d = new Date(dateStr);
              if (!isNaN(d.getTime())) {
                lastModifiedDate = d.toISOString();
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                if (d >= sixMonthsAgo) freshnessScore += 50;
              }
            } catch {}
          }

          // Check for current year in body text
          const currentYear = new Date().getFullYear().toString();
          const prevYear = (new Date().getFullYear() - 1).toString();
          const hasCurrentYear = textContent.includes(currentYear) || textContent.includes(prevYear);
          if (hasCurrentYear) freshnessScore += 50;

          if (freshnessScore >= 80) freshnessLabel = 'fresh';
          else if (freshnessScore >= 50) freshnessLabel = 'acceptable';

          return {
            freshnessSignals: {
              score: freshnessScore,
              label: freshnessLabel,
              lastModifiedDate,
              hasCurrentYearMention: hasCurrentYear,
              currentYearFound: hasCurrentYear ? currentYear : null,
            },
          };
        } catch { return { freshnessSignals: { score: 0, label: 'stale' as const, lastModifiedDate: null, hasCurrentYearMention: false, currentYearFound: null } }; }
      })(),
      // ═══ CONVERSION FRICTION ANALYSIS ═══
      ...(() => {
        try {
          const formMatches = html.match(/<form[\s>]/gi) || [];
          const formsCount = formMatches.length;

          // Count visible inputs (exclude hidden)
          const inputMatches = html.match(/<input[^>]*>/gi) || [];
          const visibleInputs = inputMatches.filter(inp => !/type\s*=\s*["']hidden["']/i.test(inp)).length;

          const avgFieldsPerForm = formsCount > 0 ? Math.round(visibleInputs / formsCount) : 0;

          // CTA detection
          const ctaPatterns = [
            /<a[^>]*class=["'][^"']*\b(?:btn|button|cta)\b[^"']*["'][^>]*>/gi,
            /<button[^>]*>/gi,
            /type\s*=\s*["']submit["']/gi,
          ];
          let ctaCount = 0;
          for (const p of ctaPatterns) ctaCount += (html.match(p) || []).length;

          // Check CTA above fold (first 20% of body)
          const bodyLen = bodyHtml.length;
          const foldZone = bodyHtml.substring(0, Math.floor(bodyLen * 0.2));
          const ctaAboveFold = /<(?:a|button)[^>]*class=["'][^"']*\b(?:btn|button|cta|submit)\b[^"']*["'][^>]*>/i.test(foldZone) || /type\s*=\s*["']submit["']/i.test(foldZone);

          let frictionLevel: 'low' | 'optimal' | 'high' = 'optimal';
          if (formsCount > 0 && avgFieldsPerForm > 5) frictionLevel = 'high';
          else if (formsCount === 0 && ctaCount === 0) frictionLevel = 'low';

          return {
            conversionFriction: {
              formsCount,
              visibleInputs,
              avgFieldsPerForm,
              ctaCount,
              ctaAboveFold,
              frictionLevel,
            },
          };
        } catch { return { conversionFriction: { formsCount: 0, visibleInputs: 0, avgFieldsPerForm: 0, ctaCount: 0, ctaAboveFold: false, frictionLevel: 'low' as const } }; }
      })(),
    };
  } catch (error) {
    console.error('HTML analysis failed:', error);
    return {
      hasTitle: false,
      titleLength: 0,
      titleContent: '',
      hasMetaDesc: false,
      metaDescLength: 0,
      metaDescContent: '',
      h1Count: 0,
      h1Contents: [],
      wordCount: 0,
      hasSchemaOrg: false,
      schemaTypes: [],
      isHttps: url.startsWith('https://'),
      hasGTM: false,
      hasGA4: false,
      imagesTotal: 0,
      imagesMissingAlt: 0,
      mostRecentDate: null,
      contentAgeDays: null,
      dateSignalsCount: 0,
      isContentJSDependent: false,
      staticWordCount: 0,
      jsContentRatio: 1,
      hasSPAMarkers: false,
      schemaDepth: 0,
      schemaFieldCount: 0,
      schemaHasGraph: false,
      hasTLDR: false,
      tableCount: 0,
      listCount: 0,
      hasFAQSection: false,
      schemaEntities: { hasOrganization: false, hasProduct: false, hasArticle: false, hasReview: false, hasFAQPage: false, hasWebSite: false, hasBreadcrumb: false, hasPerson: false, hasProfilePage: false, hasAuthor: false },
      hasFAQWithSchema: false,
      hasAuthorBio: false,
      authorBioCount: 0,
      hasExpertCitations: false,
      expertCitationCount: 0,
      dataDensityScore: 0,
      statisticCount: 0,
      percentageCount: 0,
      hasSocialLinks: false,
      hasLinkedInLinks: false,
      socialLinksCount: 0,
      linkedInLinksCount: 0,
      hasHSTS: false,
      hasSameAs: false,
      hasWikidataSameAs: false,
      hasAuthorInJsonLd: false,
      hasCaseStudies: false,
      caseStudySignals: 0,
      internalLinksCount: 0,
      externalLinksCount: 0,
      totalLinksCount: 0,
      internalLinkRatio: 0,
      uniqueInternalPaths: 0,
      orphanRisk: true,
      misplacedHeadTags: [],
      darkSocial: { ogTitle: '', ogDescription: '', ogImage: '', twitterCard: '', score: 0 },
      freshnessSignals: { score: 0, label: 'stale' as const, lastModifiedDate: null, hasCurrentYearMention: false, currentYearFound: null },
      conversionFriction: { formsCount: 0, visibleInputs: 0, avgFieldsPerForm: 0, ctaCount: 0, ctaAboveFold: false, frictionLevel: 'low' as const },
    };
  }
}

async function checkRobotsTxt(url: string): Promise<RobotsAnalysis> {
  console.log('Checking robots.txt...');
  
  try {
    const domain = new URL(url).origin;
    const robotsUrl = `${domain}/robots.txt`;
    
    const response = await fetch(robotsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CrawlersFR/1.0)'
      }
    });
    
    if (!response.ok) {
      return { exists: false, permissive: true, content: '' };
    }
    
    const content = await response.text();
    
    // Check if robots.txt blocks everything
    const hasDisallowAll = /Disallow:\s*\/\s*$/m.test(content) && /User-agent:\s*\*/m.test(content);
    
    return {
      exists: true,
      permissive: !hasDisallowAll,
      content: content.substring(0, 500)
    };
  } catch {
    return { exists: false, permissive: true, content: '' };
  }
}

// ═══ LLMS.TXT CHECK ═══
interface LlmsTxtAnalysis {
  exists: boolean;
  contentLength: number;
  hasStructuredFormat: boolean;
}

async function checkLlmsTxt(url: string): Promise<LlmsTxtAnalysis> {
  console.log('Checking llms.txt...');
  try {
    const origin = new URL(url).origin;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${origin}/llms.txt`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CrawlersFR/1.0)' }
    });
    clearTimeout(timeoutId);
    if (!response.ok) return { exists: false, contentLength: 0, hasStructuredFormat: false };
    const content = await response.text();
    // Check for structured formatting (headings, sections)
    const hasStructuredFormat = /^#\s/m.test(content) || /^\*\*/m.test(content) || content.includes('## ');
    return { exists: true, contentLength: content.length, hasStructuredFormat };
  } catch {
    return { exists: false, contentLength: 0, hasStructuredFormat: false };
  }
}

// ═══ IMAGE/VIDEO SITEMAP CHECK ═══
interface SpecializedSitemapAnalysis {
  hasImageSitemap: boolean;
  hasVideoSitemap: boolean;
}

async function checkSpecializedSitemaps(url: string): Promise<SpecializedSitemapAnalysis> {
  console.log('Checking specialized sitemaps...');
  const origin = new URL(url).origin;
  const results = { hasImageSitemap: false, hasVideoSitemap: false };

  // Check common paths for image/video sitemaps
  const checks = [
    { paths: ['/image-sitemap.xml', '/sitemap-image.xml', '/sitemap_image.xml'], key: 'hasImageSitemap' as const },
    { paths: ['/video-sitemap.xml', '/sitemap-video.xml', '/sitemap_video.xml'], key: 'hasVideoSitemap' as const },
  ];

  // Also check main sitemap for image/video namespace
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5000);
    const mainResp = await fetch(`${origin}/sitemap.xml`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CrawlersFR/1.0)' }
    });
    if (mainResp.ok) {
      const content = await mainResp.text();
      if (/xmlns:image/i.test(content) || /<image:loc>/i.test(content)) results.hasImageSitemap = true;
      if (/xmlns:video/i.test(content) || /<video:content_loc>/i.test(content)) results.hasVideoSitemap = true;
    }
  } catch { /* skip */ }

  // Check dedicated sitemap files
  for (const check of checks) {
    if (results[check.key]) continue; // already found in main sitemap
    for (const path of check.paths) {
      try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 3000);
        const resp = await fetch(`${origin}${path}`, {
          method: 'HEAD',
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CrawlersFR/1.0)' }
        });
        if (resp.ok) { results[check.key] = true; break; }
      } catch { /* skip */ }
    }
  }

  return results;
}

interface SitemapAnalysis {
  exists: boolean;
  urlCount: number;
  containsMainUrl: boolean;
}

async function checkSitemap(url: string): Promise<SitemapAnalysis> {
  console.log('Checking sitemap.xml...');
  
  try {
    const origin = new URL(url).origin;
    const normalizedPath = new URL(url).pathname;
    const sitemapUrl = `${origin}/sitemap.xml`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(sitemapUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CrawlersFR/1.0)' }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return { exists: false, urlCount: 0, containsMainUrl: false };
    }
    
    const content = await response.text();
    const locMatches = content.match(/<loc>[^<]+<\/loc>/gi) || [];
    const urls = locMatches.map(m => m.replace(/<\/?loc>/gi, '').trim());
    
    // Check if the analyzed URL (or its path) is in the sitemap
    const containsMainUrl = urls.some(u => {
      try {
        const sitemapPath = new URL(u).pathname;
        return sitemapPath === normalizedPath || u === url;
      } catch { return false; }
    });
    
    return {
      exists: true,
      urlCount: urls.length,
      containsMainUrl,
    };
  } catch {
    return { exists: false, urlCount: 0, containsMainUrl: false };
  }
}

interface CrawlersResult {
  bots: Array<{
    name: string;
    userAgent: string;
    company: string;
    status: 'allowed' | 'blocked' | 'unknown';
    reason?: string;
    blockSource?: 'robots.txt' | 'meta-tag' | 'http-status';
    lineNumber?: number;
  }>;
  allowsAIBots: {
    gptBot: boolean;
    claudeBot: boolean;
    perplexityBot: boolean;
    googleExtended: boolean;
    appleBotExtended: boolean;
    ccBot: boolean;
  };
  allowedCount: number;
  blockedCount: number;
}

async function checkCrawlers(url: string): Promise<CrawlersResult | null> {
  console.log('Checking AI crawlers...');
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase configuration for crawlers check');
      return null;
    }
    
    const response = await fetch(`${supabaseUrl}/functions/v1/check-crawlers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });
    
    if (!response.ok) {
      console.error('Crawlers check failed:', response.status);
      return null;
    }
    
    const result = await response.json();
    
    if (!result.success || !result.data?.bots) {
      console.error('Invalid crawlers response:', result.error);
      return null;
    }
    
    const bots = result.data.bots;
    
    // Extract individual bot status
    const getBotStatus = (name: string) => {
      const bot = bots.find((b: { name: string }) => b.name === name);
      return bot?.status === 'allowed';
    };
    
    const allowsAIBots = {
      gptBot: getBotStatus('GPTBot'),
      claudeBot: getBotStatus('ClaudeBot'),
      perplexityBot: getBotStatus('PerplexityBot'),
      googleExtended: getBotStatus('Google-Extended'),
      appleBotExtended: getBotStatus('Applebot-Extended'),
      ccBot: getBotStatus('CCBot'),
    };
    
    const allowedCount = bots.filter((b: { status: string }) => b.status === 'allowed').length;
    const blockedCount = bots.filter((b: { status: string }) => b.status === 'blocked').length;
    
    console.log(`AI Crawlers check complete: ${allowedCount} allowed, ${blockedCount} blocked`);
    
    return {
      bots,
      allowsAIBots,
      allowedCount,
      blockedCount,
    };
  } catch (error) {
    console.error('Error checking crawlers:', error);
    return null;
  }
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
}

function generateRecommendations(scores: any, htmlAnalysis: HtmlAnalysis, psiData: any, crawlersResult?: any, sitemapAnalysis?: SitemapAnalysis, llmsTxtAnalysis?: LlmsTxtAnalysis, specializedSitemaps?: SpecializedSitemapAnalysis): RecommendationItem[] {
  const recommendations: RecommendationItem[] = [];
  const audits = psiData?.lighthouseResult?.audits || {};
  
  // Performance recommendations
  const lcpMs = audits['largest-contentful-paint']?.numericValue || 0;
  const lcpSeconds = (lcpMs / 1000).toFixed(1);
  
  if (lcpMs > 2500) {
    recommendations.push({
      id: 'lcp-slow',
      priority: 'critical',
      category: 'performance',
      icon: '🔴',
      title: 'LCP trop lent : contenu principal inaccessible rapidement',
      description: `Votre Largest Contentful Paint (LCP) est de ${lcpSeconds}s, bien au-delà du seuil recommandé de 2.5s. Cela signifie que vos visiteurs attendent trop longtemps avant de voir le contenu principal, ce qui augmente significativement le taux de rebond et pénalise votre référencement Google.`,
      strengths: [
        "La page se charge et répond au serveur",
        "Le contenu est accessible après chargement complet"
      ],
      weaknesses: [
        `LCP actuel : ${lcpSeconds}s (objectif < 2.5s)`,
        "Les utilisateurs mobiles sont particulièrement impactés (connexions plus lentes)",
        "Google utilise le LCP comme facteur de classement Core Web Vitals",
        "Les crawlers IA (GPTBot, ClaudeBot) peuvent abandonner avant chargement complet"
      ],
      fixes: [
        "Convertir toutes les images en format WebP ou AVIF (gain moyen 30-50% de taille)",
        "Implémenter le lazy loading sur les images sous la ligne de flottaison avec loading='lazy'",
        "Activer la compression Brotli côté serveur (meilleure que Gzip)",
        "Optimiser le TTFB en utilisant un CDN (Cloudflare, Fastly) et le caching HTTP",
        "Précharger les ressources critiques avec <link rel='preload'> pour fonts et hero images",
        "Réduire les requêtes bloquantes en différant les CSS non critiques"
      ]
    });
  } else if (lcpMs <= 2500) {
    // Add as strength context for other recommendations
  }
  
  const tbtMs = audits['total-blocking-time']?.numericValue || 0;
  if (tbtMs > 300) {
    recommendations.push({
      id: 'tbt-high',
      priority: 'critical',
      category: 'performance',
      icon: '🔴',
      title: 'JavaScript bloquant : interactivité dégradée',
      description: `Le Total Blocking Time (TBT) de ${Math.round(tbtMs)}ms dépasse largement le seuil de 200ms. Le thread principal est monopolisé par des scripts JavaScript, empêchant toute interaction utilisateur pendant ce temps.`,
      strengths: [
        "Le JavaScript est exécuté correctement",
        "Les fonctionnalités interactives finissent par se charger"
      ],
      weaknesses: [
        `TBT actuel : ${Math.round(tbtMs)}ms (objectif < 200ms)`,
        "L'interface semble 'gelée' pendant le chargement",
        "Impact négatif sur le score Performance de Lighthouse",
        "Les utilisateurs impatients quittent avant l'interactivité complète"
      ],
      fixes: [
        "Diviser le bundle JavaScript en chunks avec code splitting (React.lazy, dynamic imports)",
        "Différer les scripts non critiques avec les attributs defer ou async",
        "Supprimer ou remplacer les bibliothèques JavaScript lourdes (moment.js → date-fns)",
        "Utiliser le tree-shaking pour éliminer le code mort",
        "Déplacer les scripts analytics et third-party en chargement asynchrone",
        "Implémenter le Server-Side Rendering (SSR) pour le contenu critique"
      ]
    });
  }
  
  const cls = audits['cumulative-layout-shift']?.numericValue || 0;
  if (cls > 0.1) {
    recommendations.push({
      id: 'cls-high',
      priority: 'important',
      category: 'performance',
      icon: '🟠',
      title: 'Instabilité visuelle : éléments qui bougent au chargement',
      description: `Votre Cumulative Layout Shift (CLS) de ${cls.toFixed(3)} indique que des éléments de la page se déplacent de manière inattendue pendant le chargement, créant une expérience frustrante pour l'utilisateur.`,
      strengths: [
        "Le layout final est stable une fois chargé",
        "La structure HTML est correctement définie"
      ],
      weaknesses: [
        `CLS actuel : ${cls.toFixed(3)} (objectif < 0.1)`,
        "Les utilisateurs peuvent cliquer accidentellement sur le mauvais élément",
        "Pénalité Core Web Vitals appliquée par Google",
        "Expérience utilisateur dégradée, surtout sur mobile"
      ],
      fixes: [
        "Définir des dimensions explicites (width/height) sur toutes les images et vidéos",
        "Réserver l'espace pour les publicités et embeds avec aspect-ratio CSS",
        "Éviter d'injecter du contenu au-dessus du contenu existant sans réservation d'espace",
        "Utiliser font-display: swap avec des fonts de fallback de taille similaire",
        "Précharger les fonts critiques avec <link rel='preload' as='font'>",
        "Tester avec Chrome DevTools > Performance > Layout Shift Regions"
      ]
    });
  }
  
  // Technical SEO recommendations
  if (!htmlAnalysis.hasTitle) {
    recommendations.push({
      id: 'no-title',
      priority: 'critical',
      category: 'technique',
      icon: '🔴',
      title: 'Balise Title absente : page non identifiable',
      description: 'Votre page ne possède pas de balise <title>. C\'est le premier élément analysé par Google et les moteurs de recherche pour comprendre le sujet de votre page. Sans titre, votre page apparaîtra avec un libellé générique ou l\'URL dans les résultats de recherche.',
      weaknesses: [
        "Aucune balise <title> détectée dans le <head>",
        "Impossible de se positionner correctement dans les SERP",
        "Les partages sociaux afficheront l'URL au lieu d'un titre attractif",
        "Les LLM ne peuvent pas identifier le sujet principal de la page"
      ],
      fixes: [
        "Ajouter une balise <title> unique dans le <head> de la page",
        "Limiter le titre à 50-60 caractères pour éviter la troncature",
        "Inclure le mot-clé principal au début du titre",
        "Formuler le titre de manière engageante pour inciter au clic",
        "Éviter les titres dupliqués entre les pages du site"
      ]
    });
  } else if (htmlAnalysis.titleLength > 70) {
    recommendations.push({
      id: 'title-long',
      priority: 'important',
      category: 'technique',
      icon: '🟠',
      title: 'Titre trop long : troncature dans les résultats de recherche',
      description: `Votre titre fait ${htmlAnalysis.titleLength} caractères. Google tronque généralement les titres au-delà de 60 caractères, ce qui peut couper des informations importantes et réduire le taux de clic.`,
      strengths: [
        "Une balise <title> est présente",
        `Titre actuel : "${htmlAnalysis.titleContent?.substring(0, 50)}..."`
      ],
      weaknesses: [
        `Longueur actuelle : ${htmlAnalysis.titleLength} caractères (recommandé : 50-60)`,
        "Le titre sera tronqué avec '...' dans les résultats Google",
        "Les informations clés en fin de titre ne seront pas visibles"
      ],
      fixes: [
        "Réduire le titre à 60 caractères maximum",
        "Placer le mot-clé principal dans les 30 premiers caractères",
        "Supprimer les mots inutiles (le, la, les, de, etc.)",
        "Tester l'affichage avec un outil de prévisualisation SERP"
      ]
    });
  } else {
    // Title is good - can be used as strength elsewhere
  }
  
  if (!htmlAnalysis.hasMetaDesc) {
    recommendations.push({
      id: 'no-meta-desc',
      priority: 'important',
      category: 'contenu',
      icon: '🟠',
      title: 'Meta Description manquante : opportunité de clic perdue',
      description: 'Votre page n\'a pas de meta description. Google génèrera automatiquement un extrait à partir du contenu de la page, mais ce texte sera souvent moins pertinent et moins incitatif qu\'une description rédigée manuellement.',
      weaknesses: [
        "Aucune balise <meta name='description'> détectée",
        "Google choisira un extrait aléatoire du contenu",
        "Taux de clic (CTR) potentiellement réduit",
        "Opportunité manquée d'inclure un appel à l'action"
      ],
      fixes: [
        "Ajouter <meta name='description' content='...'> dans le <head>",
        "Rédiger 150-160 caractères maximum pour éviter la troncature",
        "Inclure le mot-clé principal naturellement",
        "Ajouter un appel à l'action (Découvrez, Apprenez, Obtenez...)",
        "Rendre la description unique pour chaque page"
      ]
    });
  }

  // Meta description length check
  if (htmlAnalysis.hasMetaDesc && htmlAnalysis.metaDescLength > 160) {
    recommendations.push({
      id: 'meta-desc-too-long',
      priority: 'important',
      category: 'contenu',
      icon: '🟠',
      title: `Meta Description trop longue (${htmlAnalysis.metaDescLength} car.) — risque de troncature`,
      description: `Votre meta description fait ${htmlAnalysis.metaDescLength} caractères. Google tronque les descriptions au-delà de 155-160 caractères, ce qui peut couper votre message et réduire le taux de clic.`,
      weaknesses: [
        `${htmlAnalysis.metaDescLength} caractères détectés (max recommandé : 155)`,
        "Le texte sera tronqué dans les résultats de recherche",
        "Message incomplet = moins d'incitation au clic",
        "Les LLM peuvent aussi utiliser un extrait tronqué comme résumé"
      ],
      fixes: [
        "Raccourcir la meta description à 150-155 caractères",
        "Placer les informations clés et le CTA en début de phrase",
        "Supprimer les mots superflus sans perdre le sens",
        "Tester l'affichage avec un outil de prévisualisation SERP"
      ]
    });
  } else if (htmlAnalysis.hasMetaDesc && htmlAnalysis.metaDescLength < 70) {
    recommendations.push({
      id: 'meta-desc-too-short',
      priority: 'optional',
      category: 'contenu',
      icon: '🟡',
      title: `Meta Description trop courte (${htmlAnalysis.metaDescLength} car.) — potentiel sous-exploité`,
      description: `Votre meta description ne fait que ${htmlAnalysis.metaDescLength} caractères. Vous disposez d'espace supplémentaire pour convaincre les utilisateurs de cliquer et donner plus de contexte aux moteurs IA.`,
      weaknesses: [
        `Seulement ${htmlAnalysis.metaDescLength} caractères (objectif : 120-155)`,
        "Espace gaspillé dans les résultats de recherche",
        "Moins de contexte sémantique pour les LLM"
      ],
      fixes: [
        "Enrichir la description jusqu'à 120-155 caractères",
        "Ajouter un bénéfice utilisateur ou un appel à l'action",
        "Inclure des mots-clés secondaires pertinents"
      ]
    });
  }
  
  if (htmlAnalysis.h1Count === 0) {
    recommendations.push({
      id: 'no-h1',
      priority: 'critical',
      category: 'contenu',
      icon: '🔴',
      title: 'Balise H1 absente : structure sémantique brisée',
      description: 'Votre page ne contient aucune balise H1. Le H1 est le titre principal de votre contenu et joue un rôle crucial pour le SEO et l\'accessibilité. Les moteurs de recherche et les LLM utilisent cette balise pour comprendre le sujet central de la page.',
      weaknesses: [
        "Aucune balise <h1> détectée sur la page",
        "Les moteurs de recherche ne peuvent pas identifier le sujet principal",
        "Structure de heading non conforme aux standards d'accessibilité",
        "Les LLM (ChatGPT, Perplexity) auront du mal à extraire le contexte"
      ],
      fixes: [
        "Ajouter exactement une balise <h1> par page",
        "Placer le H1 en haut du contenu principal (pas dans le header/nav)",
        "Inclure le mot-clé principal dans le H1",
        "S'assurer que le H1 résume le contenu de la page en une phrase",
        "Vérifier que les autres titres suivent la hiérarchie (H2, H3, etc.)"
      ]
    });
  } else if (htmlAnalysis.h1Count > 1) {
    recommendations.push({
      id: 'multiple-h1',
      priority: 'important',
      category: 'contenu',
      icon: '🟡',
      title: 'Plusieurs H1 détectés : confusion sémantique',
      description: `Votre page contient ${htmlAnalysis.h1Count} balises H1. Bien que HTML5 autorise techniquement plusieurs H1 dans des sections, il est recommandé d'en avoir un seul pour une hiérarchie claire et un meilleur référencement.`,
      strengths: [
        "Des balises de titre sont présentes sur la page",
        "La structure de heading existe"
      ],
      weaknesses: [
        `${htmlAnalysis.h1Count} balises H1 détectées au lieu d'une seule`,
        "Les moteurs de recherche peuvent confondre le sujet principal",
        "Dilution du poids sémantique du titre principal"
      ],
      fixes: [
        "Conserver uniquement le H1 le plus représentatif du contenu",
        "Convertir les autres H1 en H2 ou H3 selon leur importance",
        "Vérifier que le H1 restant contient le mot-clé principal",
        "Utiliser des outils comme HeadingsMap pour visualiser la hiérarchie"
      ]
    });
  }
  
  if (htmlAnalysis.wordCount < 500) {
    recommendations.push({
      id: 'thin-content',
      priority: 'important',
      category: 'contenu',
      icon: '🟠',
      title: 'Contenu trop léger : risque de thin content',
      description: `Votre page ne contient qu'environ ${htmlAnalysis.wordCount} mots. Les pages avec un contenu limité ont moins de chances de se positionner sur des requêtes compétitives et offrent moins de valeur aux utilisateurs et aux LLM.`,
      strengths: [
        "Du contenu textuel est présent sur la page",
        "La page n'est pas vide"
      ],
      weaknesses: [
        `Seulement ~${htmlAnalysis.wordCount} mots détectés (recommandé : 800+)`,
        "Difficulté à couvrir un sujet en profondeur",
        "Moins d'opportunités pour les mots-clés longue traîne",
        "Les LLM disposeront de peu de contexte pour les citations"
      ],
      fixes: [
        "Enrichir le contenu pour atteindre 800-1500 mots selon le sujet",
        "Ajouter des sections FAQ pour répondre aux questions fréquentes",
        "Inclure des exemples concrets, études de cas ou statistiques",
        "Développer les sous-sections avec des H2/H3 et du contenu détaillé",
        "Ajouter des tableaux comparatifs ou des listes à puces pour structurer l'information"
      ]
    });
  }
  
  // AI/GEO recommendations
  if (!htmlAnalysis.hasSchemaOrg) {
    recommendations.push({
      id: 'no-schema',
      priority: 'important',
      category: 'ia',
      icon: '🟠',
      title: 'Données structurées absentes : invisibilité pour les IA',
      description: 'Votre page ne contient pas de données structurées Schema.org (JSON-LD). Ces balises permettent aux moteurs de recherche et aux LLM de comprendre précisément le contexte et le type de contenu de votre page.',
      weaknesses: [
        "Aucun balisage JSON-LD ou Schema.org détecté",
        "Pas de rich snippets possibles dans les résultats Google",
        "Les LLM (ChatGPT, Perplexity, Claude) manquent de contexte structuré",
        "Opportunité manquée pour les featured snippets et les réponses IA"
      ],
      fixes: [
        "Implémenter Schema.org en JSON-LD (plus simple que microdata)",
        "Pour un site vitrine : ajouter Organization et WebSite",
        "Pour des articles : ajouter Article avec author, datePublished",
        "Pour des produits : ajouter Product avec price, availability",
        "Ajouter FAQPage pour les sections FAQ (très citable par les LLM)",
        "Valider avec Google Rich Results Test : search.google.com/test/rich-results"
      ]
    });
  } else {
    recommendations.push({
      id: 'schema-present',
      priority: 'optional',
      category: 'ia',
      icon: '✅',
      title: 'Données structurées détectées : bonne base GEO',
      description: `Votre page contient des données structurées Schema.org : ${htmlAnalysis.schemaTypes.join(', ')}. C'est un excellent point de départ pour la visibilité auprès des LLM et les rich snippets Google.`,
      strengths: [
        `Types Schema détectés : ${htmlAnalysis.schemaTypes.join(', ')}`,
        "Les moteurs de recherche peuvent créer des rich snippets",
        "Les LLM ont un contexte structuré pour les citations"
      ],
      fixes: [
        "Enrichir avec des types complémentaires (FAQPage, HowTo, Review)",
        "Vérifier que tous les champs requis sont renseignés",
        "Tester régulièrement avec le Rich Results Test de Google"
      ]
    });
  }
  
  // Security recommendations  
  if (!htmlAnalysis.isHttps) {
    recommendations.push({
      id: 'no-https',
      priority: 'critical',
      category: 'securite',
      icon: '🔴',
      title: 'HTTPS non activé : site marqué "Non sécurisé"',
      description: 'Votre site n\'utilise pas HTTPS. Les navigateurs modernes affichent un avertissement "Non sécurisé" et Google pénalise les sites HTTP dans son classement. C\'est un critère éliminatoire pour le référencement moderne.',
      weaknesses: [
        "Le site est accessible en HTTP non chiffré",
        "Chrome affiche 'Non sécurisé' dans la barre d'adresse",
        "Pénalité de classement Google appliquée",
        "Les données utilisateur transitent en clair (problème RGPD)",
        "Certains navigateurs bloquent les fonctionnalités avancées (géolocalisation, etc.)"
      ],
      fixes: [
        "Obtenir un certificat SSL gratuit via Let's Encrypt",
        "Configurer la redirection HTTP → HTTPS au niveau serveur",
        "Mettre à jour tous les liens internes en HTTPS",
        "Configurer HSTS (HTTP Strict Transport Security)",
        "Vérifier qu'aucune ressource n'est chargée en HTTP (mixed content)"
      ]
    });
  }
  
  // Mobile friendliness
  const psiSeoScore = psiData?.lighthouseResult?.categories?.seo?.score || 0;
  if (psiSeoScore < 0.9) {
    const tapTargets = audits['tap-targets'];
    if (tapTargets?.score < 1) {
      recommendations.push({
        id: 'mobile-tap',
        priority: 'critical',
        category: 'technique',
        icon: '🔴',
        title: 'Éléments tactiles trop petits : navigation mobile difficile',
        description: 'Les zones cliquables de votre site sont trop petites ou trop proches les unes des autres. Sur mobile, les utilisateurs auront du mal à cliquer précisément, ce qui génère de la frustration et des erreurs de navigation.',
        weaknesses: [
          "Boutons et liens trop petits pour les doigts",
          "Espacement insuffisant entre les éléments interactifs",
          "Pénalité mobile-first indexing de Google",
          "Taux de rebond mobile probablement élevé"
        ],
        fixes: [
          "Agrandir toutes les zones tactiles à 48x48 pixels minimum",
          "Ajouter un padding de 8px minimum entre les éléments cliquables",
          "Utiliser des boutons plutôt que des liens texte pour les actions importantes",
          "Tester sur de vrais appareils mobiles, pas seulement en émulation",
          "Utiliser Chrome DevTools > Device Mode pour simuler différents écrans"
        ]
      });
    }
  }
  
  // ═══ CONTENT FRESHNESS RECOMMENDATION ═══
  if (htmlAnalysis.contentAgeDays !== null && htmlAnalysis.contentAgeDays !== undefined) {
    if (htmlAnalysis.contentAgeDays > 365) {
      recommendations.push({
        id: 'content-stale',
        priority: 'critical',
        category: 'contenu',
        icon: '🔴',
        title: 'Contenu obsolète : dernière mise à jour il y a plus d\'un an',
        description: `Le contenu n'a pas été mis à jour depuis ${htmlAnalysis.contentAgeDays} jours (dernière date détectée : ${htmlAnalysis.mostRecentDate?.substring(0,10)}). Les moteurs IA privilégient les contenus frais et à jour. Google et les LLM accordent un avantage significatif aux pages régulièrement mises à jour.`,
        weaknesses: [
          `Dernière mise à jour détectée : il y a ${htmlAnalysis.contentAgeDays} jours`,
          "Les LLM favorisent les sources récentes pour leurs citations",
          "Google QDF (Query Deserves Freshness) pénalise les contenus datés",
          "Risque d'informations périmées qui nuisent à la crédibilité"
        ],
        fixes: [
          "Mettre à jour le contenu principal avec des données 2026",
          "Ajouter/mettre à jour les balises dateModified dans le JSON-LD",
          "Publier régulièrement du contenu frais (articles, actualités)",
          "Actualiser les pages produits avec les dernières offres",
          "Implémenter un calendrier éditorial de mise à jour trimestriel"
        ]
      });
    } else if (htmlAnalysis.contentAgeDays > 90) {
      recommendations.push({
        id: 'content-aging',
        priority: 'important',
        category: 'contenu',
        icon: '🟠',
        title: 'Contenu vieillissant : mise à jour recommandée',
        description: `Le contenu date de ${htmlAnalysis.contentAgeDays} jours. Bien que toujours valable, une mise à jour régulière améliorerait la citabilité par les IA génératives et le signal de fraîcheur Google.`,
        strengths: [
          "Des signaux de date sont présents sur la page",
          "Le contenu est encore relativement récent"
        ],
        weaknesses: [
          `Dernière mise à jour : il y a ${htmlAnalysis.contentAgeDays} jours`,
          "Les concurrents avec du contenu plus frais sont privilégiés"
        ],
        fixes: [
          "Actualiser les données et statistiques avec les plus récentes",
          "Ajouter une section 'Dernière mise à jour' visible",
          "Mettre à jour dateModified dans les données structurées"
        ]
      });
    }
  } else if (htmlAnalysis.dateSignalsCount === 0) {
    recommendations.push({
      id: 'no-date-signals',
      priority: 'important',
      category: 'ia',
      icon: '🟠',
      title: 'Aucun signal de fraîcheur détecté : invisible pour les IA',
      description: 'Aucune date de publication ou de mise à jour n\'a été détectée sur cette page (ni meta tags, ni JSON-LD, ni header HTTP). Les moteurs IA et Google ne peuvent pas évaluer la fraîcheur du contenu.',
      weaknesses: [
        "Aucune balise datePublished ou dateModified en JSON-LD",
        "Pas de meta article:modified_time ou og:updated_time",
        "Pas de header HTTP Last-Modified",
        "Les IA ne peuvent pas juger la pertinence temporelle"
      ],
      fixes: [
        "Ajouter datePublished et dateModified dans le JSON-LD",
        "Configurer article:modified_time dans les meta Open Graph",
        "Configurer le serveur pour envoyer le header Last-Modified",
        "Afficher visuellement la date de dernière mise à jour"
      ]
    });
  }

  // ═══ JS-DEPENDENCY RECOMMENDATION ═══
  if (htmlAnalysis.isContentJSDependent) {
    recommendations.push({
      id: 'js-dependent-content',
      priority: 'critical',
      category: 'ia',
      icon: '🔴',
      title: 'Contenu invisible sans JavaScript : bots IA bloqués',
      description: `Le contenu principal de la page nécessite l'exécution de JavaScript pour être affiché (${htmlAnalysis.staticWordCount} mots lisibles sans JS vs ${htmlAnalysis.wordCount} avec). Les crawlers IA basiques (GPTBot, ClaudeBot, CCBot) n'exécutent pas toujours le JavaScript, rendant votre contenu invisible pour les moteurs génératifs.`,
      weaknesses: [
        `Seulement ${htmlAnalysis.staticWordCount} mots accessibles sans JavaScript`,
        htmlAnalysis.hasSPAMarkers ? "Framework SPA détecté (React/Vue/Next/Nuxt) avec rendu côté client" : "Contenu majoritairement généré par JavaScript",
        "GPTBot et ClaudeBot ne font pas de rendering JS systématique",
        "Réduction drastique de la citabilité dans les réponses IA"
      ],
      fixes: [
        "Implémenter le Server-Side Rendering (SSR) ou Static Site Generation (SSG)",
        "Utiliser le pre-rendering pour les crawlers (Prerender.io, Rendertron)",
        "Ajouter une balise <noscript> avec le contenu principal en texte brut",
        "Vérifier l'indexabilité avec 'curl -s URL | head -200' (sans JS)",
        "Configurer le Dynamic Rendering pour servir du HTML statique aux bots"
      ]
    });
  }

  // ═══ SCHEMA COMPLEXITY RECOMMENDATION ═══
  if (htmlAnalysis.hasSchemaOrg && htmlAnalysis.schemaDepth < 2 && htmlAnalysis.schemaFieldCount < 10) {
    recommendations.push({
      id: 'schema-shallow',
      priority: 'important',
      category: 'ia',
      icon: '🟠',
      title: 'Données structurées superficielles : potentiel inexploité',
      description: `Vos données structurées Schema.org sont présentes mais peu détaillées (profondeur ${htmlAnalysis.schemaDepth}, ${htmlAnalysis.schemaFieldCount} champs). Des données structurées riches et imbriquées permettent aux IA d'identifier votre site comme une source fiable et experte.`,
      strengths: [
        `Types Schema.org détectés : ${htmlAnalysis.schemaTypes.join(', ')}`,
        "Le balisage de base est en place"
      ],
      weaknesses: [
        `Profondeur d'imbrication : ${htmlAnalysis.schemaDepth} (recommandé : 3+)`,
        `Seulement ${htmlAnalysis.schemaFieldCount} champs renseignés`,
        "Les données structurées complexes augmentent la confiance IA",
        !htmlAnalysis.schemaHasGraph ? "Pas de @graph détecté (recommandé pour lier les entités)" : null
      ].filter(Boolean),
      fixes: [
        "Enrichir les types existants avec tous les champs recommandés par Google",
        "Utiliser @graph pour lier Organization, WebSite et les pages entre elles",
        "Ajouter des types imbriqués (author > Person > Organization)",
        "Inclure sameAs pour lier aux profils sociaux et Wikidata",
        "Ajouter FAQPage, HowTo ou Review pour les contenus éligibles"
      ]
    });
  }

  // ═══ AI-FAVORED FORMATS RECOMMENDATION ═══
  const missingFormats: string[] = [];
  if (!htmlAnalysis.hasTLDR) missingFormats.push('résumé TL;DR en haut de page');
  if (htmlAnalysis.tableCount === 0) missingFormats.push('tableaux comparatifs');
  if (htmlAnalysis.listCount < 2) missingFormats.push('listes à puces structurées');
  if (!htmlAnalysis.hasFAQSection) missingFormats.push('section FAQ');

  if (missingFormats.length >= 2) {
    recommendations.push({
      id: 'missing-ai-formats',
      priority: 'important',
      category: 'ia',
      icon: '🟠',
      title: 'Formats IA absents : contenu non optimisé pour les moteurs génératifs',
      description: `Votre page ne contient pas les formats de contenu privilégiés par les IA génératives : ${missingFormats.join(', ')}. Ces formats structurés augmentent significativement la probabilité d'être cité dans les réponses de ChatGPT, Perplexity et Google AI Overview.`,
      weaknesses: [
        ...missingFormats.map(f => `Format manquant : ${f}`),
        "Les IA extraient prioritairement les tableaux, listes et résumés",
        "Contenu non optimisé pour le Featured Snippet / Position 0"
      ],
      fixes: [
        !htmlAnalysis.hasTLDR ? "Ajouter un résumé TL;DR ou 'En bref' dans les 200 premiers mots de la page" : null,
        htmlAnalysis.tableCount === 0 ? "Créer des tableaux comparatifs (prix, caractéristiques, alternatives)" : null,
        htmlAnalysis.listCount < 2 ? "Structurer les informations clés en listes à puces ou numérotées" : null,
        !htmlAnalysis.hasFAQSection ? "Ajouter une section FAQ avec les questions fréquentes du secteur" : null,
        "Utiliser des H2 interrogatifs ('Comment...?', 'Pourquoi...?') pour capter les requêtes IA"
      ].filter(Boolean)
    });
  }

  // ═══ AI BOTS SPECIFIC CHECK (GPTBot, ClaudeBot, PerplexityBot) ═══
  if (crawlersResult) {
    const criticalBots = [
      { key: 'gptBot', name: 'GPTBot', company: 'OpenAI' },
      { key: 'claudeBot', name: 'ClaudeBot', company: 'Anthropic' },
      { key: 'perplexityBot', name: 'PerplexityBot', company: 'Perplexity' },
    ];
    const blockedCritical = criticalBots.filter(b => !crawlersResult.allowsAIBots?.[b.key]);
    
    if (blockedCritical.length > 0) {
      recommendations.push({
        id: 'critical-bots-blocked',
        priority: 'critical',
        category: 'ia',
        icon: '🔴',
        title: `Bots IA critiques bloqués : ${blockedCritical.map(b => b.name).join(', ')}`,
        description: `${blockedCritical.length} crawler(s) IA essentiels sont bloqués dans votre robots.txt. Sans accès, votre site est INVISIBLE pour les moteurs génératifs correspondants. C'est un blocage critique pour la visibilité GEO.`,
        weaknesses: [
          ...blockedCritical.map(b => `${b.name} (${b.company}) : BLOQUÉ — votre contenu ne sera pas cité dans ${b.company}`),
          "Perte totale de visibilité dans les réponses IA de ces moteurs",
          "Les utilisateurs qui cherchent via ChatGPT, Claude ou Perplexity ne vous trouveront jamais"
        ],
        fixes: [
          ...blockedCritical.map(b => `Ajouter 'User-agent: ${b.name}\\nAllow: /' dans robots.txt`),
          "Supprimer les directives Disallow ciblant ces bots",
          "Vérifier qu'aucun meta tag 'noindex' ne cible ces agents"
        ]
      });
    }
  }

  // Robots.txt analysis (generic)
  if (!scores.aiReady?.robotsPermissive) {
    recommendations.push({
      id: 'robots-restrictive',
      priority: 'important',
      category: 'ia',
      icon: '🟠',
      title: 'Robots.txt restrictif : crawlers IA potentiellement bloqués',
      description: 'Votre fichier robots.txt contient des règles restrictives qui pourraient bloquer les crawlers IA.',
      weaknesses: [
        "Le robots.txt contient des règles Disallow restrictives",
        "Les bots IA modernes pourraient être bloqués"
      ],
      fixes: [
        "Vérifier que GPTBot, ClaudeBot, PerplexityBot ne sont pas bloqués",
        "Ajouter des règles Allow explicites pour les crawlers IA",
        "Supprimer les Disallow: / génériques"
      ]
    });
  }

  // ═══ SITEMAP CHECK ═══
  if (sitemapAnalysis) {
    if (!sitemapAnalysis.exists) {
      recommendations.push({
        id: 'no-sitemap',
        priority: 'important',
        category: 'technique',
        icon: '🟠',
        title: 'Sitemap.xml absent : pages non déclarées aux moteurs',
        description: 'Aucun fichier sitemap.xml n\'a été détecté. Le sitemap est essentiel pour déclarer vos pages prioritaires aux moteurs de recherche et aux crawlers IA.',
        weaknesses: [
          "Aucun sitemap.xml accessible à la racine du site",
          "Les moteurs ne connaissent pas la liste complète de vos pages",
          "Crawl budget potentiellement gaspillé sur des pages secondaires",
          "Les nouveaux contenus sont découverts plus lentement"
        ],
        fixes: [
          "Créer un fichier sitemap.xml à la racine du site",
          "Inclure toutes les pages importantes avec les balises <loc> et <lastmod>",
          "Déclarer le sitemap dans le robots.txt avec 'Sitemap: https://...'",
          "Soumettre le sitemap dans Google Search Console"
        ]
      });
    } else if (!sitemapAnalysis.containsMainUrl) {
      recommendations.push({
        id: 'page-not-in-sitemap',
        priority: 'important',
        category: 'technique',
        icon: '🟠',
        title: 'Page absente du sitemap : risque de non-indexation',
        description: `Le sitemap.xml existe (${sitemapAnalysis.urlCount} URLs) mais la page analysée n'y figure pas. Les pages non déclarées dans le sitemap ont moins de chances d'être crawlées et indexées régulièrement.`,
        weaknesses: [
          "La page analysée n'est pas déclarée dans le sitemap",
          `Le sitemap contient ${sitemapAnalysis.urlCount} URLs mais pas celle-ci`,
          "Priorité d'indexation réduite pour cette page"
        ],
        fixes: [
          "Ajouter cette URL dans le sitemap.xml",
          "Vérifier que toutes les pages importantes sont incluses",
          "Mettre à jour le <lastmod> à chaque modification de contenu"
        ]
      });
    }
  }

  // ═══ SCHEMA ENTITY VALIDATION ═══
  if (htmlAnalysis.hasSchemaOrg && htmlAnalysis.schemaEntities) {
    const entities = htmlAnalysis.schemaEntities;
    const missingEntities: string[] = [];
    if (!entities.hasOrganization && !entities.hasPerson) missingEntities.push('Organization ou Person');
    if (!entities.hasWebSite) missingEntities.push('WebSite');
    
    if (missingEntities.length > 0) {
      recommendations.push({
        id: 'missing-core-schema-entities',
        priority: 'important',
        category: 'ia',
        icon: '🟠',
        title: 'Entités Schema.org fondamentales manquantes',
        description: `Vos données structurées existent mais ne contiennent pas les entités de base : ${missingEntities.join(', ')}. Ces entités sont indispensables pour que les IA identifient clairement votre marque et votre site.`,
        weaknesses: [
          ...missingEntities.map(e => `Entité ${e} absente du JSON-LD`),
          "Les IA ne peuvent pas identifier l'entité propriétaire du site",
          "Pas de sameAs pour lier aux profils sociaux et Knowledge Graph"
        ],
        fixes: [
          !entities.hasOrganization ? "Ajouter Organization avec name, url, logo, sameAs, contactPoint" : null,
          !entities.hasWebSite ? "Ajouter WebSite avec name, url, potentialAction (SearchAction)" : null,
          "Utiliser @graph pour lier Organization → WebSite → WebPage",
          "Ajouter sameAs avec les URLs Wikidata, LinkedIn, profils sociaux"
        ].filter(Boolean)
      });
    }
  }

  // ═══ FAQ + FAQPAGE COUPLING ═══
  if (htmlAnalysis.hasFAQSection && !htmlAnalysis.hasFAQWithSchema) {
    recommendations.push({
      id: 'faq-without-schema',
      priority: 'important',
      category: 'ia',
      icon: '🟠',
      title: 'FAQ détectée mais sans données structurées FAQPage',
      description: 'Votre page contient une section FAQ mais elle n\'est pas couplée avec le balisage FAQPage Schema.org. Sans ce balisage, Google ne peut pas afficher les rich snippets FAQ et les IA ne peuvent pas extraire les Q&A de manière structurée.',
      weaknesses: [
        "Section FAQ présente dans le HTML mais sans FAQPage Schema",
        "Pas de rich snippets FAQ possibles dans les résultats Google",
        "Les IA doivent parser le HTML brut au lieu de données structurées",
        "Opportunité de visibilité significative perdue"
      ],
      fixes: [
        "Ajouter un bloc JSON-LD de type FAQPage avec les mainEntity",
        "Chaque question doit être un objet Question avec acceptedAnswer",
        "Valider avec Google Rich Results Test",
        "S'assurer que les questions correspondent au contenu visible"
      ]
    });
  }

  // ═══ E-E-A-T SIGNALS ═══
  if (!htmlAnalysis.hasAuthorBio && !htmlAnalysis.hasExpertCitations) {
    recommendations.push({
      id: 'no-eeat-signals',
      priority: 'important',
      category: 'contenu',
      icon: '🟠',
      title: 'Signaux E-E-A-T absents : crédibilité non démontrée',
      description: 'Aucune signature d\'auteur ni citation d\'expert n\'a été détectée. Google et les IA évaluent la crédibilité via les signaux E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness). Leur absence réduit la confiance accordée à votre contenu.',
      weaknesses: [
        "Aucune bio d'auteur (Author Bio) détectée",
        "Aucune citation d'expert ou de source faisant autorité",
        "Le contenu semble anonyme — faible signal de confiance",
        "Les IA favorisent les contenus avec attribution claire"
      ],
      fixes: [
        "Ajouter une bio d'auteur avec nom, photo, titre et liens sociaux",
        "Inclure des citations d'experts du secteur (avec nom + titre)",
        "Ajouter des blockquotes avec attribution de source",
        "Implémenter le Schema Person pour les auteurs dans le JSON-LD",
        "Référencer des études, rapports ou données de sources reconnues"
      ]
    });
  }

  // ═══ DATA DENSITY ═══
  if ((htmlAnalysis.dataDensityScore || 0) < 20 && (htmlAnalysis.wordCount || 0) > 300) {
    recommendations.push({
      id: 'low-data-density',
      priority: 'important',
      category: 'ia',
      icon: '🟠',
      title: 'Faible densité de données : contenu peu citable par les IA',
      description: `Votre page contient très peu de données chiffrées (${htmlAnalysis.statisticCount || 0} statistiques, ${htmlAnalysis.percentageCount || 0} pourcentages). Les IA génératives privilégient les contenus riches en données factuelles pour les citer dans leurs réponses.`,
      weaknesses: [
        `Score de densité de données : ${htmlAnalysis.dataDensityScore}/100`,
        `Seulement ${htmlAnalysis.statisticCount || 0} points de données détectés`,
        "Les contenus sans chiffres sont rarement cités par les IA",
        "Manque de preuves quantitatives pour convaincre les lecteurs"
      ],
      fixes: [
        "Ajouter des statistiques sectorielles avec sources (ex: 'selon une étude XYZ, 78% des...')",
        "Inclure des métriques de résultats concrets (chiffre d'affaires, croissance, ROI)",
        "Créer des tableaux comparatifs avec des données chiffrées",
        "Intégrer des pourcentages, dates et ordres de grandeur dans le texte",
        "Citer des études de marché, rapports et benchmarks du secteur"
      ]
    });
  }

  // ═══ SOCIAL / LINKEDIN LINKS ═══
  if (!htmlAnalysis.hasLinkedInLinks && !htmlAnalysis.hasSocialLinks) {
    recommendations.push({
      id: 'no-social-links',
      priority: 'optional',
      category: 'ia',
      icon: '🟡',
      title: 'Aucun lien vers les profils sociaux : crédibilité humaine non prouvée',
      description: 'Aucun lien vers des profils sociaux (LinkedIn, Twitter/X, etc.) n\'a été détecté. Les profils sociaux, notamment LinkedIn, valident la crédibilité humaine de l\'équipe et renforcent les signaux E-E-A-T.',
      weaknesses: [
        "Aucun lien LinkedIn d'équipe ou de fondateur détecté",
        "Aucun profil social lié à la marque",
        "Les IA ne peuvent pas vérifier l'existence réelle de l'entité",
        "Signal de confiance humaine absent"
      ],
      fixes: [
        "Ajouter les liens LinkedIn des fondateurs/experts dans la page",
        "Créer une section 'Notre équipe' avec les profils LinkedIn",
        "Ajouter les sameAs dans le JSON-LD Organization (LinkedIn, Twitter, etc.)",
        "Inclure des liens vers la page LinkedIn Company"
      ]
    });
  }

  // ═══ CASE STUDIES ═══
  if (!htmlAnalysis.hasCaseStudies && (htmlAnalysis.wordCount || 0) > 500) {
    recommendations.push({
      id: 'no-case-studies',
      priority: 'optional',
      category: 'contenu',
      icon: '🟡',
      title: 'Absence d\'études de cas : preuves de résultats manquantes',
      description: 'Aucune étude de cas, témoignage client avec métriques, ni preuve de résultats n\'a été détectée. Les études de cas avec des données concrètes sont parmi les contenus les plus cités par les IA et les plus valorisés par Google.',
      weaknesses: [
        "Aucun signal d'étude de cas (case study) détecté",
        "Pas de métriques de résultats (ROI, croissance, avant/après)",
        "Les IA citent en priorité les contenus avec preuves concrètes",
        "Opportunité de content marketing hautement citable manquée"
      ],
      fixes: [
        "Créer des études de cas clients avec des métriques avant/après",
        "Inclure des chiffres concrets (ROI, % de croissance, gains mesurables)",
        "Structurer avec le schéma : Contexte → Défi → Solution → Résultats",
        "Ajouter le balisage Review ou Article pour ces contenus"
      ]
    });
  }
  
  // ═══ INTERNAL LINKING (MAILLAGE) ═══
  const internalLinks = htmlAnalysis.internalLinksCount || 0;
  const externalLinks = htmlAnalysis.externalLinksCount || 0;
  const uniquePaths = htmlAnalysis.uniqueInternalPaths || 0;

  if (internalLinks < 3) {
    recommendations.push({
      id: 'orphan-page-risk',
      priority: 'critical',
      category: 'technique',
      icon: '🔴',
      title: `Page quasi-orpheline : seulement ${internalLinks} lien(s) interne(s) détecté(s)`,
      description: `Cette page ne contient que ${internalLinks} lien(s) interne(s) vers d'autres pages du site. C'est un signal fort de mauvais maillage : les moteurs de recherche et les IA auront du mal à comprendre la place de cette page dans l'architecture du site.`,
      weaknesses: [
        `Seulement ${internalLinks} lien(s) interne(s) détecté(s)`,
        "Risque de page orpheline pour les crawlers",
        "Les IA ne peuvent pas contextualiser cette page dans le site",
        "Impact négatif sur le PageRank interne"
      ],
      fixes: [
        "Ajouter au minimum 5-10 liens internes pertinents vers des pages clés",
        "Créer un maillage contextuel avec des ancres descriptives (pas de 'cliquez ici')",
        "Lier vers les pages pilier (services, catégories, ressources)",
        "Ajouter un bloc 'Articles connexes' ou 'Pages associées' en bas de page"
      ]
    });
  } else if (internalLinks < 10 && (htmlAnalysis.wordCount || 0) > 500) {
    recommendations.push({
      id: 'weak-internal-linking',
      priority: 'important',
      category: 'technique',
      icon: '🟠',
      title: `Maillage interne faible : ${internalLinks} liens internes pour ${htmlAnalysis.wordCount} mots`,
      description: `Le ratio maillage/contenu est faible. Pour une page de ${htmlAnalysis.wordCount} mots, on recommande au moins 10-15 liens internes pour maximiser le crawl budget et distribuer l'autorité.`,
      weaknesses: [
        `${internalLinks} liens internes pour un contenu de ${htmlAnalysis.wordCount} mots`,
        `Seulement ${uniquePaths} destinations internes uniques`,
        "Distribution d'autorité sous-optimale",
      ],
      fixes: [
        "Viser un ratio de 1 lien interne pour 100-150 mots de contenu",
        "Varier les ancres : inclure des mots-clés longue traîne",
        "Lier vers les pages transactionnelles et les contenus complémentaires",
        "Utiliser des ancres contextuelles riches plutôt que génériques"
      ]
    });
  }

  if (externalLinks === 0 && (htmlAnalysis.wordCount || 0) > 300) {
    recommendations.push({
      id: 'no-external-links',
      priority: 'optional',
      category: 'contenu',
      icon: '🟡',
      title: 'Aucun lien externe : risque de contenu « fermé »',
      description: 'Aucun lien sortant vers des sources externes n\'a été détecté. Les moteurs et les IA valorisent les pages qui citent des sources fiables, études et références tierces.',
      weaknesses: [
        "Aucun lien externe sortant détecté",
        "Perception de contenu auto-référencé",
        "Les IA préfèrent les contenus qui citent des sources"
      ],
      fixes: [
        "Ajouter 2-5 liens vers des sources d'autorité (études, rapports, documentation)",
        "Citer des experts du domaine avec des liens vers leurs profils",
        "Référencer des données officielles (INSEE, Google, études sectorielles)"
      ]
    });
  }

  // ═══ LLMS.TXT CHECK ═══
  if (llmsTxtAnalysis && !llmsTxtAnalysis.exists) {
    recommendations.push({
      id: 'no-llms-txt',
      priority: 'important',
      category: 'ia',
      icon: '🟠',
      title: 'Fichier llms.txt absent : pas de guidage pour les LLM',
      description: 'Aucun fichier llms.txt n\'a été détecté à la racine du site. Ce fichier (standard émergent) permet de guider les LLM sur l\'identité, les services et les instructions d\'interaction pour votre entité. C\'est un signal de maturité GEO.',
      weaknesses: [
        "Aucun fichier /llms.txt accessible",
        "Les LLM ne disposent d'aucune instruction pour comprendre votre entité",
        "Pas de guidage structuré pour les agents IA autonomes",
        "Opportunité de positionnement GEO manquée"
      ],
      fixes: [
        "Créer un fichier llms.txt à la racine du site (format Markdown)",
        "Inclure : mission, services, capacités, cas d'usage, URL clés",
        "Ajouter des instructions de comportement pour les agents IA",
        "Référencer le fichier dans votre robots.txt si pertinent",
        "Mettre à jour régulièrement pour refléter l'offre actuelle"
      ]
    });
  }

  // ═══ SPECIALIZED SITEMAPS (Image/Video) ═══
  if (specializedSitemaps) {
    const missingSpecialized: string[] = [];
    if (!specializedSitemaps.hasImageSitemap && (htmlAnalysis.imagesTotal || 0) > 5) {
      missingSpecialized.push('images');
    }
    if (!specializedSitemaps.hasVideoSitemap) {
      // Only recommend if we detect video content on page
      const hasVideoContent = htmlAnalysis.schemaTypes?.some(t => /video/i.test(t));
      if (hasVideoContent) missingSpecialized.push('vidéos');
    }
    if (missingSpecialized.length > 0) {
      recommendations.push({
        id: 'no-specialized-sitemaps',
        priority: 'optional',
        category: 'technique',
        icon: '🟡',
        title: `Sitemaps spécialisés manquants : ${missingSpecialized.join(', ')}`,
        description: `Aucun sitemap dédié pour les ${missingSpecialized.join(' et les ')} n'a été détecté. Les sitemaps spécialisés améliorent l'indexation des contenus rich media par Google et les moteurs IA.`,
        weaknesses: [
          ...missingSpecialized.map(t => `Pas de sitemap ${t} détecté`),
          "Les contenus rich media sont découverts plus lentement",
          "Opportunité de rich snippets visuels manquée"
        ],
        fixes: [
          ...missingSpecialized.includes('images') ? ["Créer un sitemap image avec namespace xmlns:image dans le sitemap principal"] : [],
          ...missingSpecialized.includes('vidéos') ? ["Créer un sitemap vidéo dédié avec xmlns:video"] : [],
          "Déclarer les sitemaps spécialisés dans le robots.txt",
          "Soumettre dans Google Search Console"
        ]
      });
    }
  }

  // ═══ HSTS CHECK ═══
  if (htmlAnalysis.isHttps && !htmlAnalysis.hasHSTS) {
    recommendations.push({
      id: 'no-hsts',
      priority: 'important',
      category: 'securite',
      icon: '🟠',
      title: 'HSTS non activé : sécurité de transport incomplète',
      description: 'Le header Strict-Transport-Security (HSTS) n\'est pas configuré. HSTS force les navigateurs à utiliser HTTPS, empêchant les attaques man-in-the-middle et le downgrade HTTP. C\'est un signal de confiance pour les moteurs et les IA.',
      weaknesses: [
        "Header Strict-Transport-Security absent",
        "Vulnérabilité aux attaques de type SSL stripping",
        "Signal de sécurité incomplet pour Google et les IA",
        "Non éligible à la HSTS preload list"
      ],
      fixes: [
        "Ajouter le header : Strict-Transport-Security: max-age=31536000; includeSubDomains",
        "Tester d'abord avec un max-age court (86400) avant d'augmenter",
        "Envisager l'ajout à la HSTS Preload List (hstspreload.org)",
        "Vérifier que toutes les sous-domaines supportent HTTPS avant includeSubDomains"
      ]
    });
  }

  // ═══ SAMEAS / WIKIDATA CHECK ═══
  if (htmlAnalysis.hasSchemaOrg && !htmlAnalysis.hasSameAs) {
    recommendations.push({
      id: 'no-sameas',
      priority: 'important',
      category: 'ia',
      icon: '🟠',
      title: 'Liens sameAs absents du JSON-LD : entité non reliée au Knowledge Graph',
      description: 'Aucun lien sameAs n\'a été détecté dans vos données structurées. Les liens sameAs permettent aux moteurs et IA de relier votre entité à Wikidata, Wikipedia et aux profils sociaux officiels, renforçant drastiquement la reconnaissance dans le Knowledge Graph.',
      weaknesses: [
        "Aucun sameAs dans le JSON-LD Organization",
        "L'entité n'est pas liée au Knowledge Graph de Google",
        "Les IA ne peuvent pas vérifier l'identité de la marque via des sources tierces",
        "Faible signal de confiance pour les réponses génératives"
      ],
      fixes: [
        "Ajouter sameAs dans le JSON-LD Organization avec les URLs : LinkedIn, Twitter/X, Facebook, YouTube",
        "Créer une entrée Wikidata pour votre organisation et l'inclure dans sameAs",
        "Lier vers votre page Wikipedia si elle existe",
        "Inclure les URLs exactes des profils sociaux officiels (pas des profils personnels)"
      ]
    });
  }

  // ═══ SCHEMA AUTHOR / PROFILEPAGE CHECK ═══
  if (htmlAnalysis.schemaEntities?.hasArticle && !htmlAnalysis.hasAuthorInJsonLd) {
    recommendations.push({
      id: 'article-without-author-schema',
      priority: 'important',
      category: 'ia',
      icon: '🟠',
      title: 'Article sans Schema Author : signaux E-E-A-T incomplets',
      description: 'Un schéma Article est détecté mais sans propriété author structurée en JSON-LD. Google et les IA utilisent le Schema Author pour évaluer l\'expertise et la crédibilité du contenu. Son absence affaiblit les signaux E-E-A-T.',
      weaknesses: [
        "Schema Article présent mais sans author structuré",
        "Google ne peut pas identifier l'auteur via les données structurées",
        "Signaux E-E-A-T (Expertise, Experience) incomplets",
        "Les IA ne peuvent pas attribuer le contenu à un expert identifié"
      ],
      fixes: [
        "Ajouter author: { @type: 'Person', name: '...', url: '...', sameAs: ['linkedin...'] } dans le JSON-LD Article",
        "Implémenter ProfilePage Schema pour les pages auteur dédiées",
        "Lier l'auteur à son profil LinkedIn et/ou Google Scholar via sameAs",
        "Ajouter jobTitle, worksFor et knowsAbout pour renforcer l'expertise"
      ]
    });
  }

  // ═══ MISPLACED STRUCTURAL TAGS ═══
  if (htmlAnalysis.misplacedHeadTags && htmlAnalysis.misplacedHeadTags.length > 0) {
    recommendations.push({
      id: 'misplaced-head-tags',
      priority: 'important',
      category: 'technique',
      icon: '🟠',
      title: 'Balise mal placée (hors du <head>)',
      description: `${htmlAnalysis.misplacedHeadTags.length > 1 ? 'Ces balises sont' : 'Cette balise est'} actuellement dans le <body>. Google l'ignore à cet emplacement, ce qui rend l'instruction inefficace et peut indiquer une erreur d'intégration ou une injection HTML. Balises concernées : ${htmlAnalysis.misplacedHeadTags.join(', ')}.`,
      weaknesses: [
        ...htmlAnalysis.misplacedHeadTags.map(tag => `Balise <${tag}> détectée dans le <body> au lieu du <head>`),
        "Google ignore les balises structurelles hors du <head>",
        "L'instruction SEO est totalement inefficace à cet emplacement",
        "Peut indiquer un plugin ou CMS qui injecte mal les balises"
      ],
      fixes: [
        ...htmlAnalysis.misplacedHeadTags.map(tag => `Déplacer la balise <${tag}> dans la section <head> du document`),
        "Vérifier les plugins/thèmes qui injectent ces balises",
        "Utiliser un validateur HTML (validator.w3.org) pour vérifier la structure du document"
      ]
    });
  }

  // Sort by priority
  const priorityOrder = { critical: 0, important: 1, optional: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  
  return recommendations;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ── IP Rate Limit (burst protection) ──
  const clientIp = getClientIp(req);
  const ipCheck = checkIpRate(clientIp, 'expert-audit', 15, 60_000);
  if (!ipCheck.allowed) return rateLimitResponse(corsHeaders, ipCheck.retryAfterMs);

  // ── Concurrency guard (max 40 simultaneous) ──
  if (!acquireConcurrency('expert-audit', 40)) return concurrencyResponse(corsHeaders);

  try {
    // ── Fair Use check (invisible daily/hourly caps) ──
    const userCtx = await getUserContext(req);
    if (userCtx) {
      const fairUse = await checkFairUse(userCtx.userId, 'expert_audit', userCtx.planType);
      if (!fairUse.allowed) {
        releaseConcurrency('expert-audit');
        return new Response(JSON.stringify({ success: false, error: fairUse.reason }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    const { url } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const normalizedUrl = normalizeUrl(url);
    const domain = extractDomain(normalizedUrl);
    
    // ── Cache check ──
    const ck = cacheKey('expert-audit', { url: normalizedUrl });
    const cached = await getCached(ck);
    if (cached) {
      console.log('[expert-audit] Cache HIT for:', normalizedUrl);
      return new Response(JSON.stringify(cached), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
      });
    }
    
    // ── Rate limiting (authenticated users) ──
    const authHeader = req.headers.get('Authorization') || '';
    if (authHeader) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
        if (supabaseUrl && supabaseKey) {
          const { createClient } = await import('npm:@supabase/supabase-js@2');
          const sb = getUserClient(authHeader);
          const { data: { user } } = await sb.auth.getUser();
          if (user) {
            const rl = await checkRateLimit(user.id, 'expert_audit', 15, 60);
            if (!rl.allowed) {
              return new Response(JSON.stringify({ success: false, error: 'Rate limit exceeded. Please wait before running another audit.', rate_limit: rl }), {
                status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
          }
        }
      } catch (e) {
        console.error('[rate-limit] check error (non-blocking):', e);
      }
    }
    
    console.log('Starting Expert Audit for:', normalizedUrl);
    
    // Run all checks in parallel
    const [psiData, safeBrowsing, htmlAnalysis, robotsAnalysis, crawlersResult, sitemapAnalysis, llmsTxtAnalysis, specializedSitemaps] = await Promise.all([
      fetchPageSpeedData(normalizedUrl),
      checkSafeBrowsing(normalizedUrl),
      analyzeHtml(normalizedUrl),
      checkRobotsTxt(normalizedUrl),
      checkCrawlers(normalizedUrl),
      checkSitemap(normalizedUrl),
      checkLlmsTxt(normalizedUrl),
      checkSpecializedSitemaps(normalizedUrl),
    ]);
    
    const psiAvailable = psiData?.lighthouseResult?.categories?.performance != null;
    const categories = psiData?.lighthouseResult?.categories || {};
    const audits = psiData?.lighthouseResult?.audits || {};
    
    // Calculate scores — when PSI unavailable, use neutral 50% fallback instead of 0
    const psiPerformance = psiAvailable ? (categories.performance?.score || 0) : null;
    const psiSeo = psiAvailable ? (categories.seo?.score || 0) : null;
    
    // A. Performance (40 pts)
    const performanceScore = psiPerformance !== null ? Math.round(psiPerformance * 40) : 20;
    
    // B. Technical (50 pts) = PSI SEO * 30 + HTTP 200 = 20
    const httpStatusOk = true;
    const technicalScore = (psiSeo !== null ? Math.round(psiSeo * 30) : 15) + (httpStatusOk ? 20 : 0);
    
    if (!psiAvailable) {
      console.warn('[Expert-Audit] ⚠️ PSI indisponible — scores Performance et Technique estimés (fallback 50%)');
    }
    
    // C. Semantic (60 pts)
    let semanticScore = 0;
    if (htmlAnalysis.hasTitle && htmlAnalysis.titleLength <= 70) semanticScore += 10;
    if (htmlAnalysis.hasMetaDesc) semanticScore += 10;
    if (htmlAnalysis.h1Count === 1) semanticScore += 20;
    if (htmlAnalysis.wordCount >= 500) semanticScore += 20;
    
    // D. AI Ready (30 pts)
    let aiReadyScore = 0;
    if (htmlAnalysis.hasSchemaOrg) {
      aiReadyScore += 15;
      if (htmlAnalysis.isSchemaJsGenerated) {
        aiReadyScore -= 3;
        console.log('[Expert-Audit] ⚠️ Schema is JS-generated — AI Ready score penalized (-3)');
      }
    }
    if (htmlAnalysis.isMetaJsGenerated) {
      aiReadyScore -= 4;
      console.log('[Expert-Audit] ⚠️ Title/Meta/OG is JS-generated — AI Ready score penalized (-4)');
    }
    if (robotsAnalysis.exists && robotsAnalysis.permissive) aiReadyScore += 15;
    
    // E. Security (20 pts) - Enhanced with HSTS
    let securityScore = 0;
    if (htmlAnalysis.isHttps) securityScore += 8;
    if (safeBrowsing.safe) securityScore += 8;
    if (htmlAnalysis.hasHSTS) securityScore += 4;
    
    const totalScore = performanceScore + technicalScore + semanticScore + aiReadyScore + securityScore;
    
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
        score: technicalScore,
        maxScore: 50,
        psiSeo: psiSeo !== null ? Math.round(psiSeo * 100) : null,
        psiUnavailable: !psiAvailable,
        httpStatus: 200,
        isHttps: htmlAnalysis.isHttps,
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
        imagesTotal: htmlAnalysis.imagesTotal,
        imagesMissingAlt: htmlAnalysis.imagesMissingAlt,
        hasGTM: htmlAnalysis.hasGTM,
        hasGA4: htmlAnalysis.hasGA4,
      },
      aiReady: {
        score: aiReadyScore,
        maxScore: 30,
        hasSchemaOrg: htmlAnalysis.hasSchemaOrg,
        schemaTypes: htmlAnalysis.schemaTypes,
        isSchemaJsGenerated: htmlAnalysis.isSchemaJsGenerated,
        isMetaJsGenerated: htmlAnalysis.isMetaJsGenerated,
        hasRobotsTxt: robotsAnalysis.exists,
        robotsPermissive: robotsAnalysis.permissive,
        allowsAIBots: crawlersResult?.allowsAIBots,
      },
      security: {
        score: securityScore,
        maxScore: 20,
        isHttps: htmlAnalysis.isHttps,
        hasHSTS: htmlAnalysis.hasHSTS,
        safeBrowsingOk: safeBrowsing.safe,
        threats: safeBrowsing.threats,
      },
    };
    
    const recommendations = generateRecommendations(scores, htmlAnalysis, psiData, crawlersResult, sitemapAnalysis, llmsTxtAnalysis, specializedSitemaps);
    
    // Generate narrative introduction using AI
    let introduction = null;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (LOVABLE_API_KEY) {
      try {
        console.log('Generating narrative introduction...');
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { 
                role: 'system', 
                content: `Tu es un expert SEO technique. Tu dois générer une introduction structurée en 3 paragraphes pour un audit technique SEO. Réponds UNIQUEMENT en JSON valide.`
              },
              { 
                role: 'user', 
                content: `Analyse les données suivantes pour le site ${domain} (${normalizedUrl}) et génère 3 paragraphes d'introduction:

DONNÉES TECHNIQUES:
- Score total: ${totalScore}/200
- Performance: ${performanceScore}/40 (LCP: ${(audits['largest-contentful-paint']?.numericValue / 1000).toFixed(1)}s, TBT: ${Math.round(audits['total-blocking-time']?.numericValue || 0)}ms)
- Technique SEO: ${technicalScore}/50 (Score PSI SEO: ${Math.round(psiSeo * 100)}%)
- Sémantique: ${semanticScore}/60 (Titre: ${htmlAnalysis.hasTitle ? 'oui' : 'non'}, Meta desc: ${htmlAnalysis.hasMetaDesc ? 'oui' : 'non'}, H1: ${htmlAnalysis.h1Count}, Mots: ${htmlAnalysis.wordCount})
- Préparation IA: ${aiReadyScore}/30 (Schema.org: ${htmlAnalysis.hasSchemaOrg ? 'oui' : 'non'}, Types: ${htmlAnalysis.schemaTypes.join(', ') || 'aucun'})
- Sécurité: ${securityScore}/20 (HTTPS: ${htmlAnalysis.isHttps ? 'oui' : 'non'})
- Titre: "${htmlAnalysis.titleContent}"
- Meta description: "${htmlAnalysis.metaDescContent?.substring(0, 100) || 'absente'}"

Réponds avec ce JSON exact (RÈGLE: présentation + strengths + improvement = 1400 caractères MAX au total, espaces compris. Nombre de phrases libre, répartition libre entre les 3 champs):
{
  "presentation": "Présentation concise du site, core business, secteur et zone géographique.",
  "strengths": "Atouts techniques ET sémantiques/référencement.",
  "improvement": "Données moins bonnes et pourquoi c'est prioritaire à corriger."
}`
              }
            ],
            temperature: 0.4,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content;

          // Track token usage
          trackTokenUsage('expert-audit', 'google/gemini-2.5-flash', aiData.usage, normalizedUrl);

          if (content) {
            let jsonContent = content;
            if (content.includes('```json')) {
              jsonContent = content.split('```json')[1].split('```')[0].trim();
            } else if (content.includes('```')) {
              jsonContent = content.split('```')[1].split('```')[0].trim();
            }
            introduction = JSON.parse(jsonContent);
            console.log('Narrative introduction generated successfully');
          }
        } else {
          console.error('AI introduction generation failed:', aiResponse.status);
        }
      } catch (aiError) {
        console.error('Error generating introduction:', aiError);
        // Continue without introduction - not critical
      }
    }
    
    console.log('Expert Audit complete. Score:', totalScore, '/200');
    
    // Sauvegarder les recommandations dans le registre (async, non-bloquant)
    const registryAuthHeader = req.headers.get('Authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    
    if (registryAuthHeader && supabaseUrl && supabaseKey) {
      // Lancer en arrière-plan (ne pas bloquer la réponse)
      saveRecommendationsToRegistry(
        supabaseUrl,
        supabaseKey,
        registryAuthHeader,
        domain,
        normalizedUrl,
        'technical',
        recommendations
      ).catch(err => console.error('Erreur sauvegarde registre:', err));
    }
    
    // ═══ SPA DETECTION FLAG ═══
    const isSPA = !!(htmlAnalysis.hasSPAMarkers && htmlAnalysis.isContentJSDependent);

    const responseBody = {
      success: true,
      data: {
        url: normalizedUrl,
        domain,
        scannedAt: new Date().toISOString(),
        totalScore,
        maxScore: 200,
        isSPA,
        scores,
        recommendations,
        introduction,
        rawData: {
          psi: { categories, audits: Object.keys(audits).slice(0, 10) },
          safeBrowsing,
          htmlAnalysis,
          robotsAnalysis,
          crawlersData: crawlersResult,
          sitemapAnalysis,
          llmsTxtAnalysis,
          specializedSitemaps,
        }
      }
    };

    // Store in cache (async, non-blocking) — TTL 60 min
    setCache(ck, 'expert-audit', responseBody, 60).catch(e => console.error('[cache] write error:', e));

    // Fire-and-forget URL tracking
    trackAnalyzedUrl(normalizedUrl).catch(() => {});

    return new Response(
      JSON.stringify(responseBody),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' } }
    );
    
  } catch (error) {
    console.error('Expert Audit error:', error);
    await trackEdgeFunctionError('expert-audit', error instanceof Error ? error.message : 'Audit failed').catch(() => {});
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Audit failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } finally {
    releaseConcurrency('expert-audit');
  }
});
