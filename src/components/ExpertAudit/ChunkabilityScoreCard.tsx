import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layers, CheckCircle2, XCircle } from 'lucide-react';
import type { ChunkabilityScore } from '@/types/expertAudit';

interface ChunkabilityScoreCardProps {
  data: ChunkabilityScore;
}

export function ChunkabilityScoreCard({ data }: ChunkabilityScoreCardProps) {
  const scoreColor = data.score >= 70 ? 'text-success' : data.score >= 40 ? 'text-warning' : 'text-destructive';
  const scoreBg = data.score >= 70 ? 'bg-success/10' : data.score >= 40 ? 'bg-warning/10' : 'bg-destructive/10';

  return (
    <Card className="border border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base font-semibold">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10">
              <Layers className="h-4.5 w-4.5 text-indigo-500" />
            </div>
            Chunkability IA
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

        <div className="grid grid-cols-2 gap-3">
          <div className={`p-3 rounded-lg ${scoreBg}`}>
            <p className="text-xs text-muted-foreground mb-1">Paragraphes</p>
            <p className="text-lg font-bold text-foreground">{data.paragraphs}</p>
          </div>
          <div className={`p-3 rounded-lg ${scoreBg}`}>
            <p className="text-xs text-muted-foreground mb-1">Longueur moy.</p>
            <p className="text-lg font-bold text-foreground">{data.avg_paragraph_length}<span className="text-xs text-muted-foreground ml-1">mots</span></p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1.5 text-xs">
            {data.has_toc ? <CheckCircle2 className="h-3 w-3 text-success" /> : <XCircle className="h-3 w-3 text-destructive" />}
            Sommaire (TOC)
          </Badge>
          <Badge variant="outline" className="gap-1.5 text-xs">
            {data.has_clear_sections ? <CheckCircle2 className="h-3 w-3 text-success" /> : <XCircle className="h-3 w-3 text-destructive" />}
            Sections claires (H2/H3)
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
