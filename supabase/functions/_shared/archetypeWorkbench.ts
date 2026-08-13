/**
 * archetypeWorkbench.ts — Transforme l'audit par type de page en PRESCRIPTIONS.
 *
 * Jusqu'ici l'analyse par archétypes et la pondération du mix restaient un
 * constat imprimé dans le rapport Marina. Ce module pousse ces arbitrages dans
 * `architect_workbench`, la file de diagnostics que consomment Parménion
 * (phase prescribe) et le Stratège cocoon. Un « il faut élaguer les pages
 * agence » devient donc une tâche exécutable, pas une phrase.
 *
 * Règles :
 *   - source_type = 'audit_strategic', source_function = 'marina' (donc pris en
 *     compte par la garde d'audit frais de Parménion).
 *   - source_record_id namespacé `archetype_<action>_<key>_<domain>` : un
 *     nouveau passage met à jour la même ligne au lieu d'empiler des doublons.
 *   - action_type laissé au trigger DB (assign_workbench_action_type).
 *   - Aucune prescription si la fourchette vient d'un repère a priori ET que
 *     l'écart est faible : on ne prescrit pas sur une norme non mesurée.
 *   - Échec non bloquant : un rapport ne doit jamais casser pour ça.
 */

import type { ArchetypeAnalysis, ArchetypeMixEntry, MixAction } from './pageArchetypes.ts';

interface WriteOptions {
  domain: string;
  url?: string | null;
  userId: string;
  trackedSiteId?: string | null;
  sectorLabel?: string | null;
}

const ACTION_CATEGORY: Record<MixAction, string> = {
  balanced: 'content_gap',
  expand: 'content_gap',
  create: 'content_gap',
  prune: 'thin_content',
  differentiate: 'duplicate_content',
};

const ACTION_SEVERITY: Record<MixAction, string> = {
  balanced: 'low',
  expand: 'medium',
  create: 'medium',
  prune: 'high',
  differentiate: 'medium',
};

function shortHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(36);
}

function pct1(x: number): string {
  return `${Math.round(x * 1000) / 10} %`;
}

/** Écart relatif à la fourchette : sert de garde-fou quand la cible est a priori. */
function deviation(entry: ArchetypeMixEntry): number {
  const share = entry.sitemapShare ?? entry.crawlShare;
  if (share > entry.targetMax) return share - entry.targetMax;
  if (share < entry.targetMin) return entry.targetMin - share;
  return 0;
}

export async function writeArchetypePrescriptions(
  sb: any,
  analysis: ArchetypeAnalysis | null,
  opts: WriteOptions,
): Promise<{ attempted: number; written: number }> {
  try {
    if (!sb || !analysis || !opts.userId || !opts.domain || opts.userId === 'service-role') {
      return { attempted: 0, written: 0 };
    }

    const rows: Record<string, unknown>[] = [];
    const mix = analysis.mix;

    // ── 1. Arbitrages de volume (expand / prune / differentiate) ──
    for (const e of mix?.entries || []) {
      if (e.action === 'balanced') continue;
      // Sur une cible non mesurée, on n'ouvre une tâche que si l'écart est net (>8 pts).
      if (e.targetSource === 'a_priori' && deviation(e) < 0.08) continue;

      const share = e.sitemapShare ?? e.crawlShare;
      const basis = e.targetSource === 'benchmark'
        ? `fourchette observée sur ${e.targetSample} site(s) comparable(s)${opts.sectorLabel ? ` du secteur « ${opts.sectorLabel} »` : ''}`
        : 'repère posé a priori (échantillon sectoriel insuffisant)';

      const title = e.action === 'prune'
        ? `Élaguer ou fusionner les pages « ${e.label} » les plus faibles`
        : e.action === 'differentiate'
          ? `Différencier les pages « ${e.label} » sans en créer davantage`
          : `Développer le gabarit « ${e.label} », sous-représenté`;

      rows.push({
        domain: opts.domain,
        tracked_site_id: opts.trackedSiteId || null,
        user_id: opts.userId,
        source_type: 'audit_strategic',
        source_function: 'marina',
        source_record_id: `archetype_${e.action}_${e.key}_${opts.domain}`,
        finding_category: ACTION_CATEGORY[e.action],
        severity: ACTION_SEVERITY[e.action],
        title: title.slice(0, 280),
        description: [
          `Ce gabarit représente ${pct1(share)} du périmètre analysé (${e.crawledPages} page(s) crawlée(s)${e.sitemapPages !== null ? `, ${e.sitemapPages} URL au sitemap` : ''}).`,
          `Référence utilisée : ${pct1(e.targetMin)}–${pct1(e.targetMax)}${e.targetMedian !== null ? ` (médiane ${pct1(e.targetMedian)})` : ''} — ${basis}.`,
          e.rationale,
        ].join(' ').slice(0, 2000),
        target_url: opts.url || null,
        payload: {
          archetype_key: e.key,
          archetype_label: e.label,
          archetype_role: e.role,
          mix_action: e.action,
          observed_share: Math.round(share * 10000) / 10000,
          target_min: e.targetMin,
          target_max: e.targetMax,
          target_median: e.targetMedian,
          target_source: e.targetSource,
          target_sample: e.targetSample,
          sector: opts.sectorLabel || null,
          mix_basis: mix?.basis || null,
          crawl_coverage: mix?.coverage ?? null,
          origin: 'page_archetypes',
        },
      });
    }

    // ── 2. Gabarits absents à créer ──
    for (const m of mix?.missing || []) {
      rows.push({
        domain: opts.domain,
        tracked_site_id: opts.trackedSiteId || null,
        user_id: opts.userId,
        source_type: 'audit_strategic',
        source_function: 'marina',
        source_record_id: `archetype_create_${m.key}_${opts.domain}`,
        finding_category: 'content_gap',
        severity: m.role === 'core_business' ? 'high' : 'medium',
        title: `Créer le gabarit manquant « ${m.label} »`.slice(0, 280),
        description: `${m.rationale} Ce gabarit est attendu pour un site d'acquisition et son absence prive le site d'un point d'entrée entier.`.slice(0, 2000),
        target_url: opts.url || null,
        payload: {
          archetype_key: m.key,
          archetype_label: m.label,
          archetype_role: m.role,
          mix_action: 'create',
          sector: opts.sectorLabel || null,
          origin: 'page_archetypes',
        },
      });
    }

    // ── 3. Types business qui échouent à tenir leur rôle ──
    for (const g of analysis.groups) {
      if (g.verdict !== 'weak') continue;
      if (g.role !== 'core_business' && g.role !== 'auxiliary_pillar') continue;
      rows.push({
        domain: opts.domain,
        tracked_site_id: opts.trackedSiteId || null,
        user_id: opts.userId,
        source_type: 'audit_strategic',
        source_function: 'marina',
        source_record_id: `archetype_weak_${g.key}_${opts.domain}_${shortHash(g.failures.join('|'))}`,
        finding_category: g.duplicateGroups > 0 ? 'duplicate_content' : g.thinPages > 0 ? 'thin_content' : 'content_gap',
        severity: g.role === 'core_business' ? 'critical' : 'high',
        title: `Les pages « ${g.label} » ne remplissent pas leur rôle`.slice(0, 280),
        description: [
          `Objectif du gabarit : ${g.purpose}.`,
          `Constat sur ${g.pages} page(s)${g.avgSeoScore !== null ? ` (score SEO moyen ${g.avgSeoScore}/100)` : ''} : ${g.failures.join(' ; ')}.`,
          g.optimizations.length ? `Correctifs attendus : ${g.optimizations.join(' ; ')}.` : '',
        ].filter(Boolean).join(' ').slice(0, 2000),
        target_url: g.sample[0] || opts.url || null,
        payload: {
          archetype_key: g.key,
          archetype_label: g.label,
          archetype_role: g.role,
          pages: g.pages,
          thin_pages: g.thinPages,
          duplicate_groups: g.duplicateGroups,
          avg_seo_score: g.avgSeoScore,
          failures: g.failures,
          optimizations: g.optimizations,
          sample_urls: g.sample,
          origin: 'page_archetypes',
        },
      });
    }

    if (!rows.length) return { attempted: 0, written: 0 };

    let written = 0;
    for (const row of rows) {
      try {
        const { error } = await sb
          .from('architect_workbench')
          .upsert(row, { onConflict: 'source_type,source_record_id' });
        if (!error) written++;
        else console.warn(`[archetypeWorkbench] upsert failed (${row['source_record_id']}):`, error.message);
      } catch (e) {
        console.warn('[archetypeWorkbench] upsert exception:', e);
      }
    }

    console.log(`[archetypeWorkbench] ${written}/${rows.length} prescription(s) écrite(s) dans architect_workbench`);
    return { attempted: rows.length, written };
  } catch (e) {
    console.warn('[archetypeWorkbench] exception:', e);
    return { attempted: 0, written: 0 };
  }
}
