import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity, Bot, Globe, TrendingUp, CalendarIcon } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface BotLogChartCardProps {
  domain?: string;
}

const translations = {
  fr: {
    title: 'Logs Bots — GPT & Gemini',
    totalRequests: 'Total requêtes',
    gptRequests: 'GPTBot',
    geminiRequests: 'Google-Extended',
    aiShare: '% IA / Total',
    chartTitle: 'Activité des bots IA vs Moteurs de recherche',
    searchEngines: 'Moteurs de recherche',
    gptBot: 'GPTBot / ChatGPT-User',
    geminiBot: 'Google-Extended (Gemini)',
    seoTools: 'Outils SEO',
    socialBots: 'Réseaux sociaux',
    simulated: 'Données simulées',
    interval: 'Intervalle',
    day: 'Jour',
    week: 'Semaine',
    month: 'Mois',
    from: 'Du',
    to: 'Au',
    req: 'req.',
  },
  en: {
    title: 'Bot Logs — GPT & Gemini',
    totalRequests: 'Total requests',
    gptRequests: 'GPTBot',
    geminiRequests: 'Google-Extended',
    aiShare: '% AI / Total',
    chartTitle: 'AI bot activity vs Search engines',
    searchEngines: 'Search engines',
    gptBot: 'GPTBot / ChatGPT-User',
    geminiBot: 'Google-Extended (Gemini)',
    seoTools: 'SEO Tools',
    socialBots: 'Social networks',
    simulated: 'Simulated data',
    interval: 'Interval',
    day: 'Day',
    week: 'Week',
    month: 'Month',
    from: 'From',
    to: 'To',
    req: 'req.',
  },
  es: {
    title: 'Logs Bots — GPT & Gemini',
    totalRequests: 'Total solicitudes',
    gptRequests: 'GPTBot',
    geminiRequests: 'Google-Extended',
    aiShare: '% IA / Total',
    chartTitle: 'Actividad bots IA vs Motores de búsqueda',
    searchEngines: 'Motores de búsqueda',
    gptBot: 'GPTBot / ChatGPT-User',
    geminiBot: 'Google-Extended (Gemini)',
    seoTools: 'Herramientas SEO',
    socialBots: 'Redes sociales',
    simulated: 'Datos simulados',
    interval: 'Intervalo',
    day: 'Día',
    week: 'Semana',
    month: 'Mes',
    from: 'Desde',
    to: 'Hasta',
    req: 'sol.',
  },
};

type Interval = 'day' | 'week' | 'month';

function generateSimulatedData(startDate: Date, endDate: Date, interval: Interval) {
  const data: Array<{
    date: string;
    searchEngines: number;
    gptBot: number;
    geminiBot: number;
    seoTools: number;
    socialBots: number;
  }> = [];

  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.6 : 1;
    const variance = () => 0.7 + Math.random() * 0.6;

    let label: string;
    let multiplier = 1;

    if (interval === 'day') {
      label = `${current.getDate()}/${current.getMonth() + 1}`;
    } else if (interval === 'week') {
      label = `S${Math.ceil(current.getDate() / 7)} ${current.getMonth() + 1}/${String(current.getFullYear()).slice(2)}`;
      multiplier = 7;
    } else {
      label = `${current.getMonth() + 1}/${current.getFullYear()}`;
      multiplier = 30;
    }

    data.push({
      date: label,
      searchEngines: Math.round(5000 * multiplier * weekendFactor * variance()),
      gptBot: Math.round(3200 * multiplier * weekendFactor * variance()),
      geminiBot: Math.round(2800 * multiplier * weekendFactor * variance()),
      seoTools: Math.round(1500 * multiplier * weekendFactor * variance()),
      socialBots: Math.round(400 * multiplier * weekendFactor * variance()),
    });

    if (interval === 'day') {
      current.setDate(current.getDate() + 1);
    } else if (interval === 'week') {
      current.setDate(current.getDate() + 7);
    } else {
      current.setMonth(current.getMonth() + 1);
    }
  }

  return data;
}

export function BotLogChartCard({ domain }: BotLogChartCardProps) {
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.fr;

  const defaultEnd = new Date();
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - 28);

  const [startDate, setStartDate] = useState<Date>(defaultStart);
  const [endDate, setEndDate] = useState<Date>(defaultEnd);
  const [interval, setInterval] = useState<Interval>('day');

  const chartData = useMemo(
    () => generateSimulatedData(startDate, endDate, interval),
    [startDate, endDate, interval]
  );

  const totals = useMemo(() => {
    const sums = chartData.reduce(
      (acc, d) => ({
        searchEngines: acc.searchEngines + d.searchEngines,
        gptBot: acc.gptBot + d.gptBot,
        geminiBot: acc.geminiBot + d.geminiBot,
        seoTools: acc.seoTools + d.seoTools,
        socialBots: acc.socialBots + d.socialBots,
      }),
      { searchEngines: 0, gptBot: 0, geminiBot: 0, seoTools: 0, socialBots: 0 }
    );
    const total = sums.searchEngines + sums.gptBot + sums.geminiBot + sums.seoTools + sums.socialBots;
    const aiTotal = sums.gptBot + sums.geminiBot;
    const aiPct = total > 0 ? Math.round((aiTotal / total) * 100) : 0;
    return { total, gptBot: sums.gptBot, geminiBot: sums.geminiBot, aiPct };
  }, [chartData]);

  const kpis = [
    { label: t.totalRequests, value: totals.total.toLocaleString(), icon: Activity },
    { label: t.gptRequests, value: totals.gptBot.toLocaleString(), icon: Bot },
    { label: t.geminiRequests, value: totals.geminiBot.toLocaleString(), icon: Globe },
    { label: t.aiShare, value: `${totals.aiPct}%`, icon: TrendingUp },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">{t.title}</CardTitle>
            <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/30 text-amber-600">
              {t.simulated}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Interval selector */}
            <Select value={interval} onValueChange={(v) => setInterval(v as Interval)}>
              <SelectTrigger className="h-8 w-[100px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">{t.day}</SelectItem>
                <SelectItem value="week">{t.week}</SelectItem>
                <SelectItem value="month">{t.month}</SelectItem>
              </SelectContent>
            </Select>

            {/* Start date */}
            <DatePickerButton label={t.from} date={startDate} onSelect={(d) => d && setStartDate(d)} />

            {/* End date */}
            <DatePickerButton label={t.to} date={endDate} onSelect={(d) => d && setEndDate(d)} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-lg border bg-card p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</span>
                <kpi.icon className="h-4 w-4 text-muted-foreground/50" />
              </div>
              <p className="text-xl font-bold text-foreground">{kpi.value}</p>
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
                  <linearGradient id="botLogSearch" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="botLogGPT" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="botLogGemini" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="botLogSEO" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="botLogSocial" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(340, 82%, 52%)" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="hsl(340, 82%, 52%)" stopOpacity={0.05} />
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
                <Area type="monotone" dataKey="searchEngines" name={t.searchEngines} stackId="1" stroke="hsl(217, 91%, 60%)" fill="url(#botLogSearch)" strokeWidth={2} />
                <Area type="monotone" dataKey="gptBot" name={t.gptBot} stackId="1" stroke="hsl(160, 84%, 39%)" fill="url(#botLogGPT)" strokeWidth={2} />
                <Area type="monotone" dataKey="geminiBot" name={t.geminiBot} stackId="1" stroke="hsl(262, 83%, 58%)" fill="url(#botLogGemini)" strokeWidth={2} />
                <Area type="monotone" dataKey="seoTools" name={t.seoTools} stackId="1" stroke="hsl(38, 92%, 50%)" fill="url(#botLogSEO)" strokeWidth={2} />
                <Area type="monotone" dataKey="socialBots" name={t.socialBots} stackId="1" stroke="hsl(340, 82%, 52%)" fill="url(#botLogSocial)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DatePickerButton({ label, date, onSelect }: { label: string; date: Date; onSelect: (d: Date | undefined) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-8 gap-1.5 text-xs justify-start")}>
          <CalendarIcon className="h-3 w-3" />
          <span className="text-muted-foreground">{label}</span>
          {format(date, 'dd/MM/yy')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onSelect}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}
