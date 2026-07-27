// netlinking-webhook — callbacks providers (link live, rejected, refund).
// Sans JWT côté Supabase, mais chaque provider signe avec son propre HMAC.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

async function verifyHmac(secret: string, body: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return signatureHeader.replace(/^sha256=/, '').toLowerCase() === hex;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const providerSlug = url.searchParams.get('provider');
    if (!providerSlug || !['accesslink', 'rocketlinks', 'getfluence'].includes(providerSlug)) {
      return new Response(JSON.stringify({ error: 'invalid_provider' }), { status: 400, headers: corsHeaders });
    }

    const body = await req.text();
    const secretName = `${providerSlug.toUpperCase()}_WEBHOOK_SECRET`;
    const secret = Deno.env.get(secretName);
    if (secret) {
      const sigHeader = req.headers.get('x-signature') ?? req.headers.get('x-webhook-signature');
      const valid = await verifyHmac(secret, body, sigHeader);
      if (!valid) {
        return new Response(JSON.stringify({ error: 'invalid_signature' }), { status: 401, headers: corsHeaders });
      }
    }

    const event = JSON.parse(body);
    const providerOrderId = String(event.order_id ?? event.id ?? event.provider_order_id ?? '');
    const eventType = String(event.event ?? event.type ?? '').toLowerCase();

    if (!providerOrderId) {
      return new Response(JSON.stringify({ error: 'missing_order_id' }), { status: 400, headers: corsHeaders });
    }

    const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const patch: Record<string, unknown> = { metadata: event };

    if (eventType.includes('live') || eventType.includes('published') || event.live_url) {
      patch.status = 'live';
      patch.live_url = event.live_url ?? event.url ?? null;
      patch.published_at = new Date().toISOString();
    } else if (eventType.includes('reject') || eventType.includes('cancel')) {
      patch.status = 'rejected';
    } else if (eventType.includes('progress') || eventType.includes('confirmed')) {
      patch.status = 'in_progress';
    }

    const { data: order } = await service
      .from('netlinking_orders')
      .update(patch)
      .eq('provider_slug', providerSlug)
      .eq('provider_order_id', providerOrderId)
      .select('id,user_id,total_ht_cents,status')
      .maybeSingle();

    // Auto-refund on rejection
    if (order && patch.status === 'rejected') {
      await service.rpc('dev_wallet_credit', {
        _user_id: order.user_id,
        _amount_cents: order.total_ht_cents,
        _source: 'refund',
        _source_ref: `netlinking-refund:${order.id}`,
        _description: `Refund rejet ${providerSlug}`,
      });
      await service.from('netlinking_orders').update({ status: 'refunded', refunded_at: new Date().toISOString() }).eq('id', order.id);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[netlinking-webhook] error', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
