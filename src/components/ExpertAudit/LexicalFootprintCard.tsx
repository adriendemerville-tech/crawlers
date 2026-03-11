import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Languages } from 'lucide-react';
import type { LexicalFootprint } from '@/types/newAuditMetrics';

interface LexicalFootprintCardProps {
  data: LexicalFootprint;
}

export function LexicalFootprintCard({ data }: LexicalFootprintCardProps) {
  const rawJargon = data.jargonRatio ?? 0;
  const rawConcrete = data.concreteRatio ?? 0;
  const total = rawJargon + rawConcrete;
  const jargonRatio = total > 0 ? Math.round((rawJargon / total) * 100) : 50;
  const concreteRatio = 100 - jargonRatio;
  const score = concreteRatio;
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
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${scoreColor}`}>{score}</span>
            <span className="text-sm text-muted-foreground">/100</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Slim gradient bar */}
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
            {/* Position indicator */}
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
      </CardContent>
    </Card>
  );
}
