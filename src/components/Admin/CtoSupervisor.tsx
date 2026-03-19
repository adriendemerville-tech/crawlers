import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, AlertTriangle, CheckCircle2, XCircle, Loader2, RefreshCw, ArrowRight, GitCompare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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
  severity: 'critical' | 'warning' | 'info';
  verdict: string;
}

export function CtoSupervisor() {
  const [loading, setLoading] = useState(true);
  const [correlations, setCorrelations] = useState<Correlation[]>([]);
  const [allErrors, setAllErrors] = useState<DetectedError[]>([]);
  const [ctoChanges, setCtoChanges] = useState<CtoChange[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    setRefreshing(true);
    try {
      // Fetch CTO agent logs (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const [ctoRes, errorsRes, silentRes, injectionRes] = await Promise.all([
        supabase
          .from('cto_agent_logs')
          .select('*')
          .gte('created_at', thirtyDaysAgo)
          .order('created_at', { ascending: false })
          .limit(50),
        // Frontend + backend errors
        supabase
          .from('analytics_events')
          .select('*')
          .in('event_type', ['error', 'edge_function_error', 'browserless_error', 'scan_error'])
          .gte('created_at', thirtyDaysAgo)
          .order('created_at', { ascending: false })
          .limit(200),
        // Silent errors
        supabase
          .from('analytics_events')
          .select('*')
          .eq('event_type', 'silent_error')
          .gte('created_at', thirtyDaysAgo)
          .order('created_at', { ascending: false })
          .limit(100),
        // Injection errors
        supabase
          .from('analytics_events')
          .select('*')
          .eq('event_type', 'injection_error')
          .gte('created_at', thirtyDaysAgo)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      const changes: CtoChange[] = (ctoRes.data || []).map((log: any) => ({
        id: log.id,
        function_analyzed: log.function_analyzed,
        decision: log.decision,
        confidence_score: log.confidence_score,
        analysis_summary: log.analysis_summary,
        self_critique: log.self_critique,
        change_diff_pct: log.change_diff_pct,
        created_at: log.created_at,
      }));

      const parseError = (event: any, source: DetectedError['source']): DetectedError => {
        const data = event.event_data || {};
        return {
          id: event.id,
          event_type: event.event_type,
          function_name: data.function_name || data.fn || '',
          error_message: data.error_message || data.message || data.error || '',
          page_url: event.url || data.page || '',
          created_at: event.created_at,
          source,
        };
      };

      const errors: DetectedError[] = [
        ...(errorsRes.data || []).map((e: any) => parseError(e, e.event_type === 'error' ? 'frontend' : 'backend')),
        ...(silentRes.data || []).map((e: any) => parseError(e, 'silent')),
        ...(injectionRes.data || []).map((e: any) => parseError(e, 'injection')),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setCtoChanges(changes);
      setAllErrors(errors);

      // Cross-reference: for each CTO change, find errors that appeared within 48h AFTER
      const corrs: Correlation[] = [];
      for (const change of changes) {
        if (change.decision === 'no_change') continue;
        
        const changeTime = new Date(change.created_at).getTime();
        const windowEnd = changeTime + 48 * 60 * 60 * 1000; // 48h window
        
        const relatedErrors = errors.filter(err => {
          const errTime = new Date(err.created_at).getTime();
          if (errTime < changeTime || errTime > windowEnd) return false;
          
          // Check if error is related to the function that was changed
          const fnLower = change.function_analyzed.toLowerCase();
          const errFnLower = (err.function_name || '').toLowerCase();
          const errMsgLower = (err.error_message || '').toLowerCase();
          const errPageLower = (err.page_url || '').toLowerCase();
          
          // Direct function match
          if (errFnLower && (errFnLower.includes(fnLower) || fnLower.includes(errFnLower))) return true;
          // Error message mentions the function
          if (errMsgLower.includes(fnLower)) return true;
          // Page URL is related (e.g. /audit-expert for audit functions)
          if (fnLower.includes('audit') && errPageLower.includes('audit')) return true;
          if (fnLower.includes('crawl') && errPageLower.includes('crawl')) return true;
          if (fnLower.includes('cocoon') && errPageLower.includes('cocoon')) return true;
          // Broader: any backend error in same timeframe for that function type
          if (err.source === 'backend' && errTime - changeTime < 3600000) return true;
          
          return false;
        });

        if (relatedErrors.length > 0) {
          const criticalCount = relatedErrors.filter(e => e.source === 'backend' || e.source === 'injection').length;
          corrs.push({
            ctoChange: change,
            relatedErrors,
            severity: criticalCount >= 3 ? 'critical' : criticalCount >= 1 ? 'warning' : 'info',
            verdict: criticalCount >= 3 
              ? `⚠️ ${criticalCount} erreurs backend détectées après modification CTO`
              : criticalCount >= 1
              ? `Possible corrélation : ${relatedErrors.length} erreur(s) post-modification`
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
    const critical = correlations.filter(c => c.severity === 'critical').length;
    const warning = correlations.filter(c => c.severity === 'warning').length;
    const frontendErrors = allErrors.filter(e => e.source === 'frontend').length;
    const backendErrors = allErrors.filter(e => e.source === 'backend').length;
    const silentErrors = allErrors.filter(e => e.source === 'silent').length;
    const injectionErrors = allErrors.filter(e => e.source === 'injection').length;
    return { total, critical, warning, frontendErrors, backendErrors, silentErrors, injectionErrors };
  }, [correlations, allErrors]);

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
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Supervisor CTO</h3>
          <Badge variant="outline" className="text-xs">30 jours</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData} disabled={refreshing}>
          <RefreshCw className={cn("h-4 w-4 mr-1", refreshing && "animate-spin")} />
          Actualiser
        </Button>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{ctoChanges.length}</p>
            <p className="text-[11px] text-muted-foreground">Modifications CTO</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{stats.critical}</p>
            <p className="text-[11px] text-muted-foreground">Corrélations critiques</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-yellow-500">{stats.warning}</p>
            <p className="text-[11px] text-muted-foreground">Corrélations warning</p>
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
            <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
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
                corr.severity === 'critical' ? "border-l-destructive" : 
                corr.severity === 'warning' ? "border-l-yellow-500" : "border-l-muted"
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
                      {corr.ctoChange.change_diff_pct != null && (
                        <span className="text-[10px] text-muted-foreground">Δ {corr.ctoChange.change_diff_pct}%</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(corr.ctoChange.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </p>
                  </div>
                  <Badge 
                    variant={corr.severity === 'critical' ? 'destructive' : 'secondary'}
                    className="text-[10px]"
                  >
                    {corr.severity === 'critical' ? '🔴 Critique' : corr.severity === 'warning' ? '🟠 Warning' : '🟢 Info'}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground/80 italic">{corr.verdict}</p>

                {/* CTO analysis summary */}
                <div className="bg-muted/30 rounded p-2 text-xs">
                  <p className="font-medium text-muted-foreground mb-1">Analyse CTO :</p>
                  <p className="text-foreground/80">{corr.ctoChange.analysis_summary.substring(0, 200)}{corr.ctoChange.analysis_summary.length > 200 ? '...' : ''}</p>
                  {corr.ctoChange.self_critique && (
                    <p className="text-muted-foreground mt-1">Auto-critique : {corr.ctoChange.self_critique.substring(0, 150)}</p>
                  )}
                </div>

                {/* Related errors */}
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Erreurs post-modification ({corr.relatedErrors.length}) :
                  </p>
                  {corr.relatedErrors.slice(0, 5).map((err, j) => (
                    <div key={j} className="flex items-center gap-2 text-[11px]">
                      <XCircle className="h-3 w-3 text-destructive shrink-0" />
                      <Badge variant="outline" className="text-[9px] px-1">
                        {err.source}
                      </Badge>
                      <span className="text-destructive/80 truncate">{err.error_message || 'Erreur inconnue'}</span>
                      <span className="text-muted-foreground shrink-0">
                        {format(new Date(err.created_at), 'dd/MM HH:mm')}
                      </span>
                    </div>
                  ))}
                  {corr.relatedErrors.length > 5 && (
                    <p className="text-[10px] text-muted-foreground">+{corr.relatedErrors.length - 5} autres erreurs</p>
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

/** Returns the count of critical+warning correlations for notification badges */
export async function fetchSupervisorAlertCount(): Promise<number> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const [ctoRes, errorsRes] = await Promise.all([
      supabase
        .from('cto_agent_logs')
        .select('id, function_analyzed, decision, created_at')
        .neq('decision', 'no_change')
        .gte('created_at', thirtyDaysAgo)
        .limit(50),
      supabase
        .from('analytics_events')
        .select('id, event_type, event_data, created_at')
        .in('event_type', ['edge_function_error', 'silent_error', 'injection_error'])
        .gte('created_at', thirtyDaysAgo)
        .limit(200),
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
