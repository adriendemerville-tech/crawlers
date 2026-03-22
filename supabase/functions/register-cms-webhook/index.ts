import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * Edge Function: register-cms-webhook
 * 
 * Auto-registers order webhooks on WooCommerce or Shopify after CMS connection.
 * Called from CmsConnectionDialog after successful save.
 * 
 * Actions:
 * - register_woo: Register WooCommerce order.created webhook
 * - register_shopify: Register Shopify orders/create webhook
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = getServiceClient()

    const { action, connection_id, user_id } = await req.json()

    if (!connection_id || !user_id) {
      return new Response(JSON.stringify({ error: 'connection_id and user_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch CMS connection details
    const { data: conn, error: connErr } = await supabase
      .from('cms_connections')
      .select('*')
      .eq('id', connection_id)
      .eq('user_id', user_id)
      .single()

    if (connErr || !conn) {
      return new Response(JSON.stringify({ error: 'Connection not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const siteUrl = conn.site_url.replace(/\/$/, '')

    if (action === 'register_woo') {
      return await registerWooWebhook(siteUrl, conn)
    }

    if (action === 'register_shopify') {
      return await registerShopifyWebhook(siteUrl, conn)
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('[register-cms-webhook] Error:', err)
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

/**
 * Register WooCommerce webhook via REST API.
 * Requires: basic_auth credentials with manage_woocommerce capability.
 */
async function registerWooWebhook(siteUrl: string, conn: any): Promise<Response> {
  const webhookUrl = `${SUPABASE_URL}/functions/v1/webhook-woo-orders`

  const authHeader = 'Basic ' + btoa(`${conn.basic_auth_user}:${conn.basic_auth_pass}`)

  // Check if webhook already exists
  const listResp = await fetch(`${siteUrl}/wp-json/wc/v3/webhooks`, {
    headers: { Authorization: authHeader },
  })

  if (listResp.ok) {
    const existing = await listResp.json()
    const already = existing.find((w: any) =>
      w.delivery_url === webhookUrl && w.topic === 'order.created'
    )
    if (already) {
      return new Response(JSON.stringify({
        success: true,
        already_registered: true,
        webhook_id: already.id,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
  }

  // Create the webhook
  const createResp = await fetch(`${siteUrl}/wp-json/wc/v3/webhooks`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Crawlers.fr — Revenue Tracking',
      topic: 'order.created',
      delivery_url: webhookUrl,
      status: 'active',
    }),
  })

  if (!createResp.ok) {
    const err = await createResp.text()
    console.error('[register-cms-webhook] WooCommerce error:', err)
    return new Response(JSON.stringify({
      success: false,
      error: 'woo_api_failed',
      details: err,
      fallback_url: webhookUrl,
    }), {
      status: 200, // Return 200 so client can show fallback
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const created = await createResp.json()
  return new Response(JSON.stringify({
    success: true,
    webhook_id: created.id,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

/**
 * Register Shopify webhook via Admin API.
 * Requires: api_key with write_orders scope or a custom app token.
 */
async function registerShopifyWebhook(siteUrl: string, conn: any): Promise<Response> {
  const webhookUrl = `${SUPABASE_URL}/functions/v1/webhook-shopify-orders`

  // Shopify Admin API uses the API key as access token
  const accessToken = conn.api_key || conn.oauth_access_token
  if (!accessToken) {
    return new Response(JSON.stringify({
      success: false,
      error: 'no_shopify_token',
      fallback_url: webhookUrl,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Normalize Shopify admin URL
  const shopDomain = siteUrl
    .replace(/^https?:\/\//, '')
    .replace(/\/admin.*$/, '')
    .replace(/\/$/, '')

  const adminApi = `https://${shopDomain}/admin/api/2024-01`

  // Check existing webhooks
  const listResp = await fetch(`${adminApi}/webhooks.json?topic=orders/create`, {
    headers: { 'X-Shopify-Access-Token': accessToken },
  })

  if (listResp.ok) {
    const { webhooks = [] } = await listResp.json()
    const already = webhooks.find((w: any) => w.address === webhookUrl)
    if (already) {
      return new Response(JSON.stringify({
        success: true,
        already_registered: true,
        webhook_id: already.id,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
  }

  // Create webhook
  const createResp = await fetch(`${adminApi}/webhooks.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      webhook: {
        topic: 'orders/create',
        address: webhookUrl,
        format: 'json',
      },
    }),
  })

  if (!createResp.ok) {
    const err = await createResp.text()
    console.error('[register-cms-webhook] Shopify error:', err)
    return new Response(JSON.stringify({
      success: false,
      error: 'shopify_api_failed',
      details: err,
      fallback_url: webhookUrl,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { webhook } = await createResp.json()
  return new Response(JSON.stringify({
    success: true,
    webhook_id: webhook?.id,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
