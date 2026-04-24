/**
 * marinaWorkbench.ts — Persist Marina-detected findings into architect_workbench
 * BEFORE the consolidated action plan is built.
 *
 * Rationale: the consolidated plan reads from architect_workbench. If Marina
 * does not push its findings first, the plan only reflects historical state
 * and the "Conclusion" of fresh reports stays empty. By writing first, the
 * plan always reflects what Marina just discovered.
 *
 * Design rules:
 *   - Idempotent: rely on UNIQUE(source_type, source_record_id).
 *   - source_type must be one of the existing diagnostic_source_type enum
 *     values (no DB migration). We map sections to the closest semantic type:
 *       seo      → audit_tech
 *       geo      → audit_strategic
 *       keywords → audit_strategic
 *       eeat     → audit_strategic
 *       cocoon   → cocoon
 *   - source_record_id is namespaced "marina_<section>_<domain>_<hash>" so
 *     re-runs upsert in place instead of duplicating.
 *   - Failure is non-fatal: report generation must never break because the
 *     workbench write failed.
 */

import type { SectionTopPriorities, RawFinding, Severity } from './topPriorities.ts';
import { normalizeSeverity } from './topPriorities.ts';

type SectionKey = SectionTopPriorities['section'];

const SECTION_TO_SOURCE_TYPE: Record<SectionKey, string> = {
  seo: 'audit_tech',
  geo: 'audit_strategic',
  keywords: 'audit_strategic',
  eeat: 'audit_strategic',
  cocoon: 'cocoon',
};

const SECTION_TO_DEFAULT_CATEGORY: Record<SectionKey, string> = {
  seo: 'technical_fix',
  geo: 'geo_visibility',
  keywords: 'content_gap',
  eeat: 'eeat',
  cocoon: 'linking',
};

const SEVERITY_TO_WB: Record<Severity, string> = {
  critical: 'critical',
  important: 'high',
  suggestion: 'medium',
  optional: 'low',
  low: 'low',
};

// Tiny stable hash (FNV-1a) — keeps source_record_id short and deterministic
function shortHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(36);
}

interface SectionInput {
  section: SectionKey;
  findings: RawFinding[];
}

interface WriteOptions {
  domain: string;
  url: string;
  userId: string;
  trackedSiteId?: string | null;
}

/**
 * Upsert all section findings into architect_workbench.
 * Returns the number of rows attempted (best-effort, non-fatal).
 */
export async function writeMarinaFindingsToWorkbench(
  sb: any,
  sections: SectionInput[],
  opts: WriteOptions,
): Promise<{ attempted: number; written: number }> {
  if (!sb || !opts.userId || !opts.domain) {
    return { attempted: 0, written: 0 };
  }

  const rows: any[] = [];

  for (const { section, findings } of sections) {
    if (!findings || findings.length === 0) continue;
    const sourceType = SECTION_TO_SOURCE_TYPE[section];
    const defaultCategory = SECTION_TO_DEFAULT_CATEGORY[section];

    for (const f of findings) {
      const title = (f.title || '').trim();
      if (!title) continue;

      const severity = SEVERITY_TO_WB[normalizeSeverity(f.priority || f.severity)];
      const category = mapCategory(section, f.category) || defaultCategory;
      const sig = shortHash(`${section}|${title}`);
      const sourceRecordId = `marina_${section}_${opts.domain}_${sig}`;

      rows.push({
        domain: opts.domain,
        tracked_site_id: opts.trackedSiteId || null,
        user_id: opts.userId,
        source_type: sourceType,
        source_function: 'marina',
        source_record_id: sourceRecordId,
        finding_category: category,
        severity,
        title: title.slice(0, 280),
        description: (f.description || '').slice(0, 2000),
        target_url: opts.url || null,
        payload: {
          marina_section: section,
          original_priority: f.priority || f.severity || null,
          original_category: f.category || null,
          fixes: Array.isArray(f.fixes) ? f.fixes.slice(0, 5) : undefined,
          expected_roi: f.expected_roi,
          effort: f.effort,
          pages_affected: f.pages_affected,
        },
      });
    }
  }

  if (rows.length === 0) return { attempted: 0, written: 0 };

  let written = 0;
  // Sequential upserts: keeps the semantic-dedup trigger reliable and avoids
  // partial-batch failures that ON CONFLICT cannot describe per-row.
  for (const row of rows) {
    try {
      const { error } = await sb
        .from('architect_workbench')
        .upsert(row, { onConflict: 'source_type,source_record_id' });
      if (!error) written++;
      else console.warn(`[marinaWorkbench] upsert failed (${row.source_record_id}):`, error.message);
    } catch (e) {
      console.warn(`[marinaWorkbench] upsert exception:`, e);
    }
  }

  console.log(`[marinaWorkbench] wrote ${written}/${rows.length} findings to architect_workbench`);
  return { attempted: rows.length, written };
}

// ─── Light category mapping (best-effort, falls back to section default) ───
function mapCategory(section: SectionKey, raw?: string): string | null {
  if (!raw) return null;
  const k = raw.toLowerCase();
  if (/meta|title|description|h1/.test(k)) return 'meta_tags';
  if (/schema|jsonld|json-ld|structured/.test(k)) return 'structured_data';
  if (/speed|perf|cwv|vitals/.test(k)) return 'speed';
  if (/secur|https|ssl/.test(k)) return 'security';
  if (/access/.test(k)) return 'accessibility';
  if (/mobile/.test(k)) return 'mobile';
  if (/canonical/.test(k)) return 'canonical';
  if (/sitemap/.test(k)) return 'sitemap';
  if (/robots/.test(k)) return 'robots';
  if (/redirect/.test(k)) return 'redirect_chain';
  if (/broken|404/.test(k)) return 'broken_links';
  if (/duplicate/.test(k)) return 'duplicate_content';
  if (/eeat|e-e-a-t|trust|expertise|autorit/.test(k)) return 'eeat';
  if (/keyword|mots?-cl|content gap/.test(k)) return 'content_gap';
  if (/thin|maigre/.test(k)) return 'thin_content';
  if (/freshness|fraicheur/.test(k)) return 'content_freshness';
  if (/cannibal/.test(k)) return 'cannibalization';
  if (/linking|maillage|silo|anchor/.test(k)) return 'linking';
  if (/geo|aeo|llm|cita/.test(k)) return 'geo_visibility';
  return null;
}
