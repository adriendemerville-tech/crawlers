/**
 * MatricePreviewCanvas — Aperçu pré-audit "preuve de compréhension".
 * Affiché dès que des critères sont chargés (rows.length > 0) ET que l'audit
 * n'a pas encore produit de résultats. Donne à l'utilisateur la confirmation
 * visuelle que sa matrice a été correctement parsée et structurée.
 *
 * Charte: bordure violette, fond transparent, pas d'emoji, pas de bleu IA.
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { MatricePivotView } from './MatricePivotView';
import {
  resolveAuditRoutes,
  type ParsedCriterion,
} from '@/utils/matrice/resolveAuditRoutes';
import type { MatrixResult } from '@/utils/matrice/matrixOrchestrator';

export interface MatricePreviewCriterion {
  id: string;
  title: string;
  category: string;
  selected: boolean;
  rawRow?: Record<string, any>;
}

export interface MatricePreviewCanvasProps {
  criteria: MatricePreviewCriterion[];
  className?: string;
}

function formatDuration(sec: number): string {
  if (sec < 60) return `~${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `~${m} min ${s}s` : `~${m} min`;
}

export function MatricePreviewCanvas({
  criteria,
  className,
}: MatricePreviewCanvasProps) {
  // Only consider selected criteria — they reflect what will actually be audited.
  const activeCriteria = useMemo(
    () => criteria.filter((c) => c.selected !== false),
    [criteria],
  );

  // Resolve the audit plan client-side (no network).
  const plan = useMemo(() => {
    const parsed: ParsedCriterion[] = activeCriteria.map((c) => ({
      id: c.id,
      title: c.title,
      category: c.category || 'general',
      rawRow: c.rawRow,
    }));
    return resolveAuditRoutes(parsed);
  }, [activeCriteria]);

  // Build empty MatrixResult[] (score=null) so MatricePivotView can render the
  // pivot structure without scores — the cells display "—" and stay neutral.
  const emptyResults = useMemo<MatrixResult[]>(() => {
    return plan.routes.map((r) => ({
      criterionId: r.criterionId,
      criterionTitle: r.criterionTitle,
      matchType: r.matchType,
      parsedScore: null,
      parsedResponse: null,
      crawlersScore: null,
      crawlersData: null,
      sourceFunction: r.fn,
      confidence: r.confidence,
      // criterionCategory consumed by pivot's familyOf()
      ...(r.criterionCategory ? { criterionCategory: r.criterionCategory } : {}),
    }) as MatrixResult);
  }, [plan]);

  // Counters
  const technicalCalls = plan.calls.filter((c) => c.type === 'technical').length;
  const llmCalls = plan.calls.filter((c) => c.type === 'llm').length;
  const familiesCount = useMemo(() => {
    const set = new Set<string>();
    activeCriteria.forEach((c) => set.add(c.category || 'general'));
    return set.size;
  }, [activeCriteria]);

  if (activeCriteria.length === 0) return null;

  return (
    <div
      className={cn(
        'border-2 border-brand-violet rounded-md p-4 bg-transparent',
        className,
      )}
      aria-label="Aperçu de la matrice avant analyse"
    >
      {/* Header — preuve de compréhension */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Aperçu de la matrice
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Structure parsée · prête à être auditée
          </p>
        </div>
        <span className="text-[11px] font-mono text-brand-gold uppercase tracking-wider">
          en attente d'analyse
        </span>
      </div>

      {/* Résumé du plan */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <PreviewStat label="Critères" value={activeCriteria.length} />
        <PreviewStat label="Familles" value={familiesCount} />
        <PreviewStat
          label="Appels backend"
          value={`${technicalCalls + llmCalls}`}
          hint={`${technicalCalls} tech · ${llmCalls} LLM`}
        />
        <PreviewStat
          label="Durée estimée"
          value={formatDuration(plan.estimatedDurationSec)}
        />
      </div>

      {/* Pivot vide — confirme visuellement la structure (axes × types de scoring) */}
      <MatricePivotView results={emptyResults} />
    </div>
  );
}

function PreviewStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="border border-border/60 rounded-md px-3 py-2 bg-transparent">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-base font-mono font-semibold text-foreground mt-0.5">
        {value}
      </div>
      {hint && (
        <div className="text-[10px] text-muted-foreground/80 font-mono mt-0.5">
          {hint}
        </div>
      )}
    </div>
  );
}

export default MatricePreviewCanvas;
