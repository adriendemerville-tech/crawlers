import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getAuthenticatedUser } from '../_shared/auth.ts'
import { assertSafeUrl } from '../_shared/ssrf.ts'

/**
 * Edge Function: prestashop-connector
 * 
 * Connects to PrestaShop Webservice API (XML/JSON).
 * PrestaShop uses API Key auth (key as HTTP Basic user, no password).
 * 
 * Actions:
 * - test_connection: Verify API key + list available resources
 * - save_connection: Persist CMS connection
 * - list_pages: List CMS pages
 * - list_blog_posts: List blog posts (if blog module installed)
 * - list_products: List products (summary)
 * - create_draft: Create a CMS page as draft (active=0)
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const auth = await getAuthenticatedUser(req)
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { action } = body

    switch (action) {
      case 'test_connection':
        return await testConnection(body)
      case 'save_connection':
        return await saveConnection(body, auth)
      case 'list_pages':
        return await listPages(body, auth)
      case 'list_blog_posts':
        return await listBlogPosts(body, auth)
      case 'list_products':
        return await listProducts(body, auth)
      case 'create_draft':
        return await createDraft(body, auth)
      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400)
    }
  } catch (err: any) {
    console.error('[prestashop-connector] Error:', err)
    return jsonResponse({ success: false, error: err.message }, 500)
  }
})

// ─── Helpers ────────────────────────────────────────────────────────────────

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * PrestaShop Webservice uses Basic Auth with API key as username.
 * Output format: JSON via &output_format=JSON
 */
async function psApiFetch(
  siteUrl: string,
  apiKey: string,
  resource: string,
  options: { method?: string; body?: string; params?: Record<string, string> } = {},
) {
  const baseUrl = siteUrl.replace(/\/$/, '')
  assertSafeUrl(baseUrl)

  const url = new URL(`${baseUrl}/api/${resource}`)
  url.searchParams.set('output_format', 'JSON')
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }

  const authHeader = 'Basic ' + btoa(`${apiKey}:`)

  const resp = await fetch(url.toString(), {
    method: options.method || 'GET',
    headers: {
      'Authorization': authHeader,
      ...(options.body ? { 'Content-Type': 'application/xml' } : {}),
    },
    ...(options.body ? { body: options.body } : {}),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    throw new Error(`PrestaShop API [${resp.status}]: ${errText.substring(0, 500)}`)
  }

  const contentType = resp.headers.get('content-type') || ''
  if (contentType.includes('json')) {
    return await resp.json()
  }
  return await resp.text()
}

// ─── Actions ────────────────────────────────────────────────────────────────

async function testConnection(body: any) {
  const { site_url, api_key } = body
  if (!site_url || !api_key) {
    return jsonResponse({ error: 'site_url and api_key required' }, 400)
  }

  try {
    // Fetch the root /api/ to list available resources
    const data = await psApiFetch(site_url, api_key, '')

    // PrestaShop returns { api: { resources: { ... } } } or similar
    const resources = data?.api ? Object.keys(data.api) : []
    const hasProducts = resources.includes('products')
    const hasCmsPages = resources.includes('content_management_system')
    const hasOrders = resources.includes('orders')

    return jsonResponse({
      success: true,
      shop_name: data?.api?.shop_name || null,
      ps_version: data?.api?.ps_version || null,
      resources,
      capabilities: {
        products: hasProducts,
        cms_pages: hasCmsPages,
        orders: hasOrders,
      },
    })
  } catch (err: any) {
    return jsonResponse({ success: false, error: err.message }, 200)
  }
}

async function saveConnection(body: any, auth: any) {
  const { site_url, api_key, tracked_site_id, capabilities } = body
  if (!site_url || !api_key || !tracked_site_id) {
    return jsonResponse({ error: 'site_url, api_key and tracked_site_id required' }, 400)
  }

  const supabase = getServiceClient()
  const cleanUrl = site_url.replace(/\/$/, '')

  // Upsert connection
  const { data, error } = await supabase
    .from('cms_connections')
    .upsert({
      user_id: auth.userId,
      tracked_site_id,
      platform: 'prestashop',
      site_url: cleanUrl,
      auth_method: 'api_key',
      api_key,
      capabilities: capabilities || null,
      status: 'active',
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'tracked_site_id,user_id,platform',
      ignoreDuplicates: false,
    })
    .select()
    .single()

  if (error) {
    // If unique constraint fails, try update instead
    const { data: existing } = await supabase
      .from('cms_connections')
      .select('id')
      .eq('tracked_site_id', tracked_site_id)
      .eq('user_id', auth.userId)
      .eq('platform', 'prestashop')
      .maybeSingle()

    if (existing) {
      const { data: updated, error: updateErr } = await supabase
        .from('cms_connections')
        .update({
          site_url: cleanUrl,
          api_key,
          auth_method: 'api_key',
          capabilities: capabilities || null,
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (updateErr) throw updateErr
      return jsonResponse({ success: true, connection_id: updated.id })
    }

    throw error
  }

  return jsonResponse({ success: true, connection_id: data.id })
}

async function listPages(body: any, auth: any) {
  const conn = await getConnection(body.tracked_site_id, auth.userId)
  if (!conn) return jsonResponse({ error: 'No active PrestaShop connection' }, 404)

  const data = await psApiFetch(conn.site_url, conn.api_key!, 'content_management_system', {
    params: { 'display': '[id,meta_title,meta_description,active,link_rewrite]' },
  })

  const pages = data?.content_management_system || data?.cms || []
  return jsonResponse({ success: true, pages })
}

async function listBlogPosts(body: any, auth: any) {
  const conn = await getConnection(body.tracked_site_id, auth.userId)
  if (!conn) return jsonResponse({ error: 'No active PrestaShop connection' }, 404)

  // Blog posts depend on the Smart Blog or Presto Blog module
  // Try smartblog first, then fallback
  try {
    const data = await psApiFetch(conn.site_url, conn.api_key!, 'smartblog_posts', {
      params: { 'display': '[id,meta_title,short_description,active,created]' },
    })
    return jsonResponse({ success: true, posts: data?.smartblog_posts || [] })
  } catch {
    return jsonResponse({
      success: true,
      posts: [],
      note: 'No blog module detected (smartblog). PrestaShop requires a blog module for blog posts.',
    })
  }
}

async function listProducts(body: any, auth: any) {
  const conn = await getConnection(body.tracked_site_id, auth.userId)
  if (!conn) return jsonResponse({ error: 'No active PrestaShop connection' }, 404)

  const data = await psApiFetch(conn.site_url, conn.api_key!, 'products', {
    params: {
      'display': '[id,name,active,price,reference,meta_title,meta_description,link_rewrite]',
      'limit': '50',
    },
  })

  const products = data?.products || []
  return jsonResponse({ success: true, products })
}

async function createDraft(body: any, auth: any) {
  const { tracked_site_id, title, content, subtitle } = body
  if (!tracked_site_id || !title) {
    return jsonResponse({ error: 'tracked_site_id and title required' }, 400)
  }

  const conn = await getConnection(tracked_site_id, auth.userId)
  if (!conn) return jsonResponse({ error: 'No active PrestaShop connection' }, 404)

  // PrestaShop CMS pages use XML format for creation
  const linkRewrite = title
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <content>
    <id_cms_category>1</id_cms_category>
    <active>0</active>
    <meta_title><language id="1"><![CDATA[${escapeXml(title)}]]></language></meta_title>
    <meta_description><language id="1"><![CDATA[${escapeXml(subtitle || '')}]]></language></meta_description>
    <content><language id="1"><![CDATA[${content || ''}]]></language></content>
    <link_rewrite><language id="1"><![CDATA[${linkRewrite}]]></language></link_rewrite>
  </content>
</prestashop>`

  const result = await psApiFetch(conn.site_url, conn.api_key!, 'content_management_system', {
    method: 'POST',
    body: xml,
  })

  return jsonResponse({ success: true, data: result })
}

// ─── Shared ─────────────────────────────────────────────────────────────────

async function getConnection(trackedSiteId: string, userId: string) {
  if (!trackedSiteId) return null

  const supabase = getServiceClient()
  const { data } = await supabase
    .from('cms_connections')
    .select('*')
    .eq('tracked_site_id', trackedSiteId)
    .eq('user_id', userId)
    .eq('platform', 'prestashop')
    .eq('status', 'active')
    .maybeSingle()

  return data
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
