/**
 * pivotDelta — Sprint 7
 * Builds a comparison structure between two pivot snapshots (audit A vs audit B).
 * Δ = scoreB - scoreA. Positive = improvement, negative = regression.
 */

import type { PivotShape, PivotRow, PivotCell } from './pivotTransform';
import { buildPivot } from './pivotTransform';
import type { MatrixResult } from './matrixOrchestrator';

export interface DeltaCell {
  scoreA: number | null;
  scoreB: number | null;
  delta: number | null; // null if either side missing
  countA: number;
  countB: number;
}

export interface DeltaRow {
  familyId: string;
  familyLabel: string;
  cells: Record<string, DeltaCell>;
  totalA: number | null;
  totalB: number | null;
  totalDelta: number | null;
  presentInA: boolean;
  presentInB: boolean;
}

export interface DeltaShape {
  rows: DeltaRow[];
  columns: { id: string; label: string }[];
  globalA: number | null;
  globalB: number | null;
  globalDelta: number | null;
}

function diff(a: number | null, b: number | null): number | null {
  if (typeof a !== 'number' || typeof b !== 'number') return null;
  return Math.round((b - a) * 10) / 10;
}

export function buildPivotDelta(
  resultsA: MatrixResult[],
  resultsB: MatrixResult[],
): DeltaShape {
  const pivotA: PivotShape = buildPivot(resultsA);
  const pivotB: PivotShape = buildPivot(resultsB);

  // Merge column union, preserving stable order (A first, then B exclusives).
  const colMap = new Map<string, { id: string; label: string }>();
  for (const c of pivotA.columns) colMap.set(c.id, c);
  for (const c of pivotB.columns) if (!colMap.has(c.id)) colMap.set(c.id, c);
  const columns = Array.from(colMap.values());

  const rowsA = new Map(pivotA.rows.map(r => [r.familyId, r]));
  const rowsB = new Map(pivotB.rows.map(r => [r.familyId, r]));
  const familyIds = new Set<string>([...rowsA.keys(), ...rowsB.keys()]);

  const rows: DeltaRow[] = [];
  for (const fid of familyIds) {
    const ra: PivotRow | undefined = rowsA.get(fid);
    const rb: PivotRow | undefined = rowsB.get(fid);
    const label = ra?.familyLabel || rb?.familyLabel || fid;
    const cells: Record<string, DeltaCell> = {};
    for (const col of columns) {
      const ca: PivotCell | undefined = ra?.cells[col.id];
      const cb: PivotCell | undefined = rb?.cells[col.id];
      const sa = ca?.score ?? null;
      const sb = cb?.score ?? null;
      cells[col.id] = {
        scoreA: sa,
        scoreB: sb,
        delta: diff(sa, sb),
        countA: ca?.count ?? 0,
        countB: cb?.count ?? 0,
      };
    }
    rows.push({
      familyId: fid,
      familyLabel: label,
      cells,
      totalA: ra?.totalScore ?? null,
      totalB: rb?.totalScore ?? null,
      totalDelta: diff(ra?.totalScore ?? null, rb?.totalScore ?? null),
      presentInA: !!ra,
      presentInB: !!rb,
    });
  }

  // Sort: biggest absolute delta first, nulls at the end.
  rows.sort((a, b) => {
    const da = a.totalDelta == null ? -Infinity : Math.abs(a.totalDelta);
    const db = b.totalDelta == null ? -Infinity : Math.abs(b.totalDelta);
    return db - da;
  });

  return {
    rows,
    columns,
    globalA: pivotA.globalScore,
    globalB: pivotB.globalScore,
    globalDelta: diff(pivotA.globalScore, pivotB.globalScore),
  };
}

/**
 * deltaToHeatClasses — Color classes for a Δ value.
 * Charte: violet (régression) ↔ gold (progression). No IA-blue.
 */
export function deltaToHeatClasses(delta: number | null): string {
  if (delta == null) return 'text-muted-foreground';
  if (delta >= 15) return 'text-brand-gold font-semibold';
  if (delta >= 5) return 'text-brand-gold';
  if (delta > -5) return 'text-muted-foreground';
  if (delta > -15) return 'text-brand-violet';
  return 'text-brand-violet font-semibold';
}

export function formatDelta(delta: number | null): string {
  if (delta == null) return '—';
  if (delta === 0) return '0';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta}`;
}
