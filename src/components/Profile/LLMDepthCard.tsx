import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, RefreshCw, Layers, Info, CheckCircle2, XCircle, AlertTriangle, FileSearch } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

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
  },
};

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

export function LLMDepthCard({ domain, trackedSiteId, userId, siteContext, initialData }: LLMDepthCardProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const [data, setData] = useState<LLMDepthData | null>(initialData ?? null);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<'completed' | 'expert_required' | null>(null);
  const [hasPreviousData, setHasPreviousData] = useState<boolean | null>(null);
  const simulatedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if user has previous LLM depth data for this site
  useEffect(() => {
    if (!trackedSiteId || !userId) {
      setHasPreviousData(false);
      return;
    }
    supabase
      .from('llm_test_executions')
      .select('id', { count: 'exact', head: true })
      .eq('tracked_site_id', trackedSiteId)
      .eq('user_id', userId)
      .then(({ count }) => {
        setHasPreviousData((count ?? 0) > 0);
      });
  }, [trackedSiteId, userId]);

  const handleRefresh = async () => {
    if (loading) return;
    setLoading(true);
    setBanner(null);

    try {
      const response = await supabase.functions.invoke('check-llm-depth', {
        body: {
          domain,
          lang: language,
          tracked_site_id: trackedSiteId,
          user_id: userId,
          site_context: siteContext,
        },
      });

      const responseData = response.data?.data as LLMDepthData | undefined;

      // Credits exhausted scenario
      if (responseData?.error_code === 'credits_exhausted') {
        if (hasPreviousData || data) {
          // User has previous data: simulate 30s loading then show "terminé" banner
          await new Promise<void>((resolve) => {
            simulatedTimerRef.current = setTimeout(resolve, SIMULATED_LOADING_MS);
          });
          setBanner('completed');
        } else {
          // User never used depth: show "audit expert requis" immediately
          setBanner('expert_required');
        }
        setLoading(false);
        return;
      }

      if (responseData && responseData.results && responseData.results.length > 0) {
        setData(responseData);
        setHasPreviousData(true);
      }
    } catch (err) {
      console.error('[LLMDepthCard] refresh error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (simulatedTimerRef.current) clearTimeout(simulatedTimerRef.current);
    };
  }, []);

  // Banner: "Analyse terminée" (user has prior data, credits exhausted)
  if (banner === 'completed') {
    return (
      <Card className="relative border-2 border-violet-500/40 dark:border-violet-400/30">
        <CardContent className="py-6 space-y-4">
          {/* Show existing data if available */}
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
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => setBanner(null)}
          >
            <RefreshCw className="h-3 w-3" />
            OK
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Banner: "Audit expert requis" (user never used depth, credits exhausted)
  if (banner === 'expert_required') {
    return (
      <Card className="relative border-2 border-violet-500/40 dark:border-violet-400/30">
        <CardContent className="py-6 text-center space-y-3">
          <FileSearch className="h-8 w-8 mx-auto text-amber-500 opacity-70" />
          <div className="space-y-1">
            <p className="font-semibold text-sm text-amber-700 dark:text-amber-400">{t.expertRequired}</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">{t.expertRequiredDesc}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => setBanner(null)}
          >
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
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {loading ? t.analyzing : t.analyze}
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
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
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
        </div>

        {/* Per-model results */}
        <div className="grid grid-cols-2 gap-2">
          {data.results.map((result) => (
            <div key={result.llm} className="rounded-lg border bg-card p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{result.llm}</span>
                {result.found ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-red-400" />
                )}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-lg font-semibold ${depthColor(result.iterations)}`}>
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
              {result.angles_tested?.length > 0 && (
                <p className="text-[9px] text-muted-foreground/60 truncate" title={result.angles_tested.join(' → ')}>
                  {result.angles_tested.join(' → ')}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
