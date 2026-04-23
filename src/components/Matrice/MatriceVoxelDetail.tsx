/**
 * MatriceVoxelDetail — Drill-down panel showing the underlying criteria of a
 * selected voxel (or a selected pivot family). Lists each criterion with its
 * score, match type, and any parsed justification.
 *
 * Charte: bordered, no bg fill, no emoji, brand colors only.
 */

import { X, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scoreToHeatClasses, scoreToBucket, bucketToHsl } from '@/utils/matrice/heatmapScale';
import type { MatrixResult } from '@/utils/matrice/matrixOrchestrator';

export interface MatriceVoxelDetailProps {
  title: string;
  subtitle?: string;
  results: MatrixResult[];
  onClose: () => void;
  className?: string;
}

export function MatriceVoxelDetail({
  title,
  subtitle,
  results,
  onClose,
  className,
}: MatriceVoxelDetailProps) {
  const valid = results
    .map(r => r.parsedScore)
    .filter((s): s is number => typeof s === 'number');
  const avg = valid.length > 0
    ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
    : null;

  return (
    <aside
      className={cn(
        'flex flex-col gap-3 p-4',
        'border-2 border-brand-violet rounded-md bg-transparent',
        className,
      )}
      role="complementary"
      aria-label="Détail des critères"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-brand-violet font-mono">
            Détail
          </p>
          <h3 className="text-sm font-semibold text-foreground truncate" title={title}>
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate" title={subtitle}>
              {subtitle}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-md border border-foreground/40 text-foreground hover:border-brand-gold transition-colors bg-transparent"
          aria-label="Fermer le panneau"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="flex items-center justify-between text-xs border-t border-brand-violet/30 pt-2">
        <span className="text-muted-foreground">Critères agrégés</span>
        <span className="font-mono">{results.length}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Score moyen</span>
        <span
          className="font-mono font-semibold"
          style={{ color: avg != null ? bucketToHsl(scoreToBucket(avg)) : undefined }}
        >
          {avg != null ? `${avg}/100` : '—'}
        </span>
      </div>

      <ul className="flex flex-col gap-2 max-h-[420px] overflow-y-auto -mx-1 px-1">
        {results.map((r) => (
          <li
            key={r.criterionId}
            className="flex flex-col gap-1.5 p-2.5 border border-brand-violet/30 rounded-md bg-transparent hover:border-brand-violet transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-foreground leading-snug flex-1">
                {r.criterionTitle}
              </p>
              <span
                className={cn(
                  'shrink-0 px-1.5 py-0.5 text-[10px] font-mono rounded',
                  r.parsedScore != null && scoreToHeatClasses(r.parsedScore),
                )}
              >
                {r.parsedScore != null ? `${r.parsedScore}` : '—'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
              <span>{r.matchType}</span>
              <span aria-hidden>·</span>
              <span className="truncate" title={r.sourceFunction}>{r.sourceFunction}</span>
            </div>
            {r.parsedResponse && (
              <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground border-t border-brand-violet/20 pt-1.5">
                <FileText className="h-3 w-3 shrink-0 mt-0.5 text-brand-violet" aria-hidden />
                <p className="leading-snug line-clamp-3">{r.parsedResponse}</p>
              </div>
            )}
          </li>
        ))}
        {results.length === 0 && (
          <li className="text-xs text-muted-foreground text-center py-4">
            Aucun critère dans cette sélection.
          </li>
        )}
      </ul>
    </aside>
  );
}

export default MatriceVoxelDetail;
