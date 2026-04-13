/**
 * HTML analysis engine — Screaming Frog-level page analysis.
 * Extracts SEO signals, validates Schema.org, computes scores.
 */
import type { PageAnalysis, CustomSelector } from './types.ts';

// ── Simple hash for near-duplicate detection ───────────────
export function simpleHash(text: string): string {
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// ── Schema.org Validation ──────────────────────────────────
export function validateSchemaOrg(html: string): { types: string[]; errors: string[] } {
  const types: string[] = [];
  const errors: string[] = [];

  const jsonLdRegex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let blockCount = 0;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    blockCount++;
    try {
      const data = JSON.parse(match[1].trim());
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        const entities = item['@graph'] ? item['@graph'] : [item];
        for (const entity of entities) {
          const type = entity['@type'];
          if (type) {
            const typeStr = Array.isArray(type) ? type.join(', ') : type;
            types.push(typeStr);
          } else {
            errors.push('missing_@type');
          }

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
    } catch (_e) {
      errors.push(`json_ld_parse_error: block ${blockCount}`);
    }
  }

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
export function extractCustomSelectors(html: string, selectors: CustomSelector[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (const sel of selectors) {
    if (sel.type !== 'css') continue;
    try {
      let extracted = '';
      const s = sel.selector.trim();

      if (s.startsWith('#')) {
        const id = s.slice(1).replace(/[^\w-]/g, '');
        const regex = new RegExp(`<[^>]+id\\s*=\\s*["']${id}["'][^>]*>([\\s\\S]*?)<\\/`, 'i');
        const m = html.match(regex);
        if (m) extracted = m[1].replace(/<[^>]+>/g, '').trim().substring(0, 500);
      } else if (s.startsWith('.')) {
        const cls = s.slice(1).replace(/[^\w-]/g, '');
        const regex = new RegExp(`<[^>]+class\\s*=\\s*["'][^"']*\\b${cls}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/`, 'i');
        const m = html.match(regex);
        if (m) extracted = m[1].replace(/<[^>]+>/g, '').trim().substring(0, 500);
      } else if (/^[a-z]+$/i.test(s)) {
        const regex = new RegExp(`<${s}[^>]*>([\\s\\S]*?)<\\/${s}>`, 'i');
        const m = html.match(regex);
        if (m) extracted = m[1].replace(/<[^>]+>/g, '').trim().substring(0, 500);
      } else if (s.startsWith('[')) {
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
      } else if (s.includes('meta[name=')) {
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
export function detectSPAMarkers(html: string): { isSPA: boolean; framework?: string } {
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

// ── Score SEO (sur 200) ────────────────────────────────────
export function computePageScore(page: Omit<PageAnalysis, 'seo_score'>): number {
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
export function analyzeHtml(
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
  let bodyTextFull = '';
  if (bodyMatch) {
    bodyTextFull = bodyMatch[1]
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
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
  const body_text_truncated = bodyTextFull.substring(0, 5000) || null;
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
    body_text_truncated,
  };
}
