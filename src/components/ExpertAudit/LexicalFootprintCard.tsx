import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Languages } from 'lucide-react';
import type { LexicalFootprint } from '@/types/newAuditMetrics';

interface LexicalFootprintCardProps {
  data: LexicalFootprint;
}

export function LexicalFootprintCard({ data }: LexicalFootprintCardProps) {
  // Derive score from concreteRatio for consistency (ignore LLM-generated score)
  const score = data.concreteRatio ?? data.score;
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
            <span className={`text-2xl font-bold ${scoreColor}`}>{data.score}</span>
            <span className="text-sm text-muted-foreground">/100</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Horizontal bar showing jargon vs concrete */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Jargon corporate</span>
            <span>Terminologie concrète</span>
          </div>
          <div className="relative h-4 w-full rounded-full bg-muted overflow-hidden">
            <div 
              className="absolute left-0 top-0 h-full bg-destructive/60 rounded-l-full transition-all duration-700" 
              style={{ width: `${data.jargonRatio}%` }} 
            />
            <div 
              className="absolute right-0 top-0 h-full bg-success/60 rounded-r-full transition-all duration-700" 
              style={{ width: `${data.concreteRatio}%` }} 
            />
          </div>
          <div className="flex justify-between text-xs font-medium">
            <span className="text-destructive">{data.jargonRatio}%</span>
            <span className="text-success">{data.concreteRatio}%</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground italic">
          {data.score >= 80 
            ? '✓ Contenu spécifique et actionnable — les LLM peuvent extraire des faits précis.'
            : data.score >= 50
            ? '⚠ Mélange de jargon et de contenu concret — affiner la rédaction pour plus de spécificité.'
            : '✗ Dominance de jargon corporate vide — les LLM peineront à extraire de la valeur.'}
        </p>
      </CardContent>
    </Card>
  );
}
