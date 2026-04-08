import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, ArrowRightLeft, TrendingUp, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

const USD_TO_EUR = 0.92;

interface UsageStats {
  totalCalls: number;
  totalTokens: number;
  totalCostUsd: number;
  lovableCalls: number;
  openrouterCalls: number;
  fallbackCalls: number;
  todayCalls: number;
  todayCostUsd: number;
  topModels: Array<{ model: string; count: number; cost: number }>;
  topFunctions: Array<{ fn: string; count: number; cost: number }>;
}

export function AIGatewayUsageCard() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('ai_gateway_usage' as any)
        .select('gateway, model, edge_function, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd, is_fallback, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error || !data) {
        setStats(null);
        return;
      }

      const rows = data as any[];
      let totalCalls = rows.length;
      let totalTokens = 0;
      let totalCostUsd = 0;
      let lovableCalls = 0;
      let openrouterCalls = 0;
      let fallbackCalls = 0;
      let todayCalls = 0;
      let todayCostUsd = 0;
      const modelMap = new Map<string, { count: number; cost: number }>();
      const fnMap = new Map<string, { count: number; cost: number }>();

      for (const row of rows) {
        totalTokens += row.total_tokens || 0;
        const cost = parseFloat(row.estimated_cost_usd) || 0;
        totalCostUsd += cost;

        if (row.gateway === 'lovable') lovableCalls++;
        else openrouterCalls++;
        if (row.is_fallback) fallbackCalls++;

        if (new Date(row.created_at) >= todayStart) {
          todayCalls++;
          todayCostUsd += cost;
        }

        // Model aggregation
        const m = modelMap.get(row.model) || { count: 0, cost: 0 };
        m.count++;
        m.cost += cost;
        modelMap.set(row.model, m);

        // Function aggregation
        const fn = row.edge_function || 'unknown';
        const f = fnMap.get(fn) || { count: 0, cost: 0 };
        f.count++;
        f.cost += cost;
        fnMap.set(fn, f);
      }

      const topModels = Array.from(modelMap.entries())
        .map(([model, v]) => ({ model, ...v }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 5);

      const topFunctions = Array.from(fnMap.entries())
        .map(([fn, v]) => ({ fn, ...v }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 5);

      setStats({
        totalCalls, totalTokens, totalCostUsd,
        lovableCalls, openrouterCalls, fallbackCalls,
        todayCalls, todayCostUsd, topModels, topFunctions,
      });
    } catch (err) {
      console.error('[AIGatewayUsageCard] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, [days]);

  if (loading && !stats) {
    return (
      <Card className="border-blue-500/30 animate-pulse">
        <CardContent className="p-6 h-32" />
      </Card>
    );
  }

  if (!stats || stats.totalCalls === 0) {
    return (
      <Card className="border-blue-500/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-500" />
            Lovable AI Gateway
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <p className="text-xs text-muted-foreground">Aucune donnée d'usage enregistrée pour le moment.</p>
        </CardContent>
      </Card>
    );
  }

  const totalEur = stats.totalCostUsd * USD_TO_EUR;
  const todayEur = stats.todayCostUsd * USD_TO_EUR;
  const fallbackPct = stats.totalCalls > 0 ? ((stats.fallbackCalls / stats.totalCalls) * 100).toFixed(1) : '0';

  return (
    <Card className="border-blue-500/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-500" />
            Lovable AI Gateway — Dépenses estimées
          </CardTitle>
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="text-xs border rounded px-1.5 py-0.5 bg-background"
            >
              <option value={7}>7j</option>
              <option value={30}>30j</option>
              <option value={90}>90j</option>
            </select>
            <Button variant="ghost" size="sm" onClick={fetchStats} className="h-6 w-6 p-0">
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hero metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="text-center">
            <p className="text-lg font-bold">{totalEur.toFixed(2)}€</p>
            <p className="text-[10px] text-muted-foreground">Total ({days}j)</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">{todayEur.toFixed(2)}€</p>
            <p className="text-[10px] text-muted-foreground">Aujourd'hui</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">{stats.totalCalls.toLocaleString('fr-FR')}</p>
            <p className="text-[10px] text-muted-foreground">Appels</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">{(stats.totalTokens / 1_000_000).toFixed(1)}M</p>
            <p className="text-[10px] text-muted-foreground">Tokens</p>
          </div>
        </div>

        {/* Gateway split */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs gap-1">
            <Zap className="h-3 w-3 text-blue-500" />
            Lovable: {stats.lovableCalls}
          </Badge>
          <Badge variant="outline" className="text-xs gap-1">
            <ArrowRightLeft className="h-3 w-3 text-amber-500" />
            OpenRouter: {stats.openrouterCalls}
          </Badge>
          {stats.fallbackCalls > 0 && (
            <Badge variant="outline" className="text-xs gap-1 border-amber-500/50 text-amber-600">
              ⚡ Fallbacks: {stats.fallbackCalls} ({fallbackPct}%)
            </Badge>
          )}
        </div>

        {/* Top models */}
        {stats.topModels.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-1.5">Top modèles</p>
            <div className="space-y-1">
              {stats.topModels.map((m) => (
                <div key={m.model} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate max-w-[200px]">{m.model}</span>
                  <span className="font-mono">{m.count} appels · {(m.cost * USD_TO_EUR).toFixed(3)}€</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top functions */}
        {stats.topFunctions.length > 0 && stats.topFunctions[0].fn !== 'unknown' && (
          <div>
            <p className="text-xs font-medium mb-1.5">Top fonctions</p>
            <div className="space-y-1">
              {stats.topFunctions.filter(f => f.fn !== 'unknown').map((f) => (
                <div key={f.fn} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate max-w-[200px]">{f.fn}</span>
                  <span className="font-mono">{f.count} appels · {(f.cost * USD_TO_EUR).toFixed(3)}€</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
