import { useState, useEffect, lazy, Suspense, memo } from 'react';
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

// Lazy load heavy dashboard components
const ResultsDashboard = lazy(() => import('@/components/ResultsDashboard').then(m => ({ default: m.ResultsDashboard })));
const PageSpeedDashboard = lazy(() => import('@/components/PageSpeedDashboard').then(m => ({ default: m.PageSpeedDashboard })));
const GeoDashboard = lazy(() => import('@/components/GeoDashboard').then(m => ({ default: m.GeoDashboard })));
const LLMDashboard = lazy(() => import('@/components/LLMDashboard').then(m => ({ default: m.LLMDashboard })));
const QuotaExceeded = lazy(() => import('@/components/QuotaExceeded').then(m => ({ default: m.QuotaExceeded })));

// Lazy load below-the-fold components with higher priority grouping
const FAQSection = lazy(() => import('@/components/FAQSection').then(m => ({ default: m.FAQSection })));
const GEOFAQSection = lazy(() => import('@/components/GEOFAQSection').then(m => ({ default: m.GEOFAQSection })));
const WhyVital2026Section = lazy(() => import('@/components/WhyVital2026Section').then(m => ({ default: m.WhyVital2026Section })));
const NewsCarousel = lazy(() => import('@/components/NewsCarousel').then(m => ({ default: m.NewsCarousel })));
const GEOComparisonTable = lazy(() => import('@/components/GEOComparisonTable').then(m => ({ default: m.GEOComparisonTable })));
const SolutionSection = lazy(() => import('@/components/SolutionSection').then(m => ({ default: m.SolutionSection })));
const MarketingBudgetSection = lazy(() => import('@/components/MarketingBudgetSection').then(m => ({ default: m.MarketingBudgetSection })));
const SEOvsGEOSection = lazy(() => import('@/components/SEOvsGEOSection').then(m => ({ default: m.SEOvsGEOSection })));

// Lazy load Footer - not needed for initial render
const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));
const FloatingReportButton = lazy(() => import('@/components/FloatingReportButton').then(m => ({ default: m.FloatingReportButton })));

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
  const { toast } = useToast();
  const { language } = useLanguage();

  // Dynamic SEO metadata per language (Option A: Fear/Urgency)
  useEffect(() => {
    const titles: Record<string, string> = {
      fr: "Votre site est-il invisible pour l'IA ? Score GEO gratuit | Crawlers.fr",
      en: "Is your site invisible to AI? Free GEO Score | Crawlers.fr",
      es: "¿Tu sitio es invisible para la IA? Score GEO gratis | Crawlers.fr",
    };
    const descriptions: Record<string, string> = {
      fr: "ChatGPT, Gemini, SGE : votre site est-il cité ou ignoré ? Obtenez votre Score GEO en 30 secondes. Audit gratuit sur 200 points. Découvrez si les LLM vous voient.",
      en: "ChatGPT, Gemini, SGE: is your site cited or ignored? Get your GEO Score in 30 seconds. Free 200-point audit. Find out if LLMs can see you.",
      es: "ChatGPT, Gemini, SGE: ¿tu sitio es citado o ignorado? Obtén tu Score GEO en 30 segundos. Auditoría gratuita de 200 puntos. Descubre si los LLM te ven.",
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

  // Inject JSON-LD structured data dynamically (moved from inline HTML to reduce critical chain)
  useStructuredData();

  // Fix canonical & hreflang for multilingual indexation (EN/ES pages)
  useCanonicalHreflang('/');

  // Inject FAQ JSON-LD only on the homepage
  useEffect(() => {
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Qu'est-ce qu'un audit technique SEO expert ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Un audit technique SEO expert analyse 200 points de votre site : performance, Core Web Vitals, données structurées, accessibilité et optimisation pour les moteurs de recherche comme Google. Notre outil gratuit fournit un rapport complet avec recommandations personnalisées."
          }
        },
        {
          "@type": "Question",
          "name": "Qu'est-ce que le score GEO et pourquoi est-il important pour ChatGPT et Gemini ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Le score GEO (Generative Engine Optimization) mesure l'optimisation de votre site pour les IA comme ChatGPT, Google Gemini et Perplexity. Un score GEO élevé signifie que votre contenu sera mieux compris et référencé par les LLM (Large Language Models) dans leurs réponses."
          }
        },
        {
          "@type": "Question",
          "name": "Comment améliorer mon référencement pour les moteurs de recherche IA ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Pour améliorer votre référencement IA : 1) Autorisez les crawlers IA dans robots.txt (GPTBot, ClaudeBot), 2) Utilisez des données structurées JSON-LD, 3) Lancez un audit gratuit sur Crawlers.fr pour vérifier vos fichiers llms.txt et votre sémantique."
          }
        },
        {
          "@type": "Question",
          "name": "L'audit SEO et GEO est-il vraiment gratuit et rapide ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Oui, notre audit technique SEO et GEO est 100% gratuit, sans inscription. L'analyse complète de votre site prend environ 30 secondes et inclut : score sur 200 points, Core Web Vitals, analyse des bots IA, et recommandations marketing personnalisées."
          }
        },
        {
          "@type": "Question",
          "name": "Quels LLM et IA sont analysés par votre outil ?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Notre outil analyse la compatibilité avec : ChatGPT (GPTBot, OAI-SearchBot), Google Gemini (Google-Extended), Claude (ClaudeBot), Perplexity (PerplexityBot), et d'autres crawlers IA. Nous vérifions également votre visibilité marketing dans ces moteurs génératifs."
          }
        }
      ]
    };
    const scriptEl = document.createElement('script');
    scriptEl.type = 'application/ld+json';
    scriptEl.setAttribute('data-schema', 'homepage-faq');
    scriptEl.textContent = JSON.stringify(faqSchema);
    document.head.appendChild(scriptEl);

    return () => {
      document.querySelectorAll('script[data-schema="homepage-faq"]').forEach(el => el.remove());
    };
  }, []);

  const handleCheck = async (url: string) => {
    setIsLoading(true);
    // Ne pas effacer les résultats existants - seulement mettre à jour l'outil actuel
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
        // Track free analysis
        trackAnalyticsEvent('free_analysis_crawlers', { targetUrl: url });
        storeAnalyzedUrl(url);
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
        // Track free analysis
        trackAnalyticsEvent('free_analysis_geo', { targetUrl: url });
        storeAnalyzedUrl(url);
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
        // Track free analysis
        trackAnalyticsEvent('free_analysis_llm', { targetUrl: url });
        storeAnalyzedUrl(url);
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
        // Track free analysis
        trackAnalyticsEvent('free_analysis_pagespeed', { targetUrl: url });
        storeAnalyzedUrl(url);
        toast({
          title: 'Analysis complete!',
          description: `PageSpeed score: ${data.data.scores.performance}/100`,
        });
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to check URL';
      
      // Track error
      trackAnalyticsEvent('error', { eventData: { message: errorMessage, url } });
      
      if (errorMessage.includes('quota') || errorMessage.includes('429')) {
        setQuotaExceeded(true);
        return;
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
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
        console.error('Error:', error);
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to refresh PageSpeed.',
          variant: 'destructive',
        });
      } finally {
        setIsPageSpeedLoading(false);
      }
    }
  };

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
        <div key="pagespeed-quota" className="border-b border-border/50 pb-8">
          <QuotaExceeded onRetry={handleRetry} />
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
          <LLMDashboard result={llmResult} isLoading={isLoading} />
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


  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1" role="main" aria-label="Contenu principal">
        <HeroSection 
          onSubmit={handleCheck} 
          isLoading={isLoading} 
          activeTab={activeTab}
        />
        <section aria-label="Outils d'analyse">
          <ToolTabs 
            activeTab={activeTab} 
            onTabChange={handleTabChange}
            currentUrl={currentUrl}
          />
          <Suspense fallback={<DashboardSkeleton />}>
            {renderDashboard()}
          </Suspense>
        </section>
        
        {/* Mobile-only Lexique button */}
        <MobileLexiqueButton />
        
        <Suspense fallback={<SectionSkeleton />}>
          <SolutionSection />
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          <WhyVital2026Section />
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          <GEOComparisonTable />
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          <MarketingBudgetSection />
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          <SEOvsGEOSection />
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          <NewsCarousel />
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          <GEOFAQSection />
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          <FAQSection />
        </Suspense>
      </main>
      <Suspense fallback={<div className="h-48 bg-muted/10" />}>
        <Footer />
      </Suspense>
      
      {/* Bouton rapport flottant - lazy loaded */}
      <Suspense fallback={null}>
        <FloatingReportButton
          crawlResult={crawlResult}
          geoResult={geoResult}
          llmResult={llmResult}
          pageSpeedResult={mobilePageSpeedResult || desktopPageSpeedResult}
          currentUrl={currentUrl}
        />
      </Suspense>
    </div>
  );
};

export default Index;
