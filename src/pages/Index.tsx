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
// Lazy reference — avoid static import that bloats critical bundle
const matriceScreenshot = new URL('@/assets/screenshots/crawlers.fr_matrice-audit-seo-grille-personnalisee.webp', import.meta.url).href;
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useAdmin } from '@/hooks/useAdmin';
import { Crown, ArrowRight, FileSearch, Grid3X3, Anchor, Search, Globe, Brain, ShieldCheck, Database, BarChart3 } from 'lucide-react';
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
const AIAgentsSection = lazy(() => import('@/components/Homepage/AIAgentsSection').then(m => ({ default: m.AIAgentsSection })));
const ContentArchitectSection = lazy(() => import('@/components/Homepage/ContentArchitectSection').then(m => ({ default: m.ContentArchitectSection })));
const SocialHubSection = lazy(() => import('@/components/Homepage/SocialHubSection').then(m => ({ default: m.SocialHubSection })));
const ProductShowcaseSection = lazy(() => import('@/components/Homepage/ProductShowcaseSection').then(m => ({ default: m.ProductShowcaseSection })));
const GoogleCrossDataSection = lazy(() => import('@/components/Homepage/GoogleCrossDataSection').then(m => ({ default: m.GoogleCrossDataSection })));
const ClaudeVsCrawlersSection = lazy(() => import('@/components/Homepage/ClaudeVsCrawlersSection').then(m => ({ default: m.ClaudeVsCrawlersSection })));
const LogAnalysisSection = lazy(() => import('@/components/Homepage/LogAnalysisSection').then(m => ({ default: m.LogAnalysisSection })));
const BreathingSpiralSection = lazy(() => import('@/components/Homepage/BreathingSpiralSection').then(m => ({ default: m.BreathingSpiralSection })));

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
  const { language, t } = useLanguage();

  // SEO metadata constants (used in Helmet below)
  const seoTitle = language === 'es'
    ? 'Auditoría SEO & GEO experta gratis | Crawlers.fr'
    : language === 'en'
    ? 'Free Expert SEO & GEO Audit | Crawlers.fr'
    : 'Audit SEO & GEO expert gratuit | Crawlers.fr';

  const seoDescription = language === 'es'
    ? 'ChatGPT, Gemini, SGE: ¿tu sitio es citado o ignorado? Auditoría SEO/GEO 168 criterios, Conversion Optimizer, análisis de logs y Content Architect.'
    : language === 'en'
    ? 'ChatGPT, Gemini, SGE: is your site cited or ignored? 168-criteria SEO/GEO audit, Conversion Optimizer, log analysis & Content Architect.'
    : 'Audit SEO & GEO 168 critères, Conversion Optimizer, analyse de logs serveur, Content Architect IA. Score GEO gratuit en 30 sec.';

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
        navTo('/app/console?tab=tracking', { replace: true });
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [authUser, isSubscribed, isAdminUser, navTo]);

  // Fetch hide_home_leadmagnet config — deferred to avoid blocking render
  useEffect(() => {
    const ctrl = new AbortController();
    const loadConfig = () => {
      supabase
        .from('system_config')
        .select('value')
        .eq('key', 'hide_home_leadmagnet')
        .maybeSingle()
        .then(({ data }) => {
          if (data?.value === true) setHideLeadmagnet(true);
        });
    };
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(loadConfig, { timeout: 3000 });
      return () => { cancelIdleCallback(id); ctrl.abort(); };
    } else {
      const timer = setTimeout(loadConfig, 1500);
      return () => { clearTimeout(timer); ctrl.abort(); };
    }
  }, []);
const PainPointsSection = lazy(() => import('@/components/Homepage/PainPointsSection').then(m => ({ default: m.PainPointsSection })));
const PainPointsSection = lazy(() => import('@/components/Homepage/PainPointsSection').then(m => ({ default: m.PainPointsSection })));

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
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href="https://crawlers.fr/" />
        <meta name="robots" content={language === 'fr' ? 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' : 'noindex, follow'} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Crawlers.fr" />
        <meta property="og:url" content="https://crawlers.fr/" />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:image" content="https://crawlers.fr/og-image.png" />
        <meta property="og:locale" content={language === 'fr' ? 'fr_FR' : language === 'es' ? 'es_ES' : 'en_US'} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@crawlersfr" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
        <meta name="twitter:image" content="https://crawlers.fr/og-image.png" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": t.faq.items.map(item => ({
            "@type": "Question",
            "name": item.question,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": item.answer
            }
          }))
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "Crawlers",
          "url": "https://crawlers.fr",
          "applicationCategory": "BusinessApplication",
          "operatingSystem": "Web",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "EUR",
            "description": "Audit SEO gratuit"
          },
          "description": "Plateforme SEO & GEO : audits 168 critères, maillage intelligent Cocoon, autopilote, visibilité IA.",
          "featureList": "Audit SEO, Audit GEO, Maillage Cocoon, Content Architect, Autopilot, Observatory"
        })}</script>
      </Helmet>
      <Header />
      <main className="flex-1" role="main" aria-label={language === 'fr' ? 'Contenu principal' : language === 'es' ? 'Contenido principal' : 'Main content'}>
        <HeroSection />

        {/* ─── Homepage marketing sections ─── */}

        {/* Pro Agency hero */}
        <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-violet-950/20 via-background to-background py-14 sm:py-20">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_60%)]" />
            <div className="relative mx-auto max-w-4xl px-4 text-center">
              <h2 className="mb-4 text-2xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                {language === 'fr' ? 'Gérez 30 clients. Audits illimités.' : language === 'es' ? 'Gestiona 30 clientes. Auditorías ilimitadas.' : 'Manage 30 clients. Unlimited audits.'}
              </h2>
              <p className="mx-auto mb-6 max-w-xl text-muted-foreground">
                {language === 'fr'
                  ? 'Rapports marque blanche, correctifs auto-déployés, crawl 5 000 pages/mois et agents IA — tout inclus.'
                  : language === 'es'
                  ? 'Informes marca blanca, correcciones auto-desplegadas, crawl 5 000 páginas/mes y agentes IA — todo incluido.'
                  : 'White-label reports, auto-deployed fixes, 5,000 pages/month crawl & AI agents — all included.'}
              </p>
              {/* Mini stats */}
              <div className="mx-auto mb-6 grid max-w-md grid-cols-3 gap-3">
                {[
                  { v: '∞', l: language === 'fr' ? 'Audits' : 'Audits' },
                  { v: '30', l: language === 'fr' ? 'Sites' : 'Sites' },
                  { v: '5K', l: language === 'fr' ? 'Pages/mois' : 'Pages/mo' },
                ].map((s, i) => (
                  <div key={i} className="rounded-lg border border-border/50 bg-card/30 px-3 py-2 text-center">
                    <div className="text-xl font-extrabold text-foreground">{s.v}</div>
                    <div className="text-[10px] text-muted-foreground">{s.l}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col items-center gap-4 mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-sm text-muted-foreground mr-1">{language === 'fr' ? 'à partir de' : language === 'es' ? 'desde' : 'from'}</span>
                  <span className="text-4xl font-extrabold text-foreground">29€</span>
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
            </div>
          </section>


        {/* Trust Banner — right after Pro Agency */}
        <Suspense fallback={<SectionSkeleton />}>
          <TrustBanner />
        </Suspense>

        {/* Product Showcase — Screenshots */}
        <Suspense fallback={<SectionSkeleton />}>
          <ProductShowcaseSection />
        </Suspense>

        {/* Claude vs Crawlers — Comparison */}
        <Suspense fallback={<SectionSkeleton />}>
          <ClaudeVsCrawlersSection />
        </Suspense>

        {/* Google Cross Data — SEA→SEO Bridge */}
        <Suspense fallback={<SectionSkeleton />}>
          <GoogleCrossDataSection />
        </Suspense>

        <Suspense fallback={<SectionSkeleton />}>
          <MomentumSection />
        </Suspense>

        {/* AI Agents — Félix & Stratège Cocoon */}
        <Suspense fallback={<SectionSkeleton />}>
          <AIAgentsSection />
        </Suspense>

        {/* Content Architect */}
        <Suspense fallback={<SectionSkeleton />}>
          <ContentArchitectSection />
        </Suspense>

        {/* E-E-A-T Section */}
        <section className="py-20 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-emerald-500/5" />
          <div className="container mx-auto px-4 relative z-10">
            <div className="flex flex-col lg:flex-row items-center gap-12">
              {/* Left — text */}
              <div className="flex-1 space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {language === 'fr' ? 'E-E-A-T · Confiance Google' : language === 'es' ? 'E-E-A-T · Confianza Google' : 'E-E-A-T · Google Trust'}
                </div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                  {language === 'fr'
                    ? 'Mesurez votre score E-E-A-T et renforcez votre crédibilité'
                    : language === 'es'
                    ? 'Mida su puntuación E-E-A-T y refuerce su credibilidad'
                    : 'Measure your E-E-A-T score and boost your credibility'}
                </h2>
                <p className="text-muted-foreground leading-relaxed max-w-xl">
                  {language === 'fr'
                    ? 'Expérience, Expertise, Autorité, Fiabilité — les 4 piliers que Google utilise pour évaluer la qualité de votre contenu. Notre outil analyse automatiquement vos pages et génère des recommandations actionnables.'
                    : language === 'es'
                    ? 'Experiencia, Pericia, Autoridad, Fiabilidad — los 4 pilares que Google usa para evaluar la calidad de su contenido. Nuestra herramienta analiza automáticamente sus páginas y genera recomendaciones accionables.'
                    : 'Experience, Expertise, Authoritativeness, Trustworthiness — the 4 pillars Google uses to evaluate your content quality. Our tool automatically analyzes your pages and generates actionable recommendations.'}
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Link to="/app/eeat">
                    <Button size="lg" className="gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white border-0 shadow-lg">
                      <Search className="h-4 w-4" />
                      {language === 'fr' ? 'Lancer un audit E-E-A-T gratuit' : language === 'es' ? 'Iniciar una auditoría E-E-A-T gratis' : 'Run a free E-E-A-T audit'}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link to="/eeat">
                    <Button variant="outline" size="lg" className="gap-2">
                      {language === 'fr' ? 'En savoir plus' : language === 'es' ? 'Saber más' : 'Learn more'}
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Right — 4 pillar cards */}
              <div className="grid grid-cols-2 gap-4 w-full lg:w-[420px] shrink-0">
                {[
                  { letter: 'E', label: language === 'fr' ? 'Expérience' : 'Experience', color: 'from-blue-500 to-blue-600', icon: '🧑‍💻' },
                  { letter: 'E', label: language === 'fr' ? 'Expertise' : 'Expertise', color: 'from-emerald-500 to-emerald-600', icon: '🎓' },
                  { letter: 'A', label: language === 'fr' ? 'Autorité' : 'Authority', color: 'from-violet-500 to-violet-600', icon: '🏛️' },
                  { letter: 'T', label: language === 'fr' ? 'Fiabilité' : 'Trust', color: 'from-amber-500 to-amber-600', icon: '🛡️' },
                ].map((p) => (
                  <div key={p.label} className="rounded-xl border border-border/60 bg-card/80 backdrop-blur p-5 text-center space-y-2 hover:shadow-lg transition-shadow">
                    <span className="text-3xl">{p.icon}</span>
                    <p className={`text-2xl font-black bg-gradient-to-r ${p.color} bg-clip-text text-transparent`}>{p.letter}</p>
                    <p className="text-sm font-medium text-foreground">{p.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Log Analysis */}
        <Suspense fallback={<SectionSkeleton />}>
          <LogAnalysisSection />
        </Suspense>

        <Suspense fallback={<SectionSkeleton />}>
          <HybridSection />
        </Suspense>

        {/* Identity First */}
        <Suspense fallback={<SectionSkeleton />}>
          <IdentityFirstSection />
        </Suspense>

        {/* Breathing Spiral — Innovation de rupture */}
        <Suspense fallback={<SectionSkeleton />}>
          <BreathingSpiralSection />
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
        

        {/* CTA Marina — Rapport SEO & GEO complet */}
        <section className="relative overflow-hidden border-b border-border bg-gradient-to-br from-cyan-950/10 via-background to-blue-950/10 py-14 md:py-20">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.06),transparent_60%)]" />
          <div className="relative container mx-auto max-w-4xl px-4">
            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
              <div className="flex-1 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                  <Anchor className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold text-primary tracking-wide uppercase">Marina</span>
                </div>
                <h2 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl mb-3">
                  {language === 'fr' ? 'Intégrez notre outil d\'audit sur votre site via l\'API Marina' : language === 'es' ? 'Integre nuestra herramienta de auditoría en su sitio a través de la API Marina' : 'Integrate our audit tool on your site via the Marina API'}
                </h2>
                <p className="text-muted-foreground mb-4 max-w-lg">
                  {language === 'fr'
                    ? 'Entrez une URL. Marina génère un rapport professionnel de 15+ pages : audit technique, stratégie GEO, visibilité IA, cocoon sémantique. Idéal comme lead magnet pour vos prospects.'
                    : language === 'es'
                    ? 'Ingrese una URL. Marina genera un informe profesional de más de 15 páginas: auditoría técnica, estrategia GEO, visibilidad IA, cocoon semántico.'
                    : 'Enter a URL. Marina generates a 15+ page professional report: technical audit, GEO strategy, AI visibility, semantic cocoon. Perfect as a lead magnet for your prospects.'}
                </p>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {[
                    { icon: Search, label: language === 'fr' ? 'Audit technique' : 'Technical audit' },
                    { icon: Globe, label: language === 'fr' ? 'Score GEO' : 'GEO Score' },
                    { icon: Brain, label: language === 'fr' ? 'Visibilité LLM' : 'LLM Visibility' },
                  ].map((f, i) => (
                    <span key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/50 border border-border/50">
                      <f.icon className="w-3 h-3 text-primary" /> {f.label}
                    </span>
                  ))}
                </div>
                <div className="pt-2">
                  <Link to="/marina">
                    <Button
                      size="lg"
                      className="gap-2 bg-gradient-to-r from-primary to-cyan-600 hover:from-primary/90 hover:to-cyan-600/90 text-primary-foreground px-8 py-3 text-base font-bold shadow-md"
                    >
                      <Anchor className="h-5 w-5" />
                      {language === 'fr' ? 'Générer un rapport Marina' : language === 'es' ? 'Generar un informe Marina' : 'Generate a Marina report'}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="flex-shrink-0 w-full md:w-[360px]">
                <div className="rounded-2xl border border-primary/20 bg-card/50 backdrop-blur-sm p-6 shadow-2xl shadow-primary/5">
                  <div className="text-center mb-4">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                      <Anchor className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-bold text-foreground text-lg">5 crédits / rapport</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {language === 'fr' ? '5 crédits offerts à l\'inscription' : '5 free credits on signup'}
                    </p>
                  </div>
                  <div className="space-y-2 text-sm">
                    {[
                      language === 'fr' ? '15+ pages de données actionnables' : '15+ pages of actionable data',
                      language === 'fr' ? 'API disponible pour votre site' : 'API available for your site',
                      language === 'fr' ? 'Inclus dans Pro Agency' : 'Included in Pro Agency',
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Social Hub — SEO × Social × GEO */}
        <Suspense fallback={<SectionSkeleton />}>
          <SocialHubSection />
        </Suspense>

        {/* CTA Matrice — Freelance SEO */}
        <section className="relative overflow-hidden border-b border-border bg-gradient-to-br from-indigo-950/10 via-background to-violet-950/10 py-14 md:py-20">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(var(--primary)/0.06),transparent_60%)]" />
          <div className="relative container mx-auto max-w-4xl px-4">
            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
              <div className="flex-1 text-center md:text-left">
                <div className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 border border-violet-500/20 px-3 py-1 text-xs font-semibold text-violet-500 dark:text-violet-400 mb-4">
                  <Grid3X3 className="h-3.5 w-3.5" />
                  Gratuit
                </div>
                <h2 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl mb-3">
                  {language === 'fr' ? 'Matrice d\'audit : votre grille, nos robots' : language === 'es' ? 'Matriz de auditoría: su grilla, nuestros robots' : 'Audit Matrix: your grid, our bots'}
                </h2>
                <p className="text-muted-foreground mb-4 max-w-lg">
                  {language === 'fr'
                    ? 'Freelances SEO, importez votre propre grille d\'audit (Excel, CSV, Google Sheets) et laissez Crawlers analyser chaque critère automatiquement. Comparez le score parsé du document avec le score mesuré par nos crawlers — critère par critère, page par page.'
                    : language === 'es'
                    ? 'Freelancers SEO, importen su propia grilla de auditoría (Excel, CSV, Google Sheets) y dejen que Crawlers analice cada criterio automáticamente. Comparen la puntuación parseada con la medida por nuestros crawlers.'
                    : 'SEO freelancers, import your own audit grid (Excel, CSV, Google Sheets) and let Crawlers analyze each criterion automatically. Compare the parsed document score with the one measured by our crawlers — criterion by criterion, page by page.'}
                </p>
                <ul className="text-sm text-muted-foreground space-y-1.5 mb-6 max-w-lg">
                  {(language === 'fr' ? [
                    '✓ Importez n\'importe quelle grille d\'audit client',
                    '✓ Détection automatique des critères SEO, GEO, E-E-A-T, Performance…',
                    '✓ Double score : document parsé vs crawl réel',
                    '✓ Rapport exportable pour vos livrables clients',
                  ] : language === 'es' ? [
                    '✓ Importe cualquier grilla de auditoría de cliente',
                    '✓ Detección automática de criterios SEO, GEO, E-E-A-T, Rendimiento…',
                    '✓ Doble puntuación: documento parseado vs crawl real',
                    '✓ Informe exportable para sus entregables',
                  ] : [
                    '✓ Import any client audit grid',
                    '✓ Auto-detection of SEO, GEO, E-E-A-T, Performance criteria…',
                    '✓ Dual score: parsed document vs real crawl',
                    '✓ Exportable report for your client deliverables',
                  ]).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="flex-shrink-0 w-full md:w-[420px] space-y-6">
                <div className="rounded-2xl overflow-hidden border border-violet-500/20 shadow-2xl shadow-violet-500/10">
                  <img src={matriceScreenshot} alt="Crawlers.fr matrice audit SEO grille personnalisée" width={420} height={263} className="w-full h-auto" loading="lazy" decoding="async" />
                </div>
                <div className="text-center">
                  <Link to="/matrice">
                    <Button
                      size="lg"
                      className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold px-8 shadow-lg"
                    >
                      <Grid3X3 className="h-5 w-5" />
                      {language === 'fr' ? 'Essayer la Matrice' : language === 'es' ? 'Probar la Matriz' : 'Try the Matrix'}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* GA4 & GSC — Data Segregation */}
        <section className="border-y border-border bg-gradient-to-r from-blue-50/50 via-muted/30 to-emerald-50/50 dark:from-blue-950/10 dark:via-muted/10 dark:to-emerald-950/10 py-16 md:py-24">
          <div className="container mx-auto max-w-6xl px-4">
            <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
              {/* Text */}
              <div className="flex-1 space-y-5">
                <div className="inline-flex items-center gap-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full text-xs font-semibold">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {language === 'fr' ? 'Google Search Console & GA4' : language === 'es' ? 'Google Search Console & GA4' : 'Google Search Console & GA4'}
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
                  {language === 'fr' ? (
                    <>Vos données Google,<br /><span className="text-primary">strictement protégées</span></>
                  ) : language === 'es' ? (
                    <>Sus datos de Google,<br /><span className="text-primary">estrictamente protegidos</span></>
                  ) : (
                    <>Your Google data,<br /><span className="text-primary">strictly protected</span></>
                  )}
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  {language === 'fr'
                    ? 'Chez Crawlers.fr, les données issues de Google Search Console et Google Analytics 4 restent confinées dans notre écosystème interne. Un pare-feu de données garantit qu\'aucune information utilisateur Google n\'est jamais transmise aux LLMs tiers.'
                    : language === 'es'
                    ? 'En Crawlers.fr, los datos de Google Search Console y Google Analytics 4 permanecen confinados en nuestro ecosistema interno. Un firewall de datos garantiza que ninguna información de usuario de Google se transmita a LLMs de terceros.'
                    : 'At Crawlers.fr, data from Google Search Console and Google Analytics 4 remains confined within our internal ecosystem. A data firewall ensures no Google user information is ever transmitted to third-party LLMs.'}
                </p>
                <ul className="space-y-2.5 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2.5">
                    <Database className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                    {language === 'fr' ? 'Base PostgreSQL avec RLS — isolation par utilisateur' : language === 'es' ? 'Base PostgreSQL con RLS — aislamiento por usuario' : 'PostgreSQL with RLS — per-user isolation'}
                  </li>
                  <li className="flex items-start gap-2.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    {language === 'fr' ? 'Traitement IA interne via Gemini Pro uniquement (Google-to-Google)' : language === 'es' ? 'Procesamiento IA interno solo vía Gemini Pro (Google-to-Google)' : 'Internal AI processing via Gemini Pro only (Google-to-Google)'}
                  </li>
                  <li className="flex items-start gap-2.5">
                    <BarChart3 className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
                    {language === 'fr' ? 'Corrélation GSC × GA4 pour prédictions, impact SEO et détection d\'anomalies' : language === 'es' ? 'Correlación GSC × GA4 para predicciones, impacto SEO y detección de anomalías' : 'GSC × GA4 correlation for predictions, SEO impact and anomaly detection'}
                  </li>
                </ul>
                <Link to="/data-flow-diagram">
                  <Button size="lg" className="gap-2 mt-2 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white border-0 shadow-lg">
                    <ShieldCheck className="h-4 w-4" />
                    {language === 'fr' ? 'Voir l\'architecture complète' : language === 'es' ? 'Ver la arquitectura completa' : 'View full architecture'}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>

              {/* Mini diagram illustration */}
              <div className="flex-shrink-0 w-full lg:w-[440px]">
                <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-card shadow-xl overflow-hidden p-5 space-y-3">
                  {/* Left side mini */}
                  <div className="rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20 p-3 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                      <ShieldCheck className="h-3 w-3" /> {language === 'fr' ? 'Écosystème Google (Interne)' : 'Google Ecosystem (Internal)'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-blue-800 dark:text-blue-200">
                      <Globe className="h-3.5 w-3.5 text-blue-500" /> Search Console · GA4 · GMB
                    </div>
                    <div className="text-center text-blue-400">↓</div>
                    <div className="flex items-center gap-2 text-xs text-blue-800 dark:text-blue-200">
                      <Database className="h-3.5 w-3.5 text-blue-500" /> PostgreSQL (RLS)
                    </div>
                    <div className="text-center text-blue-400">↓</div>
                    <div className="flex items-center gap-2 text-xs text-blue-800 dark:text-blue-200">
                      <Brain className="h-3.5 w-3.5 text-blue-500" /> Gemini Pro
                    </div>
                  </div>
                  {/* Firewall */}
                  <div className="flex items-center gap-2">
                    <div className="h-0.5 flex-1 bg-red-500 rounded-full" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-red-500 px-2">DATA FIREWALL</span>
                    <div className="h-0.5 flex-1 bg-red-500 rounded-full" />
                  </div>
                  {/* Right side mini */}
                  <div className="rounded-lg border border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-950/20 p-3 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
                      <Globe className="h-3 w-3" /> {language === 'fr' ? 'LLMs Externes (Découplés)' : 'External LLMs (Decoupled)'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-orange-800 dark:text-orange-200">
                      OpenRouter → Grok · GPT
                    </div>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold text-center">
                      🔒 {language === 'fr' ? 'Aucune donnée Google transmise' : 'No Google data transmitted'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
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
