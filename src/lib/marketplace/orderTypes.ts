/**
 * orderTypes.ts (L3) — types partagés du cycle de commande (client-safe).
 * Aucune logique : les calculs vivent dans les modules `*.server.ts`.
 */

import type { LinkAttribute } from './types';
import type { NeedObjective } from './matchTypes';

export type DealType = 'cash' | 'credits' | 'barter';
export type SettlementSupport = 'cash' | 'credits';
export type OrderStatus =
  | 'draft'
  | 'frozen'
  | 'pending'
  | 'published'
  | 'verified'
  | 'maintained'
  | 'broken'
  | 'resolved'
  | 'refunded'
  | 'cancelled';

export type CurrencyKind = 'link' | 'story' | 'linkedin';
export type TradeType =
  | 'link_chain'
  | 'link_for_link'
  | 'link_for_linkedin'
  | 'link_for_insta'
  | 'linkedin_for_linkedin'
  | 'insta_for_insta';

export interface OrderEconomics {
  /** Valeur de l'emplacement au moment du gel. */
  price_cents: number;
  /** Commission Crawlers, arrondie au centime. */
  commission_cents: number;
  /** Net vendeur (0 en troc pur : la contrepartie est en nature). */
  seller_net_cents: number;
  /** Écart de valeur entre les deux jambes d'un troc. */
  soulte_cents: number;
  /** Support de règlement de la commission. */
  commission_support: SettlementSupport;
  commission_credits: number | null;
  commitment_months: number;
  constants_version: number;
  /** Justifications lisibles affichées avant paiement. */
  notes: string[];
}

export interface OrderRow {
  id: string;
  role: 'buyer' | 'seller';
  counterpart_domain: string;
  seller_url: string | null;
  target_url: string;
  anchor: string | null;
  link_attribute: LinkAttribute;
  need_objective: NeedObjective | null;
  deal_type: DealType;
  price_cents: number;
  commission_cents: number;
  soulte_cents: number;
  commitment_months: number;
  status: OrderStatus;
  published_at: string | null;
  commitment_ends_at: string | null;
  revision_rounds_used: number;
  created_at: string;
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  draft: 'Brouillon',
  frozen: 'Conditions gelées',
  pending: 'Acceptée, publication attendue',
  published: 'Publiée',
  verified: 'Vérifiée',
  maintained: 'Maintenue',
  broken: 'Lien rompu',
  resolved: 'Litige tranché',
  refunded: 'Remboursée',
  cancelled: 'Annulée',
};

export const DEAL_TYPE_LABEL: Record<DealType, string> = {
  cash: 'Achat en euros',
  credits: 'Achat en crédits',
  barter: 'Troc',
};
