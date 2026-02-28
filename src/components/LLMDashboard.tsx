import { useState } from 'react';
import { LLMAnalysisResult, SentimentType } from '@/types/llm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Brain, 
  ExternalLink, 
  Clock, 
  Eye, 
  EyeOff, 
  ThumbsUp, 
  ThumbsDown,
  Minus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  Target,
  Search,
  Loader2,
  Scale
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { HelpButton } from './HelpButton';
import { LLMTargetQueriesCard } from './LLMTargetQueriesCard';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface LLMDashboardProps {
  result: LLMAnalysisResult | null;
  isLoading: boolean;
}

function ScoreGauge({ score }: { score: number }) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-success';
    if (s >= 50) return 'text-warning';
    return 'text-destructive';
  };

  const getScoreRingColor = (s: number) => {
    if (s >= 80) return 'stroke-success';
    if (s >= 50) return 'stroke-warning';
    return 'stroke-destructive';
  };

  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center">
      <svg className="h-36 w-36 -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted/30"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={cn("transition-all duration-1000", getScoreRingColor(score))}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-4xl font-bold", getScoreColor(score))}>{score}</span>
        <span className="text-sm text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

const sentimentTranslations = {
  fr: {
    positive: 'très positif !',
    mostly_positive: 'plutôt positif.',
    neutral: 'Neutre',
    mixed: 'Mitigé',
    negative: 'Négatif',
    mixedTooltip: 'Avis partagés ou controverses détectées',
    positiveDesc: 'Les LLMs ont une opinion très favorable de ce site.',
    mostly_positiveDesc: 'Les LLMs ont une opinion globalement positive avec quelques réserves.',
    neutralDesc: 'Les LLMs n\'ont pas d\'opinion marquée sur ce site.',
    mixedDesc: 'Les LLMs ont des opinions partagées ou contradictoires.',
    negativeDesc: 'Les LLMs ont une opinion défavorable de ce site.',
    legendTitle: 'Échelle de sentiment :',
    legendValues: ['très positif !', 'plutôt positif.', 'Neutre', 'Mitigé', 'Négatif'],
  },
  en: {
    positive: 'very positive!',
    mostly_positive: 'mostly positive.',
    neutral: 'Neutral',
    mixed: 'Mixed',
    negative: 'Negative',
    mixedTooltip: 'Mixed opinions or controversies detected',
    positiveDesc: 'LLMs have a very favorable opinion of this site.',
    mostly_positiveDesc: 'LLMs have an overall positive opinion with some reservations.',
    neutralDesc: 'LLMs have no strong opinion about this site.',
    mixedDesc: 'LLMs have mixed or contradictory opinions.',
    negativeDesc: 'LLMs have an unfavorable opinion of this site.',
    legendTitle: 'Sentiment scale:',
    legendValues: ['very positive!', 'mostly positive.', 'Neutral', 'Mixed', 'Negative'],
  },
  es: {
    positive: '¡muy positivo!',
    mostly_positive: 'mayormente positivo.',
    neutral: 'Neutro',
    mixed: 'Mixto',
    negative: 'Negativo',
    mixedTooltip: 'Opiniones divididas o controversias detectadas',
    positiveDesc: 'Los LLMs tienen una opinión muy favorable de este sitio.',
    mostly_positiveDesc: 'Los LLMs tienen una opinión generalmente positiva con algunas reservas.',
    neutralDesc: 'Los LLMs no tienen una opinión marcada sobre este sitio.',
    mixedDesc: 'Los LLMs tienen opiniones mixtas o contradictorias.',
    negativeDesc: 'Los LLMs tienen una opinión desfavorable de este sitio.',
    legendTitle: 'Escala de sentimiento:',
    legendValues: ['¡muy positivo!', 'mayormente positivo.', 'Neutro', 'Mixto', 'Negativo'],
  },
};

function SentimentBadge({ sentiment, language }: { sentiment: SentimentType; language: string }) {
  const st = sentimentTranslations[language as keyof typeof sentimentTranslations] || sentimentTranslations.fr;
  
  const config: Record<SentimentType, { icon: typeof CheckCircle2; label: string; className: string }> = {
    positive: { 
      icon: CheckCircle2, 
      label: st.positive, 
      className: 'bg-green-200 text-green-900 border-green-400 font-semibold dark:bg-green-700/50 dark:text-green-200 dark:border-green-500' 
    },
    mostly_positive: { 
      icon: ThumbsUp, 
      label: st.mostly_positive, 
      className: 'bg-teal-50 text-teal-700 border-teal-200/60 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-700/50' 
    },
    neutral: { 
      icon: Minus, 
      label: st.neutral, 
      className: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700' 
    },
    mixed: { 
      icon: Scale, 
      label: st.mixed, 
      className: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800' 
    },
    negative: { 
      icon: XCircle, 
      label: st.negative, 
      className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' 
    },
  };
  
  // Fallback to neutral if sentiment is unknown
  const sentimentKey = Object.keys(config).includes(sentiment) ? sentiment : 'neutral';
  const { icon: Icon, label, className } = config[sentimentKey];
  
  const badge = (
    <Badge variant="outline" className={cn("gap-1.5 px-3 py-1.5", className)}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Badge>
  );
  
  // Add tooltip for "mixed" sentiment
  if (sentimentKey === 'mixed') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badge}
          </TooltipTrigger>
          <TooltipContent>
            <p>{st.mixedTooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  return badge;
}

interface HallucinationDiagnosis {
  trueValue: string;
  hallucinationAnalysis: string | { status?: string; details?: string };
  confusionSources: (string | { source?: string; description?: string })[];
  recommendations: (string | { action?: string; description?: string })[];
}

// Helper to safely extract text from potentially complex objects
function safeText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // Try common fields
    if (obj.details) return String(obj.details);
    if (obj.description) return String(obj.description);
    if (obj.status) return String(obj.status);
    if (obj.action) return String(obj.action);
    if (obj.source) return String(obj.source);
    // Fallback to JSON
    return JSON.stringify(value);
  }
  return String(value);
}

const methodologyTranslations = {
  fr: {
    title: 'Méthodologie d\'interrogation',
    description: 'Chaque LLM a été interrogé avec un prompt standardisé demandant s\'il connaît le site cible, quelle est sa proposition de valeur, et s\'il le recommande. Les réponses sont analysées pour extraire le sentiment, les citations et les éventuelles hallucinations.',
    models: 'Modèles interrogés',
    prompt: 'Type de prompt',
    promptDesc: 'Demande directe de connaissance + recommandation',
  },
  en: {
    title: 'Query Methodology',
    description: 'Each LLM was queried with a standardized prompt asking if it knows the target site, what its value proposition is, and if it recommends it. Responses are analyzed to extract sentiment, citations, and potential hallucinations.',
    models: 'Models queried',
    prompt: 'Prompt type',
    promptDesc: 'Direct knowledge + recommendation request',
  },
  es: {
    title: 'Metodología de consulta',
    description: 'Cada LLM fue consultado con un prompt estandarizado preguntando si conoce el sitio objetivo, cuál es su propuesta de valor y si lo recomienda. Las respuestas se analizan para extraer el sentimiento, las citaciones y las posibles alucinaciones.',
    models: 'Modelos consultados',
    prompt: 'Tipo de prompt',
    promptDesc: 'Solicitud directa de conocimiento + recomendación',
  },
};

const hallucinationTranslations = {
  fr: {
    diagnoseButton: 'Diagnostic Hallucination',
    diagnosing: 'Analyse en cours...',
    modalTitle: 'Diagnostic des Hallucinations IA',
    modalDescription: 'Analyse des erreurs de perception et recommandations pour améliorer la visibilité LLM',
    trueValue: 'Vraie Proposition de Valeur',
    analysis: 'Analyse des Hallucinations',
    confusionSources: 'Sources de Confusion',
    recommendations: 'Recommandations',
    errorTitle: 'Erreur',
    errorDesc: 'Impossible de générer le diagnostic. Veuillez réessayer.',
    noCitation: 'Aucune citation explicite des LLMs n\'a été constatée.',
  },
  en: {
    diagnoseButton: 'Hallucination Diagnosis',
    diagnosing: 'Analyzing...',
    modalTitle: 'AI Hallucination Diagnosis',
    modalDescription: 'Analysis of perception errors and recommendations to improve LLM visibility',
    trueValue: 'True Value Proposition',
    analysis: 'Hallucination Analysis',
    confusionSources: 'Confusion Sources',
    recommendations: 'Recommendations',
    errorTitle: 'Error',
    errorDesc: 'Unable to generate diagnosis. Please try again.',
    noCitation: 'No explicit citation from LLMs was observed.',
  },
  es: {
    diagnoseButton: 'Diagnóstico Alucinación',
    diagnosing: 'Analizando...',
    modalTitle: 'Diagnóstico de Alucinaciones IA',
    modalDescription: 'Análisis de errores de percepción y recomendaciones para mejorar la visibilidad LLM',
    trueValue: 'Verdadera Propuesta de Valor',
    analysis: 'Análisis de Alucinaciones',
    confusionSources: 'Fuentes de Confusión',
    recommendations: 'Recomendaciones',
    errorTitle: 'Error',
    errorDesc: 'No se pudo generar el diagnóstico. Por favor, inténtelo de nuevo.',
    noCitation: 'No se observó ninguna citación explícita de los LLMs.',
  },
};

export function LLMDashboard({ result, isLoading }: LLMDashboardProps) {
  const { t, language } = useLanguage();
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosisModalOpen, setDiagnosisModalOpen] = useState(false);
  const [diagnosis, setDiagnosis] = useState<HallucinationDiagnosis | null>(null);

  const ht = hallucinationTranslations[language as keyof typeof hallucinationTranslations] || hallucinationTranslations.fr;
  const mt = methodologyTranslations[language as keyof typeof methodologyTranslations] || methodologyTranslations.fr;

  const handleDiagnoseHallucination = async () => {
    if (!result) return;

    setIsDiagnosing(true);
    setDiagnosisModalOpen(true);

    try {
      // Collect all hallucinations from citations
      const allHallucinations = result.citations
        .filter(c => c.hallucinations && c.hallucinations.length > 0)
        .flatMap(c => c.hallucinations!);

      const { data, error } = await supabase.functions.invoke('diagnose-hallucination', {
        body: {
          domain: result.domain,
          coreValueSummary: result.coreValueSummary,
          hallucinations: allHallucinations,
          lang: language,
        },
      });

      if (error) throw error;

      if (data?.success && data?.data) {
        setDiagnosis(data.data);
      } else {
        throw new Error(data?.error || 'Diagnosis failed');
      }
    } catch (error) {
      console.error('Diagnosis error:', error);
      toast({
        title: ht.errorTitle,
        description: ht.errorDesc,
        variant: 'destructive',
      });
      setDiagnosisModalOpen(false);
    } finally {
      setIsDiagnosing(false);
    }
  };

  if (isLoading) {
    return (
      <section className="px-4 pb-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 rounded-xl border border-border bg-card p-8 card-shadow">
            <div className="flex flex-col items-center gap-6 lg:flex-row lg:justify-between">
              <div className="flex flex-col items-center lg:items-start">
                <Skeleton className="mb-2 h-6 w-32" />
                <Skeleton className="h-8 w-48" />
                <Skeleton className="mt-2 h-4 w-36" />
              </div>
              <Skeleton className="h-36 w-36 rounded-full" />
            </div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-6 w-32 mb-4" />
                <Skeleton className="h-20 w-full" />
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!result) return null;

  return (
    <section className="px-4 pb-12">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header with score */}
        <div className="rounded-xl border border-border bg-card p-8 card-shadow">
          <div className="flex flex-col items-center gap-6 lg:flex-row lg:justify-between">
            <div className="flex flex-col items-center lg:items-start">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1">
                <Brain className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">{t.llm.title}</span>
              </div>
              <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
                {result.domain}
                <a 
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </h2>
              <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(result.scannedAt).toLocaleTimeString()}
                </span>
                <span>{result.citationRate.cited}/{result.citationRate.total} {t.llm.llmsCite}</span>
              </div>
            </div>

            <div className="text-center">
              <ScoreGauge score={result.overallScore} />
              <p className="mt-2 text-sm font-medium text-muted-foreground">{t.llm.overallVisibility}</p>
            </div>
          </div>
        </div>

        {/* Quantitative Dashboard */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Citation Rate Card */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Eye className="h-5 w-5 text-primary" />
                {t.llm.citationRate}
                <HelpButton term="taux-de-citation" size="sm" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl font-bold text-foreground">
                  {result.citationRate.cited}
                  <span className="text-lg text-muted-foreground">/{result.citationRate.total}</span>
                </span>
                <span className={cn(
                  "text-sm font-medium px-2 py-1 rounded-full",
                  result.citationRate.cited >= result.citationRate.total * 0.7
                    ? "bg-success/10 text-success"
                    : result.citationRate.cited >= result.citationRate.total * 0.4
                    ? "bg-warning/10 text-warning"
                    : "bg-destructive/10 text-destructive"
                )}>
                  {Math.round((result.citationRate.cited / result.citationRate.total) * 100)}% {t.llm.coverage}
                </span>
              </div>
              <Progress 
                value={(result.citationRate.cited / result.citationRate.total) * 100} 
                className="h-2"
              />
              <p className="mt-3 text-sm text-muted-foreground">
                {t.llm.citationRateDesc}
              </p>
            </CardContent>
          </Card>

          {/* Invisible List Card */}
          <Card className="overflow-hidden border-warning/30">
            <CardHeader className="pb-3 bg-warning/5">
              <CardTitle className="flex items-center gap-2 text-base text-warning">
                <EyeOff className="h-5 w-5" />
                {t.llm.invisibleList}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {result.invisibleList.length === 0 ? (
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">{t.llm.visibleAllLlms}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {result.invisibleList.map((provider) => (
                    <div 
                      key={provider.id}
                      className="flex items-center justify-between rounded-lg bg-warning/5 px-3 py-2"
                    >
                      <span className="font-medium text-foreground">{provider.name}</span>
                      <span className="text-sm text-muted-foreground">{provider.company}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Qualitative Analysis */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Iteration Depth */}
          <Card className={cn(result.citationRate.cited === 0 && "opacity-60")}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className={cn("h-5 w-5", result.citationRate.cited === 0 ? "text-muted-foreground" : "text-primary")} />
                {t.llm.iterationDepth}
                <HelpButton term="profondeur-iteration" size="sm" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3">
                <span className={cn("text-3xl font-bold", result.citationRate.cited === 0 ? "text-muted-foreground" : "text-foreground")}>
                  {result.averageIterationDepth.toFixed(1)}
                </span>
                <span className="text-sm text-muted-foreground ml-1">{t.llm.avgPrompts}</span>
              </div>
              {result.citationRate.cited > 0 && (
                <Progress 
                  value={(5 - result.averageIterationDepth) / 4 * 100} 
                  className={cn(
                    "h-2",
                    result.averageIterationDepth <= 2 
                      ? "[&>div]:bg-success" 
                      : result.averageIterationDepth <= 3.5
                      ? "[&>div]:bg-warning"
                      : "[&>div]:bg-destructive"
                  )}
                />
              )}
              <p className="mt-3 text-sm text-muted-foreground">
                {result.citationRate.cited === 0
                  ? ht.noCitation
                  : result.averageIterationDepth <= 2 
                  ? t.llm.iterationExcellent
                  : result.averageIterationDepth <= 3.5
                  ? t.llm.iterationModerate
                  : t.llm.iterationDeep}
              </p>
            </CardContent>
          </Card>

          {/* Sentiment Analysis */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-5 w-5 text-primary" />
                {t.llm.sentimentAnalysis}
                <HelpButton term="analyse-sentiment" size="sm" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <SentimentBadge sentiment={result.overallSentiment} language={language} />
                <p className="text-sm text-muted-foreground">
                  {(() => {
                    const st = sentimentTranslations[language as keyof typeof sentimentTranslations] || sentimentTranslations.fr;
                    const descKey = `${result.overallSentiment}Desc` as keyof typeof st;
                    return st[descKey] || st.neutralDesc;
                  })()}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Recommendation Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                {result.overallRecommendation ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                {t.llm.recommendationStatus}
                <HelpButton term="e-e-a-t" size="sm" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
                result.overallRecommendation
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
              )}>
                {result.overallRecommendation ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    {t.llm.llmsRecommend}
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" />
                    {t.llm.notRecommended}
                  </>
                )}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {result.overallRecommendation
                  ? t.llm.llmsRecommendDesc
                  : t.llm.notRecommendedDesc}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Core Value Understanding */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-primary" />
              {t.llm.coreValueUnderstanding}
              <HelpButton term="hallucination-ia" size="sm" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-foreground leading-relaxed">
                {result.coreValueSummary}
              </p>
            </div>
            {result.citations.some(c => c.hallucinations && c.hallucinations.length > 0) && (
              <div className="mt-4 rounded-lg border border-warning/30 bg-warning/5 p-4">
                <p className="flex items-center gap-2 text-sm font-medium text-warning mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  {t.llm.hallucinationsDetected}
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {result.citations
                    .filter(c => c.hallucinations && c.hallucinations.length > 0)
                    .flatMap(c => c.hallucinations!)
                    .slice(0, 3)
                    .map((h, i) => (
                      <li key={i}>• {h}</li>
                    ))}
                </ul>
              </div>
            )}
            
            {/* Hallucination Diagnosis Button */}
            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDiagnoseHallucination}
                disabled={isDiagnosing}
                className="gap-2 border-foreground text-foreground hover:bg-muted hover:text-foreground"
              >
                {isDiagnosing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {ht.diagnosing}
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    {ht.diagnoseButton}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Hallucination Diagnosis Modal */}
        <Dialog open={diagnosisModalOpen} onOpenChange={setDiagnosisModalOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                {ht.modalTitle}
              </DialogTitle>
              <DialogDescription>
                {ht.modalDescription}
              </DialogDescription>
            </DialogHeader>

            {isDiagnosing ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">{ht.diagnosing}</p>
              </div>
            ) : diagnosis ? (
              <div className="space-y-6">
                {/* True Value */}
                <div className="rounded-lg border border-success/30 bg-success/5 p-4">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-success mb-2">
                    <CheckCircle2 className="h-4 w-4" />
                    {ht.trueValue}
                  </h4>
                  <p className="text-sm text-foreground leading-relaxed">
                    {diagnosis.trueValue}
                  </p>
                </div>

                {/* Hallucination Analysis */}
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    {ht.analysis}
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {safeText(diagnosis.hallucinationAnalysis)}
                  </p>
                </div>

                {/* Confusion Sources */}
                {diagnosis.confusionSources && diagnosis.confusionSources.length > 0 && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-destructive mb-2">
                      <XCircle className="h-4 w-4" />
                      {ht.confusionSources}
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {diagnosis.confusionSources.map((source, i) => (
                        <li key={i}>• {safeText(source)}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommendations */}
                {diagnosis.recommendations && diagnosis.recommendations.length > 0 && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-primary mb-2">
                      <Sparkles className="h-4 w-4" />
                      {ht.recommendations}
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      {diagnosis.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-primary font-medium">{i + 1}.</span>
                          <span>{safeText(rec)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        {/* Methodology Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-foreground mb-1">
                  {mt.title}
                </h4>
                <p className="text-sm text-muted-foreground mb-3">
                  {mt.description}
                </p>
                <div className="flex flex-wrap gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground">{mt.models} : </span>
                    <span className="font-medium text-foreground">
                      {result.citations.map(c => c.provider.name).join(', ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{mt.prompt} : </span>
                    <span className="font-medium text-foreground">{mt.promptDesc}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Individual LLM Cards */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">{t.llm.detailedAnalysis}</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {result.citations.map((citation) => (
              <Card 
                key={citation.provider.id}
                className={cn(
                  "transition-all",
                  citation.cited 
                    ? "border-success/30 bg-success/5" 
                    : "border-destructive/30 bg-destructive/5"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-foreground">{citation.provider.name}</p>
                      <p className="text-xs text-muted-foreground">{citation.provider.company}</p>
                    </div>
                    {citation.cited ? (
                      <Eye className="h-5 w-5 text-success" />
                    ) : (
                      <EyeOff className="h-5 w-5 text-destructive" />
                    )}
                  </div>
                  
                  {citation.cited && (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{t.llm.iterations} :</span>
                        <span className={cn(
                          "font-medium",
                          citation.iterationDepth <= 2 ? "text-success" : 
                          citation.iterationDepth <= 3 ? "text-warning" : "text-destructive"
                        )}>
                          {citation.iterationDepth}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{t.llm.sentiment} :</span>
                        <SentimentBadge sentiment={citation.sentiment} language={language} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{t.llm.recommends} :</span>
                        {citation.recommends ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>

                      {/* Always show the model's short explanation/summary */}
                      {citation.summary && (
                        <div className="pt-2">
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {citation.summary}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {!citation.cited && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">{t.llm.notMentioned}</p>
                      {citation.summary && (
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {citation.summary}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* Sentiment Legend */}
          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">{sentimentTranslations[language as keyof typeof sentimentTranslations]?.legendTitle || sentimentTranslations.fr.legendTitle}</span>{' '}
              <span className="text-green-700 dark:text-green-300 font-semibold">très positif !</span>
              {' • '}
              <span className="text-teal-600 dark:text-teal-400">plutôt positif.</span>
              {' • '}
              <span className="text-gray-600 dark:text-gray-400">Neutre</span>
              {' • '}
              <span className="text-orange-600 dark:text-orange-400">Mitigé</span>
              {' • '}
              <span className="text-red-600 dark:text-red-400">Négatif</span>
            </p>
          </div>
        </div>

        {/* Target Queries Card */}
        <LLMTargetQueriesCard domain={result.domain} />
      </div>
    </section>
  );
}