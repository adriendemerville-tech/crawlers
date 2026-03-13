import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RefreshCw, Loader2, Brain, Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── LLM brand colors ───
const LLM_COLORS: Record<string, string> = {
  ChatGPT: 'hsl(160, 60%, 45%)',
  Claude: 'hsl(25, 80%, 55%)',
  Gemini: 'hsl(220, 80%, 55%)',
  Perplexity: 'hsl(190, 70%, 50%)',
};

const LLM_ICONS: Record<string, string> = {
  ChatGPT: '🤖',
  Claude: '🧠',
  Gemini: '✦',
  Perplexity: '🔍',
};

interface VisibilityScore {
  llm_name: string;
  score_percentage: number;
  week_start_date: string;
}

interface LLMVisibilityDashboardProps {
  trackedSiteId: string;
  userId: string;
  domain: string;
  competitors?: string[];
}

const translations = {
  fr: {
    title: 'Visibilité par modèle',
    history: 'Historique de visibilité',
    noData: 'Aucune donnée de visibilité LLM. Lancez une analyse pour commencer.',
    refresh: 'Analyser',
    refreshing: 'Analyse en cours...',
    marketActor: 'ACTEUR DU MARCHÉ',
    legend: '0% → 100%',
    week: 'Sem.',
  },
  en: {
    title: 'Visibility by model',
    history: 'Visibility history',
    noData: 'No LLM visibility data. Run an analysis to get started.',
    refresh: 'Analyze',
    refreshing: 'Analyzing...',
    marketActor: 'MARKET ACTOR',
    legend: '0% → 100%',
    week: 'Wk.',
  },
  es: {
    title: 'Visibilidad por modelo',
    history: 'Historial de visibilidad',
    noData: 'Sin datos de visibilidad LLM. Ejecute un análisis para comenzar.',
    refresh: 'Analizar',
    refreshing: 'Analizando...',
    marketActor: 'ACTOR DEL MERCADO',
    legend: '0% → 100%',
    week: 'Sem.',
  },
};

function scoreColor(score: number): string {
  if (score >= 80) return 'bg-blue-500/90 text-white';
  if (score >= 60) return 'bg-blue-400/80 text-white';
  if (score >= 40) return 'bg-blue-300/70 text-foreground';
  if (score >= 20) return 'bg-blue-200/60 text-foreground';
  return 'bg-blue-100/50 text-muted-foreground';
}

export function LLMVisibilityDashboard({ trackedSiteId, userId, domain }: LLMVisibilityDashboardProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;

  const [scores, setScores] = useState<VisibilityScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchScores = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('llm_visibility_scores')
        .select('*')
        .eq('tracked_site_id', trackedSiteId)
        .order('week_start_date', { ascending: true });

      if (!error && data) {
        setScores(data as unknown as VisibilityScore[]);
      }
    } catch (err) {
      console.error('Error fetching visibility scores:', err);
    } finally {
      setLoading(false);
    }
  }, [trackedSiteId]);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke('calculate-llm-visibility', {
        body: { tracked_site_id: trackedSiteId, user_id: userId },
      });
      if (error) throw error;
      await fetchScores();
    } catch (err) {
      console.error('LLM visibility refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Get latest scores per LLM
  const latestWeek = scores.length > 0
    ? scores.reduce((max, s) => s.week_start_date > max ? s.week_start_date : max, scores[0].week_start_date)
    : null;

  const latestScores = latestWeek
    ? scores.filter(s => s.week_start_date === latestWeek)
    : [];

  // Build chart data: pivot by week
  const weekMap = new Map<string, Record<string, number>>();
  for (const s of scores) {
    if (!weekMap.has(s.week_start_date)) {
      weekMap.set(s.week_start_date, {});
    }
    weekMap.get(s.week_start_date)![s.llm_name] = s.score_percentage;
  }

  const chartData = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12) // Last 12 weeks
    .map(([week, llms]) => {
      const d = new Date(week);
      const label = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      return { week: label, ...llms };
    });

  const llmNames = [...new Set(scores.map(s => s.llm_name))];

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><Skeleton className="h-5 w-48" /></CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-5 w-48" /></CardHeader>
          <CardContent><Skeleton className="h-48 w-full" /></CardContent>
        </Card>
      </div>
    );
  }

  if (scores.length === 0) {
    return (
      <Card className="border-dashed opacity-80">
        <CardContent className="py-8 text-center space-y-4">
          <Brain className="h-10 w-10 mx-auto opacity-30" />
          <p className="text-sm text-muted-foreground">{t.noData}</p>
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline" size="sm">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            {refreshing ? t.refreshing : t.refresh}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ─── Heatmap Table ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Brain className="h-4 w-4" />
            {t.title}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">
                    {language === 'fr'
                      ? 'Score basé sur la profondeur de découverte : 1ère mention = 100%, 2ème = 50%, 3ème = 25%, absent = 0%.'
                      : 'Score based on discovery depth: 1st mention = 100%, 2nd = 50%, 3rd = 25%, absent = 0%.'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="ml-auto">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 text-[10px] uppercase text-muted-foreground font-medium tracking-wider">
                    {t.marketActor}
                  </th>
                  {llmNames.map(name => (
                    <th key={name} className="text-center py-2 px-2">
                      <span className="text-lg" title={name}>{LLM_ICONS[name] || '🔮'}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Main site row (highlighted) */}
                <tr className="border-b">
                  <td className="py-2.5 pr-4 font-semibold flex items-center gap-1.5">
                    {domain.replace(/^www\./, '')}
                    <span className="text-yellow-500">★</span>
                  </td>
                  {llmNames.map(name => {
                    const score = latestScores.find(s => s.llm_name === name);
                    return (
                      <td key={name} className="text-center py-2.5 px-1.5">
                        <Badge
                          variant="secondary"
                          className={`min-w-[52px] justify-center font-semibold text-xs ${scoreColor(score?.score_percentage ?? 0)}`}
                        >
                          {score?.score_percentage ?? 0}%
                        </Badge>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Legend bar */}
          <div className="flex items-center gap-2 mt-4 text-[10px] text-muted-foreground">
            <div className="flex-1 h-2 rounded-full bg-gradient-to-r from-blue-100 via-blue-300 to-blue-600" />
            <span>{t.legend}</span>
          </div>
        </CardContent>
      </Card>

      {/* ─── History Chart ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">{t.history}</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: number) => `${v}%`}
                  className="text-muted-foreground"
                />
                <RechartsTooltip
                  formatter={(value: number, name: string) => [`${value}%`, name]}
                  contentStyle={{
                    borderRadius: '8px',
                    fontSize: '12px',
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--card))',
                    color: 'hsl(var(--card-foreground))',
                  }}
                />
                <Legend
                  iconSize={10}
                  wrapperStyle={{ fontSize: '11px' }}
                />
                {llmNames.map(name => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={LLM_COLORS[name] || 'hsl(var(--primary))'}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
              {language === 'fr'
                ? 'L\'historique s\'affichera après 2 semaines de données.'
                : 'History will display after 2 weeks of data.'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
