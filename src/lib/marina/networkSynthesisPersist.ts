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
 * Aucun jugement n'est ajouté ici : les titres, justifications et rangs sont
 * ceux calculés par `networkSynthesis.ts`. Ce module ne fait que transporter.
 */

import { supabase } from '@/integrations/supabase/client';
import type { NetworkSynthesisFacts } from './networkSynthesis';

/** Rendement borné → sévérité Workbench, sans introduire de nouveau seuil arbitraire. */
function severityOf(yield_: number, kind: 'correction' | 'developpement'): string {
  if (kind === 'developpement') return 'low';
  if (yield_ >= 70) return 'critical';
  if (yield_ >= 45) return 'high';
  if (yield_ >= 25) return 'medium';
  return 'low';
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export interface PersistResult {
  snapshotId: string | null;
  workbenchItems: number;
  error?: string;
}

/**
 * Persiste la synthèse et pousse son plan dans le Workbench. Silencieux et non
 * bloquant par conception : un échec de propagation ne doit jamais empêcher
 * l'export du rapport.
 */
export async function persistNetworkSynthesis(
  facts: NetworkSynthesisFacts | null,
): Promise<PersistResult> {
  if (!facts) return { snapshotId: null, workbenchItems: 0 };

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return { snapshotId: null, workbenchItems: 0, error: 'not_authenticated' };

  const domain = facts.domain.replace(/^www\./, '');

  let snapshotId: string | null = null;
  try {
    const { data, error } = await supabase
      .from('marina_network_syntheses')
      .insert({
        user_id: userId,
        domain,
        urls_audited: facts.urlsAudited,
        regime: facts.regime,
        tech_avg: facts.techAvg,
        geo_avg: facts.geoAvg,
        tech_geo_gap: facts.techGeoGap,
        mesh_measured: facts.mesh.measured,
        mesh_edges: facts.mesh.edges,
        measured_duplicates: facts.measuredDuplicates.length,
        missing_hubs: facts.hubs.missing.length,
        structure_verified: facts.structureVerified,
        recommendations: facts.recommendations as unknown as never,
        facts: facts as unknown as never,
      })
      .select('id')
      .single();
    if (error) throw error;
    snapshotId = data?.id ?? null;
  } catch (e) {
    return {
      snapshotId: null,
      workbenchItems: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // ── Plan séquencé → tâches Workbench ────────────────────────────────────
  const rows = facts.recommendations.map((r) => ({
    user_id: userId,
    domain,
    title: r.title,
    description: [
      r.why,
      `Rang ${r.rank} du plan réseau (${facts.urlsAudited} URLs auditées, régime « ${facts.regime} »).`,
      `Rendement ${r.yield_} = gravité ${r.severity} × portée ${r.reach}/${r.reachTotal} × confiance ${r.confidence} × effort ${r.effort}.`,
      r.kind === 'developpement'
        ? 'Action de développement : potentiel estimé, pas un défaut constaté.'
        : 'Action de correction : défaut relevé sur le lot audité.',
    ].join('\n'),
    severity: severityOf(r.yield_, r.kind),
    finding_category: r.kind === 'developpement' ? 'network_development' : 'network_correction',
    source_type: 'audit_strategic' as const,
    source_function: 'marina_network_synthesis',
    source_record_id: `marina_net_${domain}_${slug(r.title)}`,
    payload: {
      rank: r.rank,
      yield: r.yield_,
      kind: r.kind,
      level: r.level,
      effort: r.effort,
      reach: r.reach,
      reach_total: r.reachTotal,
      confidence: r.confidence,
      regime: facts.regime,
      snapshot_id: snapshotId,
    } as unknown as never,
  }));

  if (!rows.length) return { snapshotId, workbenchItems: 0 };

  try {
    const { error } = await supabase
      .from('architect_workbench')
      .upsert(rows, { onConflict: 'source_type,source_record_id' });
    if (error) throw error;
    return { snapshotId, workbenchItems: rows.length };
  } catch (e) {
    return {
      snapshotId,
      workbenchItems: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
