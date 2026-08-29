import { useState, useEffect, useRef, useCallback, lazy, Suspense, memo } from 'react';

import { useToast } from '@/hooks/use-toast';
import { SiloHub } from '@/components/seo/SiloHub';
import { Header } from '@/components/Header';
import { AuditedDomainsCounter } from '@/components/AuditedDomainsCounter';
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
import { useGeoMetaTags } from '@/hooks/useGeoMetaTags';
// Lazy reference — avoid static import that bloats critical bundle

import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { Link, useNavigate } from '@/lib/router-compat';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useAdmin } from '@/hooks/useAdmin';
import { Crown, ArrowRight, FileSearch, Search, Globe, Brain, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActiveCrawlBanner } from '@/components/ActiveCrawlBanner';
import { PageEditorial } from '@/components/seo/PageEditorial';
import { CitablePassage } from '@/components/seo/CitablePassage';
import { LazyVisible } from '@/components/LazyVisible';
import { getPublicConfig, isFlagEnabled } from '@/lib/config/publicConfig';

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

const HybridSection = lazy(() => import('@/components/HomepageSections').then(m => ({ default: m.HybridSection })));
const TrustBanner = lazy(() => import('@/components/HomepageSections').then(m => ({ default: m.TrustBanner })));
const AgencyComparisonSection = lazy(() => import('@/components/Homepage/AgencyComparisonSection'));
const AIAgentsSection = lazy(() => import('@/components/Homepage/AIAgentsSection').then(m => ({ default: m.AIAgentsSection })));
const ContentArchitectSection = lazy(() => import('@/components/Homepage/ContentArchitectSection').then(m => ({ default: m.ContentArchitectSection })));

const ProductShowcaseSection = lazy(() => import('@/components/Homepage/ProductShowcaseSection').then(m => ({ default: m.ProductShowcaseSection })));
const MarketplaceTeaserSection = lazy(() => import('@/components/Homepage/MarketplaceTeaserSection').then(m => ({ default: m.MarketplaceTeaserSection })));

const GoogleCrossDataSection = lazy(() => import('@/components/Homepage/GoogleCrossDataSection').then(m => ({ default: m.GoogleCrossDataSection })));

const PainPointsSection = lazy(() => import('@/components/Homepage/PainPointsSection').then(m => ({ default: m.PainPointsSection })));
const MarinaDeepAuditSection = lazy(() => import('@/components/Homepage/MarinaDeepAuditSection').then(m => ({ default: m.MarinaDeepAuditSection })));

const ExtensionSection = lazy(() => import('@/components/Homepage/ExtensionSection').then(m => ({ default: m.ExtensionSection })));

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

// Minimal skeleton for below-fold sections — hauteur réservée pour éviter le CLS
const SectionSkeleton = memo(() => (
  <div className="min-h-[400px] animate-pulse bg-muted/20" aria-hidden="true" />
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


  // Auto-redirect subscribed users to console with loading animation
  const { user: authUser } = useAuth();
  const { isAgencyPro: isSubscribed } = useCredits();
  const { isAdmin: isAdminUser } = useAdmin();
  const navTo = useNavigate();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const redirectStartedRef = useRef(false);
  useEffect(() => {
    if (redirectStartedRef.current) return;
    if (!authUser || !(isSubscribed || isAdminUser)) return;

    // Don't redirect if user navigated here from another page on the site
    const isInternalNavigation = document.referrer && (() => {
      try {
        const ref = new URL(document.referrer);
        return ref.origin === window.location.origin;
      } catch { return false; }
    })();
    if (isInternalNavigation) return;

    redirectStartedRef.current = true;
    setIsRedirecting(true);
    // Hard safety net: if client-side navigation is blocked for any reason,
    // fall back to a full page load so the spinner never stays forever.
    setTimeout(() => {
      try {
        navTo('/app/console?tab=tracking', { replace: true });
      } catch {
        window.location.href = '/app/console?tab=tracking';
      }
    }, 600);
    setTimeout(() => {
      if (window.location.pathname === '/') {
        window.location.href = '/app/console?tab=tracking';
      }
    }, 3500);
    // No cleanup: re-renders (credits refresh, admin check) must not cancel
    // an already-scheduled redirect — that was what froze the spinner.

  }, [authUser, isSubscribed, isAdminUser, navTo]);


  // Fetch hide_home_leadmagnet config — deferred to avoid blocking render
  useEffect(() => {
    const ctrl = new AbortController();
    const loadConfig = () => {
      getPublicConfig().then((config) => {
        if (isFlagEnabled(config.hide_home_leadmagnet)) setHideLeadmagnet(true);
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

  // Inject JSON-LD structured data dynamically (moved from inline HTML to reduce critical chain)
  useGeoMetaTags();

  // Fix canonical & hreflang for multilingual indexation (EN/ES pages)
  useCanonicalHreflang('/');

  // FAQPage JSON-LD : émis côté serveur par le head() de la route
  // (src/lib/seo/homeSchemas.ts). L'ancien useEffect créait un doublon client
  // jamais vu par Googlebot.

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
    <div className="home-root flex min-h-screen flex-col bg-background">
      {/* FAQPage + SoftwareApplication : déjà émis en SSR par le head() de la
          route (src/lib/seo/homeSchemas.ts) — aucun doublon client ici. */}
      <Header />
      <main className="flex-1 relative" role="main" aria-label={language === 'fr' ? 'Contenu principal' : language === 'es' ? 'Contenido principal' : 'Main content'}>
        {/* Global premium gradient overlay */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--brand-violet)/0.06),transparent_60%)]" />
        <HeroSection />

        {/* ─── Homepage marketing sections ─── */}

        {/* Témoignages — preuve sociale immédiate après le hero */}
        <Suspense fallback={<SectionSkeleton />}>
          <div className="cv-auto-sm"><TestimonialsCarousel /></div>
        </Suspense>

        {/* Pain Points — before Pro Agency */}
        <Suspense fallback={<SectionSkeleton />}>
          <div className="cv-auto home-bias-left"><PainPointsSection /></div>
        </Suspense>

        {/* Audit profond gratuit (Marina) — juste après les pain points */}
        <Suspense fallback={<SectionSkeleton />}>
          <div className="cv-auto home-bias-right"><MarinaDeepAuditSection /></div>
        </Suspense>

        {/* Preuve sociale : volume réel de domaines audités, juste sous les lead magnets */}
        <AuditedDomainsCounter />





        {/* Pro Agency hero */}
        <section className="relative overflow-hidden py-14 sm:py-20 cv-auto">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--brand-violet)/0.06),transparent_60%)]" />
            <div className="relative mx-auto max-w-4xl px-4 text-center">
              <h2 className="mb-4 t-h1 font-extrabold text-foreground">
                {language === 'fr' ? 'Gérez 30 clients. Audits illimités.' : language === 'es' ? 'Gestiona 30 clientes. Auditorías ilimitadas.' : 'Manage 30 clients. Unlimited audits.'}
              </h2>
              <p className="mx-auto mb-6 max-w-xl text-muted-foreground">
                {language === 'fr' ? (
                  <>
                    <strong>Rapports marque blanche</strong>, correctifs auto-déployés, <strong>crawl 5 000 pages/mois</strong> et agents IA — tout inclus.
                  </>
                ) : language === 'es' ? (
                  <>
                    <strong>Informes marca blanca</strong>, correcciones auto-desplegadas, <strong>crawl 5 000 páginas/mes</strong> y agentes IA — todo incluido.
                  </>
                ) : (
                  <>
                    <strong>White-label reports</strong>, auto-deployed fixes, <strong>5,000 pages/month crawl</strong> &amp; AI agents — all included.
                  </>
                )}
              </p>
              {/* Mini stats */}
              <div className="mx-auto mb-6 grid max-w-lg grid-cols-5 gap-2">
                {[
                  { v: '∞', l: language === 'fr' ? 'Audits' : 'Audits' },
                  { v: '30', l: language === 'fr' ? 'Sites' : 'Sites' },
                  { v: '5K', l: language === 'fr' ? 'Pages/mois' : 'Pages/mo' },
                  { v: '24', l: language === 'fr' ? 'Algorithmes' : 'Algorithms' },
                  { v: '16', l: language === 'fr' ? 'Agents autonomes' : language === 'es' ? 'Agentes autónomos' : 'Autonomous agents' },
                ].map((s, i) => (
                  <div key={i} className="rounded-lg border border-border/50 bg-card/30 px-3 py-2 text-center">
                    <div className="text-xl font-extrabold text-foreground">{s.v}</div>
                    <div className="text-[10px] text-muted-foreground">{s.l}</div>
                  </div>
                ))}
              </div>
              {/* Tarification explicite — 3 plans */}
              <div className="mx-auto mb-6 grid max-w-3xl gap-3 sm:grid-cols-3">
                {/* Pro Agency */}
                <div className="rounded-xl border border-violet-500/40 bg-card/50 p-4 text-left">
                  <div className="text-sm font-bold text-foreground">Pro Agency</div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-foreground">29€</span>
                    <span className="text-xs text-muted-foreground">/{language === 'fr' ? 'mois' : language === 'es' ? 'mes' : 'mo'}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {language === 'fr' ? 'ou 26,10€/mois en annuel (-10%)' : language === 'es' ? 'o 26,10€/mes anual (-10%)' : 'or €26.10/mo billed annually (-10%)'}
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {language === 'fr' ? 'Freelances & petites agences · 5 000 pages/mois · sans engagement' : language === 'es' ? 'Freelances y pequeñas agencias · 5 000 páginas/mes · sin compromiso' : 'Freelancers & small agencies · 5,000 pages/mo · no commitment'}
                  </div>
                </div>
                {/* Pro Agency + */}
                <div className="rounded-xl border border-amber-400/50 bg-card/50 p-4 text-left">
                  <div className="text-sm font-bold text-foreground">Pro Agency +</div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-foreground">79€</span>
                    <span className="text-xs text-muted-foreground">/{language === 'fr' ? 'mois' : language === 'es' ? 'mes' : 'mo'}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {language === 'fr' ? 'ou 71,10€/mois en annuel (-10%)' : language === 'es' ? 'o 71,10€/mes anual (-10%)' : 'or €71.10/mo billed annually (-10%)'}
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {language === 'fr' ? 'Agences 10+ clients · 50 000 pages/mois · API Marina incluse' : language === 'es' ? 'Agencias 10+ clientes · 50 000 páginas/mes · API Marina incluida' : 'Agencies 10+ clients · 50,000 pages/mo · Marina API included'}
                  </div>
                </div>
                {/* Enterprise */}
                <div className="rounded-xl border border-border bg-card/50 p-4 text-left">
                  <div className="text-sm font-bold text-foreground">Enterprise</div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-foreground">{language === 'fr' ? 'Sur devis' : language === 'es' ? 'A medida' : 'Custom'}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {language === 'fr' ? 'Tout illimité · SSO SAML · serveur dédié' : language === 'es' ? 'Todo ilimitado · SSO SAML · servidor dedicado' : 'Everything unlimited · SAML SSO · dedicated server'}
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {language === 'fr' ? 'Grands comptes & équipes 20+' : language === 'es' ? 'Grandes cuentas y equipos 20+' : 'Large accounts & 20+ teams'}
                  </div>
                </div>
              </div>
              <p className="mx-auto mb-6 max-w-2xl text-xs text-muted-foreground">
                {language === 'fr'
                  ? 'Hors abonnement : les audits ponctuels se paient en crédits (Pay-As-You-Go), sans engagement. Les abonnements incluent un quota mensuel de pages ; au-delà, vous complétez avec des packs de crédits.'
                  : language === 'es'
                    ? 'Sin suscripción: las auditorías puntuales se pagan con créditos (Pay-As-You-Go), sin compromiso. Las suscripciones incluyen una cuota mensual de páginas; más allá, se completa con packs de créditos.'
                    : 'Without a subscription, one-off audits are paid in credits (Pay-As-You-Go), no commitment. Subscriptions include a monthly page quota; beyond it, top up with credit packs.'}
              </p>
              <div className="flex flex-col items-center gap-4 mb-6">
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


        {/* Comparatif Agence SEO vs Crawlers */}
        <Suspense fallback={<SectionSkeleton />}>
          <div className="cv-auto"><AgencyComparisonSection /></div>
        </Suspense>

        {/* Trust Banner — right after Pro Agency */}
        <Suspense fallback={<SectionSkeleton />}>
          <div className="cv-auto"><TrustBanner /></div>
        </Suspense>

        {/* Product Showcase — Screenshots */}
        <div id="features">
          <LazyVisible minHeight="600px">
            <Suspense fallback={<SectionSkeleton />}>
              <div className="cv-auto-lg"><ProductShowcaseSection /></div>
            </Suspense>
          </LazyVisible>
        </div>

        {/* Place d'échange de backlinks */}
        <LazyVisible minHeight="420px">
          <Suspense fallback={<SectionSkeleton />}>
            <div className="cv-auto"><MarketplaceTeaserSection /></div>
          </Suspense>
        </LazyVisible>

        {/* Google Cross Data — SEA→SEO Bridge */}
        <LazyVisible minHeight="500px">
          <Suspense fallback={<SectionSkeleton />}>
            <div className="cv-auto"><GoogleCrossDataSection /></div>
          </Suspense>
        </LazyVisible>

        <LazyVisible minHeight="400px">
          <Suspense fallback={<SectionSkeleton />}>
            <div className="cv-auto"><MomentumSection /></div>
          </Suspense>
        </LazyVisible>

        {/* AI Agents — Félix & Stratège Cocoon */}
        <LazyVisible minHeight="500px">
          <Suspense fallback={<SectionSkeleton />}>
            <div className="cv-auto-lg home-bias-left"><AIAgentsSection /></div>
          </Suspense>
        </LazyVisible>

        {/* Content Architect */}
        <LazyVisible minHeight="500px">
          <Suspense fallback={<SectionSkeleton />}>
            <div className="cv-auto-lg home-bias-right"><ContentArchitectSection /></div>
          </Suspense>
        </LazyVisible>

        {/* E-E-A-T Section */}
        <section className="py-20 relative overflow-hidden cv-auto">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/3 via-transparent to-emerald-500/3" />
          <div className="container mx-auto px-4 relative z-10">
            <div className="flex flex-col lg:flex-row items-center gap-12">
              {/* Left — text */}
              <div className="flex-1 space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {language === 'fr' ? 'E-E-A-T · Confiance Google' : language === 'es' ? 'E-E-A-T · Confianza Google' : 'E-E-A-T · Google Trust'}
                </div>
                <h2 className="t-h1 font-bold">
                  {language === 'fr'
                    ? 'Mesurez votre score E-E-A-T et renforcez votre crédibilité'
                    : language === 'es'
                    ? 'Mida su puntuación E-E-A-T y refuerce su credibilidad'
                    : 'Measure your E-E-A-T score and boost your credibility'}
                </h2>
                <p className="text-muted-foreground leading-relaxed max-w-xl">
                  {language === 'fr' ? (
                    <>
                      <strong>Expérience, Expertise, Autorité, Fiabilité</strong> — les 4 piliers que Google utilise pour évaluer la qualité de votre contenu. Notre outil <strong>analyse automatiquement vos pages</strong> et génère des recommandations actionnables.
                    </>
                  ) : language === 'es' ? (
                    <>
                      <strong>Experiencia, Pericia, Autoridad, Fiabilidad</strong> — los 4 pilares que Google usa para evaluar la calidad de su contenido. Nuestra herramienta <strong>analiza automáticamente sus páginas</strong> y genera recomendaciones accionables.
                    </>
                  ) : (
                    <>
                      <strong>Experience, Expertise, Authoritativeness, Trustworthiness</strong> — the 4 pillars Google uses to evaluate your content quality. Our tool <strong>automatically analyzes your pages</strong> and generates actionable recommendations.
                    </>
                  )}
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
                  { letter: 'E', label: language === 'fr' ? 'Expérience' : 'Experience', Icon: FileSearch },
                  { letter: 'E', label: language === 'fr' ? 'Expertise' : 'Expertise', Icon: Brain },
                  { letter: 'A', label: language === 'fr' ? 'Autorité' : 'Authority', Icon: Globe },
                  { letter: 'T', label: language === 'fr' ? 'Fiabilité' : 'Trust', Icon: ShieldCheck },
                ].map((p) => (
                  <div key={p.label} className="rounded-xl border border-border/60 bg-card/80 backdrop-blur p-5 text-center space-y-2 hover:shadow-lg transition-shadow">
                    <p.Icon className="h-7 w-7 mx-auto text-muted-foreground" strokeWidth={1.5} />
                    <p className="text-2xl font-black text-foreground">{p.letter}</p>
                    <p className="text-sm font-medium text-muted-foreground">{p.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>


        <LazyVisible minHeight="500px">
          <Suspense fallback={<SectionSkeleton />}>
            <div className="cv-auto home-bias-left"><HybridSection /></div>
          </Suspense>
        </LazyVisible>


        {/* Chrome Extension — short teaser */}
        <LazyVisible minHeight="400px">
          <Suspense fallback={<SectionSkeleton />}>
            <div className="cv-auto home-bias-right"><ExtensionSection /></div>
          </Suspense>
        </LazyVisible>


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
            <div className="mx-auto max-w-2xl rounded-2xl border-2 border-primary/40 bg-card/60 p-6 sm:p-8 text-center shadow-lg">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 px-3 py-1 text-xs font-semibold text-primary mb-3">
                <Crown className="h-3.5 w-3.5" />
                {language === 'fr' ? 'Aller plus loin' : language === 'es' ? 'Ir más allá' : 'Go further'}
              </div>
              <h3 className="t-h2 font-bold text-foreground mb-2 font-display">
                {language === 'fr' ? 'Obtenez votre audit complet sur 168 critères' : language === 'es' ? 'Obtenga su auditoría completa con 168 criterios' : 'Get your full audit across 168 criteria'}
              </h3>
              <p className="text-sm text-muted-foreground mb-5 max-w-lg mx-auto">
                {language === 'fr'
                  ? 'Diagnostic SEO & GEO approfondi, plan d\'action personnalisé et code correctif prêt à déployer.'
                  : language === 'es'
                  ? 'Diagnóstico SEO & GEO profundo, plan de acción personalizado y código correctivo listo para implementar.'
                  : 'In-depth SEO & GEO diagnosis, personalized action plan & corrective code ready to deploy.'}
              </p>
              <Link to={currentUrl ? `/audit-expert?url=${encodeURIComponent(currentUrl)}&autolaunch=1` : '/audit-expert'}>
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
        





        {/* Contenu éditorial SSR : matière indexable + passages citables (GEO) */}
        <PageEditorial
          heading={language === 'fr'
            ? "Crawlers.fr, c'est quoi exactement ?"
            : language === 'es'
            ? '¿Qué es Crawlers.fr exactamente?'
            : 'What exactly is Crawlers.fr?'}
          intro={language === 'fr'
            ? "Crawlers.fr est né d'un constat simple : un site ne se référence plus seulement sur Google, il doit aussi être cité par les IA. La plateforme réunit dans un même audit le crawl technique classique et la mesure de visibilité dans les moteurs génératifs."
            : language === 'es'
            ? 'Crawlers.fr nació de una constatación simple: un sitio ya no se posiciona solo en Google, también debe ser citado por las IA. La plataforma reúne en una misma auditoría el rastreo técnico clásico y la medición de visibilidad en los motores generativos.'
            : 'Crawlers.fr was born from a simple observation: a site no longer ranks only on Google, it must also be cited by AI. The platform combines classic technical crawling and generative-engine visibility measurement in a single audit.'}
          citable={language === 'fr'
            ? "Crawlers.fr est un outil de crawl SEO et GEO qui audite un site web sur 168 critères techniques, mesure sa visibilité dans ChatGPT, Gemini et Perplexity, puis génère un plan d'action correctif prêt à déployer."
            : language === 'es'
            ? 'Crawlers.fr es una herramienta de rastreo SEO y GEO que audita un sitio web sobre 168 criterios técnicos, mide su visibilidad en ChatGPT, Gemini y Perplexity, y genera un plan de acción correctivo listo para implementar.'
            : 'Crawlers.fr is an SEO and GEO crawl tool that audits a website across 168 technical criteria, measures its visibility in ChatGPT, Gemini and Perplexity, then generates a corrective action plan ready to deploy.'}
          sections={language === 'fr' ? [
            {
              title: 'Pourquoi auditer à la fois le SEO et le GEO ?',
              paragraphs: [
                "Le SEO classique optimise un site pour les résultats de Google. Le GEO (Generative Engine Optimization) optimise le même site pour être compris, extrait et cité par les réponses générées par les IA. Les deux disciplines partagent le même socle technique — crawlabilité, données structurées, performance — mais divergent sur la forme du contenu : les IA privilégient les passages autoportants, factuels et correctement balisés.",
                "Traiter les deux séparément coûte deux audits, deux outils et deux plans d'action. Crawlers.fr les fusionne : chaque critère technique est évalué sous l'angle Google et sous l'angle des moteurs génératifs, avec une priorisation unique.",
              ],
            },
            {
              title: "Ce que l'audit mesure concrètement",
              paragraphs: [
                "L'audit couvre 168 critères répartis en cinq familles : performance (Core Web Vitals mobile et desktop), crawlabilité (robots.txt, sitemap, statuts HTTP), données structurées (JSON-LD, Open Graph), contenu (titres, hiérarchie, densité) et visibilité IA.",
              ],
              bullets: [
                'Compatibilité avec GPTBot, ClaudeBot, PerplexityBot et Google-Extended, vérifiée sur robots.txt, llms.txt et en-têtes.',
                'Score GEO sur 100 mesurant la capacité du contenu à être cité par ChatGPT, Gemini et Perplexity.',
                'Core Web Vitals réels (LCP, INP, CLS) mesurés sur mobile et desktop.',
                "Plan d'action hiérarchisé par impact, avec le code correctif prêt à déployer pour les critères techniques.",
              ],
            },
            {
              title: 'Pour qui ?',
              paragraphs: [
                "Freelances et agences qui gèrent plusieurs sites : la console centralise audits, suivi de positions, backlinks et citations IA par domaine, avec rapports en marque blanche. Dirigeants et responsables marketing : l'audit expert produit un diagnostic priorisé et chiffré, sans jargon, prêt à déléguer à un développeur ou à un rédacteur.",
              ],
            },
          ] : language === 'es' ? [
            {
              title: '¿Por qué auditar SEO y GEO a la vez?',
              paragraphs: [
                'El SEO clásico optimiza un sitio para los resultados de Google. El GEO (Generative Engine Optimization) optimiza el mismo sitio para ser comprendido, extraído y citado por las respuestas generadas por las IA. Ambas disciplinas comparten la misma base técnica, pero divergen en la forma del contenido.',
              ],
            },
            {
              title: 'Qué mide concretamente la auditoría',
              paragraphs: [
                'La auditoría cubre 168 criterios: rendimiento (Core Web Vitals), rastreabilidad (robots.txt, sitemap), datos estructurados (JSON-LD), contenido y visibilidad IA.',
              ],
            },
          ] : [
            {
              title: 'Why audit SEO and GEO together?',
              paragraphs: [
                'Classic SEO optimizes a site for Google results. GEO (Generative Engine Optimization) optimizes the same site to be understood, extracted and cited by AI-generated answers. Both share the same technical foundation but diverge on content form: AI favors self-contained, factual, properly marked-up passages.',
              ],
            },
            {
              title: 'What the audit actually measures',
              paragraphs: [
                'The audit covers 168 criteria: performance (Core Web Vitals), crawlability (robots.txt, sitemap), structured data (JSON-LD), content and AI visibility.',
              ],
            },
          ]}
        />
        <div className="mx-auto max-w-3xl px-4 pb-10 space-y-4">
          <CitablePassage source="Crawlers.fr">
            {language === 'fr'
              ? "Crawlers.fr analyse la compatibilité d'un site avec GPTBot, ClaudeBot, PerplexityBot et Google-Extended à partir de son robots.txt, de son fichier llms.txt et de ses données structurées JSON-LD."
              : language === 'es'
              ? 'Crawlers.fr analiza la compatibilidad de un sitio con GPTBot, ClaudeBot, PerplexityBot y Google-Extended a partir de su robots.txt, su archivo llms.txt y sus datos estructurados JSON-LD.'
              : 'Crawlers.fr checks a site\'s compatibility with GPTBot, ClaudeBot, PerplexityBot and Google-Extended from its robots.txt, its llms.txt file and its JSON-LD structured data.'}
          </CitablePassage>
          <CitablePassage source="Crawlers.fr">
            {language === 'fr'
              ? "L'audit gratuit de Crawlers.fr s'exécute en environ 30 secondes, sans inscription ni carte bancaire, et produit un score GEO sur 100 accompagné d'un plan d'action hiérarchisé."
              : language === 'es'
              ? 'La auditoría gratuita de Crawlers.fr se ejecuta en unos 30 segundos, sin registro ni tarjeta bancaria, y produce un score GEO sobre 100 con un plan de acción jerarquizado.'
              : 'Crawlers.fr\'s free audit runs in about 30 seconds, with no sign-up or credit card, and produces a GEO score out of 100 with a prioritized action plan.'}
          </CitablePassage>
        </div>

        <LazyVisible minHeight="500px">
          <Suspense fallback={<SectionSkeleton />}>
            <div className="cv-auto"><FAQSection /></div>
          </Suspense>
        </LazyVisible>

        {/* Hub des 4 silos : la home transmet l'autorité aux piliers */}
        <LazyVisible minHeight="400px">
          <Suspense fallback={<SectionSkeleton />}>
            <div className="cv-auto"><SiloHub /></div>
          </Suspense>
        </LazyVisible>
      </main>
      <Suspense fallback={<div className="h-48 bg-muted/10" />}>
        <Footer />
      </Suspense>
      
    </div>
  );
};

export default Index;
