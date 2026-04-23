/**
 * pivotTransform — Builds pivot rows grouped by family (criterionCategory or fn-derived)
 * with per-column means and a row total. Used by MatricePivotView.
 */

import type { MatrixResult } from './matrixOrchestrator';

export interface PivotCell {
  score: number | null;
  count: number;        // nb of underlying results
  results: MatrixResult[];
}

export interface PivotRow {
  familyId: string;
  familyLabel: string;
  cells: Record<string, PivotCell>;  // keyed by column id
  totalScore: number | null;
  totalCount: number;
  children?: MatrixResult[];          // raw rows for expand/collapse
}

export interface PivotShape {
  rows: PivotRow[];
  columns: { id: string; label: string }[];
  globalScore: number | null;
}

const FAMILY_LABELS: Record<string, string> = {
  'check-meta-tags': 'Balises & Meta',
  'check-structured-data': 'Données structurées',
  'check-robots-indexation': 'Robots & Indexation',
  'check-images': 'Images',
  'check-pagespeed': 'Performance',
  'check-backlinks': 'Backlinks',
  'check-crawlers': 'Bots & Crawlers',
  'check-geo': 'GEO / IA',
  'check-direct-answer': 'Réponse directe',
  'check-eeat': 'E-E-A-T',
  'check-content-quality': 'Qualité contenu',
  'check-llm': 'Visibilité LLM',
  'expert-audit': 'Audit expert',
};

const COLUMN_LABELS: Record<string, string> = {
  exact: 'Score direct',
  partial: 'Prompt custom',
  custom_only: 'LLM seul',
};

function familyOf(r: MatrixResult): { id: string; label: string } {
  // Prefer criterionCategory if present and meaningful; fallback to source function.
  const cat = (r as any).criterionCategory as string | undefined;
  if (cat && cat !== 'general') {
    return { id: `cat:${cat}`, label: cat };
  }
  return { id: r.sourceFunction, label: FAMILY_LABELS[r.sourceFunction] || r.sourceFunction };
}

function mean(scores: number[]): number | null {
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function buildPivot(results: MatrixResult[]): PivotShape {
  // Discover columns from matchTypes actually present
  const colSet = new Set<string>();
  results.forEach(r => colSet.add(r.matchType));
  const columns = Array.from(colSet).sort().map(id => ({
    id,
    label: COLUMN_LABELS[id] || id,
  }));

  // Bucket by family
  const byFamily = new Map<string, { label: string; items: MatrixResult[] }>();
  for (const r of results) {
    const fam = familyOf(r);
    if (!byFamily.has(fam.id)) byFamily.set(fam.id, { label: fam.label, items: [] });
    byFamily.get(fam.id)!.items.push(r);
  }

  const rows: PivotRow[] = [];
  for (const [familyId, { label, items }] of byFamily.entries()) {
    const cells: Record<string, PivotCell> = {};
    for (const col of columns) {
      const subset = items.filter(i => i.matchType === col.id);
      const scores = subset.map(s => s.parsedScore).filter((s): s is number => typeof s === 'number');
      cells[col.id] = { score: mean(scores), count: subset.length, results: subset };
    }
    const allScores = items.map(s => s.parsedScore).filter((s): s is number => typeof s === 'number');
    rows.push({
      familyId,
      familyLabel: label,
      cells,
      totalScore: mean(allScores),
      totalCount: items.length,
      children: items,
    });
  }

  // Sort families alphabetically by label for stable UX
  rows.sort((a, b) => a.familyLabel.localeCompare(b.familyLabel, 'fr'));

  const allValid = results.map(r => r.parsedScore).filter((s): s is number => typeof s === 'number');
  const globalScore = mean(allValid);

  return { rows, columns, globalScore };
}
