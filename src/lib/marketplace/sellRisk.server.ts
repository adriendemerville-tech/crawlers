/**
 * sellRisk.server.ts (L1a.10)
 *
 * Coût d'autorité d'une vente de lien (§2.12), déterministe :
 *   sell_risk = 0.30 poids_stratégique + 0.25 dépendance_interne
 *             + 0.20 momentum_GSC + 0.15 saturation_sortante
 *             + 0.10 fragilité_technique
 *
 * Classes : sûr ≤ 0.20 · modéré ≤ 0.35 · déconseillé > 0.35 (opt-in bloqué).
 * Les exclusions dures ne dépendent pas du score.
 */

import { loadConstants, num, obj, type MarketplaceConstants } from './constants.server';
import type { SellRiskComponents, SellRiskResult, SellRiskClass } from './types';

export interface SellRiskInput {
  url: string;
  /** Page pilier d'un des 4 silos. */
  is_pillar?: boolean;
  /** Page de conversion (devis, tarifs, contact) ou page money. */
  is_conversion?: boolean;
  /** Part du PageRank interne transitant par la page, 0–1. */
  internal_pagerank_share?: number;
  /** Progression récente de positions / impressions, 0–1. */
  gsc_momentum?: number;
  /** Liens externes déjà présents sur la page, toutes insertions confondues. */
  outbound_external_links?: number;
  /** Page thin, non indexée, instable ou récente. */
  is_thin?: boolean;
  is_indexed?: boolean;
  age_days?: number;
  /** Surveillance Drop Detector ou pruning/consolidation en cours. */
  under_drop_watch?: boolean;
  in_pruning_queue?: boolean;
  /** Page produite par l'agent SEO (moins de 90 j = historique insuffisant). */
  agent_generated_age_days?: number | null;
  ownership_status?: 'verified' | 'unverified' | 'revoked';
}

function clamp01(v: number | undefined): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

export function hardExclusion(input: SellRiskInput): string | null {
  if (input.is_pillar) return 'Page pilier de silo : cession interdite';
  if (input.is_conversion) return 'Page de conversion : cession interdite';
  if (input.under_drop_watch) return 'Page sous surveillance du Drop Detector';
  if (input.in_pruning_queue) return 'Page en cours de pruning ou de consolidation';
  if (typeof input.agent_generated_age_days === 'number' && input.agent_generated_age_days < 90) {
    return 'Page générée par l’agent SEO depuis moins de 90 jours';
  }
  if (input.ownership_status !== 'verified') return 'Propriété du domaine non vérifiée';
  return null;
}

function technicalFragility(input: SellRiskInput): number {
  let score = 0;
  if (input.is_thin) score += 0.4;
  if (input.is_indexed === false) score += 0.4;
  if ((input.age_days ?? 999) < 90) score += 0.2;
  return clamp01(score);
}

function outboundSaturation(input: SellRiskInput): number {
  // 0 lien sortant = 0 ; saturation atteinte à 10 liens externes.
  return clamp01((input.outbound_external_links ?? 0) / 10);
}

export function computeSellRiskWith(input: SellRiskInput, c: MarketplaceConstants): SellRiskResult {
  const w = obj<Record<string, number>>(c, 'sell_risk_weights');
  const safeMax = num(c, 'sell_risk_safe_max');
  const eligibleMax = num(c, 'sell_risk_eligible_max');

  const components: SellRiskComponents = {
    strategic: input.is_pillar || input.is_conversion ? 1 : clamp01(input.internal_pagerank_share) * 0.5,
    internal_dependency: clamp01(input.internal_pagerank_share),
    gsc_momentum: clamp01(input.gsc_momentum),
    outbound_saturation: outboundSaturation(input),
    technical_fragility: technicalFragility(input),
  };

  const raw =
    w.strategic * components.strategic +
    w.internal_dependency * components.internal_dependency +
    w.gsc_momentum * components.gsc_momentum +
    w.outbound_saturation * components.outbound_saturation +
    w.technical_fragility * components.technical_fragility;

  const sellRisk = Number(clamp01(raw).toFixed(3));
  const exclusion = hardExclusion(input);

  let riskClass: SellRiskClass = 'safe';
  if (sellRisk > eligibleMax) riskClass = 'discouraged';
  else if (sellRisk > safeMax) riskClass = 'moderate';
  if (exclusion) riskClass = 'discouraged';

  return {
    sell_risk: sellRisk,
    risk_class: riskClass,
    components,
    hard_exclusion_reason: exclusion,
    eligible: !exclusion && riskClass !== 'discouraged',
    constants_version: c.version,
  };
}

export async function computeSellRisk(input: SellRiskInput): Promise<SellRiskResult> {
  return computeSellRiskWith(input, await loadConstants());
}

/** Motif lisible affiché côté vendeur. */
export function riskReason(result: SellRiskResult): string {
  if (result.hard_exclusion_reason) return result.hard_exclusion_reason;
  const parts: Array<[string, number]> = [
    ['poids stratégique', result.components.strategic],
    ['dépendance interne', result.components.internal_dependency],
    ['momentum GSC', result.components.gsc_momentum],
    ['liens sortants déjà présents', result.components.outbound_saturation],
    ['fragilité technique', result.components.technical_fragility],
  ];
  const top = parts.sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] === 0) return 'Aucun facteur de risque significatif';
  return `Facteur dominant : ${top[0]}`;
}

/** Écrit le cache `marketplace_page_sell_risk` (recalcul à chaque crawl). */
export async function persistSellRisk(
  sb: { from: (t: string) => any },
  params: { userId: string; domain: string; url: string; result: SellRiskResult },
): Promise<void> {
  const { error } = await sb.from('marketplace_page_sell_risk').upsert(
    {
      user_id: params.userId,
      domain: params.domain,
      url: params.url,
      sell_risk: params.result.sell_risk,
      risk_class: params.result.risk_class,
      components: params.result.components,
      hard_exclusion_reason: params.result.hard_exclusion_reason,
      constants_version: params.result.constants_version,
      recomputed_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,url' },
  );
  if (error) throw new Error(`Écriture du risque de vente impossible : ${error.message}`);
}
