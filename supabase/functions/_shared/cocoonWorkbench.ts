/**
 * cocoonWorkbench.ts — Persist Cocoon / Stratège findings into architect_workbench
 * so Parménion and the Content/Code Architects can actually correct them.
 *
 * Fixes audit H1 (2026-08-10): cocoon-strategist READ the workbench (Breathing
 * Spiral context) but never WROTE into it, so no cannibalization / orphan page /
 * depth > 3 finding ever reached the correction loop.
 *
 * Design rules (aligned with geoWorkbench.ts / marinaWorkbench.ts):
 *   - Idempotent: UNIQUE(source_type, source_record_id) → re-runs upsert in place.
 *   - source_type stays inside the existing diagnostic_source_type enum ('cocoon').
 *   - source_record_id namespaced "cocoon_<domain>_<findingId>" (+ url hash when
 *     the finding is page-scoped) so a regression reuses the same row.
 *   - action_type is left to the DB trigger (assign_workbench_action_type).
 *   - Always non-fatal: a strategy plan must never fail because of a workbench write.
 */

export interface CocoonFindingLike {
  id?: string;
  category?: string;
  severity?: string;
  title?: string;
  description?: string;
  affected_urls?: string[];
  source_type?: string;
  data?: Record<string, unknown>;
  _suppressed?: boolean;
}

interface WriteOptions {
  domain: string;
  trackedSiteId: string;
  userId: string;
  strategyPlanId?: string | null;
  spiralPhase?: string | null;
}

/** Findings that are actionable enough to justify a workbench row. */
const CRITICAL_CATEGORIES = new Set([
  'cannibalization',
  'orphan_pages',
  'deep_pages',
  'structure',
  'thin_content',
  'duplicate_content',
  'content_decay',
  'weak_clusters',
  'keyword_gaps',
  'broken_links',
  'anchor_over_optimization',
]);

/** category / finding id → (target_selector, target_operation) */
const TARGET_MAP: Record<string, { selector: string; operation: string }> = {
  cannibalization: { selector: 'content', operation: 'replace' },
  orphan_pages: { selector: 'a[href]', operation: 'insert_after' },
  deep_pages: { selector: 'a[href]', operation: 'insert_after' },
  broken_links: { selector: 'a[href]', operation: 'replace' },
  thin_content: { selector: 'content', operation: 'append' },
  duplicate_content: { selector: 'content', operation: 'replace' },
  content_decay: { selector: 'content', operation: 'replace' },
  weak_clusters: { selector: 'content', operation: 'create' },
  keyword_gaps: { selector: 'content', operation: 'create' },
  anchor_over_optimization: { selector: 'a[href]', operation: 'replace' },
};

function mapSeverity(sev?: string): string {
  switch ((sev || '').toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'warning':
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    default:
      return 'low';
  }
}

function shortHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36).slice(0, 8);
}

/**
 * Upsert actionable Cocoon findings into architect_workbench. Never throws.
 */
export async function writeCocoonFindingsToWorkbench(
  sb: any,
  findings: CocoonFindingLike[],
  opts: WriteOptions,
): Promise<{ attempted: number; written: number }> {
  try {
    if (!sb || !opts.userId || !opts.domain || !opts.trackedSiteId || !Array.isArray(findings)) {
      return { attempted: 0, written: 0 };
    }
    // 'service-role' is a placeholder, not a uuid: without a real owner the row
    // would be invisible to RLS-scoped consumers anyway.
    if (opts.userId === 'service-role') {
      console.warn('[cocoonWorkbench] skipped: no real caller_user_id provided');
      return { attempted: 0, written: 0 };
    }


    const actionable = findings.filter((f) => {
      if (!f || f._suppressed) return false;
      const sev = (f.severity || '').toLowerCase();
      if (sev !== 'critical' && sev !== 'warning' && sev !== 'high') return false;
      const key = f.category || f.id || '';
      return CRITICAL_CATEGORIES.has(key) || CRITICAL_CATEGORIES.has(f.id || '');
    });

    if (actionable.length === 0) return { attempted: 0, written: 0 };

    // Deduplicate on the idempotency key (same finding id can come from 2 diags)
    const rows = new Map<string, Record<string, unknown>>();

    for (const f of actionable) {
      const findingKey = f.id || f.category || 'unknown';
      const urls = Array.isArray(f.affected_urls) ? f.affected_urls.filter(Boolean) : [];
      const primaryUrl = urls[0] || null;
      const target = TARGET_MAP[f.category || ''] || TARGET_MAP[f.id || ''] || null;
      const recordId = `cocoon_${opts.domain}_${findingKey}${primaryUrl ? `_${shortHash(primaryUrl)}` : ''}`;

      rows.set(recordId, {
        domain: opts.domain,
        tracked_site_id: opts.trackedSiteId,
        user_id: opts.userId,
        source_type: 'cocoon',
        source_function: 'cocoon-strategist',
        source_record_id: recordId,
        finding_category: f.category || findingKey,
        severity: mapSeverity(f.severity),
        title: `Cocoon — ${f.title || findingKey}`.slice(0, 280),
        description: (f.description || '').slice(0, 2000),
        target_url: primaryUrl,
        target_selector: target?.selector ?? null,
        target_operation: target?.operation ?? null,
        status: 'pending',
        payload: {
          cocoon_finding_id: f.id ?? null,
          diagnostic_source: f.source_type ?? null,
          affected_urls: urls.slice(0, 50),
          affected_count: urls.length,
          strategy_plan_id: opts.strategyPlanId ?? null,
          spiral_phase: opts.spiralPhase ?? null,
        },
      });
    }

    let written = 0;
    for (const row of rows.values()) {
      try {
        const { error } = await sb
          .from('architect_workbench')
          .upsert(row, { onConflict: 'source_type,source_record_id' });
        if (!error) written++;
        else console.warn(`[cocoonWorkbench] upsert failed (${row.source_record_id}):`, error.message);
      } catch (e) {
        console.warn('[cocoonWorkbench] upsert exception:', e);
      }
    }

    console.log(`[cocoonWorkbench] wrote ${written}/${rows.size} Cocoon findings for ${opts.domain}`);
    return { attempted: rows.size, written };
  } catch (e) {
    console.warn('[cocoonWorkbench] fatal guard:', e);
    return { attempted: 0, written: 0 };
  }
}
