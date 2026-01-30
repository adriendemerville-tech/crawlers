import { useState } from 'react';
import { Download, Share2, Loader2, Check, Copy, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ExpertAuditResult } from '@/types/expertAudit';
import { expertReportTranslations, generateExpertPDF, generateExpertReportHTML } from './expertReportExport';

interface ExpertReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: ExpertAuditResult;
  auditMode: 'technical' | 'strategic';
}


export function ExpertReportPreviewModal({ isOpen, onClose, result, auditMode }: ExpertReportPreviewModalProps) {
  const { language } = useLanguage();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const t =
    expertReportTranslations[language as keyof typeof expertReportTranslations] || expertReportTranslations.fr;

  const htmlContent = generateExpertReportHTML(result, auditMode, t, language);

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      generateExpertPDF(result, auditMode, t);
      toast.success(t.pdfSuccess);
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error(t.pdfError);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const { data: responseData, error } = await supabase.functions.invoke('share-report', {
        body: {
          type: 'expert-audit',
          url: result.url,
          data: { result, auditMode },
          language,
        },
      });

      if (error) throw error;

      if (responseData?.shareUrl) {
        // Transform to crawlers.fr domain
        const shareId = responseData.shareUrl.split('/').pop();
        const crawlersUrl = `https://crawlers.fr/r/${shareId}`;
        setShareUrl(crawlersUrl);
        toast.success(t.shareSuccess);
      }
    } catch (error) {
      console.error('Share error:', error);
      toast.error(t.shareError);
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyLink = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col p-0">
        {/* Header with actions */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
          <h2 className="text-lg font-semibold">{t.title}</h2>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="gap-2 bg-primary hover:bg-primary/90"
            >
              {isGeneratingPDF ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {isGeneratingPDF ? t.generating : t.download}
            </Button>
            <Button
              onClick={handlePrint}
              variant="outline"
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              {t.print}
            </Button>
            <Button
              onClick={handleShare}
              disabled={isSharing}
              variant="outline"
              className="gap-2"
            >
              {isSharing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
              {isSharing ? t.sharing : t.share}
            </Button>
          </div>
        </div>

        {/* Share link display */}
        {shareUrl && (
          <div className="px-6 py-3 bg-muted/50 border-b border-border">
            <p className="text-xs text-muted-foreground mb-2">{t.shareLink}</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-md font-mono"
              />
              <Button
                onClick={handleCopyLink}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? t.copied : t.copyLink}
              </Button>
            </div>
          </div>
        )}

        {/* HTML Preview */}
        <div className="flex-1 overflow-auto bg-muted/30">
          <iframe
            srcDoc={htmlContent}
            className="w-full h-full min-h-[600px]"
            title="Report Preview"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}