import { useState, useEffect, useMemo, useCallback } from 'react';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Bot, Activity, CheckCircle2, XCircle, Loader2, TrendingUp, Clock, HeartPulse, RefreshCw, Trash2, AlertTriangle, X, Plug, PlugZap, Anchor } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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

// All functions CTO can supervise, grouped by category
const CTO_FUNCTION_REGISTRY: { key: string; label: string; category: string }[] = [
  // Audits
  { key: 'audit-expert-seo', label: 'Audit Expert SEO', category: 'Audits' },
  { key: 'audit-strategique-ia', label: 'Audit Stratégique IA', category: 'Audits' },
  { key: 'audit-compare', label: 'Audit Comparatif', category: 'Audits' },
  { key: 'audit-local-seo', label: 'Audit SEO Local', category: 'Audits' },
  { key: 'audit-matrice', label: 'Matrice d\'audit', category: 'Audits' },
  // Crawl & Cocoon
  { key: 'crawl-site', label: 'Crawl multi-pages', category: 'Crawl & Cocoon' },
  { key: 'calculate-cocoon-logic', label: 'Cocoon Logic', category: 'Crawl & Cocoon' },
  { key: 'calculate-internal-pagerank', label: 'PageRank interne', category: 'Crawl & Cocoon' },
  { key: 'cocoon-chat', label: 'Stratège Cocoon', category: 'Crawl & Cocoon' },
  { key: 'persist-cocoon-session', label: 'Session Cocoon', category: 'Crawl & Cocoon' },
  // Diagnostics
  { key: 'cocoon-diag-content', label: 'Diag. Contenu', category: 'Diagnostics' },
  { key: 'cocoon-diag-semantic', label: 'Diag. Sémantique', category: 'Diagnostics' },
  { key: 'cocoon-diag-structure', label: 'Diag. Structure', category: 'Diagnostics' },
  { key: 'cocoon-diag-authority', label: 'Diag. Autorité', category: 'Diagnostics' },
  // Strategy
  { key: 'cocoon-strategist', label: 'Stratège', category: 'Stratégie' },
  { key: 'content-architecture-advisor', label: 'Content Architect', category: 'Stratégie' },
  { key: 'detect-anomalies', label: 'Détection anomalies', category: 'Stratégie' },
  // Visibility
  { key: 'check-llm', label: 'Visibilité LLM', category: 'Visibilité' },
  { key: 'check-llm-depth', label: 'Profondeur LLM', category: 'Visibilité' },
  { key: 'diagnose-hallucination', label: 'Hallucination', category: 'Visibilité' },
  { key: 'calculate-llm-volumes', label: 'Volumes LLM', category: 'Visibilité' },
  // Connectors
  { key: 'rankmath-connector', label: 'RankMath', category: 'Connecteurs' },
  { key: 'gtmetrix-connector', label: 'GTmetrix', category: 'Connecteurs' },
  { key: 'linkwhisper-connector', label: 'LinkWhisper', category: 'Connecteurs' },
  { key: 'google-ads-connector', label: 'Google Ads', category: 'Connecteurs' },
  // Code
  { key: 'generate-corrective-code', label: 'Code correctif', category: 'Code' },
  // Quiz & Learning
  { key: 'felix-seo-quiz', label: 'Quiz SEO/GEO/LLM', category: 'Learning' },
  { key: 'sync-quiz-crawlers', label: 'Sync Quiz Crawlers (mensuel)', category: 'Learning' },
  { key: 'felix-weekly-quiz-notif', label: 'Notif Quiz Hebdo', category: 'Learning' },
];

export function CtoAgentDashboard() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [cacheHealth, setCacheHealth] = useState<CacheHealthReport | null>(null);
  const [checkingCache, setCheckingCache] = useState(false);
  const [refreshingJournal, setRefreshingJournal] = useState(false);
  const [diagnosingCrashes, setDiagnosingCrashes] = useState(false);
  const [diagnosingMarina, setDiagnosingMarina] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [functionToggles, setFunctionToggles] = useState<Record<string, boolean>>({});
  const [savingToggles, setSavingToggles] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [configRes, logsRes, togglesRes] = await Promise.all([
        supabase.from('system_config' as any).select('value').eq('key', 'cto_agent_enabled').single(),
        supabase.from('cto_agent_logs' as any)
          .select('id, function_analyzed, confidence_score, decision, created_at, change_diff_pct, analysis_summary, self_critique, prompt_version_before, prompt_version_after')
          .order('created_at', { ascending: true }),
        supabase.from('system_config' as any).select('value').eq('key', 'cto_function_toggles').single(),
      ]);

      if (configRes.data) {
        setEnabled((configRes.data as any).value?.enabled === true);
      }
      if (logsRes.data) {
        setLogs((logsRes.data as unknown as AgentLog[]) || []);
        setAlertDismissed(false);
      }
      // Load function toggles — default all to true if no config exists
      if (togglesRes.data) {
        setFunctionToggles((togglesRes.data as any).value || {});
      } else {
        // Initialize all functions as enabled
        const defaults: Record<string, boolean> = {};
        CTO_FUNCTION_REGISTRY.forEach(f => { defaults[f.key] = true; });
        setFunctionToggles(defaults);
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

  const handleFunctionToggle = useCallback(async (fnKey: string, checked: boolean) => {
    const updated = { ...functionToggles, [fnKey]: checked };
    setFunctionToggles(updated);
    setSavingToggles(true);
    try {
      // Upsert the toggles config
      const { error } = await supabase
        .from('system_config' as any)
        .upsert({ key: 'cto_function_toggles', value: updated, updated_at: new Date().toISOString() } as any, { onConflict: 'key' });
      if (error) throw error;
      toast({
        title: checked ? '✅ Connexion activée' : '⚠️ Connexion désactivée',
        description: `CTO ${checked ? 'supervise' : 'ne supervise plus'} ${fnKey}`,
      });
    } catch (e) {
      console.error('Toggle error:', e);
      // Revert
      setFunctionToggles(prev => ({ ...prev, [fnKey]: !checked }));
      toast({ title: 'Erreur', description: 'Impossible de sauvegarder.', variant: 'destructive' });
    } finally {
      setSavingToggles(false);
    }
  }, [functionToggles, toast]);

  const groupedFunctions = useMemo(() => {
    const groups: Record<string, typeof CTO_FUNCTION_REGISTRY> = {};
    CTO_FUNCTION_REGISTRY.forEach(fn => {
      if (!groups[fn.category]) groups[fn.category] = [];
      groups[fn.category].push(fn);
    });
    return groups;
  }, []);

  const enabledCount = CTO_FUNCTION_REGISTRY.filter(f => functionToggles[f.key] !== false).length;

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

  // Priority alert: detect recurring issues from recent logs
  const priorityAlert = useMemo(() => {
    if (logs.length < 3) return null;

    // Count issues per function (rejected or low confidence)
    const recentLogs = [...logs].reverse().slice(0, 50);
    const functionIssues: Record<string, { rejected: number; lowConf: number; total: number; lastSummary: string }> = {};

    for (const log of recentLogs) {
      if (!functionIssues[log.function_analyzed]) {
        functionIssues[log.function_analyzed] = { rejected: 0, lowConf: 0, total: 0, lastSummary: '' };
      }
      const fi = functionIssues[log.function_analyzed];
      fi.total++;
      if (log.decision === 'rejected') fi.rejected++;
      if (log.confidence_score < 60) fi.lowConf++;
      if (!fi.lastSummary) fi.lastSummary = log.analysis_summary;
    }

    // Find recurring problems (≥2 rejections or ≥3 low confidence)
    const problems = Object.entries(functionIssues)
      .filter(([, fi]) => fi.rejected >= 2 || fi.lowConf >= 3)
      .sort(([, a], [, b]) => (b.rejected + b.lowConf) - (a.rejected + a.lowConf));

    if (problems.length === 0) return null;

    const severity = problems.some(([, fi]) => fi.rejected >= 3) ? 'critical' : 'warning';
    const summaryLines = problems.map(([fn, fi]) =>
      `• ${fn} : ${fi.rejected} rejet(s), ${fi.lowConf} analyse(s) basse confiance sur ${fi.total} — "${fi.lastSummary.substring(0, 100)}…"`
    );

    return { severity, problems: summaryLines, count: problems.length };
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

      {/* Priority Alert */}
      {priorityAlert && !alertDismissed && (
        <Alert variant={priorityAlert.severity === 'critical' ? 'destructive' : 'default'} className={`relative ${priorityAlert.severity === 'critical' ? '' : 'border-orange-500/40 bg-orange-500/5'}`}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-sm pr-6">
            {priorityAlert.severity === 'critical' ? '🔴' : '🟠'} {priorityAlert.count} problème(s) récurrent(s) détecté(s)
          </AlertTitle>
          <AlertDescription className="mt-1 space-y-0.5">
            {priorityAlert.problems.map((line, i) => (
              <p key={i} className="text-xs text-muted-foreground">{line}</p>
            ))}
          </AlertDescription>
          <button
            onClick={() => setAlertDismissed(true)}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </Alert>
      )}

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

      {/* Function Connections Registry */}
      <Card className="border-muted">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PlugZap className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Connexions CTO → Fonctions</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">
              {enabledCount}/{CTO_FUNCTION_REGISTRY.length} actives
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Activez ou désactivez la supervision CTO sur chaque fonction. Un toggle désactivé empêche l'Agent CTO d'analyser et modifier les prompts de cette fonction.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
            {Object.entries(groupedFunctions).map(([category, fns]) => (
              <div key={category} className="space-y-1.5 mb-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{category}</p>
                {fns.map(fn => {
                  const isOn = functionToggles[fn.key] !== false;
                  return (
                    <div key={fn.key} className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-2">
                        <Plug className={cn('h-3 w-3', isOn ? 'text-emerald-500' : 'text-muted-foreground/40')} />
                        <span className={cn('text-xs', isOn ? 'text-foreground' : 'text-muted-foreground')}>{fn.label}</span>
                      </div>
                      <Switch
                        checked={isOn}
                        onCheckedChange={(checked) => handleFunctionToggle(fn.key, checked)}
                        disabled={savingToggles}
                        className="scale-75"
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
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
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-base">Journal des analyses récentes</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              disabled={refreshingJournal}
              onClick={async () => {
                setRefreshingJournal(true);
                try {
                  const { data, error } = await supabase.functions.invoke('agent-cto', {
                    body: { action: 'analyze' },
                  });
                  if (error) throw error;
                  toast({ title: '✅ Journal mis à jour', description: data?.analysis_summary || 'Analyse terminée' });
                  fetchData();
                } catch (e) {
                  console.error(e);
                  toast({ title: 'Erreur', description: 'Impossible de relancer l\'analyse CTO.', variant: 'destructive' });
                } finally {
                  setRefreshingJournal(false);
                }
              }}
            >
              {refreshingJournal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Mettre à jour
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              disabled={diagnosingCrashes}
              onClick={async () => {
                setDiagnosingCrashes(true);
                try {
                  const { data, error } = await supabase.functions.invoke('agent-cto', {
                    body: { action: 'diagnose_frontend_crashes' },
                  });
                  if (error) throw error;
                  toast({
                    title: '🏥 Diagnostic frontend terminé',
                    description: `${data?.crashes_analyzed || 0} crash(s) analysé(s)`,
                  });
                  fetchData();
                } catch (e) {
                  console.error(e);
                  toast({ title: 'Erreur', description: 'Impossible de diagnostiquer les crashs.', variant: 'destructive' });
                } finally {
                  setDiagnosingCrashes(false);
                }
              }}
            >
              {diagnosingCrashes ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HeartPulse className="h-3.5 w-3.5" />}
              Diagnostiquer crashs
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              disabled={diagnosingMarina}
              onClick={async () => {
                setDiagnosingMarina(true);
                try {
                  const { data, error } = await supabase.functions.invoke('agent-cto', {
                    body: { action: 'diagnose_marina_errors' },
                  });
                  if (error) throw error;
                  toast({
                    title: '⚓ Diagnostic Marina terminé',
                    description: `${data?.failed_jobs || 0} job(s) échoué(s), ${data?.silent_errors || 0} erreur(s) silencieuse(s)`,
                  });
                  fetchData();
                } catch (e) {
                  console.error(e);
                  toast({ title: 'Erreur', description: 'Impossible de diagnostiquer Marina.', variant: 'destructive' });
                } finally {
                  setDiagnosingMarina(false);
                }
              }}
            >
              {diagnosingMarina ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Anchor className="h-3.5 w-3.5" />}
              Diagnostiquer Marina
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs text-destructive hover:text-destructive"
              disabled={clearing || logs.length === 0}
              onClick={async () => {
                if (!confirm('Supprimer toutes les entrées du journal CTO ?')) return;
                setClearing(true);
                try {
                  const { error } = await supabase
                    .from('cto_agent_logs')
                    .delete()
                    .neq('id', '00000000-0000-0000-0000-000000000000');
                  if (error) throw error;
                  setLogs([]);
                  toast({ title: '🗑️ Journal vidé', description: 'Toutes les entrées ont été supprimées.' });
                } catch (e) {
                  console.error(e);
                  toast({ title: 'Erreur', description: 'Impossible de vider le journal.', variant: 'destructive' });
                } finally {
                  setClearing(false);
                }
              }}
            >
              {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Vider
            </Button>
          </div>
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
