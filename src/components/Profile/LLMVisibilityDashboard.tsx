import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Loader2, Brain, Info, HelpCircle, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

const LLM_ORDER = ['ChatGPT', 'Gemini', 'Perplexity'] as const;

interface VisibilityScore {
  llm_name: string;
  score_percentage: number;
  week_start_date: string;
}

interface ConversationTurn {
  iteration: number;
  prompt_text: string;
  response_summary: string;
  llm_name: string;
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
    conversations: 'Conversations LLM',
    noConversations: 'Aucune conversation enregistrée pour ce modèle.',
    prompt: 'Question',
    response: 'Réponse',
    iteration: 'Itération',
  },
  en: {
    title: 'LLM Benchmark',
    noData: 'No LLM benchmark data. Run an analysis to get started.',
    refresh: 'Analyze',
    refreshing: 'Analyzing...',
    legend: '0% → 100%',
    week: 'Wk.',
    conversations: 'LLM Conversations',
    noConversations: 'No conversations recorded for this model.',
    prompt: 'Question',
    response: 'Response',
    iteration: 'Iteration',
  },
  es: {
    title: 'Benchmark LLM',
    noData: 'Sin datos de benchmark LLM. Ejecute un análisis para comenzar.',
    refresh: 'Analizar',
    refreshing: 'Analizando...',
    legend: '0% → 100%',
    week: 'Sem.',
    conversations: 'Conversaciones LLM',
    noConversations: 'No hay conversaciones registradas para este modelo.',
    prompt: 'Pregunta',
    response: 'Respuesta',
    iteration: 'Iteración',
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
  const [convOpen, setConvOpen] = useState(false);
  const [conversations, setConversations] = useState<Record<string, ConversationTurn[]>>({});
  const [convLoading, setConvLoading] = useState(false);

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

  const handleOpenConversations = async () => {
    setConvOpen(true);
    if (Object.keys(conversations).length > 0) return; // already loaded
    setConvLoading(true);
    try {
      const { data, error } = await supabase
        .from('llm_depth_conversations')
        .select('llm_name, iteration, prompt_text, response_summary')
        .eq('tracked_site_id', trackedSiteId)
        .eq('user_id', userId)
        .order('iteration', { ascending: true });

      if (!error && data?.length) {
        const grouped: Record<string, ConversationTurn[]> = {};
        for (const row of data) {
          if (!grouped[row.llm_name]) grouped[row.llm_name] = [];
          grouped[row.llm_name].push(row as ConversationTurn);
        }
        setConversations(grouped);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setConvLoading(false);
    }
  };

  // Build heatmap data: weeks as columns, LLMs as rows
  const weeks = [...new Set(scores.map(s => s.week_start_date))].sort().slice(-12);
  const llmNames = LLM_ORDER.filter(name =>
    scores.some(s => s.llm_name === name)
  );
  const extraLlms = [...new Set(scores.map(s => s.llm_name))].filter(n => !LLM_ORDER.includes(n as any));
  const allLlms = [...llmNames, ...extraLlms];

  // Build lookup: llm -> week -> raw score
  const rawScoreMap = new Map<string, Map<string, number>>();
  for (const s of scores) {
    if (!rawScoreMap.has(s.llm_name)) rawScoreMap.set(s.llm_name, new Map());
    rawScoreMap.get(s.llm_name)!.set(s.week_start_date, s.score_percentage);
  }

  const TREND_ALPHA = 0.3;
  const scoreMap = new Map<string, Map<string, number>>();
  const trendMap = new Map<string, Map<string, number>>();

  for (const llm of allLlms) {
    const llmRaw = rawScoreMap.get(llm);
    if (!llmRaw) continue;
    const normalizedWeekMap = new Map<string, number>();
    const trendWeekMap = new Map<string, number>();

    for (let i = 0; i < weeks.length; i++) {
      const week = weeks[i];
      const raw = llmRaw.get(week);
      if (raw == null) continue;

      const prevScores: number[] = [];
      for (let j = Math.max(0, i - 3); j < i; j++) {
        const prev = llmRaw.get(weeks[j]);
        if (prev != null) prevScores.push(prev);
      }

      if (prevScores.length === 0) {
        normalizedWeekMap.set(week, raw);
        trendWeekMap.set(week, 0);
      } else {
        const prevMean = prevScores.reduce((a, b) => a + b, 0) / prevScores.length;
        const trend = Math.max(-0.5, Math.min(0.5, (raw - prevMean) / 100));
        const adjusted = Math.max(0, Math.min(100, Math.round(raw * (1 + TREND_ALPHA * trend))));
        normalizedWeekMap.set(week, adjusted);
        trendWeekMap.set(week, trend);
      }
    }
    scoreMap.set(llm, normalizedWeekMap);
    trendMap.set(llm, trendWeekMap);
  }

  const convLlmNames = Object.keys(conversations);

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
    <>
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
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleOpenConversations}
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </Button>
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
            <table className="text-sm border-separate" style={{ borderSpacing: '3px' }}>
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
                      const trend = trendMap.get(llmName)?.get(week) ?? 0;
                      const hasScore = score != null;
                      const trendIcon = trend > 0.05 ? '↑' : trend < -0.05 ? '↓' : '';
                      return (
                        <td key={week} className="text-center pb-1.5 pl-1.5 pr-0 pt-0">
                          <div
                            className={`inline-flex items-center justify-center min-w-[48px] rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                              hasScore ? cellBg(score) : 'bg-muted/30 text-muted-foreground/50'
                            }`}
                          >
                            {hasScore ? `${Math.round(score)}%` : '—'}
                            {trendIcon && <span className="ml-0.5 text-[9px] opacity-80">{trendIcon}</span>}
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
              ? 'Score normalisé par la tendance sur 4 semaines (↑ progression, ↓ régression). Base : 3 itérations × modèle.'
              : language === 'es'
                ? 'Puntuación normalizada por tendencia de 4 semanas (↑ progresión, ↓ regresión). Base: 3 iteraciones × modelo.'
                : 'Score normalized by 4-week trend (↑ improving, ↓ declining). Base: 3 iterations × model.'}
          </p>
        </CardContent>
      </Card>

      {/* Conversations Modal */}
      <Dialog open={convOpen} onOpenChange={setConvOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {t.conversations}
              {weeks.length > 0 && (
                <span className="text-[11px] font-normal text-muted-foreground ml-1">
                  {new Date(weeks[weeks.length - 1]).toLocaleDateString(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {convLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : convLlmNames.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t.noConversations}</p>
          ) : (
            <Tabs defaultValue={convLlmNames[0]} className="w-full">
              <TabsList className="w-full justify-start gap-1 flex-wrap h-auto py-1">
                {convLlmNames.map(llm => (
                  <TabsTrigger key={llm} value={llm} className="text-xs px-3 py-1.5">
                    {llm}
                  </TabsTrigger>
                ))}
              </TabsList>

              {convLlmNames.map(llm => (
                <TabsContent key={llm} value={llm}>
                  <ScrollArea className="h-[50vh] pr-4">
                    <div className="space-y-4 py-2">
                      {conversations[llm].map((turn) => (
                        <div key={turn.iteration} className="space-y-2">
                          <div className="flex items-start gap-2">
                            <Badge variant="outline" className="shrink-0 text-[10px] mt-0.5">
                              {t.iteration} {turn.iteration}
                            </Badge>
                          </div>
                          {/* Prompt */}
                          <div className="ml-2 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                            <p className="text-[10px] font-medium text-violet-600 dark:text-violet-400 mb-1">{t.prompt}</p>
                            <p className="text-sm leading-relaxed">{turn.prompt_text}</p>
                          </div>
                          {/* Response */}
                          <div className="ml-2 p-3 rounded-lg bg-muted/50 border">
                            <p className="text-[10px] font-medium text-muted-foreground mb-1">{t.response}</p>
                            <p className="text-sm leading-relaxed text-foreground/80">{turn.response_summary}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
