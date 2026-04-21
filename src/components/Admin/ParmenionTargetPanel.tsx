import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, Pause, Trash2, Plus, RefreshCw, Shield, AlertTriangle, CheckCircle2, Clock, Brain, Target, Swords, Coins, Globe, FileText, Pencil, PlusCircle, Trash, Eye, Timer, Download, Send } from 'lucide-react';
import { generateParmenionReport } from '@/utils/parmenionPdfReport';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface DecisionLog {
  id: string;
  cycle_number: number;
  domain: string;
  goal_type: string;
  goal_description: string;
  goal_cluster_id: string | null;
  action_type: string;
  pipeline_phase: string | null;
  status: string;
  impact_level: string;
  impact_predicted: string | null;
  impact_actual: string | null;
  risk_predicted: number;
  risk_calibrated: number | null;
  risk_iterations: number;
  scope_reductions: number;
  estimated_tokens: number | null;
  functions_called: string[];
  is_error: boolean;
  goal_changed: boolean;
  error_category: string | null;
  calibration_note: string | null;
  execution_error: string | null;
  execution_results: any | null;
  created_at: string;
  updated_at: string;
}

interface HistoryEvent {
  id: string;
  created_at: string;
  event_data: Record<string, unknown>;
}

interface AutopilotConfig {
  is_active: boolean;
  status: string;
  last_cycle_at: string | null;
  domain: string;
  total_cycles_run: number;
  tracked_site_id: string;
  cooldown_hours: number;
  config_id: string;
  force_iktracker_article: boolean;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'En attente', color: 'bg-muted text-muted-foreground', icon: Clock },
  planned: { label: 'Planifié', color: 'bg-muted text-muted-foreground', icon: Clock },
  thinking: { label: 'Réflexion…', color: 'bg-amber-500/15 text-amber-600 border-amber-500/30', icon: Brain },
  executing: { label: 'Exécution', color: 'bg-blue-500/15 text-blue-600 border-blue-500/30', icon: Swords },
  completed: { label: 'Terminé', color: 'bg-green-500/15 text-green-600 border-green-500/30', icon: CheckCircle2 },
  partial: { label: 'Partiel', color: 'bg-orange-500/15 text-orange-600 border-orange-500/30', icon: AlertTriangle },
  failed: { label: 'Échoué', color: 'bg-destructive/15 text-destructive border-destructive/30', icon: AlertTriangle },
  cancelled: { label: 'Annulé', color: 'bg-muted text-muted-foreground', icon: Clock },
};

function riskBadge(risk: number) {
  if (risk <= 1) return <Badge variant="outline" className="text-green-600 border-green-500/40 text-[10px]">Risque {risk}</Badge>;
  if (risk === 2) return <Badge variant="outline" className="text-amber-500 border-amber-500/40 text-[10px]">Risque {risk}</Badge>;
  return <Badge variant="outline" className="text-destructive border-destructive/40 text-[10px]">Risque {risk}</Badge>;
}

export interface ParmenionTargetPanelProps {
  targetLabel: string;
  targetDomain: string;
  eventType: string; // e.g. 'cms_action:iktracker' or 'cms_action:crawlers'
  historyTitle: string;
  historyDescription: string;
  showForceArticle?: boolean;
}

export function ParmenionTargetPanel({
  targetLabel,
  targetDomain,
  eventType,
  historyTitle,
  historyDescription,
  showForceArticle = false,
}: ParmenionTargetPanelProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [logs, setLogs] = useState<DecisionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [errorRate, setErrorRate] = useState<{ total: number; errors: number; error_rate: number; conservative_mode: boolean } | null>(null);
  const [autopilotConfig, setAutopilotConfig] = useState<AutopilotConfig | null>(null);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [cooldownInput, setCooldownInput] = useState<string>('1');
  const [histLoading, setHistLoading] = useState(false);
  const [modCounts, setModCounts] = useState<Record<number, number>>({});
  const [escalatingIds, setEscalatingIds] = useState<Set<string>>(new Set());

  const escalateToCto = useCallback(async (log: DecisionLog) => {
    setEscalatingIds(prev => new Set(prev).add(log.id));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const directiveText = [
        `[AUTO-ESCALADE Parménion #${log.cycle_number}]`,
        `Phase: ${log.pipeline_phase || 'inconnue'}`,
        `Domaine: ${log.domain}`,
        `Objectif: ${log.goal_description}`,
        `Fonctions: ${log.functions_called?.join(', ') || 'aucune'}`,
        `Erreur: ${log.execution_error}`,
        log.error_category ? `Catégorie: ${log.error_category}` : '',
        '',
        'Action requise: Investiguer la cause racine de cette erreur et proposer un correctif.',
      ].filter(Boolean).join('\n');

      const { error } = await supabase.from('agent_cto_directives').insert({
        user_id: user.id,
        directive_text: directiveText,
        target_function: log.functions_called?.[0] || 'parmenion-orchestrator',
        target_url: `https://${log.domain}`,
        status: 'pending',
      });

      if (error) throw error;
      toast({ title: 'Directive CTO créée', description: `Investigation #${log.cycle_number} ajoutée à la queue CTO` });
    } catch (err: any) {
      console.error('Escalation error:', err);
      toast({ title: 'Erreur', description: 'Impossible de créer la directive CTO', variant: 'destructive' });
    } finally {
      setEscalatingIds(prev => { const n = new Set(prev); n.delete(log.id); return n; });
    }
  }, [toast]);

  const fetchLogs = useCallback(async () => {
    const { data, error } = await supabase
      .from('parmenion_decision_log')
      .select('*')
      .eq('domain', targetDomain)
      .order('created_at', { ascending: false })
      .limit(200);
    if (!error && data) setLogs(data as unknown as DecisionLog[]);
    setLoading(false);
  }, [targetDomain]);

  const fetchErrorRate = useCallback(async () => {
    if (!targetDomain) return;
    const { data } = await supabase.rpc('parmenion_error_rate', { p_domain: targetDomain });
    if (data) setErrorRate(data as unknown as { total: number; errors: number; error_rate: number; conservative_mode: boolean });
  }, [targetDomain]);

  const fetchAutopilotConfig = useCallback(async () => {
    const { data } = await supabase
      .from('autopilot_configs')
      .select('id, tracked_site_id, is_active, status, last_cycle_at, total_cycles_run, cooldown_hours, force_iktracker_article, tracked_sites!inner(domain)')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(10);
    if (data && data.length > 0) {
      // Find config matching our target domain
      const match = data.find((d: any) => {
        const ts = d.tracked_sites as unknown as { domain: string };
        return ts?.domain === targetDomain || ts?.domain?.includes(targetDomain.replace('www.', ''));
      }) || data[0];
      
      const ts = (match as any).tracked_sites as unknown as { domain: string };
      const cd = (match as any).cooldown_hours ?? 2;
      setAutopilotConfig({
        is_active: (match as any).is_active ?? false,
        status: (match as any).status ?? 'idle',
        last_cycle_at: (match as any).last_cycle_at,
        domain: ts?.domain || targetDomain,
        total_cycles_run: (match as any).total_cycles_run ?? 0,
        tracked_site_id: (match as any).tracked_site_id,
        cooldown_hours: cd,
        config_id: (match as any).id,
        force_iktracker_article: (match as any).force_iktracker_article ?? false,
      });
      setCooldownInput(String(cd));
    }
  }, [targetDomain]);

  const fetchHistory = useCallback(async () => {
    setHistLoading(true);
    const { data } = await supabase
      .from('analytics_events')
      .select('id, created_at, event_data')
      .eq('event_type', eventType)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setHistory(data as any);
    setHistLoading(false);
  }, [eventType]);

  const fetchModCounts = useCallback(async () => {
    const { data } = await supabase
      .from('analytics_events')
      .select('event_data')
      .in('event_type', [`autopilot:iktracker_push`, eventType]);
    if (data) {
      const counts: Record<number, number> = {};
      for (const row of data) {
        const ed = row.event_data as any;
        const cn = ed?.cycle_number ?? ed?.details?.cycle_number ?? 0;
        const action = ed?.action;
        if (action && !['push-event'].includes(action) && !ed?.cycle_number) continue;
        counts[cn] = (counts[cn] || 0) + 1;
      }
      setModCounts(counts);
    }
  }, [eventType]);

  useEffect(() => { fetchLogs(); fetchAutopilotConfig(); fetchHistory(); fetchModCounts(); }, [fetchLogs, fetchAutopilotConfig, fetchHistory, fetchModCounts]);
  useEffect(() => { fetchErrorRate(); }, [logs, fetchErrorRate]);

  useEffect(() => {
    const channel = supabase
      .channel(`parmenion-live-${targetDomain}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parmenion_decision_log' }, () => {
        fetchLogs();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchLogs, targetDomain]);

  const handlePauseResume = async () => {
    const newState = !isPaused;
    setIsPaused(newState);
    toast({
      title: newState ? '⏸ Parménion en pause' : '▶️ Parménion reprend',
      description: newState ? `Réflexion suspendue pour ${targetLabel}.` : `Réflexion reprend pour ${targetLabel}.`,
    });
  };

  const handlePurge = async () => {
    if (!confirm(`Purger le registre Parménion pour ${targetLabel} ? Cette action est irréversible.`)) return;
    const { error } = await supabase
      .from('parmenion_decision_log')
      .update({ status: 'cancelled' } as any)
      .eq('domain', targetDomain)
      .neq('status', 'cancelled');
    if (!error) {
      toast({ title: '🗑 Registre purgé', description: `Entrées ${targetLabel} marquées comme annulées.` });
      fetchLogs();
    }
  };

  const handleNewAction = async () => {
    if (!autopilotConfig?.tracked_site_id || !autopilotConfig?.domain) {
      toast({ title: 'Erreur', description: `Aucun site autopilote actif trouvé pour ${targetLabel}.`, variant: 'destructive' });
      return;
    }
    toast({ title: '🆕 Nouvelle action demandée', description: `Cycle Parménion lancé pour ${targetLabel}.` });
    
    const body = {
      force_new: true,
      tracked_site_id: autopilotConfig.tracked_site_id,
      domain: autopilotConfig.domain,
      cycle_number: (autopilotConfig.total_cycles_run || 0) + 1,
    };

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase.functions.invoke('parmenion-orchestrator', { body });
      if (!error) {
        // Check structured error response (always 200)
        if (data?.ok === false) {
          toast({ title: 'Parménion — Erreur', description: data.message || 'Erreur inconnue', variant: 'destructive' });
          return;
        }
        fetchLogs();
        return;
      }
      lastError = error;
      if (attempt < 2) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    }
    toast({ title: 'Erreur', description: lastError?.message || 'Échec après 3 tentatives', variant: 'destructive' });
  };

  const activeDecision = logs.find(l => ['thinking', 'executing', 'pending'].includes(l.status));

  const llmCostStats = useMemo(() => {
    const totalTokens = logs.reduce((sum, l) => sum + (l.estimated_tokens || 0), 0);
    const costUsd = totalTokens * 0.00000035;
    const costEur = costUsd * 0.92;
    return { totalTokens, costEur };
  }, [logs]);

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Parménion — {targetLabel}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Registre décisionnel · {targetDomain}
          </p>
        </div>

        <div className={cn("flex items-center gap-2", isMobile && "flex-wrap")}>
          <Button
            variant={isPaused ? 'default' : 'outline'}
            size={isMobile ? 'icon' : 'sm'}
            onClick={handlePauseResume}
            className={cn(isMobile ? "h-8 w-8" : "gap-1.5")}
            title={isPaused ? 'Reprendre' : 'Pause'}
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {!isMobile && (isPaused ? 'Reprendre' : 'Pause')}
          </Button>
          <Button
            variant="outline"
            size={isMobile ? 'icon' : 'sm'}
            onClick={handlePurge}
            className={cn(isMobile ? "h-8 w-8 text-destructive hover:text-destructive" : "gap-1.5 text-destructive hover:text-destructive")}
            title="Purge"
          >
            <Trash2 className="h-4 w-4" />
            {!isMobile && 'Purge'}
          </Button>
          <Button variant="default" size="sm" onClick={handleNewAction} className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" />
            {isMobile ? 'Nouvelle' : 'Nouvelle action'}
          </Button>
          {showForceArticle && (
            <Button
              variant={autopilotConfig?.force_iktracker_article ? 'default' : 'outline'}
              size="sm"
              className={cn("gap-1.5 shrink-0", autopilotConfig?.force_iktracker_article && "bg-amber-500 hover:bg-amber-600 text-black")}
              disabled={!autopilotConfig?.config_id}
              onClick={async () => {
                const newVal = !autopilotConfig?.force_iktracker_article;
                const { error } = await supabase
                  .from('autopilot_configs')
                  .update({ force_iktracker_article: newVal } as any)
                  .eq('id', autopilotConfig!.config_id);
                if (!error) {
                  setAutopilotConfig(prev => prev ? { ...prev, force_iktracker_article: newVal } : prev);
                  toast({
                    title: newVal ? '📝 Article forcé' : '📝 Article désactivé',
                    description: newVal ? `Parménion créera un article à chaque cycle pour ${targetLabel}.` : 'Le mode article forcé est désactivé.',
                  });
                }
              }}
            >
              <Pencil className="h-4 w-4" />
              {isMobile ? 'Art' : (autopilotConfig?.force_iktracker_article ? '📝 Art:ON' : 'Article')}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={fetchLogs} className="shrink-0 h-8 w-8">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Status cards */}
      <div className={cn("grid gap-3", isMobile ? "grid-cols-2" : "grid-cols-2 md:grid-cols-6")}>
        <Card className="py-2">
          <CardHeader className="pb-1 pt-2 px-3">
            <CardTitle className="text-xs font-medium">État</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-2">
            {isPaused ? (
              <span className="text-sm font-semibold text-orange-600">⏸ En pause</span>
            ) : activeDecision ? (
              <span className={cn("text-sm font-semibold", 'text-blue-600')}>
                {statusConfig[activeDecision.status]?.label || activeDecision.status}
              </span>
            ) : autopilotConfig?.is_active ? (
              <div>
                <span className="text-sm font-semibold text-emerald-600">Actif — en veille</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">{autopilotConfig.domain}</p>
              </div>
            ) : (
              <span className="text-sm font-semibold text-muted-foreground">💤 Inactif</span>
            )}
          </CardContent>
        </Card>

        <Card className="py-2">
          <CardHeader className="pb-1 pt-2 px-3">
            <CardTitle className="text-xs font-medium">Cycles total</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-2">
            <div className="text-lg font-bold">{autopilotConfig?.total_cycles_run ?? logs.length}</div>
            {autopilotConfig?.last_cycle_at && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Dernier : {new Date(autopilotConfig.last_cycle_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="py-2">
          <CardHeader className="pb-1 pt-2 px-3">
            <CardTitle className="text-xs font-medium">Taux d'erreur</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-2">
            <div className={cn("text-lg font-bold", (errorRate?.error_rate ?? 0) > 20 ? 'text-destructive' : 'text-green-600')}>
              {errorRate ? `${errorRate.error_rate}%` : '—'}
            </div>
            <p className="text-[10px] text-muted-foreground">sur {errorRate?.total ?? 0} cycles</p>
          </CardContent>
        </Card>

        <Card className="py-2">
          <CardHeader className="pb-1 pt-2 px-3">
            <CardTitle className="text-xs font-medium">Mode</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-2">
            {errorRate?.conservative_mode ? (
              <Badge variant="destructive" className="gap-1">
                <Shield className="h-3 w-3" /> Conservateur
              </Badge>
            ) : (
              <Badge variant="outline" className="text-green-600 border-green-500/40 gap-1">
                <Target className="h-3 w-3" /> Normal
              </Badge>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Risque max : {errorRate?.conservative_mode ? '2' : '3'}
            </p>
          </CardContent>
        </Card>

        <Card className="py-2">
          <CardHeader className="pb-1 pt-2 px-3">
            <CardTitle className="text-xs font-medium flex items-center gap-1">
              <Coins className="h-3 w-3 text-amber-500" />
              Coût LLM
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-2">
            <div className="text-lg font-bold text-amber-600">
              {llmCostStats.costEur < 0.01 ? '<0,01' : llmCostStats.costEur.toFixed(2)} €
            </div>
            <p className="text-[10px] text-muted-foreground">
              {llmCostStats.totalTokens.toLocaleString('fr-FR')} tokens
            </p>
          </CardContent>
        </Card>

        <Card className="py-2">
          <CardHeader className="pb-1 pt-2 px-3">
            <CardTitle className="text-xs font-medium flex items-center gap-1">
              <Timer className="h-3 w-3 text-primary" />
              Cooldown
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-2">
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={1}
                max={168}
                value={cooldownInput}
                onChange={(e) => setCooldownInput(e.target.value)}
                className="w-16 h-8 text-center text-sm"
              />
              <span className="text-xs text-muted-foreground">heures</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={!autopilotConfig?.config_id || Number(cooldownInput) === autopilotConfig?.cooldown_hours}
                onClick={async () => {
                  const val = Math.max(1, Math.min(168, Number(cooldownInput)));
                  const { error } = await supabase
                    .from('autopilot_configs')
                    .update({ cooldown_hours: val } as any)
                    .eq('id', autopilotConfig!.config_id);
                  if (!error) {
                    toast({ title: '✅ Cooldown mis à jour', description: `${val}h entre chaque cycle` });
                    fetchAutopilotConfig();
                  }
                }}
              >
                OK
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Actuel : {autopilotConfig?.cooldown_hours ?? '—'}h</p>
          </CardContent>
        </Card>
      </div>

      {/* Live decision log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            Registre de réflexion
          </CardTitle>
          <CardDescription>Historique des décisions et raisonnements de Parménion pour {targetLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              Chargement…
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Brain className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Aucune décision enregistrée</p>
              <p className="text-xs mt-1">Parménion n'a pas encore été invoqué pour {targetLabel}</p>
            </div>
          ) : (
            <ScrollArea className={cn(isMobile ? "h-[400px]" : "h-[500px]", "pr-4")}>
              <div className="space-y-3">
                {logs.map((log) => {
                  const config = statusConfig[log.status] || statusConfig.pending;
                  const StatusIcon = config.icon;
                  return (
                    <div key={log.id} className={cn(
                      "rounded-lg border transition-colors",
                      isMobile ? "p-3" : "p-4",
                      log.status === 'thinking' && 'border-amber-500/40 bg-amber-500/5 animate-pulse',
                      log.status === 'executing' && 'border-blue-500/40 bg-blue-500/5',
                      log.is_error && 'border-destructive/40 bg-destructive/5',
                    )}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-muted-foreground">#{log.cycle_number}</span>
                          {log.pipeline_phase && (
                            <Badge variant="outline" className={cn(
                              'text-[10px] uppercase font-bold',
                              log.pipeline_phase === 'audit' && 'text-purple-500 border-purple-500/40',
                              log.pipeline_phase === 'diagnose' && 'text-blue-500 border-blue-500/40',
                              log.pipeline_phase === 'prescribe' && 'text-amber-500 border-amber-500/40',
                              log.pipeline_phase === 'execute' && 'text-green-500 border-green-500/40',
                              log.pipeline_phase === 'validate' && 'text-emerald-500 border-emerald-500/40',
                            )}>
                              {log.pipeline_phase}
                            </Badge>
                          )}
                          <Badge className={config.color} variant="outline">
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {config.label}
                          </Badge>
                          {riskBadge(log.risk_calibrated ?? log.risk_predicted)}
                          {log.goal_changed && (
                            <Badge variant="outline" className="text-purple-600 border-purple-500/40">But changé</Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="mb-2">
                        <p className="text-sm font-medium">{log.goal_description}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.domain} · {log.goal_type} · {log.action_type}
                          {log.goal_cluster_id && ` · Cluster: ${log.goal_cluster_id.slice(0, 8)}…`}
                        </p>
                      </div>

                      <div className={cn("grid gap-2 text-xs", isMobile ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-5")}>
                        <div>
                          <span className="text-muted-foreground">Impact</span>
                          <p className="font-medium">{log.impact_level}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Réductions scope</span>
                          <p className="font-medium">{log.scope_reductions}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Itérations risque</span>
                          <p className="font-medium">{log.risk_iterations}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Tokens estimés</span>
                          <p className="font-medium">{log.estimated_tokens?.toLocaleString() ?? '—'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Actions déployées</span>
                          <p className="font-medium flex items-center gap-1">
                            <Globe className="h-3 w-3 text-primary" />
                            {modCounts[log.cycle_number] ?? 0}
                          </p>
                        </div>
                      </div>

                      {log.functions_called?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {log.functions_called.map(fn => (
                            <Badge key={fn} variant="secondary" className="text-[10px]">{fn}</Badge>
                          ))}
                        </div>
                      )}

                      {log.impact_actual && (
                        <div className="mt-2 p-2 rounded bg-muted/50 text-xs">
                          <span className="text-muted-foreground">Retour T+30 :</span>{' '}
                          <span className={log.is_error ? 'text-destructive font-medium' : 'text-green-600 font-medium'}>
                            Prédit: {log.impact_predicted} → Réel: {log.impact_actual}
                          </span>
                          {log.calibration_note && (
                            <p className="text-muted-foreground mt-1 italic">💡 {log.calibration_note}</p>
                          )}
                        </div>
                      )}

                      {log.execution_error && (
                        <div className="mt-2 p-2 rounded bg-destructive/10 text-xs text-destructive flex items-start justify-between gap-2">
                          <span>⚠️ {log.execution_error}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0 h-6 px-2 text-[10px] gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                            disabled={escalatingIds.has(log.id)}
                            onClick={() => escalateToCto(log)}
                          >
                            <Send className="h-3 w-3" />
                            {escalatingIds.has(log.id) ? '...' : 'CTO'}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* CMS History */}
      <Card>
        <CardHeader>
          <div className={cn("flex items-center justify-between", isMobile && "flex-col items-start gap-2")}>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                {historyTitle}
              </CardTitle>
              <CardDescription>{historyDescription}</CardDescription>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => {
                const last24h = history.filter(ev => new Date(ev.created_at) >= new Date(Date.now() - 24 * 60 * 60 * 1000));
                generateParmenionReport(last24h as any, targetDomain);
                toast({ title: '📄 Rapport PDF téléchargé', description: `${last24h.length} action(s) sur les dernières 24h` });
              }}>
                <Download className="h-3.5 w-3.5" />
                Rapport 24h
              </Button>
              <Button variant="ghost" size="icon" onClick={fetchHistory}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {histLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              Chargement…
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucune action {targetLabel} enregistrée</p>
            </div>
          ) : (
            <ScrollArea className={cn(isMobile ? "h-[280px]" : "h-[350px]", "pr-4")}>
              <div className="space-y-2">
                {history.map((ev) => {
                  const d = ev.event_data || {};
                  const action = (d.action as string) || '—';
                  const slug = (d.slug as string) || (d.page_key as string) || '';
                  const title = (d.title as string) || '';
                  const updatesKeys = (d.updates_keys as string[]) || [];
                  const responseStatus = d.response_status as number | undefined;

                  const actionIcon = action.startsWith('create') ? PlusCircle
                    : action.startsWith('update') ? Pencil
                    : action.startsWith('delete') ? Trash
                    : action.startsWith('list') ? Eye
                    : FileText;
                  const ActionIcon = actionIcon;

                  const actionColor = action.startsWith('create') ? 'text-green-600'
                    : action.startsWith('update') ? 'text-amber-600'
                    : action.startsWith('delete') ? 'text-destructive'
                    : 'text-muted-foreground';

                  return (
                    <div key={ev.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                      <ActionIcon className={cn('h-4 w-4 mt-0.5 shrink-0', actionColor)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium font-mono text-xs">{action}</span>
                          {slug && (
                            <Badge variant="secondary" className="text-[10px] font-mono truncate max-w-[200px]">
                              {slug}
                            </Badge>
                          )}
                          {title && (
                            <span className="text-xs text-muted-foreground truncate">« {title} »</span>
                          )}
                          {responseStatus && (
                            <Badge variant="outline" className={cn('text-[10px]', responseStatus < 300 ? 'text-green-600 border-green-500/40' : 'text-destructive border-destructive/40')}>
                              {responseStatus}
                            </Badge>
                          )}
                        </div>
                        {updatesKeys.length > 0 && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Champs modifiés : {updatesKeys.join(', ')}
                          </p>
                        )}
                      </div>
                      <span className={cn("text-[11px] text-muted-foreground whitespace-nowrap shrink-0", isMobile && "hidden")}>
                        {new Date(ev.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
