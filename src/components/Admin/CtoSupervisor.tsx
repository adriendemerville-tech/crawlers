import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Shield, AlertTriangle, CheckCircle2, XCircle, Loader2, RefreshCw,
  GitCompare, Play, Code2, Eye, ChevronDown, ChevronRight,
  Power, Zap,
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

interface CorrectionAudit {
  cto_log_id: string;
  function: string;
  cto_intent: string;
  solution_quality: 'green' | 'orange';
  logic_assessment: string;
  edge_cases: string[];
  performance_impact: string;
  regression_detected: boolean;
  regression_details: string;
  improvement_suggestion: string | null;
}

interface SupervisorAnalysis {
  summary: string;
  corrections_audited: CorrectionAudit[];
  overall_cto_score: number | string;
  patterns_observed: string[];
  strategic_recommendations: string[];
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
  const [correctionCount, setCorrectionCount] = useState(0);
  const [functionsAudited, setFunctionsAudited] = useState<string[]>([]);
  const [postDeployErrors, setPostDeployErrors] = useState(0);
  const [expandedAudit, setExpandedAudit] = useState<string | null>(null);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('supervisor-actions', {
        body: { action: 'analyze' },
      });
      if (error) throw error;
      setAnalysis(data.analysis);
      setCorrectionCount(data.correction_count || 0);
      setFunctionsAudited(data.functions_audited || []);
      setPostDeployErrors(data.post_deploy_errors || 0);
      toast.success(`Audit terminé — ${data.analysis?.corrections_audited?.length || 0} corrections auditées`);
    } catch (err: any) {
      console.error('Supervisor audit error:', err);
      toast.error('Erreur lors de l\'audit');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={runAnalysis} disabled={analyzing} className="gap-2" size="sm">
          {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {analyzing ? 'Audit en cours...' : 'Auditer les corrections CTO'}
        </Button>
      </div>

      {/* Audit results */}
      {analysis && (
        <div className="space-y-4">
          {/* Summary card */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Audit des corrections CTO
                <Badge variant="outline" className="text-xs ml-auto">{correctionCount} corrections</Badge>
                {postDeployErrors > 0 && (
                  <Badge className="text-[10px] bg-orange-500/15 text-orange-400 border-orange-500/30">{postDeployErrors} erreurs post-deploy</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">{analysis.summary}</p>

              {/* CTO Score */}
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-medium text-muted-foreground">Score CTO :</span>
                <Badge className={cn(
                  "text-xs",
                  Number(analysis.overall_cto_score) >= 80
                    ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                    : Number(analysis.overall_cto_score) >= 50
                    ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
                    : "bg-destructive/15 text-destructive border-destructive/30"
                )}>{analysis.overall_cto_score}/100</Badge>
              </div>

              {/* Functions audited */}
              {functionsAudited.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground">Fonctions modifiées :</p>
                  <div className="flex flex-wrap gap-1.5">
                    {functionsAudited.map((fn, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] font-mono">{fn}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Patterns observed */}
              {analysis.patterns_observed?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground">Patterns observés :</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.patterns_observed.map((p, i) => (
                      <Badge key={i} variant="outline" className="text-[10px]">{p}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Corrections audited */}
          {analysis.corrections_audited?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                Corrections auditées ({analysis.corrections_audited.length})
              </h4>
              {analysis.corrections_audited.map((audit, idx) => (
                <Card
                  key={audit.cto_log_id || idx}
                  className={cn(
                    "border-l-4 cursor-pointer transition-colors hover:bg-muted/30",
                    audit.solution_quality === 'green' ? "border-l-emerald-500" : "border-l-orange-500"
                  )}
                  onClick={() => setExpandedAudit(expandedAudit === (audit.cto_log_id || String(idx)) ? null : (audit.cto_log_id || String(idx)))}
                >
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {expandedAudit === (audit.cto_log_id || String(idx)) ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <div>
                          <span className="text-sm font-medium font-mono">{audit.function}</span>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{audit.cto_intent}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {audit.regression_detected && (
                          <Badge className="text-[10px] bg-destructive/15 text-destructive border-destructive/30">Régression</Badge>
                        )}
                        <Badge
                          className={cn(
                            "text-[10px]",
                            audit.solution_quality === 'green'
                              ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                              : "bg-orange-500/15 text-orange-400 border-orange-500/30"
                          )}
                        >
                          {audit.solution_quality === 'green' ? '🟢 Sain' : '🟠 Réserves'}
                        </Badge>
                      </div>
                    </div>

                    {expandedAudit === (audit.cto_log_id || String(idx)) && (
                      <div className="space-y-3 mt-2 pl-5">
                        {/* Logic assessment */}
                        <div className="bg-muted/30 rounded p-2">
                          <p className="text-[10px] font-medium text-muted-foreground mb-1">🔍 Logique de la solution :</p>
                          <p className="text-[11px] text-foreground/80">{audit.logic_assessment}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          {/* Performance impact */}
                          <div className="bg-muted/30 rounded p-2">
                            <p className="text-[10px] font-medium text-muted-foreground mb-1">⚡ Impact performance :</p>
                            <p className="text-[11px] text-foreground/80">{audit.performance_impact}</p>
                          </div>

                          {/* Edge cases */}
                          <div className="bg-muted/30 rounded p-2">
                            <p className="text-[10px] font-medium text-muted-foreground mb-1">🔲 Edge cases :</p>
                            {audit.edge_cases?.length > 0 ? (
                              <ul className="space-y-0.5">
                                {audit.edge_cases.map((ec, i) => (
                                  <li key={i} className="text-[11px] text-foreground/80">• {ec}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-[11px] text-emerald-500">Aucun détecté</p>
                            )}
                          </div>
                        </div>

                        {/* Regression details */}
                        {audit.regression_detected && audit.regression_details && (
                          <div className="bg-destructive/5 border border-destructive/20 rounded p-2">
                            <p className="text-[10px] font-semibold text-destructive mb-1">🚨 Régression détectée :</p>
                            <p className="text-[11px] text-foreground/80">{audit.regression_details}</p>
                          </div>
                        )}

                        {/* Improvement suggestion */}
                        {audit.improvement_suggestion && (
                          <div className="bg-orange-500/5 border border-orange-500/20 rounded p-2">
                            <p className="text-[10px] font-semibold text-orange-400 mb-1">💡 Suggestion d'amélioration :</p>
                            <p className="text-[11px] text-foreground/80">{audit.improvement_suggestion}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Strategic recommendations */}
          {analysis.strategic_recommendations?.length > 0 && (
            <Card className="border-border/50">
              <CardContent className="p-3 space-y-2">
                <p className="text-[11px] font-medium text-muted-foreground">📋 Recommandations stratégiques :</p>
                <ul className="space-y-1">
                  {analysis.strategic_recommendations.map((r, i) => (
                    <li key={i} className="text-[11px] text-foreground/80 flex items-start gap-1.5">
                      <span className="text-primary mt-0.5">→</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
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

      {/* Successes list */}
      {stats.successes.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Réussites CTO ({stats.successes.length})
          </h4>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {stats.successes.slice(0, 20).map((change) => (
              <Card key={change.id} className="border-l-4 border-l-emerald-500">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span className="font-mono text-xs font-medium">{change.function_analyzed}</span>
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">{change.decision}</Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(change.created_at), 'dd/MM HH:mm', { locale: fr })}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{change.analysis_summary}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
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
