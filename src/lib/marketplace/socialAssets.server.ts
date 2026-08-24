/**
 * socialAssets.server.ts (L6.1 → L6.3)
 *
 * Socle Collab : rattachement d'un compte Instagram / LinkedIn déjà connecté
 * (`social_accounts`), ingestion des métriques via l'API du fournisseur, puis
 * tarification déterministe par format (`socialPricing.ts`).
 *
 * Aucune écriture de prix côté client : tout passe par ce module.
 */

import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { loadConstants, num, obj, type MarketplaceConstants } from './constants.server';
import {
  computeSocialPrices,
  detectSocialFraud,
  type SocialFormat,
  type SocialMetrics,
  type SocialPricingConstants,
} from './socialPricing';
import type { PriceTier } from './types';

const GRAPH = 'https://graph.facebook.com/v21.0';

export interface SocialPricingBasis {
  affinity: number;
  metrics_days: number;
  breakdowns: Record<string, {
    base_cents: number;
    f_reach: number;
    g_engagement: number;
    h_affinity: number;
    k_creative: number;
    raw_cents: number;
  }>;
}

export interface SocialAssetView {
  id: string;
  platform: 'instagram' | 'linkedin';
  account_id: string;
  account_name: string | null;
  formats: SocialFormat[];
  followers: number | null;
  reach_avg: number | null;
  engagement_rate: number | null;
  creative_quality: number | null;
  opted_in: boolean;
  ownership_status: 'verified' | 'unverified' | 'revoked';
  vendable: boolean;
  unvendable_reason: string | null;
  price_cents: number | null;
  price_tier: PriceTier | null;
  prices_by_format: Record<string, { price_cents: number | null; tier: PriceTier | null; reason: string | null }>;
  pricing_basis: SocialPricingBasis;
  fraud_flags: string[];
  metrics_window_start: string | null;
  metrics_window_end: string | null;
  last_synced_at: string | null;
}

type Sb = { from: (t: string) => any };

/** Projette les constantes versionnées vers le contrat de `socialPricing.ts`. */
export function socialConstants(c: MarketplaceConstants): SocialPricingConstants {
  return {
    version: c.version,
    base_format: obj<Record<string, number>>(c, 'insta_base_format'),
    curve_f: obj<{ points: [number, number][] }>(c, 'insta_curve_f'),
    curve_g: obj<{ points: [number, number][] }>(c, 'insta_curve_g'),
    curve_h: obj<{ points: [number, number][] }>(c, 'insta_curve_h'),
    curve_k: obj<{ points: [number, number][] }>(c, 'insta_curve_k'),
    fraud: obj<Record<string, number>>(c, 'insta_fraud_thresholds') as unknown as SocialPricingConstants['fraud'],
    min_metrics_days: num(c, 'insta_min_metrics_days'),
    floor_cents: num(c, 'price_floor_cents'),
    cap_cents: num(c, 'price_cap_cents'),
    rounding_cents: num(c, 'price_rounding_cents'),
    tiers: obj<Record<PriceTier, number>>(c, 'tiers'),
  };
}

function daysBetween(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));
}

async function graph(path: string, params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${GRAPH}/${path}?${qs}`, { redirect: 'follow' });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`API Meta : ${msg}`);
  }
  return json;
}

export interface IngestResult {
  metrics: SocialMetrics;
  window_start: string;
  window_end: string;
  source: string;
  audience_geo: Record<string, number>;
  follower_history: number[];
}

/**
 * Ingestion Instagram (compte Business / Creator) : abonnés, portée moyenne,
 * engagement réel sur les 28 derniers jours, répartition d'audience.
 */
export async function ingestInstagramMetrics(igUserId: string, token: string, windowDays: number): Promise<IngestResult> {
  const until = new Date();
  const since = new Date(until.getTime() - windowDays * 86_400_000);
  const sinceUnix = String(Math.floor(since.getTime() / 1000));
  const untilUnix = String(Math.floor(until.getTime() / 1000));

  const profile = await graph(igUserId, {
    fields: 'followers_count,media_count,username',
    access_token: token,
  });

  let reachAvg = 0;
  let impressionsAvg = 0;
  try {
    const insights = await graph(`${igUserId}/insights`, {
      metric: 'reach,impressions',
      period: 'day',
      since: sinceUnix,
      until: untilUnix,
      access_token: token,
    });
    for (const entry of insights?.data ?? []) {
      const values: number[] = (entry.values ?? []).map((v: any) => Number(v.value) || 0);
      const avg = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
      if (entry.name === 'reach') reachAvg = Math.round(avg);
      if (entry.name === 'impressions') impressionsAvg = Math.round(avg);
    }
  } catch {
    // Insights indisponibles (compte personnel, permission manquante) :
    // on reste sur une portée nulle, ce qui rend l'actif non tarifable.
  }

  let engagementRate = 0;
  let creativeQuality = 0.5;
  try {
    const media = await graph(`${igUserId}/media`, {
      fields: 'id,caption,like_count,comments_count,media_type,timestamp',
      limit: '25',
      access_token: token,
    });
    const items = (media?.data ?? []).filter((m: any) => new Date(m.timestamp).getTime() >= since.getTime());
    if (items.length > 0 && reachAvg > 0) {
      const interactions =
        items.reduce((s: number, m: any) => s + (Number(m.like_count) || 0) + (Number(m.comments_count) || 0), 0) /
        items.length;
      engagementRate = Number((interactions / reachAvg).toFixed(5));
    }
    if (items.length > 0) {
      const withCaption = items.filter((m: any) => (m.caption ?? '').trim().length > 80).length / items.length;
      const cadence = Math.min(1, items.length / 8);
      creativeQuality = Number(((withCaption * 0.5 + cadence * 0.5)).toFixed(3));
    }
  } catch {
    // Médias illisibles : qualité créative laissée à la valeur neutre.
  }

  let audienceGeo: Record<string, number> = {};
  try {
    const demo = await graph(`${igUserId}/insights`, {
      metric: 'audience_country',
      period: 'lifetime',
      access_token: token,
    });
    const raw = demo?.data?.[0]?.values?.[0]?.value ?? {};
    const total = Object.values(raw).reduce((s: number, v) => s + (Number(v) || 0), 0);
    if (total > 0) {
      audienceGeo = Object.fromEntries(
        Object.entries(raw).map(([k, v]) => [k, Number(((Number(v) || 0) / total).toFixed(4))]),
      );
    }
  } catch {
    // Démographie non exposée : aucun drapeau d'audience incohérente n'est levé.
  }

  const followers = Number(profile?.followers_count) || 0;

  return {
    metrics: {
      followers,
      reach_avg: reachAvg,
      impressions_avg: impressionsAvg,
      engagement_rate: engagementRate,
      creative_quality: creativeQuality,
      audience_geo: audienceGeo,
      follower_history: [],
      metrics_days: windowDays,
    },
    window_start: since.toISOString(),
    window_end: until.toISOString(),
    source: 'meta_api',
    audience_geo: audienceGeo,
    follower_history: [followers],
  };
}

/** Comptes sociaux connectés, éligibles à une mise en Collab. */
export async function listConnectableAccounts(sb: Sb, userId: string) {
  const { data, error } = await sb
    .from('social_accounts')
    .select('id, platform, account_id, account_name, page_id, status, scopes')
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('platform', ['instagram', 'linkedin']);
  if (error) throw new Error(`Comptes sociaux illisibles : ${error.message}`);
  return (data ?? []) as Array<{
    id: string;
    platform: 'instagram' | 'linkedin';
    account_id: string | null;
    account_name: string | null;
    page_id: string | null;
    scopes: string[] | null;
  }>;
}

export async function listSocialAssets(sb: Sb, userId: string): Promise<SocialAssetView[]> {
  const { data, error } = await sb
    .from('marketplace_social_assets')
    .select(
      'id, platform, account_id, account_name, formats, followers, reach_avg, engagement_rate, creative_quality, opted_in, ownership_status, vendable, unvendable_reason, price_cents, price_tier, prices_by_format, pricing_basis, fraud_flags, metrics_window_start, metrics_window_end, last_synced_at',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Actifs Collab illisibles : ${error.message}`);
  return (data ?? []) as SocialAssetView[];
}

/**
 * Rattache un compte connecté à la place d'échange, ingère ses métriques et
 * calcule ses prix par format. Le rattachement ne rend rien public : l'opt-in
 * reste une décision explicite du vendeur.
 */
export async function syncSocialAsset(params: {
  userId: string;
  socialAccountId: string;
  formats: SocialFormat[];
  affinity?: number;
}): Promise<SocialAssetView> {
  const constants = await loadConstants();
  const sc = socialConstants(constants);

  const { data: account, error: accountError } = await supabaseAdmin
    .from('social_accounts')
    .select('id, user_id, platform, account_id, account_name, page_id, access_token, status')
    .eq('id', params.socialAccountId)
    .eq('user_id', params.userId)
    .maybeSingle();

  if (accountError) throw new Error(`Compte social illisible : ${accountError.message}`);
  if (!account || account.status !== 'active') throw new Error('Compte social introuvable ou déconnecté');
  if (account.platform !== 'instagram' && account.platform !== 'linkedin') {
    throw new Error('Plateforme non éligible à la Collab');
  }

  const igId = account.account_id ?? account.page_id;
  if (!igId) throw new Error('Identifiant de compte manquant : reconnectez le compte');

  let ingest: IngestResult;
  if (account.platform === 'instagram') {
    ingest = await ingestInstagramMetrics(igId, account.access_token as string, sc.min_metrics_days);
  } else {
    // LinkedIn : métriques déjà collectées par le hub social, pas de nouvel appel.
    const { data: snapshot } = await supabaseAdmin
      .from('social_accounts')
      .select('metadata')
      .eq('id', account.id)
      .maybeSingle();
    const meta = (snapshot?.metadata ?? {}) as Record<string, number>;
    const end = new Date();
    ingest = {
      metrics: {
        followers: Number(meta.followers) || 0,
        reach_avg: Number(meta.reach_avg) || 0,
        impressions_avg: Number(meta.impressions_avg) || 0,
        engagement_rate: Number(meta.engagement_rate) || 0,
        creative_quality: 0.5,
        audience_geo: {},
        follower_history: [],
        metrics_days: Number(meta.metrics_days) || 0,
      },
      window_start: new Date(end.getTime() - sc.min_metrics_days * 86_400_000).toISOString(),
      window_end: end.toISOString(),
      source: 'linkedin_api',
      audience_geo: {},
      follower_history: [Number(meta.followers) || 0],
    };
  }

  // Historique de followers conservé pour la détection d'escaliers.
  const { data: existing } = await supabaseAdmin
    .from('marketplace_social_assets')
    .select('id, follower_history')
    .eq('user_id', params.userId)
    .eq('platform', account.platform)
    .eq('account_id', igId)
    .maybeSingle();

  const history = [...(((existing?.follower_history as number[]) ?? []) as number[]), ...ingest.follower_history].slice(-12);
  const metrics: SocialMetrics = { ...ingest.metrics, follower_history: history };

  const formats = params.formats.length > 0 ? params.formats : (['feed'] as SocialFormat[]);
  const affinity = Math.min(1, Math.max(0, params.affinity ?? 0.6));
  const results = computeSocialPrices(formats, metrics, affinity, sc);
  const fraudFlags = detectSocialFraud(metrics, sc);

  const best = results
    .filter((r) => r.vendable && r.price_cents !== null)
    .sort((a, b) => (b.price_cents ?? 0) - (a.price_cents ?? 0))[0];

  const pricesByFormat = Object.fromEntries(
    results.map((r) => [r.format, { price_cents: r.price_cents, tier: r.tier, reason: r.reason }]),
  );

  const row = {
    user_id: params.userId,
    platform: account.platform,
    account_id: igId,
    account_name: account.account_name,
    social_account_id: account.id,
    formats,
    followers: metrics.followers,
    reach_avg: metrics.reach_avg,
    impressions_avg: metrics.impressions_avg,
    engagement_rate: metrics.engagement_rate,
    audience_geo: ingest.audience_geo,
    creative_quality: metrics.creative_quality,
    metrics_window_start: ingest.window_start,
    metrics_window_end: ingest.window_end,
    metrics_source: ingest.source,
    follower_history: history,
    fraud_flags: fraudFlags,
    ownership_status: 'verified' as const,
    price_cents: best?.price_cents ?? null,
    price_tier: best?.tier ?? null,
    prices_by_format: pricesByFormat,
    pricing_basis: {
      affinity,
      metrics_days: metrics.metrics_days,
      breakdowns: Object.fromEntries(results.map((r) => [r.format, r.breakdown])),
    },
    vendable: Boolean(best),
    unvendable_reason: best ? null : (results[0]?.reason ?? 'valeur insuffisante'),
    constants_version: constants.version,
    last_synced_at: new Date().toISOString(),
  };

  const { error: upsertError } = await supabaseAdmin
    .from('marketplace_social_assets')
    .upsert(row as never, { onConflict: 'user_id,platform,account_id' });
  if (upsertError) throw new Error(`Actif Collab non enregistré : ${upsertError.message}`);

  const assets = await listSocialAssets(supabaseAdmin as unknown as Sb, params.userId);
  const view = assets.find((a) => a.account_id === igId && a.platform === account.platform);
  if (!view) throw new Error('Actif Collab introuvable après enregistrement');
  return view;
}

export async function setSocialOptIn(params: {
  userId: string;
  assetId: string;
  optIn: boolean;
}): Promise<{ opted_in: boolean }> {
  const { data: asset, error } = await supabaseAdmin
    .from('marketplace_social_assets')
    .select('id, vendable, ownership_status')
    .eq('id', params.assetId)
    .eq('user_id', params.userId)
    .maybeSingle();
  if (error) throw new Error(`Actif Collab illisible : ${error.message}`);
  if (!asset) throw new Error('Actif Collab introuvable');
  if (params.optIn && (!asset.vendable || asset.ownership_status !== 'verified')) {
    throw new Error('Actif non éligible : valeur insuffisante ou compte non vérifié');
  }

  const { error: updateError } = await supabaseAdmin
    .from('marketplace_social_assets')
    .update({ opted_in: params.optIn })
    .eq('id', params.assetId)
    .eq('user_id', params.userId);
  if (updateError) throw new Error(`Mise à jour refusée : ${updateError.message}`);
  return { opted_in: params.optIn };
}

/**
 * Déconnexion (L6.2) : révocation du token côté fournisseur puis retrait de
 * l'actif de la place d'échange. Une révocation qui échoue ne bloque pas le
 * retrait local — l'actif ne doit jamais rester vendable avec un token mort.
 */
export async function revokeSocialAsset(params: {
  userId: string;
  assetId: string;
}): Promise<{ revoked: boolean; provider_revoked: boolean; message: string }> {
  const { data: asset, error } = await supabaseAdmin
    .from('marketplace_social_assets')
    .select('id, platform, account_id, social_account_id')
    .eq('id', params.assetId)
    .eq('user_id', params.userId)
    .maybeSingle();
  if (error) throw new Error(`Actif Collab illisible : ${error.message}`);
  if (!asset) throw new Error('Actif Collab introuvable');

  let providerRevoked = false;
  if (asset.social_account_id) {
    const { data: account } = await supabaseAdmin
      .from('social_accounts')
      .select('id, access_token, platform, account_id, page_id')
      .eq('id', asset.social_account_id)
      .eq('user_id', params.userId)
      .maybeSingle();

    if (account?.access_token && account.platform === 'instagram') {
      try {
        const target = account.account_id ?? account.page_id;
        const res = await fetch(`${GRAPH}/${target}/permissions?access_token=${encodeURIComponent(account.access_token)}`, {
          method: 'DELETE',
        });
        providerRevoked = res.ok;
      } catch {
        providerRevoked = false;
      }
    }

    await supabaseAdmin
      .from('social_accounts')
      .update({ status: 'revoked', access_token: null, refresh_token: null })
      .eq('id', asset.social_account_id)
      .eq('user_id', params.userId);
  }

  await supabaseAdmin
    .from('marketplace_social_assets')
    .update({
      opted_in: false,
      vendable: false,
      ownership_status: 'revoked',
      unvendable_reason: 'compte déconnecté',
      price_cents: null,
      price_tier: null,
    })
    .eq('id', params.assetId)
    .eq('user_id', params.userId);

  return {
    revoked: true,
    provider_revoked: providerRevoked,
    message: providerRevoked
      ? 'Compte retiré et autorisation révoquée côté fournisseur.'
      : "Compte retiré. La révocation côté fournisseur n'a pas pu être confirmée : retirez l'accès depuis vos paramètres Meta.",
  };
}
