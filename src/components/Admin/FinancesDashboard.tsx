import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
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
} from 'lucide-react';
import { subDays } from 'date-fns';

// IPs et user_ids à exclure des statistiques
const EXCLUDED_IPS = ['5.49.156.158'];
const ADMIN_EMAIL = 'adriendemerville@gmail.com';

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
  flyPlaywrightCalls: number;
  flyEstimatedCost: number;
  byApiService: Record<string, { calls: number; byEndpoint: Record<string, number> }>;
}

export function FinancesDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [businessMetrics, setBusinessMetrics] = useState({ payingSubscribers: 0, creditsPurchased: 0, mrr: 0 });
  const [totalPlatformCost, setTotalPlatformCost] = useState(0);
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const [avgCostPerSubscriber, setAvgCostPerSubscriber] = useState<{ avg: number; count: number } | null>(null);
  const [dbSize, setDbSize] = useState<{ total_mb: number; total_gb: number } | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsageStats>({
    totalTokens: 0, promptTokens: 0, completionTokens: 0, callCount: 0,
    byFunction: {}, byModel: {},
    paidApiCalls: 0, totalEstimatedCost: 0,
    dataforseoCalls: 0, openrouterCalls: 0, browserlessCalls: 0, firecrawlCalls: 0,
    flyPlaywrightCalls: 0, flyEstimatedCost: 0, byApiService: {},
  });

  const fetchData = useCallback(async (silent = false) => {
    if (silent) setIsRefreshing(true); else setIsLoading(true);

    try {
      const { data: adminProfiles } = await supabase
        .from('profiles').select('user_id').eq('email', ADMIN_EMAIL);
      const adminUserIds = adminProfiles?.map(p => p.user_id) || [];

      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

      // Paginated events fetch
      let allEvents: Array<{ event_type: string; url: string | null; created_at: string; user_id: string | null; event_data: Record<string, unknown> | null }> = [];
      const PAGE_SIZE = 1000;
      let currentPage = 0;
      while (true) {
        const { data: rawPage, error: pageError } = await supabase
          .from('analytics_events')
          .select('event_type, url, created_at, user_id, event_data')
          .gte('created_at', thirtyDaysAgo)
          .order('created_at', { ascending: false })
          .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);
        if (pageError) throw pageError;
        if (!rawPage || rawPage.length === 0) break;
        allEvents = allEvents.concat(rawPage as typeof allEvents);
        if (rawPage.length < PAGE_SIZE) break;
        currentPage++;
      }

      const events = allEvents.filter(e => {
        if (e.user_id && adminUserIds.includes(e.user_id)) return false;
        const eventData = e.event_data as Record<string, unknown> | null;
        if (eventData?.ip && EXCLUDED_IPS.includes(eventData.ip as string)) return false;
        return true;
      });

      // Token usage
      const tokenEvents = allEvents.filter(e => e.event_type === 'ai_token_usage');
      const paidApiEvents = allEvents.filter(e => e.event_type === 'paid_api_call');

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
      let dataforseoCalls = 0, openrouterCalls = 0, browserlessCalls = 0, firecrawlCalls = 0, flyPlaywrightCalls = 0;
      let totalPaidApiCost = 0;

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
        if (service === 'fly-playwright') flyPlaywrightCalls++;
        totalPaidApiCost += API_COST_ESTIMATES[service] || 0.005;
      });

      const FLY_COST_PER_RENDER_EUR = 0.00000246 * 40 * 0.92;
      const flyEstimatedCost = flyPlaywrightCalls * FLY_COST_PER_RENDER_EUR;
      const grandTotalCost = totalEstimatedCost + flyEstimatedCost + totalPaidApiCost;
      setTotalPlatformCost(grandTotalCost);

      setTokenUsage({
        totalTokens, promptTokens, completionTokens,
        callCount: tokenEvents.length, byFunction, byModel,
        paidApiCalls: paidApiEvents.length, totalEstimatedCost,
        dataforseoCalls, openrouterCalls, browserlessCalls, firecrawlCalls,
        flyPlaywrightCalls, flyEstimatedCost, byApiService,
      });

      // Active users
      const activeUserIds = new Set<string>();
      events.forEach(e => { if (e.user_id) activeUserIds.add(e.user_id); });
      setActiveUsersCount(activeUserIds.size);

      // Business metrics
      const { data: payingProfiles } = await supabase
        .from('profiles').select('user_id')
        .eq('plan_type', 'agency_pro').eq('subscription_status', 'active')
        .not('stripe_subscription_id', 'is', null);
      const payingCount = payingProfiles?.length || 0;
      const { data: purchaseTx } = await supabase
        .from('credit_transactions').select('amount').eq('transaction_type', 'purchase');
      const creditsPurchased = (purchaseTx || []).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      const mrr = payingCount * 59;
      setBusinessMetrics({ payingSubscribers: payingCount, creditsPurchased, mrr });

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

      // DB size
      try {
        const { data: sizeData } = await supabase.rpc('get_database_size' as any);
        if (sizeData) setDbSize(sizeData as any);
      } catch {}

    } catch (err) {
      console.error('FinancesDashboard fetch error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Finances & Coûts</h2>
          <p className="text-xs text-muted-foreground">Indicateurs financiers et consommation API (30 derniers jours)</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData(true)} disabled={isRefreshing} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

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
            <p className="text-[10px] text-muted-foreground mt-0.5">{businessMetrics.payingSubscribers} × 59 €/mois</p>
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

      {/* MCR + ACPU Row */}
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
            Quotas & Statuts API (30j)
          </CardTitle>
          <CardDescription>Consommation par service avec estimation des limites de plan</CardDescription>
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

            {/* DataForSEO */}
            <ApiQuotaGauge
              name="DataForSEO"
              icon={<Search className="h-4 w-4" />}
              calls={tokenUsage.dataforseoCalls}
              quota={null}
              costPerCall={0.01}
              color="blue"
              status="ok"
              statusLabel="✅ Pay-as-you-go"
            />

            {/* Firecrawl */}
            <ApiQuotaGauge
              name="Firecrawl"
              icon={<Flame className="h-4 w-4" />}
              calls={tokenUsage.firecrawlCalls}
              quota={500}
              costPerCall={0.005}
              color="orange"
              status={tokenUsage.firecrawlCalls >= 500 ? 'exhausted' : tokenUsage.firecrawlCalls >= 400 ? 'warning' : 'ok'}
              statusLabel={tokenUsage.firecrawlCalls >= 500 ? '⛔ Quota mensuel atteint' : tokenUsage.firecrawlCalls >= 400 ? '⚠️ 80%+ utilisé' : '✅ OK'}
            />

            {/* OpenRouter */}
            <ApiQuotaGauge
              name="OpenRouter"
              icon={<Brain className="h-4 w-4" />}
              calls={tokenUsage.openrouterCalls}
              quota={null}
              costPerCall={0}
              color="violet"
              status="ok"
              statusLabel="✅ Pay-as-you-go"
            />

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

      {/* Token Usage Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Cpu className="h-4 w-4 text-primary" />
                Consommation Tokens IA (30j)
              </CardTitle>
              <CardDescription>Tokens envoyés vers les services IA payants</CardDescription>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-primary">
                {tokenUsage.totalTokens.toLocaleString('fr-FR')}
              </div>
              <div className="flex items-center gap-2 justify-end">
                <p className="text-xs text-muted-foreground">{tokenUsage.callCount} appels IA</p>
                {tokenUsage.totalEstimatedCost > 0 && (
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                    ~{tokenUsage.totalEstimatedCost.toLocaleString('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}€
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Tokens input</p>
              <p className="text-lg font-semibold">{tokenUsage.promptTokens.toLocaleString('fr-FR')}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Tokens output</p>
              <p className="text-lg font-semibold">{tokenUsage.completionTokens.toLocaleString('fr-FR')}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Zap className="h-3 w-3" /> Appels API payants
              </p>
              <p className="text-lg font-semibold">{tokenUsage.paidApiCalls.toLocaleString('fr-FR')}</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Coût estimé LLM</p>
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                {tokenUsage.totalEstimatedCost.toLocaleString('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}€
              </p>
            </div>
          </div>

          {/* Per-API-service breakdown */}
          {Object.keys(tokenUsage.byApiService).length > 0 && (
            <div className="space-y-2 mb-4">
              <p className="text-xs font-medium text-muted-foreground">Détail par service API externe</p>
              {Object.entries(tokenUsage.byApiService)
                .sort(([, a], [, b]) => b.calls - a.calls)
                .map(([service, data]) => (
                  <div key={service} className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold capitalize">{service}</span>
                      <span className="text-xs font-medium text-muted-foreground">{data.calls} appels</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(data.byEndpoint).sort(([, a], [, b]) => b - a).slice(0, 5).map(([endpoint, count]) => (
                        <span key={endpoint} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {endpoint.split('/').pop()} ×{count}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Per-model breakdown */}
          {Object.keys(tokenUsage.byModel).length > 0 && (
            <div className="space-y-2 mb-4">
              <p className="text-xs font-medium text-muted-foreground">Détail par modèle</p>
              {Object.entries(tokenUsage.byModel)
                .sort(([, a], [, b]) => b.estimatedCost - a.estimatedCost)
                .map(([model, data]) => {
                  const pricing = MODEL_PRICING[model];
                  const label = pricing?.label || model;
                  const costPercent = tokenUsage.totalEstimatedCost > 0
                    ? (data.estimatedCost / tokenUsage.totalEstimatedCost * 100)
                    : 0;
                  return (
                    <div key={model} className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{label}</span>
                          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{model}</span>
                        </div>
                        <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                          {data.estimatedCost.toLocaleString('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}€
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{data.calls} appels</span>
                        <span>↑ {data.promptTokens.toLocaleString('fr-FR')} in</span>
                        <span>↓ {data.completionTokens.toLocaleString('fr-FR')} out</span>
                        <span className="ml-auto font-medium">{costPercent.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% du coût</span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-amber-500/70 transition-all" style={{ width: `${Math.min(100, costPercent)}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Per-function breakdown */}
          {Object.keys(tokenUsage.byFunction).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Détail par fonction</p>
              {Object.entries(tokenUsage.byFunction)
                .sort(([, a], [, b]) => b.tokens - a.tokens)
                .map(([fn, data]) => (
                  <div key={fn} className="flex items-center justify-between p-2 rounded bg-muted/30">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono">{fn}</span>
                      {data.model && data.model !== 'unknown' && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded">
                          {MODEL_PRICING[data.model]?.label || data.model}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">{data.calls} appels</span>
                      <span className="font-semibold text-primary">{data.tokens.toLocaleString('fr-FR')} tokens</span>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {tokenUsage.callCount === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune donnée de consommation IA enregistrée sur cette période.
            </p>
          )}
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
