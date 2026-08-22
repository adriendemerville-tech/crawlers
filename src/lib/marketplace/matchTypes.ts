/**
 * matchTypes.ts (L2) — types partagés de l'appariement (client-safe).
 * Aucune logique : les calculs vivent dans les modules `*.server.ts`.
 */

import type { LinkAttribute, PriceTier } from './types';

export type NeedType = 'seo' | 'geo' | 'conversion';
export type NeedObjective = 'autorite' | 'geo' | 'trafic' | 'mixte';
export type NeedObjectiveSource = 'derived' | 'user_confirmed' | 'user_overridden';

export interface NeedRow {
  id: string;
  domain: string;
  target_url: string;
  need_type: NeedType;
  need_primary: NeedObjective;
  need_secondary: NeedObjective | null;
  severity: string;
  authority_deficit: number;
  need_score: number;
  /** Justification déterministe affichée à l'utilisateur. */
  justification: string;
  need_objective: NeedObjective | null;
  need_objective_source: NeedObjectiveSource | null;
  need_objective_confirmed_at: string | null;
}

export interface MatchFactor {
  key: string;
  label: string;
  /** Contribution pondérée, 0–1. */
  value: number;
  weight: number;
  detail: string;
}

export interface MatchRow {
  id: string;
  need_id: string;
  asset_id: string;
  need_target_url: string;
  seller_domain: string;
  /** URL de la page vendeuse, jamais masquée : elle est publique par nature. */
  seller_url: string;
  compat_score: number;
  factors: MatchFactor[];
  projected_attribute: LinkAttribute;
  attribute_reasons: string[];
  price_cents: number;
  price_tier: PriceTier | null;
  expires_at: string;
}

export interface BuyerLimitsState {
  links_7d: number;
  links_7d_max: number;
  links_30d: number;
  links_30d_max: number;
  per_seller_12m_max: number;
  same_target_url_12m_max: number;
  exact_anchor_ratio: number;
  exact_anchor_max_ratio: number;
  topical_coherence: number;
  topical_coherence_min: number;
  buy_risk: number;
  purchase_allowed: boolean;
  next_allowed_at: string | null;
  throttle_reason: string | null;
}

export interface MatchValueRow {
  scope: 'page' | 'domain';
  domain: string;
  url: string;
  seller_face: number;
  buyer_face: number;
  sell_potential_cents: number;
  buy_need_score: number;
  balance_cents: number;
  factors: Record<string, number>;
  computed_at: string;
}

export const OBJECTIVE_LABEL: Record<NeedObjective, string> = {
  autorite: 'Gagner en autorité',
  geo: 'Être cité par les moteurs génératifs',
  trafic: 'Gagner du trafic qualifié',
  mixte: 'Objectif mixte',
};
