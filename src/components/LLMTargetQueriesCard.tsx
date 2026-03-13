import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MethodologyPopover } from '@/components/ExpertAudit/MethodologyPopover';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Search, Copy, Check, Sparkles, AlertTriangle, BarChart3 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { LLMCitation } from '@/types/llm';

interface TargetQuery {
  query: string;
  intent: string;
  priority: 'high' | 'medium';
  mentionsBrand?: boolean;
}

interface CoherenceCheck {
  passed: boolean;
  corrections: string[];
  hallucinationSignals: string[];
}

interface GeneratedData {
  coreBusiness: string;
  marketLeader: string;
  queries: TargetQuery[];
  coherenceCheck?: CoherenceCheck;
}

interface LLMVolumeBreakdown {
  keyword: string;
  intent: string;
  penetration_rate: number;
  global_volume: number;
  total_llm_volume: number;
  breakdown: Record<string, number>;
}

interface LLMTargetQueriesCardProps {
  domain: string;
  coreValueSummary?: string;
  citations?: LLMCitation[];
  compact?: boolean;
  onCorrection?: (correction: string) => void;
  selfCorrect?: boolean;
  strategicAnalysis?: any;
}

const translations = {
  fr: {
    title: 'Requêtes LLM à cibler',
    subtitle: 'Requêtes stratégiques pour maximiser vos citations LLM. Ciblez-les pour dominer l\'IA.',
    copied: 'Copié !',
    high: 'Prioritaire',
    medium: 'Important',
    loading: 'Analyse du marché en cours...',
    coreBusiness: 'Activité détectée',
    marketLeader: 'Leader identifié',
    error: 'Impossible de générer les requêtes',
    reportError: 'Signaler une erreur',
    correctionTitle: 'Signaler une hallucination',
    correctionDesc: 'Décrivez l\'erreur et la correction en 200 caractères max.',
    correctionPlaceholder: 'Ex : Mon activité n\'est pas "agence web" mais "éditeur SaaS de facturation"',
    correctionButton: 'Corriger',
    correcting: 'Correction en cours...',
    llmVolumes: 'Volumes IA estimés / mois',
    totalLlm: 'Total IA',
    perMonth: '/mois',
  },
  en: {
    title: 'Target Queries',
    subtitle: 'Strategic queries to maximize your LLM citations. Target them to dominate AI.',
    copied: 'Copied!',
    high: 'Priority',
    medium: 'Important',
    loading: 'Analyzing market...',
    coreBusiness: 'Detected activity',
    marketLeader: 'Identified leader',
    error: 'Unable to generate queries',
    reportError: 'Report an error',
    correctionTitle: 'Report a hallucination',
    correctionDesc: 'Describe the error and correction in 200 characters max.',
    correctionPlaceholder: 'E.g.: My business is not "web agency" but "SaaS billing software"',
    correctionButton: 'Correct',
    correcting: 'Correcting...',
    llmVolumes: 'Estimated AI volumes / month',
    totalLlm: 'Total AI',
    perMonth: '/mo',
  },
  es: {
    title: 'Consultas objetivo',
    subtitle: 'Consultas estratégicas para maximizar tus citas LLM. Apúntalas para dominar la IA.',
    copied: '¡Copiado!',
    high: 'Prioritario',
    medium: 'Importante',
    loading: 'Analizando mercado...',
    coreBusiness: 'Actividad detectada',
    marketLeader: 'Líder identificado',
    error: 'No se pudieron generar las consultas',
    reportError: 'Reportar un error',
    correctionTitle: 'Reportar una alucinación',
    correctionDesc: 'Describe el error y la corrección en 200 caracteres máx.',
    correctionPlaceholder: 'Ej: Mi actividad no es "agencia web" sino "editor SaaS de facturación"',
    correctionButton: 'Corregir',
    correcting: 'Corrigiendo...',
    llmVolumes: 'Volúmenes IA estimados / mes',
    totalLlm: 'Total IA',
    perMonth: '/mes',
  },
};

// LLM brand colors for volume bars
const LLM_COLORS: Record<string, string> = {
  ChatGPT: 'text-emerald-600 dark:text-emerald-400',
  Perplexity: 'text-blue-600 dark:text-blue-400',
  Gemini: 'text-indigo-600 dark:text-indigo-400',
  Google_AI: 'text-amber-600 dark:text-amber-400',
  Grok: 'text-rose-600 dark:text-rose-400',
};

const LLM_DOT_COLORS: Record<string, string> = {
  ChatGPT: 'bg-emerald-500',
  Perplexity: 'bg-blue-500',
  Gemini: 'bg-indigo-500',
  Google_AI: 'bg-amber-500',
  Grok: 'bg-rose-500',
};

const LLM_LABELS: Record<string, string> = {
  ChatGPT: 'ChatGPT',
  Perplexity: 'Perplexity',
  Gemini: 'Gemini',
  Google_AI: 'Google AI (SGE)',
  Grok: 'Grok',
};

function VolumeBreakdownText({ volumes }: { volumes: LLMVolumeBreakdown }) {
  const sorted = Object.entries(volumes.breakdown).sort(([, a], [, b]) => b - a);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
      {sorted.map(([llm, vol]) => (
        <span key={llm} className="inline-flex items-center gap-1 text-[11px]">
          <span className={`font-semibold ${LLM_COLORS[llm] || 'text-muted-foreground'}`}>
            {LLM_LABELS[llm] || llm}
          </span>
          <span className="text-muted-foreground font-medium">{(vol ?? 0).toLocaleString()}</span>
        </span>
      ))}
    </div>
  );
}

export function LLMTargetQueriesCard({ domain, coreValueSummary, citations, compact = false, onCorrection, selfCorrect = false, strategicAnalysis }: LLMTargetQueriesCardProps) {
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.fr;
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<GeneratedData | null>(null);
  const [error, setError] = useState(false);
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [correctionText, setCorrectionText] = useState('');
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctionContext, setCorrectionContext] = useState('');
  const [volumes, setVolumes] = useState<Record<number, LLMVolumeBreakdown>>({});

  // Estimate a global search volume from strategic analysis keywords or fallback
  const estimateVolume = (query: string): number => {
    if (strategicAnalysis?.keyword_positioning?.main_keywords) {
      const keywords = strategicAnalysis.keyword_positioning.main_keywords;
      // Try to find a matching keyword with volume data
      const queryLower = query.toLowerCase();
      for (const kw of keywords) {
        if (kw.keyword && kw.volume && queryLower.includes(kw.keyword.toLowerCase())) {
          return kw.volume;
        }
      }
      // Use average volume of known keywords as fallback
      const vols = keywords.filter((k: any) => k.volume > 0).map((k: any) => k.volume);
      if (vols.length > 0) {
        return Math.round(vols.reduce((a: number, b: number) => a + b, 0) / vols.length);
      }
    }
    // Default fallback estimate
    return 500;
  };

  useEffect(() => {
    let cancelled = false;

    const generate = async () => {
      setIsLoading(true);
      setError(false);
      setVolumes({});

      try {
        const summaryWithCorrection = correctionContext
          ? `${coreValueSummary || ''}\n\nCORRECTION UTILISATEUR: ${correctionContext}`
          : (coreValueSummary || '');

        const { data: result, error: fnError } = await supabase.functions.invoke('generate-target-queries', {
          body: {
            domain,
            coreValueSummary: summaryWithCorrection,
            citations: (citations || []).map(c => ({
              provider: c.provider,
              cited: c.cited,
              summary: c.summary,
              recommends: c.recommends,
            })),
            lang: language,
            strategicAnalysis: strategicAnalysis || undefined,
          },
        });

        if (cancelled) return;

        if (fnError || !result?.success) {
          console.error('Target queries error:', fnError || result?.error);
          setError(true);
        } else {
          setData(result.data);

          // Fetch LLM volume breakdown for each query (batch)
          if (result.data?.queries?.length) {
            const batchKeywords = result.data.queries.map((q: TargetQuery) => ({
              keyword: q.query,
              global_volume: estimateVolume(q.query),
            }));

            supabase.functions.invoke('calculate-llm-volumes', {
              body: { keywords: batchKeywords },
            }).then(({ data: volResult }) => {
              if (cancelled || !volResult?.success) return;
              const volMap: Record<number, LLMVolumeBreakdown> = {};
              (volResult.results || []).forEach((v: LLMVolumeBreakdown, i: number) => {
                volMap[i] = v;
              });
              setVolumes(volMap);
            }).catch(err => {
              console.warn('Volume calculation failed (non-blocking):', err);
            });
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Target queries fetch error:', err);
          setError(true);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    generate();
    return () => { cancelled = true; };
  }, [domain, language, correctionContext]);

  const handleCopy = (query: string, index: number) => {
    navigator.clipboard.writeText(query);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const handleCorrection = () => {
    if (!correctionText.trim()) return;
    setCorrectionModalOpen(false);
    
    if (selfCorrect) {
      setCorrectionContext(correctionText.trim());
      setCorrectionText('');
    } else if (onCorrection) {
      setIsCorrecting(true);
      onCorrection(correctionText.trim());
      setCorrectionText('');
      setIsCorrecting(false);
    }
  };

  const showCorrectionButton = onCorrection || selfCorrect;

  if (error) return null;

  if (isLoading) {
    return (
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-5 w-5 text-primary" />
            {t.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 animate-pulse text-primary" />
            {t.loading}
          </div>
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!data?.queries?.length) return null;

  const hasVolumes = Object.keys(volumes).length > 0;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className={compact ? 'pb-2' : 'pb-3'}>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Search className="h-5 w-5 text-primary" />
          {t.title}
        </CardTitle>
        {!compact && (
          <p className="text-base text-muted-foreground leading-relaxed px-1 py-2">{t.subtitle}</p>
        )}
        {(data.coreBusiness || data.marketLeader) && (
          <div className="flex flex-wrap gap-2 mt-2">
            {data.coreBusiness && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Sparkles className="h-3 w-3" />
                {t.coreBusiness} : {data.coreBusiness}
              </Badge>
            )}
            {data.marketLeader && (
              <Badge variant="outline" className="text-xs">
                {t.marketLeader} : {data.marketLeader}
              </Badge>
            )}
          </div>
        )}
        {hasVolumes && (
          <div className="flex items-center gap-1.5 mt-2">
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground font-medium">{t.llmVolumes}</span>
            <div className="flex items-center gap-1.5 ml-auto flex-wrap">
              {Object.entries(LLM_COLORS).map(([llm, colorClass]) => (
                <span key={llm} className={`text-[10px] font-semibold ${colorClass}`}>
                  {LLM_LABELS[llm] || llm}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {data.queries.map((q, i) => (
          <div
            key={i}
            className="group rounded-lg bg-muted/50 p-3 hover:bg-muted/80 transition-colors cursor-pointer"
            onClick={() => handleCopy(q.query, i)}
          >
            <div className="flex items-start gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary mt-0.5">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm sm:text-base font-medium text-foreground break-words">"{q.query}"</p>
                  {copiedIndex === i ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-success mt-1" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                  )}
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">{q.intent}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {q.mentionsBrand && (
                    <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-600 dark:text-purple-400">
                      Marque
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={q.priority === 'high'
                      ? 'text-primary border-primary/30 text-[10px]'
                      : 'text-muted-foreground border-muted-foreground/30 text-[10px]'
                    }
                  >
                    {t[q.priority]}
                  </Badge>
                  {volumes[i]?.total_llm_volume != null && (
                    <Badge variant="outline" className="text-[10px] border-accent/30 text-accent-foreground gap-1">
                      <BarChart3 className="h-2.5 w-2.5" />
                      ~{volumes[i].total_llm_volume.toLocaleString()} {t.totalLlm}{t.perMonth}
                    </Badge>
                  )}
                </div>
                {volumes[i]?.breakdown && <VolumeBreakdownText volumes={volumes[i]} />}
              </div>
            </div>
          </div>
        ))}

        {showCorrectionButton && (
          <div className="pt-2 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-destructive gap-1.5"
              onClick={() => setCorrectionModalOpen(true)}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {t.reportError}
            </Button>
          </div>
        )}
        <MethodologyPopover variant="target_queries" />
      </CardContent>

      <Dialog open={correctionModalOpen} onOpenChange={setCorrectionModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              {t.correctionTitle}
            </DialogTitle>
            <DialogDescription>{t.correctionDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={correctionText}
              onChange={(e) => setCorrectionText(e.target.value.slice(0, 200))}
              placeholder={t.correctionPlaceholder}
              maxLength={200}
              className="min-h-[100px] resize-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{correctionText.length}/200</span>
              <Button
                onClick={handleCorrection}
                disabled={!correctionText.trim() || isCorrecting}
                size="sm"
              >
                {isCorrecting ? t.correcting : t.correctionButton}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
