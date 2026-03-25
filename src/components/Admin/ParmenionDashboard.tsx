import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Play, Pause, Trash2, Plus, RefreshCw, Shield, AlertTriangle, CheckCircle2, Clock, Brain, Target, Swords, Coins, Globe, FileText, Pencil, PlusCircle, Trash, Eye, Timer } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'En attente', color: 'bg-muted text-muted-foreground', icon: Clock },
  planned: { label: 'Planifié', color: 'bg-muted text-muted-foreground', icon: Clock },
  thinking: { label: 'Réflexion…', color: 'bg-amber-500/15 text-amber-600 border-amber-500/30', icon: Brain },
  executing: { label: 'Exécution', color: 'bg-blue-500/15 text-blue-600 border-blue-500/30', icon: Swords },
  completed: { label: 'Terminé', color: 'bg-green-500/15 text-green-600 border-green-500/30', icon: CheckCircle2 },
  partial: { label: 'Partiel', color: 'bg-orange-500/15 text-orange-600 border-orange-500/30', icon: AlertTriangle },
  dry_run: { label: 'Dry Run', color: 'bg-purple-500/15 text-purple-600 border-purple-500/30', icon: Eye },
  paused: { label: 'Pausé', color: 'bg-orange-500/15 text-orange-600 border-orange-500/30', icon: Pause },
  failed: { label: 'Échoué', color: 'bg-destructive/15 text-destructive border-destructive/30', icon: AlertTriangle },
  cancelled: { label: 'Annulé', color: 'bg-muted text-muted-foreground', icon: Pause },
};

const riskBadge = (risk: number) => {
  if (risk <= 1) return <Badge variant="outline" className="text-green-600 border-green-500/40">Risque {risk}</Badge>;
  if (risk === 2) return <Badge variant="outline" className="text-yellow-600 border-yellow-500/40">Risque {risk}</Badge>;
  if (risk === 3) return <Badge variant="outline" className="text-orange-600 border-orange-500/40">Risque {risk}</Badge>;
  return <Badge variant="destructive">Risque {risk} ⚠️</Badge>;
};

export function ParmenionDashboard() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<DecisionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [errorRate, setErrorRate] = useState<{ total: number; errors: number; error_rate: number; conservative_mode: boolean } | null>(null);
  const [autopilotConfig, setAutopilotConfig] = useState<{ is_active: boolean; status: string; last_cycle_at: string | null; domain: string; total_cycles_run: number; tracked_site_id: string; cooldown_hours: number; config_id: string } | null>(null);
  const [ikHistory, setIkHistory] = useState<Array<{ id: string; created_at: string; event_data: Record<string, unknown> }>>([]);
  const [cooldownInput, setCooldownInput] = useState<string>('1');
  const [ikLoading, setIkLoading] = useState(false);
  const [modCounts, setModCounts] = useState<Record<number, number>>({});

  const fetchLogs = useCallback(async () => {
    const { data, error } = await supabase
      .from('parmenion_decision_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && data) setLogs(data as unknown as DecisionLog[]);
    setLoading(false);
  }, []);

  const fetchErrorRate = useCallback(async () => {
    if (logs.length === 0) return;
    const domain = logs[0]?.domain;
    if (!domain) return;
    const { data } = await supabase.rpc('parmenion_error_rate', { p_domain: domain });
    if (data) setErrorRate(data as unknown as { total: number; errors: number; error_rate: number; conservative_mode: boolean });
  }, [logs]);

  const fetchAutopilotConfig = useCallback(async () => {
    const { data } = await supabase
      .from('autopilot_configs')
      .select('id, tracked_site_id, is_active, status, last_cycle_at, total_cycles_run, cooldown_hours, tracked_sites!inner(domain)')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      const ts = data.tracked_sites as unknown as { domain: string };
      const cd = data.cooldown_hours ?? 2;
      setAutopilotConfig({
        is_active: data.is_active ?? false,
        status: data.status ?? 'idle',
        last_cycle_at: data.last_cycle_at,
        domain: ts?.domain || '—',
        total_cycles_run: data.total_cycles_run ?? 0,
        tracked_site_id: data.tracked_site_id,
        cooldown_hours: cd,
        config_id: data.id,
      });
      setCooldownInput(String(cd));
    }
  }, []);

  const fetchIkHistory = useCallback(async () => {
    setIkLoading(true);
    const { data } = await supabase
      .from('analytics_events')
      .select('id, created_at, event_data')
      .eq('event_type', 'cms_action:iktracker')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setIkHistory(data as any);
    setIkLoading(false);
  }, []);

  const fetchModCounts = useCallback(async () => {
    const { data } = await supabase
      .from('autopilot_modification_log')
      .select('cycle_number, status')
      .eq('status', 'applied');
    if (data) {
      const counts: Record<number, number> = {};
      for (const row of data) {
        const cn = row.cycle_number ?? 0;
        counts[cn] = (counts[cn] || 0) + 1;
      }
      setModCounts(counts);
    }
  }, []);

  useEffect(() => { fetchLogs(); fetchAutopilotConfig(); fetchIkHistory(); fetchModCounts(); }, [fetchLogs, fetchAutopilotConfig, fetchIkHistory, fetchModCounts]);
  useEffect(() => { fetchErrorRate(); }, [logs, fetchErrorRate]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('parmenion-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parmenion_decision_log' }, () => {
        fetchLogs();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchLogs]);

  const handlePauseResume = async () => {
    const newState = !isPaused;
    setIsPaused(newState);
    toast({
      title: newState ? '⏸ Parménion en pause' : '▶️ Parménion reprend',
      description: newState ? 'La réflexion est suspendue.' : 'La réflexion reprend au prochain cycle.',
    });
  };

  const handlePurge = async () => {
    if (!confirm('Purger tout le registre Parménion ? Cette action est irréversible.')) return;
    // We can't delete via client with RLS, so we mark all as cancelled
    const { error } = await supabase
      .from('parmenion_decision_log')
      .update({ status: 'cancelled' } as any)
      .neq('status', 'cancelled');
    if (!error) {
      toast({ title: '🗑 Registre purgé', description: 'Toutes les entrées ont été marquées comme annulées.' });
      fetchLogs();
    }
  };

  const handleNewAction = async () => {
    if (!autopilotConfig?.tracked_site_id || !autopilotConfig?.domain) {
      toast({ title: 'Erreur', description: 'Aucun site autopilote actif trouvé.', variant: 'destructive' });
      return;
    }
    toast({ title: '🆕 Nouvelle action demandée', description: 'Le prochain cycle de Parménion démarrera avec un nouveau but.' });
    const { error } = await supabase.functions.invoke('parmenion-orchestrator', {
      body: {
        force_new: true,
        tracked_site_id: autopilotConfig.tracked_site_id,
        domain: autopilotConfig.domain,
        cycle_number: (autopilotConfig.total_cycles_run || 0) + 1,
      },
    });
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      fetchLogs();
    }
  };

  const activeDecision = logs.find(l => ['thinking', 'executing', 'pending'].includes(l.status));

  // LLM cost calculation based on estimated_tokens
  const llmCostStats = useMemo(() => {
    const totalTokens = logs.reduce((sum, l) => sum + (l.estimated_tokens || 0), 0);
    // Gemini 2.5 Flash pricing: ~$0.15/1M input + ~$0.60/1M output ≈ ~$0.35/1M avg
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
            Parménion — Stratège Autopilote
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Registre décisionnel en temps réel
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={isPaused ? 'default' : 'outline'}
            size="sm"
            onClick={handlePauseResume}
            className="gap-2"
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {isPaused ? 'Reprendre' : 'Pause'}
          </Button>
          <Button variant="outline" size="sm" onClick={handlePurge} className="gap-2 text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
            Purge
          </Button>
          <Button variant="default" size="sm" onClick={handleNewAction} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouvelle action
          </Button>
          <Button variant="ghost" size="icon" onClick={fetchLogs}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">État</CardTitle>
          </CardHeader>
          <CardContent>
            {isPaused ? (
              <Badge className="bg-orange-500/15 text-orange-600 border-orange-500/30">⏸ En pause</Badge>
            ) : activeDecision ? (
              <Badge className={statusConfig[activeDecision.status]?.color || ''}>
                {statusConfig[activeDecision.status]?.label || activeDecision.status}
              </Badge>
            ) : autopilotConfig?.is_active ? (
              <div>
                <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">✅ Actif — en veille</Badge>
                <p className="text-[11px] text-muted-foreground mt-1">{autopilotConfig.domain}</p>
              </div>
            ) : (
              <Badge variant="secondary">💤 Inactif</Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cycles total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{autopilotConfig?.total_cycles_run ?? logs.length}</div>
            {autopilotConfig?.last_cycle_at && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Dernier : {new Date(autopilotConfig.last_cycle_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Taux d'erreur</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", (errorRate?.error_rate ?? 0) > 20 ? 'text-destructive' : 'text-green-600')}>
              {errorRate ? `${errorRate.error_rate}%` : '—'}
            </div>
            <p className="text-xs text-muted-foreground">sur {errorRate?.total ?? 0} cycles mesurés</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Mode</CardTitle>
          </CardHeader>
          <CardContent>
            {errorRate?.conservative_mode ? (
              <Badge variant="destructive" className="gap-1">
                <Shield className="h-3 w-3" /> Conservateur
              </Badge>
            ) : (
              <Badge variant="outline" className="text-green-600 border-green-500/40 gap-1">
                <Target className="h-3 w-3" /> Normal
              </Badge>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Risque max : {errorRate?.conservative_mode ? '2' : '3'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5 text-amber-500" />
              Coût LLM
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {llmCostStats.costEur < 0.01 ? '<0,01' : llmCostStats.costEur.toFixed(2)} €
            </div>
            <p className="text-xs text-muted-foreground">
              {llmCostStats.totalTokens.toLocaleString('fr-FR')} tokens consommés
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5 text-primary" />
              Cooldown
            </CardTitle>
          </CardHeader>
          <CardContent>
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
            <p className="text-[11px] text-muted-foreground mt-1">Actuel : {autopilotConfig?.cooldown_hours ?? '—'}h</p>
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
          <CardDescription>Historique des décisions et raisonnements de Parménion</CardDescription>
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
              <p className="text-xs mt-1">Parménion n'a pas encore été invoqué</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-3">
                {logs.map((log, i) => {
                  const config = statusConfig[log.status] || statusConfig.pending;
                  const StatusIcon = config.icon;
                  return (
                    <div key={log.id} className={cn(
                      "rounded-lg border p-4 transition-colors",
                      log.status === 'thinking' && 'border-amber-500/40 bg-amber-500/5 animate-pulse',
                      log.status === 'executing' && 'border-blue-500/40 bg-blue-500/5',
                      log.is_error && 'border-destructive/40 bg-destructive/5',
                    )}>
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-muted-foreground">#{log.cycle_number}</span>
                          {log.pipeline_phase && (
                            <Badge variant="outline" className={cn(
                              'text-[10px] uppercase font-bold',
                              log.pipeline_phase === 'diagnose' && 'text-blue-500 border-blue-500/40',
                              log.pipeline_phase === 'prescribe' && 'text-amber-500 border-amber-500/40',
                              log.pipeline_phase === 'execute' && 'text-green-500 border-green-500/40',
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

                      {/* Goal */}
                      <div className="mb-2">
                        <p className="text-sm font-medium">{log.goal_description}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.domain} · {log.goal_type} · {log.action_type}
                          {log.goal_cluster_id && ` · Cluster: ${log.goal_cluster_id.slice(0, 8)}…`}
                        </p>
                      </div>

                      {/* Details grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
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
                      </div>

                      {/* Functions called */}
                      {log.functions_called?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {log.functions_called.map(fn => (
                            <Badge key={fn} variant="secondary" className="text-[10px]">{fn}</Badge>
                          ))}
                        </div>
                      )}

                      {/* Impact feedback */}
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

                      {/* Error */}
                      {log.execution_error && (
                        <div className="mt-2 p-2 rounded bg-destructive/10 text-xs text-destructive">
                          ⚠️ {log.execution_error}
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

      {/* IKTracker History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                Historique IKTracker
              </CardTitle>
              <CardDescription>Actions CMS effectuées sur iktracker.fr</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={fetchIkHistory}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {ikLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              Chargement…
            </div>
          ) : ikHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucune action IKTracker enregistrée</p>
            </div>
          ) : (
            <ScrollArea className="h-[350px] pr-4">
              <div className="space-y-2">
                {ikHistory.map((ev) => {
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
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
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
