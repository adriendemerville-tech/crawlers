import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lock, Activity, ArrowRight, RefreshCw, Loader2, TrendingUp, Search, Target, Sprout } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAdmin } from '@/hooks/useAdmin';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subMonths, parseISO, startOfWeek } from 'date-fns';
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
  organic_traction_score?: number;
  brand_maturity_score?: number;
  brand_penetration_score?: number;
  momentum_score?: number;
  diagnostic_text?: string;
  sub_scores_detail?: any;
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
    title: 'Alignement Stratégique',
    noData: 'Aucune donnée. Cliquez sur Recalculer pour lancer l\'analyse.',
    recalculate: 'Recalculer',
    category: 'Typologie',
    upgrade: 'Débloquer l\'IAS',
    upgradeDesc: 'Passez en Pro pour accéder au diagnostic stratégique.',
    organic: 'Traction organique',
    maturity: 'Maturité marque',
    penetration: 'Pénétration marque',
    momentum: 'Tendance',
    score: 'Score global',
  },
  en: {
    title: 'Strategic Alignment',
    noData: 'No data. Click Recalculate to launch the analysis.',
    recalculate: 'Recalculate',
    category: 'Category',
    upgrade: 'Unlock IAS',
    upgradeDesc: 'Upgrade to Pro to access strategic diagnostic.',
    organic: 'Organic Traction',
    maturity: 'Brand Maturity',
    penetration: 'Brand Penetration',
    momentum: 'Momentum',
    score: 'Overall Score',
  },
  es: {
    title: 'Alineación Estratégica',
    noData: 'Sin datos. Haga clic en Recalcular para lanzar el análisis.',
    recalculate: 'Recalcular',
    category: 'Tipología',
    upgrade: 'Desbloquear IAS',
    upgradeDesc: 'Pase a Pro para acceder al diagnóstico estratégico.',
    organic: 'Tracción orgánica',
    maturity: 'Madurez de marca',
    penetration: 'Penetración marca',
    momentum: 'Tendencia',
    score: 'Score global',
  },
};

function getLocale(lang: string) {
  if (lang === 'fr') return fr;
  if (lang === 'es') return es;
  return enUS;
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-500';
  if (score >= 45) return 'text-amber-500';
  return 'text-red-500';
}

function getScoreBg(score: number): string {
  if (score >= 70) return 'bg-emerald-500/10';
  if (score >= 45) return 'bg-amber-500/10';
  return 'bg-red-500/10';
}

function SubScoreIndicator({ icon, label, score, detail }: { icon: React.ReactNode; label: string; score: number; detail?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5 p-2 rounded-lg", getScoreBg(score))}>
      <div className={cn("shrink-0", getScoreColor(score))}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-foreground truncate">{label}</span>
          <span className={cn("text-sm font-bold tabular-nums", getScoreColor(score))}>{score}</span>
        </div>
        {detail && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{detail}</p>}
      </div>
    </div>
  );
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
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const dateFrom = format(subMonths(new Date(), 3), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('ias_history')
        .select('*')
        .eq('tracked_site_id', trackedSiteId)
        .eq('user_id', userId)
        .gte('week_start_date', dateFrom)
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
  }, [trackedSiteId, userId]);

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
    setRecalculating(true);
    supabase.functions.invoke('calculate-ias', {
      body: { tracked_site_id: trackedSiteId, user_id: userId, force_category_id: catId },
    }).then(() => fetchHistory()).finally(() => setRecalculating(false));
  };

  // Latest data point
  const latest = history.length > 0 ? history[history.length - 1] : null;

  // Chart data (weekly, simplified)
  const chartData = useMemo(() => {
    if (!history.length) return [];

    const buckets = new Map<string, { scores: number[] }>();
    history.forEach(row => {
      const d = parseISO(row.week_start_date);
      const key = format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const bucket = buckets.get(key) || { scores: [] };
      bucket.scores.push(row.ias_score);
      buckets.set(key, bucket);
    });

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, { scores }]) => ({
        date: key,
        label: format(parseISO(key), 'dd MMM', { locale }),
        score: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
      }));
  }, [history, locale]);

  // Sub-scores from latest entry
  const subScores = useMemo(() => {
    if (!latest) return null;
    const detail = latest.sub_scores_detail as Record<string, { score: number; label: string }> | undefined;
    return {
      organic: { score: latest.organic_traction_score ?? 0, label: detail?.organic?.label },
      maturity: { score: latest.brand_maturity_score ?? 0, label: detail?.maturity?.label },
      penetration: { score: latest.brand_penetration_score ?? 0, label: detail?.penetration?.label },
      momentum: { score: latest.momentum_score ?? 0, label: detail?.momentum?.label },
    };
  }, [latest]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3"><Skeleton className="h-5 w-48" /></CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-40 w-full" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-14" /><Skeleton className="h-14" />
            <Skeleton className="h-14" /><Skeleton className="h-14" />
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
          <p>{t.noData}</p>
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

  const compositeScore = latest?.ias_score ?? 0;

  const content = (
    <div className="space-y-4">
      {/* Header: Score + Diagnostic */}
      <div className="flex items-start gap-3">
        <div className={cn(
          "flex items-center justify-center w-14 h-14 rounded-xl text-xl font-bold shrink-0",
          getScoreBg(compositeScore),
          getScoreColor(compositeScore),
        )}>
          {compositeScore}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-0.5">{t.score}</p>
          {latest?.diagnostic_text && (
            <p className="text-xs text-foreground leading-relaxed">{latest.diagnostic_text}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={handleRecalculate}
          disabled={recalculating}
        >
          {recalculating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Sub-scores grid */}
      {subScores && (
        <div className="grid grid-cols-2 gap-2">
          <SubScoreIndicator
            icon={<Sprout className="h-4 w-4" />}
            label={t.organic}
            score={subScores.organic.score}
            detail={subScores.organic.label}
          />
          <SubScoreIndicator
            icon={<Target className="h-4 w-4" />}
            label={t.maturity}
            score={subScores.maturity.score}
            detail={subScores.maturity.label}
          />
          <SubScoreIndicator
            icon={<Search className="h-4 w-4" />}
            label={t.penetration}
            score={subScores.penetration.score}
            detail={subScores.penetration.label}
          />
          <SubScoreIndicator
            icon={<TrendingUp className="h-4 w-4" />}
            label={t.momentum}
            score={subScores.momentum.score}
            detail={subScores.momentum.label}
          />
        </div>
      )}

      {/* Category selector (compact) */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground shrink-0">{t.category}:</span>
        <Select
          value={selectedCategoryId ? String(selectedCategoryId) : ''}
          onValueChange={handleCategoryChange}
          disabled={recalculating}
        >
          <SelectTrigger className="h-6 text-[10px] flex-1 border-border/40">
            <SelectValue placeholder={t.category} />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat.id} value={String(cat.id)} className="text-xs">
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Simplified AreaChart */}
      {chartData.length > 1 && (
        <div className="h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <defs>
                <linearGradient id="ias-score-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-md border bg-background/95 backdrop-blur-sm px-2.5 py-1.5 shadow-lg text-xs">
                      <p className="font-medium">{d.label}</p>
                      <p className={cn("font-bold", getScoreColor(d.score))}>{t.score}: {d.score}/100</p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#ias-score-gradient)"
                dot={{ r: 2, fill: 'hsl(var(--primary))' }}
                activeDot={{ r: 4, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" />
          {t.title}
          <Badge variant="secondary" className="text-[10px] font-normal ml-auto">IAS</Badge>
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
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground text-center max-w-[200px]">{t.upgradeDesc}</p>
              <Button size="sm" variant="default" onClick={() => navigate('/tarifs')}>
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
