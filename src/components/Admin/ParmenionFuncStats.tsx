import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface FuncStat {
  func: string;
  count: number;
}

export function ParmenionFuncStats() {
  const [stats, setStats] = useState<FuncStat[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Paginate to get ALL rows (default limit is 1000)
        const PAGE_SIZE = 1000;
        const counts: Record<string, number> = {};
        let t = 0;
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('parmenion_decision_log')
            .select('functions_called')
            .range(offset, offset + PAGE_SIZE - 1);

          if (error) throw error;
          if (!data || data.length === 0) break;

          for (const row of data) {
            const fns = (row as any).functions_called as string[] | null;
            if (!fns) continue;
            for (const f of fns) {
              counts[f] = (counts[f] || 0) + 1;
              t++;
            }
          }

          hasMore = data.length === PAGE_SIZE;
          offset += PAGE_SIZE;
        }

        setTotal(t);
        setStats(
          Object.entries(counts)
            .map(([func, count]) => ({ func, count }))
            .sort((a, b) => b.count - a.count)
        );
      } catch (e) {
        console.error('Load func stats error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const maxCount = stats[0]?.count || 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Fonctions appelées par Parménion</CardTitle>
          {total > 0 && <Badge variant="secondary" className="ml-auto">{total} appels</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : stats.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aucune donnée.</p>
        ) : (
          <div className="space-y-2">
            {stats.map((s) => (
              <div key={s.func} className="flex items-center gap-3">
                <span className="text-xs font-mono truncate w-48 flex-shrink-0">{s.func}</span>
                <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary/70 rounded-full transition-all"
                    style={{ width: `${Math.max(4, (s.count / maxCount) * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-semibold w-10 text-right">{s.count}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
