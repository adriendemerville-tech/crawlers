import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KeywordItem {
  keyword: string;
  position: number;
  search_volume: number;
  url?: string;
}

interface TopKeywordsListProps {
  keywords: KeywordItem[];
}

function positionBadgeClass(pos: number): string {
  if (pos <= 3) return 'bg-green-500/20 text-green-700 dark:text-green-300';
  if (pos <= 10) return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
  if (pos <= 20) return 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300';
  if (pos <= 50) return 'bg-orange-500/15 text-orange-700 dark:text-orange-300';
  return 'bg-muted text-muted-foreground';
}

export function TopKeywordsList({ keywords }: TopKeywordsListProps) {
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(() => {
    if (!keywords?.length) return [];
    return [...keywords]
      .sort((a, b) => a.position - b.position)
      .slice(0, 20);
  }, [keywords]);

  if (!sorted.length) return null;

  const visible = expanded ? sorted : sorted.slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          Top mots-clés positionnés
          <Badge variant="secondary" className="text-[10px] font-normal ml-auto">{sorted.length} mots-clés</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {visible.map((kw, i) => (
          <div
            key={`${kw.keyword}-${i}`}
            className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors group"
          >
            <span className="text-[11px] text-muted-foreground w-5 text-right shrink-0">{i + 1}.</span>
            <span className="flex-1 text-sm truncate">{kw.keyword}</span>
            <span className="text-[11px] text-muted-foreground shrink-0">{kw.search_volume.toLocaleString()}/m</span>
            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 shrink-0', positionBadgeClass(kw.position))}>
              #{kw.position}
            </Badge>
          </div>
        ))}

        {sorted.length > 5 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pt-2 mx-auto"
          >
            {expanded ? (
              <>Réduire <ChevronUp className="h-3 w-3" /></>
            ) : (
              <>Voir les {sorted.length - 5} suivants <ChevronDown className="h-3 w-3" /></>
            )}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
