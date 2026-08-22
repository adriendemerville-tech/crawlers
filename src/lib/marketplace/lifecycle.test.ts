import { describe, expect, it } from 'vitest';
import { chooseTradeType, reciprocityQuarter } from './barter.server';
import { roundsRemaining } from './revisions.server';
import { addBusinessDays, addBusinessHours, prorataRefundCents } from './disputes.server';
import { aggregateDac7, nextInvoiceNumber, seriesFor, vatFor } from './invoices.server';
import type { MarketplaceConstants } from './constants.server';

const constants: MarketplaceConstants = {
  version: 1,
  values: {
    revision_rounds_max: 3,
    vat_rate_fr: 0.2,
    invoice_series_prefix: 'CRW',
    link_chain_min_loop_length: 3,
  },
};

describe('troc (L3.3)', () => {
  it('préfère toujours la boucle à la réciprocité directe', () => {
    const chosen = chooseTradeType([{ loop: ['a.fr', 'b.fr'] }, { loop: ['a.fr', 'b.fr', 'c.fr'] }], 3);
    expect(chosen?.trade_type).toBe('link_chain');
  });

  it('ne retient la réciprocité directe qu’à défaut de boucle', () => {
    expect(chooseTradeType([{ loop: ['a.fr', 'b.fr'] }], 3)?.trade_type).toBe('link_for_link');
    expect(chooseTradeType([], 3)).toBeNull();
  });

  it('datant la réciprocité par trimestre civil', () => {
    expect(reciprocityQuarter(new Date('2026-08-22T00:00:00Z'))).toBe('2026-Q3');
    expect(reciprocityQuarter(new Date('2026-01-05T00:00:00Z'))).toBe('2026-Q1');
  });
});

describe('révisions (L3.7)', () => {
  it('borne le compteur partagé à trois tours', () => {
    expect(roundsRemaining(0, constants)).toBe(3);
    expect(roundsRemaining(3, constants)).toBe(0);
    expect(roundsRemaining(5, constants)).toBe(0);
  });
});

describe('litiges (L3.8)', () => {
  it('compte les délais en jours et heures ouvrés', () => {
    // vendredi 21 août 2026 + 5 jours ouvrés = vendredi 28
    expect(addBusinessDays(new Date('2026-08-21T09:00:00Z'), 5).getUTCDate()).toBe(28);
    expect(addBusinessHours(new Date('2026-08-21T09:00:00Z'), 24).getUTCDay()).not.toBe(0);
  });

  it('rembourse au prorata de la part d’engagement non servie', () => {
    const refund = prorataRefundCents({
      priceCents: 12000,
      publishedAt: '2026-01-01T00:00:00Z',
      commitmentEndsAt: '2027-01-01T00:00:00Z',
      brokenAt: new Date('2026-07-02T00:00:00Z'),
    });
    expect(refund).toBeGreaterThan(5500);
    expect(refund).toBeLessThan(6500);
  });

  it('rembourse tout quand rien n’a été publié', () => {
    expect(
      prorataRefundCents({ priceCents: 9000, publishedAt: null, commitmentEndsAt: null, brokenAt: new Date() }),
    ).toBe(9000);
  });
});

describe('facturation (L3.5)', () => {
  it('numérote sans trou par série', () => {
    expect(nextInvoiceNumber([])).toBe(1);
    expect(nextInvoiceNumber([1, 2, 7])).toBe(8);
  });

  it('applique la TVA française aux seuls assujettis', () => {
    expect(vatFor(10000, { tax_status: 'company_vat', country_code: 'FR', vat_number: 'FR123' }, constants).vat_cents).toBe(2000);
    expect(vatFor(10000, { tax_status: 'micro', country_code: 'FR', vat_number: null }, constants).vat_cents).toBe(0);
    expect(vatFor(10000, { tax_status: 'company_vat', country_code: 'BE', vat_number: 'BE1' }, constants).vat_cents).toBe(0);
  });

  it('sérialise les pièces par nature et par année', () => {
    expect(seriesFor('commission', new Date('2026-05-01T00:00:00Z'), constants)).toBe('CRW-COMMISSION-2026');
  });

  it('agrège l’export DAC7 sur les jambes déclarables', () => {
    const lines = aggregateDac7(
      [
        { issuer_id: 's1', recipient_id: 'b', amount_cents: 12000, kind: 'self_billing', dac7_reportable: true },
        { issuer_id: 's1', recipient_id: 'b', amount_cents: 3000, kind: 'soulte', dac7_reportable: true },
        { issuer_id: 's1', recipient_id: 's1', amount_cents: 1800, kind: 'commission', dac7_reportable: false },
      ],
      { s1: { legal_name: 'Studio S', country_code: 'FR' } },
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]!.transactions).toBe(2);
    expect(lines[0]!.gross_cents).toBe(15000);
    expect(lines[0]!.legal_name).toBe('Studio S');
  });
});
