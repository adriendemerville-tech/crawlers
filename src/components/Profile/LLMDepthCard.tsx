import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, RefreshCw, Layers, GripVertical, Info, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

interface DepthResult {
  llm: string;
  model: string;
  iterations: number;
  found: boolean;
  conversation_summary: string;
}

interface LLMDepthData {
  brand: string;
  domain: string;
  avg_depth: number | null;
  results: DepthResult[];
  measured_at: string;
}

interface LLMDepthCardProps {
  domain: string;
  initialData?: LLMDepthData | null;
}

const translations = {
  fr: {
    title: 'Profondeur LLM',
    subtitle: 'Découvrabilité conversationnelle',
    noData: 'Mesurez en combien d\'échanges les LLMs citent votre marque.',
    analyze: 'Analyser',
    analyzing: 'Analyse en cours…',
    avgDepth: 'Profondeur moyenne',
    iterations: 'itérations',
    found: 'Cité',
    notFound: 'Non cité',
    tooltip: 'Nombre d\'échanges nécessaires avant que le LLM cite votre marque lors d\'une recherche naturelle. Plus le chiffre est bas, meilleure est votre visibilité.',
  },
  en: {
    title: 'LLM Depth',
    subtitle: 'Conversational discoverability',
    noData: 'Measure how many exchanges it takes for LLMs to cite your brand.',
    analyze: 'Analyze',
    analyzing: 'Analyzing…',
    avgDepth: 'Average depth',
    iterations: 'iterations',
    found: 'Cited',
    notFound: 'Not cited',
    tooltip: 'Number of exchanges needed before the LLM cites your brand during a natural search. Lower is better.',
  },
  es: {
    title: 'Profundidad LLM',
    subtitle: 'Descubribilidad conversacional',
    noData: 'Mida en cuántos intercambios los LLMs citan su marca.',
    analyze: 'Analizar',
    analyzing: 'Analizando…',
    avgDepth: 'Profundidad promedio',
    iterations: 'iteraciones',
    found: 'Citado',
    notFound: 'No citado',
    tooltip: 'Número de intercambios necesarios antes de que el LLM cite su marca durante una búsqueda natural. Menos es mejor.',
  },
};

function depthColor(depth: number | null): string {
  if (depth === null) return 'text-muted-foreground';
  if (depth <= 1) return 'text-green-600 dark:text-green-400';
  if (depth <= 2) return 'text-emerald-600 dark:text-emerald-400';
  if (depth <= 3) return 'text-yellow-600 dark:text-yellow-400';
  if (depth <= 5) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

function depthLabel(depth: number, lang: string): string {
  if (depth <= 1) return lang === 'fr' ? 'Excellent' : lang === 'es' ? 'Excelente' : 'Excellent';
  if (depth <= 2) return lang === 'fr' ? 'Bon' : lang === 'es' ? 'Bueno' : 'Good';
  if (depth <= 3) return lang === 'fr' ? 'Moyen' : lang === 'es' ? 'Medio' : 'Average';
  if (depth <= 5) return lang === 'fr' ? 'Faible' : lang === 'es' ? 'Débil' : 'Weak';
  return lang === 'fr' ? 'Invisible' : lang === 'es' ? 'Invisible' : 'Invisible';
}

export function LLMDepthCard({ domain, initialData }: LLMDepthCardProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const [data, setData] = useState<LLMDepthData | null>(initialData ?? null);
  const [loading, setLoading] = useState(false);

  const handleRefresh = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await supabase.functions.invoke('check-llm-depth', {
        body: { domain, lang: language },
      });
      if (response.data?.data) {
        setData(response.data.data);
      }
    } catch (err) {
      console.error('[LLMDepthCard] refresh error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!data) {
    return (
      <Card className="relative border-2 border-violet-500/40 dark:border-violet-400/30">
        <button className="absolute top-2 right-2 z-10 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted transition-colors" aria-label="Déplacer">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
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
      <button className="absolute top-2 right-2 z-10 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted transition-colors" aria-label="Déplacer">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
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
        <div className="flex items-center gap-4">
          <div className="rounded-lg border bg-card p-3 flex-1 space-y-1">
            <div className="text-xs text-muted-foreground">{t.avgDepth}</div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${depthColor(data.avg_depth)}`}>
                {data.avg_depth !== null ? data.avg_depth : '—'}
              </span>
              <span className="text-xs text-muted-foreground">{t.iterations}</span>
              {data.avg_depth !== null && (
                <Badge variant="outline" className={`text-[10px] ml-auto ${depthColor(data.avg_depth)}`}>
                  {depthLabel(data.avg_depth, language)}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Per-model results */}
        <div className="grid grid-cols-2 gap-3">
          {data.results.map((result) => (
            <div key={result.llm} className="rounded-lg border bg-card p-3 space-y-2">
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
                  {result.found ? result.iterations : `${result.iterations - 1}+`}
                </span>
                <span className="text-[10px] text-muted-foreground">{t.iterations}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {result.found ? t.found : t.notFound}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
