/**
 * emphasisWorkbench.ts — Remontée automatique du constat de mise en exergue
 * (<strong>/<b>) dans architect_workbench, après chaque crawl.
 *
 * Avant : le constat `no_emphasis` n'existait que si l'utilisateur lançait
 * manuellement `cocoon-diag-content`. La donnée (`strong_count`, `strong_terms`)
 * était pourtant collectée à chaque crawl.
 *
 * Signal éditorial uniquement : n'affecte aucun score. Zéro appel LLM.
 * Idempotent : source_record_id déterministe → upsert en place à chaque crawl.
 */

import { computeEmphasisQuality } from './emphasisQuality.ts';

export const EMPHASIS_ADVICE =
  "Conseil : une balise <strong> mal placée n'apporte rien. Mieux vaut 2–3 mises en exergue pertinentes sur les mots-clés d'intention que 15 <strong> décoratifs.";

function shortHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(36);
}

export interface EmphasisWorkbenchOptions {
  domain: string;
  userId: string;
  trackedSiteId?: string | null;
  sourceFunction: string;
  /** Nombre max de pages remontées individuellement. */
  maxPages?: number;
}

/**
 * Écrit un constat agrégé + jusqu'à `maxPages` constats par page (pages longues
 * sans aucune mise en exergue, les plus longues d'abord).
 */
export async function writeEmphasisFindingsToWorkbench(
  sb: any,
  pages: any[],
  opts: EmphasisWorkbenchOptions,
): Promise<{ attempted: number; written: number }> {
  try {
    if (!sb || !Array.isArray(pages) || pages.length === 0) return { attempted: 0, written: 0 };
    if (!opts.userId || !opts.domain) return { attempted: 0, written: 0 };

    const indexable = pages.filter(
      (p) => !p?.has_noindex && Number(p?.http_status || 0) < 400 && Number(p?.word_count || 0) > 300,
    );
    if (indexable.length === 0) return { attempted: 0, written: 0 };

    const report = computeEmphasisQuality(indexable as any[]);
    // Crawl antérieur à la mesure (aucun compteur renseigné) → rien à conclure.
    if (!report.measured) return { attempted: 0, written: 0 };

    const missing = indexable
      .filter((p) => Number(p?.strong_count || 0) === 0)
      .sort((a, b) => Number(b?.word_count || 0) - Number(a?.word_count || 0));
    const over = indexable.filter((p) => {
      const w = Number(p?.word_count || 0);
      return w > 0 && (Number(p?.strong_count || 0) / w) * 1000 > 8;
    });

    if (missing.length === 0 && over.length === 0) return { attempted: 0, written: 0 };

    const base = {
      domain: opts.domain,
      tracked_site_id: opts.trackedSiteId || null,
      user_id: opts.userId,
      source_type: 'audit_strategic' as const,
      source_function: opts.sourceFunction,
      finding_category: 'no_emphasis',
      severity: 'low',
    };

    const rows: any[] = [];

    if (missing.length > 0) {
      rows.push({
        ...base,
        source_record_id: `emphasis_site_${opts.domain}`,
        title: `${missing.length}/${indexable.length} pages longues sans mise en exergue`.slice(0, 280),
        description:
          `${missing.length} pages de plus de 300 mots n'ont aucune balise <strong>/<b>. `
          + `Qualité sémantique des exergues existantes : ${report.semanticQualityScore ?? 'n/a'}/100 (verdict : ${report.verdict}). `
          + EMPHASIS_ADVICE,
        target_url: missing[0]?.url || `https://${opts.domain}`,
        payload: {
          emphasis_kind: 'site_summary',
          score_impact: 'none',
          advice: EMPHASIS_ADVICE,
          pages_analyzed: report.pagesAnalyzed,
          pages_without_emphasis: missing.length,
          pages_over_emphasized: report.pagesOverEmphasized,
          avg_per_thousand_words: report.avgPerThousandWords,
          semantic_quality_score: report.semanticQualityScore,
          verdict: report.verdict,
          quality_terms: report.qualityTerms,
          weak_terms: report.weakTerms,
          affected_urls: missing.slice(0, 50).map((p) => p.url),
        },
      });
    }

    for (const page of missing.slice(0, opts.maxPages ?? 15)) {
      rows.push({
        ...base,
        source_record_id: `emphasis_page_${opts.domain}_${shortHash(String(page.url))}`,
        title: `Aucune mise en exergue (${Number(page.word_count || 0)} mots)`.slice(0, 280),
        description: `Cette page n'a aucune balise <strong>/<b>. ${EMPHASIS_ADVICE}`,
        target_url: page.url,
        payload: {
          emphasis_kind: 'missing',
          score_impact: 'none',
          advice: EMPHASIS_ADVICE,
          word_count: Number(page.word_count || 0),
          recommended_count: 3,
        },
      });
    }

    for (const page of over.slice(0, opts.maxPages ?? 15)) {
      rows.push({
        ...base,
        source_record_id: `emphasis_over_${opts.domain}_${shortHash(String(page.url))}`,
        title: `Sur-balisage des exergues (${Number(page.strong_count || 0)} occurrences)`.slice(0, 280),
        description:
          `${Number(page.strong_count || 0)} balises <strong>/<b> pour ${Number(page.word_count || 0)} mots : le signal se dilue. `
          + EMPHASIS_ADVICE,
        target_url: page.url,
        payload: {
          emphasis_kind: 'over_emphasized',
          score_impact: 'none',
          advice: EMPHASIS_ADVICE,
          strong_count: Number(page.strong_count || 0),
          word_count: Number(page.word_count || 0),
          recommended_count: 3,
        },
      });
    }

    let written = 0;
    for (const row of rows) {
      try {
        const { error } = await sb
          .from('architect_workbench')
          .upsert(row, { onConflict: 'source_type,source_record_id' });
        if (!error) written++;
        else console.warn(`[emphasisWorkbench] upsert failed (${row.source_record_id}):`, error.message);
      } catch (e) {
        console.warn('[emphasisWorkbench] upsert exception:', (e as Error).message);
      }
    }
    console.log(`[emphasisWorkbench] ${written}/${rows.length} constats d'exergue écrits (${opts.domain})`);
    return { attempted: rows.length, written };
  } catch (e) {
    console.warn('[emphasisWorkbench] fatal guard:', (e as Error).message);
    return { attempted: 0, written: 0 };
  }
}
