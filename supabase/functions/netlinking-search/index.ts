// netlinking-search — recherche multi-provider d'opportunités de backlinks.
// Sprint 1 : Accesslink.ai activé si secret présent. Rocketlinks & Getfluence
// sont câblés mais retournent un tableau vide tant que leur API key n'est pas
// fournie. Commission Crawlers de 10% appliquée sur les prix affichés.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const COMMISSION_RATE = 0.10;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
// Providers dont l'API est réellement câblée (search + order)
const WIRED_PROVIDERS = ['accesslink'] as const satisfies readonly string[];
const PREMIUM_PLANS = new Set(['premium', 'premium_yearly', 'agency_pro', 'agency_premium', 'pro_agency']);

const BodySchema = z.object({
  topic: z.string().min(2).max(200),
  target_url: z.string().url().optional(),
  min_dr: z.number().int().min(0).max(100).optional(),
  min_traffic: z.number().int().min(0).optional(),
  budget_max_cents: z.number().int().min(0).max(500_000).optional(),
  language: z.string().length(2).optional().default('fr'),
  providers: z.array(z.enum(['accesslink', 'rocketlinks', 'getfluence'])).optional(),
});

type Offer = {
  provider_slug: string;
  provider_offer_id: string;
  publisher_domain: string;
  language: string;
  topic_match: number;
  metrics: {
    dr?: number;
    tf?: number;
    cf?: number;
    monthly_traffic?: number;
  };
  cost_ht_cents: number;
  commission_cents: number;
  total_ht_cents: number;
  currency: string;
  turnaround_days?: number;
  raw?: unknown;
};

function withCommission(costHtCents: number) {
  const commission = Math.round(costHtCents * COMMISSION_RATE);
  return {
    cost_ht_cents: costHtCents,
    commission_cents: commission,
    total_ht_cents: costHtCents + commission,
  };
}

async function fetchAccesslink(params: z.infer<typeof BodySchema>): Promise<Offer[]> {
  const key = Deno.env.get('ACCESSLINK_API_KEY');
  if (!key) return [];
  try {
    const res = await fetch('https://api.accesslink.ai/v1/marketplace/search', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: params.topic,
        language: params.language,
        min_dr: params.min_dr,
        min_traffic: params.min_traffic,
        max_price_cents: params.budget_max_cents,
        limit: 50,
      }),
    });
    if (!res.ok) {
      console.warn(`[accesslink] ${res.status}: ${await res.text()}`);
      return [];
    }
    const data = await res.json();
    const items: any[] = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
    return items.map((i) => ({
      provider_slug: 'accesslink',
      provider_offer_id: String(i.id ?? i.offer_id ?? i.uuid ?? crypto.randomUUID()),
      publisher_domain: String(i.domain ?? i.host ?? ''),
      language: String(i.language ?? params.language),
      topic_match: Number(i.relevance ?? i.topic_score ?? 0.5),
      metrics: {
        dr: i.dr ?? i.domain_rating,
        tf: i.tf ?? i.trust_flow,
        cf: i.cf ?? i.citation_flow,
        monthly_traffic: i.traffic ?? i.monthly_traffic,
      },
      currency: String(i.currency ?? 'EUR'),
      turnaround_days: i.turnaround_days,
      ...withCommission(Number(i.price_cents ?? Math.round((i.price ?? 0) * 100))),
      raw: i,
    }));
  } catch (err) {
    console.error('[accesslink] error', err);
    return [];
  }
}

async function fetchRocketlinks(_params: z.infer<typeof BodySchema>): Promise<Offer[]> {
  const key = Deno.env.get('ROCKETLINKS_API_KEY');
  if (!key) return [];
  // TODO Sprint 2 — endpoint marketplace Rocketlinks
  return [];
}

async function fetchGetfluence(_params: z.infer<typeof BodySchema>): Promise<Offer[]> {
  const key = Deno.env.get('GETFLUENCE_API_KEY');
  if (!key) return [];
  // TODO Sprint 2 — endpoint /api/publishers Getfluence
  return [];
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

    const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Gating Premium+ (le netlinking engage de l'argent réel)
    const { data: sub } = await service
      .from('subscriptions')
      .select('plan')
      .eq('user_id', userData.user.id)
      .eq('status', 'active')
      .maybeSingle();
    const plan = (sub?.plan || '').toLowerCase();
    if (!PREMIUM_PLANS.has(plan)) {
      return new Response(JSON.stringify({ error: 'plan_required', message: 'Le netlinking est réservé aux plans Premium et plus.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const params = parsed.data;
    // Seuls les providers réellement câblés sont interrogés
    const wired: string[] = [...WIRED_PROVIDERS];
    const requested: string[] = params.providers?.length ? [...params.providers] : wired;
    const providers = requested.filter((p) => wired.includes(p));
    if (providers.length === 0) {
      return new Response(JSON.stringify({ offers: [], providers_hit: [], unavailable_providers: requested, commission_rate: COMMISSION_RATE }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cache lookup + purge des entrées expirées
    const cacheKey = `${providers.sort().join(',')}::${params.language}::${params.topic}::${params.min_dr ?? 0}::${params.min_traffic ?? 0}::${params.budget_max_cents ?? 0}`;
    await service.from('netlinking_catalog_cache').delete().lt('expires_at', new Date().toISOString());
    const { data: cached } = await service
      .from('netlinking_catalog_cache')
      .select('payload,expires_at')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();


    if (cached?.payload) {
      return new Response(JSON.stringify({ ...(cached.payload as object), cached: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Quota fair-use : uniquement sur les recherches qui déclenchent un vrai
    // appel provider (payant). Un hit de cache ne consomme rien.
    const isAgency = plan.includes('agency');
    const { data: fairUse } = await service.rpc('check_fair_use_v2', {
      p_user_id: userData.user.id,
      p_action: 'netlinking_search',
      p_hourly_limit: isAgency ? 60 : 20,
      p_daily_limit: isAgency ? 300 : 60,
    });
    if (fairUse && (fairUse as Record<string, unknown>)['allowed'] === false) {
      return new Response(JSON.stringify({
        error: 'rate_limited',
        message: 'Limite de recherches netlinking atteinte. Réessaie plus tard.',
        details: fairUse,
      }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results = await Promise.all([

      providers.includes('accesslink') ? fetchAccesslink(params) : Promise.resolve([]),
      providers.includes('rocketlinks') ? fetchRocketlinks(params) : Promise.resolve([]),
      providers.includes('getfluence') ? fetchGetfluence(params) : Promise.resolve([]),
    ]);
    const offers = results.flat().sort((a, b) => a.total_ht_cents - b.total_ht_cents);

    const payload = {
      offers,
      providers_hit: providers,
      commission_rate: COMMISSION_RATE,
      generated_at: new Date().toISOString(),
    };

    await service.from('netlinking_catalog_cache').upsert({
      cache_key: cacheKey,
      provider_slug: providers.join(','),
      payload,
      expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    }, { onConflict: 'cache_key' });

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[netlinking-search] error', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
