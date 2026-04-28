/**
 * MatricePreviewCanvas — Aperçu pré-audit "preuve de compréhension".
 * Affiché dès que des critères sont chargés (rows.length > 0) ET que l'audit
 * n'a pas encore produit de résultats. Donne à l'utilisateur la confirmation
 * visuelle que sa matrice a été correctement parsée et structurée.
 *
 * Phase 2 — bouton "Analyser la structure" qui déclenche un appel Lovable AI
 * (Gemini Flash Lite) pour classer chaque critère et fournir une reformulation
 * sémantique. Donne à l'user la preuve que la matrice est aussi *comprise*,
 * pas juste parsée.
 *
 * Charte: bordure violette, fond transparent, pas d'emoji, pas de bleu IA.
 */

import { useMemo } from 'react';
import { Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MatricePivotView } from './MatricePivotView';
import {
  resolveAuditRoutes,
  type ParsedCriterion,
} from '@/utils/matrice/resolveAuditRoutes';
import type { MatrixResult } from '@/utils/matrice/matrixOrchestrator';
import {
  useMatriceClassification,
  type MatriceFamily,
} from '@/hooks/useMatriceClassification';

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

const FAMILY_LABEL: Record<MatriceFamily, string> = {
  technical: 'Technique',
  content: 'Contenu',
  eeat: 'E-E-A-T',
  geo: 'GEO / LLM',
  performance: 'Performance',
  links: 'Maillage',
  security: 'Sécurité',
  other: 'Autre',
};

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
  const classifier = useMatriceClassification();

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

  // Build empty MatrixResult[] (score=null). When classification results are
  // available, override the criterion category with the LLM-detected family so
  // the pivot regroups by *understood* family rather than raw axe.
  const emptyResults = useMemo<MatrixResult[]>(() => {
    return plan.routes.map((r) => {
      const cls = classifier.results?.[r.criterionId];
      const familyCategory = cls ? FAMILY_LABEL[cls.family] : r.criterionCategory;
      const reformulated = cls?.reformulation || r.criterionTitle;
      return {
        criterionId: r.criterionId,
        criterionTitle: reformulated,
        matchType: r.matchType,
        parsedScore: null,
        parsedResponse: null,
        crawlersScore: null,
        crawlersData: null,
        sourceFunction: r.fn,
        confidence: cls?.confidence ?? r.confidence,
        ...(familyCategory ? { criterionCategory: familyCategory } : {}),
      } as MatrixResult;
    });
  }, [plan, classifier.results]);

  // Counters
  const technicalCalls = plan.calls.filter((c) => c.type === 'technical').length;
  const llmCalls = plan.calls.filter((c) => c.type === 'llm').length;
  const familiesCount = useMemo(() => {
    if (classifier.results) {
      const set = new Set<string>();
      Object.values(classifier.results).forEach((r) => set.add(r.family));
      return set.size;
    }
    const set = new Set<string>();
    activeCriteria.forEach((c) => set.add(c.category || 'general'));
    return set.size;
  }, [activeCriteria, classifier.results]);

  // Average classification confidence — surfaced once the LLM pass is done.
  const avgConfidence = useMemo(() => {
    if (!classifier.results) return null;
    const vals = Object.values(classifier.results).map((r) => r.confidence);
    if (vals.length === 0) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100);
  }, [classifier.results]);

  if (activeCriteria.length === 0) return null;

  const isAnalyzed = !!classifier.results;
  const isLoading = classifier.loading;

  const handleAnalyze = () => {
    classifier.classify(
      activeCriteria.map((c) => ({ id: c.id, title: c.title, category: c.category })),
    );
  };

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
            {isAnalyzed
              ? 'Structure parsée et comprise — prête à être auditée'
              : 'Structure parsée — analysez la sémantique pour valider la compréhension'}
          </p>
        </div>
        <span
          className={cn(
            'text-[11px] font-mono uppercase tracking-wider',
            isAnalyzed ? 'text-brand-violet' : 'text-brand-gold',
          )}
        >
          {isAnalyzed ? 'analysée' : 'en attente d\'analyse'}
        </span>
      </div>

      {/* Résumé du plan */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <PreviewStat label="Critères" value={activeCriteria.length} />
        <PreviewStat
          label={isAnalyzed ? 'Familles détectées' : 'Familles'}
          value={familiesCount}
        />
        <PreviewStat
          label="Appels backend"
          value={`${technicalCalls + llmCalls}`}
          hint={`${technicalCalls} tech · ${llmCalls} LLM`}
        />
        <PreviewStat
          label={isAnalyzed ? 'Confiance moyenne' : 'Durée estimée'}
          value={
            isAnalyzed && avgConfidence !== null
              ? `${avgConfidence}%`
              : formatDuration(plan.estimatedDurationSec)
          }
        />
      </div>

      {/* Bouton de pré-analyse sémantique */}
      {!isAnalyzed && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAnalyze}
              disabled={isLoading}
              className="border-brand-violet"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {isLoading ? 'Compréhension en cours…' : 'Analyser la structure'}
            </Button>
            {isLoading && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => classifier.stop()}
                className="border-destructive text-destructive hover:bg-destructive/10"
                aria-label="Arrêter l'analyse"
              >
                Stop
              </Button>
            )}
          </div>

          {isLoading && (
            <div className="flex-1 max-w-md">
              <div className="h-1.5 w-full rounded-full bg-border/40 overflow-hidden">
                <div
                  className="h-full bg-brand-violet transition-all duration-300 ease-out"
                  style={{ width: `${Math.round(classifier.progress * 100)}%` }}
                  role="progressbar"
                  aria-valuenow={Math.round(classifier.progress * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 font-mono">
                Classification sémantique de {activeCriteria.length} critère
                {activeCriteria.length > 1 ? 's' : ''}…
              </p>
            </div>
          )}

          {!isLoading && (
            <p className="text-xs text-muted-foreground">
              Une passe LLM légère qui classe chaque critère par famille et
              reformule son intention. Aucun audit n'est lancé.
            </p>
          )}
        </div>
      )}

      {classifier.error && (
        <div
          className="mb-4 flex items-start gap-2 border border-destructive/50 rounded-md p-3 text-xs text-destructive"
          role="alert"
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Échec de la pré-analyse</div>
            <div className="opacity-80">{classifier.error}</div>
            <button
              type="button"
              onClick={handleAnalyze}
              className="underline mt-1 hover:no-underline"
            >
              Réessayer
            </button>
          </div>
        </div>
      )}

      {/* Pivot — confirme visuellement la structure (axes × types de scoring).
          Avant analyse: regroupé par axe brut. Après: par famille comprise. */}
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
