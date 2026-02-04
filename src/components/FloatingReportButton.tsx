import { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { CrawlResult } from '@/types/crawler';
import { GeoResult } from '@/types/geo';
import { LLMAnalysisResult } from '@/types/llm';
import { PageSpeedResult } from '@/types/pagespeed';
import { ReportPreviewModal } from '@/components/ReportPreview';
import { DownloadAuthGate } from '@/components/DownloadAuthGate';
import { trackAnalyticsEvent } from '@/hooks/useAnalytics';

interface FloatingReportButtonProps {
  crawlResult?: CrawlResult | null;
  geoResult?: GeoResult | null;
  llmResult?: LLMAnalysisResult | null;
  pageSpeedResult?: PageSpeedResult | null;
  currentUrl: string;
}

export function FloatingReportButton({
  crawlResult,
  geoResult,
  llmResult,
  pageSpeedResult,
  currentUrl,
}: FloatingReportButtonProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [showAuthGate, setShowAuthGate] = useState(false);

  const hasAnyResult = !!(crawlResult || geoResult || llmResult || pageSpeedResult);

  // Check for pending download after auth
  useEffect(() => {
    if (user && hasAnyResult) {
      const pending = sessionStorage.getItem('download_pending');
      if (pending === 'true') {
        sessionStorage.removeItem('download_pending');
        sessionStorage.removeItem('download_return_path');
        // Open preview after successful auth
        setIsPreviewOpen(true);
      }
    }
  }, [user, hasAnyResult]);

  if (!hasAnyResult) return null;

  const handleReportButtonClick = () => {
    // Track report button click
    trackAnalyticsEvent('report_button_click', { targetUrl: currentUrl });
    
    if (!user) {
      setShowAuthGate(true);
    } else {
      setIsPreviewOpen(true);
    }
  };

  const handleAuthSuccess = () => {
    setShowAuthGate(false);
    setIsPreviewOpen(true);
  };

  const getButtonLabel = () => {
    switch (language) {
      case 'fr': return 'Rapport';
      case 'es': return 'Informe';
      default: return 'Report';
    }
  };

  // Determine the primary report type based on available results
  const getPrimaryReportType = (): 'crawlers' | 'geo' | 'llm' | 'pagespeed' | 'full' => {
    const resultCount = [crawlResult, geoResult, llmResult, pageSpeedResult].filter(Boolean).length;
    if (resultCount > 1) return 'full';
    if (crawlResult) return 'crawlers';
    if (geoResult) return 'geo';
    if (llmResult) return 'llm';
    if (pageSpeedResult) return 'pagespeed';
    return 'full';
  };

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <Button
          onClick={handleReportButtonClick}
          size="lg"
          className="gap-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg px-8 py-6 rounded-full shadow-2xl transition-all hover:scale-105"
        >
          <FileText className="h-6 w-6" />
          {getButtonLabel()}
        </Button>
      </div>

      {/* Report Preview Modal */}
      <ReportPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        type={getPrimaryReportType()}
        crawlResult={crawlResult}
        geoResult={geoResult}
        llmResult={llmResult}
        pageSpeedResult={pageSpeedResult}
        currentUrl={currentUrl}
      />

      {/* Auth Gate */}
      <DownloadAuthGate
        isOpen={showAuthGate}
        onClose={() => setShowAuthGate(false)}
        onAuthenticated={handleAuthSuccess}
      />
    </>
  );
}
