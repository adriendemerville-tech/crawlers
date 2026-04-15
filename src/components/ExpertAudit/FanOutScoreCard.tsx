import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Network } from 'lucide-react';

import type { FanOutScore } from '@/types/expertAudit';

interface FanOutScoreCardProps {
  data: FanOutScore;
}

export function FanOutScoreCard({ data }: FanOutScoreCardProps) {
  const scoreColor = data.score >= 70 ? 'text-success' : data.score >= 40 ? 'text-warning' : 'text-destructive';
  const coveragePct = data.total_potential_axes > 0
    ? Math.round((data.covered_axes / data.total_potential_axes) * 100)
    : 0;
  const coverageColor = coveragePct >= 70 ? 'bg-success' : coveragePct >= 40 ? 'bg-warning' : 'bg-destructive';

  return (
    <Card className="border border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base font-semibold">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
              <Network className="h-4.5 w-4.5 text-violet-500" />
            </div>
            Score Fan-Out (Décomposition RAG)
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${scoreColor}`}>{data.score}</span>
            <span className="text-sm text-muted-foreground">/100</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {data.explanation}
        </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Axes couverts</span>
            <span className="font-medium text-foreground">{data.covered_axes} / {data.total_potential_axes}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${coverageColor}`}
              style={{ width: `${coveragePct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {data.detected_axes} axes détectés par les moteurs RAG sur cette requête
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
