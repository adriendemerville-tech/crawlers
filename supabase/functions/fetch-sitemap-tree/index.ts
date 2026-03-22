import { getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain } = await req.json();
    if (!domain || typeof domain !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing domain' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

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
      return new Response(JSON.stringify({
        ...cached.result_data as Record<string, unknown>,
        cached: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

    const tree = clusterUrls(allUrls, cleanDomain);

    const result = {
      tree,
      totalUrls: allUrls.length,
      domain: cleanDomain,
      fetchedAt: new Date().toISOString(),
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

    return new Response(JSON.stringify({ ...result, cached: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[fetch-sitemap-tree] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal error', tree: [], totalUrls: 0 }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
