import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RotateCcw, Zap, ShieldOff, Activity, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RoutingRow {
  feature: string;
  label: string;
  enabled: boolean;
  provider: 'groq' | 'lovable';
  model: string;
  original_model: string;
  description: string | null;
  updated_at: string;
}

type UsageRow = { model: string; estimated_cost_usd: number | null; created_at: string };
type IntentRow = { bucket: string; count: number };

export function AIRoutingControl() {
  const [rows, setRows] = useState<RoutingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [killSwitch, setKillSwitch] = useState<boolean>(false);
  const [killSwitchSaving, setKillSwitchSaving] = useState(false);
  const [usage7d, setUsage7d] = useState<UsageRow[]>([]);
  const [intents14d, setIntents14d] = useState<IntentRow[]>([]);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const since14dIso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const [rRouting, rFlag, rUsage, rIntents] = await Promise.all([
      supabase.from('ai_routing_overrides').select('*').order('feature'),
      supabase.from('ai_routing_global_flags').select('enabled').eq('key', 'disable_premium').maybeSingle(),
      supabase.from('ai_gateway_usage')
        .select('model, estimated_cost_usd, created_at')
        .gte('created_at', sinceIso)
        .limit(5000),
      supabase.from('copilot_actions')
        .select('metadata')
        .eq('skill', '_assistant_reply')
        .gte('created_at', since14dIso)
        .not('metadata', 'is', null)
        .limit(5000),
    ]);
    if (rRouting.error) {
      toast({ title: 'Erreur', description: rRouting.error.message, variant: 'destructive' });
    } else {
      setRows((rRouting.data ?? []) as RoutingRow[]);
    }
    setKillSwitch(rFlag.data?.enabled === true);
    setUsage7d((rUsage.data ?? []) as UsageRow[]);
    // Agrège les buckets
    const bucketMap = new Map<string, number>();
    for (const row of (rIntents.data ?? []) as Array<{ metadata: { intent_bucket?: string } | null }>) {
      const b = row.metadata?.intent_bucket ?? 'unknown';
      bucketMap.set(b, (bucketMap.get(b) ?? 0) + 1);
    }
    setIntents14d([...bucketMap.entries()].map(([bucket, count]) => ({ bucket, count })).sort((a, b) => b.count - a.count));
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const totalUsd = useMemo(
    () => usage7d.reduce((s, r) => s + (Number(r.estimated_cost_usd) || 0), 0),
    [usage7d],
  );
  const todayUsd = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return usage7d
      .filter((r) => new Date(r.created_at) >= start)
      .reduce((s, r) => s + (Number(r.estimated_cost_usd) || 0), 0);
  }, [usage7d]);
  // Seuil : $25/jour ≈ rythme $750/mois (au-dessus du budget Combo ABC $615)
  const DAILY_BUDGET_USD = 25;
  const overBudget = todayUsd > DAILY_BUDGET_USD;
  const topModels = useMemo(() => {
    const m = new Map<string, { calls: number; cost: number }>();
    for (const r of usage7d) {
      const e = m.get(r.model) ?? { calls: 0, cost: 0 };
      e.calls += 1;
      e.cost += Number(r.estimated_cost_usd) || 0;
      m.set(r.model, e);
    }
    return [...m.entries()].sort((a, b) => b[1].cost - a[1].cost).slice(0, 5);
  }, [usage7d]);

  const toggleKillSwitch = async (next: boolean) => {
    setKillSwitchSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('ai_routing_global_flags')
      .update({ enabled: next, updated_at: new Date().toISOString(), updated_by: user?.id })
      .eq('key', 'disable_premium');
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      setKillSwitch(next);
      toast({
        title: next ? 'Kill switch ACTIVÉ' : 'Kill switch désactivé',
        description: next
          ? 'Les modèles premium sont sautés (Claude Sonnet, GPT-5.4+, Gemini Pro). Propagation < 60s.'
          : 'Allocation Combo ABC restaurée.',
      });
    }
    setKillSwitchSaving(false);
  };

  const updateRow = async (feature: string, patch: Partial<RoutingRow>) => {
    setSavingId(feature);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('ai_routing_overrides')
      .update({ ...patch, updated_at: new Date().toISOString(), updated_by: user?.id })
      .eq('feature', feature);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      setRows((prev) => prev.map((r) => (r.feature === feature ? { ...r, ...patch } : r)));
      toast({ title: patch.enabled === false ? 'Modèle d\'origine restauré' : 'Mise à jour' });
    }
    setSavingId(null);
  };

  const bulkSetEnabled = async (enabled: boolean) => {
    setBulkSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('ai_routing_overrides')
      .update({ enabled, updated_at: new Date().toISOString(), updated_by: user?.id })
      .neq('feature', '__never__');
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      setRows((prev) => prev.map((r) => ({ ...r, enabled })));
      toast({
        title: enabled ? 'Groq activé partout' : 'Modèles d\'origine restaurés',
        description: `${rows.length} feature(s) mises à jour.`,
      });
    }
    setBulkSaving(false);
  };

  const allEnabled = rows.length > 0 && rows.every((r) => r.enabled);
  const anyEnabled = rows.some((r) => r.enabled);

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 p-4">
      <header className="border-b border-border pb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Zap className="h-6 w-6" /> Routing AI — Override Groq
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Bascule certaines tâches de formatage / classification vers Groq (ultra-rapide, faible coût).
          Désactiver le toggle restaure instantanément le modèle d'origine.
          Cache 30 s côté edge — la propagation est quasi-immédiate.
        </p>
      </header>

      {/* Kill switch premium (Combo ABC) */}
      <div className={`rounded-lg p-4 flex items-start justify-between gap-4 border-2 ${killSwitch ? 'border-yellow-500 bg-yellow-500/5' : 'border-foreground/20 bg-muted/30'}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <ShieldOff className="h-4 w-4" />
            <h3 className="font-semibold">Kill switch — désactiver les modèles premium</h3>
            {killSwitch && (
              <Badge variant="outline" className="border-yellow-500 text-yellow-600 dark:text-yellow-400">
                ACTIF
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Bascule instantanément Claude Sonnet 4.5, GPT-5.4/5.5 et Gemini 3.1 Pro vers leurs fallbacks moins chers
            (Haiku, GPT-5.4-mini, Gemini 3.5 Flash). Propagation &lt; 60 s. À armer si pic de coûts ou incident.
          </p>
        </div>
        <Switch
          checked={killSwitch}
          disabled={killSwitchSaving}
          onCheckedChange={(v) => toggleKillSwitch(v)}
        />
      </div>

      {/* Dashboard usage 7j */}
      <div className="rounded-lg p-4 border border-border space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <h3 className="font-semibold">Crédits LLM — 7 derniers jours</h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`font-mono ${overBudget ? 'border-yellow-500 text-yellow-600 dark:text-yellow-400' : ''}`}>
              Aujourd'hui : ${todayUsd.toFixed(2)} / ${DAILY_BUDGET_USD}
            </Badge>
            <Badge variant="outline" className="font-mono">
              7j : ${totalUsd.toFixed(2)} · {usage7d.length} appels
            </Badge>
          </div>
        </div>
        {overBudget && (
          <div className="flex items-start gap-2 rounded-md border-2 border-yellow-500 bg-yellow-500/10 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Dépassement budget journalier</p>
              <p className="text-xs text-muted-foreground mt-1">
                Rythme actuel &gt; ${DAILY_BUDGET_USD}/jour (≈ ${(DAILY_BUDGET_USD * 30).toFixed(0)}/mois, au-dessus du budget Combo ABC $615).
                Active le kill switch ci-dessus pour basculer immédiatement sur les fallbacks moins chers.
              </p>
            </div>
          </div>
        )}
        {topModels.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucun appel logué sur 7j.</p>
        ) : (
          <div className="space-y-1">
            {topModels.map(([model, s]) => (
              <div key={model} className="flex items-center justify-between text-xs font-mono gap-2">
                <span className="truncate">{model}</span>
                <span className="shrink-0 text-muted-foreground">
                  {s.calls} appels · ${s.cost.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>



      {/* Master toggle */}
      <div className="border-2 border-foreground/20 rounded-lg p-4 flex items-start justify-between gap-4 bg-muted/30">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">Contrôle global</h3>
            <Badge variant="outline">
              {rows.filter((r) => r.enabled).length} / {rows.length} sur Groq
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Active Groq sur toutes les features, ou restaure d'un coup l'ensemble des modèles d'origine.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Switch
            checked={allEnabled}
            disabled={bulkSaving}
            onCheckedChange={(checked) => bulkSetEnabled(checked)}
          />
          {anyEnabled && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => bulkSetEnabled(false)}
              disabled={bulkSaving}
              className="text-xs"
            >
              {bulkSaving ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <RotateCcw className="h-3 w-3 mr-1" />
              )}
              Tout restaurer
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3">
        {rows.map((r) => (
          <div
            key={r.feature}
            className="border border-border rounded-lg p-4 flex items-start justify-between gap-4 hover:border-foreground/40 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold">{r.label}</h3>
                {r.enabled ? (
                  <Badge variant="outline" className="border-yellow-500 text-yellow-600 dark:text-yellow-400">
                    Groq actif
                  </Badge>
                ) : (
                  <Badge variant="outline">Origine</Badge>
                )}
              </div>
              {r.description && (
                <p className="text-sm text-muted-foreground mt-1">{r.description}</p>
              )}
              <div className="grid sm:grid-cols-2 gap-2 mt-3 text-xs font-mono">
                <div>
                  <span className="text-muted-foreground">Actif → </span>
                  <span className={r.enabled ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'}>
                    {r.enabled ? `groq · ${r.model}` : `lovable · ${r.original_model}`}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Origine : </span>
                  <span>{r.original_model}</span>
                </div>
              </div>
              <code className="block text-[10px] text-muted-foreground mt-2">{r.feature}</code>
            </div>

            <div className="flex flex-col items-end gap-2">
              <Switch
                checked={r.enabled}
                disabled={savingId === r.feature}
                onCheckedChange={(checked) => updateRow(r.feature, { enabled: checked })}
              />
              {r.enabled && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateRow(r.feature, { enabled: false })}
                  disabled={savingId === r.feature}
                  className="text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" /> Restaurer
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground border-t border-border pt-4">
        Pour ajouter une nouvelle fonctionnalité au routeur : insère une ligne dans <code>ai_routing_overrides</code>
        avec un <code>feature</code> unique, puis appelle <code>callRoutedAI('mon_feature', ...)</code> depuis l'edge function.
      </p>
    </div>
  );
}
