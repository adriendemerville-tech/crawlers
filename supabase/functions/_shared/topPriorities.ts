/**
 * topPriorities.ts — Shared logic for "Top 3 priority actions" blocks
 * displayed above each report section, plus the consolidated end-of-report
 * action plan that merges section findings with the architect_workbench.
 *
 * Used by:
 *   - supabase/functions/marina/index.ts          (PDF/HTML report)
 *   - src/components/ExpertAudit/*                (web React report, via mirror types)
 *
 * Design rules (per product decision):
 *   - Per-section ranking = pure local sort by severity, no LLM call.
 *   - Severity order: critical > important > suggestion/optional.
 *   - Final consolidated plan = workbench snapshot + section Top-3 not yet in workbench
 *     (flagged "newly_detected" so the user can spot fresh findings).
 */

// ───────────────────────── Types ─────────────────────────

export type Severity = 'critical' | 'important' | 'suggestion' | 'optional' | 'low';

export interface RawFinding {
  id?: string;
  title: string;
  description?: string;
  priority?: Severity | string;
  severity?: Severity | string;
  category?: string;
  fixes?: string[];
  // Optional pre-computed business hints (used as tie-breakers only)
  expected_roi?: string;
  effort?: string;
  pages_affected?: number;
}

export interface PriorityAction {
  rank: 1 | 2 | 3;
  severity: Severity;
  title: string;
  description: string;
  category?: string;
  source_section: SectionKey;
  /** First fix as a one-line "next step", if available */
  next_step?: string;
}

export type SectionKey = 'seo' | 'geo' | 'keywords' | 'eeat' | 'cocoon';

export interface SectionTopPriorities {
  section: SectionKey;
  section_label: string;
  actions: PriorityAction[];   // 0..3 entries
  total_findings: number;      // findings considered before slicing to top-3
  has_blockers: boolean;       // true if ≥1 critical
}

export interface WorkbenchTask {
  id: string;
  title: string;
  description?: string | null;
  severity?: string | null;
  finding_category?: string | null;
  status?: string | null;
  source_type?: string | null;
  target_url?: string | null;
}

export interface ConsolidatedPlanItem {
  rank: number;
  severity: Severity;
  title: string;
  description: string;
  category?: string;
  source: 'workbench' | 'newly_detected';
  source_section?: SectionKey;
  workbench_id?: string;
}

// ─────────────────── Severity normalization ───────────────────

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 100,
  important: 60,
  suggestion: 25,
  optional: 25,
  low: 10,
};

const PRIORITY_ALIASES: Record<string, Severity> = {
  // Legacy & i18n inputs
  critique: 'critical',
  high: 'critical',
  prioritaire: 'critical',
  p0: 'critical',
  p1: 'important',
  important: 'important',
  medium: 'important',
  moyenne: 'important',
  recommended: 'suggestion',
  suggestion: 'suggestion',
  optional: 'optional',
  optionnel: 'optional',
  low: 'low',
  faible: 'low',
  p2: 'suggestion',
  p3: 'optional',
};

export function normalizeSeverity(input: unknown): Severity {
  if (!input) return 'suggestion';
  const k = String(input).toLowerCase().trim();
  if (k in SEVERITY_WEIGHT) return k as Severity;
  return PRIORITY_ALIASES[k] || 'suggestion';
}

// ─────────────────── Top-3 extraction per section ───────────────────

const SECTION_LABELS: Record<SectionKey, string> = {
  seo: 'Audit SEO',
  geo: 'Audit GEO',
  keywords: 'Mots-clés & DataForSEO',
  eeat: 'E-E-A-T & Autorité',
  cocoon: 'Cocon sémantique',
};

/**
 * Extract the top-3 actions from a list of raw findings.
 * Stable sort: severity desc, then severity weight desc, then original index.
 */
export function extractTopPriorities(
  section: SectionKey,
  findings: RawFinding[],
): SectionTopPriorities {
  const cleaned = (findings || [])
    .filter((f) => f && (f.title || f.description))
    .map((f, idx) => ({
      idx,
      severity: normalizeSeverity(f.priority || f.severity),
      raw: f,
    }));

  cleaned.sort((a, b) => {
    const w = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
    if (w !== 0) return w;
    return a.idx - b.idx;
  });

  const top = cleaned.slice(0, 3).map((c, i): PriorityAction => ({
    rank: (i + 1) as 1 | 2 | 3,
    severity: c.severity,
    title: c.raw.title || '(sans titre)',
    description: c.raw.description || '',
    category: c.raw.category,
    source_section: section,
    next_step: Array.isArray(c.raw.fixes) && c.raw.fixes.length > 0 ? c.raw.fixes[0] : undefined,
  }));

  return {
    section,
    section_label: SECTION_LABELS[section],
    actions: top,
    total_findings: cleaned.length,
    has_blockers: cleaned.some((c) => c.severity === 'critical'),
  };
}

// ─────────────────── Semantic dedup (lightweight) ───────────────────

/**
 * Lowercased, accent-stripped, punctuation-collapsed signature used to
 * detect near-duplicate titles across sections (and against the workbench).
 * Intentionally fuzzy — we accept some false positives to keep the
 * consolidated plan readable.
 */
export function titleSignature(title: string): string {
  return (title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 3)            // drop "le", "de", "and"…
    .slice(0, 6)                            // first 6 meaningful words
    .join(' ');
}

// ─────────────────── Consolidated action plan ───────────────────

/**
 * Build the final action plan shown at the bottom of the report.
 *
 * Rule (chosen by user): Workbench tasks first (open ones), then enrich with
 * any section Top-3 that the workbench hasn't picked up yet. The latter are
 * flagged source='newly_detected' so users can see what's fresh.
 */
export function buildConsolidatedActionPlan(
  workbench: WorkbenchTask[],
  sections: SectionTopPriorities[],
  options: { maxItems?: number } = {},
): ConsolidatedPlanItem[] {
  const maxItems = options.maxItems ?? 12;

  // Open workbench tasks first, ranked by severity then created order (assumed in input order)
  const openWb = (workbench || []).filter((w) => (w.status || 'open') !== 'done');
  const wbRanked = [...openWb].sort((a, b) => {
    const sa = SEVERITY_WEIGHT[normalizeSeverity(a.severity)];
    const sb = SEVERITY_WEIGHT[normalizeSeverity(b.severity)];
    return sb - sa;
  });

  const seenSignatures = new Set<string>();
  const items: ConsolidatedPlanItem[] = [];
  let rank = 1;

  for (const w of wbRanked) {
    if (items.length >= maxItems) break;
    const sig = titleSignature(w.title);
    if (sig) seenSignatures.add(sig);
    items.push({
      rank: rank++,
      severity: normalizeSeverity(w.severity),
      title: w.title,
      description: w.description || '',
      category: w.finding_category || undefined,
      source: 'workbench',
      workbench_id: w.id,
    });
  }

  // Now inject section Top-3 that aren't already covered, ordered by severity
  const sectionPool: Array<PriorityAction & { _sig: string }> = [];
  for (const s of sections) {
    for (const a of s.actions) {
      sectionPool.push({ ...a, _sig: titleSignature(a.title) });
    }
  }
  sectionPool.sort(
    (a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity],
  );

  for (const a of sectionPool) {
    if (items.length >= maxItems) break;
    if (a._sig && seenSignatures.has(a._sig)) continue;   // already in workbench
    seenSignatures.add(a._sig);
    items.push({
      rank: rank++,
      severity: a.severity,
      title: a.title,
      description: a.description,
      category: a.category,
      source: 'newly_detected',
      source_section: a.source_section,
    });
  }

  return items;
}

// ─────────────────── HTML helpers (used by Marina) ───────────────────

const SEVERITY_BADGE: Record<Severity, { bg: string; fg: string; label: string }> = {
  critical:   { bg: '#fee2e2', fg: '#991b1b', label: 'Critique' },
  important:  { bg: '#fef3c7', fg: '#92400e', label: 'Important' },
  suggestion: { bg: '#e0e7ff', fg: '#3730a3', label: 'Suggestion' },
  optional:   { bg: '#e0e7ff', fg: '#3730a3', label: 'Optionnel' },
  low:        { bg: '#f3f4f6', fg: '#374151', label: 'Mineur' },
};

function escapeHtml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Render the "Top 3 actions prioritaires" block as standalone HTML
 * to be injected at the top of a Marina section.
 */
export function renderTopPrioritiesHTML(top: SectionTopPriorities): string {
  if (!top.actions.length) {
    return `<div style="margin:16px 0 20px;padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;color:#6b7280;font-size:13px;">
      Aucune action prioritaire détectée pour ${escapeHtml(top.section_label)}.
    </div>`;
  }

  const items = top.actions.map((a) => {
    const badge = SEVERITY_BADGE[a.severity];
    return `<li style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #f3f4f6;">
      <div style="flex-shrink:0;width:28px;height:28px;border-radius:50%;background:#111827;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;">${a.rank}</div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
          <span style="font-weight:600;font-size:13.5px;color:#111827;">${escapeHtml(a.title)}</span>
          <span style="background:${badge.bg};color:${badge.fg};padding:2px 8px;border-radius:10px;font-size:10.5px;font-weight:600;letter-spacing:0.2px;">${badge.label}</span>
        </div>
        ${a.description ? `<div style="font-size:12.5px;color:#4b5563;line-height:1.45;">${escapeHtml(a.description)}</div>` : ''}
        ${a.next_step ? `<div style="margin-top:6px;font-size:12px;color:#374151;"><strong>Prochaine étape :</strong> ${escapeHtml(a.next_step)}</div>` : ''}
      </div>
    </li>`;
  }).join('');

  return `<div style="margin:16px 0 24px;padding:16px 18px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <div style="font-weight:700;font-size:13px;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;">
        Top 3 actions prioritaires — ${escapeHtml(top.section_label)}
      </div>
      <div style="font-size:11px;color:#78350f;">
        ${top.total_findings} finding${top.total_findings > 1 ? 's' : ''} analysé${top.total_findings > 1 ? 's' : ''}${top.has_blockers ? ' · bloquant détecté' : ''}
      </div>
    </div>
    <ul style="list-style:none;padding:0;margin:0;">${items}</ul>
  </div>`;
}

/**
 * Render the consolidated end-of-report action plan as HTML.
 */
export function renderConsolidatedPlanHTML(items: ConsolidatedPlanItem[]): string {
  if (!items.length) {
    return `<div class="section">
      <div class="section-title">Plan d'action consolidé</div>
      <p style="color:#6b7280;font-size:13px;">Aucune action en attente. Excellente hygiène SEO/GEO.</p>
    </div>`;
  }

  const rows = items.map((it) => {
    const badge = SEVERITY_BADGE[it.severity];
    const origin = it.source === 'workbench'
      ? `<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:8px;font-size:10.5px;font-weight:600;">Workbench</span>`
      : `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:8px;font-size:10.5px;font-weight:600;">Nouveau · ${escapeHtml(SECTION_LABELS[it.source_section || 'seo'])}</span>`;
    return `<tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:10px 12px;font-weight:700;color:#111827;font-size:13px;">${it.rank}</td>
      <td style="padding:10px 12px;">
        <div style="font-weight:600;font-size:13px;color:#111827;margin-bottom:3px;">${escapeHtml(it.title)}</div>
        ${it.description ? `<div style="font-size:12px;color:#4b5563;line-height:1.45;">${escapeHtml(it.description)}</div>` : ''}
      </td>
      <td style="padding:10px 12px;white-space:nowrap;">
        <span style="background:${badge.bg};color:${badge.fg};padding:2px 8px;border-radius:8px;font-size:10.5px;font-weight:600;">${badge.label}</span>
      </td>
      <td style="padding:10px 12px;white-space:nowrap;">${origin}</td>
    </tr>`;
  }).join('');

  const wbCount = items.filter((i) => i.source === 'workbench').length;
  const newCount = items.length - wbCount;

  return `<div class="section">
    <div class="section-title">Plan d'action consolidé</div>
    <p style="font-size:12.5px;color:#4b5563;margin-bottom:12px;">
      ${items.length} action${items.length > 1 ? 's' : ''} prioritaire${items.length > 1 ? 's' : ''} —
      ${wbCount} déjà dans votre Workbench, ${newCount} nouvellement détectée${newCount > 1 ? 's' : ''} dans ce rapport.
    </p>
    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <thead><tr style="background:#f9fafb;">
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">#</th>
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Action</th>
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Sévérité</th>
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Origine</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}
