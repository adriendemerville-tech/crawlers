import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RefreshCw, Loader2, Brain, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

const LLM_ORDER = ['ChatGPT', 'Gemini', 'Perplexity'] as const;

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
    title: 'Benchmark LLM',
    noData: 'Aucune donnée de benchmark LLM. Lancez une analyse pour commencer.',
    refresh: 'Analyser',
    refreshing: 'Analyse en cours...',
    legend: '0% → 100%',
    week: 'Sem.',
  },
  en: {
    title: 'LLM Benchmark',
    noData: 'No LLM benchmark data. Run an analysis to get started.',
    refresh: 'Analyze',
    refreshing: 'Analyzing...',
    legend: '0% → 100%',
    week: 'Wk.',
  },
  es: {
    title: 'Benchmark LLM',
    noData: 'Sin datos de benchmark LLM. Ejecute un análisis para comenzar.',
    refresh: 'Analizar',
    refreshing: 'Analizando...',
    legend: '0% → 100%',
    week: 'Sem.',
  },
};

function cellBg(score: number): string {
  if (score >= 80) return 'bg-blue-600 text-white';
  if (score >= 60) return 'bg-blue-400 text-white';
  if (score >= 40) return 'bg-blue-300/80 text-foreground';
  if (score >= 20) return 'bg-blue-200/70 text-foreground';
  return 'bg-blue-100/50 text-muted-foreground';
}

function formatWeekLabel(dateStr: string, lang: string): string {
  const d = new Date(dateStr);
  const day = d.getDate().toString().padStart(2, '0');
  const months = lang === 'fr'
    ? ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
    : lang === 'es'
      ? ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[d.getMonth()]}`;
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

  // Build heatmap data: weeks as columns, LLMs as rows
  const weeks = [...new Set(scores.map(s => s.week_start_date))].sort().slice(-12);
  const llmNames = LLM_ORDER.filter(name =>
    scores.some(s => s.llm_name === name)
  );
  // If there are LLMs not in our predefined order, add them at the end
  const extraLlms = [...new Set(scores.map(s => s.llm_name))].filter(n => !LLM_ORDER.includes(n as any));
  const allLlms = [...llmNames, ...extraLlms];

  // Build lookup: llm -> week -> score
  const scoreMap = new Map<string, Map<string, number>>();
  for (const s of scores) {
    if (!scoreMap.has(s.llm_name)) scoreMap.set(s.llm_name, new Map());
    scoreMap.get(s.llm_name)!.set(s.week_start_date, s.score_percentage);
  }

  if (loading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-48" /></CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (scores.length === 0) {
    return (
      <Card className="border-dashed opacity-80 relative">
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
    <Card className="relative">
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
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm border-separate" style={{ borderSpacing: '3px' }}>
            <thead>
              <tr>
                <th className="text-left py-2 pr-3 text-[10px] uppercase text-muted-foreground font-medium tracking-wider min-w-[100px]">
                  {language === 'fr' ? 'MODÈLE' : language === 'es' ? 'MODELO' : 'MODEL'}
                </th>
                {weeks.map(week => (
                  <th key={week} className="text-center py-2 px-1 text-[10px] text-muted-foreground font-normal whitespace-nowrap">
                    {formatWeekLabel(week, language)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allLlms.map(llmName => (
                <tr key={llmName}>
                  <td className="py-1.5 pr-3 font-medium text-sm whitespace-nowrap">
                    {llmName}
                  </td>
                  {weeks.map(week => {
                    const score = scoreMap.get(llmName)?.get(week);
                    const hasScore = score != null;
                    return (
                      <td key={week} className="text-center py-1.5 px-1">
                        <div
                          className={`inline-flex items-center justify-center min-w-[48px] rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                            hasScore ? cellBg(score) : 'bg-muted/30 text-muted-foreground/50'
                          }`}
                        >
                          {hasScore ? `${Math.round(score)}%` : '—'}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend bar */}
        <div className="flex items-center gap-2 mt-4 text-[10px] text-muted-foreground">
          <div className="flex-1 h-2 rounded-full bg-gradient-to-r from-blue-100 via-blue-300 to-blue-600" />
          <span>{t.legend}</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70 mt-2 italic">
          {language === 'fr'
            ? 'Score basé sur 3 itérations conversationnelles par modèle (1ère = 100 pts, 2ème = 50 pts, 3ème = 25 pts, absent = 0).'
            : language === 'es'
              ? 'Puntuación basada en 3 iteraciones conversacionales por modelo (1ª = 100 pts, 2ª = 50 pts, 3ª = 25 pts, ausente = 0).'
              : 'Score based on 3 conversational iterations per model (1st = 100 pts, 2nd = 50 pts, 3rd = 25 pts, absent = 0).'}
        </p>
      </CardContent>
    </Card>
  );
}
