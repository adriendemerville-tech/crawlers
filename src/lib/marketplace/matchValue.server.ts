/**
 * matchValue.server.ts (L2.5)
 *
 * Valeur d'appariement, exposée dans l'audit stratégique GEO et Marina :
 *  - face vendeur : ce que la page peut rapporter sans abîmer l'autorité ;
 *  - face acheteur : à quel point la page a besoin d'un apport externe ;
 *  - échelle domaine : potentiel de vente, besoin d'achat, solde d'autorité.
 *
 * Cache site-scoped de 24 h (`marketplace_match_values`) pour éviter de
 * recalculer à chaque affichage de rapport.
 */

import { loadConstants, num } from './constants.server';
import type { MatchValueRow } from './matchTypes';

type Sb = { from: (table: string) => any };

interface AssetLite {
  url: string;
  domain: string;
  price_cents: number | null;
  authority_score: number | null;
  semantic_score: number | null;
  ai_visibility_score: number | null;
  opted_in: boolean;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
}

/** Lit le cache si frais, sinon recalcule et l'écrit. */
export async function getMatchValues(
  sb: Sb,
  params: { userId: string; domain: string; force?: boolean },
): Promise<MatchValueRow[]> {
  const nowIso = new Date().toISOString();

  if (!params.force) {
    const { data: cached } = await sb
      .from('marketplace_match_values')
      .select(
        'scope, domain, url, seller_face, buyer_face, sell_potential_cents, buy_need_score, balance_cents, factors, computed_at',
      )
      .eq('user_id', params.userId)
      .eq('domain', params.domain)
      .gt('expires_at', nowIso);
    if (cached && cached.length > 0) return cached as MatchValueRow[];
  }

  const constants = await loadConstants();
  const ttlHours = num(constants, 'match_value_ttl_hours');

  const [{ data: assetsRaw }, { data: risksRaw }, { data: needsRaw }, { data: balanceRaw }] =
    await Promise.all([
      sb
        .from('marketplace_link_assets')
        .select('url, domain, price_cents, authority_score, semantic_score, ai_visibility_score, opted_in')
        .eq('user_id', params.userId)
        .eq('domain', params.domain),
      sb
        .from('marketplace_page_sell_risk')
        .select('url, sell_risk, risk_class, hard_exclusion_reason')
        .eq('user_id', params.userId),
      sb
        .from('marketplace_needs')
        .select('target_url, need_score, authority_deficit')
        .eq('user_id', params.userId)
        .eq('domain', params.domain)
        .eq('status', 'open'),
      sb
        .from('marketplace_site_balances')
        .select('authority_balance_cents')
        .eq('user_id', params.userId)
        .eq('site_domain', params.domain)
        .maybeSingle(),
    ]);

  const assets = (assetsRaw ?? []) as AssetLite[];
  const riskByUrl = new Map<string, { sell_risk: number; blocked: boolean }>();
  for (const r of (risksRaw ?? []) as any[]) {
    riskByUrl.set(r.url, {
      sell_risk: Number(r.sell_risk ?? 1),
      blocked: Boolean(r.hard_exclusion_reason) || r.risk_class === 'discouraged',
    });
  }
  const needByUrl = new Map<string, { need_score: number; deficit: number }>();
  for (const n of (needsRaw ?? []) as any[]) {
    needByUrl.set(n.target_url, {
      need_score: Number(n.need_score ?? 0),
      deficit: Number(n.authority_deficit ?? 0),
    });
  }
  const balanceCents = Number((balanceRaw as any)?.authority_balance_cents ?? 0);

  const rows: MatchValueRow[] = [];
  let sellPotential = 0;
  let sellerFaceSum = 0;
  let buyerFaceSum = 0;

  for (const a of assets) {
    const risk = riskByUrl.get(a.url);
    const need = needByUrl.get(a.url);
    const risky = risk?.blocked ?? true;
    const sellRisk = risk?.sell_risk ?? 1;

    // Face vendeur : valeur monétisable pondérée par ce que la cession coûte.
    const sellerFace = risky ? 0 : clamp01(1 - sellRisk) * clamp01((a.price_cents ?? 0) / 35000);
    // Face acheteur : intensité du besoin de la page, jamais liée à son prix.
    const buyerFace = clamp01(
      (need?.need_score ?? 0) * 0.6 + clamp01((need?.deficit ?? 0) / 300) * 0.4,
    );

    if (!risky) sellPotential += a.price_cents ?? 0;
    sellerFaceSum += sellerFace;
    buyerFaceSum += buyerFace;

    rows.push({
      scope: 'page',
      domain: a.domain,
      url: a.url,
      seller_face: Number(sellerFace.toFixed(3)),
      buyer_face: Number(buyerFace.toFixed(3)),
      sell_potential_cents: risky ? 0 : (a.price_cents ?? 0),
      buy_need_score: Number((need?.need_score ?? 0).toFixed(3)),
      balance_cents: balanceCents,
      factors: {
        sell_risk: Number(sellRisk.toFixed(3)),
        authority: a.authority_score ?? 0,
        semantic: a.semantic_score ?? 0,
        ai_visibility: a.ai_visibility_score ?? 0,
        opted_in: a.opted_in ? 1 : 0,
      },
      computed_at: nowIso,
    });
  }

  const count = Math.max(1, assets.length);
  rows.push({
    scope: 'domain',
    domain: params.domain,
    url: '',
    seller_face: Number((sellerFaceSum / count).toFixed(3)),
    buyer_face: Number((buyerFaceSum / count).toFixed(3)),
    sell_potential_cents: sellPotential,
    buy_need_score: Number(
      (
        [...needByUrl.values()].reduce((s, n) => s + n.need_score, 0) / Math.max(1, needByUrl.size)
      ).toFixed(3),
    ),
    balance_cents: balanceCents,
    factors: { pages: assets.length, needs: needByUrl.size },
    computed_at: nowIso,
  });

  const expires = new Date(Date.now() + ttlHours * 3_600_000).toISOString();
  await sb.from('marketplace_match_values').upsert(
    rows.map((r) => ({
      user_id: params.userId,
      scope: r.scope,
      domain: r.domain,
      url: r.url,
      seller_face: r.seller_face,
      buyer_face: r.buyer_face,
      sell_potential_cents: r.sell_potential_cents,
      buy_need_score: r.buy_need_score,
      balance_cents: r.balance_cents,
      factors: r.factors,
      constants_version: constants.version,
      computed_at: nowIso,
      expires_at: expires,
    })),
    { onConflict: 'user_id,scope,domain,url' },
  );

  return rows;
}
