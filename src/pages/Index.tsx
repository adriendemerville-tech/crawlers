import { useState, lazy, Suspense } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/Header';
import { HeroSection } from '@/components/HeroSection';
import { ToolTabs, ToolTab } from '@/components/ToolTabs';
import { Footer } from '@/components/Footer';
import { DownloadReportButton } from '@/components/DownloadReportButton';
import { ShareReportButton } from '@/components/ShareReportButton';
import { CrawlResult } from '@/types/crawler';
import { PageSpeedResult } from '@/types/pagespeed';
import { GeoResult } from '@/types/geo';
import { LLMAnalysisResult } from '@/types/llm';
import { supabase } from '@/integrations/supabase/client';

// Lazy load heavy dashboard components
const ResultsDashboard = lazy(() => import('@/components/ResultsDashboard').then(m => ({ default: m.ResultsDashboard })));
const PageSpeedDashboard = lazy(() => import('@/components/PageSpeedDashboard').then(m => ({ default: m.PageSpeedDashboard })));
const GeoDashboard = lazy(() => import('@/components/GeoDashboard').then(m => ({ default: m.GeoDashboard })));
const LLMDashboard = lazy(() => import('@/components/LLMDashboard').then(m => ({ default: m.LLMDashboard })));
const QuotaExceeded = lazy(() => import('@/components/QuotaExceeded').then(m => ({ default: m.QuotaExceeded })));
const FAQSection = lazy(() => import('@/components/FAQSection').then(m => ({ default: m.FAQSection })));
const NewsCarousel = lazy(() => import('@/components/NewsCarousel').then(m => ({ default: m.NewsCarousel })));

// Skeleton loader for dashboards
const DashboardSkeleton = () => (
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
);

const Index = () => {
  const [activeTab, setActiveTab] = useState<ToolTab>('crawlers');
  const [isLoading, setIsLoading] = useState(false);
  const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);
  const [pageSpeedResult, setPageSpeedResult] = useState<PageSpeedResult | null>(null);
  const [geoResult, setGeoResult] = useState<GeoResult | null>(null);
  const [llmResult, setLlmResult] = useState<LLMAnalysisResult | null>(null);
  const [pageSpeedStrategy, setPageSpeedStrategy] = useState<'mobile' | 'desktop'>('mobile');
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const { toast } = useToast();

  const handleCheck = async (url: string) => {
    setIsLoading(true);
    setCrawlResult(null);
    setPageSpeedResult(null);
    setGeoResult(null);
    setLlmResult(null);
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
          body: { url }
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
          body: { url }
        });

        if (error) throw new Error(error.message);
        if (!data.success) throw new Error(data.error || 'Failed to analyze LLM visibility');

        setLlmResult(data.data);
        toast({
          title: 'Analysis complete!',
          description: `LLM Visibility Score: ${data.data.overallScore}/100`,
        });
      } else {
        const { data, error } = await supabase.functions.invoke('check-pagespeed', {
          body: { url, strategy: pageSpeedStrategy }
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

        setPageSpeedResult(data.data);
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
    if (currentUrl && activeTab === 'pagespeed' && !quotaExceeded) {
      setIsLoading(true);
      setPageSpeedResult(null);

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

        setPageSpeedResult(data.data);
      } catch (error) {
        console.error('Error:', error);
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to refresh PageSpeed.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleTabChange = (tab: ToolTab) => {
    setActiveTab(tab);
    setCrawlResult(null);
    setPageSpeedResult(null);
    setGeoResult(null);
    setLlmResult(null);
    setQuotaExceeded(false);
  };

  const handleRetry = () => {
    setQuotaExceeded(false);
    if (currentUrl) {
      handleCheck(currentUrl);
    }
  };

  const renderDashboard = () => {
    switch (activeTab) {
      case 'crawlers':
        return (
          <>
            <ResultsDashboard result={crawlResult} isLoading={isLoading} />
            <div className="flex justify-center gap-4 mt-6 mb-8 flex-wrap">
              <DownloadReportButton type="crawlers" crawlResult={crawlResult} />
              <ShareReportButton type="crawlers" url={currentUrl} crawlResult={crawlResult} />
            </div>
          </>
        );
      case 'geo':
        return (
          <>
            <GeoDashboard result={geoResult} isLoading={isLoading} />
            <div className="flex justify-center gap-4 mt-6 mb-8 flex-wrap">
              <DownloadReportButton type="geo" geoResult={geoResult} />
              <ShareReportButton type="geo" url={currentUrl} geoResult={geoResult} />
            </div>
          </>
        );
      case 'llm':
        return (
          <>
            <LLMDashboard result={llmResult} isLoading={isLoading} />
            <div className="flex justify-center gap-4 mt-6 mb-8 flex-wrap">
              <DownloadReportButton type="llm" llmResult={llmResult} />
              <ShareReportButton type="llm" url={currentUrl} llmResult={llmResult} />
            </div>
          </>
        );
      case 'pagespeed':
        if (quotaExceeded) {
          return <QuotaExceeded onRetry={handleRetry} />;
        }
        return (
          <>
            <PageSpeedDashboard 
              result={pageSpeedResult} 
              isLoading={isLoading}
              strategy={pageSpeedStrategy}
              onStrategyChange={handleStrategyChange}
            />
            <div className="flex justify-center gap-4 mt-6 mb-8 flex-wrap">
              <DownloadReportButton type="pagespeed" pageSpeedResult={pageSpeedResult} />
              <ShareReportButton type="pagespeed" url={currentUrl} pageSpeedResult={pageSpeedResult} />
            </div>
          </>
        );
    }
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
          <ToolTabs activeTab={activeTab} onTabChange={handleTabChange} />
          <Suspense fallback={<DashboardSkeleton />}>
            {renderDashboard()}
          </Suspense>
        </section>
        <Suspense fallback={<div className="h-96 animate-pulse bg-muted/30" />}>
          <NewsCarousel />
        </Suspense>
        <Suspense fallback={<div className="h-96" />}>
          <FAQSection />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
