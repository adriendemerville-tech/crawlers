import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAnalytics } from '@/contexts/AdminAnalyticsContext';
import { subDays, format, startOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

// Coûts estimés par million de tokens (input/output) en USD
export const MODEL_PRICING: Record<string, { input: number; output: number; label: string }> = {
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

export function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING[model] || { input: 0.50, output: 1.50 };
  const usd = (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;
  return usd * 0.92;
}

export interface TokenUsageStats {
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
  imageApiCalls: number;
  imageApiCostEur: number;
  imageByProvider: Record<string, number>;
}

export interface BusinessMetrics {
  payingSubscribers: number;
  creditsPurchased: number;
  mrr: number;
  bundleMrr: number;
}

export interface ApiBalances {
  serpapi?: { plan?: string; searches_this_month?: number; total_searches_left?: number; plan_searches_left?: number; error?: string };
  openrouter?: { usage?: number; limit?: number; balance?: number; is_free_tier?: boolean; error?: string };
  firecrawl?: { remaining_credits?: number; total_credits?: number; plan?: string; error?: string };
}

export interface BrowserlessMetrics {
  units: number; unitsRemaining: number; planUnitsPerMonth: number;
  running: number; concurrencyLimit: number; maxConcurrent: number;
  successful: number; error: number; timedout: number; rejected: number;
}

export interface DataforseoBalance {
  balance: number | null;
  total_deposited: number | null;
  total_spent: number | null;
  fetched_at: string | null;
}

type AnalyticsEvent = { event_type: string; url: string | null; created_at: string; user_id: string | null; event_data: Record<string, unknown> | null };

const EMPTY_TOKEN_STATS: TokenUsageStats = {
  totalTokens: 0, promptTokens: 0, completionTokens: 0, callCount: 0,
  byFunction: {}, byModel: {},
  paidApiCalls: 0, totalEstimatedCost: 0,
  dataforseoCalls: 0, openrouterCalls: 0, browserlessCalls: 0, firecrawlCalls: 0,
  spiderCalls: 0, spiderEstimatedCost: 0,
  flyPlaywrightCalls: 0, flyEstimatedCost: 0, byApiService: {},
  imageApiCalls: 0, imageApiCostEur: 0, imageByProvider: {},
};

function computeTokenStats(tokenEvents: AnalyticsEvent[], paidApiEvents: AnalyticsEvent[]): TokenUsageStats {
  const byFunction: Record<string, { tokens: number; calls: number; model?: string }> = {};
  const byModel: Record<string, { promptTokens: number; completionTokens: number; totalTokens: number; calls: number; estimatedCost: number }> = {};
  let totalTokens = 0, promptTokens = 0, completionTokens = 0, totalEstimatedCost = 0;

  tokenEvents.forEach(e => {
    const data = e.event_data;
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
    const data = e.event_data;
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

  const IMAGE_COST_USD: Record<string, number> = { imagen3: 0, flux: 0.04, ideogram: 0.08 };
  let imageApiCalls = 0;
  let imageApiCostUsd = 0;
  const imageByProvider: Record<string, number> = {};
  tokenEvents.forEach(e => {
    const data = e.event_data;
    if (!data) return;
    const fn = (data.function_name as string) || '';
    if (fn === 'generate-image') {
      const provider = (data.model as string) || 'unknown';
      imageApiCalls++;
      imageByProvider[provider] = (imageByProvider[provider] || 0) + 1;
      imageApiCostUsd += IMAGE_COST_USD[provider] || 0;
    }
  });

  return {
    totalTokens, promptTokens, completionTokens,
    callCount: tokenEvents.length, byFunction, byModel,
    paidApiCalls: paidApiEvents.length, totalEstimatedCost,
    dataforseoCalls, openrouterCalls, browserlessCalls, firecrawlCalls,
    spiderCalls, spiderEstimatedCost,
    flyPlaywrightCalls, flyEstimatedCost, byApiService,
    imageApiCalls, imageApiCostEur: imageApiCostUsd * 0.92, imageByProvider,
  };
}

export function useFinancesData() {
  const { allEvents: sharedAllEvents, filteredEvents: sharedFilteredEvents, isLoading: sharedLoading, fetchEvents } = useAdminAnalytics();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [businessMetrics, setBusinessMetrics] = useState<BusinessMetrics>({ payingSubscribers: 0, creditsPurchased: 0, mrr: 0, bundleMrr: 0 });
  const [totalPlatformCost, setTotalPlatformCost] = useState(0);
  const [allTimePlatformCost, setAllTimePlatformCost] = useState(0);
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const [avgCostPerSubscriber, setAvgCostPerSubscriber] = useState<{ avg: number; count: number } | null>(null);
  const [dbSize, setDbSize] = useState<{ total_mb: number; total_gb: number } | null>(null);
  const [dataforseoBalance, setDataforseoBalance] = useState<DataforseoBalance | null>(null);
  const [apiBalances, setApiBalances] = useState<ApiBalances | null>(null);
  const [browserlessMetrics, setBrowserlessMetrics] = useState<BrowserlessMetrics | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsageStats>(EMPTY_TOKEN_STATS);
  const [allTimeTokenUsage, setAllTimeTokenUsage] = useState<TokenUsageStats | null>(null);
  const [allTimeRawEvents, setAllTimeRawEvents] = useState<{ created_at: string; cost: number }[]>([]);
  const [spendingChartOpen, setSpendingChartOpen] = useState(false);
  const [spendingScale, setSpendingScale] = useState<'day' | 'week' | 'month'>('week');

  const fetchEventsByType = useCallback(async (eventType: string, sinceDate?: string) => {
    const PAGE_SIZE = 1000;
    const MAX_PAGES = 20;
    let all: AnalyticsEvent[] = [];
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
      all = all.concat(data as AnalyticsEvent[]);
      if (data.length < PAGE_SIZE) break;
      page++;
    }
    return all;
  }, []);

  const fetchFinancialEvents = useCallback(async () => {
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
    const [tokenEvents30d, paidApiEvents30d, tokenEventsAll, paidApiEventsAll] = await Promise.all([
      fetchEventsByType('ai_token_usage', thirtyDaysAgo),
      fetchEventsByType('paid_api_call', thirtyDaysAgo),
      fetchEventsByType('ai_token_usage'),
      fetchEventsByType('paid_api_call'),
    ]);
    return { tokenEvents: tokenEvents30d, paidApiEvents: paidApiEvents30d, tokenEventsAll, paidApiEventsAll };
  }, [fetchEventsByType]);

  useEffect(() => { fetchEvents(); }, []);

  useEffect(() => {
    if (sharedAllEvents.length === 0 && sharedLoading) return;
    processData(sharedAllEvents, sharedFilteredEvents);
  }, [sharedAllEvents, sharedLoading]);

  const processData = useCallback(async (allEvents: typeof sharedAllEvents, events: typeof sharedFilteredEvents) => {
    setIsLoading(true);
    try {
      const { tokenEvents, paidApiEvents, tokenEventsAll, paidApiEventsAll } = await fetchFinancialEvents();

      const stats30d = computeTokenStats(tokenEvents as AnalyticsEvent[], paidApiEvents as AnalyticsEvent[]);
      const totalPaidApiCost30d = paidApiEvents.length * 0.005;
      setTotalPlatformCost(stats30d.totalEstimatedCost + stats30d.flyEstimatedCost + stats30d.spiderEstimatedCost + totalPaidApiCost30d);
      setTokenUsage(stats30d);

      const statsAll = computeTokenStats(tokenEventsAll as AnalyticsEvent[], paidApiEventsAll as AnalyticsEvent[]);
      const totalPaidApiCostAll = paidApiEventsAll.length * 0.005;
      setAllTimePlatformCost(statsAll.totalEstimatedCost + statsAll.flyEstimatedCost + statsAll.spiderEstimatedCost + totalPaidApiCostAll);
      setAllTimeTokenUsage(statsAll);

      const rawCosts: { created_at: string; cost: number }[] = [];
      (tokenEventsAll as AnalyticsEvent[]).forEach(e => {
        const data = e.event_data;
        if (!data) return;
        const model = (data.model as string) || 'unknown';
        const p = Number(data.prompt_tokens) || 0;
        const c = Number(data.completion_tokens) || 0;
        rawCosts.push({ created_at: e.created_at, cost: estimateCost(model, p, c) });
      });
      paidApiEventsAll.forEach(e => { rawCosts.push({ created_at: e.created_at, cost: 0.005 }); });
      setAllTimeRawEvents(rawCosts);

      const activeUserIds = new Set<string>();
      events.forEach(e => { if (e.user_id) activeUserIds.add(e.user_id); });
      setActiveUsersCount(activeUserIds.size);

      const [payingRes, purchaseRes, bundleRes] = await Promise.all([
        supabase.from('profiles').select('user_id').eq('plan_type', 'agency_pro').eq('subscription_status', 'active').not('stripe_subscription_id', 'is', null),
        supabase.from('credit_transactions').select('amount').eq('transaction_type', 'purchase'),
        supabase.from('bundle_subscriptions').select('monthly_price_cents').eq('status', 'active'),
      ]);
      const payingProfiles = payingRes.data;
      const payingCount = payingProfiles?.length || 0;
      const creditsPurchased = (purchaseRes.data || []).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      const bundleMrr = (bundleRes.data || []).reduce((sum: number, s: { monthly_price_cents: number }) => sum + ((s.monthly_price_cents || 0) / 100), 0);
      setBusinessMetrics({ payingSubscribers: payingCount, creditsPurchased, mrr: payingCount * 59 + bundleMrr, bundleMrr });

      if (payingProfiles && payingProfiles.length > 0) {
        const payingUserIds = new Set(payingProfiles.map(p => p.user_id));
        const costPerUser: Record<string, number> = {};
        (tokenEvents as AnalyticsEvent[]).forEach(e => {
          const data = e.event_data;
          if (data && e.user_id && payingUserIds.has(e.user_id)) {
            const p = Number(data.prompt_tokens) || 0;
            const c = Number(data.completion_tokens) || 0;
            const model = (data.model as string) || 'unknown';
            costPerUser[e.user_id] = (costPerUser[e.user_id] || 0) + estimateCost(model, p, c);
          }
        });
        (paidApiEvents as AnalyticsEvent[]).forEach(e => {
          const data = e.event_data;
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

      try {
        const [balanceRes, apiBalancesRes, browserlessRes] = await Promise.all([
          supabase.functions.invoke('dataforseo-balance'),
          supabase.functions.invoke('api-balances'),
          supabase.functions.invoke('browserless-metrics'),
        ]);
        try {
          const sizeRes = await (supabase.rpc as Function)('get_database_size');
          if (sizeRes.data) setDbSize(sizeRes.data as unknown as { total_mb: number; total_gb: number });
        } catch { /* ignore */ }
        if (balanceRes.data && !balanceRes.error) setDataforseoBalance(balanceRes.data as DataforseoBalance);
        if (apiBalancesRes.data && !apiBalancesRes.error) setApiBalances(apiBalancesRes.data as ApiBalances);
        if (browserlessRes.data && !browserlessRes.error) setBrowserlessMetrics(browserlessRes.data as BrowserlessMetrics);
      } catch { /* non-critical */ }
    } catch (err) {
      console.error('FinancesDashboard fetch error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchFinancialEvents]);

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

  // Derived computed values
  const mcr = businessMetrics.mrr > 0 ? (totalPlatformCost / businessMetrics.mrr) * 100 : 0;
  const acpu = activeUsersCount > 0 ? totalPlatformCost / activeUsersCount : 0;
  const acpuSub = avgCostPerSubscriber?.avg ?? 0;

  const realDataforseoSpent = dataforseoBalance?.total_spent ?? 0;
  const realOpenrouterSpent = apiBalances?.openrouter?.usage ?? 0;
  const grandTotalSinceLaunchUSD = realDataforseoSpent + realOpenrouterSpent;
  const grandTotalSinceLaunchEUR = grandTotalSinceLaunchUSD * 0.92 + allTimePlatformCost;

  return {
    isLoading, isRefreshing, fetchEvents,
    businessMetrics, totalPlatformCost, allTimePlatformCost,
    activeUsersCount, avgCostPerSubscriber,
    dbSize, dataforseoBalance, apiBalances, browserlessMetrics,
    tokenUsage, allTimeTokenUsage,
    spendingChartOpen, setSpendingChartOpen,
    spendingScale, setSpendingScale,
    spendingChartData,
    mcr, acpu, acpuSub,
    grandTotalSinceLaunchEUR, grandTotalSinceLaunchUSD,
  };
}
