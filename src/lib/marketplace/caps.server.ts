/**
 * caps.server.ts (L1a.12)
 *
 * Compteurs de plafonds liés (§2.4) :
 *  - 1 lien `dofollow` par page **à vie** ;
 *  - 20 `dofollow` par domaine sur 12 mois glissants ;
 *  - 3 insertions par page sur 12 mois glissants, tous attributs confondus
 *    (un `dofollow` consomme un des 3).
 *
 * Les compteurs se dérivent des jambes livrées, jamais des commandes créées.
 */

import { loadConstants, obj, type MarketplaceConstants } from './constants.server';
import type { CapsState } from './types';

export interface CapsInput {
  /** Insertions dofollow déjà livrées sur cette page depuis toujours. */
  dofollow_page_lifetime_used: number;
  /** Insertions dofollow livrées sur le domaine sur 12 mois glissants. */
  dofollow_domain_12m_used: number;
  /** Insertions livrées sur la page sur 12 mois glissants, tous attributs. */
  insertions_page_12m_used: number;
}

interface CapsConfig {
  dofollow_per_page_lifetime: number;
  dofollow_per_domain_12m: number;
  insertions_per_page_12m: number;
}

export function evaluateCapsWith(input: CapsInput, c: MarketplaceConstants): CapsState {
  const caps = obj<CapsConfig & Record<string, unknown>>(c, 'caps');

  const insertionAvailable = input.insertions_page_12m_used < caps.insertions_per_page_12m;
  const dofollowPageFree = input.dofollow_page_lifetime_used < caps.dofollow_per_page_lifetime;
  const dofollowDomainFree = input.dofollow_domain_12m_used < caps.dofollow_per_domain_12m;
  const dofollowAvailable = insertionAvailable && dofollowPageFree && dofollowDomainFree;

  let blocking: string | null = null;
  if (!insertionAvailable) {
    blocking = `Plafond atteint : ${caps.insertions_per_page_12m} insertions sur 12 mois pour cette page`;
  } else if (!dofollowPageFree) {
    blocking = 'Plafond atteint : 1 lien dofollow par page à vie';
  } else if (!dofollowDomainFree) {
    blocking = `Plafond atteint : ${caps.dofollow_per_domain_12m} liens dofollow sur 12 mois pour ce domaine`;
  }

  return {
    dofollow_page_lifetime_used: input.dofollow_page_lifetime_used,
    dofollow_page_lifetime_max: caps.dofollow_per_page_lifetime,
    dofollow_domain_12m_used: input.dofollow_domain_12m_used,
    dofollow_domain_12m_max: caps.dofollow_per_domain_12m,
    insertions_page_12m_used: input.insertions_page_12m_used,
    insertions_page_12m_max: caps.insertions_per_page_12m,
    dofollow_available: dofollowAvailable,
    insertion_available: insertionAvailable,
    blocking_reason: blocking,
  };
}

export async function evaluateCaps(input: CapsInput): Promise<CapsState> {
  return evaluateCapsWith(input, await loadConstants());
}

/**
 * Compteurs réels depuis la base : plafonds page et domaine.
 * En L1a les jambes livrées n'existent pas encore (L3) : les compteurs de
 * l'actif servent de source, la table des jambes viendra s'y substituer.
 */
export async function readCapsFromAssets(
  sb: { from: (t: string) => any },
  params: { assetId: string; domain: string },
): Promise<CapsInput> {
  const { data: asset } = await sb
    .from('marketplace_link_assets')
    .select('dofollow_sold_lifetime, insertions_12m')
    .eq('id', params.assetId)
    .maybeSingle();

  const { data: domainRows } = await sb
    .from('marketplace_link_assets')
    .select('dofollow_sold_lifetime')
    .eq('domain', params.domain);

  const domainUsed = (domainRows ?? []).reduce(
    (sum: number, r: { dofollow_sold_lifetime: number | null }) => sum + (r.dofollow_sold_lifetime ?? 0),
    0,
  );

  return {
    dofollow_page_lifetime_used: asset?.dofollow_sold_lifetime ?? 0,
    dofollow_domain_12m_used: domainUsed,
    insertions_page_12m_used: asset?.insertions_12m ?? 0,
  };
}
