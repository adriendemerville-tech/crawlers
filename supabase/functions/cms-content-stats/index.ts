import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * cms-content-stats
 * 
 * Queries the connected CMS for a tracked site and returns editorial dashboard metrics:
 * - Total articles, authors, topics, avg words/article, publishing frequency
 * - Short articles (<500w), long articles (>1500w), missing images, missing meta desc, missing subtitles
 * - Top topics, SEO alerts count
 * 
 * For internal CMS (crawlers.fr), queries blog_articles + seo_page_drafts directly.
 * For external CMS, delegates to the appropriate edge function.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface Article {
  title?: string;
  body?: string;
  content?: string;
  author?: string;
  author_id?: string;
  category?: string;
  categories?: string[];
  topic?: string;
  image_url?: string;
  featured_image?: string;
  meta_description?: string;
  excerpt?: string;
  status?: string;
  published_at?: string;
  created_at?: string;
  slug?: string;
}

interface EditorialStats {
  total_articles: number;
  authors_count: number;
  topics_count: number;
  avg_words: number;
  publishing_frequency_days: number | null;
  short_articles: number; // <500 words
  long_articles: number; // >1500 words
  missing_image: number;
  missing_meta_desc: number;
  missing_subtitle: number;
  top_topics: { name: string; count: number }[];
  seo_alerts: number;
}

function countWords(text?: string | null): number {
  if (!text) return 0;
  // Strip HTML tags
  const clean = text.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ');
  return clean.split(/\s+/).filter(w => w.length > 0).length;
}

function hasSubtitle(text?: string | null): boolean {
  if (!text) return false;
  return /<h[2-6][^>]*>/i.test(text);
}

function computeStats(articles: Article[]): EditorialStats {
  const published = articles.filter(a => a.status === 'published' || a.status === 'publish');
  
  const authorsSet = new Set<string>();
  const topicsMap = new Map<string, number>();
  let totalWords = 0;
  let shortCount = 0;
  let longCount = 0;
  let missingImage = 0;
  let missingMeta = 0;
  let missingSubtitle = 0;
  let seoAlerts = 0;

  const dates: number[] = [];

  for (const a of published) {
    const body = a.body || a.content || '';
    const words = countWords(body);
    totalWords += words;

    if (words < 500) shortCount++;
    if (words > 1500) longCount++;

    if (!a.image_url && !a.featured_image) missingImage++;
    if (!a.meta_description && !a.excerpt) { missingMeta++; seoAlerts++; }
    if (!hasSubtitle(body)) { missingSubtitle++; seoAlerts++; }

    const author = a.author || a.author_id || 'unknown';
    authorsSet.add(author);

    const cats = a.categories || (a.category ? [a.category] : []) as string[];
    for (const c of cats) {
      if (c && c !== 'Uncategorized' && c !== 'Non classé') {
        topicsMap.set(c, (topicsMap.get(c) || 0) + 1);
      }
    }

    const dateStr = a.published_at || a.created_at;
    if (dateStr) dates.push(new Date(dateStr).getTime());
  }

  // Calculate publishing frequency
  let frequencyDays: number | null = null;
  if (dates.length >= 2) {
    dates.sort((a, b) => a - b);
    const totalSpan = dates[dates.length - 1] - dates[0];
    frequencyDays = Math.round(totalSpan / (dates.length - 1) / (1000 * 60 * 60 * 24));
  }

  // Top topics
  const topTopics = [...topicsMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Missing image is also an SEO alert
  seoAlerts += missingImage;

  return {
    total_articles: published.length,
    authors_count: authorsSet.size,
    topics_count: topicsMap.size,
    avg_words: published.length > 0 ? Math.round(totalWords / published.length) : 0,
    publishing_frequency_days: frequencyDays,
    short_articles: shortCount,
    long_articles: longCount,
    missing_image: missingImage,
    missing_meta_desc: missingMeta,
    missing_subtitle: missingSubtitle,
    top_topics: topTopics,
    seo_alerts: seoAlerts,
  };
}

// ─── Internal CMS (crawlers.fr) ──────────────────────────────
async function fetchInternalArticles(supabase: ReturnType<typeof getServiceClient>): Promise<Article[]> {
  // Fetch blog articles
  const { data: blogData, error: blogErr } = await supabase
    .from('blog_articles')
    .select('title, content, author_id, slug, status, published_at, created_at, image_url, excerpt')
    .limit(500);

  if (blogErr) throw new Error(`DB error: ${blogErr.message}`);

  const articles: Article[] = (blogData || []).map((a: any) => ({
    title: a.title,
    body: a.content,
    author_id: a.author_id,
    slug: a.slug,
    status: a.status,
    published_at: a.published_at,
    created_at: a.created_at,
    image_url: a.image_url,
    excerpt: a.excerpt,
  }));

  // Also fetch SEO page drafts (landing pages)
  const { data: draftData } = await supabase
    .from('seo_page_drafts')
    .select('title, content, slug, status, created_at, updated_at, meta_description, page_type')
    .eq('page_type', 'landing')
    .limit(200);

  for (const d of (draftData || [])) {
    articles.push({
      title: d.title,
      body: d.content,
      slug: d.slug,
      status: d.status === 'published' ? 'published' : 'draft',
      created_at: d.created_at,
      meta_description: d.meta_description,
      categories: ['Landing Page'],
    });
  }

  return articles;
}

// ─── IKTracker CMS ──────────────────────────────────────────
async function fetchIktrackerArticles(): Promise<Article[]> {
  const articles: Article[] = [];

  // Fetch posts
  let offset = 0;
  const limit = 100;

  while (true) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/iktracker-actions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list-posts', limit, offset }),
    });
    if (!res.ok) break;
    const json = await res.json();
    // iktracker-actions wraps responses in several possible shapes:
    //   { result: { data: { data: { posts: [...] } } } }   (current)
    //   { data: { data: { posts: [...] } } }               (legacy)
    //   { data: [...] }                                     (legacy flat)
    const inner = json?.result?.data ?? json?.data;
    const rawData = inner?.data ?? inner;
    const posts = Array.isArray(rawData) ? rawData : (rawData?.posts || []);
    if (posts.length === 0) break;

    for (const p of posts) {
      articles.push({
        title: p.title,
        body: p.content || p.body || p.html_content,
        author: p.author || p.author_name,
        category: p.category,
        categories: p.categories ? (Array.isArray(p.categories) ? p.categories : [p.categories]) : (p.category ? [p.category] : []),
        image_url: p.featured_image || p.image_url || p.image,
        meta_description: p.meta_description || p.seo_description || p.excerpt,
        excerpt: p.excerpt,
        status: p.status || 'published',
        published_at: p.published_at || p.date || p.created_at,
        created_at: p.created_at,
        slug: p.slug,
      });
    }

    if (posts.length < limit) break;
    offset += limit;
    if (offset > 1000) break;
  }

  // Also fetch pages
  try {
    const pagesRes = await fetch(`${SUPABASE_URL}/functions/v1/iktracker-actions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list-pages' }),
    });
    if (pagesRes.ok) {
      const pagesJson = await pagesRes.json();
      const innerP = pagesJson?.result?.data ?? pagesJson?.data;
      const rawPages = innerP?.data ?? innerP;
      const pages = Array.isArray(rawPages) ? rawPages : (rawPages?.pages || []);
      for (const pg of pages) {
        articles.push({
          title: pg.title,
          body: pg.content || pg.body || pg.html_content,
          status: pg.status || 'published',
          published_at: pg.published_at || pg.created_at,
          created_at: pg.created_at,
          slug: pg.page_key || pg.slug,
          categories: ['Page'],
          image_url: pg.featured_image || pg.image_url,
          meta_description: pg.meta_description || pg.seo_description,
        });
      }
    }
  } catch { /* pages are optional */ }

  return articles;
}

// ─── WordPress CMS ──────────────────────────────────────────
async function fetchWordpressArticles(conn: any): Promise<Article[]> {
  const siteUrl = conn.site_url.replace(/\/+$/, '');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  
  if (conn.basic_auth_user && conn.basic_auth_pass) {
    headers['Authorization'] = `Basic ${btoa(`${conn.basic_auth_user}:${conn.basic_auth_pass}`)}`;
  } else if (conn.oauth_access_token) {
    headers['Authorization'] = `Bearer ${conn.oauth_access_token}`;
  } else if (conn.api_key) {
    headers['Authorization'] = `Bearer ${conn.api_key}`;
  }

  const articles: Article[] = [];
  let page = 1;

  while (page <= 20) {
    try {
      const res = await fetch(`${siteUrl}/wp-json/wp/v2/posts?per_page=50&page=${page}&status=publish`, { headers });
      if (!res.ok) break;
      const posts = await res.json();
      if (!Array.isArray(posts) || posts.length === 0) break;

      for (const p of posts) {
        articles.push({
          title: p.title?.rendered,
          body: p.content?.rendered,
          excerpt: p.excerpt?.rendered,
          author_id: String(p.author || ''),
          status: p.status || 'published',
          published_at: p.date,
          slug: p.slug,
          featured_image: p.featured_media ? `wp-media-${p.featured_media}` : undefined,
          categories: (p.categories || []).map((c: number) => String(c)),
        });
      }

      const totalPages = parseInt(res.headers.get('X-WP-TotalPages') || '1');
      if (page >= totalPages) break;
      page++;
    } catch {
      break;
    }
  }

  return articles;
}

// ─── Drupal CMS ─────────────────────────────────────────────
async function fetchDrupalArticles(conn: any): Promise<Article[]> {
  const siteUrl = conn.site_url.replace(/\/+$/, '');
  const headers: Record<string, string> = {
    'Content-Type': 'application/vnd.api+json',
    'Accept': 'application/vnd.api+json',
  };
  
  if (conn.auth_method === 'oauth2' && conn.oauth_access_token) {
    headers['Authorization'] = `Bearer ${conn.oauth_access_token}`;
  } else if (conn.auth_method === 'basic' && conn.basic_auth_user && conn.basic_auth_pass) {
    headers['Authorization'] = `Basic ${btoa(`${conn.basic_auth_user}:${conn.basic_auth_pass}`)}`;
  }

  const articles: Article[] = [];
  let path = `/jsonapi/node/article?page[limit]=50&sort=-changed`;

  while (path && articles.length < 500) {
    try {
      const res = await fetch(`${siteUrl}${path}`, { headers });
      if (!res.ok) break;
      const data = await res.json();
      
      for (const node of (data?.data || [])) {
        articles.push({
          title: node.attributes?.title,
          body: node.attributes?.body?.value,
          status: node.attributes?.status ? 'published' : 'draft',
          published_at: node.attributes?.created,
          slug: node.attributes?.path?.alias,
        });
      }

      const nextLink = data?.links?.next?.href;
      if (nextLink) {
        const url = new URL(nextLink);
        path = url.pathname + url.search;
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  return articles;
}

// ─── Shopify CMS ────────────────────────────────────────────
async function fetchShopifyArticles(conn: any): Promise<Article[]> {
  const siteUrl = conn.site_url.replace(/\/+$/, '');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (conn.api_key) headers['X-Shopify-Access-Token'] = conn.api_key;

  const articles: Article[] = [];

  try {
    const res = await fetch(`${siteUrl}/admin/api/2024-01/articles.json?limit=250`, { headers });
    if (!res.ok) return articles;
    const data = await res.json();
    
    for (const a of (data?.articles || [])) {
      articles.push({
        title: a.title,
        body: a.body_html,
        author: a.author,
        status: a.published_at ? 'published' : 'draft',
        published_at: a.published_at,
        created_at: a.created_at,
        image_url: a.image?.src,
        meta_description: a.summary_html,
      });
    }
  } catch { /* ignore */ }

  return articles;
}

Deno.serve(handleRequest(async (req) => {
  // Auth
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return jsonError('Missing authorization', 401);

  const userClient = getUserClient(authHeader);
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return jsonError('Unauthorized', 401);

  const { tracked_site_id } = await req.json();
  if (!tracked_site_id) return jsonError('tracked_site_id required', 400);

  const supabase = getServiceClient();

  // Get tracked site
  const { data: site, error: siteErr } = await supabase
    .from('tracked_sites')
    .select('id, domain, user_id')
    .eq('id', tracked_site_id)
    .eq('user_id', user.id)
    .single();

  if (siteErr || !site) return jsonError('Site not found', 404);

  const domain = site.domain;
  let articles: Article[] = [];

  // Check if internal CMS
  if (domain.includes('crawlers')) {
    articles = await fetchInternalArticles(supabase);
  } else {
    // Find CMS connection
    const { data: conn } = await supabase
      .from('cms_connections')
      .select('*')
      .eq('tracked_site_id', tracked_site_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (!conn) {
      // Check if it's IKTracker domain
      if (domain.includes('iktracker')) {
        articles = await fetchIktrackerArticles();
      } else {
        return jsonOk({
          stats: null,
          error: 'no_cms_connection',
          message: 'Aucune connexion CMS active pour ce site. Connectez votre CMS depuis Mes Sites.',
        });
      }
    } else {
      switch (conn.platform) {
        case 'wordpress':
          articles = await fetchWordpressArticles(conn);
          break;
        case 'drupal':
          articles = await fetchDrupalArticles(conn);
          break;
        case 'shopify':
          articles = await fetchShopifyArticles(conn);
          break;
        case 'iktracker':
          articles = await fetchIktrackerArticles();
          break;
        default:
          return jsonOk({ stats: null, error: 'unsupported_cms', message: `CMS "${conn.platform}" non supporté pour les stats éditoriales.` });
      }
    }
  }

  const stats = computeStats(articles);

  // Build a lightweight article list for the UI (title, status, type, url, date)
  const list = articles.map((a) => {
    const rawStatus = (a.status || 'published').toLowerCase();
    const normalizedStatus =
      rawStatus === 'publish' || rawStatus === 'published' || rawStatus === 'live'
        ? 'published'
        : rawStatus === 'draft' || rawStatus === 'brouillon'
        ? 'draft'
        : rawStatus === 'archived' || rawStatus === 'trash'
        ? 'archived'
        : rawStatus;
    const isPage = (a.categories || []).some((c) => c === 'Page' || c === 'Landing Page');
    return {
      title: a.title || '(sans titre)',
      slug: a.slug || null,
      status: normalizedStatus,
      type: isPage ? 'page' : 'post',
      published_at: a.published_at || a.created_at || null,
      url: a.slug
        ? domain.includes('crawlers')
          ? isPage
            ? `https://crawlers.fr/landing/${a.slug}`
            : `https://crawlers.fr/blog/${a.slug}`
          : domain.includes('iktracker')
          ? isPage
            ? `https://iktracker.fr/${a.slug}`
            : `https://iktracker.fr/blog/${a.slug}`
          : null
        : null,
    };
  })
  // Sort: drafts first, then by date desc
  .sort((a, b) => {
    if (a.status !== b.status) {
      if (a.status === 'draft') return -1;
      if (b.status === 'draft') return 1;
    }
    const da = a.published_at ? new Date(a.published_at).getTime() : 0;
    const db = b.published_at ? new Date(b.published_at).getTime() : 0;
    return db - da;
  });

  return jsonOk({ stats, domain, articles_fetched: articles.length, articles: list });
}, 'cms-content-stats'));
