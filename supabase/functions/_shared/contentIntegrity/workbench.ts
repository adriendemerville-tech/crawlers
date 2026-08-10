/**
 * contentIntegrity/workbench.ts
 *
 * Pousse les constats d'intégrité du contenu dans architect_workbench,
 * source unique consommée par Parménion et le Stratège Cocoon.
 *
 * Idempotent : source_record_id déterministe → upsert en place à chaque re-crawl.
 */

import type { ContentIntegrityReport } from './index.ts';

function shortHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(36);
}

export interface IntegrityWorkbenchOptions {
  domain: string;
  userId: string;
  trackedSiteId?: string | null;
  sourceFunction: string;
  /** Nombre max de pages pauvres remontées (les plus critiques d'abord). */
  maxThinPages?: number;
}

export async function writeIntegrityFindingsToWorkbench(
  sb: any,
  report: ContentIntegrityReport | null,
  opts: IntegrityWorkbenchOptions,
): Promise<{ attempted: number; written: number }> {
  if (!sb || !report || !opts.userId || !opts.domain) return { attempted: 0, written: 0 };

  const rows: any[] = [];

  // ── Quasi-doublons qualifiés (on ignore les clusters "normal") ──
  // P1-6 : sous le seuil de confiance, l'échantillon est trop petit pour que LSH
  // regroupe de façon fiable — on n'écrit aucun constat near-duplicate.
  const ndConclusive = report.near_duplicate_confidence !== 'inconclusive';
  for (const cluster of ndConclusive ? report.near_duplicate.clusters : []) {
    if (cluster.verdict === 'normal') continue;

    const urls = cluster.pages.map((p) => p.url);
    const sig = shortHash(urls.slice().sort().join('|'));
    rows.push({
      domain: opts.domain,
      tracked_site_id: opts.trackedSiteId || null,
      user_id: opts.userId,
      source_type: 'audit_tech',
      source_function: opts.sourceFunction,
      source_record_id: `integrity_nd_${opts.domain}_${sig}`,
      finding_category: cluster.verdict === 'cannibalization' ? 'cannibalization' : 'duplicate_content',
      severity: cluster.verdict === 'cannibalization' ? 'high' : 'medium',
      title: `${cluster.pages.length} pages quasi identiques (${Math.round(cluster.avg_similarity * 100)} %)`.slice(0, 280),
      description: `${cluster.rationale}\nPivot conseillé : ${cluster.pivot_url}\nPages : ${urls.join(', ')}`.slice(0, 2000),
      target_url: cluster.pivot_url,
      payload: {
        integrity_kind: 'near_duplicate',
        verdict: cluster.verdict,
        verdict_source: cluster.verdict_source,
        recommended_action: cluster.recommended_action,
        avg_similarity: cluster.avg_similarity,
        template_ratio: cluster.template_ratio,
        pivot_url: cluster.pivot_url,
        urls,
      },
    });
  }

  // ── Contenus pauvres ──
  for (const page of report.thin_content.pages.slice(0, opts.maxThinPages ?? 25)) {
    rows.push({
      domain: opts.domain,
      tracked_site_id: opts.trackedSiteId || null,
      user_id: opts.userId,
      source_type: 'audit_tech',
      source_function: opts.sourceFunction,
      source_record_id: `integrity_thin_${opts.domain}_${shortHash(page.url)}`,
      finding_category: 'thin_content',
      severity: page.thin_score >= 80 ? 'high' : 'medium',
      title: `Contenu pauvre : ${page.useful_words} mots utiles`.slice(0, 280),
      description: `Score de minceur ${page.thin_score}/100 (${page.kind}). ${page.reasons.join(' ; ') || 'Contenu insuffisant pour l\'intention visée.'}`.slice(0, 2000),
      target_url: page.url,
      payload: {
        integrity_kind: 'thin_content',
        thin_score: page.thin_score,
        useful_words: page.useful_words,
        template_ratio: page.template_ratio,
        text_to_html_ratio: page.text_to_html_ratio,
        page_kind: page.kind,
        recommended_action: 'enrich',
        reasons: page.reasons,
      },
    });
  }

  if (rows.length === 0) return { attempted: 0, written: 0 };

  let written = 0;
  for (const row of rows) {
    try {
      const { error } = await sb
        .from('architect_workbench')
        .upsert(row, { onConflict: 'source_type,source_record_id' });
      if (!error) written++;
      else console.warn(`[integrityWorkbench] upsert failed (${row.source_record_id}):`, error.message);
    } catch (e) {
      console.warn('[integrityWorkbench] upsert exception:', (e as Error).message);
    }
  }
  console.log(`[integrityWorkbench] ${written}/${rows.length} constats écrits dans architect_workbench`);
  return { attempted: rows.length, written };
}
