import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Play, Loader2, TrendingUp, FileText, Globe, ArrowUpRight, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { SeoCodeProposals } from './SeoCodeProposals';

interface SeoLog {
  id: string;
  page_type: string;
  page_slug: string;
  page_url: string;
  action_type: string;
  changes_summary: string;
  changes_detail: any;
  seo_score_before: number | null;
  seo_score_after: number | null;
  confidence_score: number;
  status: string;
  model_used: string;
  created_at: string;
}

export function SeoAgentDashboard() {
  const [logs, setLogs] = useState<SeoLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const { toast } = useToast();

  useEffect(() => { fetchLogs(); }, []);

  async function fetchLogs() {
    try {
      const { data } = await supabase
        .from('seo_agent_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      setLogs((data as unknown as SeoLog[]) || []);
    } catch (e) {
      console.error('Error fetching SEO agent logs:', e);
    } finally {
      setLoading(false);
    }
  }

  async function runAgent() {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('agent-seo', {
        body: { base_url: 'https://crawlers.lovable.app' },
      });
      if (error) throw error;
      if (data?.success) {
        toast({
          title: `✅ Agent SEO — ${data.target?.slug}`,
          description: `Score ${data.score_before} → ${data.score_after} · ${data.improvements_count} améliorations`,
        });
        fetchLogs();
      } else {
        toast({ title: 'Agent SEO', description: data?.error || 'Aucune amélioration', variant: 'destructive' });
      }
    } catch (e) {
      console.error('SEO agent error:', e);
      toast({ title: 'Erreur', description: 'Impossible de lancer l\'agent SEO.', variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  }

  const stats = useMemo(() => {
    const total = logs.length;
    const blogCount = logs.filter(l => l.page_type === 'blog').length;
    const landingCount = logs.filter(l => l.page_type === 'landing').length;
    const avgImprovement = total > 0
      ? Math.round(logs.reduce((sum, l) => sum + ((l.seo_score_after || 0) - (l.seo_score_before || 0)), 0) / total)
      : 0;
    const uniquePages = new Set(logs.map(l => l.page_slug)).size;
    return { total, blogCount, landingCount, avgImprovement, uniquePages };
  }, [logs]);

  const chartData = useMemo(() => {
    if (logs.length === 0) return [];
    const byDay: Record<string, { scores: number[]; count: number }> = {};
    [...logs].reverse().forEach(log => {
      const day = format(new Date(log.created_at), 'yyyy-MM-dd');
      if (!byDay[day]) byDay[day] = { scores: [], count: 0 };
      if (log.seo_score_after) byDay[day].scores.push(log.seo_score_after);
      byDay[day].count++;
    });
    return Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([day, data]) => ({
      date: format(new Date(day), 'dd MMM', { locale: fr }),
      avgScore: data.scores.length > 0 ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length) : 0,
      count: data.count,
    }));
  }, [logs]);

  if (loading) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10">
                <Search className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Agent SEO</CardTitle>
                <CardDescription>
                  Optimisation autonome du contenu · Blog (carte blanche) · Landing (prudent, max 10%)
                </CardDescription>
              </div>
            </div>
            <Button onClick={runAgent} disabled={running} variant="outline" size="sm" className="gap-1.5 text-xs">
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Lancer
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Clock className="h-3 w-3" /> Interventions
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">+{stats.avgImprovement}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <TrendingUp className="h-3 w-3" /> Score moyen
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{stats.blogCount}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <FileText className="h-3 w-3" /> Blog
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{stats.landingCount}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Globe className="h-3 w-3" /> Landing
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{stats.uniquePages}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <ArrowUpRight className="h-3 w-3" /> Pages uniques
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Évolution des scores SEO</CardTitle>
          <CardDescription>Score moyen des pages après optimisation</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Aucune donnée — lancez l'agent pour commencer.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="seoScoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => `${v}`} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-md text-sm">
                      <p className="font-medium">{d.date}</p>
                      <p className="text-primary">Score moy. : {d.avgScore}/100</p>
                      <p className="text-muted-foreground">{d.count} page(s) optimisée(s)</p>
                    </div>
                  );
                }} />
                <Area type="monotone" dataKey="avgScore" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#seoScoreGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registre des modifications</CardTitle>
          <CardDescription>{logs.length} intervention(s) enregistrée(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucune intervention enregistrée.</p>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {logs.map(log => (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                  <div className={`mt-0.5 p-1.5 rounded-full ${
                    log.page_type === 'blog' ? 'bg-emerald-500/10' : 'bg-amber-500/10'
                  }`}>
                    {log.page_type === 'blog'
                      ? <FileText className="h-3.5 w-3.5 text-emerald-600" />
                      : <Globe className="h-3.5 w-3.5 text-amber-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {log.page_slug}
                      </Badge>
                      <Badge variant={log.status === 'applied' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                        {log.status === 'applied' ? 'Appliqué' : log.status === 'pending_review' ? 'En revue' : log.status}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(log.created_at), 'dd/MM HH:mm')}
                      </span>
                      {log.seo_score_before != null && log.seo_score_after != null && (
                        <span className="text-[10px] font-medium text-emerald-600">
                          {log.seo_score_before} → {log.seo_score_after}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {log.confidence_score}% confiance
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{log.changes_summary}</p>
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
