/**
 * commission.server.ts (L3.3)
 *
 * Économie d'une commande, 100 % déterministe et sans appel LLM :
 *   - commission = taux versionné × valeur de l'emplacement, arrondie au centime ;
 *   - en cash, la commission est prélevée sur le net vendeur ;
 *   - en troc, chaque bénéficiaire de valeur règle sa commission (cash ou crédits) ;
 *   - la soulte comble l'écart de valeur entre les deux jambes ;
 *   - `link_for_link` est décoté par le facteur versionné et sa jambe retour
 *     ne peut être publiée qu'après le délai de non-réciprocité.
 *
 * Toute constante vient de `marketplace_pricing_constants` : aucun seuil en dur.
 */

import { loadConstants, num, obj, type MarketplaceConstants } from './constants.server';
import type {
  CurrencyKind,
  DealType,
  OrderEconomics,
  SettlementSupport,
  TradeType,
} from './orderTypes';

export interface EconomicsInput {
  deal_type: DealType;
  /** Valeur du palier de l'emplacement acheté (centimes). */
  price_cents: number;
  /** Valeur de la contrepartie offerte par l'acheteur en troc (centimes). */
  counter_value_cents?: number;
  trade_type?: TradeType;
  currency_kind?: CurrencyKind;
  commission_support?: SettlementSupport;
}

/** Décote appliquée à un échange de liens réciproque (§ troc). */
export function tradeDiscount(trade: TradeType | undefined, c: MarketplaceConstants): number {
  if (trade !== 'link_for_link') return 1;
  return num(c, 'link_for_link_discount');
}

/** Délai minimum avant publication de la jambe retour. */
export function legPublishDelayDays(trade: TradeType | undefined, c: MarketplaceConstants): number {
  if (trade === 'link_for_link') return num(c, 'link_for_link_delay_days');
  if (trade === 'link_chain') return num(c, 'link_chain_leg_delay_days');
  return 0;
}

export function commitmentMonthsFor(kind: CurrencyKind, c: MarketplaceConstants): number {
  const map = obj<Record<string, number>>(c, 'commitment_months');
  const value = map[kind];
  if (typeof value !== 'number') throw new Error(`Durée d'engagement manquante : ${kind}`);
  return value;
}

export function computeEconomicsWith(input: EconomicsInput, c: MarketplaceConstants): OrderEconomics {
  const rate = num(c, 'commission_rate');
  const rounding = num(c, 'price_rounding_cents');
  const creditRate = num(c, 'credit_eur_rate');
  const kind: CurrencyKind = input.currency_kind ?? 'link';
  const notes: string[] = [];

  const discount = tradeDiscount(input.trade_type, c);
  const price = Math.round((input.price_cents * discount) / rounding) * rounding;
  if (discount !== 1) {
    notes.push(
      `Échange réciproque de liens : valeur décotée de ${Math.round((1 - discount) * 100)} % (${input.price_cents / 100} € → ${price / 100} €)`,
    );
  }

  const commission = Math.round(price * rate);
  const support: SettlementSupport = input.commission_support ?? 'cash';
  const commissionCredits = support === 'credits' ? Math.ceil(commission / 100 / creditRate) : null;

  let sellerNet = 0;
  let soulte = 0;

  if (input.deal_type === 'barter') {
    const counter = Math.round((input.counter_value_cents ?? 0) / rounding) * rounding;
    soulte = Math.abs(price - counter);
    notes.push(
      soulte === 0
        ? 'Jambes de valeur équivalente : aucune soulte'
        : `Écart de valeur de ${soulte / 100} € comblé par une soulte`,
    );
    notes.push(
      support === 'credits'
        ? `Commission réglée en crédits (${commissionCredits} crédits)`
        : `Commission de ${commission / 100} € réglée en euros par chaque bénéficiaire`,
    );
  } else {
    sellerNet = price - commission;
    notes.push(
      `Commission Crawlers de ${Math.round(rate * 100)} % prélevée sur le règlement : net vendeur ${sellerNet / 100} €`,
    );
  }

  const delay = legPublishDelayDays(input.trade_type, c);
  if (delay > 0) notes.push(`Jambe retour publiable au plus tôt dans ${delay} jours`);

  return {
    price_cents: price,
    commission_cents: commission,
    seller_net_cents: sellerNet,
    soulte_cents: soulte,
    commission_support: support,
    commission_credits: commissionCredits,
    commitment_months: commitmentMonthsFor(kind, c),
    constants_version: c.version,
    notes,
  };
}

export async function computeEconomics(input: EconomicsInput): Promise<OrderEconomics> {
  return computeEconomicsWith(input, await loadConstants());
}
