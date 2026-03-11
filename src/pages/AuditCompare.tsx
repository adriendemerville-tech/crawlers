import { useState, useRef, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSpotifyTrackRotation } from '@/components/ExpertAudit/useSpotifyTrackRotation';
import { useUrlValidation, normalizeUrl } from '@/hooks/useUrlValidation';
import { UrlValidationBanner } from '@/components/UrlValidationBanner';
import { 
  Swords, Globe, Target, Brain, CheckCircle2, Search, 
  Music, Star, TrendingUp, TrendingDown,
  MessageSquare, Zap, Loader2, Check
} from 'lucide-react';

// ==================== TYPES ====================

interface SiteAnalysis {
  brand_dna: string;
  strengths: string[];
  weaknesses: string[];
  llm_visibility?: {
    citation_probability: number;
    analysis: string;
    test_queries?: { query: string; purpose: string; target_llms: string[] }[];
  };
  keyword_positioning?: {
    main_keywords: { keyword: string; volume: number; difficulty: number; current_rank: string | number; strategic_analysis?: any }[];
    opportunities?: string[];
    recommendations?: string[];
  };
  aeo_score: number;
  expertise_sentiment: { rating: number; justification: string };
}

interface SiteResult {
  url: string;
  domain: string;
  metadata: { title: string; h1: string; desc: string };
  analysis: SiteAnalysis;
  llm_raw: any;
  keywords: any[];
}

interface CompareResult {
  site1: SiteResult;
  site2: SiteResult;
  scannedAt: string;
}

// ==================== I18N ====================

const i18n = {
  fr: {
    pageTitle: 'Audit Comparé SEO/GEO — Comparez deux sites | Crawlers.fr',
    pageDesc: 'Comparez deux sites web face-à-face : Brand DNA, SWOT, visibilité LLM et score AEO. Analyse concurrentielle SEO & GEO par IA.',
    badge: 'Audit Comparé',
    h1: 'Comparez deux sites face aux IA',
    subtitle: 'Analysez et comparez la visibilité IA, les mots-clés et la stratégie GEO de deux sites côte à côte.',
    credits: '5 crédits',
    confirm: 'Confirmer',
    launch: 'Lancer l\'audit comparé',
    confirmBoth: 'Confirmez les deux URLs pour lancer l\'audit',
    confirmSite1: 'Confirmez l\'URL du Site 1',
    confirmSite2: 'Confirmez l\'URL du Site 2',
    errorConfirm: 'Veuillez confirmer les deux URLs avant de lancer l\'audit.',
    insufficientCredits: '5 crédits requis pour un audit comparé.',
    retry: 'L\'analyse a pris trop de temps. Veuillez relancer l\'audit.',
    analysisTime: 'L\'analyse peut prendre jusqu\'à 3 minutes.',
    newAudit: 'Nouvel audit comparé',
    analysisOf: 'Analyse de',
    strengths: 'Forces',
    weaknesses: 'Faiblesses',
    llmVisibility: 'Visibilité LLM',
    brandCited: 'Marque citée',
    brandNotCited: 'Non citée',
    cited: 'Cité',
    absent: 'Absent',
    keywords: 'Mots-clés',
    llmQueries: 'Requêtes LLM',
    aeoScore: 'Score AEO',
    expertise: 'Expertise',
    playlist: 'Playlist Crawlers',
    volume: 'Volume : 50%',
    fetchStep: 'Récupération du contenu...',
    llmStep: 'Interrogation des IA...',
    keywordsStep: 'Étude des mots-clés...',
    analysisStep: 'Analyse comparative...',
    doneStep: 'Génération du rapport...',
  },
  en: {
    pageTitle: 'Comparative SEO/GEO Audit — Compare two sites | Crawlers.fr',
    pageDesc: 'Compare two websites head-to-head: Brand DNA, SWOT, LLM visibility and AEO score. AI-powered SEO & GEO competitive analysis.',
    badge: 'Comparative Audit',
    h1: 'Compare two sites against AI',
    subtitle: 'Analyze and compare AI visibility, keywords and GEO strategy of two sites side by side.',
    credits: '5 credits',
    confirm: 'Confirm',
    launch: 'Launch comparative audit',
    confirmBoth: 'Confirm both URLs to launch the audit',
    confirmSite1: 'Confirm Site 1 URL',
    confirmSite2: 'Confirm Site 2 URL',
    errorConfirm: 'Please confirm both URLs before launching the audit.',
    insufficientCredits: '5 credits required for a comparative audit.',
    retry: 'The analysis took too long. Please try again.',
    analysisTime: 'The analysis can take up to 3 minutes.',
    newAudit: 'New comparative audit',
    analysisOf: 'Analyzing',
    strengths: 'Strengths',
    weaknesses: 'Weaknesses',
    llmVisibility: 'LLM Visibility',
    brandCited: 'Brand cited',
    brandNotCited: 'Not cited',
    cited: 'Cited',
    absent: 'Absent',
    keywords: 'Keywords',
    llmQueries: 'LLM Queries',
    aeoScore: 'AEO Score',
    expertise: 'Expertise',
    playlist: 'Crawlers Playlist',
    volume: 'Volume: 50%',
    fetchStep: 'Fetching content...',
    llmStep: 'Querying AI models...',
    keywordsStep: 'Studying keywords...',
    analysisStep: 'Comparative analysis...',
    doneStep: 'Generating report...',
  },
  es: {
    pageTitle: 'Auditoría Comparativa SEO/GEO — Compare dos sitios | Crawlers.fr',
    pageDesc: 'Compare dos sitios web cara a cara: Brand DNA, SWOT, visibilidad LLM y puntuación AEO. Análisis competitivo SEO & GEO con IA.',
    badge: 'Auditoría Comparativa',
    h1: 'Compare dos sitios frente a la IA',
    subtitle: 'Analice y compare la visibilidad IA, las palabras clave y la estrategia GEO de dos sitios lado a lado.',
    credits: '5 créditos',
    confirm: 'Confirmar',
    launch: 'Lanzar auditoría comparativa',
    confirmBoth: 'Confirme ambas URLs para lanzar la auditoría',
    confirmSite1: 'Confirme la URL del Sitio 1',
    confirmSite2: 'Confirme la URL del Sitio 2',
    errorConfirm: 'Por favor confirme ambas URLs antes de lanzar la auditoría.',
    insufficientCredits: '5 créditos necesarios para una auditoría comparativa.',
    retry: 'El análisis tardó demasiado. Por favor inténtelo de nuevo.',
    analysisTime: 'El análisis puede tardar hasta 3 minutos.',
    newAudit: 'Nueva auditoría comparativa',
    analysisOf: 'Analizando',
    strengths: 'Fortalezas',
    weaknesses: 'Debilidades',
    llmVisibility: 'Visibilidad LLM',
    brandCited: 'Marca citada',
    brandNotCited: 'No citada',
    cited: 'Citado',
    absent: 'Ausente',
    keywords: 'Palabras clave',
    llmQueries: 'Consultas LLM',
    aeoScore: 'Puntuación AEO',
    expertise: 'Experiencia',
    playlist: 'Playlist Crawlers',
    volume: 'Volumen: 50%',
    fetchStep: 'Recuperando contenido...',
    llmStep: 'Consultando modelos IA...',
    keywordsStep: 'Estudiando palabras clave...',
    analysisStep: 'Análisis comparativo...',
    doneStep: 'Generando informe...',
  },
};

// ==================== LOADING STEPS ====================

function getLoadingSteps(t: typeof i18n['fr']) {
  return [
    { id: 'fetch', label: t.fetchStep, icon: Globe },
    { id: 'llm', label: t.llmStep, icon: Brain },
    { id: 'keywords', label: t.keywordsStep, icon: Target },
    { id: 'analysis', label: t.analysisStep, icon: Search },
    { id: 'done', label: t.doneStep, icon: CheckCircle2 },
  ];
}

function CompareLoadingSteps({ siteName, t }: { siteName: string; t: typeof i18n['fr'] }) {
  const [currentStep, setCurrentStep] = useState(0);
  const steps = getLoadingSteps(t);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep(prev => prev < steps.length - 1 ? prev + 1 : prev);
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center py-8 space-y-4">
      <div className="relative">
        <div className="h-14 w-14 rounded-full border-4 border-muted" />
        <div className="absolute inset-0 h-14 w-14 rounded-full border-4 border-t-transparent border-primary animate-spin" />
        <motion.div className="absolute inset-0 flex items-center justify-center"
          animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
          <Brain className="h-6 w-6 text-primary" />
        </motion.div>
      </div>
      <p className="text-sm font-medium text-foreground truncate max-w-[200px]">{t.analysisOf} {siteName}</p>
      <div className="space-y-2 w-full max-w-[220px]">
        {steps.map((step, i) => {
          const StepIcon = step.icon;
          const isActive = i === currentStep;
          const isComplete = i < currentStep;
          return (
            <motion.div key={step.id}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: isActive || isComplete ? 1 : 0.3, x: 0 }}
              className={`flex items-center gap-2 p-2 rounded-lg text-xs ${isActive ? 'bg-primary/10 border border-primary/30' : isComplete ? 'bg-emerald-500/10' : 'bg-muted/30'}`}>
              <StepIcon className={`h-3.5 w-3.5 ${isComplete ? 'text-emerald-500' : isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={isActive ? 'font-medium text-foreground' : 'text-muted-foreground'}>{step.label}</span>
              {isComplete && <CheckCircle2 className="h-3 w-3 text-emerald-500 ml-auto" />}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== RESULT CARD ====================

function SiteResultCard({ site, t }: { site: SiteResult; t: typeof i18n['fr'] }) {
  const { analysis, llm_raw } = site;
  const llmScore = llm_raw?.overallScore ?? analysis.llm_visibility?.citation_probability ?? 0;

  return (
    <div className="space-y-4">
      {/* Brand DNA */}
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" /> Brand DNA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">{analysis.brand_dna}</p>
          <div className="grid grid-cols-1 gap-2">
            <div>
              <p className="text-xs font-semibold text-emerald-500 mb-1 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> {t.strengths}</p>
              {(analysis.strengths || []).map((s, i) => (
                <p key={i} className="text-xs text-muted-foreground pl-3 border-l-2 border-emerald-500/30 mb-1">{s}</p>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold text-rose-500 mb-1 flex items-center gap-1"><TrendingDown className="h-3 w-3" /> {t.weaknesses}</p>
              {(analysis.weaknesses || []).map((w, i) => (
                <p key={i} className="text-xs text-muted-foreground pl-3 border-l-2 border-rose-500/30 mb-1">{w}</p>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LLM Visibility */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
            <Brain className="h-4 w-4 text-violet-500" /> {t.llmVisibility}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-bold text-foreground">{llmScore}<span className="text-sm text-muted-foreground">/100</span></div>
            {llm_raw?.brandMentioned !== undefined && (
              <Badge variant={llm_raw.brandMentioned ? 'default' : 'secondary'} className="text-xs">
                {llm_raw.brandMentioned ? t.brandCited : t.brandNotCited}
              </Badge>
            )}
          </div>
          {analysis.llm_visibility?.analysis && (
            <p className="text-xs text-muted-foreground">{analysis.llm_visibility.analysis}</p>
          )}
          {llm_raw?.models && Array.isArray(llm_raw.models) && (
            <div className="space-y-1">
              {llm_raw.models.map((m: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{m.name}</span>
                  <Badge variant={m.brandMentioned ? 'default' : 'outline'} className="text-[10px] px-1.5">
                    {m.brandMentioned ? t.cited : t.absent}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Keywords */}
      {analysis.keyword_positioning?.main_keywords && analysis.keyword_positioning.main_keywords.length > 0 && (
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-500" /> {t.keywords}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {analysis.keyword_positioning.main_keywords.slice(0, 6).map((kw, i) => (
                <div key={i} className="flex items-center justify-between text-xs gap-2">
                  <span className="text-foreground truncate flex-1">{kw.keyword}</span>
                  <span className="text-muted-foreground whitespace-nowrap">{kw.volume} vol</span>
                  <Badge variant={typeof kw.current_rank === 'number' && kw.current_rank <= 10 ? 'default' : 'outline'} className="text-[10px] px-1.5 whitespace-nowrap">
                    {typeof kw.current_rank === 'number' ? `#${kw.current_rank}` : 'N/C'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* LLM Target Queries */}
      {analysis.llm_visibility?.test_queries && analysis.llm_visibility.test_queries.length > 0 && (
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-cyan-500" /> {t.llmQueries}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {analysis.llm_visibility.test_queries.slice(0, 3).map((q, i) => (
              <div key={i} className="p-2 rounded-lg bg-muted/30 border border-border/30">
                <p className="text-xs font-medium text-foreground">"{q.query}"</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{q.purpose}</p>
                <div className="flex gap-1 mt-1">
                  {q.target_llms?.map((llm, j) => (
                    <Badge key={j} variant="outline" className="text-[9px] px-1">{llm}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* AEO Score + Expertise Sentiment */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border/50 bg-card/80">
          <CardContent className="pt-4 text-center">
            <Zap className="h-5 w-5 mx-auto text-amber-500 mb-1" />
            <p className="text-xs text-muted-foreground">{t.aeoScore}</p>
            <p className="text-2xl font-bold text-foreground">{analysis.aeo_score}<span className="text-xs text-muted-foreground">/100</span></p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/80">
          <CardContent className="pt-4 text-center">
            <Star className="h-5 w-5 mx-auto text-yellow-500 mb-1" />
            <p className="text-xs text-muted-foreground">{t.expertise}</p>
            <div className="flex items-center justify-center gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map(n => (
                <Star key={n} className={`h-4 w-4 ${n <= (analysis.expertise_sentiment?.rating || 0) ? 'text-yellow-500 fill-yellow-500' : 'text-muted'}`} />
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">{analysis.expertise_sentiment?.justification}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ==================== MAIN PAGE ====================

const AuditCompare = () => {
  const { user } = useAuth();
  const { refreshBalance } = useCredits();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  useCanonicalHreflang('/audit-compare');
  const t = i18n[language];

  const [url1, setUrl1] = useState('');
  const [url2, setUrl2] = useState('');
  const [confirmedUrl1, setConfirmedUrl1] = useState<string | null>(null);
  const [confirmedUrl2, setConfirmedUrl2] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 2;

  const validation1 = useUrlValidation(language);
  const validation2 = useUrlValidation(language);

  const { embedContainerRef, stopPlayback } = useSpotifyTrackRotation();
  const dingAudioRef = useRef<HTMLAudioElement | null>(null);

  // Preload ding
  useEffect(() => {
    dingAudioRef.current = new Audio('/assets/sounds/microwave-ding.mp3');
    dingAudioRef.current.onerror = () => {
      dingAudioRef.current = new Audio('/sounds/microwave-ding.mp3');
    };
  }, []);

  const playDing = useCallback(() => {
    if (dingAudioRef.current) {
      dingAudioRef.current.currentTime = 0;
      dingAudioRef.current.play().catch(() => {});
    }
  }, []);

  // Reset confirmed URL when input changes (track previous to avoid resetting on confirm)
  const url1Ref = useRef(url1);
  const url2Ref = useRef(url2);
  useEffect(() => {
    // Only reset if the change was NOT from a confirm action
    if (url1 !== url1Ref.current && url1 !== confirmedUrl1) {
      setConfirmedUrl1(null);
      validation1.resetValidation();
    }
    url1Ref.current = url1;
  }, [url1]);
  useEffect(() => {
    if (url2 !== url2Ref.current && url2 !== confirmedUrl2) {
      setConfirmedUrl2(null);
      validation2.resetValidation();
    }
    url2Ref.current = url2;
  }, [url2]);

  const handleConfirmUrl1 = () => {
    if (!url1.trim()) return;
    validation1.validateAndCorrect(url1, (validUrl) => {
      setUrl1(validUrl);
      setConfirmedUrl1(validUrl);
    });
  };

  const handleConfirmUrl2 = () => {
    if (!url2.trim()) return;
    validation2.validateAndCorrect(url2, (validUrl) => {
      setUrl2(validUrl);
      setConfirmedUrl2(validUrl);
    });
  };

  const bothConfirmed = !!confirmedUrl1 && !!confirmedUrl2;

  const handleLaunch = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!bothConfirmed) {
      toast({ title: 'Error', description: t.errorConfirm, variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    setResult(null);
    retryCountRef.current = 0;

    // Track analytics event
    supabase.from('analytics_events').insert({
      event_type: 'audit_compare_launched',
      url: url1.trim(),
      target_url: url2.trim(),
      user_id: user?.id || null,
    }).then(() => {});

    const checkCache = async (): Promise<any | null> => {
      try {
        const sorted = [url1.trim(), url2.trim()].map(u => u.startsWith('http') ? u : `https://${u}`).sort().join('|');
        const cacheKey = `compare:${sorted}`;
        const { data } = await supabase
          .from('audit_cache')
          .select('result_data')
          .eq('cache_key', cacheKey)
          .gt('expires_at', new Date().toISOString())
          .single();
        return data?.result_data || null;
      } catch { return null; }
    };

    const attemptAudit = async (): Promise<void> => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke('audit-compare', {
          body: { url1: url1.trim(), url2: url2.trim() },
        });

        if (fnError) throw new Error(fnError.message);
        if (!data?.success) throw new Error(data?.error || 'Erreur inconnue');

        // Stop music
        stopPlayback();

        // 3s silence then ding
        setTimeout(() => {
          playDing();
          setResult(data.data);
          setIsLoading(false);
          refreshBalance();
          
          // Fire-and-forget: trigger CTO Agent for audit-compare
          supabase.functions.invoke('agent-cto', {
            body: { auditResult: data.data, auditType: 'compare', url: url1.trim(), domain: new URL(url1.trim().startsWith('http') ? url1.trim() : `https://${url1.trim()}`).hostname }
          }).catch(() => {});
        }, 3000);
      } catch (e: any) {
        const msg = e.message || 'Erreur inconnue';
        
        // Don't retry for auth or credit errors
        if (msg.includes('Authentication')) {
          setIsLoading(false);
          navigate('/auth');
          return;
        }
        if (msg.includes('Insufficient credits')) {
          setIsLoading(false);
          toast({ title: 'Credits', description: t.insufficientCredits, variant: 'destructive' });
          return;
        }
        
        // Silent retry: first check if result was saved to cache despite timeout
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current += 1;
          console.log(`[audit-compare] Retry ${retryCountRef.current}/${MAX_RETRIES} — checking cache first...`);
          await new Promise(r => setTimeout(r, 3000));

          // Try cache recovery before re-invoking the function
          const cached = await checkCache();
          if (cached) {
            console.log('[audit-compare] ✅ Recovered from cache');
            stopPlayback();
            setTimeout(() => {
              playDing();
              setResult(cached);
              setIsLoading(false);
            }, 1500);
            return;
          }

          return attemptAudit();
        }
        
        // All retries exhausted — show a gentle toast, no red banner
        setIsLoading(false);
        toast({ title: '⏱️', description: t.retry });
      }
    };

    attemptAudit();
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Helmet>
        <title>{t.pageTitle}</title>
        <meta name="description" content={t.pageDesc} />
      </Helmet>
      <Header />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <Badge variant="outline" className="mb-3 text-xs border-violet-500/30 text-violet-400">
              <Swords className="h-3 w-3 mr-1" /> {t.badge}
            </Badge>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              {t.h1}
            </h1>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              {t.subtitle}
            </p>
            <Badge variant="secondary" className="mt-2 text-xs">{t.credits}</Badge>
          </motion.div>

          {/* URL Inputs */}
          {!isLoading && !result && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-start mb-6">
                {/* Site 1 */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Site 1</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        placeholder="https://site-a.com"
                        value={url1}
                        onChange={e => setUrl1(e.target.value)}
                        className={`h-12 text-sm pr-10 ${confirmedUrl1 ? 'border-emerald-500/50 bg-emerald-500/5' : ''}`}
                        disabled={validation1.isValidating}
                      />
                      {confirmedUrl1 && (
                        <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500" />
                      )}
                    </div>
                    <Button
                      type="button"
                      onClick={handleConfirmUrl1}
                      disabled={!url1.trim() || validation1.isValidating || !!confirmedUrl1}
                      variant={confirmedUrl1 ? 'default' : 'outline'}
                      className={`h-12 shrink-0 ${confirmedUrl1 ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'border-2 border-violet-500 text-violet-500 hover:bg-violet-500/10'}`}
                    >
                      {validation1.isValidating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : confirmedUrl1 ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        t.confirm
                      )}
                    </Button>
                  </div>
                  <UrlValidationBanner
                    suggestedUrl={validation1.suggestedUrl}
                    urlNotFound={validation1.urlNotFound}
                    suggestionPrefix={validation1.getSuggestionPrefix()}
                    notFoundMessage={validation1.getNotFoundMessage()}
                    onAcceptSuggestion={() => validation1.acceptSuggestion(validation1.suggestedUrl!, (validUrl) => { setUrl1(validUrl); setConfirmedUrl1(validUrl); })}
                    onDismissSuggestion={() => validation1.dismissSuggestion()}
                    onDismissNotFound={() => validation1.dismissNotFound()}
                    onIgnoreSuggestion={() => { const normalized = normalizeUrl(url1); setConfirmedUrl1(normalized); setUrl1(normalized); validation1.dismissSuggestion(); }}
                  />
                </div>

                {/* VS badge */}
                <div className="hidden md:flex items-center justify-center pt-8">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-violet-600 to-amber-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                    VS
                  </div>
                </div>

                {/* Site 2 */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Site 2</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        placeholder="https://site-b.com"
                        value={url2}
                        onChange={e => setUrl2(e.target.value)}
                        className={`h-12 text-sm pr-10 ${confirmedUrl2 ? 'border-emerald-500/50 bg-emerald-500/5' : ''}`}
                        disabled={validation2.isValidating}
                      />
                      {confirmedUrl2 && (
                        <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500" />
                      )}
                    </div>
                    <Button
                      type="button"
                      onClick={handleConfirmUrl2}
                      disabled={!url2.trim() || validation2.isValidating || !!confirmedUrl2}
                      variant={confirmedUrl2 ? 'default' : 'outline'}
                      className={`h-12 shrink-0 ${confirmedUrl2 ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'border-2 border-violet-500 text-violet-500 hover:bg-violet-500/10'}`}
                    >
                      {validation2.isValidating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : confirmedUrl2 ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        t.confirm
                      )}
                    </Button>
                  </div>
                  <UrlValidationBanner
                    suggestedUrl={validation2.suggestedUrl}
                    urlNotFound={validation2.urlNotFound}
                    suggestionPrefix={validation2.getSuggestionPrefix()}
                    notFoundMessage={validation2.getNotFoundMessage()}
                    onAcceptSuggestion={() => validation2.acceptSuggestion(validation2.suggestedUrl!, (validUrl) => { setUrl2(validUrl); setConfirmedUrl2(validUrl); })}
                    onDismissSuggestion={() => validation2.dismissSuggestion()}
                    onDismissNotFound={() => validation2.dismissNotFound()}
                    onIgnoreSuggestion={() => { const normalized = normalizeUrl(url2); setConfirmedUrl2(normalized); setUrl2(normalized); validation2.dismissSuggestion(); }}
                  />
                </div>
              </div>

              {/* Mobile VS */}
              <div className="md:hidden flex justify-center mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-violet-600 to-amber-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                  VS
                </div>
              </div>

              <div className="text-center">
                <Button onClick={handleLaunch} size="lg" disabled={!bothConfirmed}
                  className="bg-gradient-to-r from-violet-600 to-amber-500 hover:from-violet-700 hover:to-amber-600 text-white font-semibold px-8 disabled:opacity-50">
                  <Swords className="h-4 w-4 mr-2" />
                  {t.launch}
                </Button>
                {!bothConfirmed && (url1.trim() || url2.trim()) && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {!confirmedUrl1 && !confirmedUrl2 ? t.confirmBoth 
                      : !confirmedUrl1 ? t.confirmSite1 : t.confirmSite2}
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="relative">
              <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-0 items-start">
                {/* Left loading */}
                <div className="border-r-0 md:border-r border-border/30 pr-0 md:pr-4">
                  <div className="text-center mb-2">
                    <Badge variant="outline" className="text-xs">{url1.replace(/^https?:\/\//, '').substring(0, 30)}</Badge>
                  </div>
                  <CompareLoadingSteps siteName={new URL(url1.startsWith('http') ? url1 : `https://${url1}`).hostname} t={t} />
                </div>
                
                {/* Center: Spotify player on separator (desktop) */}
                <div className="hidden md:flex flex-col items-center px-4 pt-16">
                  <div className="w-px h-16 bg-gradient-to-b from-transparent via-border to-transparent" />
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-violet-600 to-amber-500 flex items-center justify-center text-white font-bold text-sm shadow-lg my-3">
                    VS
                  </div>
                  <div className="w-px h-16 bg-gradient-to-b from-transparent via-border to-transparent mb-4" />
                </div>

                {/* Right loading */}
                <div className="pl-0 md:pl-4">
                  <div className="text-center mb-2">
                    <Badge variant="outline" className="text-xs">{url2.replace(/^https?:\/\//, '').substring(0, 30)}</Badge>
                  </div>
                  <CompareLoadingSteps siteName={new URL(url2.startsWith('http') ? url2 : `https://${url2}`).hostname} t={t} />
                </div>
              </div>

              {/* Spotify Player — single instance below the grid */}
              <div className="mt-6 flex flex-col items-center">
                <div className="flex items-center gap-2 justify-center mb-2">
                  <Music className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">{t.playlist}</span>
                </div>
                <div className="w-full max-w-[320px] overflow-hidden rounded-[12px] bg-[#282828] isolate"
                  style={{ clipPath: 'inset(0 round 12px)' }}>
                  <div ref={embedContainerRef} className="w-full"
                    style={{ transform: 'scale(1.05)', transformOrigin: 'center center' }}
                    aria-label="Playlist Crawlers" />
                </div>
                <p className="text-[10px] text-muted-foreground text-center mt-1 opacity-60">{t.volume}</p>
              </div>

              <p className="text-sm text-muted-foreground text-center mt-6">
                {t.analysisTime}
              </p>
            </div>
          )}

          {/* Results */}
          {result && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
              <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-start">
                {/* Site 1 */}
                <div>
                  <div className="text-center mb-4">
                    <Badge className="bg-violet-600 text-white text-xs">{result.site1.domain}</Badge>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{result.site1.metadata.title}</p>
                  </div>
                  <SiteResultCard site={result.site1} t={t} />
                </div>

                {/* Separator */}
                <div className="hidden md:flex flex-col items-center pt-8">
                  <div className="w-px h-full min-h-[400px] bg-gradient-to-b from-violet-500/20 via-amber-500/30 to-violet-500/20 relative">
                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 w-10 h-10 rounded-full bg-gradient-to-r from-violet-600 to-amber-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                      VS
                    </div>
                  </div>
                </div>

                {/* Mobile VS */}
                <div className="md:hidden flex justify-center py-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-violet-600 to-amber-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                    VS
                  </div>
                </div>

                {/* Site 2 */}
                <div>
                  <div className="text-center mb-4">
                    <Badge className="bg-amber-600 text-white text-xs">{result.site2.domain}</Badge>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{result.site2.metadata.title}</p>
                  </div>
                  <SiteResultCard site={result.site2} t={t} />
                </div>
              </div>

              {/* Restart */}
              <div className="text-center mt-8">
                <Button variant="outline" onClick={() => { setResult(null); setUrl1(''); setUrl2(''); }}>
                  {t.newAudit}
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AuditCompare;
