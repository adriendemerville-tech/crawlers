/**
 * Bloc GEO 3 piliers pour /audit-expert.
 *
 * Le score /200 technique n'est pas touché : ce bloc est une lecture
 * complémentaire, calculée par le juge unique du GEO
 * (`geoSubSignals.buildGeoSubSignals`) alimenté par l'adaptateur de faits
 * `geoFactsFromExpertAudit()` — mêmes poids, mêmes plafonds de cohérence et
 * même barème daté que le rapport Marina.
 */
import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Brain } from 'lucide-react';
import {
  geoFactsFromExpertAudit,
  type ExpertAuditFacts,
  type StrategicAuditFacts,
  type GeoFactSource,
} from '../../../supabase/functions/_shared/geoFactsFromExpertAudit';
import {
  buildGeoSubSignals,
  type GeoPillar,
  type GeoSubSignalReport,
} from '../../../supabase/functions/_shared/geoSubSignals';

interface Props {
  /** Résultat de audit-expert-seo (mesures sur le HTML servi). */
  technicalResult: unknown;
  /** Résultat de l'audit stratégique IA, si déjà lancé. */
  strategicResult?: unknown;
}

const PILLAR_ORDER: GeoPillar[] = ['authority', 'accessibility', 'content'];

const PILLAR_SCOPE: Record<GeoPillar, string> = {
  authority: 'domaine (mutualisé)',
  accessibility: 'page',
  content: 'page',
};

const TREND_LABEL: Record<string, string> = {
  constant: 'poids constant',
  decays: 'poids décroissant (−1 pt / 18 mois, plancher 17)',
  grows: 'poids croissant (absorbe l’accessibilité)',
};

const SOURCE_LABEL: Record<GeoFactSource, string> = {
  expert_measure: 'mesuré',
  llm_judgement: 'jugement IA',
  unmeasured: 'non mesuré',
};

function fmtPts(v: number): string {
  return `${v.toFixed(1).replace(/\.0$/, '')} pts`;
}

export function GeoPillarsCard({ technicalResult, strategicResult }: Props) {
  const computed = useMemo(() => {
    if (!technicalResult || typeof technicalResult !== 'object') return null;
    try {
      const projection = geoFactsFromExpertAudit(
        technicalResult as ExpertAuditFacts,
        (strategicResult as StrategicAuditFacts | undefined) ?? null,
      );
      const report: GeoSubSignalReport = buildGeoSubSignals(projection.inputs);
      return { report, sources: projection.sources, notes: projection.notes };
    } catch {
      return null;
    }
  }, [technicalResult, strategicResult]);

  if (!computed) return null;
  const { report, sources } = computed;
  if (report.geo_score === null) return null;

  return (
    <Card className="border-2">
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-bold text-foreground">Score GEO — 3 piliers</h3>
            </div>
            <p className="text-xs text-muted-foreground max-w-xl">
              Lecture indépendante du score technique /200 : mêmes sous-signaux et mêmes
              plafonds de cohérence que le rapport d’audit multipages. Barème daté du{' '}
              {report.weight_date}.
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-foreground">{report.geo_score}<span className="text-base font-normal text-muted-foreground">/100</span></div>
            <p className="text-xs text-muted-foreground">{report.verdict_label}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left font-semibold py-2 pr-3">Pilier et ses sous-signaux</th>
                <th className="text-right font-semibold py-2 px-2 whitespace-nowrap">Poids</th>
                <th className="text-right font-semibold py-2 px-2 whitespace-nowrap">Score</th>
                <th className="text-right font-semibold py-2 px-2 whitespace-nowrap">Acquis</th>
                <th className="text-left font-semibold py-2 pl-2 whitespace-nowrap">Tendance</th>
              </tr>
            </thead>
            <tbody>
              {PILLAR_ORDER.map((key) => {
                const pillar = report[key];
                const pts = report.pillar_points[key];
                const earned = pillar.score === null
                  ? null
                  : Math.round((pillar.score / 100) * pts * 10) / 10;
                const members = report.signals
                  .filter((s) => s.family === key)
                  .sort((a, b) => b.weight - a.weight);
                return (
                  <tr key={key} className="border-t border-border align-top">
                    <td className="py-2 pr-3">
                      <div className="text-xs font-semibold text-foreground">
                        {pillar.label}{' '}
                        <span className="font-normal text-muted-foreground">— {PILLAR_SCOPE[key]}</span>
                      </div>
                      <ul className="mt-1 space-y-0.5">
                        {members.map((s) => (
                          <li key={s.key} className="text-[11px] text-muted-foreground leading-relaxed">
                            {s.label} · {fmtPts(s.weight)} ·{' '}
                            {s.value === null ? 'non mesuré' : `${s.value}/100`}
                            <span className="ml-1 opacity-70">
                              ({SOURCE_LABEL[sources[s.key] ?? 'unmeasured']})
                            </span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="py-2 px-2 text-right font-bold whitespace-nowrap">{pts} pts</td>
                    <td className="py-2 px-2 text-right whitespace-nowrap">
                      {pillar.score === null ? 'n/m' : `${pillar.score}/100`}
                    </td>
                    <td className="py-2 px-2 text-right font-semibold whitespace-nowrap">
                      {earned === null ? '—' : fmtPts(earned)}
                    </td>
                    <td className="py-2 pl-2 text-[11px] text-muted-foreground">
                      {TREND_LABEL[report.pillar_trend[key]] ?? ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-border border-l-2 border-l-primary p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Verdict d’écart{report.gap !== null ? ` — ${report.gap > 0 ? '+' : ''}${report.gap} points` : ''}
          </p>
          <p className="text-xs text-foreground leading-relaxed">
            <strong>{report.verdict_label}.</strong> {report.verdict_explanation}
          </p>
        </div>

        {report.gates.length > 0 && (
          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <p className="text-xs font-semibold text-foreground">Plafonds de cohérence appliqués</p>
            </div>
            {report.gates.map((g, i) => (
              <div key={`${g.axis}-${i}`} className="text-[11px] text-muted-foreground leading-relaxed">
                <Badge variant="outline" className="mr-2 text-[10px]">{g.axis}</Badge>
                {g.reason} <span className="opacity-80">{g.evidence}</span>
              </div>
            ))}
          </div>
        )}

        {report.priority_levers.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Leviers prioritaires</p>
            <ol className="list-decimal pl-5 space-y-1">
              {report.priority_levers.map((l) => (
                <li key={l.key} className="text-xs text-muted-foreground leading-relaxed">
                  <span className="text-foreground font-medium">{l.label} ({l.value}/100)</span> — {l.lever}
                </li>
              ))}
            </ol>
          </div>
        )}

        {!strategicResult && (
          <p className="text-[11px] text-muted-foreground italic">
            Les sous-signaux d’autorité et d’entité restent non mesurés tant que l’audit GEO
            stratégique n’a pas été lancé : le score est calculé sur les seuls piliers couverts.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
