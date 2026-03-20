import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Shield, AlertTriangle, CheckCircle2, XCircle, Loader2, RefreshCw,
  GitCompare, Play, Code2, Rocket, Eye, ChevronDown, ChevronRight,
  Power, Zap, FileCode,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────
interface CtoChange {
  id: string;
  function_analyzed: string;
  decision: string;
  confidence_score: number;
  analysis_summary: string;
  self_critique: string;
  change_diff_pct: number | null;
  created_at: string;
}

interface DetectedError {
  id: string;
  event_type: string;
  function_name: string;
  error_message: string;
  page_url: string;
  created_at: string;
  source: 'frontend' | 'backend' | 'injection' | 'silent';
}

interface Correlation {
  ctoChange: CtoChange;
  relatedErrors: DetectedError[];
  severity: 'warning' | 'info';
  verdict: string;
}

interface Recommendation {
  id: number;
  title: string;
  description: string;
  benefit: string;
  risk: string;
  risk_level: 'green' | 'orange';
  risk_mitigation: string;
  code_change: string;
  affected_lines: string;
}

interface SupervisorAnalysis {
  analysis: string;
  error_patterns: string[];
  recommendations: Recommendation[];
  overall_assessment: string;
  contournements_applied: string[];
}

// ─── Kill Switches Panel ──────────────────────────────────────────────
function KillSwitchesPanel() {
  const [ctoEnabled, setCtoEnabled] = useState(true);
  const [supervisorEnabled, setSupervisorEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('system_config' as any)
        .select('key, value')
        .in('key', ['cto_agent_enabled', 'supervisor_enabled']);
      
      const configs = (data || []) as any[];
      for (const c of configs) {
        if (c.key === 'cto_agent_enabled') setCtoEnabled(c.value?.enabled ?? true);
        if (c.key === 'supervisor_enabled') setSupervisorEnabled(c.value?.enabled ?? true);
      }
      setLoading(false);
    })();
  }, []);

  const toggleSwitch = async (target: string, newState: boolean) => {
    const setter = target === 'cto_agent_enabled' ? setCtoEnabled : setSupervisorEnabled;
    setter(newState);
    
    const { error } = await supabase.functions.invoke('supervisor-actions', {
      body: { action: 'toggle_killswitch', target, enabled: newState },
    });
    
    if (error) {
      setter(!newState);
      toast.error('Erreur lors du basculement');
    } else {
      toast.success(`${target === 'cto_agent_enabled' ? 'Agent CTO' : 'Supervisor'} ${newState ? 'activé' : 'désactivé'}`);
    }
  };

  if (loading) return null;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Power className="h-4 w-4" />
          Kill Switches
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("h-2 w-2 rounded-full", ctoEnabled ? "bg-emerald-500" : "bg-destructive")} />
            <Label className="text-xs font-medium">Agent CTO</Label>
          </div>
          <Switch checked={ctoEnabled} onCheckedChange={(v) => toggleSwitch('cto_agent_enabled', v)} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("h-2 w-2 rounded-full", supervisorEnabled ? "bg-emerald-500" : "bg-destructive")} />
            <Label className="text-xs font-medium">Supervisor</Label>
          </div>
          <Switch checked={supervisorEnabled} onCheckedChange={(v) => toggleSwitch('supervisor_enabled', v)} />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Supervisor Analysis Panel ────────────────────────────────────────
function SupervisorAnalysisPanel() {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<SupervisorAnalysis | null>(null);
  const [errorCount, setErrorCount] = useState(0);
  const [expandedReco, setExpandedReco] = useState<number | null>(null);
  const [ctoCode, setCtoCode] = useState('');
  const [codeVisible, setCodeVisible] = useState(false);
  const [loadingCode, setLoadingCode] = useState(false);
  const [deploying, setDeploying] = useState(false);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('supervisor-actions', {
        body: { action: 'analyze' },
      });
      if (error) throw error;
      setAnalysis(data.analysis);
      setErrorCount(data.error_count || 0);
      toast.success(`Analyse terminée — ${data.analysis?.recommendations?.length || 0} recommandations`);
    } catch (err: any) {
      console.error('Supervisor analysis error:', err);
      toast.error('Erreur lors de l\'analyse');
    } finally {
      setAnalyzing(false);
    }
  };

  const loadCtoCode = async () => {
    setLoadingCode(true);
    try {
      const { data, error } = await supabase.functions.invoke('supervisor-actions', {
        body: { action: 'read_cto_code' },
      });
      if (error) throw error;
      setCtoCode(data.code || '');
      setCodeVisible(true);
    } catch (err: any) {
      toast.error('Erreur de lecture du code CTO');
    } finally {
      setLoadingCode(false);
    }
  };

  const deployCtoChanges = async () => {
    if (!ctoCode.trim()) return;
    setDeploying(true);
    try {
      const { data, error } = await supabase.functions.invoke('supervisor-actions', {
        body: { action: 'apply_changes', new_code: ctoCode },
      });
      if (error) throw error;
      if (data.success) {
        toast.success('Code CTO mis à jour avec succès');
      } else {
        toast.error(data.error || 'Erreur de déploiement');
      }
    } catch (err: any) {
      toast.error('Erreur lors du déploiement');
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={runAnalysis} disabled={analyzing} className="gap-2" size="sm">
          {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {analyzing ? 'Analyse en cours...' : 'Lancer l\'analyse'}
        </Button>
        <Button variant="outline" onClick={loadCtoCode} disabled={loadingCode} className="gap-2" size="sm">
          {loadingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCode className="h-4 w-4" />}
          Code CTO
        </Button>
      </div>

      {/* Analysis results */}
      {analysis && (
        <div className="space-y-4">
          {/* Summary */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Analyse Supervisor
                <Badge variant="outline" className="text-xs ml-auto">{errorCount} erreurs compilées</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">{analysis.analysis}</p>
              
              {/* Error patterns */}
              {analysis.error_patterns?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground">Patterns d'erreurs détectés :</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.error_patterns.map((p, i) => (
                      <Badge key={i} variant="outline" className="text-[10px]">{p}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Contournements */}
              {analysis.contournements_applied?.length > 0 && (
                <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-3 space-y-1">
                  <p className="text-[11px] font-semibold text-orange-400">🔄 Contournements appliqués (rouge → orange) :</p>
                  {analysis.contournements_applied.map((c, i) => (
                    <p key={i} className="text-[11px] text-muted-foreground">• {c}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recommendations */}
          {analysis.recommendations?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                Recommandations ({analysis.recommendations.length})
              </h4>
              {analysis.recommendations.map((rec) => (
                <Card
                  key={rec.id}
                  className={cn(
                    "border-l-4 cursor-pointer transition-colors hover:bg-muted/30",
                    rec.risk_level === 'green' ? "border-l-emerald-500" : "border-l-orange-500"
                  )}
                  onClick={() => setExpandedReco(expandedReco === rec.id ? null : rec.id)}
                >
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {expandedReco === rec.id ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-sm font-medium">{rec.title}</span>
                      </div>
                      <Badge
                        className={cn(
                          "text-[10px] shrink-0",
                          rec.risk_level === 'green'
                            ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                            : "bg-orange-500/15 text-orange-400 border-orange-500/30"
                        )}
                      >
                        {rec.risk_level === 'green' ? '🟢 Safe' : '🟠 Attention'}
                      </Badge>
                    </div>

                    {expandedReco === rec.id && (
                      <div className="space-y-3 mt-2 pl-5">
                        <p className="text-xs text-muted-foreground">{rec.description}</p>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded p-2">
                            <p className="text-[10px] font-semibold text-emerald-500 mb-1">✅ Bénéfice</p>
                            <p className="text-[11px] text-muted-foreground">{rec.benefit}</p>
                          </div>
                          <div className="bg-orange-500/5 border border-orange-500/20 rounded p-2">
                            <p className="text-[10px] font-semibold text-orange-400 mb-1">⚠️ Risque</p>
                            <p className="text-[11px] text-muted-foreground">{rec.risk}</p>
                          </div>
                        </div>

                        <div className="bg-muted/30 rounded p-2">
                          <p className="text-[10px] font-medium text-muted-foreground mb-1">🛡️ Atténuation du risque :</p>
                          <p className="text-[11px] text-foreground/80">{rec.risk_mitigation}</p>
                        </div>

                        {rec.code_change && (
                          <div className="bg-background border border-border rounded-lg overflow-hidden">
                            <div className="px-2 py-1 bg-muted/50 border-b border-border flex items-center gap-1.5">
                              <Code2 className="h-3 w-3 text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground font-mono">{rec.affected_lines}</span>
                            </div>
                            <pre className="p-2 text-[11px] font-mono text-foreground/80 overflow-x-auto max-h-48">
                              {rec.code_change}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Overall assessment */}
          <Card className="border-border/50">
            <CardContent className="p-3">
              <p className="text-[11px] font-medium text-muted-foreground mb-1">Évaluation globale :</p>
              <p className="text-xs text-foreground/80">{analysis.overall_assessment}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CTO Code Editor */}
      {codeVisible && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileCode className="h-4 w-4" />
                Code Agent CTO (backend)
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2"
                  disabled={deploying || !ctoCode.trim()}
                  onClick={deployCtoChanges}
                >
                  {deploying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
                  Déployer
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setCodeVisible(false)}>
                  Fermer
                </Button>
              </div>
            </div>
            <CardDescription className="text-[11px]">
              Modifiez le code de l'Agent CTO. Seul le backend (edge function) est modifiable.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={ctoCode}
              onChange={(e) => setCtoCode(e.target.value)}
              className="font-mono text-[11px] min-h-[400px] resize-y bg-background"
              spellCheck={false}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Correlation Monitor (original functionality) ─────────────────────
function CorrelationMonitor() {
  const [loading, setLoading] = useState(true);
  const [correlations, setCorrelations] = useState<Correlation[]>([]);
  const [allErrors, setAllErrors] = useState<DetectedError[]>([]);
  const [ctoChanges, setCtoChanges] = useState<CtoChange[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const [ctoRes, errorsRes, silentRes, injectionRes] = await Promise.all([
        supabase.from('cto_agent_logs').select('*').gte('created_at', thirtyDaysAgo).order('created_at', { ascending: false }).limit(50),
        supabase.from('analytics_events').select('*').in('event_type', ['error', 'edge_function_error', 'browserless_error', 'scan_error']).gte('created_at', thirtyDaysAgo).order('created_at', { ascending: false }).limit(200),
        supabase.from('analytics_events').select('*').eq('event_type', 'silent_error').gte('created_at', thirtyDaysAgo).order('created_at', { ascending: false }).limit(100),
        supabase.from('analytics_events').select('*').eq('event_type', 'injection_error').gte('created_at', thirtyDaysAgo).order('created_at', { ascending: false }).limit(50),
      ]);

      const changes: CtoChange[] = (ctoRes.data || []).map((log: any) => ({
        id: log.id, function_analyzed: log.function_analyzed, decision: log.decision,
        confidence_score: log.confidence_score, analysis_summary: log.analysis_summary,
        self_critique: log.self_critique, change_diff_pct: log.change_diff_pct, created_at: log.created_at,
      }));

      const parseError = (event: any, source: DetectedError['source']): DetectedError => {
        const data = event.event_data || {};
        return {
          id: event.id, event_type: event.event_type,
          function_name: data.function_name || data.fn || '',
          error_message: data.error_message || data.message || data.error || '',
          page_url: event.url || data.page || '', created_at: event.created_at, source,
        };
      };

      const errors: DetectedError[] = [
        ...(errorsRes.data || []).map((e: any) => parseError(e, e.event_type === 'error' ? 'frontend' : 'backend')),
        ...(silentRes.data || []).map((e: any) => parseError(e, 'silent')),
        ...(injectionRes.data || []).map((e: any) => parseError(e, 'injection')),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setCtoChanges(changes);
      setAllErrors(errors);

      // Cross-reference correlations — severity capped at 'warning' (no critical/red)
      const corrs: Correlation[] = [];
      for (const change of changes) {
        if (change.decision === 'no_change') continue;
        const changeTime = new Date(change.created_at).getTime();
        const windowEnd = changeTime + 48 * 60 * 60 * 1000;
        
        const relatedErrors = errors.filter(err => {
          const errTime = new Date(err.created_at).getTime();
          if (errTime < changeTime || errTime > windowEnd) return false;
          const fnLower = change.function_analyzed.toLowerCase();
          const errFnLower = (err.function_name || '').toLowerCase();
          const errMsgLower = (err.error_message || '').toLowerCase();
          const errPageLower = (err.page_url || '').toLowerCase();
          if (errFnLower && (errFnLower.includes(fnLower) || fnLower.includes(errFnLower))) return true;
          if (errMsgLower.includes(fnLower)) return true;
          if (fnLower.includes('audit') && errPageLower.includes('audit')) return true;
          if (fnLower.includes('crawl') && errPageLower.includes('crawl')) return true;
          if (fnLower.includes('cocoon') && errPageLower.includes('cocoon')) return true;
          if (err.source === 'backend' && errTime - changeTime < 3600000) return true;
          return false;
        });

        if (relatedErrors.length > 0) {
          const backendCount = relatedErrors.filter(e => e.source === 'backend' || e.source === 'injection').length;
          // No 'critical' — max is 'warning'
          corrs.push({
            ctoChange: change,
            relatedErrors,
            severity: backendCount >= 1 ? 'warning' : 'info',
            verdict: backendCount >= 1
              ? `⚠️ ${backendCount} erreur(s) backend post-modification — contournement recommandé`
              : `${relatedErrors.length} erreur(s) frontend mineures détectées`,
          });
        }
      }

      setCorrelations(corrs);
    } catch (err) {
      console.error('Supervisor fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const stats = useMemo(() => {
    const total = correlations.length;
    const warning = correlations.filter(c => c.severity === 'warning').length;
    const info = correlations.filter(c => c.severity === 'info').length;
    const frontendErrors = allErrors.filter(e => e.source === 'frontend').length;
    const backendErrors = allErrors.filter(e => e.source === 'backend').length;
    const silentErrors = allErrors.filter(e => e.source === 'silent').length;
    const injectionErrors = allErrors.filter(e => e.source === 'injection').length;
    // Success = CTO changes (non no_change) with zero correlated errors
    const activeChanges = ctoChanges.filter(c => c.decision !== 'no_change');
    const failedIds = new Set(correlations.map(c => c.ctoChange.id));
    const successes = activeChanges.filter(c => !failedIds.has(c.id));
    const successCount = successes.length;
    const successRate = activeChanges.length > 0 ? Math.round((successCount / activeChanges.length) * 100) : 100;
    return { total, warning, info, frontendErrors, backendErrors, silentErrors, injectionErrors, successCount, successRate, activeChanges: activeChanges.length, successes };
  }, [correlations, allErrors, ctoChanges]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Analyse des corrélations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">30 jours — Corrélations CTO ↔ Erreurs</Badge>
          <Badge className={cn(
            "text-xs font-semibold",
            stats.successRate >= 70
              ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
              : "bg-destructive/15 text-destructive border-destructive/30"
          )}>
            {stats.successRate}% succès ({stats.successCount}/{stats.activeChanges})
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData} disabled={refreshing}>
          <RefreshCw className={cn("h-4 w-4 mr-1", refreshing && "animate-spin")} />
          Actualiser
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{ctoChanges.length}</p>
            <p className="text-[11px] text-muted-foreground">Modifications CTO</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-orange-500">{stats.warning}</p>
            <p className="text-[11px] text-muted-foreground">Corrélations ⚠️</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-emerald-500">{stats.info}</p>
            <p className="text-[11px] text-muted-foreground">Info 🟢</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{allErrors.length}</p>
            <p className="text-[11px] text-muted-foreground">Erreurs totales</p>
          </CardContent>
        </Card>
      </div>

      {/* Error breakdown */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Répartition des erreurs (30j)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="destructive" className="text-xs">Backend: {stats.backendErrors}</Badge>
            <Badge variant="secondary" className="text-xs">Frontend: {stats.frontendErrors}</Badge>
            <Badge variant="outline" className="text-xs">Silent: {stats.silentErrors}</Badge>
            <Badge className="text-xs bg-orange-500/20 text-orange-400 border-orange-500/30">Injection: {stats.injectionErrors}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Correlations list */}
      {correlations.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Aucune corrélation détectée entre les modifications CTO et les erreurs</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">
            Corrélations CTO ↔ Erreurs ({correlations.length})
          </h4>
          {correlations.map((corr, i) => (
            <Card
              key={i}
              className={cn(
                "border-l-4",
                corr.severity === 'warning' ? "border-l-orange-500" : "border-l-emerald-500"
              )}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <GitCompare className="h-4 w-4 text-primary" />
                      <span className="font-mono text-sm font-medium">{corr.ctoChange.function_analyzed}</span>
                      <Badge variant={corr.ctoChange.decision === 'applied' ? 'default' : 'secondary'} className="text-[10px]">
                        {corr.ctoChange.decision}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(corr.ctoChange.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </p>
                  </div>
                  <Badge
                    className={cn(
                      "text-[10px]",
                      corr.severity === 'warning'
                        ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
                        : "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                    )}
                  >
                    {corr.severity === 'warning' ? '🟠 Attention' : '🟢 Info'}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground/80 italic">{corr.verdict}</p>

                <div className="bg-muted/30 rounded p-2 text-xs">
                  <p className="font-medium text-muted-foreground mb-1">Analyse CTO :</p>
                  <p className="text-foreground/80">{corr.ctoChange.analysis_summary.substring(0, 200)}{corr.ctoChange.analysis_summary.length > 200 ? '...' : ''}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Erreurs post-modification ({corr.relatedErrors.length}) :
                  </p>
                  {corr.relatedErrors.slice(0, 5).map((err, j) => (
                    <div key={j} className="flex items-center gap-2 text-[11px]">
                      <XCircle className="h-3 w-3 text-orange-400 shrink-0" />
                      <Badge variant="outline" className="text-[9px] px-1">{err.source}</Badge>
                      <span className="text-muted-foreground truncate">{err.error_message || 'Erreur inconnue'}</span>
                      <span className="text-muted-foreground shrink-0">{format(new Date(err.created_at), 'dd/MM HH:mm')}</span>
                    </div>
                  ))}
                  {corr.relatedErrors.length > 5 && (
                    <p className="text-[10px] text-muted-foreground">+{corr.relatedErrors.length - 5} autres</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────
export function CtoSupervisor() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Supervisor CTO</h3>
        <Badge variant="outline" className="text-xs">v2 — Analyse & Déploiement</Badge>
      </div>

      {/* Kill Switches */}
      <KillSwitchesPanel />

      {/* Supervisor Analysis — AI powered */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Analyse & Modifications CTO
          </CardTitle>
          <CardDescription className="text-[11px]">
            Le Supervisor compile les erreurs, analyse le code CTO, et propose des modifications avec un ratio bénéfice/risque noté en 🟢 vert (safe) ou 🟠 orange (attention). Le rouge est interdit — le Supervisor trouve toujours un contournement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SupervisorAnalysisPanel />
        </CardContent>
      </Card>

      {/* Correlation Monitor */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <GitCompare className="h-4 w-4" />
            Moniteur de corrélations
          </CardTitle>
          <CardDescription className="text-[11px]">
            Cross-référencement automatique entre les modifications CTO et les erreurs détectées sous 48h.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CorrelationMonitor />
        </CardContent>
      </Card>
    </div>
  );
}

/** Returns the count of warning correlations for notification badges */
export async function fetchSupervisorAlertCount(): Promise<number> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const [ctoRes, errorsRes] = await Promise.all([
      supabase.from('cto_agent_logs').select('id, function_analyzed, decision, created_at').neq('decision', 'no_change').gte('created_at', thirtyDaysAgo).limit(50),
      supabase.from('analytics_events').select('id, event_type, event_data, created_at').in('event_type', ['edge_function_error', 'silent_error', 'injection_error']).gte('created_at', thirtyDaysAgo).limit(200),
    ]);

    const changes = ctoRes.data || [];
    const errors = errorsRes.data || [];
    let alertCount = 0;

    for (const change of changes) {
      const changeTime = new Date(change.created_at).getTime();
      const windowEnd = changeTime + 48 * 60 * 60 * 1000;
      const related = errors.filter(err => {
        const t = new Date(err.created_at).getTime();
        return t >= changeTime && t <= windowEnd;
      });
      if (related.length >= 1) alertCount++;
    }

    return alertCount;
  } catch {
    return 0;
  }
}
