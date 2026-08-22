import { describe, expect, it } from 'vitest';
import {
  clicksBucket,
  computeGlobalScore,
  computePricingWith,
  priceForTier,
  tierForScore,
} from './pricing.server';
import { computeSellRiskWith } from './sellRisk.server';
import { evaluateCapsWith } from './caps.server';
import { decideAttributeWith } from './attribute.server';
import type { MarketplaceConstants } from './constants.server';

const C: MarketplaceConstants = {
  version: 1,
  values: {
    pricing_weights: { authority: 0.3, semantic: 0.25, traffic: 0.2, quality: 0.15, ai_visibility: 0.1 },
    tier_thresholds: { P2: 0.35, P3: 0.55, P4: 0.72, P5: 0.88 },
    tiers: { P1: 4000, P2: 9000, P3: 15000, P4: 25000, P5: 35000 },
    price_floor_cents: 4000,
    price_cap_cents: 35000,
    price_rounding_cents: 1000,
    p5_min_signal_days: 90,
    sell_risk_weights: {
      strategic: 0.3,
      internal_dependency: 0.25,
      gsc_momentum: 0.2,
      outbound_saturation: 0.15,
      technical_fragility: 0.1,
    },
    sell_risk_safe_max: 0.2,
    sell_risk_eligible_max: 0.35,
    caps: { dofollow_per_page_lifetime: 1, dofollow_per_domain_12m: 20, insertions_per_page_12m: 3 },
    dofollow_min_tier: 'P3',
  },
};

describe('pricing', () => {
  it('borne le prix entre 40 et 350 €', () => {
    for (const tier of ['P1', 'P2', 'P3', 'P4', 'P5'] as const) {
      const price = priceForTier(tier, C);
      expect(price).toBeGreaterThanOrEqual(4000);
      expect(price).toBeLessThanOrEqual(35000);
      expect(price % 1000).toBe(0);
    }
  });

  it('mappe les scores extrêmes sur P1 et P5', () => {
    expect(tierForScore(0, C)).toBe('P1');
    expect(tierForScore(1, C)).toBe('P5');
  });

  it('refuse P5 sans propriété vérifiée ni historique suffisant', () => {
    const scores = {
      authority_score: 100,
      semantic_score: 100,
      traffic_score: 100,
      quality_score: 100,
      ai_visibility_score: 100,
    };
    expect(computeGlobalScore(scores, C)).toBe(1);

    const refused = computePricingWith(scores, { ownership_status: 'unverified' }, C);
    expect(refused.tier).toBe('P4');
    expect(refused.downgrade_reason).toContain('propriété');

    const granted = computePricingWith(
      scores,
      { ownership_status: 'verified', gsc_signal_days: 120, risk_class: 'safe' },
      C,
    );
    expect(granted.tier).toBe('P5');
    expect(granted.price_cents).toBe(35000);
  });

  it('ne dévoile jamais un trafic faible sous forme chiffrée', () => {
    expect(clicksBucket(0)).toBe('trafic faible / non significatif');
    expect(clicksBucket(9)).toBe('trafic faible / non significatif');
    expect(clicksBucket(40)).toBe('11-50');
  });
});

describe('sell risk', () => {
  it('exclut durement une page pilier', () => {
    const result = computeSellRiskWith({ url: '/pilier', is_pillar: true, ownership_status: 'verified' }, C);
    expect(result.eligible).toBe(false);
    expect(result.risk_class).toBe('discouraged');
    expect(result.hard_exclusion_reason).toContain('pilier');
  });

  it('classe une page saine comme sûre', () => {
    const result = computeSellRiskWith(
      {
        url: '/article',
        internal_pagerank_share: 0.05,
        gsc_momentum: 0.1,
        outbound_external_links: 1,
        is_indexed: true,
        age_days: 400,
        ownership_status: 'verified',
      },
      C,
    );
    expect(result.sell_risk).toBeLessThanOrEqual(0.2);
    expect(result.risk_class).toBe('safe');
    expect(result.eligible).toBe(true);
  });
});

describe('caps et attribut', () => {
  const freeCaps = evaluateCapsWith(
    { dofollow_page_lifetime_used: 0, dofollow_domain_12m_used: 0, insertions_page_12m_used: 0 },
    C,
  );

  it('bloque un second dofollow sur la même page à vie', () => {
    const used = evaluateCapsWith(
      { dofollow_page_lifetime_used: 1, dofollow_domain_12m_used: 1, insertions_page_12m_used: 1 },
      C,
    );
    expect(used.dofollow_available).toBe(false);
    expect(used.insertion_available).toBe(true);
  });

  it('accorde dofollow seulement si besoin et capacité convergent', () => {
    const granted = decideAttributeWith(
      {
        buyer_objective: 'authority',
        buyer_authority_deficit: 120,
        placement: 'editorial',
        seller_sell_risk: 0.1,
        seller_tier: 'P4',
        caps: freeCaps,
      },
      C,
    );
    expect(granted.attribute).toBe('dofollow');

    const noNeed = decideAttributeWith(
      {
        buyer_objective: 'brand',
        buyer_authority_deficit: 120,
        placement: 'editorial',
        seller_sell_risk: 0.1,
        seller_tier: 'P4',
        caps: freeCaps,
      },
      C,
    );
    expect(noNeed.attribute).toBe('sponsored');

    const riskyTier = decideAttributeWith(
      {
        buyer_objective: 'authority',
        buyer_authority_deficit: 120,
        placement: 'editorial',
        seller_sell_risk: 0.3,
        seller_tier: 'P2',
        caps: freeCaps,
      },
      C,
    );
    expect(riskyTier.attribute).toBe('sponsored');
  });

  it('respecte le veto vendeur et impose nofollow hors éditorial', () => {
    const veto = decideAttributeWith(
      {
        buyer_objective: 'authority',
        buyer_authority_deficit: 50,
        placement: 'editorial',
        seller_sell_risk: 0.1,
        seller_tier: 'P3',
        caps: freeCaps,
        seller_veto_dofollow: true,
      },
      C,
    );
    expect(veto.attribute).toBe('sponsored');

    const profile = decideAttributeWith(
      {
        buyer_objective: 'authority',
        buyer_authority_deficit: 50,
        placement: 'profile',
        seller_sell_risk: 0.1,
        seller_tier: 'P3',
        caps: freeCaps,
      },
      C,
    );
    expect(profile.attribute).toBe('nofollow');
  });
});
