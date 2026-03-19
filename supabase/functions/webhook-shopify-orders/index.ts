import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * Edge Function: webhook-shopify-orders
 * 
 * Receives Shopify `orders/create` webhooks and persists revenue events.
 * Returns 200 immediately to avoid Shopify webhook timeouts.
 * 
 * Authentication: maps the shop domain to a tracked_site via cms_connections.
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Always respond 200 quickly — Shopify retries on non-2xx
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const payload = await req.json()

    // Extract order data
    const orderId = payload.id?.toString()
    const totalPrice = parseFloat(payload.total_price || '0')
    const currency = (payload.currency || 'USD').toUpperCase()
    const createdAt = payload.created_at || new Date().toISOString()

    if (!orderId || totalPrice <= 0) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no_amount' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Resolve tracked_site from Shopify shop domain
    const shopDomain = req.headers.get('x-shopify-shop-domain')
      || payload.order_status_url?.match(/https?:\/\/([^/]+)/)?.[1]
      || ''

    if (!shopDomain) {
      console.error('[webhook-shopify] No shop domain found')
      return new Response(JSON.stringify({ ok: true, skipped: 'no_shop_domain' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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
        return new Response(JSON.stringify({ ok: true, skipped: 'no_site_match' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
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

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[webhook-shopify] Error:', err)
    // Still return 200 to prevent Shopify retries
    return new Response(JSON.stringify({ ok: true, error: 'internal' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
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
