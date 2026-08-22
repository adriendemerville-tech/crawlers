/**
 * studioTypes.ts (L3.6) — types partagés du Studio de création (client-safe).
 */

export type VariantKind = 'editorial' | 'utility_geo' | 'action';

export const VARIANT_LABEL: Record<VariantKind, string> = {
  editorial: 'Version éditoriale',
  utility_geo: 'Version utilitaire (visibilité IA)',
  action: 'Version orientée action',
};

export const VARIANT_INTENT: Record<VariantKind, string> = {
  editorial: 'Paragraphe de fond, ton du site vendeur, lien contextuel dans le raisonnement.',
  utility_geo: 'Passage citable par les moteurs génératifs : fait vérifiable, définition, chiffre daté.',
  action: 'Formulation orientée conversion, à réserver aux pages à autorité modérée.',
};

export interface StudioVariant {
  id: string;
  variant: VariantKind;
  output: string;
  anchor: string | null;
  model: string | null;
  round_index: number;
  seller_approved_at: string | null;
  buyer_selected_at: string | null;
  created_at: string;
}

export interface StudioState {
  variants: StudioVariant[];
  rounds_used: number;
  rounds_remaining: number;
  action_variant_available: boolean;
  action_variant_reason: string | null;
}
