import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Cloud } from 'lucide-react';

interface KeywordItem {
  keyword: string;
  position: number;
  search_volume: number;
  url?: string;
}

interface KeywordCloudProps {
  keywords: KeywordItem[];
}

function getStrategicScore(kw: KeywordItem): number {
  // Higher search volume + better position = more strategic
  const volumeScore = Math.min(kw.search_volume / 5000, 1);
  const positionScore = Math.max(0, 1 - kw.position / 100);
  return volumeScore * 0.6 + positionScore * 0.4;
}

function getPositionColor(position: number): string {
  if (position <= 3) return 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30';
  if (position <= 10) return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25';
  if (position <= 20) return 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/25';
  if (position <= 50) return 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/25';
  return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
}

function getFontSize(score: number): string {
  if (score > 0.7) return 'text-base font-bold';
  if (score > 0.5) return 'text-sm font-semibold';
  if (score > 0.3) return 'text-xs font-medium';
  return 'text-[11px] font-normal';
}

export function KeywordCloud({ keywords }: KeywordCloudProps) {
  const scored = useMemo(() => {
    if (!keywords?.length) return [];
    return keywords
      .map(kw => ({ ...kw, score: getStrategicScore(kw) }))
      .sort(() => Math.random() - 0.5) // Shuffle for cloud feel
      .slice(0, 40);
  }, [keywords]);

  if (!scored.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Cloud className="h-4 w-4" />
          Nuage de mots-clés
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={200}>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {scored.map((kw, i) => (
              <Tooltip key={`${kw.keyword}-${i}`}>
                <TooltipTrigger asChild>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-md border transition-all hover:scale-105 cursor-default ${getPositionColor(kw.position)} ${getFontSize(kw.score)}`}
                  >
                    {kw.keyword}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p className="font-semibold">{kw.keyword}</p>
                  <p>Position : #{kw.position}</p>
                  <p>Volume : {kw.search_volume.toLocaleString()}/mois</p>
                  {kw.url && <p className="truncate max-w-[200px] text-muted-foreground">{kw.url}</p>}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
        <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground justify-center">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" />Top 3</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" />Top 10</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-400" />Top 20</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-400" />Top 50</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" />50+</span>
          <span className="ml-2 opacity-60">Taille = importance stratégique</span>
        </div>
      </CardContent>
    </Card>
  );
}
