/**
 * Place d'échange — types partagés (client-safe, aucune logique serveur).
 * Référence : knowledge/tech/marketplace/matching-engines-backlink-instagram-fr.md
 */

export type PriceTier = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
export type SellRiskClass = 'safe' | 'moderate' | 'discouraged';
export type LinkAttribute = 'dofollow' | 'nofollow' | 'sponsored';
export type OwnershipStatus = 'verified' | 'unverified' | 'revoked';
export type VerificationMethod = 'gsc' | 'dns_txt' | 'file' | 'oauth_linkedin' | 'oauth_meta';
export type TaxStatus = 'company_vat' | 'company_no_vat' | 'micro' | 'individual' | 'association';

/** Les 5 signaux de pricing (§2.1), déjà normalisés 0–100. */
export interface AssetScores {
  authority_score: number;
  semantic_score: number;
  traffic_score: number;
  quality_score: number;
  ai_visibility_score: number;
}

export interface PricingResult {
  global_score: number;
  tier: PriceTier;
  price_cents: number;
  constants_version: number;
  /** Motif d'une redescente de palier (ex. P5 refusé faute d'historique). */
  downgrade_reason: string | null;
}

export interface SellRiskComponents {
  strategic: number;
  internal_dependency: number;
  gsc_momentum: number;
  outbound_saturation: number;
  technical_fragility: number;
}

export interface SellRiskResult {
  sell_risk: number;
  risk_class: SellRiskClass;
  components: SellRiskComponents;
  hard_exclusion_reason: string | null;
  eligible: boolean;
  constants_version: number;
}

export interface CapsState {
  dofollow_page_lifetime_used: number;
  dofollow_page_lifetime_max: number;
  dofollow_domain_12m_used: number;
  dofollow_domain_12m_max: number;
  insertions_page_12m_used: number;
  insertions_page_12m_max: number;
  dofollow_available: boolean;
  insertion_available: boolean;
  blocking_reason: string | null;
}

export interface AttributeDecision {
  attribute: LinkAttribute;
  need_attribute: 'dofollow' | 'sponsored';
  permit_attribute: 'dofollow' | 'sponsored';
  /** Base auditable écrite dans marketplace_orders.attribute_basis (§4.3). */
  attribute_basis: Record<string, unknown>;
  reasons: string[];
}

export interface InventoryRow {
  id: string;
  url: string;
  domain: string;
  opted_in: boolean;
  price_cents: number | null;
  price_tier: PriceTier | null;
  sell_risk: number | null;
  risk_class: SellRiskClass | null;
  risk_reason: string | null;
  ownership_status: OwnershipStatus;
  caps: CapsState;
  revenue_cents: number;
  /** Score de tri : valeur vendeur / sell_risk décroissant (§2.12). */
  sort_score: number;
}

/** Fourchettes exposées (§2.1.1) — jamais recalculées côté client. */
export const CLICK_BUCKETS = [
  'trafic faible / non significatif',
  '11-50',
  '51-200',
  '201-1 000',
  '1 001-5 000',
  '5 000+',
] as const;

export const IMPRESSION_BUCKETS = [
  '0-100',
  '101-1 000',
  '1 001-10 000',
  '10 001-50 000',
  '50 001-250 000',
  '250 000+',
] as const;

export const POSITION_BUCKETS = ['1-3', '4-10', '11-20', '21+'] as const;
