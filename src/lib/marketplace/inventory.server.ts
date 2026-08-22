/**
 * inventory.server.ts (L1a.16)
 *
 * Vue vendeur de l'inventaire : recalcule prix, risque et plafonds à la lecture
 * pour ne jamais afficher un tarif figé issu d'une version de constantes périmée.
 * Le tri suit §2.12 : les pages les moins risquées d'abord, à valeur égale la
 * plus rémunératrice devant.
 */

import { loadConstants } from './constants.server';
import { computePricingWith } from './pricing.server';
import { evaluateCapsWith } from './caps.server';
import { riskReason } from './sellRisk.server';
import type { InventoryRow, SellRiskClass, PriceTier } from './types';

interface AssetRow {
  id: string;
  url: string;
  domain: string;
  opted_in: boolean;
  ownership_status: 'verified' | 'unverified' | 'revoked';
  authority_score: number | null;
  semantic_score: number | null;
  traffic_score: number | null;
  quality_score: number | null;
  ai_visibility_score: number | null;
  gsc_window_start: string | null;
  gsc_window_end: string | null;
  dofollow_sold_lifetime: number;
  insertions_12m: number;
  revenue_cents: number;
}

interface RiskRow {
  url: string;
  sell_risk: number;
  risk_class: SellRiskClass;
  components: Record<string, number>;
  hard_exclusion_reason: string | null;
}

function signalDays(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

const RISK_RANK: Record<SellRiskClass, number> = { safe: 0, moderate: 1, discouraged: 2 };

export async function listInventory(
  sb: { from: (t: string) => any },
  userId: string,
): Promise<InventoryRow[]> {
  const constants = await loadConstants();

  const { data: assets, error } = await sb
    .from('marketplace_link_assets')
    .select(
      'id, url, domain, opted_in, ownership_status, authority_score, semantic_score, traffic_score, quality_score, ai_visibility_score, gsc_window_start, gsc_window_end, dofollow_sold_lifetime, insertions_12m, revenue_cents',
    )
    .eq('user_id', userId);

  if (error) throw new Error(`Inventaire illisible : ${error.message}`);
  const rows = (assets ?? []) as AssetRow[];
  if (rows.length === 0) return [];

  const { data: risks } = await sb
    .from('marketplace_page_sell_risk')
    .select('url, sell_risk, risk_class, components, hard_exclusion_reason')
    .eq('user_id', userId);

  const riskByUrl = new Map<string, RiskRow>();
  for (const r of (risks ?? []) as RiskRow[]) riskByUrl.set(r.url, r);

  const dofollowByDomain = new Map<string, number>();
  for (const a of rows) {
    dofollowByDomain.set(a.domain, (dofollowByDomain.get(a.domain) ?? 0) + a.dofollow_sold_lifetime);
  }

  const result: InventoryRow[] = rows.map((a) => {
    const risk = riskByUrl.get(a.url) ?? null;
    const pricing = computePricingWith(
      {
        authority_score: a.authority_score ?? 0,
        semantic_score: a.semantic_score ?? 0,
        traffic_score: a.traffic_score ?? 0,
        quality_score: a.quality_score ?? 0,
        ai_visibility_score: a.ai_visibility_score ?? 0,
      },
      {
        ownership_status: a.ownership_status,
        gsc_signal_days: signalDays(a.gsc_window_start, a.gsc_window_end),
        risk_class: risk?.risk_class ?? null,
      },
      constants,
    );

    const caps = evaluateCapsWith(
      {
        dofollow_page_lifetime_used: a.dofollow_sold_lifetime,
        dofollow_domain_12m_used: dofollowByDomain.get(a.domain) ?? 0,
        insertions_page_12m_used: a.insertions_12m,
      },
      constants,
    );

    const sellRisk = risk?.sell_risk ?? null;
    const sortScore = sellRisk === null ? -1 : (1 - sellRisk) * 1000 + pricing.price_cents / 1000;

    return {
      id: a.id,
      url: a.url,
      domain: a.domain,
      opted_in: a.opted_in,
      price_cents: pricing.price_cents,
      price_tier: pricing.tier as PriceTier,
      sell_risk: sellRisk,
      risk_class: risk?.risk_class ?? null,
      risk_reason: risk
        ? riskReason({
            sell_risk: risk.sell_risk,
            risk_class: risk.risk_class,
            components: {
              strategic: risk.components?.strategic ?? 0,
              internal_dependency: risk.components?.internal_dependency ?? 0,
              gsc_momentum: risk.components?.gsc_momentum ?? 0,
              outbound_saturation: risk.components?.outbound_saturation ?? 0,
              technical_fragility: risk.components?.technical_fragility ?? 0,
            },
            hard_exclusion_reason: risk.hard_exclusion_reason,
            eligible: risk.risk_class !== 'discouraged' && !risk.hard_exclusion_reason,
            constants_version: constants.version,
          })
        : 'Risque non encore calculé (attente du prochain crawl)',
      ownership_status: a.ownership_status,
      caps,
      revenue_cents: a.revenue_cents,
      sort_score: Number(sortScore.toFixed(2)),
    };
  });

  return result.sort((x, y) => {
    const rx = RISK_RANK[x.risk_class ?? 'moderate'];
    const ry = RISK_RANK[y.risk_class ?? 'moderate'];
    if (rx !== ry) return rx - ry;
    return y.sort_score - x.sort_score;
  });
}

/**
 * Bascule d'opt-in : refuse toute mise en vente sans propriété vérifiée,
 * sans profil fiscal complet ou sur une page déconseillée (§2.12).
 */
export async function setOptIn(
  sb: { from: (t: string) => any },
  params: { userId: string; assetId: string; optIn: boolean; termsVersion: number },
): Promise<{ opted_in: boolean }> {
  const { data: asset, error } = await sb
    .from('marketplace_link_assets')
    .select('id, url, ownership_status')
    .eq('id', params.assetId)
    .eq('user_id', params.userId)
    .maybeSingle();

  if (error) throw new Error(`Actif illisible : ${error.message}`);
  if (!asset) throw new Error('Actif introuvable');

  if (params.optIn) {
    if (asset.ownership_status !== 'verified') {
      throw new Error('Propriété du domaine non vérifiée : mise en vente impossible');
    }

    const { data: tax } = await sb
      .from('marketplace_tax_profiles')
      .select('is_complete')
      .eq('user_id', params.userId)
      .maybeSingle();
    if (!tax?.is_complete) throw new Error('Profil fiscal incomplet : mise en vente impossible');

    const { data: risk } = await sb
      .from('marketplace_page_sell_risk')
      .select('risk_class, hard_exclusion_reason')
      .eq('user_id', params.userId)
      .eq('url', asset.url)
      .maybeSingle();
    if (!risk) throw new Error('Risque de vente non calculé pour cette page');
    if (risk.hard_exclusion_reason) throw new Error(risk.hard_exclusion_reason);
    if (risk.risk_class === 'discouraged') {
      throw new Error('Page déconseillée à la vente : mise en vente bloquée');
    }
  }

  const { error: upErr } = await sb
    .from('marketplace_link_assets')
    .update({
      opted_in: params.optIn,
      opted_in_at: params.optIn ? new Date().toISOString() : null,
      opt_in_terms_version: params.optIn ? params.termsVersion : null,
    })
    .eq('id', params.assetId)
    .eq('user_id', params.userId);

  if (upErr) throw new Error(`Mise à jour impossible : ${upErr.message}`);
  return { opted_in: params.optIn };
}
