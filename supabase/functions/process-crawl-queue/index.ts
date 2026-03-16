import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { trackPaidApiCall } from '../_shared/tokenTracker.ts';

const FIRECRAWL_API = 'https://api.firecrawl.dev/v1';
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
  if (bodyMatch) {
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

    if (useBrowserless && renderingKey) {
      const result = await renderWithBrowserless(pageUrl, renderingKey);
      if (!result.html) return null;
      html = result.html;
      responseTime = result.responseTime;
    } else {
      // ── StealthFetch FIRST (free) ──
      try {
        const { stealthFetch } = await import('../_shared/stealthFetch.ts');
        const fetchStart = Date.now();
        const { response: stealthResp } = await stealthFetch(pageUrl, { timeout: 10000, maxRetries: 2 });
        const stealthHtml = await stealthResp.text();
        responseTime = Date.now() - fetchStart;
        statusCode = stealthResp.status;

        if (stealthResp.ok && stealthHtml.length > 500) {
          html = stealthHtml;
          console.log(`[Worker] stealthFetch OK for ${pageUrl} (${stealthHtml.length} chars)`);
        }
      } catch (stealthErr) {
        console.warn(`[Worker] stealthFetch failed for ${pageUrl}:`, stealthErr);
      }

      // ── Firecrawl FALLBACK (only if stealthFetch failed) ──
      if (!html || html.length < 500) {
        console.log(`[Worker] stealthFetch insufficient for ${pageUrl}, falling back to Firecrawl...`);
        const fetchStart = Date.now();
        const res = await fetch(`${FIRECRAWL_API}/scrape`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: pageUrl, formats: ['rawHtml'], onlyMainContent: false, waitFor: 3000 }),
        });
        responseTime = Date.now() - fetchStart;
        const data = await res.json();
        html = data?.data?.rawHtml || data?.rawHtml || data?.data?.html || data?.html || '';
        statusCode = data?.data?.metadata?.statusCode || 200;

        const sourceUrl = data?.data?.metadata?.sourceURL;
        if (sourceUrl && sourceUrl !== pageUrl) {
          redirectUrl = sourceUrl;
        }

        await trackPaidApiCall('process-crawl-queue', 'firecrawl', '/scrape', pageUrl).catch(() => {});
      }
      
      if (!html) return null;
    }

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
  if (!isThinContent) return { isSPA: false, firstPageResult: result };

  if (!renderingKey) {
    console.log(`[Worker] Thin content on ${firstUrl} (${result.word_count} words) but no RENDERING_API_KEY`);
    return { isSPA: false, firstPageResult: result };
  }

  console.log(`[Worker] 🔍 Thin content detected on ${firstUrl} (${result.word_count} words) — probing with Browserless...`);
  const renderedResult = await scrapePage(firstUrl, domain, firecrawlKey, true, renderingKey);

  if (renderedResult && renderedResult.word_count > result.word_count * 2 && renderedResult.word_count > 50) {
    console.log(`[Worker] ✅ SPA confirmed: ${result.word_count} → ${renderedResult.word_count} words after JS rendering`);
    return { isSPA: true, firstPageResult: renderedResult };
  }

  console.log(`[Worker] ❌ Not a SPA (Browserless: ${renderedResult?.word_count || 0} words)`);
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

// ── Compute crawl depth from URL structure ─────────────────
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
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY')!;
  const renderingKey = Deno.env.get('RENDERING_API_KEY') || null;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const WATCHDOG_MS = 120_000;
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
      return new Response(JSON.stringify({ success: true, message: 'No jobs to process' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Worker] Found ${jobs.length} active jobs`);
    let globalPagesProcessed = 0;

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
      const alreadyProcessed = job.processed_count || 0;
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
        await finalizeJob(supabase, job, firecrawlKey);
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

      if (alreadyProcessed === 0) {
        const probe = await probeSPAStatus(remaining[0], job.domain, firecrawlKey, renderingKey);
        useBrowserless = probe.isSPA;
        firstPageResult = probe.firstPageResult;
        if (firstPageResult) {
          firstPageResult.crawl_depth = computeDepth(remaining[0], job.url);
        }
        if (useBrowserless) {
          console.log(`[Worker] Job ${job.id}: 🌐 SPA mode enabled`);
        }
      }

      if (isTimeUp()) {
        console.log(`[Worker] ⏱️ Watchdog triggered after SPA probe — saving progress`);
        if (firstPageResult) {
          await supabase.from('crawl_pages').insert([{ crawl_id: job.crawl_id, ...firstPageResult }]);
          await supabase.from('crawl_jobs').update({ processed_count: alreadyProcessed + 1 }).eq('id', job.id);
          await supabase.from('site_crawls').update({ crawled_pages: alreadyProcessed + 1 }).eq('id', job.crawl_id);
          globalPagesProcessed += 1;
        }
        break;
      }

      const availableSlots = MAX_GLOBAL_CONCURRENT - globalPagesProcessed;
      const batchStart = (alreadyProcessed === 0 && firstPageResult) ? 1 : 0;
      // Reduced batch size from 20 to 8 to avoid CPU timeout kills
      const batchSize = Math.min(remaining.length - batchStart, availableSlots - (firstPageResult ? 1 : 0), 8);
      const batch = remaining.slice(batchStart, batchStart + batchSize);

      console.log(`[Worker] Job ${job.id}: processing ${firstPageResult ? '1+' : ''}${batch.length} pages (${alreadyProcessed}/${job.total_count})${useBrowserless ? ' [SPA mode]' : ''}`);

      const scrapePromises = batch.map(pageUrl =>
        scrapePage(pageUrl, job.domain, firecrawlKey, useBrowserless, renderingKey, customSelectors, computeDepth(pageUrl, job.url))
      );

      // Use Promise.allSettled to prevent one failed page from crashing the batch
      const settled = await Promise.allSettled(scrapePromises);
      const validResults = settled
        .filter((r): r is PromiseFulfilledResult<PageAnalysis | null> => r.status === 'fulfilled')
        .map(r => r.value)
        .filter(Boolean) as PageAnalysis[];
      
      const failedCount = settled.filter(r => r.status === 'rejected').length;
      if (failedCount > 0) console.warn(`[Worker] ${failedCount} pages failed in batch (allSettled)`);


      if (firstPageResult) {
        validResults.unshift(firstPageResult);
      }

      // Use upsert with ON CONFLICT to prevent duplicates on CPU timeout retries
      if (validResults.length > 0) {
        const rows = validResults.map(p => ({ crawl_id: job.crawl_id, ...p }));
        await supabase.from('crawl_pages').upsert(rows, { onConflict: 'crawl_id,url', ignoreDuplicates: true });
      }

      const pagesInThisCycle = (firstPageResult ? 1 : 0) + batch.length;
      const newProcessedCount = alreadyProcessed + pagesInThisCycle;
      globalPagesProcessed += pagesInThisCycle;

      await supabase.from('crawl_jobs').update({ processed_count: newProcessedCount }).eq('id', job.id);
      await supabase.from('site_crawls').update({ crawled_pages: newProcessedCount }).eq('id', job.crawl_id);

      console.log(`[Worker] Job ${job.id}: ${newProcessedCount}/${job.total_count} pages done`);

      if (newProcessedCount >= job.total_count) {
        await finalizeJob(supabase, { ...job, processed_count: newProcessedCount }, firecrawlKey);
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    return new Response(JSON.stringify({
      success: true,
      processed: globalPagesProcessed,
      jobs: jobs.length,
      elapsed_seconds: elapsed,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[Worker] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Worker error',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

/**
 * Finalize a completed job: compute scores, detect duplicates (title+meta+content hash), AI summary
 */
async function finalizeJob(supabase: any, job: any, _firecrawlKey: string) {
  console.log(`[Worker] Finalizing job ${job.id}...`);

  await supabase.from('crawl_jobs').update({ status: 'analyzing' }).eq('id', job.id);
  await supabase.from('site_crawls').update({ status: 'analyzing' }).eq('id', job.crawl_id);

  const { data: allPages } = await supabase
    .from('crawl_pages')
    .select('*')
    .eq('crawl_id', job.crawl_id);

  const pages = allPages || [];
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
  const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');

  if (openrouterKey && pages.length > 0) {
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

    const prompt = `Tu es un expert SEO senior. Analyse ce crawl de ${job.domain} (${pages.length} pages, score moyen: ${avgScore}/200).

PROBLÈMES DÉTECTÉS:
${topIssues.join('\n')}

MEILLEURES PAGES:
${bestPages.map((p: any) => `- ${p.path} (${p.seo_score}/200)`).join('\n')}

PIRES PAGES:
${worstPages.map((p: any) => `- ${p.path} (${p.seo_score}/200) — Problèmes: ${(p.issues || []).join(', ')}`).join('\n')}

STATS DÉTAILLÉES:
- Pages avec Schema.org: ${pages.filter((p: any) => p.has_schema_org).length}/${pages.length}
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
- Pages orphelines (0 liens internes): ${pages.filter((p: any) => (p.internal_links || 0) === 0).length}
- H1 multiples: ${pages.filter((p: any) => ((p.issues as string[]) || []).includes('multiple_h1')).length}
- H2 manquants: ${pages.filter((p: any) => (p.h2_count || 0) === 0).length}/${pages.length}
${avgResponseTime ? `- Temps de réponse moyen: ${avgResponseTime}ms` : ''}

Réponds en JSON STRICT:
{
  "summary": "Synthèse narrative en 3-4 phrases (en français), couvrant les forces et faiblesses du site.",
  "recommendations": [
    {"priority": "critical|high|medium", "title": "Titre court", "description": "Détail actionnable", "affected_pages": 12}
  ]
}
Donne 5-8 recommandations max, classées par impact.`;

    try {
      const aiController = new AbortController();
      const aiTimeout = setTimeout(() => aiController.abort(), 60000); // #2: 60s timeout
      const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openrouterKey}`,
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
      aiRecommendations = (parsed.recommendations || []).slice(0, 10); // #5: cap to 10 max
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

  await supabase.from('crawl_jobs').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
  }).eq('id', job.id);

  console.log(`[Worker] ✅ Job ${job.id} finalized: ${pages.length} pages, avg score ${avgScore}/200`);
}
