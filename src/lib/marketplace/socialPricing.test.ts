import { describe, expect, it } from 'vitest';
import {
  computeSocialPrice,
  computeSocialPrices,
  detectSocialFraud,
  hasComplianceMention,
  interpolate,
  tierForPrice,
  type SocialMetrics,
  type SocialPricingConstants,
} from './socialPricing';

const C: SocialPricingConstants = {
  version: 1,
  base_format: { feed: 8000, reel: 10000, story: 5000, linkedin_post: 9000 },
  curve_f: { points: [[0, 0.4], [1000, 1], [10000, 1.8], [100000, 2.5]] },
  curve_g: { points: [[0, 0.5], [0.02, 1], [0.06, 1.4], [0.12, 1.6]] },
  curve_h: { points: [[0, 0.5], [0.5, 1], [1, 1.4]] },
  curve_k: { points: [[0, 0.7], [0.5, 1], [1, 1.2]] },
  fraud: {
    engagement_rate_min: 0.005,
    engagement_rate_max: 0.25,
    follower_step_max_ratio: 0.5,
    foreign_audience_max_ratio: 0.6,
    reach_follower_max_ratio: 3,
  },
  min_metrics_days: 28,
  floor_cents: 4000,
  cap_cents: 35000,
  rounding_cents: 1000,
  tiers: { P1: 4000, P2: 8000, P3: 15000, P4: 25000, P5: 32000 },
};

const base: SocialMetrics = {
  followers: 12000,
  reach_avg: 4000,
  impressions_avg: 6000,
  engagement_rate: 0.03,
  follower_history: [11000, 11500, 12000],
  audience_geo: { FR: 0.8, BE: 0.2 },
  creative_quality: 0.6,
  metrics_days: 30,
};

describe('interpolate', () => {
  it('borne aux extrémités de la courbe', () => {
    expect(interpolate(C.curve_f, -50)).toBe(0.4);
    expect(interpolate(C.curve_f, 500000)).toBe(2.5);
  });

  it('interpole linéairement entre deux points', () => {
    expect(interpolate(C.curve_h, 0.25)).toBeCloseTo(0.75, 5);
  });
});

describe('detectSocialFraud', () => {
  it('ne signale rien sur un compte plausible', () => {
    expect(detectSocialFraud(base, C)).toEqual([]);
  });

  it('signale un engagement hors bornes', () => {
    expect(detectSocialFraud({ ...base, engagement_rate: 0.4 }, C).length).toBeGreaterThan(0);
    expect(detectSocialFraud({ ...base, engagement_rate: 0.001 }, C).length).toBeGreaterThan(0);
  });

  it('signale une portée disproportionnée', () => {
    expect(detectSocialFraud({ ...base, reach_avg: 60000 }, C)).toContain(
      'portée disproportionnée par rapport aux abonnés',
    );
  });

  it('signale un escalier de followers', () => {
    const flags = detectSocialFraud({ ...base, follower_history: [1000, 5000, 5200] }, C);
    expect(flags.some((f) => f.includes('escalier'))).toBe(true);
  });

  it('signale une audience hors marché cible', () => {
    const flags = detectSocialFraud({ ...base, audience_geo: { FR: 0.2, US: 0.8 } }, C);
    expect(flags).toContain('audience majoritairement hors du marché cible');
  });
});

describe('computeSocialPrice', () => {
  it('est déterministe et borné entre le plancher et le plafond', () => {
    const a = computeSocialPrice('feed', base, 0.6, C);
    const b = computeSocialPrice('feed', base, 0.6, C);
    expect(a.price_cents).toBe(b.price_cents);
    expect(a.vendable).toBe(true);
    expect(a.price_cents!).toBeGreaterThanOrEqual(C.floor_cents);
    expect(a.price_cents!).toBeLessThanOrEqual(C.cap_cents);
    expect(a.price_cents! % C.rounding_cents).toBe(0);
  });

  it('plafonne à 350 € un compte hors normes', () => {
    const res = computeSocialPrice(
      'reel',
      { ...base, followers: 900000, reach_avg: 400000, engagement_rate: 0.11 },
      1,
      C,
    );
    expect(res.price_cents).toBe(C.cap_cents);
    expect(res.tier).toBe('P5');
  });

  it('refuse la vente sous la borne de 40 € au lieu de vendre hors grille', () => {
    const res = computeSocialPrice(
      'story',
      { ...base, followers: 300, reach_avg: 40, engagement_rate: 0.006, creative_quality: 0 },
      0,
      C,
    );
    expect(res.vendable).toBe(false);
    expect(res.price_cents).toBeNull();
    expect(res.reason).toContain('40');
  });

  it('refuse la vente quand l\u2019historique de métriques est trop court', () => {
    const res = computeSocialPrice('feed', { ...base, metrics_days: 10 }, 0.6, C);
    expect(res.vendable).toBe(false);
    expect(res.reason).toContain('28');
  });

  it('écarte un compte dont l\u2019anti-fraude a levé un signal', () => {
    const res = computeSocialPrice('feed', { ...base, engagement_rate: 0.5 }, 0.6, C);
    expect(res.vendable).toBe(false);
    expect(res.fraud_flags.length).toBeGreaterThan(0);
  });

  it('conserve l\u2019explicabilité du calcul', () => {
    const res = computeSocialPrice('feed', base, 0.6, C);
    expect(res.breakdown.base_cents).toBe(C.base_format.feed);
    const expected = res.breakdown.base_cents
      * res.breakdown.f_reach
      * res.breakdown.g_engagement
      * res.breakdown.h_affinity
      * res.breakdown.k_creative;
    expect(res.breakdown.raw_cents).toBeCloseTo(expected, 0);
    expect(res.constants_version).toBe(1);
  });

  it('valorise un reel au moins autant qu\u2019une story', () => {
    const reel = computeSocialPrice('reel', base, 0.6, C);
    const story = computeSocialPrice('story', base, 0.6, C);
    expect(reel.price_cents!).toBeGreaterThanOrEqual(story.price_cents ?? 0);
  });
});

describe('tierForPrice', () => {
  it('classe le prix dans le palier atteint', () => {
    expect(tierForPrice(4000, C.tiers)).toBe('P1');
    expect(tierForPrice(15000, C.tiers)).toBe('P3');
    expect(tierForPrice(34000, C.tiers)).toBe('P5');
  });
});

describe('computeSocialPrices', () => {
  it('tarife chaque format déclaré', () => {
    const res = computeSocialPrices(['feed', 'reel', 'story'], base, 0.6, C);
    expect(res.map((r) => r.format)).toEqual(['feed', 'reel', 'story']);
  });
});

describe('hasComplianceMention', () => {
  it('reconnaît les mentions accentuées ou en majuscules', () => {
    const tags = ['#pub', '#sponso', 'partenariat remunere'];
    expect(hasComplianceMention('Super produit #PUB', tags)).toBe(true);
    expect(hasComplianceMention('Partenariat rémunéré avec la marque', tags)).toBe(true);
    expect(hasComplianceMention('Un avis totalement libre', tags)).toBe(false);
  });
});
