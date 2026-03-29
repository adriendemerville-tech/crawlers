import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Languages, Target, ShieldCheck } from 'lucide-react';
import { MethodologyPopover } from './MethodologyPopover';
import type { LexicalFootprint, JargonTargetScore } from '@/types/newAuditMetrics';

interface LexicalFootprintCardProps {
  data: LexicalFootprint;
}

function DistanceGauge({ label, target, color }: { label: string; target: JargonTargetScore; color: string }) {
  const dist = Math.max(0, Math.min(100, target.distance ?? 0));
  const conf = Math.round((target.confidence ?? 0) * 100);

  const barColor = dist <= 25
    ? 'bg-emerald-500'
    : dist <= 45
      ? 'bg-sky-500'
      : dist <= 65
        ? 'bg-amber-500'
        : dist <= 85
          ? 'bg-orange-500'
          : 'bg-destructive';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground/80">{label}</span>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {target.qualifier}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            confiance {conf}%
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor}`}
            style={{ width: `${dist}%` }}
          />
        </div>
        <span className={`text-sm font-bold tabular-nums min-w-[2.5rem] text-right ${color}`}>
          {dist}%
        </span>
      </div>
      {target.terms_causing_distance?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {target.terms_causing_distance.slice(0, 5).map((term, i) => (
            <span
              key={i}
              className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/30"
            >
              {typeof term === 'string' ? term : (term as any)?.term || JSON.stringify(term)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function LexicalFootprintCard({ data }: LexicalFootprintCardProps) {
  const jd = data.jargon_distance;
  const hasJargonDistance = jd?.primary && jd?.secondary && jd?.untapped;

  // Legacy fallback
  const rawJargon = data.jargonRatio ?? 0;
  const rawConcrete = data.concreteRatio ?? 0;
  const total = rawJargon + rawConcrete;
  const jargonRatio = total > 0 ? Math.round((rawJargon / total) * 100) : 50;
  const concreteRatio = 100 - jargonRatio;
  const score = data.score ?? concreteRatio;
  const scoreColor = score >= 80 ? 'text-success' : score >= 50 ? 'text-warning' : 'text-destructive';

  return (
    <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base font-semibold">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Languages className="h-4.5 w-4.5 text-primary" />
            </div>
            Empreinte Lexicale
          </div>
          {!hasJargonDistance && (
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${scoreColor}`}>{score}</span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasJargonDistance ? (
          <>
            {/* 3 Distance Gauges */}
            <div className="space-y-4">
              <DistanceGauge
                label="↔ Cible primaire"
                target={jd.primary}
                color="text-emerald-500"
              />
              <DistanceGauge
                label="↔ Cible secondaire"
                target={jd.secondary}
                color="text-amber-500"
              />
              <DistanceGauge
                label="↔ Cible potentielle"
                target={jd.untapped}
                color="text-violet-500"
              />
            </div>

            {/* Intentionality Badge */}
            {jd.intentionality && (
              <div className="flex items-center gap-3 pt-3 border-t border-border/30">
                <div className="flex items-center gap-1.5">
                  {jd.intentionality.score > 0.65 ? (
                    <Target className="h-4 w-4 text-emerald-500" />
                  ) : jd.intentionality.score > 0.35 ? (
                    <ShieldCheck className="h-4 w-4 text-amber-500" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 text-destructive" />
                  )}
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      jd.intentionality.score > 0.65
                        ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        : jd.intentionality.score > 0.35
                          ? 'border-amber-500/30 text-amber-600 dark:text-amber-400'
                          : 'border-destructive/30 text-destructive'
                    }`}
                  >
                    {jd.intentionality.label}
                  </Badge>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Intentionnalité : {Math.round(jd.intentionality.score * 100)}%
                </span>
              </div>
            )}

            {/* Contextual interpretation */}
            <p className="text-xs text-muted-foreground italic">
              {jd.primary.distance <= 25 && jd.intentionality?.score > 0.5
                ? '✓ Vocabulaire parfaitement calibré pour votre cible principale — spécialisation assumée et maîtrisée.'
                : jd.primary.distance <= 45
                  ? '◐ Langage globalement accessible, quelques ajustements possibles pour la cible secondaire.'
                  : jd.intentionality?.label === 'Spécialisation assumée'
                    ? '🎯 Distance élevée mais intentionnelle — stratégie de filtrage par l\'expertise. Vérifiez que c\'est votre objectif.'
                    : '⚠ Distance sémantique importante avec votre cible — risque de perte d\'audience non maîtrisé.'}
            </p>
          </>
        ) : (
          /* Legacy display */
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Jargon corporate</span>
                <span>Terminologie concrète</span>
              </div>
              <div className="relative h-2 w-full rounded-full overflow-hidden bg-muted/50">
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `linear-gradient(to right, 
                      hsl(0 72% 55%) 0%, 
                      hsl(0 72% 55%) ${Math.max(0, jargonRatio - 8)}%, 
                      hsl(45 93% 55%) ${jargonRatio}%, 
                      hsl(142 71% 45%) ${Math.min(100, jargonRatio + 8)}%, 
                      hsl(142 71% 45%) 100%)`,
                  }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-3.5 w-0.5 bg-foreground/80 rounded-full shadow-sm"
                  style={{ left: `${jargonRatio}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-semibold">
                <span className="text-destructive">{jargonRatio}%</span>
                <span className="text-success">{concreteRatio}%</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground italic">
              {score >= 80
                ? '✓ Contenu spécifique et actionnable — les LLM peuvent extraire des faits précis.'
                : score >= 50
                  ? '⚠ Mélange de jargon et de contenu concret — affiner la rédaction pour plus de spécificité.'
                  : '✗ Dominance de jargon corporate vide — les LLM peineront à extraire de la valeur.'}
            </p>
          </>
        )}

        <MethodologyPopover variant="lexical_footprint" />
      </CardContent>
    </Card>
  );
}
