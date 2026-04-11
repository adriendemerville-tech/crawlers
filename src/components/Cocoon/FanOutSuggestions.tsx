import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Network, CheckCircle2, Circle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FanOutSuggestionsProps {
  domain: string;
  trackedSiteId: string;
  currentContent?: string;
}

interface FanOutAxis {
  keyword: string;
  axis: string;
  covered: boolean;
}

/**
 * Content Architect block showing fan-out queries to cover with coverage %.
 */
export function FanOutSuggestions({ domain, trackedSiteId, currentContent }: FanOutSuggestionsProps) {
  const [axes, setAxes] = useState<FanOutAxis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!domain || !trackedSiteId) return;
    (async () => {
      const { data } = await supabase
        .from('keyword_universe')
        .select('keyword, source_details')
        .eq('domain', domain)
        .eq('tracked_site_id', trackedSiteId)
        .contains('sources', ['fan_out'])
        .not('parent_query_id', 'is', null)
        .limit(10);

      if (data?.length) {
        const contentLower = (currentContent || '').toLowerCase();
        setAxes(data.map((d: any) => ({
          keyword: d.keyword,
          axis: d.source_details?.fan_out_axis || d.keyword,
          covered: contentLower.includes(d.keyword.toLowerCase().split(' ')[0]),
        })));
      }
      setLoading(false);
    })();
  }, [domain, trackedSiteId, currentContent]);

  if (loading || axes.length === 0) return null;

  const coveredCount = axes.filter(a => a.covered).length;
  const coveragePct = Math.round((coveredCount / axes.length) * 100);

  return (
    <Card className="border border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Network className="h-4 w-4 text-indigo-500" />
          Requêtes fan-out à couvrir
          <Badge 
            variant="outline" 
            className={`ml-auto text-xs ${coveragePct >= 80 ? 'text-green-600 border-green-500/30' : coveragePct >= 50 ? 'text-amber-600 border-amber-500/30' : 'text-red-600 border-red-500/30'}`}
          >
            {coveragePct}% couvert
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {axes.map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              {a.covered ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
              )}
              <span className={a.covered ? 'text-muted-foreground line-through' : 'font-medium'}>
                {a.axis}
              </span>
              <span className="text-muted-foreground/60 truncate ml-auto">{a.keyword}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
