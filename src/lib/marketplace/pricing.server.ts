/**
 * pricing.server.ts (L1a.9)
 *
 * Pricing 100 % déterministe, sans appel LLM (§2.1) :
 *   score global = Σ(poids × score normalisé 0–1)
 *   → palier P1–P5 par seuils versionnés
 *   → prix = palier, arrondi au multiple de 10 €, borné 40–350 €.
 *
 * P5 exige un actif vérifié, ≥ 90 j de signaux GSC et un sell_risk « safe » ;
 * sinon le moteur redescend à P4 en journalisant le motif.
 */

import { loadConstants, num, obj, type MarketplaceConstants } from './constants.server';
import {
  CLICK_BUCKETS,
  IMPRESSION_BUCKETS,
  POSITION_BUCKETS,
  type AssetScores,
  type PriceTier,
  type PricingResult,
  type SellRiskClass,
} from './types';

const TIER_ORDER: PriceTier[] = ['P1', 'P2', 'P3', 'P4', 'P5'];

export interface PricingContext {
  ownership_status?: 'verified' | 'unverified' | 'revoked';
  gsc_signal_days?: number;
  risk_class?: SellRiskClass | null;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Score global pondéré, sur 0–1. */
export function computeGlobalScore(scores: AssetScores, c: MarketplaceConstants): number {
  const w = obj<Record<string, number>>(c, 'pricing_weights');
  const total =
    w.authority * clamp01((scores.authority_score ?? 0) / 100) +
    w.semantic * clamp01((scores.semantic_score ?? 0) / 100) +
    w.traffic * clamp01((scores.traffic_score ?? 0) / 100) +
    w.quality * clamp01((scores.quality_score ?? 0) / 100) +
    w.ai_visibility * clamp01((scores.ai_visibility_score ?? 0) / 100);
  const weightSum = w.authority + w.semantic + w.traffic + w.quality + w.ai_visibility;
  return clamp01(weightSum > 0 ? total / weightSum : 0);
}

/** Mapping score → palier par seuils versionnés (borne inférieure incluse). */
export function tierForScore(globalScore: number, c: MarketplaceConstants): PriceTier {
  const th = obj<Record<string, number>>(c, 'tier_thresholds');
  if (globalScore >= th.P5) return 'P5';
  if (globalScore >= th.P4) return 'P4';
  if (globalScore >= th.P3) return 'P3';
  if (globalScore >= th.P2) return 'P2';
  return 'P1';
}

export function priceForTier(tier: PriceTier, c: MarketplaceConstants): number {
  const tiers = obj<Record<string, number>>(c, 'tiers');
  const floor = num(c, 'price_floor_cents');
  const cap = num(c, 'price_cap_cents');
  const rounding = num(c, 'price_rounding_cents');
  const raw = tiers[tier];
  const rounded = Math.round(raw / rounding) * rounding;
  return Math.min(cap, Math.max(floor, rounded));
}

/** Applique les conditions restrictives du palier P5 (§2.1). */
export function applyTierGuards(tier: PriceTier, ctx: PricingContext, c: MarketplaceConstants): {
  tier: PriceTier;
  reason: string | null;
} {
  if (tier !== 'P5') return { tier, reason: null };
  const minDays = num(c, 'p5_min_signal_days');
  if (ctx.ownership_status !== 'verified') {
    return { tier: 'P4', reason: 'P5 refusé : propriété non vérifiée' };
  }
  if ((ctx.gsc_signal_days ?? 0) < minDays) {
    return { tier: 'P4', reason: `P5 refusé : moins de ${minDays} jours de signaux GSC` };
  }
  if (ctx.risk_class && ctx.risk_class !== 'safe') {
    return { tier: 'P4', reason: 'P5 refusé : risque de vente non « sûr »' };
  }
  return { tier, reason: null };
}

export function computePricingWith(
  scores: AssetScores,
  ctx: PricingContext,
  c: MarketplaceConstants,
): PricingResult {
  const globalScore = computeGlobalScore(scores, c);
  const guarded = applyTierGuards(tierForScore(globalScore, c), ctx, c);
  return {
    global_score: Number(globalScore.toFixed(4)),
    tier: guarded.tier,
    price_cents: priceForTier(guarded.tier, c),
    constants_version: c.version,
    downgrade_reason: guarded.reason,
  };
}

export async function computePricing(scores: AssetScores, ctx: PricingContext = {}): Promise<PricingResult> {
  return computePricingWith(scores, ctx, await loadConstants());
}

export function tierIndex(tier: PriceTier): number {
  return TIER_ORDER.indexOf(tier);
}

// ─── Fourchettes exposables (§2.1.1) ────────────────────────────────
// Conversion serveur uniquement : la première classe de clics n'est jamais
// rendue sous forme numérique (0 et 1-10 fusionnés).

export function clicksBucket(clicks: number | null | undefined): string {
  const v = clicks ?? 0;
  if (v <= 10) return CLICK_BUCKETS[0];
  if (v <= 50) return CLICK_BUCKETS[1];
  if (v <= 200) return CLICK_BUCKETS[2];
  if (v <= 1000) return CLICK_BUCKETS[3];
  if (v <= 5000) return CLICK_BUCKETS[4];
  return CLICK_BUCKETS[5];
}

export function impressionsBucket(impressions: number | null | undefined): string {
  const v = impressions ?? 0;
  if (v <= 100) return IMPRESSION_BUCKETS[0];
  if (v <= 1000) return IMPRESSION_BUCKETS[1];
  if (v <= 10000) return IMPRESSION_BUCKETS[2];
  if (v <= 50000) return IMPRESSION_BUCKETS[3];
  if (v <= 250000) return IMPRESSION_BUCKETS[4];
  return IMPRESSION_BUCKETS[5];
}

export function positionBucket(position: number | null | undefined): string {
  const v = position ?? 99;
  if (v <= 3) return POSITION_BUCKETS[0];
  if (v <= 10) return POSITION_BUCKETS[1];
  if (v <= 20) return POSITION_BUCKETS[2];
  return POSITION_BUCKETS[3];
}

/** Tendance grossière : jamais de courbe exposée, seulement hausse/stable/baisse. */
export function trafficTrend(previousClicks: number | null, currentClicks: number | null): 'hausse' | 'stable' | 'baisse' {
  const prev = previousClicks ?? 0;
  const cur = currentClicks ?? 0;
  if (prev === 0 && cur === 0) return 'stable';
  const delta = prev === 0 ? 1 : (cur - prev) / prev;
  if (delta >= 0.15) return 'hausse';
  if (delta <= -0.15) return 'baisse';
  return 'stable';
}
