import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * Edge Function: webhook-woo-orders
 * 
 * Receives WooCommerce `order.created` webhooks and persists revenue events.
 * Returns 200 immediately to avoid WooCommerce webhook timeouts.
 * 
 * Authentication: maps the store URL to a tracked_site via cms_connections
 * or the `x-wc-webhook-source` header.
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = getServiceClient()

    const payload = await req.json()

    // WooCommerce order structure
    const orderId = payload.id?.toString()
    const total = parseFloat(payload.total || '0')
    const currency = (payload.currency || 'EUR').toUpperCase()
    const dateCreated = payload.date_created || new Date().toISOString()

    if (!orderId || total <= 0) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no_amount' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Resolve source domain from WooCommerce webhook header
    const sourceUrl = req.headers.get('x-wc-webhook-source') || ''
    const bareDomain = sourceUrl
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
      .toLowerCase()

    if (!bareDomain) {
      console.error('[webhook-woo] No source domain found')
      return new Response(JSON.stringify({ ok: true, skipped: 'no_source' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Find CMS connection for this WooCommerce store
    const { data: connection } = await supabase
      .from('cms_connections')
      .select('tracked_site_id, user_id')
      .eq('platform', 'wordpress')
      .ilike('site_url', `%${bareDomain}%`)
      .limit(1)
      .single()

    let trackedSiteId: string
    let userId: string

    if (connection) {
      trackedSiteId = connection.tracked_site_id
      userId = connection.user_id
    } else {
      // Fallback: match tracked_sites directly
      const { data: site } = await supabase
        .from('tracked_sites')
        .select('id, user_id')
        .ilike('domain', `%${bareDomain}%`)
        .limit(1)
        .single()

      if (!site) {
        console.warn(`[webhook-woo] No site found for domain: ${bareDomain}`)
        return new Response(JSON.stringify({ ok: true, skipped: 'no_site_match' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      trackedSiteId = site.id
      userId = site.user_id
    }

    const { error } = await supabase
      .from('revenue_events')
      .upsert({
        tracked_site_id: trackedSiteId,
        user_id: userId,
        source: 'woocommerce',
        amount: total,
        currency,
        transaction_date: dateCreated,
        order_external_id: `woo-${orderId}`,
        raw_payload: { order_id: orderId, total, source_domain: bareDomain },
      }, { onConflict: 'tracked_site_id,source,order_external_id' })

    if (error) console.error('[webhook-woo] Insert error:', error.message)

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[webhook-woo] Error:', err)
    return new Response(JSON.stringify({ ok: true, error: 'internal' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
