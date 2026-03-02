import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Search, Copy, Check, Sparkles, AlertTriangle } from 'lucide-react';
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

interface LLMTargetQueriesCardProps {
  domain: string;
  coreValueSummary?: string;
  citations?: LLMCitation[];
  compact?: boolean;
  onCorrection?: (correction: string) => void;
  /** If true, the card handles correction internally by re-generating queries with the correction context */
  selfCorrect?: boolean;
  /** Strategic analysis data for cross-validation coherence check */
  strategicAnalysis?: any;
}

const translations = {
  fr: {
    title: 'Requêtes à cibler',
    subtitle: 'Requêtes stratégiques pour maximiser vos recommandations par les LLMs',
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
  },
  en: {
    title: 'Target Queries',
    subtitle: 'Strategic queries to maximize your LLM recommendations',
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
  },
  es: {
    title: 'Consultas objetivo',
    subtitle: 'Consultas estratégicas para maximizar tus recomendaciones LLM',
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
  },
};

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

  useEffect(() => {
    let cancelled = false;

    const generate = async () => {
      setIsLoading(true);
      setError(false);

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
      // Self-contained: re-generate queries with correction context
      setCorrectionContext(correctionText.trim());
      setCorrectionText('');
    } else if (onCorrection) {
      // Delegate to parent (homepage flow)
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
        {/* Coherence check indicator */}
        {data.coherenceCheck && !data.coherenceCheck.passed && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-warning/10 border border-warning/20">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-warning">
                {language === 'en' ? 'Coherence corrected' : language === 'es' ? 'Coherencia corregida' : 'Cohérence corrigée'}
              </span>
              {' — '}
              {data.coherenceCheck.corrections?.slice(0, 2).join('. ') || 
                (language === 'en' ? 'Queries adjusted to match strategic analysis.' : language === 'es' ? 'Consultas ajustadas al análisis estratégico.' : 'Requêtes ajustées pour correspondre à l\'analyse stratégique.')}
            </div>
          </div>
        )}
        </CardContent>
      </Card>
    );
  }

  if (!data?.queries?.length) return null;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className={compact ? 'pb-2' : 'pb-3'}>
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="h-5 w-5 text-primary" />
          {t.title}
        </CardTitle>
        {!compact && (
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        )}
        {/* Core business & market leader badges */}
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
      </CardHeader>
      <CardContent className="space-y-2">
        {data.queries.map((q, i) => (
          <div
            key={i}
            className="group flex items-start gap-3 rounded-lg bg-muted/50 p-3 hover:bg-muted/80 transition-colors cursor-pointer"
            onClick={() => handleCopy(q.query, i)}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">"{q.query}"</p>
              <p className="text-xs text-muted-foreground mt-1">{q.intent}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
              {copiedIndex === i ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>
          </div>
        ))}

        {/* Report hallucination button */}
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
      </CardContent>

      {/* Correction Modal */}
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
