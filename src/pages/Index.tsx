import { useState, useEffect, useCallback, lazy, Suspense, memo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/Header';
import { HeroSection } from '@/components/HeroSection';
import { ToolTabs, ToolTab } from '@/components/ToolTabs';
import { MobileLexiqueButton } from '@/components/MobileLexiqueButton';
import { CrawlResult } from '@/types/crawler';
import { PageSpeedResult } from '@/types/pagespeed';
import { GeoResult } from '@/types/geo';
import { LLMAnalysisResult } from '@/types/llm';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { trackAnalyticsEvent, storeAnalyzedUrl } from '@/hooks/useAnalytics';
import { useStructuredData } from '@/hooks/useStructuredData';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useAdmin } from '@/hooks/useAdmin';
import { Crown, ArrowRight, FileSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActiveCrawlBanner } from '@/components/Profile/ActiveCrawlBanner';

// Lazy load heavy dashboard components
const ResultsDashboard = lazy(() => import('@/components/ResultsDashboard').then(m => ({ default: m.ResultsDashboard })));
const PageSpeedDashboard = lazy(() => import('@/components/PageSpeedDashboard').then(m => ({ default: m.PageSpeedDashboard })));
const GeoDashboard = lazy(() => import('@/components/GeoDashboard').then(m => ({ default: m.GeoDashboard })));
const LLMDashboard = lazy(() => import('@/components/LLMDashboard').then(m => ({ default: m.LLMDashboard })));

// Lazy load below-the-fold components with higher priority grouping
const FAQSection = lazy(() => import('@/components/FAQSection').then(m => ({ default: m.FAQSection })));
const NewsCarousel = lazy(() => import('@/components/NewsCarousel').then(m => ({ default: m.NewsCarousel })));
const TestimonialsCarousel = lazy(() => import('@/components/TestimonialsCarousel').then(m => ({ default: m.TestimonialsCarousel })));

// Lazy load individual homepage sections

// Lazy load individual homepage sections
const MomentumSection = lazy(() => import('@/components/HomepageSections').then(m => ({ default: m.MomentumSection })));
const FeatureShowcase = lazy(() => import('@/components/HomepageSections').then(m => ({ default: m.FeatureShowcase })));
const IdentityFirstSection = lazy(() => import('@/components/HomepageSections').then(m => ({ default: m.IdentityFirstSection })));
const HybridSection = lazy(() => import('@/components/HomepageSections').then(m => ({ default: m.HybridSection })));
const TrustBanner = lazy(() => import('@/components/HomepageSections').then(m => ({ default: m.TrustBanner })));
const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

// Lightweight skeleton for dashboards
const DashboardSkeleton = memo(() => (
  <div className="container mx-auto px-4 py-8">
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  </div>
));

// Minimal skeleton for below-fold sections
const SectionSkeleton = memo(() => (
  <div className="h-64 animate-pulse bg-muted/20" />
));

const Index = () => {
  const [activeTab, setActiveTab] = useState<ToolTab>('crawlers');
  const [isLoading, setIsLoading] = useState(false);
  const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);
  const [mobilePageSpeedResult, setMobilePageSpeedResult] = useState<PageSpeedResult | null>(null);
  const [desktopPageSpeedResult, setDesktopPageSpeedResult] = useState<PageSpeedResult | null>(null);
  const [geoResult, setGeoResult] = useState<GeoResult | null>(null);
  const [llmResult, setLlmResult] = useState<LLMAnalysisResult | null>(null);
  const [pageSpeedStrategy, setPageSpeedStrategy] = useState<'mobile' | 'desktop'>('mobile');
  const [isPageSpeedLoading, setIsPageSpeedLoading] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [hideLeadmagnet, setHideLeadmagnet] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [firstAnalysisDone, setFirstAnalysisDone] = useState(false);
  const { toast } = useToast();
  const { language } = useLanguage();

  // Dynamic SEO metadata per language (Option A: Fear/Urgency)
  useEffect(() => {
    const titles: Record<string, string> = {
      fr: "Votre site est-il invisible pour l'IA ? Audit SEO & GEO expert | Crawlers.fr",
      en: "Is your site invisible to AI? Expert SEO & GEO Audit | Crawlers.fr",
      es: "¿Tu sitio es invisible para la IA? Auditoría SEO & GEO experta | Crawlers.fr",
    };
    const descriptions: Record<string, string> = {
      fr: "ChatGPT, Gemini, SGE : votre site est-il cité ou ignoré ? Obtenez votre Score GEO en 30 secondes. Audit technique et stratégique complet. Découvrez si les LLM vous voient.",
      en: "ChatGPT, Gemini, SGE: is your site cited or ignored? Get your GEO Score in 30 seconds. Complete technical & strategic audit. Find out if LLMs can see you.",
      es: "ChatGPT, Gemini, SGE: ¿tu sitio es citado o ignorado? Obtén tu Score GEO en 30 segundos. Auditoría técnica y estratégica completa. Descubre si los LLM te ven.",
    };
    document.title = titles[language] || titles.fr;
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', descriptions[language] || descriptions.fr);
  }, [language]);

  // Auto-redirect subscribed users to console with loading animation
  const { user: authUser } = useAuth();
  const { isAgencyPro: isSubscribed } = useCredits();
  const { isAdmin: isAdminUser } = useAdmin();
  const navTo = useNavigate();
  const [isRedirecting, setIsRedirecting] = useState(false);
  useEffect(() => {
    if (authUser && (isSubscribed || isAdminUser)) {
      // Don't redirect if user navigated here from another page on the site
      const isInternalNavigation = document.referrer && (() => {
        try {
          const ref = new URL(document.referrer);
          return ref.origin === window.location.origin;
        } catch { return false; }
      })();
      if (isInternalNavigation) return;

      setIsRedirecting(true);
      const timer = setTimeout(() => {
        navTo('/console?tab=tracking', { replace: true });
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [authUser, isSubscribed, isAdminUser, navTo]);

  // Fetch hide_home_leadmagnet config
  useEffect(() => {
    supabase
      .from('system_config')
      .select('value')
      .eq('key', 'hide_home_leadmagnet')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value === true) setHideLeadmagnet(true);
      });
  }, []);


  // Inject JSON-LD structured data dynamically (moved from inline HTML to reduce critical chain)
  useStructuredData();

  // Fix canonical & hreflang for multilingual indexation (EN/ES pages)
  useCanonicalHreflang('/');

  // Inject FAQ JSON-LD only on the homepage
  useEffect(() => {
    // ... keep existing code
    const faqByLang: Record<string, { q: string; a: string }[]> = {
      fr: [
        { q: "Qu'est-ce qu'un audit technique SEO expert ?", a: "Un audit technique SEO expert analyse 200 points de votre site : performance, Core Web Vitals, données structurées, accessibilité et optimisation pour les moteurs de recherche comme Google. Notre outil gratuit fournit un rapport complet avec recommandations personnalisées." },
        { q: "Qu'est-ce que le score GEO et pourquoi est-il important pour ChatGPT et Gemini ?", a: "Le score GEO (Generative Engine Optimization) mesure l'optimisation de votre site pour les IA comme ChatGPT, Google Gemini et Perplexity. Un score GEO élevé signifie que votre contenu sera mieux compris et référencé par les LLM (Large Language Models) dans leurs réponses." },
        { q: "Comment améliorer mon référencement pour les moteurs de recherche IA ?", a: "Pour améliorer votre référencement IA : 1) Autorisez les crawlers IA dans robots.txt (GPTBot, ClaudeBot), 2) Utilisez des données structurées JSON-LD, 3) Lancez un audit gratuit sur Crawlers.fr pour vérifier vos fichiers llms.txt et votre sémantique." },
        { q: "L'audit SEO et GEO est-il vraiment gratuit et rapide ?", a: "Oui, notre audit technique SEO et GEO est 100% gratuit, sans inscription. L'analyse complète de votre site prend environ 30 secondes et inclut : score sur 200 points, Core Web Vitals, analyse des bots IA, et recommandations marketing personnalisées." },
        { q: "Quels LLM et IA sont analysés par votre outil ?", a: "Notre outil analyse la compatibilité avec : ChatGPT (GPTBot, OAI-SearchBot), Google Gemini (Google-Extended), Claude (ClaudeBot), Perplexity (PerplexityBot), et d'autres crawlers IA. Nous vérifions également votre visibilité marketing dans ces moteurs génératifs." },
      ],
      en: [
        { q: "What is an expert technical SEO audit?", a: "An expert technical SEO audit analyzes 200 points of your website: performance, Core Web Vitals, structured data, accessibility and search engine optimization for Google. Our free tool provides a comprehensive report with personalized recommendations." },
        { q: "What is the GEO score and why does it matter for ChatGPT and Gemini?", a: "The GEO (Generative Engine Optimization) score measures how well your site is optimized for AI systems like ChatGPT, Google Gemini and Perplexity. A high GEO score means your content will be better understood and cited by LLMs (Large Language Models) in their answers." },
        { q: "How can I improve my ranking for AI search engines?", a: "To improve your AI ranking: 1) Allow AI crawlers in robots.txt (GPTBot, ClaudeBot), 2) Use JSON-LD structured data, 3) Run a free audit on Crawlers.fr to check your llms.txt files and semantics." },
        { q: "Is the SEO and GEO audit really free and fast?", a: "Yes, our technical SEO and GEO audit is 100% free, no sign-up required. The full analysis of your site takes about 30 seconds and includes: 200-point score, Core Web Vitals, AI bot analysis, and personalized marketing recommendations." },
        { q: "Which LLMs and AI systems does your tool analyze?", a: "Our tool analyzes compatibility with: ChatGPT (GPTBot, OAI-SearchBot), Google Gemini (Google-Extended), Claude (ClaudeBot), Perplexity (PerplexityBot), and other AI crawlers. We also verify your marketing visibility in these generative engines." },
      ],
      es: [
        { q: "¿Qué es una auditoría técnica SEO experta?", a: "Una auditoría técnica SEO experta analiza 200 puntos de su sitio web: rendimiento, Core Web Vitals, datos estructurados, accesibilidad y optimización para motores de búsqueda como Google. Nuestra herramienta gratuita proporciona un informe completo con recomendaciones personalizadas." },
        { q: "¿Qué es el score GEO y por qué es importante para ChatGPT y Gemini?", a: "El score GEO (Generative Engine Optimization) mide la optimización de su sitio para IA como ChatGPT, Google Gemini y Perplexity. Un score GEO alto significa que su contenido será mejor comprendido y citado por los LLM (Large Language Models) en sus respuestas." },
        { q: "¿Cómo mejorar mi posicionamiento en los motores de búsqueda IA?", a: "Para mejorar su posicionamiento IA: 1) Permita los crawlers IA en robots.txt (GPTBot, ClaudeBot), 2) Use datos estructurados JSON-LD, 3) Lance una auditoría gratuita en Crawlers.fr para verificar sus archivos llms.txt y su semántica." },
        { q: "¿La auditoría SEO y GEO es realmente gratuita y rápida?", a: "Sí, nuestra auditoría técnica SEO y GEO es 100% gratuita, sin registro. El análisis completo de su sitio toma unos 30 segundos e incluye: puntuación sobre 200 puntos, Core Web Vitals, análisis de bots IA y recomendaciones de marketing personalizadas." },
        { q: "¿Qué LLM e IA analiza su herramienta?", a: "Nuestra herramienta analiza la compatibilidad con: ChatGPT (GPTBot, OAI-SearchBot), Google Gemini (Google-Extended), Claude (ClaudeBot), Perplexity (PerplexityBot) y otros crawlers IA. También verificamos su visibilidad de marketing en estos motores generativos." },
      ],
    };
    const faqs = faqByLang[language] || faqByLang.fr;
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqs.map(f => ({
        "@type": "Question",
        "name": f.q,
        "acceptedAnswer": { "@type": "Answer", "text": f.a },
      })),
    };
    const scriptEl = document.createElement('script');
    scriptEl.type = 'application/ld+json';
    scriptEl.setAttribute('data-schema', 'homepage-faq');
    scriptEl.textContent = JSON.stringify(faqSchema);
    document.head.appendChild(scriptEl);

    return () => {
      document.querySelectorAll('script[data-schema="homepage-faq"]').forEach(el => el.remove());
    };
  }, [language]);

  // Trigger onboarding tutorial after first successful analysis (first-time visitors only)
  const triggerTutorialIfNeeded = useCallback(() => {
    if (firstAnalysisDone) return;
    const alreadyDone = localStorage.getItem('crawlers_onboarding_done');
    if (alreadyDone) return;
    setFirstAnalysisDone(true);
    // Small delay so user sees their results first
    setTimeout(() => setShowTutorial(true), 1800);
  }, [firstAnalysisDone]);

  const handleCheck = async (url: string) => {
    setIsLoading(true);
    // Clear current tab's results to avoid showing stale data from a different URL
    if (activeTab === 'crawlers') setCrawlResult(null);
    else if (activeTab === 'geo') setGeoResult(null);
    else if (activeTab === 'llm') setLlmResult(null);
    else if (activeTab === 'pagespeed') {
      if (pageSpeedStrategy === 'mobile') setMobilePageSpeedResult(null);
      else setDesktopPageSpeedResult(null);
    }
    setQuotaExceeded(false);
    setCurrentUrl(url);

    try {
      if (activeTab === 'crawlers') {
        const { data, error } = await supabase.functions.invoke('check-crawlers', {
          body: { url }
        });

        if (error) throw new Error(error.message);
        if (!data.success) throw new Error(data.error || 'Failed to check URL');

        setCrawlResult(data.data);
        trackAnalyticsEvent('free_analysis_crawlers', { targetUrl: url });
        storeAnalyzedUrl(url);
        triggerTutorialIfNeeded();
        toast({
          title: 'Scan complete!',
          description: `Checked ${data.data.bots.length} AI bots for ${url}`,
        });
      } else if (activeTab === 'geo') {
        const { data, error } = await supabase.functions.invoke('check-geo', {
          body: { url, lang: language }
        });

        if (error) throw new Error(error.message);
        if (!data.success) throw new Error(data.error || 'Failed to analyze GEO');

        setGeoResult(data.data);
        trackAnalyticsEvent('free_analysis_geo', { targetUrl: url });
        storeAnalyzedUrl(url);
        triggerTutorialIfNeeded();
        toast({
          title: 'Analysis complete!',
          description: `GEO Score: ${data.data.totalScore}/100`,
        });
      } else if (activeTab === 'llm') {
        const { data, error } = await supabase.functions.invoke('check-llm', {
          body: { url, lang: language }
        });

        if (error) throw new Error(error.message);
        if (!data.success) throw new Error(data.error || 'Failed to analyze LLM visibility');

        setLlmResult(data.data);
        trackAnalyticsEvent('free_analysis_llm', { targetUrl: url });
        storeAnalyzedUrl(url);
        triggerTutorialIfNeeded();
        toast({
          title: 'Analysis complete!',
          description: `LLM Visibility Score: ${data.data.overallScore}/100`,
        });
      } else {
        setIsPageSpeedLoading(true);
        const { data, error } = await supabase.functions.invoke('check-pagespeed', {
          body: { url, strategy: pageSpeedStrategy }
        });

        if (error) {
          if (error.message?.includes('429') || error.message?.includes('quota')) {
            setQuotaExceeded(true);
            setIsPageSpeedLoading(false);
            return;
          }
          throw new Error(error.message);
        }
        
        if (!data.success) {
          if (data.error === 'quota_exceeded') {
            setQuotaExceeded(true);
            setIsPageSpeedLoading(false);
            return;
          }
          throw new Error(data.message || data.error || 'Failed to check PageSpeed');
        }

        if (pageSpeedStrategy === 'mobile') {
          setMobilePageSpeedResult(data.data);
        } else {
          setDesktopPageSpeedResult(data.data);
        }
        setIsPageSpeedLoading(false);
        trackAnalyticsEvent('free_analysis_pagespeed', { targetUrl: url });
        storeAnalyzedUrl(url);
        triggerTutorialIfNeeded();
        toast({
          title: 'Analysis complete!',
          description: `PageSpeed score: ${data.data.scores.performance}/100`,
        });
      }
    } catch (error) {
      console.error('[scan-error]', activeTab, error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to check URL';
      
      // Track error silently in analytics (visible in admin dashboard)
      trackAnalyticsEvent('scan_error', { eventData: { tab: activeTab, message: errorMessage, url, timestamp: new Date().toISOString() } });
      
      if (errorMessage.includes('quota') || errorMessage.includes('429')) {
        setQuotaExceeded(true);
        setIsLoading(false);
        return;
      }
      
      // Silent auto-retry: no visible error, loading continues
      console.warn('[scan-retry] Auto-retrying scan for', activeTab, url);
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
      try {
        // Single retry attempt
        if (activeTab === 'crawlers') {
          const { data: retryData, error: retryError } = await supabase.functions.invoke('check-crawlers', { body: { url } });
          if (!retryError && retryData?.success) {
            setCrawlResult(retryData.data);
            trackAnalyticsEvent('free_analysis_crawlers', { targetUrl: url });
            storeAnalyzedUrl(url);
            triggerTutorialIfNeeded();
          } else {
            console.error('[scan-retry-failed] crawlers', retryError);
            trackAnalyticsEvent('scan_error_final', { eventData: { tab: 'crawlers', message: retryError?.message || 'retry failed', url } });
          }
        } else if (activeTab === 'geo') {
          const { data: retryData, error: retryError } = await supabase.functions.invoke('check-geo', { body: { url, lang: language } });
          if (!retryError && retryData?.success) {
            setGeoResult(retryData.data);
            trackAnalyticsEvent('free_analysis_geo', { targetUrl: url });
            storeAnalyzedUrl(url);
            triggerTutorialIfNeeded();
          } else {
            console.error('[scan-retry-failed] geo', retryError);
            trackAnalyticsEvent('scan_error_final', { eventData: { tab: 'geo', message: retryError?.message || 'retry failed', url } });
          }
        } else if (activeTab === 'llm') {
          const { data: retryData, error: retryError } = await supabase.functions.invoke('check-llm', { body: { url, lang: language } });
          if (!retryError && retryData?.success) {
            setLlmResult(retryData.data);
            trackAnalyticsEvent('free_analysis_llm', { targetUrl: url });
            storeAnalyzedUrl(url);
            triggerTutorialIfNeeded();
          } else {
            console.error('[scan-retry-failed] llm', retryError);
            trackAnalyticsEvent('scan_error_final', { eventData: { tab: 'llm', message: retryError?.message || 'retry failed', url } });
          }
        } else {
          setIsPageSpeedLoading(true);
          const { data: retryData, error: retryError } = await supabase.functions.invoke('check-pagespeed', { body: { url, strategy: pageSpeedStrategy } });
          if (!retryError && retryData?.success) {
            if (pageSpeedStrategy === 'mobile') setMobilePageSpeedResult(retryData.data);
            else setDesktopPageSpeedResult(retryData.data);
          } else {
            console.error('[scan-retry-failed] pagespeed', retryError);
            trackAnalyticsEvent('scan_error_final', { eventData: { tab: 'pagespeed', message: retryError?.message || 'retry failed', url } });
          }
          setIsPageSpeedLoading(false);
        }
      } catch (retryErr) {
        console.error('[scan-retry-exception]', retryErr);
        trackAnalyticsEvent('scan_error_final', { eventData: { tab: activeTab, message: retryErr instanceof Error ? retryErr.message : 'retry exception', url } });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStrategyChange = async (strategy: 'mobile' | 'desktop') => {
    setPageSpeedStrategy(strategy);
    
    // Si on a déjà les résultats pour cette stratégie, pas besoin de recharger
    const existingResult = strategy === 'mobile' ? mobilePageSpeedResult : desktopPageSpeedResult;
    if (existingResult) {
      return;
    }
    
    if (currentUrl && activeTab === 'pagespeed' && !quotaExceeded) {
      setIsPageSpeedLoading(true);

      try {
        const { data, error } = await supabase.functions.invoke('check-pagespeed', {
          body: { url: currentUrl, strategy }
        });

        if (error) {
          if (error.message?.includes('429') || error.message?.includes('quota')) {
            setQuotaExceeded(true);
            return;
          }
          throw new Error(error.message);
        }
        
        if (!data.success) {
          if (data.error === 'quota_exceeded') {
            setQuotaExceeded(true);
            return;
          }
          throw new Error(data.message || data.error || 'Failed to check PageSpeed');
        }

        if (strategy === 'mobile') {
          setMobilePageSpeedResult(data.data);
        } else {
          setDesktopPageSpeedResult(data.data);
        }
      } catch (error) {
        console.error('[pagespeed-switch-error]', error);
        trackAnalyticsEvent('scan_error', { eventData: { tab: 'pagespeed', message: error instanceof Error ? error.message : 'strategy switch failed', url: currentUrl } });
      } finally {
        setIsPageSpeedLoading(false);
      }
    }
  };

  const handleLLMCorrection = useCallback(async (correction: string) => {
    if (!currentUrl) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-llm', {
        body: { url: currentUrl, lang: language, correction }
      });
      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || 'Failed to analyze LLM visibility');
      setLlmResult(data.data);
      toast({
        title: language === 'fr' ? 'Correction appliquée' : language === 'es' ? 'Corrección aplicada' : 'Correction applied',
        description: language === 'fr' ? 'L\'analyse a été relancée avec votre correction.' : language === 'es' ? 'El análisis se relanzó con su corrección.' : 'Analysis reloaded with your correction.',
      });
    } catch (err) {
      console.error('[llm-correction-error]', err);
      trackAnalyticsEvent('scan_error', { eventData: { tab: 'llm', message: err instanceof Error ? err.message : 'correction failed', url: currentUrl } });
    } finally {
      setIsLoading(false);
    }
  }, [currentUrl, language, toast]);

  const handleTabChange = (tab: ToolTab) => {
    setActiveTab(tab);
    // Ne pas effacer les résultats existants - ils restent visibles
    setQuotaExceeded(false);
  };

  const handleRetry = () => {
    setQuotaExceeded(false);
    if (currentUrl) {
      handleCheck(currentUrl);
    }
  };

  const renderDashboard = () => {
    // Afficher tous les résultats empilés : récents en haut, anciens en bas
    const dashboards = [];

    // Afficher le dashboard de l'onglet actif en premier
    if (activeTab === 'pagespeed' && quotaExceeded) {
      dashboards.push(
        <div key="pagespeed-quota" className="border-b border-border/50 pb-8 p-8 text-center">
          <p className="text-destructive font-semibold">{language === 'fr' ? 'Quota PageSpeed dépassé' : language === 'es' ? 'Cuota PageSpeed superada' : 'PageSpeed quota exceeded'}</p>
          <button onClick={handleRetry} className="mt-2 text-sm text-primary underline">{language === 'fr' ? 'Réessayer' : language === 'es' ? 'Reintentar' : 'Retry'}</button>
        </div>
      );
    } else if (activeTab === 'crawlers') {
      dashboards.push(
        <div key="crawlers-current" className="border-b border-border/50 pb-8">
          <ResultsDashboard result={crawlResult} isLoading={isLoading} />
        </div>
      );
    } else if (activeTab === 'geo') {
      dashboards.push(
        <div key="geo-current" className="border-b border-border/50 pb-8">
          <GeoDashboard result={geoResult} isLoading={isLoading} />
        </div>
      );
    } else if (activeTab === 'llm') {
      dashboards.push(
        <div key="llm-current" className="border-b border-border/50 pb-8">
          <LLMDashboard result={llmResult} isLoading={isLoading} onCorrection={handleLLMCorrection} />
        </div>
      );
    } else if (activeTab === 'pagespeed') {
      const currentResult = pageSpeedStrategy === 'mobile' ? mobilePageSpeedResult : desktopPageSpeedResult;
      const otherResult = pageSpeedStrategy === 'mobile' ? desktopPageSpeedResult : mobilePageSpeedResult;
      
      dashboards.push(
        <div key="pagespeed-current" className="border-b border-border/50 pb-8">
          <PageSpeedDashboard 
            result={currentResult} 
            isLoading={isPageSpeedLoading}
            strategy={pageSpeedStrategy}
            onStrategyChange={handleStrategyChange}
          />
        </div>
      );
      
      // Afficher l'autre résultat (mobile/desktop) en dessous s'il existe
      if (otherResult) {
        dashboards.push(
          <div key="pagespeed-other" className="border-b border-border/50 pb-8 opacity-80">
            <PageSpeedDashboard 
              result={otherResult} 
              isLoading={false}
              strategy={otherResult.strategy}
              onStrategyChange={handleStrategyChange}
            />
          </div>
        );
      }
    }

    // Afficher les autres résultats existants (anciens) en dessous
    if (activeTab !== 'crawlers' && crawlResult) {
      dashboards.push(
        <div key="crawlers-prev" className="border-b border-border/50 pb-8 opacity-80">
          <ResultsDashboard result={crawlResult} isLoading={false} />
        </div>
      );
    }

    if (activeTab !== 'geo' && geoResult) {
      dashboards.push(
        <div key="geo-prev" className="border-b border-border/50 pb-8 opacity-80">
          <GeoDashboard result={geoResult} isLoading={false} />
        </div>
      );
    }

    if (activeTab !== 'llm' && llmResult) {
      dashboards.push(
        <div key="llm-prev" className="border-b border-border/50 pb-8 opacity-80">
          <LLMDashboard result={llmResult} isLoading={false} />
        </div>
      );
    }

    if (activeTab !== 'pagespeed' && (mobilePageSpeedResult || desktopPageSpeedResult)) {
      const resultToShow = desktopPageSpeedResult || mobilePageSpeedResult;
      dashboards.push(
        <div key="pagespeed-prev" className="border-b border-border/50 pb-8 opacity-80">
          <PageSpeedDashboard 
            result={resultToShow} 
            isLoading={false}
            strategy={resultToShow?.strategy || 'mobile'}
            onStrategyChange={handleStrategyChange}
          />
        </div>
      );
    }

    return <div className="space-y-8 pb-24">{dashboards}</div>;
  };


  const hasResults = !!(crawlResult || geoResult || llmResult || mobilePageSpeedResult || desktopPageSpeedResult);

  if (isRedirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background animate-fade-in">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground text-sm">{language === 'fr' ? 'Chargement de votre console…' : language === 'es' ? 'Cargando su consola…' : 'Loading your console…'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Helmet>
        <title>{language === 'fr' ? 'Crawlers.fr — Premier outil francophone SEO + GEO' : language === 'es' ? 'Crawlers.fr — Primera herramienta francófona SEO + GEO' : 'Crawlers.fr — Leading French SEO + GEO Tool'}</title>
        <meta name="description" content={language === 'fr' ? 'Crawlers.fr — Premier outil francophone SEO + GEO. Auditez et optimisez votre visibilité sur Google ET ChatGPT, Perplexity, Gemini, Claude. Gratuit sans inscription.' : language === 'es' ? 'Crawlers.fr — Primera herramienta francófona SEO + GEO. Audite y optimice su visibilidad en Google Y ChatGPT, Perplexity, Gemini, Claude. Gratis sin registro.' : 'Crawlers.fr — Leading French SEO + GEO tool. Audit and optimize your visibility on Google AND ChatGPT, Perplexity, Gemini, Claude. Free, no sign-up.'} />
        <meta name="robots" content={language === 'fr' ? 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' : 'noindex, follow'} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Crawlers.fr" />
        <meta property="og:url" content="https://crawlers.fr/" />
        <meta property="og:title" content={`${language === 'fr' ? 'Crawlers.fr — Premier outil francophone SEO + GEO' : language === 'es' ? 'Crawlers.fr — Primera herramienta SEO + GEO' : 'Crawlers.fr — Leading SEO + GEO Tool'} | Crawlers.fr`} />
        <meta property="og:description" content={language === 'fr' ? 'Crawlers.fr — Premier outil francophone SEO + GEO. Auditez et optimisez votre visibilité sur Google ET ChatGPT, Perplexity, Gemini, Claude. Gratuit sans inscription.' : language === 'es' ? 'Crawlers.fr — Primera herramienta francófona SEO + GEO. Audite y optimice su visibilidad en Google Y ChatGPT, Perplexity, Gemini, Claude. Gratis sin registro.' : 'Crawlers.fr — Leading French SEO + GEO tool. Audit and optimize your visibility on Google AND ChatGPT, Perplexity, Gemini, Claude. Free, no sign-up.'} />
        <meta property="og:image" content="https://crawlers.fr/og-image.png" />
        <meta property="og:locale" content={language === 'fr' ? 'fr_FR' : language === 'es' ? 'es_ES' : 'en_US'} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@crawlersfr" />
        <meta name="twitter:title" content={`${language === 'fr' ? 'Crawlers.fr — Premier outil francophone SEO + GEO' : language === 'es' ? 'Crawlers.fr — Primera herramienta SEO + GEO' : 'Crawlers.fr — Leading SEO + GEO Tool'} | Crawlers.fr`} />
        <meta name="twitter:description" content={language === 'fr' ? 'Premier outil francophone SEO + GEO. Auditez votre visibilité sur Google ET ChatGPT.' : language === 'es' ? 'Primera herramienta francófona SEO + GEO. Audite su visibilidad en Google Y ChatGPT.' : 'Leading French SEO + GEO tool. Audit your visibility on Google AND ChatGPT.'} />
        <meta name="twitter:image" content="https://crawlers.fr/og-image.png" />
      </Helmet>
      <Header />
      <main className="flex-1" role="main" aria-label={language === 'fr' ? 'Contenu principal' : language === 'es' ? 'Contenido principal' : 'Main content'}>
        <HeroSection 
          onSubmit={handleCheck} 
          isLoading={isLoading} 
          activeTab={activeTab}
          onTabChange={handleTabChange}
          currentUrl={currentUrl}
        />

        {/* ─── Homepage marketing sections ─── */}

        {/* Pro Agency hero */}
        {hideLeadmagnet && (
          <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-violet-950/20 via-background to-background py-14 sm:py-20">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_60%)]" />
            <div className="relative mx-auto max-w-3xl px-4 text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-violet-600/20 text-violet-400 border border-violet-500/30 text-sm px-4 py-1.5 mb-5">
                <Crown className="h-4 w-4 text-yellow-500" />
                {language === 'fr' ? 'Offre Pro Agency' : language === 'es' ? 'Oferta Pro Agency' : 'Pro Agency Plan'}
              </div>
              <h2 className="mb-4 text-2xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                {language === 'fr' ? 'Passez au niveau supérieur avec ' : language === 'es' ? 'Sube de nivel con ' : 'Level up with '}
                <span className="bg-gradient-to-r from-violet-500 to-amber-400 bg-clip-text text-transparent">Pro Agency</span>
              </h2>
              <p className="mx-auto mb-6 max-w-xl text-muted-foreground">
                {language === 'fr'
                  ? 'Suivi de 30 sites, Architecte Génératif multi-pages, crawl 5 000 pages/mois, rapports illimités et correctifs automatiques.'
                  : language === 'es'
                  ? 'Seguimiento de 30 sitios, Arquitecto Generativo multi-páginas, crawl de 5 000 páginas/mes, informes ilimitados y correcciones automáticas.'
                  : '30-site tracking, multi-page Generative Architect, 5,000 pages/month crawl, unlimited reports & automatic fixes.'}
              </p>
              <div className="flex items-baseline justify-center gap-1 mb-6">
                <span className="text-4xl font-extrabold text-foreground">59€</span>
                <span className="text-lg text-muted-foreground">/mois</span>
              </div>
              <Link to="/pro-agency">
                <Button
                  size="lg"
                  className="gap-2 bg-gradient-to-r from-violet-600 to-amber-500 hover:from-violet-700 hover:to-amber-600 text-white font-semibold px-8 shadow-lg hover:shadow-xl transition-all"
                >
                  <Crown className="h-5 w-5 text-yellow-300" />
                  {language === 'fr' ? 'Découvrir Pro Agency' : language === 'es' ? 'Descubrir Pro Agency' : 'Discover Pro Agency'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </section>
        )}

        {/* Trust Banner — right after Pro Agency */}
        <Suspense fallback={<SectionSkeleton />}>
          <TrustBanner />
        </Suspense>

        <Suspense fallback={<SectionSkeleton />}>
          <MomentumSection />
        </Suspense>

        <Suspense fallback={<SectionSkeleton />}>
          <HybridSection />
        </Suspense>

        {/* Identity First */}
        <Suspense fallback={<SectionSkeleton />}>
          <IdentityFirstSection />
        </Suspense>

        <Suspense fallback={<SectionSkeleton />}>
          <FeatureShowcase />
        </Suspense>

        {/* Active crawl notification banner */}
        <div className="max-w-3xl mx-auto px-4 mb-4">
          <ActiveCrawlBanner />
        </div>
        <section aria-label={language === 'fr' ? "Outils d'analyse" : language === 'es' ? 'Herramientas de análisis' : 'Analysis tools'}>
          <Suspense fallback={<DashboardSkeleton />}>
            {renderDashboard()}
          </Suspense>
        </section>

        {/* Contextual CTA → Audit Expert after scan */}
        {hasResults && (
          <section className="py-8 px-4">
            <div className="mx-auto max-w-2xl rounded-2xl border-2 border-[#3b82f6]/40 bg-gradient-to-r from-[#3b82f6]/5 via-primary/5 to-[#3b82f6]/5 p-6 sm:p-8 text-center shadow-lg shadow-[#3b82f6]/5">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#3b82f6]/10 border border-[#3b82f6]/30 px-3 py-1 text-xs font-semibold text-[#3b82f6] dark:text-[#60a5fa] mb-3">
                <Crown className="h-3.5 w-3.5" />
                {language === 'fr' ? 'Aller plus loin' : language === 'es' ? 'Ir más allá' : 'Go further'}
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-2 font-display">
                {language === 'fr' ? 'Obtenez votre audit complet sur 168 critères' : language === 'es' ? 'Obtenga su auditoría completa con 168 criterios' : 'Get your full audit across 168 criteria'}
              </h3>
              <p className="text-sm text-muted-foreground mb-5 max-w-lg mx-auto">
                {language === 'fr'
                  ? 'Diagnostic SEO & GEO approfondi, plan d\'action personnalisé et code correctif prêt à déployer.'
                  : language === 'es'
                  ? 'Diagnóstico SEO & GEO profundo, plan de acción personalizado y código correctivo listo para implementar.'
                  : 'In-depth SEO & GEO diagnosis, personalized action plan & corrective code ready to deploy.'}
              </p>
              <Link to={currentUrl ? `/audit-expert?url=${encodeURIComponent(currentUrl)}` : '/audit-expert'}>
                <Button
                  variant="default"
                  size="lg"
                  className="gap-2 bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 text-primary-foreground px-8 py-3 text-base font-bold shadow-md"
                >
                  <FileSearch className="h-5 w-5" />
                  {language === 'fr' ? 'Lancer l\'Audit Expert' : language === 'es' ? 'Iniciar Auditoría Experta' : 'Launch Expert Audit'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </section>
        )}
        
        {/* Mobile-only Lexique button */}
        <MobileLexiqueButton />
        

        {/* CTA Observatoire */}
        <section className="border-y border-border bg-gradient-to-r from-violet-50/50 via-muted/30 to-amber-50/50 dark:from-violet-950/10 dark:via-muted/10 dark:to-amber-950/10 py-14 md:py-20">
          <div className="container mx-auto max-w-3xl px-4 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {language === 'fr' ? 'Observatoire SEO & GEO : statistiques en temps réel du web français' : language === 'es' ? 'Observatorio SEO & GEO: estadísticas en tiempo real de la web francesa' : 'SEO & GEO Observatory: real-time French web statistics'}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              {language === 'fr' ? 'Vitesse, SEO, technologies… Plongez dans les données exclusives générées par Crawlers.fr.' : language === 'es' ? 'Velocidad, SEO, tecnologías… Explore los datos exclusivos generados por Crawlers.fr.' : 'Speed, SEO, technologies… Dive into the exclusive data generated by Crawlers.fr.'}
            </p>
            <Link to="/observatoire">
              <Button variant="outline" className="mt-6 gap-2 bg-gradient-to-br from-violet-600 to-amber-500 text-white border-violet-600 hover:from-violet-700 hover:to-amber-600 shadow-md rounded-md">
                {language === 'fr' ? "Consulter l'Observatoire" : language === 'es' ? 'Consultar el Observatorio' : 'View the Observatory'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        <Suspense fallback={<SectionSkeleton />}>
          <TestimonialsCarousel />
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          <FAQSection />
        </Suspense>
      </main>
      <Suspense fallback={<div className="h-48 bg-muted/10" />}>
        <Footer />
      </Suspense>
      
    </div>
  );
};

export default Index;
