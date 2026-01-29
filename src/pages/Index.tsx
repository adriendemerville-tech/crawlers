import { useState, lazy, Suspense, memo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/Header';
import { HeroSection } from '@/components/HeroSection';
import { ToolTabs, ToolTab } from '@/components/ToolTabs';
import { CrawlResult } from '@/types/crawler';
import { PageSpeedResult } from '@/types/pagespeed';
import { GeoResult } from '@/types/geo';
import { LLMAnalysisResult } from '@/types/llm';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

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
        toast({
          title: 'Analysis complete!',
          description: `PageSpeed score: ${data.data.scores.performance}/100`,
        });
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to check URL';
      
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
