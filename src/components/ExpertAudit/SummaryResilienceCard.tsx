import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import type { SummaryResilience } from '@/types/newAuditMetrics';

interface SummaryResilienceCardProps {
  data: SummaryResilience;
}

export function SummaryResilienceCard({ data }: SummaryResilienceCardProps) {
  const scoreColor = data.score >= 80 ? 'text-success' : data.score >= 50 ? 'text-warning' : 'text-destructive';
  const progressColor = data.score >= 80 ? 'bg-success' : data.score >= 50 ? 'bg-warning' : 'bg-destructive';

  return (
    <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base font-semibold">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <ShieldCheck className="h-4.5 w-4.5 text-primary" />
            </div>
            Résilience au Résumé
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${scoreColor}`}>{data.score}</span>
            <span className="text-sm text-muted-foreground">/100</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div className={`h-full rounded-full transition-all duration-700 ${progressColor}`} style={{ width: `${data.score}%` }} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">H1 Original</p>
            <p className="text-sm font-medium text-foreground">{data.originalH1 || '(H1 absent)'}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Résumé IA (10 mots)</p>
            <p className="text-sm font-medium text-primary">{data.llmSummary}</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground italic">
          {data.score >= 80 
            ? '✓ Le H1 transmet fidèlement la proposition de valeur — résilient au résumé IA.'
            : data.score >= 50
            ? '⚠ Divergence partielle entre le H1 et la proposition de valeur résumée par l\'IA.'
            : '✗ Le H1 ne reflète pas la proposition de valeur réelle — risque de mauvaise représentation par les LLM.'}
        </p>
      </CardContent>
    </Card>
  );
}
