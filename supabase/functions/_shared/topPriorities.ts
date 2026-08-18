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

import { ROI_TIER_STYLE, type RoiAnnotation } from './roiWeighting.ts';
import {
  fingerprintFinding,
  dedupeByFingerprint,
  scopeSentence,
  buildAccountability,
  formatAccountability,
  distributeTrafficGains,
  type Accountability,
  type TrafficContext,
} from './actionPlanDiscrimination.ts';

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
  /** Lot 5 : écart relatif au seuil mesuré, fourni par severityFromSignal(). */
  gap_ratio?: number;
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
  /** Lot 5 : empreinte de consigne (déduplication inter-gabarits). */
  fingerprint?: string;
  /** Lot 5 : gabarits / répertoires regroupés sous cette action. */
  templates?: string[];
  /** Lot 5 : nombre de constats fusionnés. */
  occurrences?: number;
  pages_affected?: number;
  /** Lot 5 : écart mesuré au seuil (module l'impact ROI). */
  gap_ratio?: number;
}

export type SectionKey = 'seo' | 'geo' | 'keywords' | 'eeat' | 'cocoon';

export interface SectionTopPriorities {
  section: SectionKey;
  section_label: string;
  actions: PriorityAction[];   // 0..3 entries
  total_findings: number;      // findings considered before slicing to top-3
  has_blockers: boolean;       // true if ≥1 critical
  /** Lot 5 : nombre de constats après fusion par empreinte. */
  deduped_findings?: number;
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
  /** Lot 5 */
  fingerprint?: string;
  templates?: string[];
  occurrences?: number;
  pages_affected?: number;
  gap_ratio?: number;
  accountability?: Accountability;
}

/** Lot 5 : décompte réel Workbench vs nouveautés, indépendant du tronquage. */
export interface ConsolidatedPlanStats {
  total_candidates: number;
  workbench_open: number;
  newly_detected: number;
  displayed: number;
  merged_duplicates: number;
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
 *
 * Lot 5 : les constats sont d'abord fusionnés par empreinte de consigne, pour
 * qu'une même action déclinée sur plusieurs gabarits n'occupe pas les trois
 * places du Top 3. La portée mesurée (pages, gabarits) est reversée en
 * description.
 */
export function extractTopPriorities(
  section: SectionKey,
  findings: RawFinding[],
): SectionTopPriorities {
  const rawCount = (findings || []).filter((f) => f && (f.title || f.description)).length;

  const grouped = dedupeByFingerprint(
    (findings || []).filter((f) => f && (f.title || f.description)) as Array<RawFinding & Record<string, unknown>>,
  );

  const cleaned = grouped.map((g, idx) => ({
    idx,
    severity: normalizeSeverity(g.item.priority || g.item.severity),
    group: g,
  }));

  cleaned.sort((a, b) => {
    const w = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
    if (w !== 0) return w;
    // À gravité égale, l'action qui couvre le plus de pages/gabarits passe devant.
    const scope = (b.group.pages_affected + b.group.templates.length)
      - (a.group.pages_affected + a.group.templates.length);
    if (scope !== 0) return scope;
    return a.idx - b.idx;
  });

  const top = cleaned.slice(0, 3).map((c, i): PriorityAction => {
    const raw = c.group.item;
    const scope = scopeSentence(c.group);
    return {
      rank: (i + 1) as 1 | 2 | 3,
      severity: c.severity,
      title: raw.title || '(sans titre)',
      description: [raw.description || '', scope].filter(Boolean).join(' '),
      category: raw.category,
      source_section: section,
      next_step: Array.isArray(raw.fixes) && raw.fixes.length > 0 ? raw.fixes[0] : undefined,
      fingerprint: c.group.fingerprint,
      templates: c.group.templates,
      occurrences: c.group.occurrences,
      pages_affected: c.group.pages_affected || raw.pages_affected,
      gap_ratio: typeof raw.gap_ratio === 'number' ? raw.gap_ratio : undefined,
    };
  });

  return {
    section,
    section_label: SECTION_LABELS[section],
    actions: top,
    total_findings: rawCount,
    deduped_findings: cleaned.length,
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
 * Workbench tasks first (open ones), then enrich with any section Top-3 that
 * the workbench hasn't picked up yet, flagged source='newly_detected'.
 *
 * Lot 5 :
 *  - déduplication par empreinte de consigne (et non par titre), donc une même
 *    action déclinée par gabarit n'apparaît qu'une fois, avec ses gabarits ;
 *  - `owner`, `kpi` et estimation de trafic renseignés sur chaque action ;
 *  - décompte réel Workbench / nouveautés remonté via `options.onStats`.
 */
export function buildConsolidatedActionPlan(
  workbench: WorkbenchTask[],
  sections: SectionTopPriorities[],
  options: {
    maxItems?: number;
    traffic?: TrafficContext;
    onStats?: (stats: ConsolidatedPlanStats) => void;
  } = {},
): ConsolidatedPlanItem[] {
  const maxItems = options.maxItems ?? 12;
  const traffic = options.traffic || {};

  // Open workbench tasks first, ranked by severity then created order (assumed in input order)
  const openWb = (workbench || []).filter((w) => (w.status || 'open') !== 'done');
  const wbRanked = [...openWb].sort((a, b) => {
    const sa = SEVERITY_WEIGHT[normalizeSeverity(a.severity)];
    const sb = SEVERITY_WEIGHT[normalizeSeverity(b.severity)];
    return sb - sa;
  });

  // Fusion des tâches Workbench par empreinte : les runs successifs de Marina
  // créent des variantes de la même consigne sur des URL différentes.
  const wbGroups = dedupeByFingerprint(
    wbRanked.map((w) => ({
      ...w,
      title: w.title,
      description: w.description || '',
      category: w.finding_category || undefined,
    })) as Array<Record<string, unknown> & { title: string }>,
  );

  const seenFingerprints = new Set<string>();
  const items: ConsolidatedPlanItem[] = [];
  let rank = 1;
  let mergedDuplicates = 0;

  for (const g of wbGroups) {
    mergedDuplicates += g.occurrences - 1;
    seenFingerprints.add(g.fingerprint);
    if (items.length >= maxItems) continue;
    const w = g.item as unknown as WorkbenchTask;
    const scope = scopeSentence(g);
    const base = {
      title: w.title,
      description: w.description || '',
      category: w.finding_category || undefined,
      pages_affected: g.pages_affected,
    };
    items.push({
      rank: rank++,
      severity: normalizeSeverity(w.severity),
      title: w.title,
      description: [w.description || '', scope].filter(Boolean).join(' '),
      category: w.finding_category || undefined,
      source: 'workbench',
      workbench_id: w.id,
      fingerprint: g.fingerprint,
      templates: g.templates,
      occurrences: g.occurrences,
      pages_affected: g.pages_affected,
      accountability: buildAccountability(base, traffic, g.fingerprint),
    });
  }

  // Now inject section Top-3 that aren't already covered, ordered by severity
  const sectionPool: Array<PriorityAction & { _fp: string }> = [];
  for (const s of sections) {
    for (const a of s.actions) {
      sectionPool.push({ ...a, _fp: a.fingerprint || fingerprintFinding(a) });
    }
  }
  sectionPool.sort(
    (a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity],
  );

  let newlyDetected = 0;
  for (const a of sectionPool) {
    if (a._fp && seenFingerprints.has(a._fp)) { mergedDuplicates++; continue; }
    seenFingerprints.add(a._fp);
    newlyDetected++;
    if (items.length >= maxItems) continue;
    items.push({
      rank: rank++,
      severity: a.severity,
      title: a.title,
      description: a.description,
      category: a.category,
      source: 'newly_detected',
      source_section: a.source_section,
      fingerprint: a._fp,
      templates: a.templates,
      occurrences: a.occurrences,
      pages_affected: a.pages_affected,
      gap_ratio: a.gap_ratio,
      accountability: buildAccountability(
        { title: a.title, description: a.description, category: a.category, pages_affected: a.pages_affected },
        traffic,
        a._fp,
      ),
    });
  }

  options.onStats?.({
    total_candidates: wbGroups.length + newlyDetected,
    workbench_open: wbGroups.length,
    newly_detected: newlyDetected,
    displayed: items.length,
    merged_duplicates: mergedDuplicates,
  });

  // Un gain de trafic identique recopié sur plusieurs actions du même levier
  // n'est pas une estimation : on le répartit entre les actions concernées.
  distributeTrafficGains(items as Array<{ fingerprint?: string; accountability?: Accountability | null }>);

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

const MAX_TITLE_CHARS = 80;

/**
 * Les titres produits par les modules LLM dépassent parfois 150 caractères et
 * étaient tronqués visuellement dans le PDF. On garde une accroche courte et on
 * reverse le reste en tête de description : aucune information n'est perdue.
 */
export function splitLongTitle(
  rawTitle: string,
  rawDescription?: string,
): { title: string; description: string } {
  const title = (rawTitle || '').replace(/\s+/g, ' ').trim();
  const description = (rawDescription || '').replace(/\s+/g, ' ').trim();
  if (title.length <= MAX_TITLE_CHARS) return { title, description };

  const head = title.slice(0, MAX_TITLE_CHARS + 20);

  // 1. Coupe idéale : une vraie fin de phrase. Le reste est déjà une phrase
  //    autonome, on peut le passer en description sans le retoucher.
  let cut = -1;
  let atSentenceEnd = false;
  const sentenceEnd = /[.!?](?=\s)/g;
  let m: RegExpExecArray | null;
  while ((m = sentenceEnd.exec(head)) !== null) {
    if (m.index >= 30) { cut = m.index + 1; atSentenceEnd = true; }
  }

  // 2. Sinon, coupe sur un séparateur de proposition (deux-points, tiret cadratin).
  //    On exclut «, », « pour », « afin » : couper là fabrique une fausse phrase
  //    (« … est un frein majeur à » / « L'expérience utilisateur et au SEO. »).
  if (cut < 0) {
    for (const b of [' : ', ' — ', ' – ']) {
      const idx = head.lastIndexOf(b);
      if (idx >= 30 && idx > cut) cut = idx;
    }
  }

  // 3. Dernier recours : coupe sur un espace, et le reste est marqué comme
  //    continuation (« … ») sans recapitalisation.
  if (cut < 0) {
    const space = title.lastIndexOf(' ', MAX_TITLE_CHARS);
    cut = space >= 30 ? space : MAX_TITLE_CHARS;
  }

  const shortTitle = title.slice(0, cut).replace(/[\s:,–—-]+$/, '');
  const remainder = title.slice(cut).replace(/^[\s:,–—-]+/, '').trim();
  if (!remainder) return { title: shortTitle, description };

  const sentence = atSentenceEnd
    // Phrase complète : capitalisation légitime de son premier caractère.
    ? remainder.charAt(0).toUpperCase() + remainder.slice(1)
    // Fragment : on préserve la casse d'origine et on signale la continuation.
    : `${shortTitle.replace(/[.…]+$/, '')}${/^[a-zà-öø-ÿ]/.test(remainder) ? ' ' : ' — '}${remainder}`;

  const merged = [/[.!?…]$/.test(sentence) ? sentence : `${sentence}.`, description]
    .filter(Boolean)
    .join(' ');
  const shortDisplay = atSentenceEnd ? shortTitle : `${shortTitle.replace(/[.…]+$/, '')}…`;
  return { title: shortDisplay, description: merged };
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
    const { title, description } = splitLongTitle(a.title, a.description);
    return `<li style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #f3f4f6;">
      <div style="flex-shrink:0;width:28px;height:28px;border-radius:50%;background:#111827;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;">${a.rank}</div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
          <span style="font-weight:600;font-size:13.5px;color:#111827;">${escapeHtml(title)}</span>
          <span style="background:${badge.bg};color:${badge.fg};padding:2px 8px;border-radius:10px;font-size:10.5px;font-weight:600;letter-spacing:0.2px;">${badge.label}</span>
        </div>
        ${description ? `<div style="font-size:12.5px;color:#4b5563;line-height:1.45;">${escapeHtml(description)}</div>` : ''}
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
 * Lot 5 : colonne « Pilote & KPI » (owner, KPI, gain estimé), gabarits
 * regroupés visibles, et décompte réel Workbench / nouveautés.
 */
export function renderConsolidatedPlanHTML(
  items: Array<ConsolidatedPlanItem & { roi?: RoiAnnotation }>,
  stats?: ConsolidatedPlanStats,
): string {
  if (!items.length) {
    return `<div class="section">
      <div class="section-title">Plan d'action consolidé</div>
      <p style="color:#6b7280;font-size:13px;">Aucune action en attente. Excellente hygiène SEO/GEO.</p>
    </div>`;
  }

  const rows = items.map((it) => {
    const badge = SEVERITY_BADGE[it.severity];
    const { title, description } = splitLongTitle(it.title, it.description);
    const origin = it.source === 'workbench'
      ? `<span style="background:#ede9fe;color:#5b21b6;padding:2px 8px;border-radius:8px;font-size:10.5px;font-weight:600;">Workbench</span>`
      : `<span style="background:#fef3c7;color:#7c5b00;padding:2px 8px;border-radius:8px;font-size:10.5px;font-weight:600;">Nouveau · ${escapeHtml(SECTION_LABELS[it.source_section || 'seo'])}</span>`;
    const roiCell = it.roi
      ? `<div><span style="background:${ROI_TIER_STYLE[it.roi.tier].bg};color:${ROI_TIER_STYLE[it.roi.tier].fg};padding:2px 8px;border-radius:8px;font-size:10.5px;font-weight:600;">${escapeHtml(it.roi.tier_label)}</span></div>
         <div style="font-size:10.5px;color:#6b7280;margin-top:4px;">${escapeHtml(it.roi.effort_label)}</div>`
      : '<span style="font-size:11px;color:#9ca3af;">n/d</span>';
    const acc = it.accountability;
    const accCell = acc
      ? `<div style="font-size:11.5px;color:#111827;font-weight:600;">${escapeHtml(acc.owner)}</div>
         <div style="font-size:10.5px;color:#6b7280;margin-top:3px;">KPI : ${escapeHtml(acc.kpi)}</div>
         <div style="font-size:10.5px;color:${acc.traffic_gain !== null ? '#4b5563' : '#9ca3af'};margin-top:3px;">${
           acc.traffic_gain !== null
             ? `+${acc.traffic_gain} visites/mois estimées`
             : 'Gain non estimable'
         }</div>`
      : '<span style="font-size:11px;color:#9ca3af;">n/d</span>';
    const scope = (it.templates && it.templates.length > 1)
      ? `<div style="font-size:10.5px;color:#6b7280;margin-top:4px;">Gabarits concernés : ${escapeHtml(it.templates.slice(0, 8).join(', '))}</div>`
      : '';
    return `<tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:10px 12px;font-weight:700;color:#111827;font-size:13px;">${it.rank}</td>
      <td style="padding:10px 12px;">
        <div style="font-weight:600;font-size:13px;color:#111827;margin-bottom:3px;">${escapeHtml(title)}</div>
        ${description ? `<div style="font-size:12px;color:#4b5563;line-height:1.45;">${escapeHtml(description)}</div>` : ''}
        ${scope}
        ${it.roi ? `<div style="font-size:11px;color:#6b7280;margin-top:5px;">${escapeHtml(it.roi.roi_note)}</div>` : ''}
        ${acc ? `<div style="font-size:10.5px;color:#9ca3af;margin-top:4px;">Base de l'estimation : ${escapeHtml(acc.traffic_basis)}</div>` : ''}
      </td>
      <td style="padding:10px 12px;white-space:nowrap;">
        <span style="background:${badge.bg};color:${badge.fg};padding:2px 8px;border-radius:8px;font-size:10.5px;font-weight:600;">${badge.label}</span>
      </td>
      <td style="padding:10px 12px;white-space:nowrap;">${roiCell}</td>
      <td style="padding:10px 12px;">${accCell}</td>
      <td style="padding:10px 12px;white-space:nowrap;">${origin}</td>
    </tr>`;
  }).join('');

  const wbCount = stats?.workbench_open ?? items.filter((i) => i.source === 'workbench').length;
  const newCount = stats?.newly_detected ?? (items.length - items.filter((i) => i.source === 'workbench').length);
  const total = stats?.total_candidates ?? items.length;
  const merged = stats?.merged_duplicates ?? 0;
  

  return `<div class="section">
    <div class="section-title">Plan d'action consolidé</div>
    <p style="font-size:12.5px;color:#4b5563;margin-bottom:6px;">
      ${total} action${total > 1 ? 's' : ''} distincte${total > 1 ? 's' : ''} retenue${total > 1 ? 's' : ''} —
      ${wbCount} déjà ouverte${wbCount > 1 ? 's' : ''} dans votre Workbench, ${newCount} nouvellement détectée${newCount > 1 ? 's' : ''} dans ce rapport.
      ${items.length < total ? `Les ${items.length} premières sont détaillées ci-dessous.` : ''}
      ${merged > 0 ? `${merged} constat${merged > 1 ? 's' : ''} redondant${merged > 1 ? 's' : ''} ${merged > 1 ? 'ont' : 'a'} été fusionné${merged > 1 ? 's' : ''} dans l'action correspondante.` : ''}
    </p>
    <p style="font-size:12.5px;color:#4b5563;margin-bottom:12px;">
      Les blocages critiques restent en tête quel que soit leur rendement ;
      à gravité égale, l'ordre suit le rapport impact / effort. Chaque action porte un pilote,
      un indicateur de suivi et, quand une donnée mesurée l'autorise, une estimation de gain.
    </p>

    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <thead><tr style="background:#f9fafb;">
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">#</th>
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Action</th>
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Sévérité</th>
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Rendement</th>
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Pilote &amp; KPI</th>
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Origine</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

