import { useState, lazy, Suspense } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/Header';
import { HeroSection } from '@/components/HeroSection';
import { ToolTabs, ToolTab } from '@/components/ToolTabs';
import { Footer } from '@/components/Footer';
import { FloatingReportButton } from '@/components/FloatingReportButton';
import { CrawlResult } from '@/types/crawler';
import { PageSpeedResult } from '@/types/pagespeed';
import { GeoResult } from '@/types/geo';
import { LLMAnalysisResult } from '@/types/llm';
import { StrategicAuditResult } from '@/types/audit';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

// Lazy load heavy dashboard components
const ResultsDashboard = lazy(() => import('@/components/ResultsDashboard').then(m => ({ default: m.ResultsDashboard })));
const PageSpeedDashboard = lazy(() => import('@/components/PageSpeedDashboard').then(m => ({ default: m.PageSpeedDashboard })));
const GeoDashboard = lazy(() => import('@/components/GeoDashboard').then(m => ({ default: m.GeoDashboard })));
const LLMDashboard = lazy(() => import('@/components/LLMDashboard').then(m => ({ default: m.LLMDashboard })));
const StrategicAuditDashboard = lazy(() => import('@/components/StrategicAuditDashboard').then(m => ({ default: m.StrategicAuditDashboard })));
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
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);
  const [pageSpeedResult, setPageSpeedResult] = useState<PageSpeedResult | null>(null);
  const [geoResult, setGeoResult] = useState<GeoResult | null>(null);
  const [llmResult, setLlmResult] = useState<LLMAnalysisResult | null>(null);
  const [auditResult, setAuditResult] = useState<StrategicAuditResult | null>(null);
  const [showAuditDashboard, setShowAuditDashboard] = useState(false);
  const [pageSpeedStrategy, setPageSpeedStrategy] = useState<'mobile' | 'desktop'>('mobile');
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
    // Ne pas effacer les résultats existants - ils restent visibles
    setQuotaExceeded(false);
  };

  const handleRetry = () => {
    setQuotaExceeded(false);
    if (currentUrl) {
      handleCheck(currentUrl);
    }
  };

  // Run all 4 tools in parallel and generate strategic audit
  const handleFullAudit = async () => {
    if (!currentUrl) {
      toast({
        title: 'URL requise',
        description: 'Veuillez d\'abord analyser une URL avec l\'un des outils.',
        variant: 'destructive',
      });
      return;
    }

    setIsAuditLoading(true);
    setShowAuditDashboard(true);
    setAuditResult(null);

    try {
      // Run all 4 checks in parallel
      const [crawlersRes, geoRes, llmRes, pagespeedRes] = await Promise.all([
        supabase.functions.invoke('check-crawlers', { body: { url: currentUrl } }),
        supabase.functions.invoke('check-geo', { body: { url: currentUrl, lang: language } }),
        supabase.functions.invoke('check-llm', { body: { url: currentUrl, lang: language } }),
        supabase.functions.invoke('check-pagespeed', { body: { url: currentUrl, strategy: 'mobile' } }),
      ]);

      const toolsData = {
        crawlers: crawlersRes.data?.data || null,
        geo: geoRes.data?.data || null,
        llm: llmRes.data?.data || null,
        pagespeed: pagespeedRes.data?.data || null,
      };

      // Update individual results for other tabs
      if (crawlersRes.data?.success) setCrawlResult(crawlersRes.data.data);
      if (geoRes.data?.success) setGeoResult(geoRes.data.data);
      if (llmRes.data?.success) setLlmResult(llmRes.data.data);
      if (pagespeedRes.data?.success) setPageSpeedResult(pagespeedRes.data.data);

      // Generate strategic audit with AI
      const { data: auditData, error: auditError } = await supabase.functions.invoke('audit-strategic', {
        body: { url: currentUrl, toolsData }
      });

      if (auditError) throw new Error(auditError.message);
      if (!auditData.success) throw new Error(auditData.error || 'Failed to generate audit');

      setAuditResult(auditData.data);
      toast({
        title: 'Audit stratégique terminé !',
        description: `Score de citabilité 2026 : ${auditData.data.overallScore}/100`,
      });

    } catch (error) {
      console.error('Audit error:', error);
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Échec de l\'audit stratégique',
        variant: 'destructive',
      });
      setShowAuditDashboard(false);
    } finally {
      setIsAuditLoading(false);
    }
  };

  const renderDashboard = () => {
    // Afficher tous les résultats empilés : récents en haut, anciens en bas
    const dashboards = [];

    // Audit stratégique toujours en premier s'il est actif
    if (showAuditDashboard) {
      dashboards.push(
        <div key="audit" className="border-b border-border/50 pb-8">
          <StrategicAuditDashboard result={auditResult} isLoading={isAuditLoading} />
        </div>
      );
    }

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
          <ResultsDashboard result={crawlResult} isLoading={isLoading && !showAuditDashboard} />
        </div>
      );
    } else if (activeTab === 'geo') {
      dashboards.push(
        <div key="geo-current" className="border-b border-border/50 pb-8">
          <GeoDashboard result={geoResult} isLoading={isLoading && !showAuditDashboard} />
        </div>
      );
    } else if (activeTab === 'llm') {
      dashboards.push(
        <div key="llm-current" className="border-b border-border/50 pb-8">
          <LLMDashboard result={llmResult} isLoading={isLoading && !showAuditDashboard} />
        </div>
      );
    } else if (activeTab === 'pagespeed') {
      dashboards.push(
        <div key="pagespeed-current" className="border-b border-border/50 pb-8">
          <PageSpeedDashboard 
            result={pageSpeedResult} 
            isLoading={isLoading && !showAuditDashboard}
            strategy={pageSpeedStrategy}
            onStrategyChange={handleStrategyChange}
          />
        </div>
      );
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

    if (activeTab !== 'pagespeed' && pageSpeedResult) {
      dashboards.push(
        <div key="pagespeed-prev" className="border-b border-border/50 pb-8 opacity-80">
          <PageSpeedDashboard 
            result={pageSpeedResult} 
            isLoading={false}
            strategy={pageSpeedStrategy}
            onStrategyChange={handleStrategyChange}
          />
        </div>
      );
    }

    return <div className="space-y-8 pb-24">{dashboards}</div>;
  };

  // Check if any tool has results
  const hasAnyResult = !!(crawlResult || geoResult || llmResult || pageSpeedResult);

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
            onFullAudit={handleFullAudit}
            isAuditLoading={isAuditLoading}
            showAuditButton={!!currentUrl || hasAnyResult}
            isAuditActive={showAuditDashboard}
          />
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
      
      {/* Bouton rapport flottant */}
      <FloatingReportButton
        crawlResult={crawlResult}
        geoResult={geoResult}
        llmResult={llmResult}
        pageSpeedResult={pageSpeedResult}
        currentUrl={currentUrl}
      />
    </div>
  );
};

export default Index;
