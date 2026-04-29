import { getServiceClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * Edge Function: fetch-sitemap-tree
 * 
 * Fetches and parses a site's sitemap(s), clusters URLs into a virtual folder tree.
 * Results are cached in domain_data_cache for 2 hours.
 * 
 * Input: { domain: string }
 * Output: { tree: FolderNode[], totalUrls: number, cached: boolean }
 */

interface FolderNode {
  path: string;
  label: string;
  count: number;
  children: FolderNode[];
  urls: string[];
}

const MAX_URLS = 1000;
const FETCH_TIMEOUT_MS = 10_000;
const CACHE_TTL_HOURS = 2;

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Crawlers.fr/SitemapFetcher/1.0' },
    });
    return res;
  } finally {
    clearTimeout(tid);
  }
}

/**
 * Parse sitemap XML to extract URLs. Handles both <sitemapindex> and <urlset>.
 */
async function parseSitemapUrls(sitemapUrl: string, depth = 0): Promise<string[]> {
  if (depth > 3) return []; // Prevent infinite recursion

  try {
    const res = await fetchWithTimeout(sitemapUrl, FETCH_TIMEOUT_MS);
    if (!res.ok) return [];
    const xml = await res.text();

    // Check if it's a sitemap index (contains <sitemapindex>)
    const isSitemapIndex = xml.includes('<sitemapindex');

    if (isSitemapIndex) {
      // Extract child sitemap URLs
      const sitemapLocs: string[] = [];
      const locRegex = /<sitemap[^>]*>[\s\S]*?<loc[^>]*>(.*?)<\/loc>/gi;
      let match;
      while ((match = locRegex.exec(xml)) !== null) {
        sitemapLocs.push(match[1].trim());
      }

      // Recursively parse child sitemaps
      const allUrls: string[] = [];
      for (const childUrl of sitemapLocs) {
        if (allUrls.length >= MAX_URLS) break;
        const childUrls = await parseSitemapUrls(childUrl, depth + 1);
        allUrls.push(...childUrls);
      }
      return allUrls.slice(0, MAX_URLS);
    }

    // Regular urlset — extract <loc> tags
    const urls: string[] = [];
    const urlLocRegex = /<url[^>]*>[\s\S]*?<loc[^>]*>(.*?)<\/loc>/gi;
    let match;
    while ((match = urlLocRegex.exec(xml)) !== null) {
      urls.push(match[1].trim());
      if (urls.length >= MAX_URLS) break;
    }
    return urls;
  } catch (err) {
    console.warn(`[fetch-sitemap-tree] Failed to parse ${sitemapUrl}:`, err);
    return [];
  }
}

/**
 * Cluster URLs into a virtual folder tree.
 */
function clusterUrls(urls: string[], domain: string): FolderNode[] {
  const root: Record<string, { urls: string[]; children: Record<string, any> }> = {};

  for (const url of urls) {
    try {
      const u = new URL(url);
      const segments = u.pathname.split('/').filter(Boolean);
      if (segments.length === 0) {
        // Root page
        if (!root['__root__']) root['__root__'] = { urls: [], children: {} };
        root['__root__'].urls.push(url);
        continue;
      }

      // Build path
      let current = root;
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (!current[seg]) current[seg] = { urls: [], children: {} };
        if (i === segments.length - 1) {
          current[seg].urls.push(url);
        }
        current = current[seg].children;
      }
    } catch {
      // Skip malformed URLs
    }
  }

  // Convert to FolderNode tree
  function toNodes(obj: Record<string, any>, parentPath: string): FolderNode[] {
    return Object.entries(obj).map(([key, val]) => {
      const path = key === '__root__' ? '/' : `${parentPath}/${key}`;
      const children = toNodes(val.children || {}, path);
      const directUrls = (val.urls || []) as string[];
      const totalCount = directUrls.length + children.reduce((sum, c) => sum + c.count, 0);

      return {
        path: path === '/' ? '/' : path,
        label: key === '__root__' ? 'Accueil' : key,
        count: totalCount,
        children,
        urls: directUrls,
      };
    }).filter(n => n.count > 0)
      .sort((a, b) => b.count - a.count);
  }

  return toNodes(root, '');
}

/**
 * Heuristic classifier: infer category from path segment.
 * Uses known patterns first, then falls back to learned patterns from DB.
 */
const KNOWN_PATTERNS: Record<string, string> = {
  blog: 'blog', articles: 'blog', actualites: 'blog', news: 'blog', actu: 'blog', magazine: 'blog',
  produit: 'product', produits: 'product', product: 'product', products: 'product', shop: 'product', boutique: 'product',
  categorie: 'category', categories: 'category', category: 'category', rubrique: 'category', rubriques: 'category',
  page: 'page', pages: 'page', landing: 'page',
  service: 'service', services: 'service', prestations: 'service',
  contact: 'utility', mentions: 'utility', legal: 'utility', cgv: 'utility', cgu: 'utility', faq: 'utility', aide: 'utility', help: 'utility',
  tag: 'tag', tags: 'tag', etiquette: 'tag',
  auteur: 'author', author: 'author', authors: 'author',
  docs: 'documentation', documentation: 'documentation', doc: 'documentation', guide: 'documentation', guides: 'documentation',
  api: 'api', developers: 'api',
  media: 'media', images: 'media', uploads: 'media', assets: 'media',
  portfolio: 'portfolio', realisations: 'portfolio', projets: 'portfolio', projects: 'portfolio',
  tarifs: 'pricing', pricing: 'pricing', plans: 'pricing',
};

function classifySegment(segment: string): { category: string; confidence: number } {
  const lower = segment.toLowerCase().replace(/[-_]/g, '');
  
  // Exact match
  if (KNOWN_PATTERNS[lower]) {
    return { category: KNOWN_PATTERNS[lower], confidence: 0.95 };
  }
  
  // Partial match (e.g. "blog-posts" contains "blog")
  for (const [pattern, cat] of Object.entries(KNOWN_PATTERNS)) {
    if (lower.includes(pattern) || pattern.includes(lower)) {
      return { category: cat, confidence: 0.75 };
    }
  }
  
  // Numeric or hash-like segments are likely dynamic IDs
  if (/^\d+$/.test(segment) || /^[a-f0-9]{8,}$/.test(segment)) {
    return { category: 'dynamic', confidence: 0.6 };
  }
  
  return { category: 'unknown', confidence: 0.3 };
}

/**
 * Persist taxonomy entries for all tracked sites with this domain.
 * Also update global taxonomy_patterns for cross-site learning.
 */
async function persistTaxonomy(
  supabase: any,
  domain: string,
  tree: FolderNode[],
  allUrls: string[]
) {
  // Find tracked sites for this domain
  const { data: trackedSites } = await supabase
    .from('tracked_sites')
    .select('id')
    .or(`domain.eq.${domain},domain.eq.www.${domain}`);

  if (!trackedSites || trackedSites.length === 0) {
    console.log(`[taxonomy] No tracked sites for ${domain}, skipping persistence`);
    return;
  }

  // Flatten tree to taxonomy entries
  const entries: Array<{
    path_pattern: string;
    label: string;
    category: string;
    page_count: number;
    avg_depth: number;
    sample_urls: string[];
    confidence: number;
    source: string;
  }> = [];

  function flattenNode(node: FolderNode, depth: number) {
    if (node.path === '/') return; // Skip root
    
    const firstSegment = node.path.split('/').filter(Boolean)[0] || node.label;
    const { category, confidence } = classifySegment(firstSegment);
    
    entries.push({
      path_pattern: node.path.endsWith('/') ? `${node.path}*` : `${node.path}/*`,
      label: node.label,
      category,
      page_count: node.count,
      avg_depth: depth,
      sample_urls: node.urls.slice(0, 5),
      confidence,
      source: 'heuristic',
    });

    // Only recurse one level deep for top-level directories
    if (depth < 2) {
      for (const child of node.children) {
        flattenNode(child, depth + 1);
      }
    }
  }

  for (const node of tree) {
    flattenNode(node, 1);
  }

  // Upsert taxonomy for each tracked site
  for (const site of trackedSites) {
    const rows = entries.map(e => ({
      tracked_site_id: site.id,
      domain,
      ...e,
    }));

    if (rows.length > 0) {
      const { error } = await supabase
        .from('site_taxonomy')
        .upsert(rows, { onConflict: 'tracked_site_id,path_pattern' });
      if (error) {
        console.warn(`[taxonomy] Upsert failed for site ${site.id}:`, error.message);
      } else {
        console.log(`[taxonomy] Persisted ${rows.length} entries for site ${site.id}`);
      }
    }
  }

  // Update global pattern learning table
  const patternUpdates: Record<string, { category: string; count: number }> = {};
  for (const entry of entries) {
    if (entry.category !== 'unknown' && entry.confidence >= 0.7) {
      const key = `${entry.label}::${entry.category}`;
      if (!patternUpdates[key]) {
        patternUpdates[key] = { category: entry.category, count: entry.page_count };
      } else {
        patternUpdates[key].count += entry.page_count;
      }
    }
  }

  for (const [key, val] of Object.entries(patternUpdates)) {
    const segment = key.split('::')[0];
    await supabase.from('taxonomy_patterns').upsert({
      path_segment: segment,
      inferred_category: val.category,
      occurrence_count: val.count,
      confidence: Math.min(0.99, 0.5 + val.count * 0.01),
    }, { onConflict: 'path_segment,inferred_category' }).catch(() => {});
  }
}

Deno.serve(handleRequest(async (req) => {
try {
    const { domain } = await req.json();
    if (!domain || typeof domain !== 'string') {
      return jsonError('Missing domain', 400);
    }

    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase();

    const supabase = getServiceClient();

    // Check cache first
    const cacheKey = `sitemap_tree:${cleanDomain}`;
    const { data: cached } = await supabase
      .from('domain_data_cache')
      .select('result_data, expires_at')
      .eq('data_type', 'sitemap_tree')
      .eq('domain', cleanDomain)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cached?.result_data) {
      console.log(`[fetch-sitemap-tree] Cache hit for ${cleanDomain}`);
      return jsonOk({
        ...cached.result_data as Record<string, unknown>,
        cached: true,
      });
    }

    // Try common sitemap locations
    const sitemapCandidates = [
      `https://${cleanDomain}/sitemap.xml`,
      `https://${cleanDomain}/sitemap_index.xml`,
      `https://www.${cleanDomain}/sitemap.xml`,
      `https://${cleanDomain}/wp-sitemap.xml`,
    ];

    let allUrls: string[] = [];
    for (const candidate of sitemapCandidates) {
      if (allUrls.length > 0) break;
      console.log(`[fetch-sitemap-tree] Trying ${candidate}`);
      allUrls = await parseSitemapUrls(candidate);
    }

    // If no sitemap found, try robots.txt for sitemap location
    if (allUrls.length === 0) {
      try {
        const robotsRes = await fetchWithTimeout(`https://${cleanDomain}/robots.txt`, 5000);
        if (robotsRes.ok) {
          const robotsTxt = await robotsRes.text();
          const sitemapMatches = robotsTxt.match(/^Sitemap:\s*(.+)$/gim);
          if (sitemapMatches) {
            for (const match of sitemapMatches) {
              const url = match.replace(/^Sitemap:\s*/i, '').trim();
              allUrls = await parseSitemapUrls(url);
              if (allUrls.length > 0) break;
            }
          }
        }
      } catch {
        // Ignore robots.txt errors
      }
    }

    // Deduplicate
    allUrls = [...new Set(allUrls)].slice(0, MAX_URLS);

    // ── Fallback Firecrawl /map quand fetch direct est bloqué (OVH/Cloudflare 403) ──
    let fallbackSource: string | null = null;
    if (allUrls.length === 0) {
      const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
      if (firecrawlKey) {
        // Rate-limit anti-abus : 1 fallback Firecrawl / domaine / 24h via domain_data_cache
        const { data: recentFallback } = await supabase
          .from('domain_data_cache')
          .select('expires_at')
          .eq('data_type', 'sitemap_firecrawl_fallback')
          .eq('domain', cleanDomain)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        if (recentFallback) {
          console.log(`[fetch-sitemap-tree] Firecrawl fallback rate-limited for ${cleanDomain} (1/24h)`);
        } else {
          console.log(`[fetch-sitemap-tree] Direct fetch returned 0 URLs, trying Firecrawl /map fallback for ${cleanDomain}`);
          try {
            const fcController = new AbortController();
            const fcTid = setTimeout(() => fcController.abort(), 25_000);
            const fcRes = await fetch('https://api.firecrawl.dev/v2/map', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${firecrawlKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                url: `https://${cleanDomain}`,
                limit: MAX_URLS,
                includeSubdomains: false,
              }),
              signal: fcController.signal,
            });
            clearTimeout(fcTid);

            if (fcRes.ok) {
              const fcData = await fcRes.json();
              const links: string[] = Array.isArray(fcData?.links)
                ? fcData.links.map((l: any) => typeof l === 'string' ? l : l?.url).filter(Boolean)
                : Array.isArray(fcData?.data?.links) ? fcData.data.links : [];
              if (links.length > 0) {
                allUrls = [...new Set(links)].slice(0, MAX_URLS);
                fallbackSource = 'firecrawl_map';
                console.log(`[fetch-sitemap-tree] Firecrawl fallback recovered ${allUrls.length} URLs for ${cleanDomain}`);
              }
            } else {
              console.warn(`[fetch-sitemap-tree] Firecrawl /map failed: ${fcRes.status}`);
            }
          } catch (fcErr) {
            console.warn('[fetch-sitemap-tree] Firecrawl fallback error:', fcErr);
          }

          // Marque le fallback (succès ou échec) pour rate-limiter 24h
          await supabase.from('domain_data_cache').upsert({
            domain: cleanDomain,
            data_type: 'sitemap_firecrawl_fallback',
            result_data: { attempted: true, recovered: allUrls.length, source: fallbackSource },
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          }, { onConflict: 'domain,data_type' }).catch(() => {});
        }
      }
    }

    const tree = clusterUrls(allUrls, cleanDomain);

    const result = {
      tree,
      totalUrls: allUrls.length,
      domain: cleanDomain,
      fetchedAt: new Date().toISOString(),
      source: fallbackSource || 'direct_fetch',
    };

    // Cache results
    const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
    const { error: upsertError } = await supabase.from('domain_data_cache').upsert({
      domain: cleanDomain,
      data_type: 'sitemap_tree',
      result_data: result,
      expires_at: expiresAt,
    }, { onConflict: 'domain,data_type' });

    if (upsertError) {
      console.warn('[fetch-sitemap-tree] Upsert failed, trying insert:', upsertError.message);
      await supabase.from('domain_data_cache').insert({
        domain: cleanDomain,
        data_type: 'sitemap_tree',
        result_data: result,
        expires_at: expiresAt,
      });
    }

    // ── Persist taxonomy for tracked sites ──────────────────
    if (tree.length > 0) {
      try {
        await persistTaxonomy(supabase, cleanDomain, tree, allUrls);
      } catch (e) {
        console.warn('[fetch-sitemap-tree] Taxonomy persistence failed:', e);
      }
    }

    return jsonOk({ ...result, cached: false });

  } catch (error) {
    console.error('[fetch-sitemap-tree] Error:', error);
    return jsonError('Internal error', 500);
  }
}));