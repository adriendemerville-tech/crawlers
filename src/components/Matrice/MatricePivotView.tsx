/**
 * MatricePivotView — Pivot table placeholder (Sprint 2 wiring with @tanstack/react-table).
 * Currently renders a basic grid + heatmap toggle as visual scaffold.
 * Charte: bordered, no bg fill, violet → gold heatmap (no IA-blue).
 */

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { scoreToHeatClasses } from '@/utils/matrice/heatmapScale';
import type { MatrixResult } from '@/utils/matrice/matrixOrchestrator';

export interface MatricePivotViewProps {
  results: MatrixResult[];
  className?: string;
}

export function MatricePivotView({ results, className }: MatricePivotViewProps) {
  const [heatmapOn, setHeatmapOn] = useState(true);

  // Group by source function (rows) × matchType (columns) — placeholder pivot
  const { rowKeys, colKeys, grid } = useMemo(() => {
    const rows = new Set<string>();
    const cols = new Set<string>();
    const g = new Map<string, MatrixResult[]>();
    for (const r of results) {
      rows.add(r.sourceFunction);
      cols.add(r.matchType);
      const key = `${r.sourceFunction}__${r.matchType}`;
      const arr = g.get(key) || [];
      arr.push(r);
      g.set(key, arr);
    }
    return { rowKeys: [...rows].sort(), colKeys: [...cols].sort(), grid: g };
  }, [results]);

  const cellMean = (cell: MatrixResult[] | undefined): number | null => {
    if (!cell || cell.length === 0) return null;
    const scores = cell.map(c => c.parsedScore).filter((s): s is number => typeof s === 'number');
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  };

  if (results.length === 0) {
    return (
      <div className={cn(
        'p-8 text-center text-sm text-muted-foreground',
        'border-2 border-dashed border-brand-violet rounded-md bg-transparent',
        className,
      )}>
        Aucun résultat à afficher. Lancez un audit pour peupler la matrice.
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Vue Pivot</h3>
        <label className="inline-flex items-center gap-2 cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={heatmapOn}
            onChange={(e) => setHeatmapOn(e.target.checked)}
            className="accent-brand-violet"
          />
          <span>Heatmap</span>
        </label>
      </div>

      <div className="overflow-x-auto border-2 border-brand-violet rounded-md bg-transparent">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-brand-violet/40">
                Famille
              </th>
              {colKeys.map(c => (
                <th
                  key={c}
                  className="px-3 py-2 text-center text-xs uppercase tracking-wider text-muted-foreground border-b border-brand-violet/40"
                >
                  {c}
                </th>
              ))}
              <th className="px-3 py-2 text-center text-xs uppercase tracking-wider text-brand-gold border-b border-brand-violet/40">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rowKeys.map(r => {
              const rowCells = colKeys.map(c => cellMean(grid.get(`${r}__${c}`)));
              const valid = rowCells.filter((v): v is number => v != null);
              const rowMean = valid.length > 0 ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
              return (
                <tr key={r}>
                  <td className="px-3 py-2 font-medium text-foreground border-b border-brand-violet/20">
                    {r}
                  </td>
                  {rowCells.map((v, i) => (
                    <td
                      key={i}
                      className={cn(
                        'px-3 py-2 text-center font-mono border-b border-brand-violet/20 transition-colors',
                        heatmapOn && v != null && scoreToHeatClasses(v),
                      )}
                    >
                      {v != null ? v : '—'}
                    </td>
                  ))}
                  <td className={cn(
                    'px-3 py-2 text-center font-mono font-semibold border-b border-brand-violet/20',
                    heatmapOn && rowMean != null && scoreToHeatClasses(rowMean),
                  )}>
                    {rowMean != null ? rowMean : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Vue pivot simplifiée — Sprint 2 ajoutera tri, filtres, expand/collapse via @tanstack/react-table.
      </p>
    </div>
  );
}

export default MatricePivotView;
