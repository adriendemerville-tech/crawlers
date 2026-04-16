import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, Clock, DollarSign, Cpu } from 'lucide-react';
import { EditorialPipelineAlerts } from './EditorialPipelineAlerts';

interface PipelineLog {
  id: string;
  pipeline_run_id: string;
  domain: string;
  content_type: string;
  stage: string;
  model_used: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  latency_ms: number | null;
  cost_usd: number | null;
  status: string;
  created_at: string;
}

interface RunSummary {
  pipeline_run_id: string;
  domain: string;
  content_type: string;
  total_latency_ms: number;
  total_cost_usd: number;
  stages: PipelineLog[];
  created_at: string;
}

export function EditorialPipelineObservability({ externalDomain }: { externalDomain?: string | null }) {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let query = (supabase as any)
        .from('editorial_pipeline_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (externalDomain) query = query.eq('domain', externalDomain);

      const { data, error } = await query;
      if (error) {
        console.error('[PipelineObs] Failed to load logs:', error);
        setLoading(false);
        return;
      }

      // Group by pipeline_run_id
      const byRun = new Map<string, RunSummary>();
      for (const row of (data ?? []) as PipelineLog[]) {
        const key = row.pipeline_run_id;
        if (!byRun.has(key)) {
          byRun.set(key, {
            pipeline_run_id: key,
            domain: row.domain,
            content_type: row.content_type,
            total_latency_ms: 0,
            total_cost_usd: 0,
            stages: [],
            created_at: row.created_at,
          });
        }
        const run = byRun.get(key)!;
        run.stages.push(row);
        run.total_latency_ms += row.latency_ms ?? 0;
        run.total_cost_usd += Number(row.cost_usd ?? 0);
      }
      setRuns(Array.from(byRun.values()).slice(0, 25));
      setLoading(false);
    }
    load();
  }, [externalDomain]);

  if (loading) return <Skeleton className="h-64 w-full" />;

  if (runs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          Aucun run de pipeline éditoriale enregistré pour le moment.
        </CardContent>
      </Card>
    );
  }

  const totalRuns = runs.length;
  const avgLatency = Math.round(runs.reduce((s, r) => s + r.total_latency_ms, 0) / totalRuns);
  const totalCost = runs.reduce((s, r) => s + r.total_cost_usd, 0);

  return (
    <div className="space-y-4">
      <EditorialPipelineAlerts externalDomain={externalDomain} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Runs récents</div>
              <div className="text-xl font-semibold">{totalRuns}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Latence moy.</div>
              <div className="text-xl font-semibold">{(avgLatency / 1000).toFixed(1)}s</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Coût total</div>
              <div className="text-xl font-semibold">${totalCost.toFixed(3)}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Cpu className="h-4 w-4" /> Derniers runs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {runs.map((run) => (
            <div
              key={run.pipeline_run_id}
              className="border rounded-md p-3 text-xs space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{run.content_type}</Badge>
                  <span className="font-medium">{run.domain}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span>{(run.total_latency_ms / 1000).toFixed(2)}s</span>
                  <span>${run.total_cost_usd.toFixed(4)}</span>
                  <span>{new Date(run.created_at).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {run.stages
                  .sort((a, b) => a.created_at.localeCompare(b.created_at))
                  .map((s) => (
                    <Badge
                      key={s.id}
                      variant={s.status === 'success' ? 'secondary' : 'destructive'}
                      className="text-[10px] font-mono"
                    >
                      {s.stage}
                      {s.model_used ? ` · ${s.model_used.split('/').pop()}` : ''}
                      {s.latency_ms ? ` · ${s.latency_ms}ms` : ''}
                    </Badge>
                  ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
