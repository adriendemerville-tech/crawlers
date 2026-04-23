/**
 * MatriceDeltaView — Sprint 7
 * Pivot-style table comparing audit A vs audit B with delta column per cell.
 * Charte: violet (régression) ↔ gold (progression), pas de bleu IA, pas d'emoji.
 */

import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  buildPivotDelta,
  deltaToHeatClasses,
  formatDelta,
  type DeltaShape,
} from '@/utils/matrice/pivotDelta';
import type { MatrixResult } from '@/utils/matrice/matrixOrchestrator';

export interface MatriceDeltaViewProps {
  resultsA: MatrixResult[];
  resultsB: MatrixResult[];
  labelA?: string;
  labelB?: string;
  className?: string;
}

function DeltaIcon({ value }: { value: number | null }) {
  if (value == null || Math.abs(value) < 1) {
    return <Minus className="inline h-3 w-3" aria-hidden />;
  }
  return value > 0
    ? <ArrowUpRight className="inline h-3 w-3 text-brand-gold" aria-hidden />
    : <ArrowDownRight className="inline h-3 w-3 text-brand-violet" aria-hidden />;
}

export function MatriceDeltaView({
  resultsA,
  resultsB,
  labelA = 'Audit A',
  labelB = 'Audit B',
  className,
}: MatriceDeltaViewProps) {
  const delta: DeltaShape = useMemo(
    () => buildPivotDelta(resultsA, resultsB),
    [resultsA, resultsB],
  );

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Comparaison</h3>
        <div className="flex items-center gap-4 text-xs font-mono">
          <span>
            <span className="text-muted-foreground">{labelA} : </span>
            <span className="text-foreground">{delta.globalA ?? '—'}</span>
          </span>
          <span>
            <span className="text-muted-foreground">{labelB} : </span>
            <span className="text-foreground">{delta.globalB ?? '—'}</span>
          </span>
          <span className={cn('inline-flex items-center gap-1', deltaToHeatClasses(delta.globalDelta))}>
            Δ <DeltaIcon value={delta.globalDelta} /> {formatDelta(delta.globalDelta)}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto border-2 border-brand-violet rounded-md bg-transparent">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-brand-violet/40">
                Famille
              </th>
              {delta.columns.map(col => (
                <th
                  key={col.id}
                  className="px-3 py-2 text-center text-xs uppercase tracking-wider text-muted-foreground border-b border-brand-violet/40"
                  colSpan={3}
                >
                  {col.label}
                </th>
              ))}
              <th className="px-3 py-2 text-center text-xs uppercase tracking-wider text-muted-foreground border-b border-brand-violet/40" colSpan={3}>
                Total
              </th>
            </tr>
            <tr>
              <th className="px-3 py-1 border-b border-brand-violet/20" />
              {[...delta.columns, { id: '__total__', label: '' }].map(col => (
                <>
                  <th key={`${col.id}-a`} className="px-2 py-1 text-[10px] text-muted-foreground border-b border-brand-violet/20">A</th>
                  <th key={`${col.id}-b`} className="px-2 py-1 text-[10px] text-muted-foreground border-b border-brand-violet/20">B</th>
                  <th key={`${col.id}-d`} className="px-2 py-1 text-[10px] text-muted-foreground border-b border-brand-violet/20">Δ</th>
                </>
              ))}
            </tr>
          </thead>
          <tbody>
            {delta.rows.map(row => (
              <tr key={row.familyId} className="hover:bg-brand-violet/5 transition-colors">
                <td className="px-3 py-2 border-b border-brand-violet/20 font-medium text-foreground">
                  {row.familyLabel}
                  {!row.presentInA && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-brand-gold">nouveau</span>
                  )}
                  {!row.presentInB && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-brand-violet">retiré</span>
                  )}
                </td>
                {delta.columns.map(col => {
                  const c = row.cells[col.id];
                  return (
                    <>
                      <td key={`${col.id}-a`} className="px-2 py-2 text-center font-mono text-xs border-b border-brand-violet/20">
                        {c.scoreA ?? '—'}
                      </td>
                      <td key={`${col.id}-b`} className="px-2 py-2 text-center font-mono text-xs border-b border-brand-violet/20">
                        {c.scoreB ?? '—'}
                      </td>
                      <td key={`${col.id}-d`} className={cn(
                        'px-2 py-2 text-center font-mono text-xs border-b border-brand-violet/20',
                        deltaToHeatClasses(c.delta),
                      )}>
                        <DeltaIcon value={c.delta} /> {formatDelta(c.delta)}
                      </td>
                    </>
                  );
                })}
                <td className="px-2 py-2 text-center font-mono text-xs font-semibold border-b border-brand-violet/20">
                  {row.totalA ?? '—'}
                </td>
                <td className="px-2 py-2 text-center font-mono text-xs font-semibold border-b border-brand-violet/20">
                  {row.totalB ?? '—'}
                </td>
                <td className={cn(
                  'px-2 py-2 text-center font-mono text-xs font-semibold border-b border-brand-violet/20',
                  deltaToHeatClasses(row.totalDelta),
                )}>
                  <DeltaIcon value={row.totalDelta} /> {formatDelta(row.totalDelta)}
                </td>
              </tr>
            ))}
            {delta.rows.length === 0 && (
              <tr>
                <td colSpan={delta.columns.length * 3 + 4} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Aucune famille à comparer.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Δ positif = progression (or). Δ négatif = régression (violet). Tri par amplitude de variation.
      </p>
    </div>
  );
}

export default MatriceDeltaView;
