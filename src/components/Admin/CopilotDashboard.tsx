/**
 * CopilotDashboard — KPIs admin du Copilot (1 backend N personas).
 *
 * Affiche : sessions, actions, coût LLM, durée moyenne, breakdown persona,
 * top skills, taux d'approbation, série quotidienne.
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Bot, Coins, Gauge, ListChecks, ShieldCheck } from 'lucide-react';

interface Stats {
  window_days: number;
  totals: { sessions: number; actions: number; cost_usd: number; avg_duration_ms: number };
  by_persona: Record<string, { sessions: number; actions: number; cost: number }>;
  top_skills: Array<{ skill: string; total: number; error_rate: number; rejected_rate: number }>;
  approvals: { awaiting: number; approval_rate: number };
  daily: Array<{ date: string; sessions: number; actions: number; cost: number }>;
}

const PERSONA_LABELS: Record<string, string> = {
  felix: 'Félix',
  strategist: 'Stratège Cocoon',
};

export function CopilotDashboard() {
  const [days, setDays] = useState(7);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase.functions
      .invoke('copilot-admin-stats', { body: {}, method: 'GET' as const, headers: {} })
      // fallback REST-like : invoke ne supporte pas query params, on reconstruit l'URL.
      .catch(() => null)
      .finally(() => {});

    // Appel direct via fetch pour passer les query params.
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/copilot-admin-stats?days=${days}`;
        const r = await fetch(url, {
          headers: { Authorization: `Bearer ${token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = (await r.json()) as Stats;
        if (!cancelled) setStats(json);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [days]);

  if (loading) return <CopilotSkeleton />;

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">Erreur chargement stats Copilot : {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const personaEntries = Object.entries(stats.by_persona);
  const maxDailyActions = Math.max(...stats.daily.map((d) => d.actions), 1);

  return (
    <div className="space-y-6">
      {/* Header + window selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Copilot — KPIs</h2>
          <p className="text-sm text-muted-foreground">
            Backend unifié Félix + Stratège Cocoon — fenêtre {stats.window_days} jours
          </p>
        </div>
        <div className="flex gap-2">
          {[1, 7, 30].map((d) => (
            <Button
              key={d}
              variant={days === d ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDays(d)}
            >
              {d}j
            </Button>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard icon={<Activity className="h-4 w-4" />} label="Sessions" value={stats.totals.sessions} />
        <KpiCard icon={<ListChecks className="h-4 w-4" />} label="Actions skills" value={stats.totals.actions} />
        <KpiCard
          icon={<Coins className="h-4 w-4" />}
          label="Coût LLM"
          value={`$${stats.totals.cost_usd.toFixed(4)}`}
        />
        <KpiCard
          icon={<Gauge className="h-4 w-4" />}
          label="Durée moyenne skill"
          value={`${stats.totals.avg_duration_ms} ms`}
        />
      </div>

      {/* Personas breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" /> Répartition par persona
          </CardTitle>
        </CardHeader>
        <CardContent>
          {personaEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune session sur la période.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {personaEntries.map(([persona, p]) => (
                <div key={persona} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{PERSONA_LABELS[persona] ?? persona}</span>
                    <Badge variant="outline">{persona}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <Stat label="Sessions" value={p.sessions} />
                    <Stat label="Actions" value={p.actions} />
                    <Stat label="Coût $" value={p.cost.toFixed(4)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approvals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" /> Workflow d'approbation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Stat label="Actions en attente" value={stats.approvals.awaiting} />
            <Stat
              label="Taux d'approbation effective"
              value={`${(stats.approvals.approval_rate * 100).toFixed(1)} %`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Top skills */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 10 skills utilisés</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.top_skills.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun skill exécuté sur la période.</p>
          ) : (
            <div className="space-y-2">
              {stats.top_skills.map((s) => (
                <div key={s.skill} className="flex items-center justify-between border-b py-2 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <code className="text-xs bg-muted px-2 py-1 rounded">{s.skill}</code>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span>{s.total}</span>
                    {s.error_rate > 0 && (
                      <Badge variant="destructive" className="text-[10px]">
                        {(s.error_rate * 100).toFixed(0)}% erreurs
                      </Badge>
                    )}
                    {s.rejected_rate > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        {(s.rejected_rate * 100).toFixed(0)}% rejets
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily series — sparkline simple */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activité quotidienne</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-32">
            {stats.daily.map((d) => {
              const h = Math.max(2, (d.actions / maxDailyActions) * 100);
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date} — ${d.actions} actions`}>
                  <div
                    className="w-full bg-primary/70 rounded-sm"
                    style={{ height: `${h}%` }}
                  />
                  <span className="text-[9px] text-muted-foreground rotate-45 origin-top-left whitespace-nowrap mt-2">
                    {d.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2 text-muted-foreground">
          {icon}
          <span className="text-xs uppercase tracking-wider">{label}</span>
        </div>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-medium">{value}</div>
    </div>
  );
}

function CopilotSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-40" />
      <Skeleton className="h-40" />
    </div>
  );
}
