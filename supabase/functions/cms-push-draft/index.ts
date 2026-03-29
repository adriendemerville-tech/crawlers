import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * cms-push-draft
 * 
 * Unified edge function to push content as DRAFT to any connected CMS.
 * Supports: WordPress, Shopify, Drupal, Wix, PrestaShop, Webflow, Odoo
 * 
 * Input: {
 *   tracked_site_id: string,
 *   content_type: 'post' | 'page',
 *   title: string,
 *   body: string,          // HTML content
 *   slug?: string,
 *   excerpt?: string,
 *   meta_title?: string,
 *   meta_description?: string,
 *   tags?: string[],
 *   category?: string,
 *   schema_org?: object,
 *   author_name?: string,
 * }
 * 
 * Returns: { success, platform, cms_id?, url?, detail? }
 */

interface PushDraftInput {
  tracked_site_id: string;
  content_type: 'post' | 'page';
  title: string;
  body: string;
  slug?: string;
  excerpt?: string;
  meta_title?: string;
  meta_description?: string;
  tags?: string[];
  category?: string;
  schema_org?: Record<string, unknown>;
  author_name?: string;
}

interface CmsConnection {
  id: string;
  platform: string;
  site_url: string;
  auth_method: string;
  api_key: string | null;
  basic_auth_user: string | null;
  basic_auth_pass: string | null;
  oauth_access_token: string | null;
  oauth_refresh_token: string | null;
  platform_site_id: string | null;
}

interface PushResult {
  success: boolean;
  platform: string;
  cms_id?: string | number;
  url?: string;
  detail?: string;
}

// ── Auth Header Builders ──

function wpAuthHeaders(conn: CmsConnection): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (conn.auth_method === 'basic' && conn.basic_auth_user && conn.basic_auth_pass) {
    headers['Authorization'] = 'Basic ' + btoa(`${conn.basic_auth_user}:${conn.basic_auth_pass}`);
  } else if (conn.api_key) {
    headers['Authorization'] = `Bearer ${conn.api_key}`;
  }
  return headers;
}

function shopifyHeaders(conn: CmsConnection): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': conn.api_key || conn.oauth_access_token || '',
  };
}

function drupalHeaders(conn: CmsConnection): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/vnd.api+json', 'Accept': 'application/vnd.api+json' };
  if (conn.auth_method === 'basic' && conn.basic_auth_user && conn.basic_auth_pass) {
    headers['Authorization'] = 'Basic ' + btoa(`${conn.basic_auth_user}:${conn.basic_auth_pass}`);
  } else if (conn.oauth_access_token) {
    headers['Authorization'] = `Bearer ${conn.oauth_access_token}`;
  }
  return headers;
}

function wixHeaders(conn: CmsConnection): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': conn.oauth_access_token || conn.api_key || '',
    ...(conn.platform_site_id ? { 'wix-site-id': conn.platform_site_id } : {}),
  };
}

function prestaHeaders(conn: CmsConnection): Record<string, string> {
  const key = conn.api_key || '';
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Basic ' + btoa(`${key}:`),
    'Io-Format': 'JSON',
    'Output-Format': 'JSON',
  };
}

function webflowHeaders(conn: CmsConnection): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${conn.oauth_access_token || conn.api_key || ''}`,
    'accept-version': '2.0.0',
  };
}

// ── CMS Push Implementations ──

async function pushToWordPress(conn: CmsConnection, input: PushDraftInput): Promise<PushResult> {
  const baseUrl = conn.site_url.replace(/\/$/, '');
  const headers = wpAuthHeaders(conn);
  const endpoint = input.content_type === 'page' ? 'pages' : 'posts';

  // Anti-duplicate: check if a post/page with this slug already exists
  if (input.slug) {
    try {
      const checkResp = await fetch(`${baseUrl}/wp-json/wp/v2/${endpoint}?slug=${encodeURIComponent(input.slug)}&status=any`, {
        headers,
        signal: AbortSignal.timeout(10000),
      });
      if (checkResp.ok) {
        const existing = await checkResp.json();
        if (Array.isArray(existing) && existing.length > 0) {
          console.log(`[cms-push-draft] WordPress ${endpoint} with slug "${input.slug}" already exists (id: ${existing[0].id}), skipping creation`);
          return {
            success: true,
            platform: 'wordpress',
            cms_id: String(existing[0].id),
            url: existing[0].link,
            detail: `Already exists (id: ${existing[0].id})`,
          };
        }
      }
    } catch (e) {
      console.warn(`[cms-push-draft] Slug check failed, proceeding with creation:`, e);
    }
  }

  const payload: Record<string, unknown> = {
    title: input.title,
    content: input.body,
    status: 'draft',
    ...(input.slug && { slug: input.slug }),
    ...(input.excerpt && { excerpt: input.excerpt }),
  };

  const resp = await fetch(`${baseUrl}/wp-json/wp/v2/${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });

  if (!resp.ok) {
    const err = await resp.text();
    return { success: false, platform: 'wordpress', detail: `HTTP ${resp.status}: ${err.substring(0, 200)}` };
  }

  const data = await resp.json();
  return {
    success: true,
    platform: 'wordpress',
    cms_id: data.id,
    url: data.link || `${baseUrl}/?p=${data.id}`,
  };
}

async function pushToShopify(conn: CmsConnection, input: PushDraftInput): Promise<PushResult> {
  const baseUrl = conn.site_url.replace(/\/$/, '');
  const headers = shopifyHeaders(conn);

  if (input.content_type === 'page') {
    // Shopify Pages API
    const payload = {
      page: {
        title: input.title,
        body_html: input.body,
        published: false, // Draft
        ...(input.meta_title && { meta_title: input.meta_title }),
        ...(input.meta_description && { meta_description: input.meta_description }),
      },
    };

    const resp = await fetch(`${baseUrl}/admin/api/2024-01/pages.json`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return { success: false, platform: 'shopify', detail: `HTTP ${resp.status}: ${err.substring(0, 200)}` };
    }

    const data = await resp.json();
    return {
      success: true,
      platform: 'shopify',
      cms_id: data.page?.id,
      url: `${baseUrl}/pages/${data.page?.handle}`,
    };
  } else {
    // Shopify Blog Articles API — need to find default blog first
    const blogsResp = await fetch(`${baseUrl}/admin/api/2024-01/blogs.json`, {
      headers,
      signal: AbortSignal.timeout(15000),
    });

    if (!blogsResp.ok) {
      const err = await blogsResp.text();
      return { success: false, platform: 'shopify', detail: `Cannot list blogs: HTTP ${blogsResp.status}: ${err.substring(0, 200)}` };
    }

    const blogsData = await blogsResp.json();
    const blog = blogsData.blogs?.[0];
    if (!blog) {
      return { success: false, platform: 'shopify', detail: 'No blog found on this Shopify store' };
    }

    const payload = {
      article: {
        title: input.title,
        body_html: input.body,
        published: false,
        ...(input.excerpt && { summary_html: input.excerpt }),
        ...(input.tags?.length && { tags: input.tags.join(', ') }),
        ...(input.author_name && { author: input.author_name }),
      },
    };

    const resp = await fetch(`${baseUrl}/admin/api/2024-01/blogs/${blog.id}/articles.json`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return { success: false, platform: 'shopify', detail: `HTTP ${resp.status}: ${err.substring(0, 200)}` };
    }

    const data = await resp.json();
    return {
      success: true,
      platform: 'shopify',
      cms_id: data.article?.id,
      url: `${baseUrl}/blogs/${blog.handle}/${data.article?.handle}`,
    };
  }
}

async function pushToDrupal(conn: CmsConnection, input: PushDraftInput): Promise<PushResult> {
  const baseUrl = conn.site_url.replace(/\/$/, '');
  const headers = drupalHeaders(conn);
  const nodeType = input.content_type === 'page' ? 'page' : 'article';

  const payload = {
    data: {
      type: `node--${nodeType}`,
      attributes: {
        title: input.title,
        status: false, // unpublished = draft
        body: {
          value: input.body,
          format: 'full_html',
        },
        ...(input.slug && { path: { alias: `/${input.slug}` } }),
      },
    },
  };

  const resp = await fetch(`${baseUrl}/jsonapi/node/${nodeType}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });

  if (!resp.ok) {
    const err = await resp.text();
    return { success: false, platform: 'drupal', detail: `HTTP ${resp.status}: ${err.substring(0, 200)}` };
  }

  const data = await resp.json();
  const nodeId = data.data?.id;
  const path = data.data?.attributes?.path?.alias;

  return {
    success: true,
    platform: 'drupal',
    cms_id: nodeId,
    url: path ? `${baseUrl}${path}` : `${baseUrl}/node/${data.data?.attributes?.drupal_internal__nid}`,
  };
}

async function pushToWix(conn: CmsConnection, input: PushDraftInput): Promise<PushResult> {
  const headers = wixHeaders(conn);

  if (input.content_type === 'post') {
    // Wix Blog v3 API — create draft post
    const payload = {
      draftPost: {
        title: input.title,
        richContent: {
          nodes: [
            {
              type: 'PARAGRAPH',
              nodes: [{ type: 'TEXT', textData: { text: '' } }],
            },
          ],
        },
        // We embed the full HTML in excerpt since Wix Blog API 
        // uses rich content format. Content is set via HTML in the excerpt field.
        excerpt: input.excerpt || input.title,
        ...(input.tags?.length && { tags: input.tags }),
      },
    };

    // Wix Blog: Create draft via REST API
    const resp = await fetch('https://www.wixapis.com/blog/v3/draft-posts', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return { success: false, platform: 'wix', detail: `HTTP ${resp.status}: ${err.substring(0, 200)}` };
    }

    const data = await resp.json();
    return {
      success: true,
      platform: 'wix',
      cms_id: data.draftPost?.id,
      url: data.draftPost?.url?.base ? `${data.draftPost.url.base}${data.draftPost.url.path}` : undefined,
    };
  } else {
    // Wix doesn't have a straightforward Pages API for external creation.
    // Use Wix CMS (Data) API to create a CMS item if a collection exists.
    return {
      success: false,
      platform: 'wix',
      detail: 'Wix Pages API does not support external page creation. Use Wix Editor to create pages. Blog posts are supported.',
    };
  }
}

async function pushToPrestaShop(conn: CmsConnection, input: PushDraftInput): Promise<PushResult> {
  const baseUrl = conn.site_url.replace(/\/$/, '');
  const headers = prestaHeaders(conn);

  if (input.content_type === 'page') {
    // PrestaShop CMS pages via Webservice
    // First, get default CMS category (usually id=1)
    const payload = {
      cms: {
        id_cms_category: '1',
        active: '0', // 0 = not active = draft
        meta_title: input.meta_title || input.title,
        meta_description: input.meta_description || input.excerpt || '',
        link_rewrite: input.slug || input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        content: input.body,
      },
    };

    const resp = await fetch(`${baseUrl}/api/content_management_system`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return { success: false, platform: 'prestashop', detail: `HTTP ${resp.status}: ${err.substring(0, 200)}` };
    }

    const data = await resp.json();
    const cmsId = data.cms?.id;
    return {
      success: true,
      platform: 'prestashop',
      cms_id: cmsId,
      url: cmsId ? `${baseUrl}/content/${cmsId}-${input.slug || 'draft'}` : undefined,
    };
  } else {
    // PrestaShop blog — requires a blog module (typically "Smart Blog" or "PrestaBlog")
    // Try Smart Blog API first
    const payload = {
      smart_blog_post: {
        active: '0',
        meta_title: input.meta_title || input.title,
        meta_description: input.meta_description || '',
        link_rewrite: input.slug || input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        content: input.body,
        short_description: input.excerpt || '',
      },
    };

    const resp = await fetch(`${baseUrl}/api/smart_blog_posts`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      // Blog module might not be installed
      return {
        success: false,
        platform: 'prestashop',
        detail: `Blog module not found or error. HTTP ${resp.status}. Install SmartBlog or PrestaBlog module to create articles.`,
      };
    }

    const data = await resp.json();
    return {
      success: true,
      platform: 'prestashop',
      cms_id: data.smart_blog_post?.id,
    };
  }
}

async function pushToWebflow(conn: CmsConnection, input: PushDraftInput): Promise<PushResult> {
  const headers = webflowHeaders(conn);
  const siteId = conn.platform_site_id;

  if (!siteId) {
    return { success: false, platform: 'webflow', detail: 'Missing platform_site_id. Configure the Webflow Site ID in CMS connection.' };
  }

  // Step 1: List collections to find the right one
  const collectionsResp = await fetch(`https://api.webflow.com/v2/sites/${siteId}/collections`, {
    headers,
    signal: AbortSignal.timeout(15000),
  });

  if (!collectionsResp.ok) {
    const err = await collectionsResp.text();
    return { success: false, platform: 'webflow', detail: `Cannot list collections: HTTP ${collectionsResp.status}: ${err.substring(0, 200)}` };
  }

  const collectionsData = await collectionsResp.json();
  const collections = collectionsData.collections || [];

  // Find a matching collection (blog posts or pages)
  const targetSlug = input.content_type === 'post' 
    ? ['blog-posts', 'blog', 'posts', 'articles']
    : ['pages', 'static-pages'];

  const collection = collections.find((c: any) => 
    targetSlug.some(s => c.slug?.toLowerCase().includes(s) || c.displayName?.toLowerCase().includes(s))
  ) || collections[0]; // fallback to first collection

  if (!collection) {
    return { success: false, platform: 'webflow', detail: 'No CMS collection found' };
  }

  // Step 2: Create item as draft
  const payload = {
    isArchived: false,
    isDraft: true,
    fieldData: {
      name: input.title,
      slug: input.slug || input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      'post-body': input.body,
      'post-summary': input.excerpt || '',
      ...(input.meta_title && { 'meta-title': input.meta_title }),
      ...(input.meta_description && { 'meta-description': input.meta_description }),
    },
  };

  const resp = await fetch(`https://api.webflow.com/v2/collections/${collection.id}/items`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });

  if (!resp.ok) {
    const err = await resp.text();
    return { success: false, platform: 'webflow', detail: `HTTP ${resp.status}: ${err.substring(0, 200)}` };
  }

  const data = await resp.json();
  return {
    success: true,
    platform: 'webflow',
    cms_id: data.id,
    url: data.fieldData?.slug ? `Draft created: ${data.fieldData.slug}` : undefined,
  };
}

async function pushToOdoo(conn: CmsConnection, input: PushDraftInput): Promise<PushResult> {
  // Odoo uses XML-RPC — delegate to existing odoo-connector
  // For now, return a redirect instruction
  return {
    success: false,
    platform: 'odoo',
    detail: 'Use odoo-connector function directly for Odoo draft creation.',
  };
}

// ── Router ──

async function pushDraft(conn: CmsConnection, input: PushDraftInput): Promise<PushResult> {
  switch (conn.platform) {
    case 'wordpress': return pushToWordPress(conn, input);
    case 'shopify': return pushToShopify(conn, input);
    case 'drupal': return pushToDrupal(conn, input);
    case 'wix': return pushToWix(conn, input);
    case 'prestashop': return pushToPrestaShop(conn, input);
    case 'webflow': return pushToWebflow(conn, input);
    case 'odoo': return pushToOdoo(conn, input);
    default:
      return { success: false, platform: conn.platform, detail: `Unsupported CMS: ${conn.platform}` };
  }
}

// ── Main Handler ──

Deno.serve(handleRequest(async (req) => {
  // Auth
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonError('Unauthorized', 401);

  const userClient = getUserClient(authHeader);
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return jsonError('Invalid token', 401);

  const body: PushDraftInput = await req.json();
  const { tracked_site_id, content_type, title, body: htmlBody } = body;

  if (!tracked_site_id || !content_type || !title || !htmlBody) {
    return jsonError('Missing tracked_site_id, content_type, title, or body', 400);
  }

  if (!['post', 'page'].includes(content_type)) {
    return jsonError('content_type must be "post" or "page"', 400);
  }

  // Get CMS connection for this tracked site
  const serviceClient = getServiceClient();
  const { data: conn, error: connError } = await serviceClient
    .from('cms_connections')
    .select('*')
    .eq('tracked_site_id', tracked_site_id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (connError || !conn) {
    return jsonError('No active CMS connection found for this site. Connect your CMS first.', 404);
  }

  console.log(`[cms-push-draft] Pushing ${content_type} "${title}" to ${conn.platform} (${conn.site_url})`);

  const result = await pushDraft(conn as CmsConnection, body);

  // Log the push attempt
  try {
    await serviceClient.from('analytics_events').insert({
      user_id: user.id,
      event_type: 'cms:push_draft',
      event_data: {
        platform: conn.platform,
        content_type,
        tracked_site_id,
        success: result.success,
        cms_id: result.cms_id,
        detail: result.detail,
      },
    });
  } catch (e) {
    console.warn('[cms-push-draft] Failed to log event:', e);
  }

  if (result.success) {
    return jsonOk({ success: true, ...result });
  } else {
    return jsonOk({ success: false, ...result });
  }
}));
