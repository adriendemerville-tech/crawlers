/**
 * MatriceProgressTracker — Live progress for the audit plan execution.
 * Visualises N prompts × P LLMs staggering.
 * Charte: bordered, no bg fill, brand colors only.
 */

import { cn } from '@/lib/utils';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export interface MatriceProgressItem {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  detail?: string; // e.g. "gemini · prompt 2/5"
}

export interface MatriceProgressTrackerProps {
  completed: number;
  total: number;
  currentLabel?: string;
  items?: MatriceProgressItem[];
  className?: string;
}

export function MatriceProgressTracker({
  completed,
  total,
  currentLabel,
  items,
  className,
}: MatriceProgressTrackerProps) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-4',
        'border-2 border-brand-violet rounded-md bg-transparent',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {completed < total ? (
            <Loader2 className="h-4 w-4 text-brand-violet animate-spin shrink-0" aria-hidden />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-brand-gold shrink-0" aria-hidden />
          )}
          <span className="text-sm font-medium truncate">
            {currentLabel || (completed >= total ? 'Audit terminé' : 'Audit en cours')}
          </span>
        </div>
        <span className="text-xs font-mono text-brand-gold shrink-0">
          {completed}/{total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 border border-brand-violet rounded-full overflow-hidden bg-transparent">
        <div
          className="h-full bg-brand-violet transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>

      {/* Per-call breakdown */}
      {items && items.length > 0 && (
        <ul className="flex flex-col gap-1.5 max-h-48 overflow-y-auto mt-1">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center gap-2 text-xs"
            >
              {it.status === 'pending' && (
                <span className="h-2 w-2 rounded-full border border-foreground/40 shrink-0" aria-hidden />
              )}
              {it.status === 'running' && (
                <Loader2 className="h-3 w-3 text-brand-violet animate-spin shrink-0" aria-hidden />
              )}
              {it.status === 'done' && (
                <CheckCircle2 className="h-3 w-3 text-brand-gold shrink-0" aria-hidden />
              )}
              {it.status === 'error' && (
                <AlertCircle className="h-3 w-3 text-destructive shrink-0" aria-hidden />
              )}
              <span className="truncate flex-1">{it.label}</span>
              {it.detail && (
                <span className="text-muted-foreground font-mono shrink-0">{it.detail}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default MatriceProgressTracker;
