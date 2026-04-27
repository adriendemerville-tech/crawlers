import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle2, XCircle, MinusCircle, AlertTriangle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

type ImplementationMode = 'dry_run' | 'auto' | 'review' | string;
type Phase = 'audit' | 'diagnose' | 'prescribe' | 'execute' | 'validate';
type PhaseStatus = 'completed' | 'dry_run' | 'failed' | 'degraded' | 'partial' | 'planned' | 'skipped' | null;

const PHASES: Phase[] = ['audit', 'diagnose', 'prescribe', 'execute', 'validate'];

interface SiteRow {
  domain: string;
  label: string;
  implementation_mode: ImplementationMode;
  is_active: boolean;
  status: string | null;
  last_cycle_at: string | null;
  total_cycles_run: number;
  last_cycle_number: number | null;
  phases: Record<Phase, PhaseStatus>;
}

function PhaseChip({ phase, status }: { phase: Phase; status: PhaseStatus }) {
  const config: Record<string, { icon: typeof CheckCircle2; label: string; cls: string }> = {
    completed: { icon: CheckCircle2, label: 'Exécutée', cls: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300' },
    dry_run: { icon: MinusCircle, label: 'Simulée', cls: 'border-yellow-500/40 text-yellow-700 dark:text-yellow-300' },
    failed: { icon: XCircle, label: 'Échec', cls: 'border-red-500/40 text-red-700 dark:text-red-300' },
    degraded: { icon: AlertTriangle, label: 'Dégradée', cls: 'border-orange-500/40 text-orange-700 dark:text-orange-300' },
    partial: { icon: AlertTriangle, label: 'Partielle', cls: 'border-orange-500/40 text-orange-700 dark:text-orange-300' },
    planned: { icon: Clock, label: 'Planifiée', cls: 'border-border text-muted-foreground' },
    skipped: { icon: MinusCircle, label: 'Non atteinte', cls: 'border-border text-muted-foreground/60' },
  };

  const c = status ? config[status] : config.skipped;
  const Icon = c.icon;

  return (
    <div className={`flex flex-col items-center gap-1 rounded-lg border bg-background/50 p-2 ${c.cls}`}>
      <Icon className="h-3.5 w-3.5" />
      <span className="text-[10px] font-medium uppercase tracking-wide">{phase}</span>
      <span className="text-[10px]">{c.label}</span>
    </div>
  );
}

function ModeBadge({ mode }: { mode: ImplementationMode }) {
  if (mode === 'dry_run') {
    return <Badge variant="outline" className="border-yellow-500/40 text-yellow-700 dark:text-yellow-300">Dry-run (push CMS bloqué)</Badge>;
  }
  if (mode === 'auto') {
    return <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300">Auto (push CMS actif)</Badge>;
  }
  if (mode === 'review') {
    return <Badge variant="outline" className="border-violet-500/40 text-violet-700 dark:text-violet-300">Review (validation manuelle)</Badge>;
  }
  return <Badge variant="outline">{mode || 'inconnu'}</Badge>;
}

export function ParmenionExecutionStatus() {
  const [rows, setRows] = useState<SiteRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    setLoading(true);

    // 1. Sites Parménion actifs
    const { data: targets } = await supabase
      .from('parmenion_targets')
      .select('domain, label, is_active')
      .eq('is_active', true)
      .order('domain');

    if (!targets || targets.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    // 2. Configs autopilot (jointure via tracked_sites.domain)
    const domains = targets.map((t) => t.domain);
    const { data: sites } = await supabase
      .from('tracked_sites')
      .select('id, domain')
      .in('domain', domains);

    const siteIdByDomain = new Map((sites || []).map((s: any) => [s.domain, s.id]));
    const trackedIds = (sites || []).map((s: any) => s.id);

    const { data: configs } = await supabase
      .from('autopilot_configs')
      .select('tracked_site_id, implementation_mode, is_active, status, last_cycle_at, total_cycles_run')
      .in('tracked_site_id', trackedIds.length ? trackedIds : ['00000000-0000-0000-0000-000000000000']);

    const configByDomain = new Map<string, any>();
    for (const cfg of configs || []) {
      const domain = [...siteIdByDomain.entries()].find(([, id]) => id === cfg.tracked_site_id)?.[0];
      if (domain) configByDomain.set(domain, cfg);
    }

    // 3. Pour chaque domaine : dernier cycle_number + statut par phase
    const result: SiteRow[] = [];
    for (const t of targets) {
      const cfg = configByDomain.get(t.domain);

      // Dernier cycle_number connu
      const { data: lastCycleRow } = await supabase
        .from('parmenion_decision_log')
        .select('cycle_number')
        .eq('domain', t.domain)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastCycleNumber = lastCycleRow?.cycle_number ?? null;
      const phases: Record<Phase, PhaseStatus> = {
        audit: 'skipped', diagnose: 'skipped', prescribe: 'skipped',
        execute: 'skipped', validate: 'skipped',
      };

      if (lastCycleNumber !== null) {
        const { data: phaseRows } = await supabase
          .from('parmenion_decision_log')
          .select('pipeline_phase, status, created_at')
          .eq('domain', t.domain)
          .eq('cycle_number', lastCycleNumber)
          .order('created_at', { ascending: true });

        for (const row of phaseRows || []) {
          const p = row.pipeline_phase as Phase;
          if (PHASES.includes(p)) {
            phases[p] = (row.status as PhaseStatus) ?? 'planned';
          }
        }
      }

      result.push({
        domain: t.domain,
        label: t.label,
        implementation_mode: cfg?.implementation_mode || 'inconnu',
        is_active: cfg?.is_active ?? false,
        status: cfg?.status ?? null,
        last_cycle_at: cfg?.last_cycle_at ?? null,
        total_cycles_run: cfg?.total_cycles_run ?? 0,
        last_cycle_number: lastCycleNumber,
        phases,
      });
    }

    setRows(result);
    setLoading(false);
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Statut d'exécution Parménion</CardTitle>
            <CardDescription>
              Mode actuel et phases réellement exécutées au dernier cycle pour chaque site
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchStatus} disabled={loading}>
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Rafraîchir
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        )}
        {!loading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun site branché à Parménion.</p>
        )}
        {rows.map((row) => (
          <div key={row.domain} className="rounded-lg border bg-card/50 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{row.label}</span>
                  <span className="text-xs text-muted-foreground">{row.domain}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Cycle #{row.last_cycle_number ?? '—'} • {row.total_cycles_run} cycles totaux
                  {row.last_cycle_at && (
                    <> • il y a {formatDistanceToNow(new Date(row.last_cycle_at), { locale: fr })}</>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ModeBadge mode={row.implementation_mode} />
                {row.status && (
                  <Badge variant="outline" className="text-xs">{row.status}</Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {PHASES.map((p) => (
                <PhaseChip key={p} phase={p} status={row.phases[p]} />
              ))}
            </div>

            {row.implementation_mode === 'dry_run' && (
              <p className="text-[11px] text-muted-foreground italic">
                En dry-run, seule la phase <span className="font-mono">execute</span> (push CMS) est bloquée.
                Les phases d'audit, diagnostic, prescription et validation s'exécutent normalement et alimentent le workbench.
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
