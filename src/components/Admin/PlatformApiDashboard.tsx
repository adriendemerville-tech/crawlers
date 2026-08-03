import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Plug, Users, Wallet, Activity, TrendingUp, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Stats {
  window_days: number;
  usage: {
    total_jobs: number;
    by_status: Record<string, number>;
    top_features: Array<{ feature: string; count: number }>;
    top_users: Array<{ user_id: string; count: number }>;
    unique_users: number;
  };
  signups: {
    keys_created_window: number;
    unique_devs_window: number;
    total_keys: number;
    active_keys: number;
  };
  revenue: {
    total_cents: number;
    recharges: number;
    paying_devs: number;
  };
  wallets: {
    count: number;
    active: number;
    total_balance_cents: number;
  };
  daily: Array<{ date: string; jobs: number; revenue_cents: number }>;
}

const fmtEur = (cents: number) => `${(cents / 100).toFixed(2)}€`;

export function PlatformApiDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('admin-platform-api-stats', {
        method: 'GET',
        // @ts-ignore — query string passé via headers fetch
      });
      // fallback : invoke ne supporte pas query params, on appelle via fetch
      if (error || !data) {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-platform-api-stats?days=${days}`,
          { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setStats(await res.json());
      } else {
        setStats(data as Stats);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); /* eslint-disable-next-line */ }, [days]);

  if (loading && !stats) {
    return <Card><CardContent className="p-6 h-32 animate-pulse" /></Card>;
  }
  if (error) {
    return <Card><CardContent className="p-6 text-sm text-destructive">Erreur : {error}</CardContent></Card>;
  }
  if (!stats) return null;

  const succeeded = (stats.usage.by_status.succeeded ?? 0) + (stats.usage.by_status.completed ?? 0);
  const failed = stats.usage.by_status.failed ?? 0;
  const successRate = stats.usage.total_jobs > 0
    ? ((succeeded / stats.usage.total_jobs) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Plug className="h-5 w-5" />
            Plateforme API
          </h2>
          <p className="text-xs text-muted-foreground">
            Crawlers API (crw_live_) — usage, inscriptions développeurs, revenus Paddle
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="text-xs border rounded px-2 py-1 bg-background"
          >
            <option value={7}>7 jours</option>
            <option value={30}>30 jours</option>
            <option value={90}>90 jours</option>
            <option value={365}>365 jours</option>
          </select>
          <Button variant="outline" size="sm" onClick={fetchStats}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Hero metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-1.5 text-muted-foreground font-normal">
              <Activity className="h-3.5 w-3.5" /> Jobs ({days}j)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-bold">{stats.usage.total_jobs.toLocaleString('fr-FR')}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {successRate}% succès · {failed} échecs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-1.5 text-muted-foreground font-normal">
              <Users className="h-3.5 w-3.5" /> Devs actifs
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-bold">{stats.usage.unique_users}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {stats.signups.unique_devs_window} nouveaux ({days}j)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-1.5 text-muted-foreground font-normal">
              <TrendingUp className="h-3.5 w-3.5" /> Revenu ({days}j)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-bold">{fmtEur(stats.revenue.total_cents)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {stats.revenue.recharges} recharges · {stats.revenue.paying_devs} payeurs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-1.5 text-muted-foreground font-normal">
              <Wallet className="h-3.5 w-3.5" /> Wallets
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-bold">{fmtEur(stats.wallets.total_balance_cents)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {stats.wallets.active}/{stats.wallets.count} crédités
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* API keys */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> Clés API
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Actives</span>
              <span className="font-mono font-semibold">{stats.signups.active_keys}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total créées</span>
              <span className="font-mono">{stats.signups.total_keys}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Créées ({days}j)</span>
              <span className="font-mono">{stats.signups.keys_created_window}</span>
            </div>
          </CardContent>
        </Card>

        {/* Status breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Statuts des jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(stats.usage.by_status).map(([s, n]) => (
                <Badge key={s} variant="outline" className="text-xs">
                  {s}: {n}
                </Badge>
              ))}
              {Object.keys(stats.usage.by_status).length === 0 && (
                <p className="text-xs text-muted-foreground">Aucun job sur la période.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top features + Top users */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top features</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.usage.top_features.length === 0 ? (
              <p className="text-xs text-muted-foreground">—</p>
            ) : (
              <div className="space-y-1.5">
                {stats.usage.top_features.map((f) => (
                  <div key={f.feature} className="flex items-center justify-between text-xs">
                    <span className="font-mono truncate max-w-[240px]">{f.feature}</span>
                    <span className="font-semibold">{f.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top développeurs (par jobs)</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.usage.top_users.length === 0 ? (
              <p className="text-xs text-muted-foreground">—</p>
            ) : (
              <div className="space-y-1.5">
                {stats.usage.top_users.map((u) => (
                  <div key={u.user_id} className="flex items-center justify-between text-xs">
                    <span className="font-mono truncate max-w-[240px]" title={u.user_id}>
                      {u.user_id.slice(0, 8)}…{u.user_id.slice(-4)}
                    </span>
                    <span className="font-semibold">{u.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily timeseries (simple bars) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Activité quotidienne</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-px h-24 overflow-x-auto">
            {stats.daily.map((d) => {
              const max = Math.max(...stats.daily.map((x) => x.jobs), 1);
              const h = (d.jobs / max) * 100;
              return (
                <div
                  key={d.date}
                  className="flex-1 min-w-[6px] bg-foreground/70 hover:bg-foreground transition-colors rounded-sm"
                  style={{ height: `${Math.max(h, 2)}%` }}
                  title={`${d.date} · ${d.jobs} jobs · ${fmtEur(d.revenue_cents)}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>{stats.daily[0]?.date}</span>
            <span>{stats.daily[stats.daily.length - 1]?.date}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
