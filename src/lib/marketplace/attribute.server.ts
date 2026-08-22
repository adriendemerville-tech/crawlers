/**
 * attribute.server.ts (L1a.11)
 *
 * Moteur d'attribut de lien (§2.4 / §2.4.1). Chaîne de décision :
 *   Crawlers décide · le vendeur a un droit de veto (peut rester en sponsored)
 *   · l'acheteur constate avant paiement.
 *
 * Deux axes doivent converger pour accorder un `dofollow` :
 *   1. Besoin acheteur — déficit d'autorité net > 0 sur l'objectif déclaré ;
 *   2. Capacité vendeur — sell_risk ≤ seuil sûr, palier ≥ P3, plafonds libres.
 * À défaut, le serveur impose `sponsored`. `nofollow` reste réservé aux
 * contextes non éditoriaux (profil, commentaire, page de partenaires).
 */

import { loadConstants, num, type MarketplaceConstants } from './constants.server';
import { tierIndex } from './pricing.server';
import type { AttributeDecision, CapsState, LinkAttribute, PriceTier } from './types';

export interface AttributeInput {
  /** Objectif déclaré par l'acheteur à l'étape bloquante « Mon objectif ». */
  buyer_objective: 'authority' | 'geo_visibility' | 'traffic' | 'brand';
  /** Déficit d'autorité net de l'acheteur (balance amortie 24 mois). */
  buyer_authority_deficit: number;
  /** Contexte d'insertion : éditorial ou non. */
  placement: 'editorial' | 'profile' | 'comment' | 'partners';
  seller_sell_risk: number;
  seller_tier: PriceTier;
  caps: CapsState;
  /** Veto vendeur : force sponsored même si dofollow est accordé. */
  seller_veto_dofollow?: boolean;
}

export function decideAttributeWith(input: AttributeInput, c: MarketplaceConstants): AttributeDecision {
  const safeMax = num(c, 'sell_risk_safe_max');
  const minTier = (c.values['dofollow_min_tier'] as PriceTier) ?? 'P3';
  const reasons: string[] = [];

  // Axe 1 — besoin acheteur (nécessaire).
  const needsAuthority = input.buyer_objective === 'authority' || input.buyer_objective === 'traffic';
  const deficitPositive = input.buyer_authority_deficit > 0;
  const need: 'dofollow' | 'sponsored' = needsAuthority && deficitPositive ? 'dofollow' : 'sponsored';
  if (!needsAuthority) reasons.push(`Objectif « ${input.buyer_objective} » : l'autorité n'est pas nécessaire`);
  else if (!deficitPositive) reasons.push('Déficit d’autorité net nul ou négatif : dofollow non nécessaire');

  // Axe 2 — capacité vendeur (suffisant).
  const riskOk = input.seller_sell_risk <= safeMax;
  const tierOk = tierIndex(input.seller_tier) >= tierIndex(minTier);
  const capsOk = input.caps.dofollow_available;
  const permit: 'dofollow' | 'sponsored' = riskOk && tierOk && capsOk ? 'dofollow' : 'sponsored';
  if (!riskOk) reasons.push(`Risque de vente ${input.seller_sell_risk} supérieur au seuil sûr ${safeMax}`);
  if (!tierOk) reasons.push(`Palier ${input.seller_tier} inférieur au minimum ${minTier}`);
  if (!capsOk) reasons.push(input.caps.blocking_reason ?? 'Plafond de dofollow atteint');

  let attribute: LinkAttribute = need === 'dofollow' && permit === 'dofollow' ? 'dofollow' : 'sponsored';

  if (input.placement !== 'editorial') {
    attribute = 'nofollow';
    reasons.push(`Contexte « ${input.placement} » non éditorial : nofollow imposé`);
  }

  if (attribute === 'dofollow' && input.seller_veto_dofollow) {
    attribute = 'sponsored';
    reasons.push('Veto du vendeur : maintien en sponsored par précaution');
  }

  if (attribute === 'sponsored' && reasons.length === 0) {
    reasons.push('Sponsored par défaut');
  }

  return {
    attribute,
    need_attribute: need,
    permit_attribute: permit,
    attribute_basis: {
      constants_version: c.version,
      decided_at: new Date().toISOString(),
      buyer_objective: input.buyer_objective,
      buyer_authority_deficit: input.buyer_authority_deficit,
      placement: input.placement,
      need: need,
      permit: permit,
      seller_sell_risk: input.seller_sell_risk,
      seller_tier: input.seller_tier,
      sell_risk_safe_max: safeMax,
      dofollow_min_tier: minTier,
      caps: input.caps,
      seller_veto_dofollow: Boolean(input.seller_veto_dofollow),
      final_attribute: attribute,
      reasons,
    },
    reasons,
  };
}

export async function decideAttribute(input: AttributeInput): Promise<AttributeDecision> {
  return decideAttributeWith(input, await loadConstants());
}
