import { describe, it, expect } from 'vitest';
import { observeLink, isJsShell, decideVerdict, nextCheckAt, nextLegState } from './verification.server';
import { computeProrataRefund } from './refunds.server';
import { amortizedValue, computeBalanceFromEvents, computePriority } from './balance.server';

const schedule = { first: 1, second: 7, recurring: 30 };
const filler = '<p>' + 'mot '.repeat(300) + '</p>';

describe('observeLink', () => {
  it('lit l’attribut réel du lien attendu', () => {
    const html = `${filler}<a href="https://exemple.fr/page/" rel="nofollow ugc">ancre test</a>`;
    const obs = observeLink(html, 'https://www.exemple.fr/page');
    expect(obs.present).toBe(true);
    expect(obs.attribute).toBe('nofollow');
    expect(obs.anchor).toBe('ancre test');
  });

  it('ne confond pas un autre lien du même domaine', () => {
    const obs = observeLink(`${filler}<a href="https://exemple.fr/autre">x</a>`, 'https://exemple.fr/page');
    expect(obs.present).toBe(false);
  });
});

describe('isJsShell', () => {
  it('détecte une coquille JS', () => {
    expect(isJsShell('<html><body><div id="root"></div><script src="a.js"></script></body></html>')).toBe(true);
  });
  it('accepte une page réellement rendue', () => {
    expect(isJsShell(filler)).toBe(false);
  });
});

describe('decideVerdict', () => {
  const base = {
    targetUrl: 'https://exemple.fr/page',
    expectedAttribute: 'dofollow' as const,
    consecutiveFailures: 0,
    softConfirmations: 2,
  };

  it('ne prononce jamais de rupture sur un blocage serveur', () => {
    const out = decideVerdict({ ...base, status: 403, html: '', escalated: true });
    expect(out.verdict).toBe('blocked');
  });

  it('ne prononce jamais de rupture sur une coquille JS', () => {
    const out = decideVerdict({ ...base, status: 200, html: '<div id="root"></div>', escalated: true });
    expect(out.verdict).toBe('inconclusive');
  });

  it('exige une escalade avant de conclure à l’absence du lien', () => {
    const out = decideVerdict({ ...base, status: 200, html: filler, escalated: false });
    expect(out.verdict).toBe('inconclusive');
  });

  it('conclut à la rupture sur page rendue sans le lien', () => {
    const out = decideVerdict({ ...base, status: 200, html: filler, escalated: true });
    expect(out.verdict).toBe('hard_broken');
  });

  it('sanctionne un dofollow dégradé en nofollow', () => {
    const html = `${filler}<a href="https://exemple.fr/page" rel="nofollow">a</a>`;
    const out = decideVerdict({ ...base, status: 200, html, escalated: true });
    expect(out.verdict).toBe('hard_broken');
  });

  it('valide un lien conforme', () => {
    const html = `${filler}<a href="https://exemple.fr/page">a</a>`;
    const out = decideVerdict({ ...base, status: 200, html, escalated: false });
    expect(out.verdict).toBe('ok');
  });
});

describe('calendrier et états', () => {
  it('planifie J+1 puis J+7 puis mensuel', () => {
    const published = new Date('2026-01-01T00:00:00Z');
    expect(nextCheckAt(published, new Date('2026-01-01T06:00:00Z'), schedule).toISOString()).toContain('2026-01-02');
    expect(nextCheckAt(published, new Date('2026-01-03T00:00:00Z'), schedule).toISOString()).toContain('2026-01-08');
    const late = nextCheckAt(published, new Date('2026-02-01T00:00:00Z'), schedule);
    expect(late.getTime()).toBeGreaterThan(new Date('2026-03-01T00:00:00Z').getTime() - 86_400_000);
  });

  it('conserve l’état sur verdict instable', () => {
    expect(nextLegState('verified', 'blocked', 3, schedule)).toBe('verified');
    expect(nextLegState('broken', 'inconclusive', 40, schedule)).toBe('broken');
    expect(nextLegState('broken', 'ok', 40, schedule)).toBe('maintained');
    expect(nextLegState('refunded', 'ok', 40, schedule)).toBe('refunded');
  });
});

describe('remboursement au prorata', () => {
  it('rembourse la fraction non servie, commission incluse', () => {
    const out = computeProrataRefund({
      price_cents: 12_000,
      commission_cents: 1_800,
      commitment_months: 12,
      published_at: new Date('2026-01-01T00:00:00Z'),
      broken_at: new Date('2026-07-01T00:00:00Z'),
    });
    expect(out.refund_cents).toBeGreaterThan(5_000);
    expect(out.refund_cents).toBeLessThan(7_000);
    expect(out.commission_refund_cents).toBeGreaterThan(700);
  });

  it('ne rembourse rien après l’engagement complet', () => {
    const out = computeProrataRefund({
      price_cents: 12_000,
      commission_cents: 1_800,
      commitment_months: 6,
      published_at: new Date('2025-01-01T00:00:00Z'),
      broken_at: new Date('2026-01-01T00:00:00Z'),
    });
    expect(out.refund_cents).toBe(0);
  });
});

describe('balance d’autorité', () => {
  it('amortit linéairement sur 24 mois', () => {
    const occurred = new Date('2025-02-20T00:00:00Z');
    const now = new Date('2026-02-20T00:00:00Z');
    const value = amortizedValue(10_000, occurred, now, 24);
    expect(value).toBeGreaterThan(4_000);
    expect(value).toBeLessThan(6_000);
  });

  it('rend un site cédant prioritaire à l’achat', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const balance = computeBalanceFromEvents(
      [
        { direction: 'given', currency_kind: 'link', value_cents: 20_000, occurred_at: now.toISOString(), reversal_of: null },
        { direction: 'received', currency_kind: 'story', value_cents: 8_000, occurred_at: now.toISOString(), reversal_of: null },
      ],
      now,
      24,
    );
    expect(balance.authority_balance_cents).toBe(-20_000);
    expect(balance.visibility_balance_cents).toBe(8_000);
    expect(balance.buyer_priority_score).toBe(200);
    expect(balance.can_sell_link).toBe(true);
  });

  it('bloque la vente d’un site trop déficitaire', () => {
    const now = new Date();
    const balance = computeBalanceFromEvents(
      [{ direction: 'given', currency_kind: 'link', value_cents: 30_000, occurred_at: now.toISOString(), reversal_of: null }],
      now,
      24,
    );
    expect(balance.can_sell_link).toBe(false);
  });

  it('classe la file par déficit puis gravité', () => {
    const high = computePriority({ deficit_cents: 30_000, need_score: 40, unserved_days: 10, unserved_threshold_days: 90 });
    const low = computePriority({ deficit_cents: 0, need_score: 80, unserved_days: 0, unserved_threshold_days: 90 });
    expect(high).toBeGreaterThan(low);
  });
});
