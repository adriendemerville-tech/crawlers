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
        size="default"
        className="gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-[hsl(263,70%,38%)] hover:bg-[hsl(263,70%,32%)] text-white border border-[hsl(263,50%,25%)] shadow-sm transition-all duration-200"
      >
        <FileText className="h-4 w-4" />
        {getButtonLabel()}
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
