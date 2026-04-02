/**
 * preCrawlForAudit.ts
 * 
 * Pré-crawl intelligent pour enrichir l'audit stratégique et technique.
 * 
 * Stratégie :
 * 1. Vérifie si un crawl complet récent (< 7 jours) existe en cache → réutilise
 * 2. Sinon, lance un crawl intermédiaire :
 *    a. Scan du sitemap XML pour découvrir les pages
 *    b. Croise avec GA4 si disponible (pages les plus visitées)
 *    c. Crawle les 10 pages les plus importantes (par trafic + score SEO)
 * 
 * Résultat partageable entre audit technique et audit stratégique.
 */

import { stealthFetchText } from './stealthFetch.ts';

export interface PreCrawlPage {
  url: string;
  title: string;
  h1: string;
  metaDescription: string;
  wordCount: number;
  hasSchemaOrg: boolean;
  schemaTypes: string[];
  schemaCount: number;
  schemaDepth: number;
  schemaFieldCount: number;
  schemaHasGraph: boolean;
  hasSameAs: boolean;
  hasAuthorInJsonLd: boolean;
  internalLinksCount: number;
  externalLinksCount: number;
  httpStatus: number;
  isIndexable: boolean;
  bodyTextTruncated: string; // 500 premiers chars
}

export interface PreCrawlResult {
  source: 'cache' | 'intermediate';
  cacheAge?: string; // ISO date du crawl réutilisé
  pages: PreCrawlPage[];
  sitemapUrls: string[];
  totalSitemapUrls: number;
  ga4TopPages: string[];
  crawledAt: string;
}

const CACHE_MAX_AGE_DAYS = 7;
const MAX_PAGES_TO_CRAWL = 10;

/**
 * Point d'entrée principal.
 * @param supabase - Service client Supabase
 * @param domain - Domaine nettoyé (sans www/protocole)
 * @param trackedSiteId - ID du tracked_site (optionnel, pour GA4)
 * @param userId - ID utilisateur (optionnel, pour GA4)
 */
export async function preCrawlForAudit(
  supabase: any,
  domain: string,
  trackedSiteId?: string | null,
  userId?: string | null
): Promise<PreCrawlResult> {
  const normalizedDomain = domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .toLowerCase();

  console.log(`[preCrawl] 🔍 Checking cache for ${normalizedDomain}...`);

  // ── 1. Check cache: crawl complet < 7 jours ──
  const cacheResult = await checkCrawlCache(supabase, normalizedDomain);
  if (cacheResult) {
    console.log(`[preCrawl] ✅ Cache hit — ${cacheResult.pages.length} pages from ${cacheResult.cacheAge}`);
    return cacheResult;
  }

  console.log(`[preCrawl] ⚡ No recent cache — starting intermediate crawl...`);

  // ── 2. Crawl intermédiaire ──
  // 2a. Scan sitemap + GA4 en parallèle
  const [sitemapUrls, ga4TopPages] = await Promise.all([
    scanSitemap(normalizedDomain),
    trackedSiteId ? fetchGA4TopPages(supabase, trackedSiteId) : Promise.resolve([]),
  ]);

  console.log(`[preCrawl] 📍 Sitemap: ${sitemapUrls.length} URLs, GA4: ${ga4TopPages.length} top pages`);

  // 2b. Sélectionner les 10 pages les plus importantes
  const targetPages = selectTopPages(normalizedDomain, sitemapUrls, ga4TopPages);
  console.log(`[preCrawl] 🎯 ${targetPages.length} pages to crawl`);

  // 2c. Crawl parallèle des pages sélectionnées
  const pages = await crawlPages(targetPages);

  const result: PreCrawlResult = {
    source: 'intermediate',
    pages,
    sitemapUrls,
    totalSitemapUrls: sitemapUrls.length,
    ga4TopPages,
    crawledAt: new Date().toISOString(),
  };

  console.log(`[preCrawl] ✅ Intermediate crawl complete — ${pages.length} pages crawled`);
  return result;
}

// ── Cache lookup ──
async function checkCrawlCache(supabase: any, domain: string): Promise<PreCrawlResult | null> {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - CACHE_MAX_AGE_DAYS);

    const { data: crawl } = await supabase
      .from('site_crawls')
      .select('id, crawled_pages, created_at, status')
      .eq('domain', domain)
      .eq('status', 'completed')
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!crawl || !crawl.id) return null;

    // Fetch les pages du crawl
    const { data: crawlPages } = await supabase
      .from('crawl_pages')
      .select('url, title, h1, seo_score, word_count, internal_links, external_links, has_schema_org, is_indexable, body_text_truncated, http_status')
      .eq('crawl_id', crawl.id)
      .order('seo_score', { ascending: false })
      .limit(50);

    if (!crawlPages || crawlPages.length === 0) return null;

    const pages: PreCrawlPage[] = crawlPages.map((p: any) => ({
      url: p.url || '',
      title: p.title || '',
      h1: p.h1 || '',
      metaDescription: '',
      wordCount: p.word_count || 0,
      hasSchemaOrg: p.has_schema_org || false,
      schemaTypes: [],
      internalLinksCount: p.internal_links || 0,
      externalLinksCount: p.external_links || 0,
      httpStatus: p.http_status || 200,
      isIndexable: p.is_indexable !== false,
      bodyTextTruncated: (p.body_text_truncated || '').slice(0, 500),
    }));

    return {
      source: 'cache',
      cacheAge: crawl.created_at,
      pages,
      sitemapUrls: [],
      totalSitemapUrls: 0,
      ga4TopPages: [],
      crawledAt: crawl.created_at,
    };
  } catch (e) {
    console.warn('[preCrawl] Cache check error:', e);
    return null;
  }
}

// ── Sitemap scanner ──
async function scanSitemap(domain: string): Promise<string[]> {
  const urls: string[] = [];
  const sitemapUrls = [
    `https://${domain}/sitemap.xml`,
    `https://${domain}/sitemap_index.xml`,
    `https://www.${domain}/sitemap.xml`,
  ];

  for (const sitemapUrl of sitemapUrls) {
    try {
      const { text, status } = await stealthFetchText(sitemapUrl, {
        timeout: 8000,
        maxRetries: 1,
      });

      if (status !== 200 || !text) continue;

      // Parse sitemap XML — extract <loc> tags
      const locMatches = text.matchAll(/<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/gi);
      for (const match of locMatches) {
        const loc = match[1].trim();
        // Si c'est un sitemap index, on ne descend pas (trop lent)
        if (loc.endsWith('.xml') || loc.endsWith('.xml.gz')) continue;
        urls.push(loc);
      }

      if (urls.length > 0) {
        console.log(`[preCrawl] 📄 Sitemap found at ${sitemapUrl}: ${urls.length} URLs`);
        break;
      }
    } catch {
      continue;
    }
  }

  return urls.slice(0, 500); // Cap pour la mémoire
}

// ── GA4 top pages ──
async function fetchGA4TopPages(supabase: any, trackedSiteId: string): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('ga4_history_log')
      .select('top_pages')
      .eq('tracked_site_id', trackedSiteId)
      .order('week_start_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.top_pages && Array.isArray(data.top_pages)) {
      return data.top_pages
        .filter((p: any) => p?.path || p?.url)
        .map((p: any) => p.url || p.path)
        .slice(0, 20);
    }
    return [];
  } catch {
    return [];
  }
}

// ── Page selection logic ──
// Patterns E-E-A-T de pages de confiance à prioriser dans le crawl
const TRUST_PAGE_PATTERNS = /\/(about|a-propos|qui-sommes|equipe|team|notre-histoire|contact|contactez|mentions-legales|legal|imprint|impressum|cgv|cgu|conditions|terms|privacy|confidentialit|politique|rgpd|gdpr|temoignages|avis|testimonials|references|realisations|portfolio|auteur|author)/i;

function selectTopPages(domain: string, sitemapUrls: string[], ga4TopPages: string[]): string[] {
  const selected = new Set<string>();
  const baseUrl = `https://${domain}`;

  // Toujours inclure la homepage
  selected.add(baseUrl);
  selected.add(`${baseUrl}/`);

  // ── Prioriser les pages E-E-A-T (confiance, expertise, auteur) ──
  const trustPages = sitemapUrls.filter(u => TRUST_PAGE_PATTERNS.test(new URL(u).pathname));
  for (const url of trustPages) {
    if (selected.size >= MAX_PAGES_TO_CRAWL) break;
    selected.add(url);
  }

  // Prioriser les pages GA4 (trafic réel = importance réelle)
  for (const page of ga4TopPages) {
    if (selected.size >= MAX_PAGES_TO_CRAWL) break;
    const fullUrl = page.startsWith('http') ? page : `${baseUrl}${page.startsWith('/') ? '' : '/'}${page}`;
    selected.add(fullUrl);
  }

  // Compléter avec les pages du sitemap (prioriser les URL courtes = pages importantes)
  const sortedSitemap = [...sitemapUrls]
    .filter(u => !u.match(/\.(jpg|png|gif|pdf|css|js|svg|webp)/i))
    .sort((a, b) => {
      const depthA = (new URL(a).pathname.match(/\//g) || []).length;
      const depthB = (new URL(b).pathname.match(/\//g) || []).length;
      return depthA - depthB;
    });

  for (const url of sortedSitemap) {
    if (selected.size >= MAX_PAGES_TO_CRAWL) break;
    selected.add(url);
  }

  // Déduplication en normalisant (retirer trailing slash)
  const deduped = new Map<string, string>();
  for (const u of selected) {
    const key = u.replace(/\/+$/, '').toLowerCase();
    if (!deduped.has(key)) deduped.set(key, u);
  }

  return Array.from(deduped.values()).slice(0, MAX_PAGES_TO_CRAWL);
}

// ── Crawl individual pages ──
async function crawlPages(urls: string[]): Promise<PreCrawlPage[]> {
  // Crawl par batch de 3 pour limiter la pression
  const results: PreCrawlPage[] = [];
  const batchSize = 3;

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(url => crawlSinglePage(url))
    );

    for (const r of batchResults) {
      if (r.status === 'fulfilled' && r.value) {
        results.push(r.value);
      }
    }
  }

  return results;
}

async function crawlSinglePage(url: string): Promise<PreCrawlPage | null> {
  try {
    const { text: html, status } = await stealthFetchText(url, {
      timeout: 10000,
      maxRetries: 1,
    });

    if (status >= 400 || !html) {
      return { url, title: '', h1: '', metaDescription: '', wordCount: 0, hasSchemaOrg: false, schemaTypes: [], internalLinksCount: 0, externalLinksCount: 0, httpStatus: status, isIndexable: false, bodyTextTruncated: '' };
    }

    // Extract metadata
    const titleMatch = html.match(/<title[^>]*>([^<]{1,300})<\/title>/i);
    const h1Match = html.match(/<h1[^>]*>([^<]{1,300})<\/h1>/i);
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']{1,500})/i)
      || html.match(/<meta\s+content=["']([^"']{1,500})["']\s+name=["']description/i);
    const noindexMatch = html.match(/<meta\s+[^>]*content=["'][^"']*noindex/i);

    // Schema.org detection
    const schemaMatches = html.matchAll(/"@type"\s*:\s*"([^"]+)"/gi);
    const schemaTypes = [...new Set([...schemaMatches].map(m => m[1]))];

    // Links count
    const domain = new URL(url).hostname;
    const linkMatches = [...html.matchAll(/href=["'](https?:\/\/[^"'#\s]+)/gi)];
    let internal = 0, external = 0;
    for (const m of linkMatches) {
      try {
        const linkHost = new URL(m[1]).hostname;
        if (linkHost.includes(domain) || domain.includes(linkHost)) internal++;
        else external++;
      } catch { external++; }
    }

    // Body text
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyText = (bodyMatch?.[1] || '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const words = bodyText.split(/\s+/).filter(w => w.length > 1);

    return {
      url,
      title: titleMatch?.[1]?.trim() || '',
      h1: h1Match?.[1]?.replace(/<[^>]+>/g, '').trim() || '',
      metaDescription: descMatch?.[1]?.trim() || '',
      wordCount: words.length,
      hasSchemaOrg: schemaTypes.length > 0,
      schemaTypes,
      internalLinksCount: internal,
      externalLinksCount: external,
      httpStatus: status,
      isIndexable: !noindexMatch,
      bodyTextTruncated: bodyText.slice(0, 500),
    };
  } catch (e) {
    console.warn(`[preCrawl] ❌ Failed to crawl ${url}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Formate les résultats du pré-crawl en contexte injectable dans le prompt LLM.
 */
export function formatPreCrawlForPrompt(result: PreCrawlResult): string {
  if (!result.pages.length) return '';

  const lines: string[] = [
    `\n═══ PRÉ-CRAWL DU SITE (${result.source === 'cache' ? 'cache < 7j' : 'crawl intermédiaire'}, ${result.pages.length} pages) ═══`,
  ];

  for (const page of result.pages.slice(0, 10)) {
    lines.push(`\n📄 ${page.url}`);
    lines.push(`   Title: "${page.title}" | H1: "${page.h1}"`);
    lines.push(`   Meta: "${page.metaDescription.slice(0, 120)}"`);
    lines.push(`   ${page.wordCount} mots | ${page.internalLinksCount} liens int. | ${page.externalLinksCount} liens ext.`);
    if (page.schemaTypes.length) lines.push(`   Schema: ${page.schemaTypes.join(', ')}`);
    if (!page.isIndexable) lines.push(`   ⚠️ NOINDEX`);
    if (page.httpStatus >= 400) lines.push(`   ⚠️ HTTP ${page.httpStatus}`);
  }

  if (result.totalSitemapUrls > 0) {
    lines.push(`\n📊 Sitemap: ${result.totalSitemapUrls} URLs découvertes`);
  }

  if (result.ga4TopPages.length > 0) {
    lines.push(`📈 Top pages GA4: ${result.ga4TopPages.slice(0, 5).join(', ')}`);
  }

  return lines.join('\n');
}
