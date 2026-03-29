import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Lock, Activity, ArrowRight, RefreshCw, Loader2, CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAdmin } from '@/hooks/useAdmin';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, subMonths, subWeeks, startOfWeek, startOfMonth, parseISO } from 'date-fns';
import { fr, es, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { id: 1, label: 'E-commerce & Retail', target: 30 },
  { id: 2, label: 'Média, Blog & Affiliation', target: 15 },
  { id: 3, label: 'Lead Gen B2B & Services', target: 40 },
  { id: 4, label: 'SaaS & Logiciel', target: 50 },
  { id: 5, label: 'Local & Brick-and-Mortar', target: 20 },
  { id: 6, label: 'Marque Statutaire / Luxe', target: 80 },
];

type Interval = 'daily' | 'weekly' | 'monthly';

interface HistoryRow {
  actual_ratio: number;
  target_ratio: number;
  ias_score: number;
  brand_clicks: number;
  generic_clicks: number;
  total_clicks: number;
  week_start_date: string;
  created_at: string;
  business_type: string;
}

interface IASCardProps {
  trackedSiteId: string;
  userId: string;
  domain: string;
  isPremium: boolean;
  onUpgrade?: () => void;
}

const translations = {
  fr: {
    title: 'Indice d\'Alignement Stratégique',
    subtitle: 'Marque vs Hors-Marque',
    noData: 'Aucune donnée GSC. Connectez Search Console pour activer l\'IAS.',
    loading: 'Calcul de l\'IAS…',
    recalculate: 'Recalculer',
    category: 'Typologie',
    upgrade: 'Débloquer l\'IAS',
    upgradeDesc: 'Passez en Pro pour accéder au diagnostic stratégique.',
    interval: 'Intervalle',
    daily: 'Jour',
    weekly: 'Semaine',
    monthly: 'Mois',
    from: 'Du',
    to: 'Au',
    ratio: 'Ratio Brand',
    target: 'Cible',
    score: 'Score IAS',
  },
  en: {
    title: 'Strategic Alignment Index',
    subtitle: 'Brand vs Non-Brand',
    noData: 'No GSC data. Connect Search Console to activate IAS.',
    loading: 'Calculating IAS…',
    recalculate: 'Recalculate',
    category: 'Category',
    upgrade: 'Unlock IAS',
    upgradeDesc: 'Upgrade to Pro to access strategic diagnostic.',
    interval: 'Interval',
    daily: 'Day',
    weekly: 'Week',
    monthly: 'Month',
    from: 'From',
    to: 'To',
    ratio: 'Brand Ratio',
    target: 'Target',
    score: 'IAS Score',
  },
  es: {
    title: 'Índice de Alineación Estratégica',
    subtitle: 'Marca vs No-Marca',
    noData: 'Sin datos GSC. Conecte Search Console para activar IAS.',
    loading: 'Calculando IAS…',
    recalculate: 'Recalcular',
    category: 'Tipología',
    upgrade: 'Desbloquear IAS',
    upgradeDesc: 'Pase a Pro para acceder al diagnóstico estratégico.',
    interval: 'Intervalo',
    daily: 'Día',
    weekly: 'Semana',
    monthly: 'Mes',
    from: 'Desde',
    to: 'Hasta',
    ratio: 'Ratio Marca',
    target: 'Objetivo',
    score: 'Score IAS',
  },
};

function getLocale(lang: string) {
  if (lang === 'fr') return fr;
  if (lang === 'es') return es;
  return enUS;
}

export function IASCard({ trackedSiteId, userId, domain, isPremium, onUpgrade }: IASCardProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const locale = getLocale(language);
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const hasAccess = isPremium || isAdmin;

  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [interval, setInterval] = useState<Interval>('weekly');
  const [dateFrom, setDateFrom] = useState<Date>(subMonths(new Date(), 3));
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ias_history')
        .select('*')
        .eq('tracked_site_id', trackedSiteId)
        .eq('user_id', userId)
        .gte('week_start_date', format(dateFrom, 'yyyy-MM-dd'))
        .lte('week_start_date', format(dateTo, 'yyyy-MM-dd'))
        .order('week_start_date', { ascending: true });

      if (error) throw error;
      setHistory((data as HistoryRow[]) || []);
      if (data && data.length > 0 && !selectedCategoryId) {
        const cat = CATEGORIES.find(c => c.label.toLowerCase().includes((data[0] as any).business_type));
        if (cat) setSelectedCategoryId(cat.id);
      }
    } catch (err) {
      console.error('IAS history fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [trackedSiteId, userId, dateFrom, dateTo]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      await supabase.functions.invoke('calculate-ias', {
        body: {
          tracked_site_id: trackedSiteId,
          user_id: userId,
          ...(selectedCategoryId ? { force_category_id: selectedCategoryId } : {}),
        },
      });
      await fetchHistory();
    } finally {
      setRecalculating(false);
    }
  };

  const handleCategoryChange = (value: string) => {
    const catId = parseInt(value, 10);
    setSelectedCategoryId(catId);
    // Trigger recalc with new category
    setRecalculating(true);
    supabase.functions.invoke('calculate-ias', {
      body: { tracked_site_id: trackedSiteId, user_id: userId, force_category_id: catId },
    }).then(() => fetchHistory()).finally(() => setRecalculating(false));
  };

  const targetRatio = useMemo(() => {
    if (selectedCategoryId) {
      const cat = CATEGORIES.find(c => c.id === selectedCategoryId);
      if (cat) return cat.target / 100;
    }
    if (history.length > 0) return history[history.length - 1].target_ratio;
    return 0.3;
  }, [selectedCategoryId, history]);

  // Aggregate data by interval
  const chartData = useMemo(() => {
    if (!history.length) return [];

    const buckets = new Map<string, { ratios: number[]; scores: number[] }>();

    history.forEach(row => {
      let key: string;
      const d = parseISO(row.week_start_date);
      if (interval === 'daily') {
        key = format(d, 'yyyy-MM-dd');
      } else if (interval === 'weekly') {
        key = format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      } else {
        key = format(startOfMonth(d), 'yyyy-MM');
      }

      const bucket = buckets.get(key) || { ratios: [], scores: [] };
      bucket.ratios.push(row.actual_ratio);
      bucket.scores.push(row.ias_score);
      buckets.set(key, bucket);
    });

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, { ratios, scores }]) => {
        const avgRatio = ratios.reduce((s, v) => s + v, 0) / ratios.length;
        const avgScore = scores.reduce((s, v) => s + v, 0) / scores.length;
        return {
          date: key,
          label: interval === 'monthly'
            ? format(parseISO(key + '-01'), 'MMM yyyy', { locale })
            : format(parseISO(key), 'dd MMM', { locale }),
          ratio: Math.round(avgRatio * 1000) / 10,
          score: Math.round(avgScore),
          target: Math.round(targetRatio * 100),
        };
      });
  }, [history, interval, targetRatio, locale]);

  // Generate SVG gradient ID unique to this component
  const gradientId = 'ias-area-gradient';

  // Calculate gradient stops based on target ratio
  // Green when ratio is near target, red when far away
  // The -20%/+20% zone has a gradient transition
  const getGradientStops = useMemo(() => {
    const target = targetRatio * 100;
    // We color based on how the ratio compares to target
    // Since the chart Y axis will show 0-100%, we create stops accordingly
    // Good = near target, Bad = far from target (either direction)
    return { target };
  }, [targetRatio]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const diff = d.ratio - d.target;
    const isGood = Math.abs(diff) <= 10;
    const isMedium = Math.abs(diff) <= 20;

    return (
      <div className="rounded-lg border bg-background/95 backdrop-blur-sm p-3 shadow-xl text-xs space-y-1.5">
        <p className="font-medium text-foreground">{d.label}</p>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: isGood ? 'hsl(142, 76%, 36%)' : isMedium ? 'hsl(38, 92%, 50%)' : 'hsl(0, 72%, 38%)' }} />
          <span className="text-muted-foreground">{t.ratio}:</span>
          <span className="font-semibold">{d.ratio}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
          <span className="text-muted-foreground">{t.target}:</span>
          <span className="font-semibold">{d.target}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{t.score}:</span>
          <span className="font-semibold">{d.score}/100</span>
        </div>
      </div>
    );
  };

  // Build a per-segment area chart with dynamic fill colors
  // We use a linearGradient that maps Y-axis values to colors
  // Green zone: within ±5% of target
  // Transition zone: ±5% to ±20%
  // Red zone: beyond ±20%
  const yMin = 0;
  const yMax = 100;
  const targetPct = targetRatio * 100;
  
  // Gradient stops for the Y axis (from bottom=0% to top=100%)
  // We invert because SVG gradient y1=0 is top, y2=1 is bottom
  const computeGradientStops = () => {
    const stops: { offset: string; color: string }[] = [];
    const goodColor = 'rgba(34, 197, 94, 0.5)';   // green
    const warnColor = 'rgba(234, 179, 8, 0.4)';    // yellow/amber
    const badColor = 'rgba(153, 27, 27, 0.5)';     // dark red

    // SVG gradient: offset 0% = top of chart (100%), offset 100% = bottom (0%)
    // We want: green near target, red far from target
    const normalizeY = (val: number) => 1 - (val - yMin) / (yMax - yMin);

    const t = targetPct;
    const zones = [
      { y: Math.max(yMin, t - 30), color: badColor },
      { y: Math.max(yMin, t - 20), color: badColor },
      { y: Math.max(yMin, t - 10), color: warnColor },
      { y: Math.max(yMin, t - 5), color: goodColor },
      { y: t, color: goodColor },
      { y: Math.min(yMax, t + 5), color: goodColor },
      { y: Math.min(yMax, t + 10), color: warnColor },
      { y: Math.min(yMax, t + 20), color: badColor },
      { y: Math.min(yMax, t + 30), color: badColor },
    ];

    // Add edge stops
    stops.push({ offset: '0%', color: badColor });
    
    zones.forEach(z => {
      const offset = `${(normalizeY(z.y) * 100).toFixed(1)}%`;
      stops.push({ offset, color: z.color });
    });
    
    stops.push({ offset: '100%', color: badColor });

    return stops;
  };

  const gradientStops = computeGradientStops();

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3"><Skeleton className="h-5 w-48" /></CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-8" /><Skeleton className="h-8" /><Skeleton className="h-8" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!history.length) {
    return (
      <Card className="border-dashed opacity-80">
        <CardContent className="py-6 text-center text-muted-foreground text-sm">
          <Activity className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p>{language === 'fr' ? 'Aucune donnée IAS disponible. Cliquez sur "Recalculer" pour lancer le premier calcul.' : language === 'es' ? 'Sin datos IAS. Haga clic en "Recalcular" para iniciar el primer cálculo.' : 'No IAS data available. Click "Recalculate" to run the first calculation.'}</p>
          {hasAccess && (
            <Button variant="outline" size="sm" className="mt-3" onClick={handleRecalculate} disabled={recalculating}>
              {recalculating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              {t.recalculate}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const content = (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Interval selector */}
        <Select value={interval} onValueChange={(v) => setInterval(v as Interval)}>
          <SelectTrigger className="h-7 text-xs w-auto min-w-[90px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily" className="text-xs">{t.daily}</SelectItem>
            <SelectItem value="weekly" className="text-xs">{t.weekly}</SelectItem>
            <SelectItem value="monthly" className="text-xs">{t.monthly}</SelectItem>
          </SelectContent>
        </Select>

        {/* Date from */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 px-2">
              <CalendarIcon className="h-3 w-3" />
              {format(dateFrom, 'dd/MM/yy')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFrom}
              onSelect={(d) => d && setDateFrom(d)}
              className="p-3 pointer-events-auto"
              locale={locale}
            />
          </PopoverContent>
        </Popover>

        <span className="text-xs text-muted-foreground">→</span>

        {/* Date to */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 px-2">
              <CalendarIcon className="h-3 w-3" />
              {format(dateTo, 'dd/MM/yy')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={(d) => d && setDateTo(d)}
              className="p-3 pointer-events-auto"
              locale={locale}
            />
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 ml-auto"
          onClick={handleRecalculate}
          disabled={recalculating}
        >
          {recalculating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Category selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground shrink-0">{t.category}:</span>
        <Select
          value={selectedCategoryId ? String(selectedCategoryId) : ''}
          onValueChange={handleCategoryChange}
          disabled={recalculating}
        >
          <SelectTrigger className="h-7 text-xs flex-1">
            <SelectValue placeholder={t.category} />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat.id} value={String(cat.id)} className="text-xs">
                {cat.label} ({cat.target}%)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Area Chart */}
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                {gradientStops.map((stop, i) => (
                  <stop key={i} offset={stop.offset} stopColor={stop.color} />
                ))}
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={targetPct}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={{
                value: `${t.target} ${Math.round(targetPct)}%`,
                position: 'right',
                fontSize: 10,
                fill: 'hsl(var(--muted-foreground))',
              }}
            />
            {/* Highlight zones */}
            <ReferenceLine
              y={Math.max(0, targetPct - 20)}
              stroke="hsl(0, 72%, 38%)"
              strokeDasharray="2 4"
              strokeWidth={0.5}
              opacity={0.4}
            />
            <ReferenceLine
              y={Math.min(100, targetPct + 20)}
              stroke="hsl(0, 72%, 38%)"
              strokeDasharray="2 4"
              strokeWidth={0.5}
              opacity={0.4}
            />
            <Area
              type="monotone"
              dataKey="ratio"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={{ r: 2, fill: 'hsl(var(--primary))' }}
              activeDot={{ r: 4, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'rgba(34, 197, 94, 0.8)' }} />
          Ratio aligné
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'rgba(234, 179, 8, 0.8)' }} />
          Zone ±10-20%
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'rgba(153, 27, 27, 0.8)' }} />
          Désaligné
        </span>
      </div>
    </div>
  );

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" />
          {t.title}
          <Badge variant="secondary" className="text-[10px] font-normal">{t.subtitle}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasAccess ? (
          content
        ) : (
          <div className="relative">
            <div className="blur-[4px] pointer-events-none select-none" aria-hidden>
              {content}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/30 backdrop-blur-[2px] rounded-lg">
              <div className="h-12 w-12 rounded-full bg-[hsl(263,70%,38%)]/10 flex items-center justify-center">
                <Lock className="h-6 w-6 text-[hsl(263,70%,38%)]" />
              </div>
              <p className="text-sm text-muted-foreground text-center max-w-[200px]">{t.upgradeDesc}</p>
              <Button size="sm" className="bg-[hsl(263,70%,38%)] hover:bg-[hsl(263,70%,32%)] text-white" onClick={() => navigate('/tarifs')}>
                {t.upgrade}
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
