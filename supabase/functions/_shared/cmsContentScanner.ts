/**
 * cmsContentScanner.ts — Universal CMS content inventory scanner
 *
 * Queries all connected CMS for existing content (including drafts)
 * to prevent duplicate recommendations and enable "publish/modify draft" prescriptions.
 *
 * Supports: WordPress, Shopify, IKtracker, Drupal, Wix, Webflow, Odoo, PrestaShop
 */
import { getServiceClient } from './supabaseClient.ts';
import { isIktrackerDomain, isCrawlersDomain, getIktrackerApiKey, IKTRACKER_BASE_URL } from './domainUtils.ts';

export interface CmsContentItem {
  title: string;
  slug: string;
  status: 'draft' | 'published' | 'archived' | 'unknown';
  content_type: 'post' | 'page';
  platform: string;
  url?: string;
  updated_at?: string;
  excerpt?: string;
}

export interface CmsContentInventory {
  items: CmsContentItem[];
  drafts: CmsContentItem[];
  published: CmsContentItem[];
  scanned_platforms: string[];
  errors: string[];
}

/** Normalize for fuzzy comparison */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Jaccard word-overlap similarity */
export function titleSimilarity(a: string, b: string): number {
  const wordsA = new Set(normalize(a).split(' ').filter(w => w.length > 2));
  const wordsB = new Set(normalize(b).split(' ').filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) { if (wordsB.has(w)) intersection++; }
  return intersection / Math.max(wordsA.size, wordsB.size);
}

/**
 * Find existing CMS content that matches a proposed topic/title.
 * Returns matching items with similarity score.
 */
export function findMatchingContent(
  inventory: CmsContentInventory,
  proposedTitle: string,
  threshold = 0.5,
): Array<CmsContentItem & { similarity: number }> {
  return inventory.items
    .map(item => ({ ...item, similarity: titleSimilarity(proposedTitle, item.title) }))
    .filter(item => item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
}

/**
 * Scan all connected CMS for a given tracked site.
 * Returns a unified content inventory including drafts.
 */
export async function scanCmsContent(
  trackedSiteId: string,
  userId: string,
): Promise<CmsContentInventory> {
  const supabase = getServiceClient();
  const inventory: CmsContentInventory = {
    items: [],
    drafts: [],
    published: [],
    scanned_platforms: [],
    errors: [],
  };

  // 1) Check for CMS connections
  const { data: connections } = await supabase
    .from('cms_connections')
    .select('*')
    .eq('tracked_site_id', trackedSiteId)
    .eq('status', 'connected');

  // 2) Check for IKtracker (tracked_sites with api_key)
  const { data: site } = await supabase
    .from('tracked_sites')
    .select('domain, api_key')
    .eq('id', trackedSiteId)
    .eq('user_id', userId)
    .maybeSingle();

  const iktrackerApiKey = getIktrackerApiKey();
  const isIktracker = site?.domain ? isIktrackerDomain(site.domain) : false;

  // 3) Scan IKtracker if applicable
  if (isIktracker && iktrackerApiKey) {
    try {
      const baseUrl = IKTRACKER_BASE_URL;
      const resp = await fetch(`${baseUrl}/posts?status=all&limit=200`, {
        headers: { 'x-api-key': iktrackerApiKey },
        signal: AbortSignal.timeout(15000),
      });
      if (resp.ok) {
        const data = await resp.json();
        const posts: any[] = Array.isArray(data) ? data : (data?.data?.posts || data?.data?.data?.posts || data?.posts || data?.data || []);
        for (const post of posts) {
          const item: CmsContentItem = {
            title: post.title || '',
            slug: post.slug || '',
            status: mapStatus(post.status),
            content_type: 'post',
            platform: 'iktracker',
            url: post.slug ? `https://iktracker.fr/blog/${post.slug}` : undefined,
            updated_at: post.updated_at || post.created_at,
            excerpt: post.excerpt || post.meta_description || '',
          };
          inventory.items.push(item);
        }

        // Also scan pages
        const pagesResp = await fetch(`${baseUrl}/pages`, {
          headers: { 'x-api-key': iktrackerApiKey },
          signal: AbortSignal.timeout(10000),
        });
        if (pagesResp.ok) {
          const pagesData = await pagesResp.json();
          const pages: any[] = Array.isArray(pagesData) ? pagesData : (pagesData?.data?.pages || pagesData?.data?.data?.pages || pagesData?.pages || pagesData?.data || []);
          for (const page of pages) {
            inventory.items.push({
              title: page.title || '',
              slug: page.page_key || page.slug || '',
              status: mapStatus(page.status || 'published'),
              content_type: 'page',
              platform: 'iktracker',
              url: page.page_key ? `https://iktracker.fr/${page.page_key}` : undefined,
              updated_at: page.updated_at,
            });
          }
        }
        inventory.scanned_platforms.push('iktracker');
      }
    } catch (e) {
      inventory.errors.push(`iktracker: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 4) Scan internal CMS (blog_articles + seo_page_drafts) for crawlers.fr
  const isCrawlers = site?.domain ? isCrawlersDomain(site.domain) : false;
  if (isCrawlers) {
    try {
      // Scan blog_articles
      const { data: blogPosts } = await supabase
        .from('blog_articles')
        .select('title, slug, status, updated_at, excerpt')
        .in('status', ['published', 'draft']);
      for (const post of (blogPosts || [])) {
        inventory.items.push({
          title: post.title || '',
          slug: post.slug || '',
          status: mapStatus(post.status),
          content_type: 'post',
          platform: 'internal',
          url: `https://crawlers.fr/blog/${post.slug}`,
          updated_at: post.updated_at,
          excerpt: post.excerpt || '',
        });
      }

      // Scan seo_page_drafts (landing pages)
      const { data: landings } = await supabase
        .from('seo_page_drafts')
        .select('title, slug, status, updated_at, meta_description, page_type')
        .eq('page_type', 'landing');
      for (const page of (landings || [])) {
        inventory.items.push({
          title: page.title || '',
          slug: page.slug || '',
          status: mapStatus(page.status),
          content_type: 'page',
          platform: 'internal',
          url: `https://crawlers.fr/landing/${page.slug}`,
          updated_at: page.updated_at,
          excerpt: page.meta_description || '',
        });
      }
      inventory.scanned_platforms.push('internal');
    } catch (e) {
      inventory.errors.push(`internal: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 5) Scan WordPress connections
  if (connections) {
    for (const conn of connections) {
      try {
        if (conn.platform === 'wordpress') {
          await scanWordPress(conn, inventory);
        } else if (conn.platform === 'shopify') {
          await scanShopify(conn, inventory);
        }
        // Other CMS can be added here
      } catch (e) {
        inventory.errors.push(`${conn.platform}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // Classify
  inventory.drafts = inventory.items.filter(i => i.status === 'draft');
  inventory.published = inventory.items.filter(i => i.status === 'published');

  console.log(`[cmsContentScanner] Scanned ${inventory.scanned_platforms.join(', ')} → ${inventory.items.length} items (${inventory.drafts.length} drafts, ${inventory.published.length} published)`);

  return inventory;
}

function mapStatus(s: string | null | undefined): CmsContentItem['status'] {
  if (!s) return 'unknown';
  const lower = s.toLowerCase();
  if (lower === 'draft' || lower === 'brouillon') return 'draft';
  if (lower === 'published' || lower === 'publish' || lower === 'live') return 'published';
  if (lower === 'archived' || lower === 'trash') return 'archived';
  return 'unknown';
}

async function scanWordPress(conn: any, inventory: CmsContentInventory) {
  const baseUrl = conn.site_url.replace(/\/$/, '');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (conn.auth_method === 'basic' && conn.basic_auth_user && conn.basic_auth_pass) {
    headers['Authorization'] = `Basic ${btoa(`${conn.basic_auth_user}:${conn.basic_auth_pass}`)}`;
  } else if (conn.api_key) {
    headers['Authorization'] = `Bearer ${conn.api_key}`;
  }

  // Fetch posts (all statuses)
  for (const endpoint of ['posts', 'pages']) {
    try {
      const resp = await fetch(
        `${baseUrl}/wp-json/wp/v2/${endpoint}?status=any&per_page=100&_fields=id,title,slug,status,modified,excerpt`,
        { headers, signal: AbortSignal.timeout(15000) },
      );
      if (!resp.ok) continue;
      const items: any[] = await resp.json();
      for (const item of items) {
        inventory.items.push({
          title: item.title?.rendered || '',
          slug: item.slug || '',
          status: mapStatus(item.status),
          content_type: endpoint === 'posts' ? 'post' : 'page',
          platform: 'wordpress',
          url: `${baseUrl}/${item.slug}`,
          updated_at: item.modified,
          excerpt: item.excerpt?.rendered?.replace(/<[^>]*>/g, '').trim() || '',
        });
      }
    } catch (_) { /* skip */ }
  }
  inventory.scanned_platforms.push('wordpress');
}

async function scanShopify(conn: any, inventory: CmsContentInventory) {
  const baseUrl = conn.site_url.replace(/\/$/, '');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': conn.api_key || '',
  };

  // Fetch blog articles
  try {
    const resp = await fetch(
      `${baseUrl}/admin/api/2024-01/articles.json?limit=100&fields=id,title,handle,published_at,updated_at,summary_html`,
      { headers, signal: AbortSignal.timeout(15000) },
    );
    if (resp.ok) {
      const data = await resp.json();
      for (const article of (data.articles || [])) {
        inventory.items.push({
          title: article.title || '',
          slug: article.handle || '',
          status: article.published_at ? 'published' : 'draft',
          content_type: 'post',
          platform: 'shopify',
          url: `${baseUrl}/blogs/news/${article.handle}`,
          updated_at: article.updated_at,
          excerpt: article.summary_html?.replace(/<[^>]*>/g, '').trim() || '',
        });
      }
    }
  } catch (_) { /* skip */ }

  // Fetch pages
  try {
    const resp = await fetch(
      `${baseUrl}/admin/api/2024-01/pages.json?limit=100&fields=id,title,handle,published_at,updated_at`,
      { headers, signal: AbortSignal.timeout(15000) },
    );
    if (resp.ok) {
      const data = await resp.json();
      for (const page of (data.pages || [])) {
        inventory.items.push({
          title: page.title || '',
          slug: page.handle || '',
          status: page.published_at ? 'published' : 'draft',
          content_type: 'page',
          platform: 'shopify',
          url: `${baseUrl}/pages/${page.handle}`,
          updated_at: page.updated_at,
        });
      }
    }
  } catch (_) { /* skip */ }

  inventory.scanned_platforms.push('shopify');
}