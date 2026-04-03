import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity, Bot, Globe, TrendingUp, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface BotLogAnalysisCardProps {
  trackedSiteId: string;
  domain: string;
  simulatedDataEnabled?: boolean;
}

const translations = {
  fr: {
    title: 'Analyse Logs Bots',
    totalRequests: 'Total requêtes',
    activeBots: 'Bots actifs',
    topBot: 'Top bot',
    aiCrawlersPct: '% Crawlers IA',
    chartTitle: 'Activité par catégorie de bot',
    searchEngines: 'Moteurs de recherche',
    aiBots: 'Bots IA',
    seoTools: 'Outils SEO',
    socialBots: 'Réseaux sociaux',
    refresh: 'Actualiser',
    simulated: 'Données simulées',
    days7: '7 jours',
    days14: '14 jours',
    days28: '28 jours',
    req: 'req.',
  },
  en: {
    title: 'Bot Log Analysis',
    totalRequests: 'Total requests',
    activeBots: 'Active bots',
    topBot: 'Top bot',
    aiCrawlersPct: '% AI Crawlers',
    chartTitle: 'Activity by bot category',
    searchEngines: 'Search engines',
    aiBots: 'AI Bots',
    seoTools: 'SEO Tools',
    socialBots: 'Social networks',
    refresh: 'Refresh',
    simulated: 'Simulated data',
    days7: '7 days',
    days14: '14 days',
    days28: '28 days',
    req: 'req.',
  },
  es: {
    title: 'Análisis de Logs Bots',
    totalRequests: 'Total solicitudes',
    activeBots: 'Bots activos',
    topBot: 'Top bot',
    aiCrawlersPct: '% Crawlers IA',
    chartTitle: 'Actividad por categoría de bot',
    searchEngines: 'Motores de búsqueda',
    aiBots: 'Bots IA',
    seoTools: 'Herramientas SEO',
    socialBots: 'Redes sociales',
    refresh: 'Actualizar',
    simulated: 'Datos simulados',
    days7: '7 días',
    days14: '14 días',
    days28: '28 días',
    req: 'sol.',
  },
};

function generateSimulatedData(days: number) {
  const data = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dayOfWeek = date.getDay();
    const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.6 : 1;
    const variance = () => 0.7 + Math.random() * 0.6;

    data.push({
      date: `${date.getDate()}/${date.getMonth() + 1}`,
      searchEngines: Math.round(35000 * weekendFactor * variance()),
      aiBots: Math.round(22000 * weekendFactor * variance()),
      seoTools: Math.round(12000 * weekendFactor * variance()),
      socialBots: Math.round(3000 * weekendFactor * variance()),
    });
  }
  return data;
}

export function BotLogAnalysisCard({ trackedSiteId, domain, simulatedDataEnabled = true }: BotLogAnalysisCardProps) {
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.fr;
  const [period, setPeriod] = useState('28');

  const chartData = useMemo(() => simulatedDataEnabled ? generateSimulatedData(parseInt(period)) : [], [period, simulatedDataEnabled]);

  if (!simulatedDataEnabled) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold text-muted-foreground">{t.title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {language === 'fr' ? 'Connectez vos logs serveur pour visualiser l\'activité des bots.' : 'Connect your server logs to visualize bot activity.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const totals = useMemo(() => {
    const sums = chartData.reduce(
      (acc, d) => ({
        searchEngines: acc.searchEngines + d.searchEngines,
        aiBots: acc.aiBots + d.aiBots,
        seoTools: acc.seoTools + d.seoTools,
        socialBots: acc.socialBots + d.socialBots,
      }),
      { searchEngines: 0, aiBots: 0, seoTools: 0, socialBots: 0 }
    );
    const total = sums.searchEngines + sums.aiBots + sums.seoTools + sums.socialBots;
    const aiPct = total > 0 ? Math.round((sums.aiBots / total) * 100) : 0;

    // Find top bot
    const bots = [
      { name: 'Googlebot', count: Math.round(sums.searchEngines * 0.65) },
      { name: 'Bytespider', count: Math.round(sums.aiBots * 0.55) },
      { name: 'GPTBot', count: Math.round(sums.aiBots * 0.25) },
      { name: 'AhrefsBot', count: Math.round(sums.seoTools * 0.4) },
      { name: 'Bingbot', count: Math.round(sums.searchEngines * 0.2) },
    ];
    const topBot = bots.sort((a, b) => b.count - a.count)[0];

    return {
      total,
      activeBots: 26,
      topBot,
      aiPct,
    };
  }, [chartData]);

  const kpis = [
    { label: t.totalRequests, value: totals.total.toLocaleString(), icon: Activity },
    { label: t.activeBots, value: String(totals.activeBots), icon: Bot },
    { label: t.topBot, value: totals.topBot.name, sub: `${totals.topBot.count.toLocaleString()} ${t.req}`, icon: Globe },
    { label: t.aiCrawlersPct, value: `${totals.aiPct}%`, icon: TrendingUp },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">{t.title}</CardTitle>
            <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/30 text-amber-600">
              {t.simulated}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-8 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">{t.days7}</SelectItem>
                <SelectItem value="14">{t.days14}</SelectItem>
                <SelectItem value="28">{t.days28}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <RefreshCw className="h-3 w-3" />
              {t.refresh}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-3">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-lg border bg-card p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</span>
                <kpi.icon className="h-4 w-4 text-muted-foreground/50" />
              </div>
              <p className="text-xl font-bold text-foreground">{kpi.value}</p>
              {kpi.sub && <p className="text-xs text-muted-foreground">{kpi.sub}</p>}
            </div>
          ))}
        </div>

        {/* Area Chart */}
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-medium text-foreground mb-3">{t.chartTitle}</p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="botSearch" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="botAI" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="botSEO" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="botSocial" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis className="text-xs" tick={{ fontSize: 10 }} tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    fontSize: '12px',
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                  }}
                  formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                />
                <Legend />
                <Area type="monotone" dataKey="searchEngines" name={t.searchEngines} stackId="1" stroke="hsl(217, 91%, 60%)" fill="url(#botSearch)" strokeWidth={2} />
                <Area type="monotone" dataKey="aiBots" name={t.aiBots} stackId="1" stroke="hsl(262, 83%, 58%)" fill="url(#botAI)" strokeWidth={2} />
                <Area type="monotone" dataKey="seoTools" name={t.seoTools} stackId="1" stroke="hsl(38, 92%, 50%)" fill="url(#botSEO)" strokeWidth={2} />
                <Area type="monotone" dataKey="socialBots" name={t.socialBots} stackId="1" stroke="hsl(142, 76%, 36%)" fill="url(#botSocial)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
