import { Card, CardContent } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { useCrawlPagesStats } from '@/hooks/useCrawlPagesStats';

export function CrawlPagesStatsCard() {
  const { median, average, totalCrawls, loading } = useCrawlPagesStats();

  if (loading) return null;

  return (
    <Card className="border-cyan-500/20">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-cyan-500/10">
          <BarChart3 className="h-5 w-5 text-cyan-500" />
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Pages par crawl</p>
          <div className="flex items-baseline gap-3">
            <div>
              <span className="text-xl font-bold">{median}</span>
              <span className="text-[10px] text-muted-foreground ml-1">médiane</span>
            </div>
            <div className="text-muted-foreground">|</div>
            <div>
              <span className="text-xl font-bold">{average}</span>
              <span className="text-[10px] text-muted-foreground ml-1">moyenne</span>
            </div>
          </div>
          <p className="text-[9px] text-muted-foreground">sur {totalCrawls} crawls terminés</p>
        </div>
      </CardContent>
    </Card>
  );
}
