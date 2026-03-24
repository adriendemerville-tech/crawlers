import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAnalytics } from '@/contexts/AdminAnalyticsContext';
import {
  Users,
  Coins,
  CreditCard,
  HardDrive,
  TrendingUp,
  Flame,
  Cpu,
  Zap,
  Brain,
  Globe,
  Search,
  RefreshCw,
  Shield,
  Gauge,
  Server,
  ChevronDown,
} from 'lucide-react';
import { subDays, format, startOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

// Coûts estimés par million de tokens (input/output) en USD
const MODEL_PRICING: Record<string, { input: number; output: number; label: string }> = {
  'google/gemini-2.5-pro': { input: 1.25, output: 10.0, label: 'Gemini 2.5 Pro' },
  'google/gemini-3-pro-preview': { input: 1.25, output: 10.0, label: 'Gemini 3 Pro' },
  'google/gemini-3-flash-preview': { input: 0.15, output: 0.60, label: 'Gemini 3 Flash' },
  'google/gemini-2.5-flash': { input: 0.15, output: 0.60, label: 'Gemini 2.5 Flash' },
  'google/gemini-2.5-flash-lite': { input: 0.075, output: 0.30, label: 'Gemini 2.5 Flash Lite' },
  'openai/gpt-5': { input: 10.0, output: 30.0, label: 'GPT-5' },
  'openai/gpt-5-mini': { input: 1.10, output: 4.40, label: 'GPT-5 Mini' },
  'openai/gpt-5-nano': { input: 0.10, output: 0.40, label: 'GPT-5 Nano' },
  'openai/gpt-5.2': { input: 10.0, output: 30.0, label: 'GPT-5.2' },
};

const API_COST_ESTIMATES: Record<string, number> = {
  dataforseo: 0.01,
  browserless: 0.008,
  firecrawl: 0.005,
  spider: 0.001,
  'fly-playwright': 0.0001,
  openrouter: 0,
};

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING[model] || { input: 0.50, output: 1.50 };
  const usd = (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;
  return usd * 0.92;
}

interface TokenUsageStats {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  callCount: number;
  byFunction: Record<string, { tokens: number; calls: number; model?: string }>;
  byModel: Record<string, { promptTokens: number; completionTokens: number; totalTokens: number; calls: number; estimatedCost: number }>;
  paidApiCalls: number;
  totalEstimatedCost: number;
  dataforseoCalls: number;
  openrouterCalls: number;
  browserlessCalls: number;
  firecrawlCalls: number;
  spiderCalls: number;
  spiderEstimatedCost: number;
  flyPlaywrightCalls: number;
  flyEstimatedCost: number;
  byApiService: Record<string, { calls: number; byEndpoint: Record<string, number> }>;
}

export function FinancesDashboard() {
  const { allEvents: sharedAllEvents, filteredEvents: sharedFilteredEvents, adminUserIds: sharedAdminUserIds, isLoading: sharedLoading, fetchEvents } = useAdminAnalytics();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [businessMetrics, setBusinessMetrics] = useState({ payingSubscribers: 0, creditsPurchased: 0, mrr: 0, bundleMrr: 0 });
  const [totalPlatformCost, setTotalPlatformCost] = useState(0);
  const [allTimePlatformCost, setAllTimePlatformCost] = useState(0);
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const [avgCostPerSubscriber, setAvgCostPerSubscriber] = useState<{ avg: number; count: number } | null>(null);
  const [dbSize, setDbSize] = useState<{ total_mb: number; total_gb: number } | null>(null);
  const [dataforseoBalance, setDataforseoBalance] = useState<{ balance: number | null; total_deposited: number | null; total_spent: number | null; fetched_at: string | null } | null>(null);
  const [apiBalances, setApiBalances] = useState<{
    serpapi?: { plan?: string; searches_this_month?: number; total_searches_left?: number; plan_searches_left?: number; error?: string };
    openrouter?: { usage?: number; limit?: number; balance?: number; is_free_tier?: boolean; error?: string };
    firecrawl?: { remaining_credits?: number; total_credits?: number; plan?: string; error?: string };
  } | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsageStats>({
    totalTokens: 0, promptTokens: 0, completionTokens: 0, callCount: 0,
    byFunction: {}, byModel: {},
    paidApiCalls: 0, totalEstimatedCost: 0,
    dataforseoCalls: 0, openrouterCalls: 0, browserlessCalls: 0, firecrawlCalls: 0,
    spiderCalls: 0, spiderEstimatedCost: 0,
    flyPlaywrightCalls: 0, flyEstimatedCost: 0, byApiService: {},
  });
  const [allTimeTokenUsage, setAllTimeTokenUsage] = useState<TokenUsageStats | null>(null);
  const [allTimeRawEvents, setAllTimeRawEvents] = useState<{ created_at: string; cost: number }[]>([]);
  const [spendingChartOpen, setSpendingChartOpen] = useState(false);
  const [spendingScale, setSpendingScale] = useState<'day' | 'week' | 'month'>('week');

  // Fetch events with optional date filter
  const fetchEventsByType = useCallback(async (eventType: string, sinceDate?: string) => {
    const PAGE_SIZE = 1000;
    const MAX_PAGES = 20;
    let all: typeof sharedAllEvents = [];
    let page = 0;
    while (page < MAX_PAGES) {
      let query = supabase
        .from('analytics_events')
        .select('event_type, url, created_at, user_id, event_data')
        .eq('event_type', eventType)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (sinceDate) query = query.gte('created_at', sinceDate);
      const { data, error } = await query;
      if (error || !data || data.length === 0) break;
      all = all.concat(data as typeof sharedAllEvents);
      if (data.length < PAGE_SIZE) break;
      page++;
    }
    return all;
  }, []);

  const fetchFinancialEvents = useCallback(async () => {
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

    // Fetch both 30-day and all-time in parallel
    const [tokenEvents30d, paidApiEvents30d, tokenEventsAll, paidApiEventsAll] = await Promise.all([
      fetchEventsByType('ai_token_usage', thirtyDaysAgo),
      fetchEventsByType('paid_api_call', thirtyDaysAgo),
      fetchEventsByType('ai_token_usage'),
      fetchEventsByType('paid_api_call'),
    ]);

    return { tokenEvents: tokenEvents30d, paidApiEvents: paidApiEvents30d, tokenEventsAll, paidApiEventsAll };
  }, [fetchEventsByType]);

  // Trigger shared fetch on mount
  useEffect(() => { fetchEvents(); }, []);

  // Process when shared data arrives
  useEffect(() => {
    if (sharedAllEvents.length === 0 && sharedLoading) return;
    processData(sharedAllEvents, sharedFilteredEvents);
  }, [sharedAllEvents, sharedLoading]);

  const computeTokenStats = useCallback((tokenEvents: typeof sharedAllEvents, paidApiEvents: typeof sharedAllEvents): TokenUsageStats => {
    const byFunction: Record<string, { tokens: number; calls: number; model?: string }> = {};
    const byModel: Record<string, { promptTokens: number; completionTokens: number; totalTokens: number; calls: number; estimatedCost: number }> = {};
    let totalTokens = 0, promptTokens = 0, completionTokens = 0, totalEstimatedCost = 0;

    tokenEvents.forEach(e => {
      const data = e.event_data as Record<string, unknown> | null;
      if (!data) return;
      const t = Number(data.total_tokens) || 0;
      const p = Number(data.prompt_tokens) || 0;
      const c = Number(data.completion_tokens) || 0;
      const model = (data.model as string) || 'unknown';
      totalTokens += t; promptTokens += p; completionTokens += c;
      const fn = (data.function_name as string) || 'unknown';
      if (!byFunction[fn]) byFunction[fn] = { tokens: 0, calls: 0, model };
      byFunction[fn].tokens += t; byFunction[fn].calls += 1;
      if (!byModel[model]) byModel[model] = { promptTokens: 0, completionTokens: 0, totalTokens: 0, calls: 0, estimatedCost: 0 };
      byModel[model].promptTokens += p; byModel[model].completionTokens += c;
      byModel[model].totalTokens += t; byModel[model].calls += 1;
      const cost = estimateCost(model, p, c);
      byModel[model].estimatedCost += cost;
      totalEstimatedCost += cost;
    });

    const byApiService: Record<string, { calls: number; byEndpoint: Record<string, number> }> = {};
    let dataforseoCalls = 0, openrouterCalls = 0, browserlessCalls = 0, firecrawlCalls = 0, spiderCalls = 0, flyPlaywrightCalls = 0;

    paidApiEvents.forEach(e => {
      const data = e.event_data as Record<string, unknown> | null;
      if (!data) return;
      const service = (data.api_service as string) || 'unknown';
      const endpoint = (data.endpoint as string) || 'unknown';
      if (!byApiService[service]) byApiService[service] = { calls: 0, byEndpoint: {} };
      byApiService[service].calls += 1;
      byApiService[service].byEndpoint[endpoint] = (byApiService[service].byEndpoint[endpoint] || 0) + 1;
      if (service === 'dataforseo') dataforseoCalls++;
      if (service === 'openrouter') openrouterCalls++;
      if (service === 'browserless') browserlessCalls++;
      if (service === 'firecrawl') firecrawlCalls++;
      if (service === 'spider') spiderCalls++;
      if (service === 'fly-playwright') flyPlaywrightCalls++;
    });

    const FLY_COST_PER_RENDER_EUR = 0.00000246 * 40 * 0.92;
    const flyEstimatedCost = flyPlaywrightCalls * FLY_COST_PER_RENDER_EUR;
    const spiderEstimatedCost = spiderCalls * 0.001 * 0.92;

    return {
      totalTokens, promptTokens, completionTokens,
      callCount: tokenEvents.length, byFunction, byModel,
      paidApiCalls: paidApiEvents.length, totalEstimatedCost,
      dataforseoCalls, openrouterCalls, browserlessCalls, firecrawlCalls,
      spiderCalls, spiderEstimatedCost,
      flyPlaywrightCalls, flyEstimatedCost, byApiService,
    };
  }, []);

  const processData = useCallback(async (allEvents: typeof sharedAllEvents, events: typeof sharedFilteredEvents) => {
    setIsLoading(true);

    try {
      const { tokenEvents, paidApiEvents, tokenEventsAll, paidApiEventsAll } = await fetchFinancialEvents();

      // 30-day stats
      const stats30d = computeTokenStats(tokenEvents, paidApiEvents);
      const totalPaidApiCost30d = paidApiEvents.length * 0.005; // rough average
      const grandTotalCost30d = stats30d.totalEstimatedCost + stats30d.flyEstimatedCost + stats30d.spiderEstimatedCost + totalPaidApiCost30d;
      setTotalPlatformCost(grandTotalCost30d);
      setTokenUsage(stats30d);

      // All-time stats
      const statsAll = computeTokenStats(tokenEventsAll, paidApiEventsAll);
      const totalPaidApiCostAll = paidApiEventsAll.length * 0.005;
      const grandTotalCostAll = statsAll.totalEstimatedCost + statsAll.flyEstimatedCost + statsAll.spiderEstimatedCost + totalPaidApiCostAll;
      setAllTimePlatformCost(grandTotalCostAll);
      setAllTimeTokenUsage(statsAll);

      // Store raw events for spending chart
      const rawCosts: { created_at: string; cost: number }[] = [];
      tokenEventsAll.forEach(e => {
        const data = e.event_data as Record<string, unknown> | null;
        if (!data) return;
        const model = (data.model as string) || 'unknown';
        const p = Number(data.prompt_tokens) || 0;
        const c = Number(data.completion_tokens) || 0;
        rawCosts.push({ created_at: e.created_at, cost: estimateCost(model, p, c) });
      });
      paidApiEventsAll.forEach(e => {
        rawCosts.push({ created_at: e.created_at, cost: 0.005 });
      });
      setAllTimeRawEvents(rawCosts);

      // Active users
      const activeUserIds = new Set<string>();
      events.forEach(e => { if (e.user_id) activeUserIds.add(e.user_id); });
      setActiveUsersCount(activeUserIds.size);

      // Business metrics
      const [payingRes, purchaseRes, bundleRes] = await Promise.all([
        supabase
          .from('profiles').select('user_id')
          .eq('plan_type', 'agency_pro').eq('subscription_status', 'active')
          .not('stripe_subscription_id', 'is', null),
        supabase
          .from('credit_transactions').select('amount').eq('transaction_type', 'purchase'),
        supabase
          .from('bundle_subscriptions')
          .select('monthly_price_cents')
          .eq('status', 'active'),
      ]);
      const payingProfiles = payingRes.data;
      const payingCount = payingProfiles?.length || 0;
      const creditsPurchased = (purchaseRes.data || []).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      const bundleMrr = (bundleRes.data || []).reduce((sum: number, s: any) => sum + ((s.monthly_price_cents || 0) / 100), 0);
      const mrr = payingCount * 59 + bundleMrr;
      setBusinessMetrics({ payingSubscribers: payingCount, creditsPurchased, mrr, bundleMrr });

      // ACPU per subscriber
      if (payingProfiles && payingProfiles.length > 0) {
        const payingUserIds = new Set(payingProfiles.map(p => p.user_id));
        const costPerUser: Record<string, number> = {};
        tokenEvents.forEach(e => {
          const data = e.event_data as Record<string, unknown> | null;
          if (data && e.user_id && payingUserIds.has(e.user_id)) {
            const p = Number(data.prompt_tokens) || 0;
            const c = Number(data.completion_tokens) || 0;
            const model = (data.model as string) || 'unknown';
            costPerUser[e.user_id] = (costPerUser[e.user_id] || 0) + estimateCost(model, p, c);
          }
        });
        paidApiEvents.forEach(e => {
          const data = e.event_data as Record<string, unknown> | null;
          if (data && e.user_id && payingUserIds.has(e.user_id)) {
            const service = (data.api_service as string) || 'unknown';
            costPerUser[e.user_id] = (costPerUser[e.user_id] || 0) + (API_COST_ESTIMATES[service] || 0.005);
          }
        });
        const usersWithCosts = Object.values(costPerUser);
        const totalCostSubs = usersWithCosts.reduce((s, c) => s + c, 0);
        setAvgCostPerSubscriber({ avg: payingProfiles.length > 0 ? totalCostSubs / payingProfiles.length : 0, count: payingProfiles.length });
      } else {
        setAvgCostPerSubscriber({ avg: 0, count: 0 });
      }

      // DB size + DataForSEO balance
      try {
        const [sizeRes, balanceRes, apiBalancesRes] = await Promise.all([
          supabase.rpc('get_database_size' as any),
          supabase.functions.invoke('dataforseo-balance'),
          supabase.functions.invoke('api-balances'),
        ]);
        if (sizeRes.data) setDbSize(sizeRes.data as any);
        if (balanceRes.data && !balanceRes.error) {
          setDataforseoBalance(balanceRes.data as any);
        }
        if (apiBalancesRes.data && !apiBalancesRes.error) {
          setApiBalances(apiBalancesRes.data as any);
        }
      } catch {}

    } catch (err) {
      console.error('FinancesDashboard fetch error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // removed old fetchData effect — now driven by shared context

  // Spending chart data (must be before any early return to respect hooks rules)
  const spendingChartData = useMemo(() => {
    if (!allTimeRawEvents.length) return [];
    const buckets = new Map<string, number>();
    
    allTimeRawEvents.forEach(evt => {
      const date = new Date(evt.created_at);
      let key: string;
      if (spendingScale === 'day') key = format(startOfDay(date), 'yyyy-MM-dd');
      else if (spendingScale === 'week') key = format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      else key = format(startOfMonth(date), 'yyyy-MM');
      buckets.set(key, (buckets.get(key) || 0) + evt.cost);
    });

    const sorted = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    let cumulative = 0;
    return sorted.map(([key, cost]) => {
      cumulative += cost;
      const labelFmt = spendingScale === 'month' ? 'MMM yy' : 'dd MMM';
      const label = format(new Date(key), labelFmt, { locale: fr });
      return { date: key, label, cost: Math.round(cost * 100) / 100, cumulative: Math.round(cumulative * 100) / 100 };
    });
  }, [allTimeRawEvents, spendingScale]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // MCR / ACPU computed values
  const mcr = businessMetrics.mrr > 0 ? (totalPlatformCost / businessMetrics.mrr) * 100 : 0;
  const acpu = activeUsersCount > 0 ? totalPlatformCost / activeUsersCount : 0;
  const acpuSub = avgCostPerSubscriber?.avg ?? 0;

  const mcrColor = mcr > 25 ? 'rose' : mcr > 15 ? 'amber' : 'emerald';
  const acpuColor = acpu > 0.15 ? 'rose' : acpu > 0.08 ? 'amber' : 'emerald';
  const acpuSubColor = acpuSub > 0.30 ? 'rose' : acpuSub > 0.15 ? 'amber' : 'emerald';

  const cc = {
    rose: { border: 'border-rose-500/30', text: 'text-rose-600 dark:text-rose-400' },
    amber: { border: 'border-amber-500/30', text: 'text-amber-600 dark:text-amber-400' },
    emerald: { border: 'border-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400' },
  };

  // Grand total since launch = estimated platform cost + real API data
  const realDataforseoSpent = dataforseoBalance?.total_spent ?? 0;
  const realOpenrouterSpent = apiBalances?.openrouter?.usage ?? 0;
  const realFirecrawlUsed = apiBalances?.firecrawl?.total_credits && apiBalances?.firecrawl?.remaining_credits
    ? apiBalances.firecrawl.total_credits - apiBalances.firecrawl.remaining_credits
    : 0;
  const grandTotalSinceLaunchUSD = realDataforseoSpent + realOpenrouterSpent;
  const grandTotalSinceLaunchEUR = grandTotalSinceLaunchUSD * 0.92 + allTimePlatformCost;

  // spendingChartData is now computed above (before early return) to respect hooks rules

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Finances & Coûts</h2>
          <p className="text-xs text-muted-foreground">Indicateurs financiers depuis le lancement</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchEvents(true)} disabled={isRefreshing} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Hero: Total Spending Since Launch */}
      <Card className="border-2 border-primary/30 bg-gradient-to-r from-card via-card to-primary/5">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Dépenses totales depuis le lancement</p>
                <p className="text-3xl font-bold text-foreground">
                  {grandTotalSinceLaunchEUR.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  dont ${grandTotalSinceLaunchUSD.toFixed(2)} API réel + {allTimePlatformCost.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€ estimé (LLM + infra)
                </p>
              </div>
            </div>
            <div className="flex gap-6 text-center">
              <div>
                <p className="text-xl font-bold text-foreground">{(allTimeTokenUsage?.callCount ?? 0).toLocaleString('fr-FR')}</p>
                <p className="text-[10px] text-muted-foreground">Appels IA total</p>
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{(allTimeTokenUsage?.paidApiCalls ?? 0).toLocaleString('fr-FR')}</p>
                <p className="text-[10px] text-muted-foreground">Appels API total</p>
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{((allTimeTokenUsage?.totalTokens ?? 0) / 1_000_000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M</p>
                <p className="text-[10px] text-muted-foreground">Tokens total</p>
              </div>
            </div>
          </div>
          <div className="flex justify-end mt-2">
            <button
              onClick={() => setSpendingChartOpen(prev => !prev)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>{spendingChartOpen ? 'Masquer' : 'Évolution'}</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${spendingChartOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Business Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-emerald-500/30">
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Abonnés payants</CardTitle>
            <Users className="h-3.5 w-3.5 text-emerald-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold">{businessMetrics.payingSubscribers}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Pro Agency actifs</p>
          </CardContent>
        </Card>
        <Card className="border-violet-500/30">
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Crédits achetés</CardTitle>
            <Coins className="h-3.5 w-3.5 text-violet-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold">{businessMetrics.creditsPurchased.toLocaleString('fr-FR')}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Total historique</p>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30">
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">MRR</CardTitle>
            <CreditCard className="h-3.5 w-3.5 text-amber-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold">{businessMetrics.mrr.toLocaleString('fr-FR')} €</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {businessMetrics.payingSubscribers} × 59€{businessMetrics.bundleMrr > 0 ? ` + ${businessMetrics.bundleMrr.toLocaleString('fr-FR')}€ bundle` : ''}
            </p>
          </CardContent>
        </Card>
        {dbSize && (
          <Card className="border-cyan-500/30">
            <CardHeader className="flex flex-row items-center justify-between p-3 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">Poids-mémoire BDD</CardTitle>
              <HardDrive className="h-3.5 w-3.5 text-cyan-500" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-lg font-bold">
                {dbSize.total_gb >= 1
                  ? `${dbSize.total_gb.toLocaleString('fr-FR')} Go`
                  : `${dbSize.total_mb.toLocaleString('fr-FR')} Mo`}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Stockage total base de données</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Spending Evolution Chart */}
      {spendingChartOpen && spendingChartData.length > 0 && (
        <Card className="border-primary/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Évolution des dépenses</p>
              <ToggleGroup type="single" value={spendingScale} onValueChange={v => v && setSpendingScale(v as 'day' | 'week' | 'month')} size="sm">
                <ToggleGroupItem value="day" className="text-xs px-2 h-7">Jour</ToggleGroupItem>
                <ToggleGroupItem value="week" className="text-xs px-2 h-7">Semaine</ToggleGroupItem>
                <ToggleGroupItem value="month" className="text-xs px-2 h-7">Mois</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={spendingChartData}>
                  <defs>
                    <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" tickFormatter={v => `${v}€`} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                    formatter={(value: number, name: string) => [`${value.toFixed(2)}€`, name === 'cumulative' ? 'Cumulé' : 'Période']}
                  />
                  <Area type="monotone" dataKey="cost" stroke="hsl(var(--primary))" fill="url(#spendGrad)" strokeWidth={1.5} name="Période" />
                  <Area type="monotone" dataKey="cumulative" stroke="hsl(var(--muted-foreground))" fill="none" strokeWidth={1} strokeDasharray="4 2" name="Cumulé" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={cc[mcrColor].border}>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">MCR</CardTitle>
            <TrendingUp className={`h-3.5 w-3.5 ${cc[mcrColor].text}`} />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className={`text-lg font-bold ${cc[mcrColor].text}`}>
              {mcr.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Coût / Revenu (30j)</p>
            {mcr > 25 && <p className={`text-[9px] font-semibold mt-1 ${cc[mcrColor].text}`}>⚠️ Seuil critique (&gt;25%)</p>}
            {mcr > 15 && mcr <= 25 && <p className={`text-[9px] font-semibold mt-1 ${cc[mcrColor].text}`}>⚡ Attention (&gt;15%)</p>}
          </CardContent>
        </Card>

        <Card className={cc[acpuColor].border}>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">ACPU</CardTitle>
            <Users className={`h-3.5 w-3.5 ${cc[acpuColor].text}`} />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className={`text-lg font-bold ${cc[acpuColor].text}`}>
              {acpu.toLocaleString('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}€
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">/ user actif ({activeUsersCount})</p>
            {acpu > 0.15 && <p className={`text-[9px] font-semibold mt-1 ${cc[acpuColor].text}`}>⚠️ Seuil critique (&gt;0,15€)</p>}
          </CardContent>
        </Card>

        <Card className={cc[acpuSubColor].border}>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">ACPU Pro</CardTitle>
            <CreditCard className={`h-3.5 w-3.5 ${cc[acpuSubColor].text}`} />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className={`text-lg font-bold ${cc[acpuSubColor].text}`}>
              {acpuSub.toLocaleString('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}€
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">/ abonné ({avgCostPerSubscriber?.count ?? 0})</p>
            {acpuSub > 0.30 && <p className={`text-[9px] font-semibold mt-1 ${cc[acpuSubColor].text}`}>⚠️ Seuil critique (&gt;0,30€)</p>}
          </CardContent>
        </Card>

        <Card className="border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Coût plateforme</CardTitle>
            <Flame className="h-3.5 w-3.5 text-primary" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold text-primary">
              {totalPlatformCost.toLocaleString('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}€
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">LLM + APIs + infra (30j)</p>
          </CardContent>
        </Card>
      </div>

      {/* API Quota Gauges */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            Quotas & Statuts API (depuis le lancement)
          </CardTitle>
          <CardDescription>Consommation par service — données réelles + estimations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Browserless */}
            <ApiQuotaGauge
              name="Browserless.io"
              icon={<Globe className="h-4 w-4" />}
              calls={tokenUsage.browserlessCalls}
              quota={1000}
              costPerCall={0.008}
              color="teal"
              status={tokenUsage.browserlessCalls >= 1000 ? 'exhausted' : tokenUsage.browserlessCalls >= 800 ? 'warning' : 'ok'}
              statusLabel={tokenUsage.browserlessCalls >= 1000 ? '⛔ Quota épuisé → Fly.io actif' : tokenUsage.browserlessCalls >= 800 ? '⚠️ Approche limite' : '✅ OK'}
            />

            {/* Fly.io Playwright */}
            <ApiQuotaGauge
              name="Fly.io Playwright"
              icon={<Server className="h-4 w-4" />}
              calls={tokenUsage.flyPlaywrightCalls}
              quota={null}
              costPerCall={0.0001}
              color="emerald"
              status={tokenUsage.flyPlaywrightCalls > 0 ? 'active' : 'standby'}
              statusLabel={tokenUsage.flyPlaywrightCalls > 0 ? `🔄 Fallback actif (${tokenUsage.flyPlaywrightCalls} rendus)` : '💤 Standby'}
              estimatedCost={tokenUsage.flyEstimatedCost}
            />

            {/* DataForSEO — with real balance */}
            <div className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  <span className="text-sm font-semibold">DataForSEO</span>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  dataforseoBalance?.balance != null && dataforseoBalance.balance < 5
                    ? 'bg-destructive/10 text-destructive'
                    : dataforseoBalance?.balance != null && dataforseoBalance.balance < 20
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                }`}>
                  {dataforseoBalance?.balance != null
                    ? dataforseoBalance.balance < 5
                      ? `⛔ Solde critique: $${dataforseoBalance.balance.toFixed(2)}`
                      : dataforseoBalance.balance < 20
                      ? `⚠️ Solde bas: $${dataforseoBalance.balance.toFixed(2)}`
                      : `✅ $${dataforseoBalance.balance.toFixed(2)}`
                    : '✅ Pay-as-you-go'}
                </span>
              </div>
              {dataforseoBalance?.balance != null && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Solde réel</span>
                    <span className="font-mono font-semibold text-foreground">${dataforseoBalance.balance.toFixed(2)}</span>
                  </div>
                  {dataforseoBalance.total_deposited != null && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Total déposé</span>
                      <span className="font-mono">${dataforseoBalance.total_deposited.toFixed(2)}</span>
                    </div>
                  )}
                  {dataforseoBalance.total_spent != null && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Total dépensé</span>
                      <span className="font-mono">${dataforseoBalance.total_spent.toFixed(2)}</span>
                    </div>
                  )}
                  {/* Usage bar */}
                  {dataforseoBalance.total_deposited != null && dataforseoBalance.total_deposited > 0 && (
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          dataforseoBalance.balance < 5 ? 'bg-destructive' : dataforseoBalance.balance < 20 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.max(2, (dataforseoBalance.balance / dataforseoBalance.total_deposited) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
                <span>{(allTimeTokenUsage?.dataforseoCalls ?? tokenUsage.dataforseoCalls).toLocaleString('fr-FR')} appels (total)</span>
                <span>Dépensé: ${(dataforseoBalance?.total_spent ?? 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Spider.cloud (Primary) */}
            <ApiQuotaGauge
              name="Spider.cloud"
              icon={<Globe className="h-4 w-4" />}
              calls={tokenUsage.spiderCalls}
              quota={null}
              costPerCall={0.001}
              color="emerald"
              status="ok"
              statusLabel={tokenUsage.spiderCalls > 0 ? `✅ Primaire actif` : '💤 Aucun appel'}
              estimatedCost={tokenUsage.spiderEstimatedCost}
            />

            {/* Firecrawl — with real credits */}
            <div className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4" />
                  <span className="text-sm font-semibold">Firecrawl (fallback)</span>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  apiBalances?.firecrawl?.remaining_credits != null && apiBalances.firecrawl.remaining_credits < 50
                    ? 'bg-destructive/10 text-destructive'
                    : apiBalances?.firecrawl?.remaining_credits != null && apiBalances.firecrawl.remaining_credits < 200
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                }`}>
                  {apiBalances?.firecrawl?.remaining_credits != null
                    ? apiBalances.firecrawl.remaining_credits < 50
                      ? `⛔ ${apiBalances.firecrawl.remaining_credits} crédits restants`
                      : apiBalances.firecrawl.remaining_credits < 200
                      ? `⚠️ ${apiBalances.firecrawl.remaining_credits} crédits`
                      : `✅ ${apiBalances.firecrawl.remaining_credits} crédits`
                    : apiBalances?.firecrawl?.error ? '❌ Erreur' : '✅ Fallback'}
                </span>
              </div>
              {apiBalances?.firecrawl?.remaining_credits != null && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Crédits restants</span>
                    <span className="font-mono font-semibold text-foreground">{apiBalances.firecrawl.remaining_credits.toLocaleString('fr-FR')}</span>
                  </div>
                  {apiBalances.firecrawl.total_credits != null && (
                    <>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Total crédits</span>
                        <span className="font-mono">{apiBalances.firecrawl.total_credits.toLocaleString('fr-FR')}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            apiBalances.firecrawl.remaining_credits < 50 ? 'bg-destructive' : apiBalances.firecrawl.remaining_credits < 200 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.max(2, (apiBalances.firecrawl.remaining_credits / apiBalances.firecrawl.total_credits) * 100)}%` }}
                        />
                      </div>
                    </>
                  )}
                  {apiBalances.firecrawl.plan && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Plan</span>
                      <span className="font-mono">{apiBalances.firecrawl.plan}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
                <span>{(allTimeTokenUsage?.firecrawlCalls ?? tokenUsage.firecrawlCalls).toLocaleString('fr-FR')} appels (total)</span>
                <span>{realFirecrawlUsed.toLocaleString('fr-FR')} crédits utilisés</span>
              </div>
            </div>

            {/* OpenRouter — with real usage */}
            <div className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  <span className="text-sm font-semibold">OpenRouter</span>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  apiBalances?.openrouter?.balance != null && apiBalances.openrouter.balance < 1
                    ? 'bg-destructive/10 text-destructive'
                    : apiBalances?.openrouter?.balance != null && apiBalances.openrouter.balance < 5
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                }`}>
                  {apiBalances?.openrouter?.balance != null
                    ? apiBalances.openrouter.balance < 1
                      ? `⛔ Solde critique: $${apiBalances.openrouter.balance.toFixed(2)}`
                      : apiBalances.openrouter.balance < 5
                      ? `⚠️ Solde bas: $${apiBalances.openrouter.balance.toFixed(2)}`
                      : `✅ $${apiBalances.openrouter.balance.toFixed(2)}`
                    : apiBalances?.openrouter?.usage != null
                    ? `✅ $${apiBalances.openrouter.usage.toFixed(2)} utilisé`
                    : '✅ Pay-as-you-go'}
                </span>
              </div>
              {apiBalances?.openrouter && !apiBalances.openrouter.error && (
                <div className="space-y-2">
                  {apiBalances.openrouter.usage != null && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Usage total</span>
                      <span className="font-mono font-semibold text-foreground">${apiBalances.openrouter.usage.toFixed(4)}</span>
                    </div>
                  )}
                  {apiBalances.openrouter.limit != null && (
                    <>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Limite</span>
                        <span className="font-mono">${apiBalances.openrouter.limit.toFixed(2)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            (apiBalances.openrouter.balance ?? 0) < 1 ? 'bg-destructive' : (apiBalances.openrouter.balance ?? 0) < 5 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.max(2, ((apiBalances.openrouter.balance ?? 0) / apiBalances.openrouter.limit) * 100)}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
                <span>{(allTimeTokenUsage?.openrouterCalls ?? tokenUsage.openrouterCalls).toLocaleString('fr-FR')} appels (total)</span>
                <span>Dépensé: ${(apiBalances?.openrouter?.usage ?? 0).toFixed(4)}</span>
              </div>
            </div>

            {/* SerpAPI — with real searches left */}
            <div className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  <span className="text-sm font-semibold">SerpAPI</span>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  apiBalances?.serpapi?.total_searches_left != null && apiBalances.serpapi.total_searches_left < 10
                    ? 'bg-destructive/10 text-destructive'
                    : apiBalances?.serpapi?.total_searches_left != null && apiBalances.serpapi.total_searches_left < 50
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                }`}>
                  {apiBalances?.serpapi?.total_searches_left != null
                    ? apiBalances.serpapi.total_searches_left < 10
                      ? `⛔ ${apiBalances.serpapi.total_searches_left} recherches restantes`
                      : apiBalances.serpapi.total_searches_left < 50
                      ? `⚠️ ${apiBalances.serpapi.total_searches_left} recherches`
                      : `✅ ${apiBalances.serpapi.total_searches_left} recherches restantes`
                    : apiBalances?.serpapi?.error ? '❌ Erreur' : '✅ Fallback SERP'}
                </span>
              </div>
              {apiBalances?.serpapi && !apiBalances.serpapi.error && (
                <div className="space-y-2">
                  {apiBalances.serpapi.searches_this_month != null && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Recherches ce mois</span>
                      <span className="font-mono font-semibold text-foreground">{apiBalances.serpapi.searches_this_month.toLocaleString('fr-FR')}</span>
                    </div>
                  )}
                  {apiBalances.serpapi.plan_searches_left != null && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Plan restant</span>
                      <span className="font-mono">{apiBalances.serpapi.plan_searches_left.toLocaleString('fr-FR')}</span>
                    </div>
                  )}
                  {apiBalances.serpapi.plan && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Plan</span>
                      <span className="font-mono">{apiBalances.serpapi.plan}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Google PageSpeed */}
            {(() => {
              const pagespeedCalls = tokenUsage.byApiService['google-pagespeed']?.calls || 0;
              return (
                <ApiQuotaGauge
                  name="Google PageSpeed"
                  icon={<Zap className="h-4 w-4" />}
                  calls={pagespeedCalls}
                  quota={25000}
                  costPerCall={0}
                  color="sky"
                  status={pagespeedCalls >= 25000 ? 'exhausted' : pagespeedCalls >= 20000 ? 'warning' : 'ok'}
                  statusLabel={pagespeedCalls >= 25000 ? '⛔ Limite quotidienne' : '✅ Gratuit (25k/jour)'}
                />
              );
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Token summary (lightweight) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Tokens totaux</CardTitle>
            <Cpu className="h-3.5 w-3.5 text-primary" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold">{tokenUsage.totalTokens.toLocaleString('fr-FR')}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{tokenUsage.callCount} appels IA</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Coût LLM</CardTitle>
            <Brain className="h-3.5 w-3.5 text-amber-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
              {tokenUsage.totalEstimatedCost.toLocaleString('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}€
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Estimation 30j</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Appels API payants</CardTitle>
            <Zap className="h-3.5 w-3.5 text-violet-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold">{tokenUsage.paidApiCalls.toLocaleString('fr-FR')}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Services externes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Fly.io Rendus</CardTitle>
            <Server className="h-3.5 w-3.5 text-emerald-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold">{tokenUsage.flyPlaywrightCalls.toLocaleString('fr-FR')}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">~{tokenUsage.flyEstimatedCost.toLocaleString('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}€</p>
          </CardContent>
        </Card>
      </div>

      {/* LLM Model Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            Consommation par modèle LLM (30j)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(() => {
            const models = Object.entries(tokenUsage.byModel)
              .sort(([, a], [, b]) => b.totalTokens - a.totalTokens);
            if (models.length === 0) return <p className="text-sm text-muted-foreground">Aucune donnée</p>;
            const maxTokens = Math.max(...models.map(([, m]) => m.totalTokens), 1);
            return models.map(([modelKey, data]) => {
              const label = MODEL_PRICING[modelKey]?.label || modelKey;
              const pct = (data.totalTokens / maxTokens) * 100;
              return (
                <div key={modelKey}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium truncate max-w-[40%]">{label}</span>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>{data.calls} appels</span>
                      <span className="font-mono">{data.totalTokens.toLocaleString('fr-FR')} tok</span>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        {data.estimatedCost.toLocaleString('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}€
                      </span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            });
          })()}
        </CardContent>
      </Card>
    </div>
  );
}

// ── API Quota Gauge Component ──────────────────────────────────────

interface ApiQuotaGaugeProps {
  name: string;
  icon: React.ReactNode;
  calls: number;
  quota: number | null; // null = pay-as-you-go / unlimited
  costPerCall: number;
  color: string;
  status: 'ok' | 'warning' | 'exhausted' | 'active' | 'standby';
  statusLabel: string;
  estimatedCost?: number;
}

function ApiQuotaGauge({ name, icon, calls, quota, costPerCall, color, status, statusLabel, estimatedCost }: ApiQuotaGaugeProps) {
  const percent = quota ? Math.min(100, (calls / quota) * 100) : null;
  const cost = estimatedCost ?? calls * costPerCall;

  const statusColors: Record<string, string> = {
    ok: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    exhausted: 'text-rose-600 dark:text-rose-400',
    active: 'text-blue-600 dark:text-blue-400',
    standby: 'text-muted-foreground',
  };

  const barColors: Record<string, string> = {
    ok: 'bg-emerald-500',
    warning: 'bg-amber-500',
    exhausted: 'bg-rose-500',
    active: 'bg-blue-500',
    standby: 'bg-muted-foreground/30',
  };

  const borderColors: Record<string, string> = {
    ok: 'border-border',
    warning: 'border-amber-500/30',
    exhausted: 'border-rose-500/30',
    active: 'border-blue-500/30',
    standby: 'border-border',
  };

  return (
    <div className={`p-4 rounded-lg border ${borderColors[status]} bg-card`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-sm font-semibold">{name}</span>
        </div>
        <Shield className={`h-3.5 w-3.5 ${statusColors[status]}`} />
      </div>

      <div className="text-2xl font-bold mb-1">
        {calls.toLocaleString('fr-FR')}
        {quota && (
          <span className="text-sm font-normal text-muted-foreground"> / {quota.toLocaleString('fr-FR')}</span>
        )}
      </div>

      {percent !== null && (
        <div className="mb-2">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColors[status]}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5 text-right">{percent.toFixed(1)}%</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-medium ${statusColors[status]}`}>{statusLabel}</span>
        {cost > 0 && (
          <span className="text-[10px] text-muted-foreground">
            ~{cost.toLocaleString('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}€
          </span>
        )}
      </div>
    </div>
  );
}
