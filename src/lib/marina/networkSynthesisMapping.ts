/**
 * networkSynthesisMapping.ts — traduction pure des faits de synthèse réseau
 * vers les lignes de base de données.
 *
 * Isolé du transport (server function) et du calcul (`networkSynthesis.ts`)
 * pour deux raisons : le module de server function doit rester un wrapper mince,
 * et ce mapping doit rester testable sans base de données.
 *
 * Aucun jugement n'est ajouté ici : titres, justifications et rangs sont ceux
 * calculés par `networkSynthesis.ts`. Ce module ne fait que transporter.
 */

import type { NetworkSynthesisFacts } from './networkSynthesis';

/** Rendement borné → sévérité Workbench, sans introduire de nouveau seuil arbitraire. */
export function severityOf(yield_: number, kind: 'correction' | 'developpement'): string {
  if (kind === 'developpement') return 'low';
  if (yield_ >= 70) return 'critical';
  if (yield_ >= 45) return 'high';
  if (yield_ >= 25) return 'medium';
  return 'low';
}

export function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export function normalizeDomain(domain: string): string {
  return String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
}

/** Instantané comparable dans le temps pour un même lot d'URLs. */
export function buildSnapshotRow(facts: NetworkSynthesisFacts, userId: string, domain: string) {
  return {
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
    recommendations: facts.recommendations,
    facts,
  };
}

/**
 * Une tâche Workbench par action séquencée, avec sa clé stable
 * `marina_net_<domaine>_<action>` afin qu'un second export mette le plan à jour
 * au lieu de le dupliquer.
 */
export function buildWorkbenchRows(
  facts: NetworkSynthesisFacts,
  userId: string,
  domain: string,
  snapshotId: string | null,
) {
  return facts.recommendations.map((r) => ({
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
    },
  }));
}
