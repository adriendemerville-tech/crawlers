import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * track-payment — receives payment events from widget.js, GTM tag, or WP plugin.
 * No JWT required (called from client sites).
 * 
 * POST body:
 *   api_key       — site API key (tracked_sites.api_key)
 *   order_id      — external order identifier
 *   amount        — total amount (number)
 *   currency      — ISO currency code (default EUR)
 *   source        — "widget" | "gtm" | "wordpress" | "shopify_widget" …
 *   page_url      — URL where payment occurred
 *   customer_email— optional, hashed client-side
 *   metadata      — optional JSON
 */

Deno.serve(handleRequest(async (req) => {
if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const supabase = getServiceClient();

  try {
    const body = await req.json();
    const {
      api_key,
      order_id,
      amount,
      currency = 'EUR',
      source = 'widget',
      page_url,
      customer_email,
      metadata,
    } = body;

    if (!api_key || !order_id || amount == null) {
      return new Response(JSON.stringify({ error: 'api_key, order_id, and amount are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve tracked site from api_key
    const { data: site } = await supabase
      .from('tracked_sites')
      .select('id, user_id, domain')
      .eq('api_key', api_key)
      .maybeSingle();

    if (!site) {
      return new Response(JSON.stringify({ error: 'Invalid API key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upsert into revenue_events
    const { error } = await supabase
      .from('revenue_events')
      .upsert({
        tracked_site_id: site.id,
        user_id: site.user_id,
        source,
        order_external_id: String(order_id),
        amount: Number(amount),
        currency: currency.toUpperCase(),
        transaction_date: new Date().toISOString(),
        metadata: {
          page_url: page_url || null,
          customer_email: customer_email || null,
          ...(metadata || {}),
        },
      }, { onConflict: 'tracked_site_id,source,order_external_id' });

    if (error) {
      console.error('[track-payment] Insert error:', error.message);
      return new Response(JSON.stringify({ error: 'Failed to record payment' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[track-payment] Error:', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}));