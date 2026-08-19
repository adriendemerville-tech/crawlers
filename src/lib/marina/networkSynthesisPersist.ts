/**
 * networkSynthesisPersist.ts — Trou 10 : la synthèse réseau ne vit plus
 * uniquement dans le PDF exporté.
 *
 * Deux effets, tous deux idempotents :
 *   1. un instantané de la lecture d'ensemble dans `marina_network_syntheses`,
 *      pour que le même lot soit comparable dans le temps (régime, écart
 *      technique/GEO, densité de maillage, doublons mesurés, piliers manquants) ;
 *   2. une tâche `architect_workbench` par action séquencée, avec sa clé stable
 *      `marina_net_<domaine>_<action>` afin qu'un second export ne duplique pas
 *      le plan mais le mette à jour.
 *
 * L'écriture passe par une server function : le navigateur n'a pas le droit
 * d'alimenter le Workbench, seule la lecture de ses propres lignes lui est
 * ouverte. Appel non bloquant par conception — un échec de propagation ne doit
 * jamais empêcher l'export du rapport.
 */

import type { NetworkSynthesisFacts } from './networkSynthesis';
import { persistNetworkSynthesisFn } from './networkSynthesis.functions';

export interface PersistResult {
  snapshotId: string | null;
  workbenchItems: number;
  error?: string;
}

export async function persistNetworkSynthesis(
  facts: NetworkSynthesisFacts | null,
): Promise<PersistResult> {
  if (!facts) return { snapshotId: null, workbenchItems: 0 };
  try {
    return await persistNetworkSynthesisFn({ data: { facts } });
  } catch (e) {
    return {
      snapshotId: null,
      workbenchItems: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
