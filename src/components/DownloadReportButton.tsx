import { useState } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { CrawlResult } from '@/types/crawler';
import { GeoResult } from '@/types/geo';
import { LLMAnalysisResult } from '@/types/llm';
import { PageSpeedResult } from '@/types/pagespeed';
import { ReportPreviewModal } from '@/components/ReportPreview';

type ReportType = 'crawlers' | 'geo' | 'llm' | 'pagespeed';

interface DownloadReportButtonProps {
  type: ReportType;
  crawlResult?: CrawlResult | null;
  geoResult?: GeoResult | null;
  llmResult?: LLMAnalysisResult | null;
  pageSpeedResult?: PageSpeedResult | null;
}

export function DownloadReportButton({ 
  type, 
  crawlResult, 
  geoResult, 
  llmResult, 
  pageSpeedResult 
}: DownloadReportButtonProps) {
  const { language } = useLanguage();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const getButtonLabel = () => {
    switch (language) {
      case 'fr': return 'Rapport';
      case 'es': return 'Informe';
      default: return 'Report';
    }
  };

  const hasResult = 
    (type === 'crawlers' && crawlResult) ||
    (type === 'geo' && geoResult) ||
    (type === 'llm' && llmResult) ||
    (type === 'pagespeed' && pageSpeedResult);

  if (!hasResult) return null;

  return (
    <>
      <Button
        onClick={() => setIsPreviewOpen(true)}
        size="lg"
        className="gap-3 bg-primary text-primary-foreground font-bold text-lg px-8 py-6 hover:bg-primary/90"
      >
        {getButtonLabel()}
        <FileText className="h-6 w-6" />
      </Button>

      <ReportPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        type={type}
        crawlResult={crawlResult}
        geoResult={geoResult}
        llmResult={llmResult}
        pageSpeedResult={pageSpeedResult}
      />
    </>
  );
}
