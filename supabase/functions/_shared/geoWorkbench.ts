/**
 * geoWorkbench.ts — Persist GEO findings (check-geo) into architect_workbench
 * so that Parménion and Stratège Cocoon can actually consume and correct them.
 *
 * Design rules (aligned with marinaWorkbench.ts):
 *   - Idempotent: UNIQUE(source_type, source_record_id) → re-runs upsert in place.
 *   - source_type stays inside the existing diagnostic_source_type enum
 *     ('audit_strategic') — no migration needed.
 *   - source_record_id namespaced "geo_<domain>_<factorId>" so a factor that is
 *     fixed then regressed reuses the same row instead of duplicating.
 *   - Failure is always non-fatal: an audit must never break because the
 *     workbench write failed.
 */

export interface GeoFactorLike {
  id: string;
  name: string;
  description?: string;
  score: number;
  maxScore: number;
  status: 'good' | 'warning' | 'error';
  recommendation?: string;
  details?: string;
}

interface WriteOptions {
  domain: string;
  url: string;
  userId: string;
  trackedSiteId?: string | null;
  totalScore: number;
  reliabilityScore?: number;
}

const FACTOR_CATEGORY: Array<[RegExp, string]> = [
  [/robot/i, 'robots'],
  [/sitemap/i, 'sitemap'],
  [/canonical/i, 'canonical'],
  [/schema|structured|jsonld|json-ld/i, 'structured_data'],
  [/meta|title|description/i, 'meta_tags'],
  [/og|opengraph|twitter|social/i, 'meta_tags'],
  [/alt|image/i, 'accessibility'],
  [/faq|answer|intent|passage|citab/i, 'geo_visibility'],
  [/readab|lisib/i, 'thin_content'],
  [/content|contenu/i, 'content_gap'],
];

function categoryFor(factor: GeoFactorLike): string {
  const key = `${factor.id} ${factor.name}`;
  for (const [re, cat] of FACTOR_CATEGORY) {
    if (re.test(key)) return cat;
  }
  return 'geo_visibility';
}

function severityFor(factor: GeoFactorLike): string {
  const ratio = factor.maxScore > 0 ? factor.score / factor.maxScore : 0;
  if (factor.status === 'error') return factor.maxScore >= 10 ? 'critical' : 'high';
  if (ratio <= 0.5) return 'medium';
  return 'low';
}

/**
 * Upsert actionable GEO factors (status error/warning) into architect_workbench.
 * Non-fatal by construction: never throws.
 */
export async function writeGeoFindingsToWorkbench(
  sb: any,
  factors: GeoFactorLike[],
  opts: WriteOptions,
): Promise<{ attempted: number; written: number }> {
  try {
    if (!sb || !opts.userId || !opts.domain || !Array.isArray(factors)) {
      return { attempted: 0, written: 0 };
    }

    const actionable = factors.filter(
      (f) => f && (f.status === 'error' || f.status === 'warning') && (f.recommendation || f.description),
    );

    const rows = actionable.map((f) => ({
      domain: opts.domain,
      tracked_site_id: opts.trackedSiteId || null,
      user_id: opts.userId,
      source_type: 'audit_strategic',
      source_function: 'check-geo',
      source_record_id: `geo_${opts.domain}_${f.id}`,
      finding_category: categoryFor(f),
      severity: severityFor(f),
      title: `GEO — ${f.name}`.slice(0, 280),
      description: (f.recommendation || f.description || '').slice(0, 2000),
      target_url: opts.url || null,
      payload: {
        geo_factor_id: f.id,
        factor_score: f.score,
        factor_max_score: f.maxScore,
        factor_status: f.status,
        geo_total_score: opts.totalScore,
        reliability_score: opts.reliabilityScore ?? null,
        details: f.details ? String(f.details).slice(0, 500) : undefined,
      },
    }));

    if (rows.length === 0) return { attempted: 0, written: 0 };

    let written = 0;
    for (const row of rows) {
      try {
        const { error } = await sb
          .from('architect_workbench')
          .upsert(row, { onConflict: 'source_type,source_record_id' });
        if (!error) written++;
        else console.warn(`[geoWorkbench] upsert failed (${row.source_record_id}):`, error.message);
      } catch (e) {
        console.warn('[geoWorkbench] upsert exception:', e);
      }
    }

    console.log(`[geoWorkbench] wrote ${written}/${rows.length} GEO findings for ${opts.domain}`);
    return { attempted: rows.length, written };
  } catch (e) {
    console.warn('[geoWorkbench] fatal guard:', e);
    return { attempted: 0, written: 0 };
  }
}
