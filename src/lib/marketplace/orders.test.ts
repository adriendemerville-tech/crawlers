import { describe, expect, it } from 'vitest';
import { computeEconomicsWith, legPublishDelayDays, tradeDiscount } from './commission.server';
import type { MarketplaceConstants } from './constants.server';

const constants: MarketplaceConstants = {
  version: 1,
  values: {
    commission_rate: 0.15,
    price_rounding_cents: 1000,
    credit_eur_rate: 0.01,
    link_for_link_discount: 0.7,
    link_for_link_delay_days: 21,
    link_chain_leg_delay_days: 7,
    commitment_months: { link: 12, linkedin: 1, story: 0 },
  },
};

describe('économie de commande (L3)', () => {
  it('prélève la commission sur le net vendeur en cash', () => {
    const e = computeEconomicsWith({ deal_type: 'cash', price_cents: 15000 }, constants);
    expect(e.commission_cents).toBe(2250);
    expect(e.seller_net_cents).toBe(12750);
    expect(e.soulte_cents).toBe(0);
    expect(e.commitment_months).toBe(12);
  });

  it('décote un échange réciproque de liens et diffère la jambe retour', () => {
    expect(tradeDiscount('link_for_link', constants)).toBe(0.7);
    expect(legPublishDelayDays('link_for_link', constants)).toBe(21);
    const e = computeEconomicsWith(
      { deal_type: 'barter', price_cents: 15000, counter_value_cents: 9000, trade_type: 'link_for_link' },
      constants,
    );
    expect(e.price_cents).toBe(11000);
    expect(e.soulte_cents).toBe(2000);
    expect(e.seller_net_cents).toBe(0);
  });

  it('convertit la commission en crédits quand ce support est choisi', () => {
    const e = computeEconomicsWith(
      { deal_type: 'barter', price_cents: 10000, counter_value_cents: 10000, commission_support: 'credits' },
      constants,
    );
    expect(e.commission_cents).toBe(1500);
    expect(e.commission_credits).toBe(1500);
    expect(e.soulte_cents).toBe(0);
  });

  it('applique la durée d’engagement propre à chaque devise', () => {
    expect(
      computeEconomicsWith({ deal_type: 'cash', price_cents: 9000, currency_kind: 'linkedin' }, constants)
        .commitment_months,
    ).toBe(1);
    expect(
      computeEconomicsWith({ deal_type: 'cash', price_cents: 9000, currency_kind: 'story' }, constants)
        .commitment_months,
    ).toBe(0);
  });

  it('arrondit la valeur au multiple de 10 € imposé par le schéma', () => {
    const e = computeEconomicsWith(
      { deal_type: 'barter', price_cents: 15000, counter_value_cents: 12345, trade_type: 'link_chain' },
      constants,
    );
    expect(e.price_cents % 1000).toBe(0);
    expect(e.soulte_cents % 1000).toBe(0);
    expect(legPublishDelayDays('link_chain', constants)).toBe(7);
  });
});
