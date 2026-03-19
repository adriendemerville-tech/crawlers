import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, RefreshCw, Layers, Info, CheckCircle2, XCircle, FileSearch, HelpCircle, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useAdmin } from '@/hooks/useAdmin';
import { motion, AnimatePresence } from 'framer-motion';

interface ConversationTurn {
  iteration: number;
  prompt_text: string;
  response_summary: string;
}

interface DepthResult {
  llm: string;
  model: string;
  iterations: number;
  found: boolean;
  mentioned_as: string | null;
  conversation_summary: string;
  angles_tested: string[];
}

interface LLMDepthData {
  brand: string;
  domain: string;
  avg_depth: number | null;
  results: DepthResult[];
  prompt_strategy: string;
  measured_at: string;
  error_code?: string;
}

interface SiteContext {
  market_sector?: string;
  products_services?: string;
  target_audience?: string;
  address?: string;
  commercial_area?: string;
  company_size?: string;
}

interface LLMDepthCardProps {
  domain: string;
  trackedSiteId?: string;
  userId?: string;
  siteContext?: SiteContext;
  initialData?: LLMDepthData | null;
}

// Streaming progress state per model
interface ModelProgress {
  iteration: number;
  found: boolean;
  mentioned_as?: string | null;
}

const translations = {
  fr: {
    title: 'Profondeur LLM',
    subtitle: 'Découvrabilité conversationnelle',
    noData: 'Mesurez en combien d\'échanges les LLMs citent votre marque via 7 angles d\'attaque.',
    analyze: 'Analyser',
    analyzing: 'Analyse multi-modèle…',
    avgDepth: 'Profondeur moyenne',
    iterations: 'itérations',
    found: 'Cité',
    notFound: 'Non cité',
    mentionedAs: 'Cité comme',
    angles: 'Angles testés',
    tooltip: 'Conversation multi-tour avec 4 LLMs via des angles de plus en plus précis (besoin, métier, fonctionnalités, budget, géographie, niche, exhaustif). Détection sémantique de la marque.',
    completed: 'Analyse terminée',
    completedDesc: 'Les crédits API sont temporairement épuisés. Vos données précédentes restent affichées.',
    expertRequired: 'Audit expert requis',
    expertRequiredDesc: 'Lancez un audit stratégique pour obtenir votre profondeur LLM avec des données de simulation intelligentes.',
    scanning: 'Scan en cours…',
  },
  en: {
    title: 'LLM Depth',
    subtitle: 'Conversational discoverability',
    noData: 'Measure how many exchanges it takes for LLMs to cite your brand across 7 angles.',
    analyze: 'Analyze',
    analyzing: 'Multi-model analysis…',
    avgDepth: 'Average depth',
    iterations: 'iterations',
    found: 'Cited',
    notFound: 'Not cited',
    mentionedAs: 'Cited as',
    angles: 'Angles tested',
    tooltip: 'Multi-turn conversation with 4 LLMs using increasingly specific angles (need, profession, features, budget, geography, niche, exhaustive). Semantic brand detection.',
    completed: 'Analysis complete',
    completedDesc: 'API credits are temporarily exhausted. Your previous data remains displayed.',
    expertRequired: 'Expert audit required',
    expertRequiredDesc: 'Run a strategic audit to get your LLM depth with smart simulated data.',
    scanning: 'Scanning…',
  },
  es: {
    title: 'Profundidad LLM',
    subtitle: 'Descubribilidad conversacional',
    noData: 'Mida en cuántos intercambios los LLMs citan su marca a través de 7 ángulos.',
    analyze: 'Analizar',
    analyzing: 'Análisis multi-modelo…',
    avgDepth: 'Profundidad promedio',
    iterations: 'iteraciones',
    found: 'Citado',
    notFound: 'No citado',
    mentionedAs: 'Citado como',
    angles: 'Ángulos probados',
    tooltip: 'Conversación multi-turno con 4 LLMs usando ángulos cada vez más específicos (necesidad, profesión, funcionalidades, presupuesto, geografía, nicho, exhaustivo). Detección semántica de marca.',
    completed: 'Análisis completado',
    completedDesc: 'Los créditos API están temporalmente agotados. Sus datos anteriores siguen mostrados.',
    expertRequired: 'Auditoría experta requerida',
    expertRequiredDesc: 'Ejecute una auditoría estratégica para obtener su profundidad LLM con datos simulados inteligentes.',
    scanning: 'Escaneando…',
  },
};

const MAX_ITERATIONS = 7;
const MODELS_LIST = ['ChatGPT', 'Gemini', 'Claude', 'Perplexity'];

/**
 * Returns an HSL color string interpolated from green (iteration 1) to red (iteration 7+).
 * Uses hue rotation: 120 (green) → 60 (yellow) → 0 (red)
 */
function iterationHslColor(iteration: number): string {
  const t = Math.min((iteration - 1) / (MAX_ITERATIONS - 1), 1); // 0..1
  const hue = 120 - t * 120; // 120 (green) → 0 (red)
  const saturation = 75 + t * 10; // slightly more saturated towards red
  const lightness = 42 + t * 5;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function iterationHslColorDark(iteration: number): string {
  const t = Math.min((iteration - 1) / (MAX_ITERATIONS - 1), 1);
  const hue = 120 - t * 120;
  const saturation = 70 + t * 10;
  const lightness = 55 + t * 5;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function depthColor(depth: number | null): string {
  if (depth === null) return 'text-muted-foreground';
  if (depth <= 1) return 'text-green-600 dark:text-green-400';
  if (depth <= 3) return 'text-emerald-600 dark:text-emerald-400';
  if (depth <= 5) return 'text-yellow-600 dark:text-yellow-400';
  if (depth <= 7) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

function depthLabel(depth: number, lang: string): string {
  if (depth <= 1) return lang === 'fr' ? 'Excellent' : lang === 'es' ? 'Excelente' : 'Excellent';
  if (depth <= 3) return lang === 'fr' ? 'Bon' : lang === 'es' ? 'Bueno' : 'Good';
  if (depth <= 5) return lang === 'fr' ? 'Moyen' : lang === 'es' ? 'Medio' : 'Average';
  if (depth <= 7) return lang === 'fr' ? 'Faible' : lang === 'es' ? 'Débil' : 'Weak';
  return lang === 'fr' ? 'Invisible' : lang === 'es' ? 'Invisible' : 'Invisible';
}

const MAX_DISPLAY = 7;
const SIMULATED_LOADING_MS = 30_000;

/** Streaming iteration counter for a single model */
function StreamingCounter({ iteration, found, modelName }: { iteration: number; found: boolean; modelName: string }) {
  const isDark = document.documentElement.classList.contains('dark');
  const color = found
    ? (isDark ? iterationHslColorDark(iteration) : iterationHslColor(iteration))
    : undefined;

  return (
    <div className="flex items-baseline gap-1.5">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={iteration}
          initial={{ scale: 1.6, opacity: 0, y: -4 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 4 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="text-lg font-bold tabular-nums"
          style={color ? { color } : undefined}
        >
          {iteration}
        </motion.span>
      </AnimatePresence>
      <span className="text-[10px] text-muted-foreground">/ {MAX_ITERATIONS}</span>
    </div>
  );
}

/** Progress ring for streaming state */
function MiniProgressRing({ iteration, found }: { iteration: number; found: boolean }) {
  const size = 28;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = found ? 1 : iteration / MAX_ITERATIONS;
  const offset = circumference - progress * circumference;
  const isDark = document.documentElement.classList.contains('dark');
  const color = isDark ? iterationHslColorDark(iteration) : iterationHslColor(iteration);

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={strokeWidth}
        className="opacity-20"
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
    </svg>
  );
}

export function LLMDepthCard({ domain, trackedSiteId, userId, siteContext, initialData }: LLMDepthCardProps) {
  const { language } = useLanguage();
  const { isAgencyPro } = useCredits();
  const { isAdmin } = useAdmin();
  const canViewConversations = isAgencyPro || isAdmin;
  const t = translations[language] || translations.fr;
  const [data, setData] = useState<LLMDepthData | null>(initialData ?? null);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<'completed' | 'expert_required' | null>(null);
  const [hasPreviousData, setHasPreviousData] = useState<boolean | null>(null);
  const [streamProgress, setStreamProgress] = useState<Record<string, ModelProgress>>({});
  const [conversations, setConversations] = useState<Record<string, ConversationTurn[]>>({});
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [convOpen, setConvOpen] = useState(false);
  const [convLoading, setConvLoading] = useState(false);
  const conversationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simulatedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const convLlmNames = Object.keys(conversations);

  const convTranslations = {
    fr: { conversations: 'Conversations LLM', prompt: 'Question', response: 'Réponse', iteration: 'Itération', noConversations: 'Aucune conversation enregistrée.' },
    en: { conversations: 'LLM Conversations', prompt: 'Prompt', response: 'Response', iteration: 'Iteration', noConversations: 'No conversations recorded.' },
    es: { conversations: 'Conversaciones LLM', prompt: 'Pregunta', response: 'Respuesta', iteration: 'Iteración', noConversations: 'No hay conversaciones registradas.' },
  };
  const ct = convTranslations[language] || convTranslations.fr;

  const handleOpenConversations = async () => {
    setConvOpen(true);
    if (Object.keys(conversations).length > 0) return;
    if (!trackedSiteId || !userId) return;
    setConvLoading(true);
    try {
      const { data: convData } = await supabase
        .from('llm_depth_conversations')
        .select('llm_name, iteration, prompt_text, response_summary')
        .eq('tracked_site_id', trackedSiteId)
        .eq('user_id', userId)
        .order('iteration', { ascending: true });
      if (convData?.length) {
        const grouped: Record<string, ConversationTurn[]> = {};
        for (const row of convData) {
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

  // Fetch stored conversations for paid users
  useEffect(() => {
    if (!trackedSiteId || !userId || !canViewConversations) return;
    supabase
      .from('llm_depth_conversations')
      .select('llm_name, iteration, prompt_text, response_summary')
      .eq('tracked_site_id', trackedSiteId)
      .eq('user_id', userId)
      .order('iteration', { ascending: true })
      .then(({ data: convData }) => {
        if (!convData?.length) return;
        const grouped: Record<string, ConversationTurn[]> = {};
        for (const row of convData) {
          if (!grouped[row.llm_name]) grouped[row.llm_name] = [];
          grouped[row.llm_name].push({
            iteration: row.iteration,
            prompt_text: row.prompt_text,
            response_summary: row.response_summary,
          });
        }
        setConversations(grouped);
      });
  }, [trackedSiteId, userId, canViewConversations, data]);

  // Load previous LLM depth data from database on mount
  useEffect(() => {
    if (!trackedSiteId || !userId || data) {
      if (!trackedSiteId || !userId) setHasPreviousData(false);
      return;
    }

    (async () => {
      try {
        // Get the most recent executions for this site, grouped by llm_name
        const { data: executions, error } = await supabase
          .from('llm_test_executions')
          .select('llm_name, brand_found, iteration_found, prompt_tested, response_text, created_at')
          .eq('tracked_site_id', trackedSiteId)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error || !executions?.length) {
          setHasPreviousData(false);
          return;
        }

        setHasPreviousData(true);

        // Get the latest batch timestamp (within 5 min window of most recent)
        const latestTime = new Date(executions[0].created_at).getTime();
        const batchWindow = 5 * 60 * 1000; // 5 minutes
        const batchExecutions = executions.filter(
          e => latestTime - new Date(e.created_at).getTime() < batchWindow
        );

        // Group by LLM
        const byLlm: Record<string, typeof batchExecutions> = {};
        for (const exec of batchExecutions) {
          if (!byLlm[exec.llm_name]) byLlm[exec.llm_name] = [];
          byLlm[exec.llm_name].push(exec);
        }

        const results: DepthResult[] = [];
        const depths: number[] = [];

        for (const [llmName, execs] of Object.entries(byLlm)) {
          // Find the best (earliest found) execution
          const foundExec = execs.find(e => e.brand_found);
          const iterations = foundExec ? (foundExec.iteration_found ?? 7) : 7;
          const found = !!foundExec;

          if (found) depths.push(iterations);

          // Extract mentioned_as from response
          let mentionedAs: string | null = null;
          if (foundExec?.response_text) {
            const snippet = foundExec.response_text.slice(0, 200);
            mentionedAs = snippet.length > 60 ? snippet.slice(0, 60) + '…' : snippet;
          }

          results.push({
            llm: llmName,
            model: '',
            iterations,
            found,
            mentioned_as: mentionedAs,
            conversation_summary: '',
            angles_tested: execs.map(e => e.prompt_tested.slice(0, 40)),
          });
        }

        if (results.length > 0) {
          const avgDepth = depths.length > 0
            ? Math.round((depths.reduce((a, b) => a + b, 0) / depths.length) * 10) / 10
            : null;

          setData({
            brand: domain,
            domain,
            avg_depth: avgDepth,
            results,
            prompt_strategy: 'multi-angle',
            measured_at: executions[0].created_at,
          });
        }
      } catch (err) {
        console.error('[LLMDepthCard] Failed to load previous data:', err);
        setHasPreviousData(false);
      }
    })();
  }, [trackedSiteId, userId, domain]);

  const handleRefresh = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setBanner(null);
    setStreamProgress({});

    abortRef.current = new AbortController();

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // Get auth token for the request
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await fetch(`${supabaseUrl}/functions/v1/check-llm-depth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken || supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({
          domain,
          lang: language,
          tracked_site_id: trackedSiteId,
          user_id: userId,
          site_context: siteContext,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok || !response.body) {
        console.error('[LLMDepthCard] Stream response error:', response.status);
        setLoading(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));

            if (evt.type === 'iteration') {
              setStreamProgress(prev => ({
                ...prev,
                [evt.model]: { iteration: evt.iteration, found: false },
              }));
            } else if (evt.type === 'found') {
              setStreamProgress(prev => ({
                ...prev,
                [evt.model]: { iteration: evt.iteration, found: true, mentioned_as: evt.mentioned_as },
              }));
            } else if (evt.type === 'done') {
              const responseData = evt.data as LLMDepthData;

              if (responseData?.error_code === 'credits_exhausted') {
                if (hasPreviousData || data) {
                  await new Promise<void>((resolve) => {
                    simulatedTimerRef.current = setTimeout(resolve, SIMULATED_LOADING_MS);
                  });
                  setBanner('completed');
                } else {
                  setBanner('expert_required');
                }
              } else if (responseData?.results?.length > 0) {
                setData(responseData);
                setHasPreviousData(true);
              }
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('[LLMDepthCard] stream error:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [loading, domain, language, trackedSiteId, userId, siteContext, hasPreviousData, data]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (simulatedTimerRef.current) clearTimeout(simulatedTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  // ── Streaming loading state ──────────────────────────────────────────────
  if (loading) {
    const hasAnyProgress = Object.keys(streamProgress).length > 0;
    return (
      <Card className="relative border-2 border-violet-500/40 dark:border-violet-400/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.analyzing}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {MODELS_LIST.map((modelName) => {
              const progress = streamProgress[modelName];
              const iteration = progress?.iteration ?? 0;
              const found = progress?.found ?? false;
              const isActive = iteration > 0 && !found;

              return (
                <motion.div
                  key={modelName}
                  className="rounded-lg border bg-card p-2.5 space-y-1.5"
                  initial={{ opacity: 0.5 }}
                  animate={{ opacity: iteration > 0 ? 1 : 0.5 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{modelName}</span>
                    {found ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      </motion.div>
                    ) : iteration > 0 ? (
                      <MiniProgressRing iteration={iteration} found={found} />
                    ) : (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/40" />
                    )}
                  </div>

                  {iteration > 0 ? (
                    <StreamingCounter iteration={iteration} found={found} modelName={modelName} />
                  ) : (
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-bold text-muted-foreground/30">—</span>
                      <span className="text-[10px] text-muted-foreground/40">/ {MAX_ITERATIONS}</span>
                    </div>
                  )}

                  {found && progress?.mentioned_as && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[10px] text-muted-foreground truncate"
                    >
                      → {progress.mentioned_as}
                    </motion.p>
                  )}

                  {isActive && (
                    <motion.div
                      className="h-0.5 rounded-full overflow-hidden bg-muted/30"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          background: `linear-gradient(90deg, ${iterationHslColor(1)}, ${iterationHslColor(iteration)})`,
                        }}
                        initial={{ width: '0%' }}
                        animate={{ width: `${(iteration / MAX_ITERATIONS) * 100}%` }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                      />
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
          {!hasAnyProgress && (
            <p className="text-[10px] text-center text-muted-foreground/60">{t.scanning}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Banner: "Analyse terminée" (user has prior data, credits exhausted)
  if (banner === 'completed') {
    return (
      <Card className="relative border-2 border-violet-500/40 dark:border-violet-400/30">
        <CardContent className="py-6 space-y-4">
          {data && (
            <div className="space-y-3 mb-4">
              <div className="rounded-lg border bg-card p-3 space-y-1">
                <div className="text-xs text-muted-foreground">{t.avgDepth}</div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-bold ${depthColor(data.avg_depth)}`}>
                    {data.avg_depth !== null ? data.avg_depth : '—'}
                  </span>
                  <span className="text-xs text-muted-foreground">/ 7 {t.iterations}</span>
                </div>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-sm text-emerald-700 dark:text-emerald-300">{t.completed}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t.completedDesc}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => setBanner(null)}>
            <RefreshCw className="h-3 w-3" />
            OK
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Banner: "Audit expert requis"
  if (banner === 'expert_required') {
    return (
      <Card className="relative border-2 border-violet-500/40 dark:border-violet-400/30">
        <CardContent className="py-6 text-center space-y-3">
          <FileSearch className="h-8 w-8 mx-auto text-amber-500 opacity-70" />
          <div className="space-y-1">
            <p className="font-semibold text-sm text-amber-700 dark:text-amber-400">{t.expertRequired}</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">{t.expertRequiredDesc}</p>
          </div>
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => setBanner(null)}>
            OK
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="relative border-2 border-violet-500/40 dark:border-violet-400/30">
        <CardContent className="py-6 text-center text-muted-foreground text-sm">
          <Layers className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p>{t.noData}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 gap-2"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t.analyze}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative border-2 border-violet-500/40 dark:border-violet-400/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Layers className="h-4 w-4" />
          {t.title}
          <Badge variant="secondary" className="text-[10px] font-normal">{t.subtitle}</Badge>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">{t.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {data.measured_at && (
            <span className="ml-auto text-[10px] text-muted-foreground font-normal mr-6">
              {new Date(data.measured_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US')}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 absolute bottom-3 right-3"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Average depth score */}
        <div className="rounded-lg border bg-card p-3 space-y-1">
          <div className="text-xs text-muted-foreground">{t.avgDepth}</div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${depthColor(data.avg_depth)}`}>
              {data.avg_depth !== null ? data.avg_depth : '—'}
            </span>
            <span className="text-xs text-muted-foreground">/ 7 {t.iterations}</span>
            {data.avg_depth !== null && (
              <Badge variant="outline" className={`text-[10px] ml-auto ${depthColor(data.avg_depth)}`}>
                {depthLabel(data.avg_depth, language)}
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-end gap-1 pt-1">
            <span className="text-[9px] text-muted-foreground/60">
              {language === 'es' ? 'Necesidad genérica → Caso de uso → Función' : language === 'en' ? 'Generic need → Use case → Feature' : 'Besoin générique → Cas d\'usage → Fonction'}
            </span>
            <RefreshCw className="h-2.5 w-2.5 text-muted-foreground/40" />
          </div>
        </div>

        {/* Per-model results */}
        <div className="grid grid-cols-2 gap-2">
          {data.results.map((result) => {
            const isDark = document.documentElement.classList.contains('dark');
            const color = isDark ? iterationHslColorDark(result.iterations) : iterationHslColor(result.iterations);
            const hasConv = canViewConversations && conversations[result.llm]?.length > 0;
            const isOpen = activeConversation === result.llm;

            return (
              <div
                key={result.llm}
                className="relative rounded-lg border bg-card p-2.5 space-y-1.5"
                onMouseLeave={() => {
                  if (isOpen) {
                    conversationTimeoutRef.current = setTimeout(() => {
                      setActiveConversation(null);
                    }, 400);
                  }
                }}
                onMouseEnter={() => {
                  if (conversationTimeoutRef.current) {
                    clearTimeout(conversationTimeoutRef.current);
                    conversationTimeoutRef.current = null;
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{result.llm}</span>
                  {result.found ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-400" />
                  )}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="text-lg font-semibold"
                    style={{ color }}
                  >
                    {result.found ? result.iterations : `${MAX_DISPLAY}+`}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {result.found ? t.found : t.notFound}
                  </span>
                </div>
                {result.found && result.mentioned_as && (
                  <p className="text-[10px] text-muted-foreground truncate" title={result.mentioned_as}>
                    → {result.mentioned_as}
                  </p>
                )}

                {/* Conversation toggle arrow - paid users only */}
                {hasConv && (
                  <button
                    className="absolute bottom-1.5 right-1.5 p-0.5 rounded hover:bg-muted/50 transition-colors"
                    onClick={() => setActiveConversation(isOpen ? null : result.llm)}
                    aria-label="Voir la conversation"
                  >
                    <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                )}

                {/* Conversation popover */}
                <AnimatePresence>
                  {isOpen && hasConv && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scaleY: 0.95 }}
                      animate={{ opacity: 1, y: 0, scaleY: 1 }}
                      exit={{ opacity: 0, y: -4, scaleY: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border bg-card shadow-lg max-h-64 overflow-y-auto p-2 space-y-2"
                      style={{ minWidth: '280px' }}
                      onMouseEnter={() => {
                        if (conversationTimeoutRef.current) {
                          clearTimeout(conversationTimeoutRef.current);
                          conversationTimeoutRef.current = null;
                        }
                      }}
                      onMouseLeave={() => {
                        conversationTimeoutRef.current = setTimeout(() => {
                          setActiveConversation(null);
                        }, 300);
                      }}
                    >
                      {conversations[result.llm].map((turn) => (
                        <div key={turn.iteration} className="space-y-1">
                          {/* Prompt (Crawlers) in violet */}
                          <div className="flex gap-1.5">
                            <span className="text-[9px] font-bold text-violet-500 shrink-0 mt-0.5">Q{turn.iteration}</span>
                            <p className="text-[10px] text-violet-600 dark:text-violet-400 leading-tight">
                              {turn.prompt_text.length > 120 ? turn.prompt_text.slice(0, 120) + '…' : turn.prompt_text}
                            </p>
                          </div>
                          {/* Response summary */}
                          <div className="flex gap-1.5 ml-3">
                            <span className="text-[9px] font-bold text-muted-foreground shrink-0 mt-0.5">R</span>
                            <p className="text-[10px] text-foreground/80 leading-tight">
                              {turn.response_summary}
                            </p>
                          </div>
                          {turn.iteration < (conversations[result.llm]?.length ?? 0) && (
                            <div className="border-b border-border/50" />
                          )}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
