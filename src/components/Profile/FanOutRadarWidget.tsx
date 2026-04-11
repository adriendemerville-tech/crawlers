import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Network, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FanOutRadarWidgetProps {
  trackedSiteId: string;
  domain: string;
}

interface FanOutEntry {
  keyword: string;
  axis: string;
  confidence: number;
  source: string;
  parentKeyword?: string;
  updatedAt?: string;
}

/**
 * Dashboard widget showing longitudinal fan-out coverage.
 */
export function FanOutRadarWidget({ trackedSiteId, domain }: FanOutRadarWidgetProps) {
  const [entries, setEntries] = useState<FanOutEntry[]>([]);
  const [parentQueries, setParentQueries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!trackedSiteId) return;
    (async () => {
      // Fetch parent queries
      const { data: parents } = await supabase
        .from('keyword_universe')
        .select('id, keyword, updated_at')
        .eq('tracked_site_id', trackedSiteId)
        .contains('sources', ['fan_out'])
        .is('parent_query_id', null)
        .order('updated_at', { ascending: false })
        .limit(5);

      if (!parents?.length) {
        setLoading(false);
        return;
      }

      setParentQueries(parents.map((p: any) => p.keyword));

      const parentIds = parents.map((p: any) => p.id);
      const { data: children } = await supabase
        .from('keyword_universe')
        .select('keyword, source_details, updated_at, parent_query_id')
        .eq('tracked_site_id', trackedSiteId)
        .contains('sources', ['fan_out'])
        .in('parent_query_id', parentIds)
        .limit(30);

      if (children?.length) {
        const parentMap = Object.fromEntries(parents.map((p: any) => [p.id, p.keyword]));
        setEntries(children.map((c: any) => ({
          keyword: c.keyword,
          axis: c.source_details?.fan_out_axis || c.keyword,
          confidence: c.source_details?.fan_out_confidence || 0.5,
          source: c.source_details?.fan_out_source || 'unknown',
          parentKeyword: parentMap[c.parent_query_id] || '?',
          updatedAt: c.updated_at,
        })));
      }
      setLoading(false);
    })();
  }, [trackedSiteId]);

  if (loading || entries.length === 0) return null;

  // Group by parent query
  const grouped = entries.reduce((acc, e) => {
    const key = e.parentKeyword || '?';
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {} as Record<string, FanOutEntry[]>);

  const avgConfidence = entries.length > 0
    ? Math.round((entries.reduce((s, e) => s + e.confidence, 0) / entries.length) * 100)
    : 0;

  return (
    <Card className="border border-indigo-500/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Network className="h-4 w-4 text-indigo-500" />
          Radar Fan-Out
          <Badge variant="outline" className="ml-auto text-xs">
            {entries.length} axes · {parentQueries.length} requête{parentQueries.length > 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Confidence overview */}
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <div className="text-lg font-bold text-indigo-500">{avgConfidence}%</div>
          <div className="text-xs text-muted-foreground">Confiance moyenne de détection</div>
          <div className="ml-auto">
            {avgConfidence >= 75 ? <TrendingUp className="h-4 w-4 text-green-500" /> :
             avgConfidence >= 50 ? <Minus className="h-4 w-4 text-amber-500" /> :
             <TrendingDown className="h-4 w-4 text-red-500" />}
          </div>
        </div>

        {/* Grouped entries */}
        {Object.entries(grouped).map(([parent, axes]) => (
          <div key={parent} className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">« {parent} »</div>
            <div className="grid grid-cols-2 gap-1">
              {axes.slice(0, 6).map((a, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded border bg-card px-2 py-1">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    a.source === 'citation_reverse' ? 'bg-blue-500' : 'bg-amber-500'
                  }`} />
                  <span className="text-[11px] truncate">{a.axis}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="flex gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Citations</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Simulation</span>
        </div>
      </CardContent>
    </Card>
  );
}
