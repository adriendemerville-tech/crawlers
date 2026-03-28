import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * cms-push-redirect
 * 
 * Create, list, and delete HTTP redirections (301/302) on connected CMS platforms.
 * Supports: WordPress, Shopify, Drupal, Wix, Webflow, PrestaShop, Odoo
 * 
 * Actions:
 *   - create: { from: string, to: string, type: 301|302 }
 *   - list: returns all redirects
 *   - delete: { redirect_id: string }
 */

interface RedirectInput {
  tracked_site_id: string;
  action: 'create' | 'list' | 'delete';
  from?: string;
  to?: string;
  type?: 301 | 302;
  redirect_id?: string;
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

interface RedirectEntry {
  id: string;
  from: string;
  to: string;
  type: number;
}

interface RedirectResult {
  success: boolean;
  platform: string;
  action: string;
  data?: RedirectEntry[] | RedirectEntry | { deleted: boolean };
  error?: string;
}

// ── Auth helpers (reused pattern) ──

function wpHeaders(conn: CmsConnection): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (conn.auth_method === 'basic' && conn.basic_auth_user && conn.basic_auth_pass) {
    h['Authorization'] = 'Basic ' + btoa(`${conn.basic_auth_user}:${conn.basic_auth_pass}`);
  } else if (conn.api_key) {
    h['Authorization'] = `Bearer ${conn.api_key}`;
  }
  return h;
}

function shopifyHeaders(conn: CmsConnection): Record<string, string> {
  return { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': conn.api_key || conn.oauth_access_token || '' };
}

function drupalHeaders(conn: CmsConnection): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/vnd.api+json', 'Accept': 'application/vnd.api+json' };
  if (conn.auth_method === 'basic' && conn.basic_auth_user && conn.basic_auth_pass) {
    h['Authorization'] = 'Basic ' + btoa(`${conn.basic_auth_user}:${conn.basic_auth_pass}`);
  } else if (conn.oauth_access_token) {
    h['Authorization'] = `Bearer ${conn.oauth_access_token}`;
  }
  return h;
}

function wixHeaders(conn: CmsConnection): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': conn.oauth_access_token || conn.api_key || '',
    ...(conn.platform_site_id ? { 'wix-site-id': conn.platform_site_id } : {}),
  };
}

function webflowHeaders(conn: CmsConnection): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${conn.oauth_access_token || conn.api_key || ''}`,
    'accept-version': '2.0.0',
  };
}

function prestaHeaders(conn: CmsConnection): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Basic ' + btoa(`${conn.api_key || ''}:`),
    'Io-Format': 'JSON', 'Output-Format': 'JSON',
  };
}

// ── WordPress redirects (via Redirection plugin or Yoast) ──

async function wpRedirects(conn: CmsConnection, input: RedirectInput): Promise<RedirectResult> {
  const base = conn.site_url.replace(/\/$/, '');
  const headers = wpHeaders(conn);

  // Try WP Redirection plugin API first
  if (input.action === 'list') {
    const resp = await fetch(`${base}/wp-json/redirection/v1/redirect?per_page=100`, { headers, signal: AbortSignal.timeout(15000) });
    if (resp.ok) {
      const data = await resp.json();
      const items = (data.items || []).map((r: any) => ({ id: String(r.id), from: r.url, to: r.action_data?.url || r.match_url || '', type: r.action_code || 301 }));
      return { success: true, platform: 'wordpress', action: 'list', data: items };
    }
    // Fallback: try crawlers plugin endpoint
    const resp2 = await fetch(`${base}/wp-json/crawlers/v1/redirects`, { headers, signal: AbortSignal.timeout(15000) });
    if (resp2.ok) {
      const items = await resp2.json();
      return { success: true, platform: 'wordpress', action: 'list', data: Array.isArray(items) ? items : [] };
    }
    return { success: false, platform: 'wordpress', action: 'list', error: 'No redirect plugin detected (Redirection or Crawlers plugin required)' };
  }

  if (input.action === 'create') {
    // Try Redirection plugin
    const resp = await fetch(`${base}/wp-json/redirection/v1/redirect`, {
      method: 'POST', headers,
      body: JSON.stringify({ url: input.from, action_data: { url: input.to }, action_code: input.type || 301, action_type: 'url', group_id: 1, match_type: 'url' }),
      signal: AbortSignal.timeout(15000),
    });
    if (resp.ok) {
      const r = await resp.json();
      return { success: true, platform: 'wordpress', action: 'create', data: { id: String(r.id), from: r.url, to: r.action_data?.url || input.to!, type: input.type || 301 } };
    }
    // Fallback: crawlers plugin
    const resp2 = await fetch(`${base}/wp-json/crawlers/v1/redirects`, {
      method: 'POST', headers,
      body: JSON.stringify({ from: input.from, to: input.to, type: input.type || 301 }),
      signal: AbortSignal.timeout(15000),
    });
    if (resp2.ok) {
      const r = await resp2.json();
      return { success: true, platform: 'wordpress', action: 'create', data: r };
    }
    return { success: false, platform: 'wordpress', action: 'create', error: 'Failed to create redirect — Redirection plugin required' };
  }

  if (input.action === 'delete' && input.redirect_id) {
    const resp = await fetch(`${base}/wp-json/redirection/v1/redirect/${input.redirect_id}`, {
      method: 'DELETE', headers, signal: AbortSignal.timeout(15000),
    });
    return { success: resp.ok, platform: 'wordpress', action: 'delete', data: { deleted: resp.ok } };
  }

  return { success: false, platform: 'wordpress', action: input.action, error: 'Invalid action' };
}

// ── Shopify redirects (native API) ──

async function shopifyRedirects(conn: CmsConnection, input: RedirectInput): Promise<RedirectResult> {
  const base = conn.site_url.replace(/\/$/, '');
  const headers = shopifyHeaders(conn);

  if (input.action === 'list') {
    const resp = await fetch(`${base}/admin/api/2024-01/redirects.json?limit=250`, { headers, signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return { success: false, platform: 'shopify', action: 'list', error: `HTTP ${resp.status}` };
    const data = await resp.json();
    const items = (data.redirects || []).map((r: any) => ({ id: String(r.id), from: r.path, to: r.target, type: 301 }));
    return { success: true, platform: 'shopify', action: 'list', data: items };
  }

  if (input.action === 'create') {
    const resp = await fetch(`${base}/admin/api/2024-01/redirects.json`, {
      method: 'POST', headers,
      body: JSON.stringify({ redirect: { path: input.from, target: input.to } }),
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) { const err = await resp.text(); return { success: false, platform: 'shopify', action: 'create', error: err.substring(0, 200) }; }
    const r = (await resp.json()).redirect;
    return { success: true, platform: 'shopify', action: 'create', data: { id: String(r.id), from: r.path, to: r.target, type: 301 } };
  }

  if (input.action === 'delete' && input.redirect_id) {
    const resp = await fetch(`${base}/admin/api/2024-01/redirects/${input.redirect_id}.json`, { method: 'DELETE', headers, signal: AbortSignal.timeout(15000) });
    return { success: resp.ok, platform: 'shopify', action: 'delete', data: { deleted: resp.ok } };
  }

  return { success: false, platform: 'shopify', action: input.action, error: 'Invalid action' };
}

// ── Drupal redirects (redirect module, JSON:API) ──

async function drupalRedirects(conn: CmsConnection, input: RedirectInput): Promise<RedirectResult> {
  const base = conn.site_url.replace(/\/$/, '');
  const headers = drupalHeaders(conn);

  if (input.action === 'list') {
    const resp = await fetch(`${base}/jsonapi/redirect/redirect?page[limit]=100`, { headers, signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return { success: false, platform: 'drupal', action: 'list', error: `HTTP ${resp.status} — redirect module may not be installed` };
    const json = await resp.json();
    const items = (json.data || []).map((r: any) => ({
      id: r.id,
      from: r.attributes?.redirect_source?.path || '',
      to: r.attributes?.redirect_redirect?.uri?.replace('internal:', '') || '',
      type: r.attributes?.status_code || 301,
    }));
    return { success: true, platform: 'drupal', action: 'list', data: items };
  }

  if (input.action === 'create') {
    const resp = await fetch(`${base}/jsonapi/redirect/redirect`, {
      method: 'POST', headers,
      body: JSON.stringify({
        data: {
          type: 'redirect--redirect',
          attributes: {
            redirect_source: { path: input.from?.replace(/^\//, '') || '' },
            redirect_redirect: { uri: `internal:${input.to}` },
            status_code: input.type || 301,
          },
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) { const err = await resp.text(); return { success: false, platform: 'drupal', action: 'create', error: err.substring(0, 200) }; }
    const r = (await resp.json()).data;
    return { success: true, platform: 'drupal', action: 'create', data: { id: r.id, from: input.from!, to: input.to!, type: input.type || 301 } };
  }

  if (input.action === 'delete' && input.redirect_id) {
    const resp = await fetch(`${base}/jsonapi/redirect/redirect/${input.redirect_id}`, { method: 'DELETE', headers, signal: AbortSignal.timeout(15000) });
    return { success: resp.ok, platform: 'drupal', action: 'delete', data: { deleted: resp.ok } };
  }

  return { success: false, platform: 'drupal', action: input.action, error: 'Invalid action' };
}

// ── Wix redirects ──

async function wixRedirects(conn: CmsConnection, input: RedirectInput): Promise<RedirectResult> {
  const headers = wixHeaders(conn);

  if (input.action === 'list') {
    const resp = await fetch('https://www.wixapis.com/site-properties/v4/redirects', { headers, signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return { success: false, platform: 'wix', action: 'list', error: `HTTP ${resp.status}` };
    const data = await resp.json();
    const items = (data.redirects || []).map((r: any) => ({ id: r.id || r.oldUrl, from: r.oldUrl, to: r.newUrl, type: 301 }));
    return { success: true, platform: 'wix', action: 'list', data: items };
  }

  if (input.action === 'create') {
    const resp = await fetch('https://www.wixapis.com/site-properties/v4/redirects', {
      method: 'POST', headers,
      body: JSON.stringify({ redirect: { oldUrl: input.from, newUrl: input.to } }),
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) { const err = await resp.text(); return { success: false, platform: 'wix', action: 'create', error: err.substring(0, 200) }; }
    const r = (await resp.json()).redirect || {};
    return { success: true, platform: 'wix', action: 'create', data: { id: r.id || input.from!, from: input.from!, to: input.to!, type: 301 } };
  }

  if (input.action === 'delete' && input.redirect_id) {
    const resp = await fetch(`https://www.wixapis.com/site-properties/v4/redirects/${input.redirect_id}`, { method: 'DELETE', headers, signal: AbortSignal.timeout(15000) });
    return { success: resp.ok, platform: 'wix', action: 'delete', data: { deleted: resp.ok } };
  }

  return { success: false, platform: 'wix', action: input.action, error: 'Invalid action' };
}

// ── Webflow redirects (301 only, native) ──

async function webflowRedirects(conn: CmsConnection, input: RedirectInput): Promise<RedirectResult> {
  const headers = webflowHeaders(conn);
  const siteId = conn.platform_site_id;
  if (!siteId) return { success: false, platform: 'webflow', action: input.action, error: 'platform_site_id required' };

  if (input.action === 'list') {
    const resp = await fetch(`https://api.webflow.com/v2/sites/${siteId}/redirects`, { headers, signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return { success: false, platform: 'webflow', action: 'list', error: `HTTP ${resp.status}` };
    const data = await resp.json();
    const items = (data.redirects || []).map((r: any) => ({ id: r.id, from: r.sourcePath, to: r.targetPath, type: 301 }));
    return { success: true, platform: 'webflow', action: 'list', data: items };
  }

  if (input.action === 'create') {
    const resp = await fetch(`https://api.webflow.com/v2/sites/${siteId}/redirects`, {
      method: 'POST', headers,
      body: JSON.stringify({ sourcePath: input.from, targetPath: input.to }),
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) { const err = await resp.text(); return { success: false, platform: 'webflow', action: 'create', error: err.substring(0, 200) }; }
    const r = await resp.json();
    return { success: true, platform: 'webflow', action: 'create', data: { id: r.id, from: input.from!, to: input.to!, type: 301 } };
  }

  if (input.action === 'delete' && input.redirect_id) {
    const resp = await fetch(`https://api.webflow.com/v2/sites/${siteId}/redirects/${input.redirect_id}`, { method: 'DELETE', headers, signal: AbortSignal.timeout(15000) });
    return { success: resp.ok, platform: 'webflow', action: 'delete', data: { deleted: resp.ok } };
  }

  return { success: false, platform: 'webflow', action: input.action, error: 'Invalid action' };
}

// ── PrestaShop redirects (via .htaccess or URL rewrite — limited) ──

async function prestaRedirects(_conn: CmsConnection, input: RedirectInput): Promise<RedirectResult> {
  // PrestaShop has no native redirect API — must be done via .htaccess or module
  return {
    success: false, platform: 'prestashop', action: input.action,
    error: 'PrestaShop has no native redirect API. Use .htaccess or a redirect module. Brief: ' +
      (input.action === 'create' ? `Add to .htaccess: Redirect ${input.type || 301} ${input.from} ${input.to}` : 'Manual action required'),
  };
}

// ── Odoo redirects (website.rewrite) ──

async function odooRedirects(conn: CmsConnection, input: RedirectInput): Promise<RedirectResult> {
  const base = conn.site_url.replace(/\/$/, '');
  const db = conn.platform_site_id || 'db';
  const password = conn.api_key || '';

  const rpc = async (method: string, model: string, args: any[]) => {
    const resp = await fetch(`${base}/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: 1, params: { service: 'object', method: 'execute_kw', args: [db, 2, password, model, method, ...args] } }),
      signal: AbortSignal.timeout(15000),
    });
    return resp.ok ? (await resp.json()).result : null;
  };

  if (input.action === 'list') {
    const result = await rpc('search_read', 'website.rewrite', [[[]], { fields: ['id', 'url_from', 'url_to', 'redirect_type'], limit: 100 }]);
    if (!result) return { success: false, platform: 'odoo', action: 'list', error: 'JSON-RPC failed' };
    const items = result.map((r: any) => ({ id: String(r.id), from: r.url_from, to: r.url_to, type: r.redirect_type === '302' ? 302 : 301 }));
    return { success: true, platform: 'odoo', action: 'list', data: items };
  }

  if (input.action === 'create') {
    const result = await rpc('create', 'website.rewrite', [[{ url_from: input.from, url_to: input.to, redirect_type: String(input.type || 301) }]]);
    if (!result) return { success: false, platform: 'odoo', action: 'create', error: 'Create failed' };
    return { success: true, platform: 'odoo', action: 'create', data: { id: String(result), from: input.from!, to: input.to!, type: input.type || 301 } };
  }

  if (input.action === 'delete' && input.redirect_id) {
    const result = await rpc('unlink', 'website.rewrite', [[[Number(input.redirect_id)]]]);
    return { success: !!result, platform: 'odoo', action: 'delete', data: { deleted: !!result } };
  }

  return { success: false, platform: 'odoo', action: input.action, error: 'Invalid action' };
}

// ── Router ──

async function handleRedirect(conn: CmsConnection, input: RedirectInput): Promise<RedirectResult> {
  switch (conn.platform) {
    case 'wordpress': return wpRedirects(conn, input);
    case 'shopify': return shopifyRedirects(conn, input);
    case 'drupal': return drupalRedirects(conn, input);
    case 'wix': return wixRedirects(conn, input);
    case 'webflow': return webflowRedirects(conn, input);
    case 'prestashop': return prestaRedirects(conn, input);
    case 'odoo': return odooRedirects(conn, input);
    default:
      return { success: false, platform: conn.platform, action: input.action, error: `Unsupported platform: ${conn.platform}` };
  }
}

// ── Main ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const userClient = getUserClient(authHeader);
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body: RedirectInput = await req.json();
    if (!body.tracked_site_id || !body.action) {
      return new Response(JSON.stringify({ error: 'Missing tracked_site_id or action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (body.action === 'create' && (!body.from || !body.to)) {
      return new Response(JSON.stringify({ error: 'Missing from or to for create action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const serviceClient = getServiceClient();
    const { data: conn, error: connError } = await serviceClient
      .from('cms_connections')
      .select('*')
      .eq('tracked_site_id', body.tracked_site_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (connError || !conn) {
      return new Response(JSON.stringify({
        success: false, platform: 'none', action: body.action,
        error: 'No active CMS connection. Manual redirect required.',
        brief: body.action === 'create' ? `Add redirect ${body.type || 301}: ${body.from} → ${body.to}` : null,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[cms-push-redirect] ${body.action} on ${conn.platform}`);
    const result = await handleRedirect(conn as CmsConnection, body);

    // Log
    try {
      await serviceClient.from('analytics_events').insert({
        user_id: user.id,
        event_type: 'cms:redirect',
        event_data: { platform: conn.platform, action: body.action, from: body.from, to: body.to, type: body.type, success: result.success },
      });
    } catch (_) { /* non-blocking */ }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[cms-push-redirect] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
