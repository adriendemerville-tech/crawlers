import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * Edge Function: webhook-shopify-orders
 * 
 * Receives Shopify `orders/create` webhooks and persists revenue events.
 * Returns 200 immediately to avoid Shopify webhook timeouts.
 * 
 * Authentication: maps the shop domain to a tracked_site via cms_connections.
 */

Deno.serve(handleRequest(async (req) => {
  // Always respond 200 quickly — Shopify retries on non-2xx
  try {
    const supabase = getServiceClient()

    const payload = await req.json()

    // Extract order data
    const orderId = payload.id?.toString()
    const totalPrice = parseFloat(payload.total_price || '0')
    const currency = (payload.currency || 'USD').toUpperCase()
    const createdAt = payload.created_at || new Date().toISOString()

    if (!orderId || totalPrice <= 0) {
      return jsonOk({ ok: true, skipped: 'no_amount' })
    }

    // Resolve tracked_site from Shopify shop domain
    const shopDomain = req.headers.get('x-shopify-shop-domain')
      || payload.order_status_url?.match(/https?:\/\/([^/]+)/)?.[1]
      || ''

    if (!shopDomain) {
      console.error('[webhook-shopify] No shop domain found')
      return jsonOk({ ok: true, skipped: 'no_shop_domain' })
    }

    // Find the CMS connection for this Shopify store
    const bareDomain = shopDomain.replace(/^www\./, '').toLowerCase()
    const { data: connection } = await supabase
      .from('cms_connections')
      .select('tracked_site_id, user_id')
      .eq('platform', 'shopify')
      .ilike('site_url', `%${bareDomain}%`)
      .limit(1)
      .single()

    if (!connection) {
      // Fallback: try matching tracked_sites directly
      const { data: site } = await supabase
        .from('tracked_sites')
        .select('id, user_id')
        .ilike('domain', `%${bareDomain}%`)
        .limit(1)
        .single()

      if (!site) {
        console.warn(`[webhook-shopify] No site found for domain: ${bareDomain}`)
        return jsonOk({ ok: true, skipped: 'no_site_match' })
      }

      await insertRevenueEvent(supabase, {
        tracked_site_id: site.id,
        user_id: site.user_id,
        source: 'shopify',
        amount: totalPrice,
        currency,
        transaction_date: createdAt,
        order_external_id: `shopify-${orderId}`,
        raw_payload: { order_id: orderId, total_price: totalPrice, shop: shopDomain },
      })
    } else {
      await insertRevenueEvent(supabase, {
        tracked_site_id: connection.tracked_site_id,
        user_id: connection.user_id,
        source: 'shopify',
        amount: totalPrice,
        currency,
        transaction_date: createdAt,
        order_external_id: `shopify-${orderId}`,
        raw_payload: { order_id: orderId, total_price: totalPrice, shop: shopDomain },
      })
    }

    return jsonOk({ ok: true })
  } catch (err) {
    console.error('[webhook-shopify] Error:', err)
    // Still return 200 to prevent Shopify retries
    return jsonOk({ ok: true, error: 'internal' })
  }
})

async function insertRevenueEvent(supabase: any, event: Record<string, any>) {
  const { error } = await supabase
    .from('revenue_events')
    .upsert(event, { onConflict: 'tracked_site_id,source,order_external_id' })
  if (error) {
    console.error('[webhook-shopify] Insert error:', error.message)
  }
}