import { useState, useEffect, useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bot, Activity, CheckCircle2, XCircle, Loader2, TrendingUp, Clock, HeartPulse, RefreshCw, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface CacheHealthReport {
  total_entries: number;
  expired_entries: number;
  entries_by_type: Record<string, number>;
  anomalies: string[];
  score_stats: { avg: number; min: number; max: number; stddev: number } | null;
  empty_results_count: number;
  oldest_entry_age_hours: number;
  status: 'healthy' | 'warning' | 'critical';
}

interface AgentLog {
  id: string;
  function_analyzed: string;
  confidence_score: number;
  decision: string;
  created_at: string;
  change_diff_pct: number;
  analysis_summary: string;
  self_critique: string;
  prompt_version_before: number | null;
  prompt_version_after: number | null;
}

export function CtoAgentDashboard() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [cacheHealth, setCacheHealth] = useState<CacheHealthReport | null>(null);
  const [checkingCache, setCheckingCache] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [configRes, logsRes] = await Promise.all([
        supabase.from('system_config' as any).select('value').eq('key', 'cto_agent_enabled').single(),
        supabase.from('cto_agent_logs' as any)
          .select('id, function_analyzed, confidence_score, decision, created_at, change_diff_pct, analysis_summary, self_critique, prompt_version_before, prompt_version_after')
          .order('created_at', { ascending: true }),
      ]);

      if (configRes.data) {
        setEnabled((configRes.data as any).value?.enabled === true);
      }
      if (logsRes.data) {
        setLogs((logsRes.data as unknown as AgentLog[]) || []);
      }
    } catch (e) {
      console.error('Error fetching CTO agent data:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(checked: boolean) {
    setToggling(true);
    try {
      const { error } = await supabase
        .from('system_config' as any)
        .update({ value: { enabled: checked }, updated_at: new Date().toISOString() } as any)
        .eq('key', 'cto_agent_enabled');

      if (error) throw error;
      setEnabled(checked);
      toast({
        title: checked ? 'Agent CTO activé' : 'Agent CTO désactivé',
        description: checked
          ? "L'agent analysera les prochains audits en arrière-plan."
          : "L'agent ne sera plus déclenché après les audits.",
      });
    } catch (e) {
      console.error('Error toggling CTO agent:', e);
      toast({ title: 'Erreur', description: 'Impossible de modifier le statut.', variant: 'destructive' });
    } finally {
      setToggling(false);
    }
  }

  async function runCacheHealthCheck() {
    setCheckingCache(true);
    try {
      const { data, error } = await supabase.functions.invoke('agent-cto', {
        body: { action: 'cache_health_check' },
      });
      if (error) throw error;
      if (data?.report) {
        setCacheHealth(data.report);
        toast({
          title: `Cache ${data.report.status === 'healthy' ? '✅' : data.report.status === 'warning' ? '⚠️' : '🔴'}`,
          description: `${data.report.total_entries} entrées, ${data.report.anomalies.length} anomalies`,
        });
      }
    } catch (e) {
      console.error('Cache health check error:', e);
      toast({ title: 'Erreur', description: 'Impossible de vérifier le cache.', variant: 'destructive' });
    } finally {
      setCheckingCache(false);
    }
  }

  const chartData = useMemo(() => {
    if (logs.length === 0) return [];

    const byDay: Record<string, { scores: number[]; approved: number; total: number }> = {};
    logs.forEach(log => {
      const day = format(new Date(log.created_at), 'yyyy-MM-dd');
      if (!byDay[day]) byDay[day] = { scores: [], approved: 0, total: 0 };
      byDay[day].scores.push(log.confidence_score);
      byDay[day].total++;
      if (log.decision === 'approved') byDay[day].approved++;
    });

    let cumulativeScores: number[] = [];
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, data]) => {
        cumulativeScores = [...cumulativeScores, ...data.scores];
        const avgConfidence = cumulativeScores.reduce((a, b) => a + b, 0) / cumulativeScores.length;
        return {
          date: format(new Date(day), 'dd MMM', { locale: fr }),
          rawDate: day,
          avgConfidence: Math.round(avgConfidence * 10) / 10,
          dailyAvg: Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 10) / 10,
          approved: data.approved,
          total: data.total,
        };
      });
  }, [logs]);

  const stats = useMemo(() => {
    const total = logs.length;
    const approved = logs.filter(l => l.decision === 'approved').length;
    const rejected = logs.filter(l => l.decision === 'rejected').length;
    const avgConfidence = total > 0
      ? Math.round((logs.reduce((sum, l) => sum + l.confidence_score, 0) / total) * 10) / 10
      : 0;
    const latestVersion = logs.reduce((max, l) => Math.max(max, l.prompt_version_after || 0), 0);
    return { total, approved, rejected, avgConfidence, latestVersion };
  }, [logs]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with toggle */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Agent CTO</CardTitle>
                <CardDescription>
                  Auto-optimisation des prompts d'audit via Claude 3.5 Sonnet · Règle des 10% · Seuil 95%
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={enabled ? 'default' : 'secondary'}>
                {enabled ? 'Actif' : 'Inactif'}
              </Badge>
              <Switch
                checked={enabled}
                onCheckedChange={handleToggle}
                disabled={toggling}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Activity className="h-3 w-3" /> Analyses
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-primary">{stats.avgConfidence}%</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <TrendingUp className="h-3 w-3" /> Confiance moy.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{stats.approved}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Approuvées
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-destructive">{stats.rejected}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <XCircle className="h-3 w-3" /> Rejetées
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">v{stats.latestVersion || 0}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Clock className="h-3 w-3" /> Dernière version
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cache Health Check */}
      <Card className="border-muted">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Santé du cache partagé</CardTitle>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={runCacheHealthCheck}
              disabled={checkingCache}
            >
              {checkingCache ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <HeartPulse className="h-3.5 w-3.5 mr-1.5" />}
              Vérifier
            </Button>
          </div>
        </CardHeader>
        {cacheHealth && (
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant={cacheHealth.status === 'healthy' ? 'default' : cacheHealth.status === 'warning' ? 'secondary' : 'destructive'}>
                {cacheHealth.status === 'healthy' ? '✅ Sain' : cacheHealth.status === 'warning' ? '⚠️ Attention' : '🔴 Critique'}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {cacheHealth.total_entries} entrées · {cacheHealth.expired_entries} expirées · {cacheHealth.empty_results_count} vides
              </span>
            </div>
            <div className="flex gap-4 text-xs">
              {Object.entries(cacheHealth.entries_by_type).map(([type, count]) => (
                <span key={type} className="text-muted-foreground">
                  <span className="font-medium text-foreground">{count}</span> {type}
                </span>
              ))}
            </div>
            {cacheHealth.score_stats && (
              <div className="text-xs text-muted-foreground">
                Scores visibilité : moy {cacheHealth.score_stats.avg}% · min {cacheHealth.score_stats.min}% · max {cacheHealth.score_stats.max}% · σ {cacheHealth.score_stats.stddev}
              </div>
            )}
            {cacheHealth.anomalies.length > 0 && (
              <div className="space-y-1 p-2 rounded-md bg-destructive/5 border border-destructive/20">
                <p className="text-xs font-medium text-destructive">Anomalies détectées :</p>
                {cacheHealth.anomalies.map((a, i) => (
                  <p key={i} className="text-xs text-muted-foreground">{a}</p>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Évolution du taux de pertinence moyen</CardTitle>
          <CardDescription>Score de confiance cumulé de l'Agent CTO au fil du temps</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bot className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Aucune donnée — activez l'agent et lancez des audits.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-md text-sm">
                        <p className="font-medium">{d.date}</p>
                        <p className="text-primary">Moy. cumulée : {d.avgConfidence}%</p>
                        <p className="text-muted-foreground">Moy. jour : {d.dailyAvg}%</p>
                        <p className="text-muted-foreground">{d.approved}/{d.total} approuvées</p>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="avgConfidence"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#confidenceGradient)"
                />
                <Line
                  type="monotone"
                  dataKey="dailyAvg"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Recent logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Journal des analyses récentes</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucune analyse enregistrée.</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {[...logs].reverse().slice(0, 20).map(log => (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                  <div className={`mt-0.5 p-1.5 rounded-full ${
                    log.decision === 'approved' ? 'bg-emerald-500/10' : 'bg-destructive/10'
                  }`}>
                    {log.decision === 'approved'
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      : <XCircle className="h-3.5 w-3.5 text-destructive" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {log.function_analyzed}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(log.created_at), 'dd/MM HH:mm')}
                      </span>
                      <span className="text-[10px] font-medium text-primary">
                        {log.confidence_score}% confiance
                      </span>
                      {log.prompt_version_after && (
                        <Badge className="text-[10px] px-1.5 py-0">
                          → v{log.prompt_version_after}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{log.analysis_summary}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
