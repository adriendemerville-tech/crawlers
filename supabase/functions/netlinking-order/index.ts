// netlinking-order — commande d'un backlink via un provider.
// Flow : vérifie wallet ≥ total, débite atomiquement, POST au provider,
// crée la ligne netlinking_orders, refund automatique si le provider échoue.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const BodySchema = z.object({
  provider_slug: z.enum(['accesslink', 'rocketlinks', 'getfluence']),
  provider_offer_id: z.string().min(1),
  target_url: z.string().url(),
  anchor_text: z.string().min(2).max(200),
  topic: z.string().max(200).optional(),
  tracked_site_id: z.string().uuid().optional(),
  publisher_domain: z.string().min(2),
  publisher_metrics: z.record(z.unknown()).optional(),
  cost_ht_cents: z.number().int().min(100),
  commission_cents: z.number().int().min(0),
  total_ht_cents: z.number().int().min(100),
  currency: z.string().length(3).default('EUR'),
});

type Body = z.infer<typeof BodySchema>;

async function placeAccesslinkOrder(body: Body): Promise<{ ok: true; provider_order_id: string } | { ok: false; error: string }> {
  const key = Deno.env.get('ACCESSLINK_API_KEY');
  if (!key) return { ok: false, error: 'ACCESSLINK_API_KEY missing' };
  try {
    const res = await fetch('https://api.accesslink.ai/v1/orders', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offer_id: body.provider_offer_id,
        target_url: body.target_url,
        anchor: body.anchor_text,
        topic: body.topic,
      }),
    });
    if (!res.ok) return { ok: false, error: `accesslink ${res.status}: ${await res.text()}` };
    const data = await res.json();
    return { ok: true, provider_order_id: String(data.id ?? data.order_id) };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = req.headers.get('Authorization');
    if (!auth) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = userData.user.id;

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const body = parsed.data;

    // Verify commission math server-side
    const expectedCommission = Math.round(body.cost_ht_cents * 0.10);
    const expectedTotal = body.cost_ht_cents + expectedCommission;
    if (body.commission_cents !== expectedCommission || body.total_ht_cents !== expectedTotal) {
      return new Response(JSON.stringify({ error: 'invalid_pricing', expected: { commission: expectedCommission, total: expectedTotal } }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // 1. Insert draft order
    const orderRef = crypto.randomUUID();
    const { data: order, error: insertErr } = await service
      .from('netlinking_orders')
      .insert({
        id: orderRef,
        user_id: userId,
        tracked_site_id: body.tracked_site_id,
        provider_slug: body.provider_slug,
        provider_offer_id: body.provider_offer_id,
        target_url: body.target_url,
        anchor_text: body.anchor_text,
        topic: body.topic,
        publisher_domain: body.publisher_domain,
        publisher_metrics: body.publisher_metrics ?? {},
        cost_ht_cents: body.cost_ht_cents,
        commission_cents: body.commission_cents,
        total_ht_cents: body.total_ht_cents,
        currency: body.currency,
        status: 'draft',
      })
      .select()
      .single();

    if (insertErr || !order) {
      return new Response(JSON.stringify({ error: 'db_insert_failed', details: insertErr?.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Debit wallet atomically
    const { data: newBalance, error: debitErr } = await service.rpc('dev_wallet_debit', {
      _user_id: userId,
      _amount_cents: body.total_ht_cents,
      _source_ref: `netlinking:${orderRef}`,
      _description: `Backlink ${body.provider_slug} → ${body.publisher_domain}`,
    });

    if (debitErr || newBalance === null) {
      await service.from('netlinking_orders').update({ status: 'cancelled', metadata: { reason: 'insufficient_balance' } }).eq('id', orderRef);
      return new Response(JSON.stringify({
        error: 'insufficient_balance',
        topup_url: '/developers/profile?tab=facturation',
        required_cents: body.total_ht_cents,
      }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Place order at provider
    let providerResult;
    if (body.provider_slug === 'accesslink') {
      providerResult = await placeAccesslinkOrder(body);
    } else {
      providerResult = { ok: false as const, error: `${body.provider_slug} order API not yet wired` };
    }

    if (!providerResult.ok) {
      // Refund wallet on failure
      await service.rpc('dev_wallet_credit', {
        _user_id: userId,
        _amount_cents: body.total_ht_cents,
        _source: 'refund',
        _source_ref: `netlinking-refund:${orderRef}`,
        _description: `Refund échec provider ${body.provider_slug}`,
      });
      await service.from('netlinking_orders')
        .update({ status: 'refunded', refunded_at: new Date().toISOString(), metadata: { error: providerResult.error } })
        .eq('id', orderRef);
      return new Response(JSON.stringify({ error: 'provider_failed', details: providerResult.error }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await service.from('netlinking_orders')
      .update({ status: 'pending', provider_order_id: providerResult.provider_order_id })
      .eq('id', orderRef);

    return new Response(JSON.stringify({
      order_id: orderRef,
      provider_order_id: providerResult.provider_order_id,
      status: 'pending',
      new_balance_cents: newBalance,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[netlinking-order] error', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
