import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { trackPaidApiCall } from '../_shared/tokenTracker.ts';
import { saveRawAuditData } from '../_shared/saveRawAuditData.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const FIRECRAWL_API = 'https://api.firecrawl.dev/v1';
const SPIDER_API = 'https://api.spider.cloud';
const MAX_GLOBAL_CONCURRENT = 20;

// ── Types ──────────────────────────────────────────────────
interface PageAnalysis {
  url: string;
  path: string;
  http_status: number;
  title: string | null;
  meta_description: string | null;
  h1: string | null;
  h2_count: number;
  h3_count: number;
  h4_h6_count: number;
  has_schema_org: boolean;
  has_canonical: boolean;
  canonical_url: string | null;
  has_hreflang: boolean;
  has_og: boolean;
  has_noindex: boolean;
  has_nofollow: boolean;
  word_count: number;
  images_total: number;
  images_without_alt: number;
  internal_links: number;
  external_links: number;
  broken_links: string[];
  anchor_texts: { href: string; text: string; type: 'internal' | 'external' }[];
  response_time_ms: number | null;
  redirect_url: string | null;
  seo_score: number;
  issues: string[];
  content_hash: string | null;
  schema_org_types: string[];
  schema_org_errors: string[];
  custom_extraction: Record<string, string>;
  crawl_depth: number;
  html_size_bytes: number;
  body_text_truncated: string | null;
}

interface CustomSelector {
  name: string;
  selector: string;
  type: 'css' | 'xpath';
}

// ── Simple hash for near-duplicate detection ───────────────
function simpleHash(text: string): string {
  // Normalize: lowercase, collapse whitespace, remove punctuation
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  // Simple FNV-1a-like hash
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// ── Schema.org Validation ──────────────────────────────────
function validateSchemaOrg(html: string): { types: string[]; errors: string[] } {
  const types: string[] = [];
  const errors: string[] = [];

  // Extract JSON-LD blocks
  const jsonLdRegex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let blockCount = 0;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    blockCount++;
    try {
      const data = JSON.parse(match[1].trim());
      const items = Array.isArray(data) ? data : [data];
      
      for (const item of items) {
        // Check @graph
        const entities = item['@graph'] ? item['@graph'] : [item];
        for (const entity of entities) {
          const type = entity['@type'];
          if (type) {
            const typeStr = Array.isArray(type) ? type.join(', ') : type;
            types.push(typeStr);
          } else {
            errors.push('missing_@type');
          }

          // Validate required fields per type
          if (!entity['@context'] && !item['@context']) {
            errors.push('missing_@context');
          }

          const t = Array.isArray(entity['@type']) ? entity['@type'][0] : entity['@type'];
          if (t === 'Organization' || t === 'LocalBusiness') {
            if (!entity.name) errors.push(`${t}: missing name`);
            if (!entity.url) errors.push(`${t}: missing url`);
          }
          if (t === 'Article' || t === 'BlogPosting' || t === 'NewsArticle') {
            if (!entity.headline) errors.push(`${t}: missing headline`);
            if (!entity.author) errors.push(`${t}: missing author`);
            if (!entity.datePublished) errors.push(`${t}: missing datePublished`);
          }
          if (t === 'Product') {
            if (!entity.name) errors.push(`Product: missing name`);
            if (!entity.offers) errors.push(`Product: missing offers`);
          }
          if (t === 'BreadcrumbList') {
            if (!entity.itemListElement || !Array.isArray(entity.itemListElement) || entity.itemListElement.length === 0) {
              errors.push('BreadcrumbList: empty itemListElement');
            }
          }
          if (t === 'FAQPage') {
            if (!entity.mainEntity || !Array.isArray(entity.mainEntity) || entity.mainEntity.length === 0) {
              errors.push('FAQPage: empty mainEntity');
            }
          }
        }
      }
    } catch (e) {
      errors.push(`json_ld_parse_error: block ${blockCount}`);
    }
  }

  // Check microdata
  const microdataRegex = /itemtype\s*=\s*["']https?:\/\/schema\.org\/([^"']+)["']/gi;
  let mdMatch;
  while ((mdMatch = microdataRegex.exec(html)) !== null) {
    types.push(mdMatch[1]);
  }

  if (blockCount === 0 && types.length === 0) {
    errors.push('no_structured_data_found');
  }

  return { types: [...new Set(types)], errors: [...new Set(errors)] };
}

// ── Custom CSS selector extraction ─────────────────────────
function extractCustomSelectors(html: string, selectors: CustomSelector[]): Record<string, string> {
  const result: Record<string, string> = {};
  
  for (const sel of selectors) {
    if (sel.type !== 'css') continue; // Only CSS selectors supported server-side
    
    try {
      // Simple CSS selector extraction via regex patterns for common selectors
      let extracted = '';
      const s = sel.selector.trim();
      
      // ID selector: #myid
      if (s.startsWith('#')) {
        const id = s.slice(1).replace(/[^\w-]/g, '');
        const regex = new RegExp(`<[^>]+id\\s*=\\s*["']${id}["'][^>]*>([\\s\\S]*?)<\\/`, 'i');
        const m = html.match(regex);
        if (m) extracted = m[1].replace(/<[^>]+>/g, '').trim().substring(0, 500);
      }
      // Class selector: .myclass
      else if (s.startsWith('.')) {
        const cls = s.slice(1).replace(/[^\w-]/g, '');
        const regex = new RegExp(`<[^>]+class\\s*=\\s*["'][^"']*\\b${cls}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/`, 'i');
        const m = html.match(regex);
        if (m) extracted = m[1].replace(/<[^>]+>/g, '').trim().substring(0, 500);
      }
      // Tag selector
      else if (/^[a-z]+$/i.test(s)) {
        const regex = new RegExp(`<${s}[^>]*>([\\s\\S]*?)<\\/${s}>`, 'i');
        const m = html.match(regex);
        if (m) extracted = m[1].replace(/<[^>]+>/g, '').trim().substring(0, 500);
      }
      // Attribute selector: [data-x="y"]
      else if (s.startsWith('[')) {
        const attrMatch = s.match(/\[([^\]=]+)(?:=["']([^"']*)["'])?\]/);
        if (attrMatch) {
          const attrName = attrMatch[1];
          const attrVal = attrMatch[2];
          const pattern = attrVal 
            ? `<[^>]+${attrName}\\s*=\\s*["']${attrVal}["'][^>]*>([\\s\\S]*?)<\\/`
            : `<[^>]+${attrName}[^>]*>([\\s\\S]*?)<\\/`;
          const regex = new RegExp(pattern, 'i');
          const m = html.match(regex);
          if (m) extracted = m[1].replace(/<[^>]+>/g, '').trim().substring(0, 500);
        }
      }
      // meta[name="x"] → extract content attribute
      else if (s.includes('meta[name=')) {
        const nameMatch = s.match(/meta\[name=["']([^"']+)["']\]/);
        if (nameMatch) {
          const regex = new RegExp(`<meta[^>]+name\\s*=\\s*["']${nameMatch[1]}["'][^>]+content\\s*=\\s*["']([^"']+)["']`, 'i');
          const m = html.match(regex);
          if (m) extracted = m[1].trim();
        }
      }
      
      result[sel.name] = extracted || '';
    } catch {
      result[sel.name] = '';
    }
  }
  
  return result;
}

// ── SPA Detection ──────────────────────────────────────────
function detectSPAMarkers(html: string): { isSPA: boolean; framework?: string } {
  const hasSPAMarker =
    /<div\s+id=["'](app|root|__next|__nuxt)["'][^>]*>/i.test(html) ||
    /data-reactroot/i.test(html) ||
    /<app-root/i.test(html);

  let framework: string | undefined;
  if (/__NEXT_DATA__/i.test(html)) framework = 'Next.js';
  else if (/__NUXT__/i.test(html)) framework = 'Nuxt';
  else if (/data-reactroot|__REACT|ReactDOM/i.test(html)) framework = 'React';
  else if (/__VUE__|Vue\.createApp/i.test(html)) framework = 'Vue';
  else if (/ng-version|<app-root/i.test(html)) framework = 'Angular';

  return { isSPA: hasSPAMarker || !!framework, framework };
}

// ── Browserless rendering ──────────────────────────────────
async function renderWithBrowserless(url: string, renderingKey: string): Promise<{ html: string | null; responseTime: number }> {
  const start = Date.now();
  try {
    const response = await fetch(`https://production-sfo.browserless.io/content?token=${renderingKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        gotoOptions: { waitUntil: 'networkidle2', timeout: 20000 },
        waitForSelector: { selector: 'body', timeout: 5000 },
      }),
      signal: AbortSignal.timeout(25000),
    });
    const responseTime = Date.now() - start;

    if (response.ok) {
      const html = await response.text();
      await trackPaidApiCall('process-crawl-queue', 'browserless', '/content', url).catch(() => {});
      return { html, responseTime };
    }
    console.warn(`[Worker] Browserless error ${response.status} for ${url}`);
    return { html: null, responseTime };
  } catch (e) {
    console.warn(`[Worker] Browserless failed for ${url}:`, e instanceof Error ? e.message : e);
    return { html: null, responseTime: Date.now() - start };
  }
}

// ── Score SEO (sur 200) ────────────────────────────────────
function computePageScore(page: Omit<PageAnalysis, 'seo_score'>): number {
  let score = 0;
  if (page.title && page.title.length > 0 && page.title.length <= 60) score += 15;
  else if (page.title) score += 8;
  if (page.meta_description && page.meta_description.length >= 50 && page.meta_description.length <= 160) score += 15;
  else if (page.meta_description) score += 8;
  if (page.h1) score += 15;
  if (page.h2_count >= 2) score += 5;
  else if (page.h2_count >= 1) score += 3;
  if (page.h3_count >= 1) score += 3;
  if (page.h4_h6_count >= 1) score += 2;
  if (page.word_count >= 300) score += 15;
  else if (page.word_count >= 100) score += 8;
  if (page.http_status === 200) score += 15;
  if (page.has_canonical) score += 15;
  if (page.has_schema_org) score += 15;
  // Bonus: validated schema with no errors
  if (page.schema_org_errors.length === 0 && page.schema_org_types.length > 0) score += 5;
  if (page.has_og) score += 10;
  if (page.images_total === 0 || page.images_without_alt === 0) score += 25;
  else score += Math.max(0, 25 - (page.images_without_alt / page.images_total) * 25);
  if (page.internal_links >= 3) score += 10;
  else if (page.internal_links >= 1) score += 5;
  if (page.external_links >= 1) score += 5;
  if (page.has_hreflang) score += 10;
  if (page.has_noindex) score -= 10;
  if (page.has_nofollow) score -= 10;
  return Math.round(Math.min(200, Math.max(0, score)));
}

// ── HTML Analysis (Screaming Frog-level) ───────────────────
function analyzeHtml(
  html: string, 
  pageUrl: string, 
  domain: string, 
  responseTime: number | null,
  customSelectors: CustomSelector[] = [],
  depth: number = 0,
): Omit<PageAnalysis, 'seo_score'> {
  let path = '/';
  try { path = new URL(pageUrl).pathname; } catch {}

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || null : null;

  const metaDescPatterns = [
    /<meta\s[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([\s\S]*?)["'][^>]*\/?>/i,
    /<meta\s[^>]*content\s*=\s*["']([\s\S]*?)["'][^>]*name\s*=\s*["']description["'][^>]*\/?>/i,
  ];
  let meta_description: string | null = null;
  for (const pattern of metaDescPatterns) {
    const m = html.match(pattern);
    if (m) { meta_description = m[1].replace(/\s+/g, ' ').trim(); break; }
  }

  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || null : null;
  const h2_count = (html.match(/<h2[\s>]/gi) || []).length;
  const h3_count = (html.match(/<h3[\s>]/gi) || []).length;
  const h4_h6_count = (html.match(/<h4[\s>]/gi) || []).length + (html.match(/<h5[\s>]/gi) || []).length + (html.match(/<h6[\s>]/gi) || []).length;

  const has_schema_org = /application\/ld\+json/i.test(html) || /itemtype\s*=\s*["']https?:\/\/schema\.org/i.test(html);
  
  // Detailed Schema.org validation
  const schemaValidation = validateSchemaOrg(html);

  const has_canonical = /<link[^>]+rel\s*=\s*["']canonical["']/i.test(html);
  let canonical_url: string | null = null;
  const canonicalMatch = html.match(/<link[^>]+rel\s*=\s*["']canonical["'][^>]+href\s*=\s*["']([^"']+)["']/i)
    || html.match(/<link[^>]+href\s*=\s*["']([^"']+)["'][^>]+rel\s*=\s*["']canonical["']/i);
  if (canonicalMatch) canonical_url = canonicalMatch[1].trim();

  const has_hreflang = /<link[^>]+hreflang/i.test(html);
  const has_og = /<meta[^>]+property\s*=\s*["']og:/i.test(html);

  const robotsMetaPatterns = [
    /<meta\s[^>]*name\s*=\s*["']robots["'][^>]*content\s*=\s*["']([^"']+)["']/i,
    /<meta\s[^>]*content\s*=\s*["']([^"']+)["'][^>]*name\s*=\s*["']robots["']/i,
  ];
  let robotsContent = '';
  for (const pattern of robotsMetaPatterns) {
    const m = html.match(pattern);
    if (m) { robotsContent = m[1].toLowerCase(); break; }
  }
  const has_noindex = robotsContent.includes('noindex');
  const has_nofollow = robotsContent.includes('nofollow');

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  let bodyText = '';
  let bodyTextFull = ''; // Full text including nav/header/footer for semantic analysis
  if (bodyMatch) {
    // Full body text (for semantic storage)
    bodyTextFull = bodyMatch[1]
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // Main content only (for word count / SEO scoring)
    bodyText = bodyMatch[1]
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const word_count = bodyText.split(/\s+/).filter(w => w.length > 1).length;
  // Truncated body text for Cocoon semantic analysis (TF-IDF, clustering)
  const body_text_truncated = bodyTextFull.substring(0, 5000) || null;

  // Content hash for near-duplicate detection
  const content_hash = bodyText.length > 50 ? simpleHash(bodyText) : null;

  const imgMatches = html.match(/<img[^>]*>/gi) || [];
  const images_total = imgMatches.length;
  const images_without_alt = imgMatches.filter(img => {
    if (!/alt\s*=/i.test(img)) return true;
    const altVal = img.match(/alt\s*=\s*["']([\s\S]*?)["']/i);
    return !altVal || altVal[1].trim().length === 0;
  }).length;

  const linkRegex = /<a\s[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let internal_links = 0, external_links = 0;
  const anchor_texts: { href: string; text: string; type: 'internal' | 'external' }[] = [];
  let linkMatch;

  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const href = linkMatch[1].trim();
    const anchorText = linkMatch[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue;
    if (href.startsWith('/') || href.includes(domain)) {
      internal_links++;
      if (anchorText && anchor_texts.length < 50) {
        anchor_texts.push({ href, text: anchorText.substring(0, 100), type: 'internal' });
      }
    } else if (href.startsWith('http')) {
      external_links++;
      if (anchorText && anchor_texts.length < 50) {
        anchor_texts.push({ href, text: anchorText.substring(0, 100), type: 'external' });
      }
    }
  }

  // Custom extraction
  const custom_extraction = customSelectors.length > 0 ? extractCustomSelectors(html, customSelectors) : {};

  const issues: string[] = [];
  if (!title) issues.push('missing_title');
  else if (title.length > 60) issues.push('title_too_long');
  else if (title.length < 30) issues.push('title_too_short');
  if (!meta_description) issues.push('missing_meta_description');
  else if (meta_description.length > 160) issues.push('meta_description_too_long');
  else if (meta_description.length < 50) issues.push('meta_description_too_short');
  if (!h1) issues.push('missing_h1');
  if ((html.match(/<h1[\s>]/gi) || []).length > 1) issues.push('multiple_h1');
  if (h2_count === 0 && word_count > 200) issues.push('missing_h2');
  if (word_count < 100) issues.push('thin_content');
  if (!has_schema_org) issues.push('missing_schema_org');
  if (has_schema_org && schemaValidation.errors.length > 0) issues.push('schema_org_errors');
  if (!has_canonical) issues.push('missing_canonical');
  if (!has_og) issues.push('missing_og');
  if (has_noindex) issues.push('noindex');
  if (has_nofollow) issues.push('nofollow');
  if (images_without_alt > 0) issues.push(`${images_without_alt}_images_without_alt`);
  if (internal_links === 0) issues.push('orphan_page');
  if (canonical_url && canonical_url !== pageUrl && canonical_url !== pageUrl.replace(/\/$/, '')) {
    issues.push('canonical_mismatch');
  }

  const html_size_bytes = new TextEncoder().encode(html).length;

  return {
    url: pageUrl, path, http_status: 200, title, meta_description, h1,
    h2_count, h3_count, h4_h6_count,
    has_schema_org, has_canonical, canonical_url, has_hreflang, has_og,
    has_noindex, has_nofollow,
    word_count, images_total, images_without_alt,
    internal_links, external_links, broken_links: [],
    anchor_texts,
    response_time_ms: responseTime,
    redirect_url: null,
    issues,
    content_hash,
    schema_org_types: schemaValidation.types,
    schema_org_errors: schemaValidation.errors,
    custom_extraction,
    crawl_depth: depth,
    html_size_bytes,
    body_text_truncated: body_text_truncated,
  };
}

// ── Scrape a single page ───────────────────────────────────
async function scrapePage(
  pageUrl: string,
  domain: string,
  firecrawlKey: string,
  useBrowserless: boolean,
  renderingKey: string | null,
  customSelectors: CustomSelector[] = [],
  depth: number = 0,
): Promise<PageAnalysis | null> {
  try {
    let html = '';
    let statusCode = 200;
    let responseTime: number | null = null;
    let redirectUrl: string | null = null;

    try {
      const { fetchAndRenderPage } = await import('../_shared/renderPage.ts');
      const renderResult = await fetchAndRenderPage(pageUrl, {
        timeout: 10000,
        forceRender: useBrowserless,
      });

      if (renderResult.html.length > 500) {
        html = renderResult.html;
        console.log(
          `[Worker] ${renderResult.usedRendering ? 'rendered' : 'fetched'} ${pageUrl} (${renderResult.html.length} chars${renderResult.framework ? `, ${renderResult.framework}` : ''})`
        );
      }
    } catch (renderErr) {
      console.warn(`[Worker] fetchAndRenderPage failed for ${pageUrl}:`, renderErr);
    }

    // ── Spider.cloud PRIMARY → Firecrawl FALLBACK ──
    if (!html || html.length < 500) {
      const spiderKey = Deno.env.get('SPIDER_API_KEY');
      let spiderOk = false;

      if (spiderKey) {
        try {
          console.log(`[Worker] HTML insufficient for ${pageUrl}, trying Spider.cloud...`);
          const fetchStart2 = Date.now();
          const spiderRes = await fetch(`${SPIDER_API}/crawl`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${spiderKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: pageUrl, limit: 1, return_format: 'raw', request: 'http' }),
          });
          responseTime = Date.now() - fetchStart2;
          if (spiderRes.ok) {
            const spiderData = await spiderRes.json();
            const page = Array.isArray(spiderData) ? spiderData[0] : spiderData;
            const spiderHtml = page?.content || '';
            if (spiderHtml.length > 500) {
              html = spiderHtml;
              statusCode = page?.status || 200;
              spiderOk = true;
              console.log(`[Worker] ✅ Spider.cloud OK for ${pageUrl} (${html.length} chars)`);
              await trackPaidApiCall('process-crawl-queue', 'spider', '/crawl', pageUrl).catch(() => {});
            }
          }
        } catch (e) {
          console.warn(`[Worker] Spider.cloud failed for ${pageUrl}:`, e);
        }
      }

      if (!spiderOk) {
        console.log(`[Worker] Falling back to Firecrawl for ${pageUrl}...`);
        const fetchStart3 = Date.now();
        const res = await fetch(`${FIRECRAWL_API}/scrape`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: pageUrl, formats: ['rawHtml'], onlyMainContent: false, waitFor: 3000 }),
        });
        responseTime = Date.now() - fetchStart3;
        const data = await res.json();
        html = data?.data?.rawHtml || data?.rawHtml || data?.data?.html || data?.html || '';
        statusCode = data?.data?.metadata?.statusCode || 200;

        const sourceUrl = data?.data?.metadata?.sourceURL;
        if (sourceUrl && sourceUrl !== pageUrl) {
          redirectUrl = sourceUrl;
        }

        await trackPaidApiCall('process-crawl-queue', 'firecrawl', '/scrape', pageUrl).catch(() => {});
      }
    }

    if (!html) return null;

    const analysis = analyzeHtml(html, pageUrl, domain, responseTime, customSelectors, depth);
    analysis.http_status = statusCode;
    if (redirectUrl) analysis.redirect_url = redirectUrl;
    const seo_score = computePageScore(analysis);
    return { ...analysis, seo_score } as PageAnalysis;
  } catch (e) {
    console.warn(`[Worker] Scrape error ${pageUrl}:`, e);
    return null;
  }
}

// ── SPA probe ──────────────────────────────────────────────
async function probeSPAStatus(
  firstUrl: string,
  domain: string,
  firecrawlKey: string,
  renderingKey: string | null,
): Promise<{ isSPA: boolean; firstPageResult: PageAnalysis | null }> {
  const result = await scrapePage(firstUrl, domain, firecrawlKey, false, null);
  if (!result) return { isSPA: false, firstPageResult: null };

  const isThinContent = result.word_count < 50;

  // ── Enhanced SPA detection: also check for shell-like title/H1 ──
  // If the first page has an identical title across all SPA pages (shell title),
  // it's a SPA even if word count > 50 (skeleton HTML can contain text)
  const isShellLikeTitle = !isThinContent && result.title && (
    // Common SPA patterns: title doesn't mention the page path
    (() => {
      try {
        const path = new URL(firstUrl).pathname;
        // If we're NOT on the homepage and the title doesn't relate to the path at all,
        // it's likely the shell fallback title
        if (path !== '/' && path !== '') {
          const pathWords = path.replace(/[^a-zA-ZÀ-ÿ]/g, ' ').trim().toLowerCase().split(/\s+/).filter(w => w.length > 3);
          const titleLower = (result.title || '').toLowerCase();
          // If none of the significant path words appear in the title, it's likely a shell
          if (pathWords.length > 0 && !pathWords.some(w => titleLower.includes(w))) {
            return true;
          }
        }
      } catch {}
      return false;
    })()
  );

  const needsJSRender = isThinContent || isShellLikeTitle;
  if (!needsJSRender) return { isSPA: false, firstPageResult: result };

  if (!renderingKey) {
    const reason = isThinContent ? `thin content (${result.word_count} words)` : `shell-like title detected`;
    console.log(`[Worker] ${reason} on ${firstUrl} but no RENDERING_API_KEY`);
    // Fallback: try Firecrawl with JS rendering (waitFor)
    const firecrawlResult = await scrapePage(firstUrl, domain, firecrawlKey, false, null);
    if (firecrawlResult && firecrawlResult.title !== result.title) {
      console.log(`[Worker] ✅ SPA confirmed via Firecrawl: title changed from "${result.title}" to "${firecrawlResult.title}"`);
      return { isSPA: true, firstPageResult: firecrawlResult };
    }
    return { isSPA: false, firstPageResult: result };
  }

  const reason = isThinContent ? `thin content (${result.word_count} words)` : `shell-like title "${result.title?.slice(0, 50)}"`;
  console.log(`[Worker] 🔍 ${reason} on ${firstUrl} — probing with Browserless...`);
  const renderedResult = await scrapePage(firstUrl, domain, firecrawlKey, true, renderingKey);

  if (renderedResult) {
    const titleChanged = renderedResult.title && renderedResult.title !== result.title;
    const contentGrew = renderedResult.word_count > result.word_count * 2 && renderedResult.word_count > 50;
    
    if (titleChanged || contentGrew) {
      console.log(`[Worker] ✅ SPA confirmed: title "${result.title?.slice(0, 40)}" → "${renderedResult.title?.slice(0, 40)}", words ${result.word_count} → ${renderedResult.word_count}`);
      return { isSPA: true, firstPageResult: renderedResult };
    }
  }

  console.log(`[Worker] ❌ Not a SPA (Browserless: ${renderedResult?.word_count || 0} words, title: ${renderedResult?.title?.slice(0, 40) || 'null'})`);
  return { isSPA: false, firstPageResult: result };
}

// ── Cross-page duplicate detection (title/meta + content hash) ──
function detectDuplicates(pages: PageAnalysis[]): Record<string, string[]> {
  const titleMap: Record<string, string[]> = {};
  const metaMap: Record<string, string[]> = {};
  const hashMap: Record<string, string[]> = {};
  const duplicateIssues: Record<string, string[]> = {};

  for (const page of pages) {
    if (page.title) {
      const key = page.title.toLowerCase().trim();
      if (!titleMap[key]) titleMap[key] = [];
      titleMap[key].push(page.url);
    }
    if (page.meta_description) {
      const key = page.meta_description.toLowerCase().trim();
      if (!metaMap[key]) metaMap[key] = [];
      metaMap[key].push(page.url);
    }
    if (page.content_hash) {
      if (!hashMap[page.content_hash]) hashMap[page.content_hash] = [];
      hashMap[page.content_hash].push(page.url);
    }
  }

  for (const [, urls] of Object.entries(titleMap)) {
    if (urls.length > 1) {
      for (const url of urls) {
        if (!duplicateIssues[url]) duplicateIssues[url] = [];
        duplicateIssues[url].push('duplicate_title');
      }
    }
  }
  for (const [, urls] of Object.entries(metaMap)) {
    if (urls.length > 1) {
      for (const url of urls) {
        if (!duplicateIssues[url]) duplicateIssues[url] = [];
        duplicateIssues[url].push('duplicate_meta_description');
      }
    }
  }
  // Near-duplicate content detection via hash
  for (const [, urls] of Object.entries(hashMap)) {
    if (urls.length > 1) {
      for (const url of urls) {
        if (!duplicateIssues[url]) duplicateIssues[url] = [];
        duplicateIssues[url].push('near_duplicate_content');
      }
    }
  }

  return duplicateIssues;
}

// ── Compute crawl depth via BFS on internal link graph ─────
function computeBFSDepths(pages: PageAnalysis[], baseUrl: string): Map<string, number> {
  const depths = new Map<string, number>();
  
  // Normalize URL for comparison
  const normalize = (u: string) => {
    try { return new URL(u).pathname.replace(/\/$/, '') || '/'; } catch { return u; }
  };
  
  const basePath = normalize(baseUrl);
  const allPaths = new Set(pages.map(p => normalize(p.url)));
  
  // Build adjacency list from anchor_texts (internal links)
  const adj = new Map<string, Set<string>>();
  for (const page of pages) {
    const srcPath = normalize(page.url);
    if (!adj.has(srcPath)) adj.set(srcPath, new Set());
    for (const link of (page.anchor_texts || [])) {
      if (link.type === 'internal') {
        const targetPath = normalize(link.href.startsWith('/') ? `https://x${link.href}` : link.href);
        if (allPaths.has(targetPath)) {
          adj.get(srcPath)!.add(targetPath);
        }
      }
    }
  }
  
  // BFS from base path
  depths.set(basePath, 0);
  const queue = [basePath];
  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    const currentDepth = depths.get(current)!;
    const neighbors = adj.get(current) || new Set();
    for (const neighbor of neighbors) {
      if (!depths.has(neighbor)) {
        depths.set(neighbor, currentDepth + 1);
        queue.push(neighbor);
      }
    }
  }
  
  // Pages not reachable from root get URL-based fallback depth
  for (const page of pages) {
    const path = normalize(page.url);
    if (!depths.has(path)) {
      depths.set(path, path.split('/').filter(Boolean).length);
    }
  }
  
  return depths;
}

// ── Fallback: compute depth from URL structure ─────────────
function computeDepth(pageUrl: string, baseUrl: string): number {
  try {
    const basePath = new URL(baseUrl).pathname.replace(/\/$/, '');
    const pagePath = new URL(pageUrl).pathname.replace(/\/$/, '');
    
    if (pagePath === basePath || pagePath === '') return 0;
    
    const relativePath = pagePath.startsWith(basePath) 
      ? pagePath.slice(basePath.length) 
      : pagePath;
    
    return relativePath.split('/').filter(Boolean).length;
  } catch {
    return 0;
  }
}

/**
 * process-crawl-queue — Async worker (Screaming Frog-level analysis)
 */
Deno.serve(handleRequest(async (req) => {
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY')!;
  const renderingKey = Deno.env.get('RENDERING_API_KEY') || null;

  const supabase = getServiceClient();

  const WATCHDOG_MS = 360_000;
  const startTime = Date.now();
  const isTimeUp = () => Date.now() - startTime > WATCHDOG_MS;

  try {
    const { data: jobs, error: fetchError } = await supabase
      .from('crawl_jobs')
      .select('*')
      .in('status', ['pending', 'processing'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(10);

    if (fetchError || !jobs || jobs.length === 0) {
      return jsonOk({ success: true, message: 'No jobs to process' });
    }

    console.log(`[Worker] Found ${jobs.length} active jobs`);
    let globalPagesProcessed = 0;
    const failedUrlsByJob = new Map<string, Array<{ url: string; reason: string }>>();

    for (const job of jobs) {
      if (globalPagesProcessed >= MAX_GLOBAL_CONCURRENT || isTimeUp()) {
        if (isTimeUp()) console.log(`[Worker] ⏱️ Watchdog triggered after ${Math.round((Date.now() - startTime) / 1000)}s — stopping gracefully`);
        else console.log(`[Worker] Global limit reached (${MAX_GLOBAL_CONCURRENT}), stopping`);
        break;
      }

      const urlsToProcess: string[] = (job.urls_to_process as string[]) || [];
      const customSelectors: CustomSelector[] = (job.custom_selectors as CustomSelector[]) || [];
      const maxDepth: number = job.max_depth || 0;
      const urlFilter: string | null = job.url_filter || null;
      let alreadyProcessed = job.processed_count || 0;

      const { count: persistedPageCount } = await supabase
        .from('crawl_pages')
        .select('id', { count: 'exact', head: true })
        .eq('crawl_id', job.crawl_id);

      const reconciledProcessedCount = Math.max(alreadyProcessed, persistedPageCount || 0);
      if (reconciledProcessedCount !== alreadyProcessed) {
        console.log(`[Worker] Job ${job.id}: checkpoint recovered ${alreadyProcessed} → ${reconciledProcessedCount}`);
        alreadyProcessed = reconciledProcessedCount;
        await supabase.from('crawl_jobs').update({ processed_count: reconciledProcessedCount }).eq('id', job.id);
        await supabase.from('site_crawls').update({ crawled_pages: reconciledProcessedCount }).eq('id', job.crawl_id);
      }

      let remaining = urlsToProcess.slice(alreadyProcessed);

      // Apply URL regex filter if set
      if (urlFilter) {
        try {
          const regex = new RegExp(urlFilter);
          remaining = remaining.filter(u => regex.test(u));
        } catch {
          console.warn(`[Worker] Invalid URL filter regex: ${urlFilter}`);
        }
      }

      // Apply max depth filter if set (> 0)
      if (maxDepth > 0) {
        remaining = remaining.filter(u => computeDepth(u, job.url) <= maxDepth);
      }

      if (remaining.length === 0) {
        await finalizeJob(supabase, { ...job, processed_count: alreadyProcessed }, firecrawlKey, failedUrlsByJob.get(job.id) || []);
        continue;
      }

      if (job.status === 'pending') {
        await supabase.from('crawl_jobs').update({
          status: 'processing',
          started_at: new Date().toISOString(),
        }).eq('id', job.id);
        await supabase.from('site_crawls').update({ status: 'crawling' }).eq('id', job.crawl_id);
      }

      // SPA Probe on first batch
      let useBrowserless = false;
      let firstPageResult: PageAnalysis | null = null;
      let probeSize = 0;

      if (alreadyProcessed === 0) {
        const probe = await probeSPAStatus(remaining[0], job.domain, firecrawlKey, renderingKey);
        useBrowserless = probe.isSPA;
        firstPageResult = probe.firstPageResult;
        probeSize = firstPageResult?.html_size_bytes || 0;
        if (firstPageResult) {
          firstPageResult.crawl_depth = computeDepth(remaining[0], job.url);
        }
        if (useBrowserless) {
          console.log(`[Worker] Job ${job.id}: 🌐 SPA mode enabled`);
        }
      } else {
        // Resume probe to calibrate batch size
        try {
          const probeResp = await fetch(remaining[0], { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(10_000) });
          const probeBody = await probeResp.text();
          probeSize = new TextEncoder().encode(probeBody).length;
          console.log(`[Worker] Job ${job.id}: resume probe ${Math.round(probeSize/1024)}KB on ${remaining[0]}`);
        } catch (e) {
          console.warn(`[Worker] Job ${job.id}: resume probe failed, using conservative batch`);
          probeSize = 200_000;
        }
      }

      // Save probe result if we have one
      if (firstPageResult) {
        const rows = [{ crawl_id: job.crawl_id, ...firstPageResult }];
        await supabase.from('crawl_pages').upsert(rows, { onConflict: 'crawl_id,url', ignoreDuplicates: true });
        alreadyProcessed += 1;
        globalPagesProcessed += 1;
        await supabase.from('crawl_jobs').update({ processed_count: alreadyProcessed }).eq('id', job.id);
        await supabase.from('site_crawls').update({ crawled_pages: alreadyProcessed }).eq('id', job.crawl_id);
        remaining = remaining.slice(1);
        console.log(`[Worker] Job ${job.id}: probe saved, ${alreadyProcessed}/${job.total_count}`);
      }

      // ── INNER LOOP: keep processing pages while time allows ──
      while (remaining.length > 0 && !isTimeUp() && globalPagesProcessed < MAX_GLOBAL_CONCURRENT) {
        // ── Check if crawl was stopped by user ──
        const { data: crawlCheck } = await supabase
          .from('site_crawls')
          .select('status')
          .eq('id', job.crawl_id)
          .single();
        if (crawlCheck?.status === 'stopped') {
          console.log(`[Worker] Job ${job.id}: 🛑 Crawl stopped by user — preserving ${alreadyProcessed} cached pages`);
          await supabase.from('crawl_jobs').update({ status: 'cancelled' }).eq('id', job.id);
          break;
        }

        // Re-calibrate batch size based on page weight
        const dynamicMax = probeSize > 150_000 ? 1 : probeSize > 100_000 ? 2 : probeSize > 50_000 ? 3 : 4;
        const availableSlots = MAX_GLOBAL_CONCURRENT - globalPagesProcessed;
        const batchSize = Math.min(remaining.length, availableSlots, dynamicMax);
        const batch = remaining.slice(0, batchSize);

        console.log(`[Worker] Job ${job.id}: batch=${batchSize} (${alreadyProcessed}/${job.total_count})${useBrowserless ? ' [SPA]' : ''}`);

        const scrapePromises = batch.map(pageUrl =>
          scrapePage(pageUrl, job.domain, firecrawlKey, useBrowserless, renderingKey, customSelectors, computeDepth(pageUrl, job.url))
        );

        const settled = await Promise.allSettled(scrapePromises);
        const validResults = settled
          .filter((r): r is PromiseFulfilledResult<PageAnalysis | null> => r.status === 'fulfilled')
          .map(r => r.value)
          .filter(Boolean) as PageAnalysis[];

        // Track failed/null URLs for gap explanation
        if (!failedUrlsByJob.has(job.id)) failedUrlsByJob.set(job.id, []);
        const jobFailedUrls = failedUrlsByJob.get(job.id)!;
        settled.forEach((r, i) => {
          if (r.status === 'rejected') {
            jobFailedUrls.push({ url: batch[i], reason: r.reason?.message || 'fetch_error' });
          } else if (r.status === 'fulfilled' && r.value === null) {
            jobFailedUrls.push({ url: batch[i], reason: 'empty_content' });
          }
        });

        const failedCount = settled.filter(r => r.status === 'rejected').length;
        if (failedCount > 0) console.warn(`[Worker] ${failedCount} pages failed in batch`);

        if (validResults.length > 0) {
          const rows = validResults.map(p => ({ crawl_id: job.crawl_id, ...p }));
          await supabase.from('crawl_pages').upsert(rows, { onConflict: 'crawl_id,url', ignoreDuplicates: true });
        }

        // Reconcile from DB for accuracy
        const { count: persistedAfterBatch } = await supabase
          .from('crawl_pages')
          .select('id', { count: 'exact', head: true })
          .eq('crawl_id', job.crawl_id);

        const newProcessedCount = Math.max(alreadyProcessed, persistedAfterBatch || 0);
        const pagesInThisCycle = Math.max(0, newProcessedCount - alreadyProcessed);
        globalPagesProcessed += pagesInThisCycle;
        alreadyProcessed = newProcessedCount;

        await supabase.from('crawl_jobs').update({ processed_count: newProcessedCount }).eq('id', job.id);
        await supabase.from('site_crawls').update({ crawled_pages: newProcessedCount }).eq('id', job.crawl_id);

        console.log(`[Worker] Job ${job.id}: ${newProcessedCount}/${job.total_count} pages done`);

        remaining = remaining.slice(batchSize);

        // Update probeSize from last result for next iteration
        if (validResults.length > 0) {
          const lastResult = validResults[validResults.length - 1];
          probeSize = lastResult.html_size_bytes || probeSize;
        }
      }

      if (alreadyProcessed >= job.total_count) {
        await finalizeJob(supabase, { ...job, processed_count: alreadyProcessed }, firecrawlKey, failedUrlsByJob.get(job.id) || []);
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    return jsonOk({
      success: true,
      processed: globalPagesProcessed,
      jobs: jobs.length,
      elapsed_seconds: elapsed,
    });

  } catch (error) {
    console.error('[Worker] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Worker error',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}));

/**
 * Finalize a completed job: compute scores, detect duplicates (title+meta+content hash), AI summary
 */
async function finalizeJob(supabase: any, job: any, _firecrawlKey: string, failedUrls: Array<{ url: string; reason: string }> = []) {
  console.log(`[Worker] Finalizing job ${job.id}...`);

  await supabase.from('crawl_jobs').update({ status: 'analyzing' }).eq('id', job.id);
  await supabase.from('site_crawls').update({ status: 'analyzing' }).eq('id', job.crawl_id);

  const { data: allPages } = await supabase
    .from('crawl_pages')
    .select('*')
    .eq('crawl_id', job.crawl_id);

  const pages = allPages || [];

  // ── BFS Depth Recalculation (real link graph) ──
  if (pages.length > 1) {
    const bfsDepths = computeBFSDepths(pages as PageAnalysis[], job.url);
    const normalize = (u: string) => {
      try { return new URL(u).pathname.replace(/\/$/, '') || '/'; } catch { return u; }
    };
    for (const page of pages) {
      const path = normalize(page.url);
      const newDepth = bfsDepths.get(path) ?? page.crawl_depth ?? 0;
      if (newDepth !== page.crawl_depth) {
        await supabase.from('crawl_pages').update({ crawl_depth: newDepth }).eq('id', page.id);
        page.crawl_depth = newDepth;
      }
    }
    console.log(`[Worker] BFS depth recalculated for ${pages.length} pages`);
  }

  const avgScore = pages.length > 0
    ? Math.round(pages.reduce((s: number, p: any) => s + (p.seo_score || 0), 0) / pages.length)
    : 0;

  // ── Cross-page duplicate detection (title + meta + content hash) ──
  const duplicateIssues = detectDuplicates(pages as PageAnalysis[]);
  if (Object.keys(duplicateIssues).length > 0) {
    console.log(`[Worker] Found duplicates on ${Object.keys(duplicateIssues).length} pages`);
    for (const [url, newIssues] of Object.entries(duplicateIssues)) {
      const page = pages.find((p: any) => p.url === url);
      if (page) {
        const existingIssues = (page.issues as string[]) || [];
        const mergedIssues = [...new Set([...existingIssues, ...newIssues])];
        await supabase.from('crawl_pages').update({ issues: mergedIssues }).eq('id', page.id);
      }
    }
  }

  // ── AI Summary ──
  let aiSummary = '';
  let aiRecommendations: any[] = [];
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');

  if (lovableKey && pages.length > 0) {
    const issuesSummary: Record<string, number> = {};
    pages.forEach((p: any) => ((p.issues as string[]) || []).forEach(issue => {
      issuesSummary[issue] = (issuesSummary[issue] || 0) + 1;
    }));

    let duplicateTitleCount = 0, duplicateMetaCount = 0, nearDuplicateCount = 0;
    for (const issues of Object.values(duplicateIssues)) {
      if (issues.includes('duplicate_title')) duplicateTitleCount++;
      if (issues.includes('duplicate_meta_description')) duplicateMetaCount++;
      if (issues.includes('near_duplicate_content')) nearDuplicateCount++;
    }

    const topIssues = Object.entries(issuesSummary)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([issue, count]) => `${issue}: ${count} pages`);

    const bestPages = [...pages].sort((a: any, b: any) => (b.seo_score || 0) - (a.seo_score || 0)).slice(0, 5);
    const worstPages = [...pages].sort((a: any, b: any) => (a.seo_score || 0) - (b.seo_score || 0)).slice(0, 5);

    const avgResponseTime = pages.filter((p: any) => p.response_time_ms).length > 0
      ? Math.round(pages.filter((p: any) => p.response_time_ms).reduce((s: number, p: any) => s + (p.response_time_ms || 0), 0) / pages.filter((p: any) => p.response_time_ms).length)
      : null;

    // Schema.org summary
    const schemaPages = pages.filter((p: any) => p.schema_org_types?.length > 0);
    const schemaErrorPages = pages.filter((p: any) => p.schema_org_errors?.length > 0);

    // Compute TRUE orphan pages (0 incoming internal links from other crawled pages)
    const normalizeUrl = (u: string) => {
      try { return new URL(u).pathname.replace(/\/$/, '') || '/'; } catch { return u; }
    };
    const inboundCount = new Map<string, number>();
    pages.forEach((p: any) => inboundCount.set(normalizeUrl(p.url), 0));
    for (const page of pages) {
      for (const link of (page.anchor_texts || [])) {
        if (link.type === 'internal') {
          const targetPath = normalizeUrl(link.href.startsWith('/') ? `https://x${link.href}` : link.href);
          if (inboundCount.has(targetPath)) {
            inboundCount.set(targetPath, (inboundCount.get(targetPath) || 0) + 1);
          }
        }
      }
    }
    const trueOrphanCount = [...inboundCount.values()].filter(c => c === 0).length;
    // Exclude the homepage from orphan count (it's the root, often has no internal links pointing to it from itself)
    const homePath = normalizeUrl(`https://${job.domain}/`);
    const orphanCount = inboundCount.get(homePath) === 0 ? Math.max(0, trueOrphanCount - 1) : trueOrphanCount;

    // ── Gap analysis: compute why some URLs weren't crawled ──
    const urlsRequested = (job.urls_to_process as string[] || []).length;
    const gapCount = Math.max(0, urlsRequested - pages.length);
    let gapContext = '';
    if (gapCount > 0 || failedUrls.length > 0) {
      const reasonCounts: Record<string, number> = {};
      // Count reasons from tracked failures
      for (const f of failedUrls) {
        const reason = f.reason.includes('timeout') ? 'timeout' :
          f.reason.includes('404') ? 'http_404' :
          f.reason.includes('403') || f.reason.includes('401') ? 'auth_blocked' :
          f.reason.includes('redirect') ? 'redirect' :
          f.reason.includes('empty_content') ? 'empty_content' :
          'fetch_error';
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      }
      // Also count pages with non-200 status from crawled pages
      const redirectPages = pages.filter((p: any) => p.redirect_url).length;
      const errorStatusPages = pages.filter((p: any) => p.http_status >= 400).length;

      const reasonLabels: Record<string, string> = {
        timeout: 'timeout de connexion',
        http_404: 'erreur 404 (page introuvable)',
        auth_blocked: 'accès bloqué (401/403)',
        redirect: 'redirection',
        empty_content: 'contenu vide ou inaccessible (SPA/JS)',
        fetch_error: 'erreur de récupération',
      };

      const reasonLines = Object.entries(reasonCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([reason, count]) => `  - ${count} ${reasonLabels[reason] || reason}`)
        .join('\n');

      gapContext = `
ÉCART DE CRAWL:
- ${urlsRequested} URLs soumises au crawl, ${pages.length} pages effectivement analysées (${gapCount} URLs non récupérées)
${reasonLines ? `Raisons des échecs:\n${reasonLines}` : ''}
${redirectPages > 0 ? `- ${redirectPages} pages avec redirection détectée parmi les pages crawlées` : ''}
${errorStatusPages > 0 ? `- ${errorStatusPages} pages avec erreur HTTP (4xx/5xx) parmi les pages crawlées` : ''}
IMPORTANT: Dans ta synthèse, explique brièvement cet écart de manière contextualisée pour ce site (1 à 3 phrases). Par exemple: redirections d'anciennes URLs, pages protégées, contenu dynamique JavaScript non rendu, etc.`;
    }

    const prompt = `Tu es un expert SEO senior. Analyse ce crawl de ${job.domain} (${pages.length} pages, score moyen: ${avgScore}/200).

PROBLÈMES DÉTECTÉS:
${topIssues.join('\n')}

MEILLEURES PAGES:
${bestPages.map((p: any) => `- ${p.path} (${p.seo_score}/200)`).join('\n')}

PIRES PAGES:
${worstPages.map((p: any) => `- ${p.path} (${p.seo_score}/200) — Problèmes: ${(p.issues || []).join(', ')}`).join('\n')}
${gapContext}
STATS DÉTAILLÉES:
- Pages avec Schema.org: ${schemaPages.length}/${pages.length}
- Pages avec Schema.org valide (sans erreurs): ${schemaPages.length - schemaErrorPages.length}/${pages.length}
- Pages avec erreurs Schema.org: ${schemaErrorPages.length}
- Pages avec canonical: ${pages.filter((p: any) => p.has_canonical).length}/${pages.length}
- Pages avec OG: ${pages.filter((p: any) => p.has_og).length}/${pages.length}
- Pages noindex: ${pages.filter((p: any) => p.has_noindex).length}
- Pages nofollow: ${pages.filter((p: any) => p.has_nofollow).length}
- Titres dupliqués: ${duplicateTitleCount} pages
- Meta descriptions dupliquées: ${duplicateMetaCount} pages
- Contenu quasi-dupliqué (hash): ${nearDuplicateCount} pages
- Contenu fin (<100 mots): ${pages.filter((p: any) => (p.word_count || 0) < 100).length}
- Images sans alt: ${pages.reduce((s: number, p: any) => s + (p.images_without_alt || 0), 0)}
- Pages orphelines (0 liens entrants): ${orphanCount}
- H1 multiples: ${pages.filter((p: any) => ((p.issues as string[]) || []).includes('multiple_h1')).length}
- H2 manquants: ${pages.filter((p: any) => (p.h2_count || 0) === 0).length}/${pages.length}
${avgResponseTime ? `- Temps de réponse moyen: ${avgResponseTime}ms` : ''}

Réponds en JSON STRICT:
{
  "summary": "Synthèse narrative en 3-4 phrases (en français), couvrant les forces et faiblesses du site.${gapCount > 0 ? ' Inclure une explication contextualisée de l\'écart entre les pages détectées et celles effectivement crawlées.' : ''}",
  "recommendations": [
    {"priority": "critical|high|medium", "title": "Titre court", "description": "Détail actionnable", "affected_pages": 12}
  ]${gapCount > 0 ? `,
  "crawl_gap_explanation": "Explication en 1-3 phrases de pourquoi ${gapCount} pages n'ont pas pu être analysées, contextualisée pour ce site spécifique."` : ''}
}
Donne 5-8 recommandations max, classées par impact.`;

    try {
      const lovableKey = Deno.env.get('LOVABLE_API_KEY');
      const aiController = new AbortController();
      const aiTimeout = setTimeout(() => aiController.abort(), 60000);
      const aiRes = await fetch('https://ai.gateway.lovable.dev/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        }),
        signal: aiController.signal,
      });
      clearTimeout(aiTimeout);

      const aiData = await aiRes.json();
      const aiContent = aiData.choices?.[0]?.message?.content || '';
      const parsed = JSON.parse(aiContent);
      aiSummary = parsed.summary || '';
      if (parsed.crawl_gap_explanation) {
        aiSummary += '\n\n📊 ' + parsed.crawl_gap_explanation;
      }
      aiRecommendations = (parsed.recommendations || []).slice(0, 10);
    } catch (e) {
      console.warn(`[Worker] AI summary failed:`, e);
      aiSummary = `Crawl terminé: ${pages.length} pages analysées, score moyen ${avgScore}/200.`;
    }
  }

  await supabase.from('site_crawls').update({
    status: 'completed',
    crawled_pages: pages.length,
    avg_score: avgScore,
    ai_summary: aiSummary,
    ai_recommendations: aiRecommendations,
    completed_at: new Date().toISOString(),
  }).eq('id', job.crawl_id);

  // Save raw crawl data (fire-and-forget)
  saveRawAuditData({
    userId: job.user_id,
    url: job.url,
    domain: job.domain,
    auditType: 'crawl',
    rawPayload: {
      pages: pages.map((p: any) => ({
        url: p.url, path: p.path, title: p.title, h1: p.h1,
        meta_description: p.meta_description, word_count: p.word_count,
        seo_score: p.seo_score, http_status: p.http_status,
        issues: p.issues, internal_links: p.internal_links,
        external_links: p.external_links, images_total: p.images_total,
        images_without_alt: p.images_without_alt, schema_org_types: p.schema_org_types,
        has_canonical: p.has_canonical, has_noindex: p.has_noindex,
        response_time_ms: p.response_time_ms, html_size_bytes: p.html_size_bytes,
      })),
      avgScore,
      totalPages: pages.length,
      aiSummary,
      aiRecommendations,
    },
    sourceFunctions: ['process-crawl-queue', 'crawl-site'],
  }).catch(() => {});

  await supabase.from('crawl_jobs').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
  }).eq('id', job.id);

  console.log(`[Worker] ✅ Job ${job.id} finalized: ${pages.length} pages, avg score ${avgScore}/200`);
}