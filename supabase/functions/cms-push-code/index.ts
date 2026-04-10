import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { verifyInjectionOwnership } from '../_shared/ownershipCheck.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * cms-push-code
 * 
 * Pushes corrective JavaScript code to connected CMS platforms via their native APIs.
 * Fallback: stores in site_script_rules for widget.js injection.
 * 
 * Supports: WordPress, Shopify, Drupal, Wix, Webflow, PrestaShop, Odoo, GTM
 * 
 * Input: {
 *   tracked_site_id: string,
 *   code: string,                    // The JS code to inject
 *   code_minified?: string,          // Minified version (preferred for deployment)
 *   label?: string,                  // Human-readable label
 *   placement?: 'header' | 'footer', // Where to inject (default: footer)
 *   mode?: 'deploy' | 'preview',
 *   fixes_summary?: Array<{ id: string, label: string, category: string }>,
 * }
 */

interface PushCodeInput {
  tracked_site_id: string;
  code: string;
  code_minified?: string;
  label?: string;
  placement?: 'header' | 'footer';
  mode?: 'deploy' | 'preview';
  fixes_summary?: Array<{ id: string; label: string; category: string }>;
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
  capabilities: Record<string, unknown> | null;
}

interface PushResult {
  success: boolean;
  platform: string;
  method: string; // 'api_native' | 'script_injection' | 'gtm' | 'widget_fallback'
  cms_id?: string | number;
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

function webflowHeaders(conn: CmsConnection): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${conn.oauth_access_token || conn.api_key || ''}`,
    'accept-version': '2.0.0',
  };
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

// ── WordPress: inject script via custom option or head/footer snippet ──
async function pushToWordPress(conn: CmsConnection, input: PushCodeInput): Promise<PushResult> {
  const baseUrl = conn.site_url.replace(/\/$/, '');
  const headers = wpAuthHeaders(conn);
  const scriptCode = input.code_minified || input.code;
  const placement = input.placement || 'footer';

  // Strategy 1: Try wp_options (common approach for script injection plugins)
  const optionKey = `crawlers_seo_script_${placement}`;
  const scriptTag = `<!-- Crawlers SEO Fix --><script data-crawlers="corrective">${scriptCode}</script>`;

  // Try updating via WP REST API settings endpoint (requires custom endpoint or option API)
  // Most WP sites expose /wp-json/wp/v2/settings for whitelisted options
  // Fallback: create a hidden draft page that acts as a script container
  
  // Strategy: Create/update a reusable "crawlers-seo-scripts" page as script storage
  // Then the WP plugin reads from this page to inject scripts
  const searchResp = await fetch(`${baseUrl}/wp-json/wp/v2/pages?slug=crawlers-seo-scripts&status=draft,publish,private`, {
    headers,
    signal: AbortSignal.timeout(15000),
  });

  if (searchResp.ok) {
    const pages = await searchResp.json();
    
    const scriptPayload = {
      title: 'Crawlers SEO Scripts (auto-managed)',
      content: `<!-- CRAWLERS_SCRIPT_${placement.toUpperCase()} -->\n${scriptTag}\n<!-- /CRAWLERS_SCRIPT -->`,
      status: 'private', // Private = not publicly visible but accessible via API
      slug: 'crawlers-seo-scripts',
    };

    let resp: Response;
    if (pages.length > 0) {
      // Update existing
      resp = await fetch(`${baseUrl}/wp-json/wp/v2/pages/${pages[0].id}`, {
        method: 'PUT', headers, body: JSON.stringify(scriptPayload),
        signal: AbortSignal.timeout(15000),
      });
    } else {
      // Create new
      resp = await fetch(`${baseUrl}/wp-json/wp/v2/pages`, {
        method: 'POST', headers, body: JSON.stringify(scriptPayload),
        signal: AbortSignal.timeout(15000),
      });
    }

    if (resp.ok) {
      const data = await resp.json();
      return { success: true, platform: 'wordpress', method: 'api_native', cms_id: data.id, detail: `Script stored in private page #${data.id} (${placement})` };
    }
    const err = await resp.text();
    return { success: false, platform: 'wordpress', method: 'api_native', detail: `WP API error ${resp.status}: ${err.substring(0, 200)}` };
  }

  return { success: false, platform: 'wordpress', method: 'api_native', detail: 'Cannot reach WP REST API' };
}

// ── Shopify: ScriptTag API ──
async function pushToShopify(conn: CmsConnection, input: PushCodeInput): Promise<PushResult> {
  const baseUrl = conn.site_url.replace(/\/$/, '');
  const headers = shopifyHeaders(conn);
  const scriptCode = input.code_minified || input.code;

  // Shopify doesn't allow inline scripts via ScriptTag API — only external URLs
  // Alternative: use Theme Asset API to upload a JS file
  // PUT /admin/api/2024-01/themes/{theme_id}/assets.json

  // Step 1: Get active theme
  const themesResp = await fetch(`${baseUrl}/admin/api/2024-01/themes.json`, {
    headers, signal: AbortSignal.timeout(15000),
  });

  if (!themesResp.ok) {
    return { success: false, platform: 'shopify', method: 'api_native', detail: `Cannot list themes: HTTP ${themesResp.status}` };
  }

  const themesData = await themesResp.json();
  const activeTheme = themesData.themes?.find((t: any) => t.role === 'main');
  if (!activeTheme) {
    return { success: false, platform: 'shopify', method: 'api_native', detail: 'No active theme found' };
  }

  // Step 2: Upload JS asset
  const assetResp = await fetch(`${baseUrl}/admin/api/2024-01/themes/${activeTheme.id}/assets.json`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      asset: {
        key: 'assets/crawlers-seo-fix.js',
        value: scriptCode,
      },
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!assetResp.ok) {
    const err = await assetResp.text();
    return { success: false, platform: 'shopify', method: 'api_native', detail: `Asset upload failed: HTTP ${assetResp.status}: ${err.substring(0, 200)}` };
  }

  // Step 3: Inject script tag reference in theme.liquid (via ScriptTag API as fallback)
  try {
    await fetch(`${baseUrl}/admin/api/2024-01/script_tags.json`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        script_tag: {
          event: 'onload',
          src: `${baseUrl}/assets/crawlers-seo-fix.js`,
          display_scope: 'all',
        },
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch { /* ScriptTag is optional, asset is primary */ }

  return { success: true, platform: 'shopify', method: 'api_native', detail: `JS asset uploaded to theme ${activeTheme.name}` };
}

// ── Drupal: Custom Block or Asset injection ──
async function pushToDrupal(conn: CmsConnection, input: PushCodeInput): Promise<PushResult> {
  const baseUrl = conn.site_url.replace(/\/$/, '');
  const headers = drupalHeaders(conn);
  const scriptCode = input.code_minified || input.code;
  const scriptHtml = `<script data-crawlers="corrective">${scriptCode}</script>`;

  // Create a custom_block_content with the script (requires block_content module)
  const payload = {
    data: {
      type: 'block_content--basic',
      attributes: {
        info: 'Crawlers SEO Script (auto-managed)',
        body: { value: scriptHtml, format: 'full_html' },
        status: true,
      },
    },
  };

  // Try to find existing block
  const searchResp = await fetch(`${baseUrl}/jsonapi/block_content/basic?filter[info]=Crawlers SEO Script (auto-managed)`, {
    headers: { ...headers, 'Content-Type': 'application/vnd.api+json' },
    signal: AbortSignal.timeout(15000),
  });

  if (searchResp.ok) {
    const searchData = await searchResp.json();
    const existing = searchData.data?.[0];

    let resp: Response;
    if (existing) {
      payload.data = { ...payload.data, type: 'block_content--basic' } as any;
      resp = await fetch(`${baseUrl}/jsonapi/block_content/basic/${existing.id}`, {
        method: 'PATCH', headers, body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
    } else {
      resp = await fetch(`${baseUrl}/jsonapi/block_content/basic`, {
        method: 'POST', headers, body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
    }

    if (resp.ok) {
      const data = await resp.json();
      return { success: true, platform: 'drupal', method: 'api_native', cms_id: data.data?.id, detail: 'Script block created/updated' };
    }
    const err = await resp.text();
    return { success: false, platform: 'drupal', method: 'api_native', detail: `Drupal API error: ${err.substring(0, 200)}` };
  }

  return { success: false, platform: 'drupal', method: 'api_native', detail: 'Cannot reach Drupal JSON:API' };
}

// ── Webflow: Custom Code API ──
async function pushToWebflow(conn: CmsConnection, input: PushCodeInput): Promise<PushResult> {
  const headers = webflowHeaders(conn);
  const scriptCode = input.code_minified || input.code;
  const placement = input.placement || 'footer';
  const siteId = conn.platform_site_id;

  if (!siteId) {
    return { success: false, platform: 'webflow', method: 'api_native', detail: 'No Webflow site ID configured' };
  }

  // Webflow Custom Code API: PUT /v2/sites/{site_id}/custom_code
  const codePayload = {
    scripts: [{
      id: 'crawlers-seo-fix',
      location: placement === 'header' ? 'header' : 'footer',
      attributes: { 'data-crawlers': 'corrective' },
      type: 'inline',
      value: scriptCode,
    }],
  };

  const resp = await fetch(`https://api.webflow.com/v2/sites/${siteId}/custom_code`, {
    method: 'PUT', headers,
    body: JSON.stringify(codePayload),
    signal: AbortSignal.timeout(15000),
  });

  if (resp.ok) {
    return { success: true, platform: 'webflow', method: 'api_native', detail: `Inline script injected in ${placement}` };
  }

  // Fallback: try registered scripts endpoint
  const regPayload = {
    hostedLocation: 'footer',
    integrityHash: '',
    canCopy: false,
    sourceCode: scriptCode,
    version: '1.0.0',
    displayName: 'Crawlers SEO Fix',
  };

  const regResp = await fetch(`https://api.webflow.com/v2/sites/${siteId}/registered_scripts/inline`, {
    method: 'POST', headers,
    body: JSON.stringify(regPayload),
    signal: AbortSignal.timeout(15000),
  });

  if (regResp.ok) {
    const data = await regResp.json();
    return { success: true, platform: 'webflow', method: 'api_native', cms_id: data.id, detail: 'Registered inline script' };
  }

  const err = await regResp.text();
  return { success: false, platform: 'webflow', method: 'api_native', detail: `Webflow API error: ${err.substring(0, 200)}` };
}

// ── Wix: Velo Custom Element (limited) ──
async function pushToWix(conn: CmsConnection, input: PushCodeInput): Promise<PushResult> {
  // Wix doesn't offer a public API for script injection
  // The best approach is via Wix Headless / Velo which requires Editor access
  // Fallback to site_script_rules (widget.js)
  return {
    success: false,
    platform: 'wix',
    method: 'api_native',
    detail: 'Wix ne supporte pas l\'injection de scripts via API. Fallback vers widget.js.',
  };
}

// ── PrestaShop: CMS page with script or module hook ──
async function pushToPrestaShop(conn: CmsConnection, input: PushCodeInput): Promise<PushResult> {
  const baseUrl = conn.site_url.replace(/\/$/, '');
  const headers = prestaHeaders(conn);
  const scriptCode = input.code_minified || input.code;
  const scriptHtml = `<script data-crawlers="corrective">${scriptCode}</script>`;

  // PrestaShop: use a hidden CMS page to store the script
  // Then the PrestaShop module hooks into displayHeader/displayFooter to read it
  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <content_management_system>
    <id_cms_category>1</id_cms_category>
    <active>0</active>
    <meta_title><language id="1">Crawlers SEO Scripts</language></meta_title>
    <meta_description><language id="1">Auto-managed SEO scripts</language></meta_description>
    <content><language id="1"><![CDATA[${scriptHtml}]]></language></content>
    <link_rewrite><language id="1">crawlers-seo-scripts</language></link_rewrite>
  </content_management_system>
</prestashop>`;

  // Search for existing
  const searchResp = await fetch(`${baseUrl}/api/content_management_system?filter[link_rewrite]=crawlers-seo-scripts&output_format=JSON`, {
    headers: { ...headers, 'Content-Type': 'text/xml' },
    signal: AbortSignal.timeout(15000),
  });

  if (searchResp.ok) {
    const searchData = await searchResp.json();
    const existingId = searchData?.content_management_system?.[0]?.id;

    const method = existingId ? 'PUT' : 'POST';
    const url = existingId
      ? `${baseUrl}/api/content_management_system/${existingId}`
      : `${baseUrl}/api/content_management_system`;

    const resp = await fetch(url, {
      method,
      headers: { ...headers, 'Content-Type': 'text/xml' },
      body: xmlPayload,
      signal: AbortSignal.timeout(15000),
    });

    if (resp.ok) {
      return { success: true, platform: 'prestashop', method: 'api_native', detail: `Script CMS page ${existingId ? 'updated' : 'created'}` };
    }
    const err = await resp.text();
    return { success: false, platform: 'prestashop', method: 'api_native', detail: `PrestaShop API error: ${err.substring(0, 200)}` };
  }

  return { success: false, platform: 'prestashop', method: 'api_native', detail: 'Cannot reach PrestaShop API' };
}

// ── Odoo: ir.asset or website.page with script ──
async function pushToOdoo(conn: CmsConnection, input: PushCodeInput): Promise<PushResult> {
  const baseUrl = conn.site_url.replace(/\/$/, '');
  const scriptCode = input.code_minified || input.code;

  // Authenticate via JSON-RPC
  const db = (conn.capabilities as any)?.db || '';
  const uid = (conn.capabilities as any)?.uid;
  
  if (!uid || !db) {
    return { success: false, platform: 'odoo', method: 'api_native', detail: 'Odoo connection missing uid/db' };
  }

  const password = conn.basic_auth_pass || conn.api_key || '';

  // Create/update a website.page with the script as HTML content
  const rpcPayload = {
    jsonrpc: '2.0',
    method: 'call',
    params: {
      service: 'object',
      method: 'execute_kw',
      args: [
        db, uid, password,
        'website.page', 'search_read',
        [[['name', '=', 'Crawlers SEO Scripts']]],
        { fields: ['id'], limit: 1 },
      ],
    },
  };

  try {
    const searchResp = await fetch(`${baseUrl}/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rpcPayload),
      signal: AbortSignal.timeout(15000),
    });

    if (!searchResp.ok) {
      return { success: false, platform: 'odoo', method: 'api_native', detail: `Odoo RPC error: HTTP ${searchResp.status}` };
    }

    const searchData = await searchResp.json();
    const existingPages = searchData.result || [];
    const scriptHtml = `<div style="display:none" data-crawlers="script-container"><script data-crawlers="corrective">${scriptCode}</script></div>`;

    if (existingPages.length > 0) {
      // Update existing
      const updatePayload = {
        jsonrpc: '2.0', method: 'call',
        params: {
          service: 'object', method: 'execute_kw',
          args: [db, uid, password, 'website.page', 'write', [[existingPages[0].id], { arch: scriptHtml }]],
        },
      };
      await fetch(`${baseUrl}/jsonrpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
        signal: AbortSignal.timeout(15000),
      });
      return { success: true, platform: 'odoo', method: 'api_native', cms_id: existingPages[0].id, detail: 'Script page updated' };
    } else {
      // Create new
      const createPayload = {
        jsonrpc: '2.0', method: 'call',
        params: {
          service: 'object', method: 'execute_kw',
          args: [db, uid, password, 'website.page', 'create', [{
            name: 'Crawlers SEO Scripts',
            url: '/crawlers-seo-scripts',
            is_published: false,
            arch: scriptHtml,
          }]],
        },
      };
      const createResp = await fetch(`${baseUrl}/jsonrpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createPayload),
        signal: AbortSignal.timeout(15000),
      });
      const createData = await createResp.json();
      return { success: true, platform: 'odoo', method: 'api_native', cms_id: createData.result, detail: 'Script page created (unpublished)' };
    }
  } catch (e) {
    return { success: false, platform: 'odoo', method: 'api_native', detail: e instanceof Error ? e.message : 'Odoo RPC error' };
  }
}

// ── Fallback: site_script_rules (widget.js injection) ──
async function fallbackToWidgetRules(
  supabase: ReturnType<typeof getServiceClient>,
  siteId: string,
  userId: string,
  code: string,
  label: string,
): Promise<PushResult> {
  const { data: existingRule } = await supabase
    .from('site_script_rules')
    .select('id')
    .eq('domain_id', siteId)
    .eq('user_id', userId)
    .eq('payload_type', 'CORRECTIVE_CODE')
    .maybeSingle();

  const payloadData = { script: code, label, deployed_at: new Date().toISOString() };

  if (existingRule) {
    await supabase
      .from('site_script_rules')
      .update({ payload_data: payloadData, is_active: true } as any)
      .eq('id', existingRule.id);
  } else {
    await supabase
      .from('site_script_rules')
      .insert({
        domain_id: siteId,
        user_id: userId,
        url_pattern: '*',
        payload_type: 'CORRECTIVE_CODE',
        payload_data: payloadData,
        is_active: true,
        source: 'code_architect',
      } as any);
  }

  return { success: true, platform: 'widget', method: 'widget_fallback', detail: 'Code stored in site_script_rules for widget.js injection' };
}

// ── Main Handler ──
Deno.serve(handleRequest(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth — supports service role bypass for Parmenion system calls
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const isServiceCall = auth.userId === 'service-role';
    const user = { id: auth.userId };

    const input: PushCodeInput = await req.json();
    const { tracked_site_id, code, mode = 'deploy' } = input;

    if (!tracked_site_id || !code) {
      return new Response(JSON.stringify({ error: 'tracked_site_id and code are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getServiceClient();

    // Fetch site
    const { data: site, error: siteError } = await supabase
      .from('tracked_sites')
      .select('id, domain, user_id')
      .eq('id', tracked_site_id)
      .single();

    if (siteError || !site) {
      return new Response(JSON.stringify({ error: 'Site not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Security: verify ownership (skip for service role — Parmenion acts on behalf of site owner)
    if (!isServiceCall) {
      const ownershipCheck = await verifyInjectionOwnership(supabase, user.id, tracked_site_id, {
        scriptType: 'corrective_code',
        payloadPreview: (input.code_minified || input.code).substring(0, 200),
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || undefined,
      });

      if (!ownershipCheck.allowed) {
        return new Response(JSON.stringify({ error: ownershipCheck.reason || 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (mode === 'preview') {
      return new Response(JSON.stringify({
        success: true, mode: 'preview',
        code_size: code.length,
        code_minified_size: input.code_minified?.length || null,
        fixes_count: input.fixes_summary?.length || 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Find CMS connection
    const { data: cmsConn } = await supabase
      .from('cms_connections')
      .select('id, platform, site_url, auth_method, api_key, basic_auth_user, basic_auth_pass, oauth_access_token, oauth_refresh_token, platform_site_id, capabilities')
      .eq('tracked_site_id', tracked_site_id)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let result: PushResult;
    const label = input.label || `Crawlers SEO Fix (${input.fixes_summary?.length || 0} corrections)`;

    // For service role calls, use the site owner's user_id for rule ownership
    const effectiveUserId = isServiceCall ? site.user_id : user.id;

    if (!cmsConn) {
      // No CMS → widget.js fallback
      console.log(`[cms-push-code] No CMS connection for site ${tracked_site_id}, using widget fallback`);
      result = await fallbackToWidgetRules(supabase, site.id, effectiveUserId, input.code_minified || code, label);
    } else {
      console.log(`[cms-push-code] Pushing code to ${cmsConn.platform} for ${site.domain}`);
      
      try {
        switch (cmsConn.platform) {
          case 'wordpress':
            result = await pushToWordPress(cmsConn as CmsConnection, input);
            break;
          case 'shopify':
            result = await pushToShopify(cmsConn as CmsConnection, input);
            break;
          case 'drupal':
            result = await pushToDrupal(cmsConn as CmsConnection, input);
            break;
          case 'webflow':
            result = await pushToWebflow(cmsConn as CmsConnection, input);
            break;
          case 'wix':
            result = await pushToWix(cmsConn as CmsConnection, input);
            break;
          case 'prestashop':
            result = await pushToPrestaShop(cmsConn as CmsConnection, input);
            break;
          case 'odoo':
            result = await pushToOdoo(cmsConn as CmsConnection, input);
            break;
          default:
            result = { success: false, platform: cmsConn.platform, method: 'api_native', detail: `Platform ${cmsConn.platform} not supported for code push` };
        }
      } catch (e) {
        console.error(`[cms-push-code] Error pushing to ${cmsConn.platform}:`, e);
        result = { success: false, platform: cmsConn.platform, method: 'api_native', detail: e instanceof Error ? e.message : 'Unknown error' };
      }

      // If native push failed, fallback to widget.js
      if (!result.success) {
        console.log(`[cms-push-code] Native push to ${cmsConn.platform} failed, falling back to widget.js`);
        const fallbackResult = await fallbackToWidgetRules(supabase, site.id, effectiveUserId, input.code_minified || code, label);
        result = {
          ...fallbackResult,
          detail: `${cmsConn.platform} native push failed (${result.detail}). ${fallbackResult.detail}`,
        };
      }
    }

    // Log event
    await supabase.from('analytics_events').insert({
      user_id: user.id,
      event_type: 'cms:push_code',
      event_data: {
        tracked_site_id,
        domain: site.domain,
        platform: result.platform,
        method: result.method,
        success: result.success,
        code_size: (input.code_minified || code).length,
        fixes_count: input.fixes_summary?.length || 0,
      },
    });

    return new Response(JSON.stringify({ success: result.success, ...result }), {
      status: result.success ? 200 : 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[cms-push-code] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
}, 'cms-push-code'))
