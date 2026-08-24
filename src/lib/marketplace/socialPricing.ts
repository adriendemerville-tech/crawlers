/**
 * socialPricing.ts (L6.3) — tarification Collab, 100 % déterministe et client-safe.
 *
 *   prix_collab = base_format × f(reach moyen) × g(engagement réel)
 *               × h(affinité thématique) × k(qualité créative)
 *   prix_final  = palier(clamp(prix_collab, 40 €, 350 €))
 *
 * Aucun seuil n'est codé en dur : toutes les valeurs proviennent des constantes
 * versionnées (§2.15). Une valeur sous la borne basse rend l'actif non vendable
 * plutôt que vendu hors grille (§3).
 */

import type { PriceTier } from './types';

export type SocialFormat = 'feed' | 'reel' | 'story' | 'linkedin_post';

export interface CurvePoints {
  points: [number, number][];
}

export interface SocialFraudThresholds {
  engagement_rate_min: number;
  engagement_rate_max: number;
  follower_step_max_ratio: number;
  foreign_audience_max_ratio: number;
  reach_follower_max_ratio: number;
}

export interface SocialPricingConstants {
  version: number;
  base_format: Record<string, number>;
  curve_f: CurvePoints;
  curve_g: CurvePoints;
  curve_h: CurvePoints;
  curve_k: CurvePoints;
  fraud: SocialFraudThresholds;
  min_metrics_days: number;
  floor_cents: number;
  cap_cents: number;
  rounding_cents: number;
  tiers: Record<PriceTier, number>;
}

export interface SocialMetrics {
  followers: number | null;
  reach_avg: number | null;
  impressions_avg: number | null;
  /** Engagement réel : (likes + commentaires + partages + enregistrements) / reach. */
  engagement_rate: number | null;
  /** Historique de followers, du plus ancien au plus récent. */
  follower_history?: number[];
  /** Répartition d'audience par pays, en part de 0 à 1. */
  audience_geo?: Record<string, number>;
  /** Qualité créative observée, 0 à 1 (constance de format, complétion, alt/légendes). */
  creative_quality: number | null;
  /** Nombre de jours couverts par la fenêtre de métriques. */
  metrics_days: number;
}

export interface SocialPriceBreakdown {
  base_cents: number;
  f_reach: number;
  g_engagement: number;
  h_affinity: number;
  k_creative: number;
  raw_cents: number;
}

export interface SocialPriceResult {
  format: SocialFormat;
  price_cents: number | null;
  tier: PriceTier | null;
  vendable: boolean;
  reason: string | null;
  breakdown: SocialPriceBreakdown;
  fraud_flags: string[];
  constants_version: number;
}

const TIER_ORDER: PriceTier[] = ['P1', 'P2', 'P3', 'P4', 'P5'];

/** Interpolation linéaire bornée sur une courbe de points croissants. */
export function interpolate(curve: CurvePoints, x: number): number {
  const pts = [...(curve.points ?? [])].sort((a, b) => a[0] - b[0]);
  if (pts.length === 0) return 1;
  const v = Number.isFinite(x) ? x : 0;
  if (v <= pts[0][0]) return pts[0][1];
  const last = pts[pts.length - 1];
  if (v >= last[0]) return last[1];
  for (let i = 1; i < pts.length; i += 1) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (v <= x1) {
      const span = x1 - x0;
      if (span <= 0) return y1;
      return y0 + ((v - x0) / span) * (y1 - y0);
    }
  }
  return last[1];
}

/**
 * Anti-fraude Collab (§3) : reach acheté, escaliers de followers,
 * audience géographique incohérente avec la cible.
 */
export function detectSocialFraud(
  m: SocialMetrics,
  c: SocialPricingConstants,
  targetCountry = 'FR',
): string[] {
  const flags: string[] = [];
  const followers = m.followers ?? 0;
  const reach = m.reach_avg ?? 0;
  const er = m.engagement_rate ?? 0;

  if (followers > 0 && er > 0) {
    if (er < c.fraud.engagement_rate_min) flags.push('engagement anormalement bas (audience inactive ou achetée)');
    if (er > c.fraud.engagement_rate_max) flags.push('engagement hors bornes plausibles (engagement acheté suspecté)');
  }
  if (followers > 0 && reach / followers > c.fraud.reach_follower_max_ratio) {
    flags.push('portée disproportionnée par rapport aux abonnés');
  }

  const history = m.follower_history ?? [];
  for (let i = 1; i < history.length; i += 1) {
    const prev = history[i - 1];
    if (prev <= 0) continue;
    const step = (history[i] - prev) / prev;
    if (step > c.fraud.follower_step_max_ratio) {
      flags.push('progression de followers en escalier (achat d\u2019abonnés suspecté)');
      break;
    }
  }

  const geo = m.audience_geo ?? {};
  const total = Object.values(geo).reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
  if (total > 0) {
    const share = (geo[targetCountry] ?? 0) / total;
    if (1 - share > c.fraud.foreign_audience_max_ratio) {
      flags.push('audience majoritairement hors du marché cible');
    }
  }

  return flags;
}

/** Palier correspondant à un prix : le plus haut palier dont le prix reste atteint. */
export function tierForPrice(priceCents: number, tiers: Record<PriceTier, number>): PriceTier {
  let tier: PriceTier = 'P1';
  for (const t of TIER_ORDER) {
    if (priceCents >= tiers[t]) tier = t;
  }
  return tier;
}

export function computeSocialPrice(
  format: SocialFormat,
  metrics: SocialMetrics,
  affinity: number,
  c: SocialPricingConstants,
  options: { targetCountry?: string } = {},
): SocialPriceResult {
  const base = c.base_format[format] ?? c.base_format.feed ?? 0;
  const f = interpolate(c.curve_f, metrics.reach_avg ?? 0);
  const g = interpolate(c.curve_g, metrics.engagement_rate ?? 0);
  const h = interpolate(c.curve_h, Math.min(1, Math.max(0, affinity)));
  const k = interpolate(c.curve_k, Math.min(1, Math.max(0, metrics.creative_quality ?? 0.5)));
  const raw = base * f * g * h * k;

  const breakdown: SocialPriceBreakdown = {
    base_cents: base,
    f_reach: Number(f.toFixed(4)),
    g_engagement: Number(g.toFixed(4)),
    h_affinity: Number(h.toFixed(4)),
    k_creative: Number(k.toFixed(4)),
    raw_cents: Math.round(raw),
  };

  const fraudFlags = detectSocialFraud(metrics, c, options.targetCountry ?? 'FR');

  const reject = (reason: string): SocialPriceResult => ({
    format,
    price_cents: null,
    tier: null,
    vendable: false,
    reason,
    breakdown,
    fraud_flags: fraudFlags,
    constants_version: c.version,
  });

  if (metrics.metrics_days < c.min_metrics_days) {
    return reject(`métriques insuffisantes : ${c.min_metrics_days} jours d\u2019historique requis`);
  }
  if (fraudFlags.length > 0) {
    return reject(`compte écarté : ${fraudFlags[0]}`);
  }

  const rounded = Math.round(raw / c.rounding_cents) * c.rounding_cents;
  if (rounded < c.floor_cents) {
    return reject('valeur insuffisante : sous la borne de 40 €');
  }
  const price = Math.min(c.cap_cents, rounded);

  return {
    format,
    price_cents: price,
    tier: tierForPrice(price, c.tiers),
    vendable: true,
    reason: null,
    breakdown,
    fraud_flags: fraudFlags,
    constants_version: c.version,
  };
}

/** Tarification de tous les formats déclarés par le vendeur. */
export function computeSocialPrices(
  formats: SocialFormat[],
  metrics: SocialMetrics,
  affinity: number,
  c: SocialPricingConstants,
  options: { targetCountry?: string } = {},
): SocialPriceResult[] {
  return formats.map((format) => computeSocialPrice(format, metrics, affinity, c, options));
}

/** Mentions de conformité (ARPP/FTC) : au moins une doit figurer dans la légende. */
export function hasComplianceMention(caption: string, tags: string[]): boolean {
  const normalized = caption
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return tags.some((tag) => {
    const t = tag
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return normalized.includes(t);
  });
}
