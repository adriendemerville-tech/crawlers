import { describe, expect, it } from 'vitest';
import { evaluateBuyerLimitsWith, countersFrom } from './buyerLimits.server';
import type { MarketplaceConstants } from './constants.server';

const constants: MarketplaceConstants = {
  version: 1,
  values: {
    buyer_limits: {
      links_per_7d: 2,
      links_per_30d: 4,
      per_seller_12m: 2,
      same_target_url_12m: 2,
      exact_anchor_max_ratio: 0.3,
      topical_coherence_min: 0.35,
    },
    match_min_score: 0.35,
  },
};

function leg(daysAgo: number, extra: Record<string, unknown> = {}) {
  return {
    occurred_at: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
    currency_kind: 'link',
    direction: 'in',
    leg: 'buy',
    site_domain: 'vendeur.fr',
    metadata: { seller_domain: 'vendeur.fr', target_url: 'https://acheteur.fr/a', ...extra },
  };
}

describe('garde-fous acheteur', () => {
  it('autorise l’achat sans historique', () => {
    const s = evaluateBuyerLimitsWith([], constants);
    expect(s.purchase_allowed).toBe(true);
    expect(s.throttle_reason).toBeNull();
    expect(s.buy_risk).toBe(0);
  });

  it('bride au-delà de 2 liens sur 7 jours glissants', () => {
    const s = evaluateBuyerLimitsWith([leg(1), leg(3)], constants);
    expect(s.purchase_allowed).toBe(false);
    expect(s.throttle_reason).toContain('7 jours');
    expect(s.next_allowed_at).not.toBeNull();
  });

  it('bride au-delà de 4 liens sur 30 jours glissants', () => {
    const s = evaluateBuyerLimitsWith([leg(10), leg(15), leg(20), leg(25)], constants);
    expect(s.links_7d).toBe(0);
    expect(s.purchase_allowed).toBe(false);
    expect(s.throttle_reason).toContain('30 jours');
  });

  it('bride un ratio d’ancres exactes trop élevé', () => {
    const s = evaluateBuyerLimitsWith(
      [leg(40, { anchor_kind: 'exact' }), leg(60, { anchor_kind: 'exact' }), leg(80)],
      constants,
    );
    expect(s.exact_anchor_ratio).toBeGreaterThan(0.3);
    expect(s.purchase_allowed).toBe(false);
  });

  it('ignore les jambes sortantes et hors fenêtre', () => {
    const out = { ...leg(2), direction: 'out' };
    const old = leg(400);
    const s = evaluateBuyerLimitsWith([out, old], constants);
    expect(s.links_30d).toBe(0);
    expect(s.purchase_allowed).toBe(true);
  });

  it('compte les jambes par vendeur et par page cible sur 12 mois', () => {
    const c = countersFrom([leg(5), leg(200), { ...leg(400) }]);
    expect(c.perSeller['vendeur.fr']).toBe(2);
    expect(c.perTarget['https://acheteur.fr/a']).toBe(2);
  });
});
