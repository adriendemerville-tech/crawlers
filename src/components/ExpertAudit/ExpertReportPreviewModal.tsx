import { useEffect, useState, useRef } from 'react';
import { Download, Link2, Loader2, Check, Copy, Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ExpertAuditResult } from '@/types/expertAudit';
import { expertReportTranslations, generateExpertReportHTML, WhiteLabelBranding, summarizeStrategicResult } from './expertReportExport';
import { useAuth } from '@/contexts/AuthContext';
import { useSaveReport } from '@/hooks/useSaveReport';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAdmin } from '@/hooks/useAdmin';

interface ExpertReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: ExpertAuditResult;
  auditMode: 'technical' | 'strategic';
  preSummarizedResult?: ExpertAuditResult | null;
}


export function ExpertReportPreviewModal({ isOpen, onClose, result, auditMode, preSummarizedResult }: ExpertReportPreviewModalProps) {
  const { language } = useLanguage();
  const { user, profile } = useAuth();
  const { isAdmin } = useAdmin();
  const { saveReport } = useSaveReport();
  const isMobile = useIsMobile();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [summarizedResult, setSummarizedResult] = useState<ExpertAuditResult | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const hasSavedRef = useRef<string | null>(null);

  const t =
    expertReportTranslations[language as keyof typeof expertReportTranslations] || expertReportTranslations.fr;

  // White-label branding: available for any subscribed user or admin with custom branding configured
  const isSubscribedOrAdmin = profile && (
    profile.plan_type !== 'free' || isAdmin
  );
  const hasCustomBranding = profile && (profile.agency_logo_url || profile.agency_primary_color || profile.agency_brand_name);
  const branding: WhiteLabelBranding | undefined =
    isSubscribedOrAdmin && hasCustomBranding
      ? { logoUrl: profile.agency_logo_url, primaryColor: profile.agency_primary_color }
      : undefined;

  // Use pre-summarized result if available, otherwise summarize on open
  useEffect(() => {
    if (!isOpen || auditMode !== 'strategic') {
      setSummarizedResult(null);
      return;
    }
    // If dashboard already pre-summarized, use it directly
    if (preSummarizedResult) {
      setSummarizedResult(preSummarizedResult);
      return;
    }
    // Fallback: summarize when modal opens
    let cancelled = false;
    setIsSummarizing(true);
    summarizeStrategicResult(result, language).then((r) => {
      if (!cancelled) {
        setSummarizedResult(r);
        setIsSummarizing(false);
      }
    });
    return () => { cancelled = true; };
  }, [isOpen, result, auditMode, language]);

  // Auto-save strategic report after AI summarization completes
  useEffect(() => {
    if (!summarizedResult || !user || auditMode !== 'strategic') return;
    const saveKey = `${result.url}-${auditMode}`;
    if (hasSavedRef.current === saveKey) return;
    hasSavedRef.current = saveKey;

    const reportType = 'seo_strategic' as const;
    const domain = (() => { try { return new URL(result.url.startsWith('http') ? result.url : `https://${result.url}`).hostname; } catch { return result.url; } })();
    saveReport({
      reportType,
      title: `Audit Stratégique – ${domain}`,
      url: result.url,
      reportData: { result: summarizedResult, auditMode },
    });
  }, [summarizedResult, user, auditMode, result]);

  // Auto-save technical report when modal opens
  useEffect(() => {
    if (!isOpen || !user || auditMode !== 'technical') return;
    const saveKey = `${result.url}-${auditMode}`;
    if (hasSavedRef.current === saveKey) return;
    hasSavedRef.current = saveKey;

    const domain = (() => { try { return new URL(result.url.startsWith('http') ? result.url : `https://${result.url}`).hostname; } catch { return result.url; } })();
    saveReport({
      reportType: 'seo_technical',
      title: `Audit Technique – ${domain}`,
      url: result.url,
      reportData: { result, auditMode },
    });
  }, [isOpen, user, auditMode, result]);

  const effectiveResult = auditMode === 'strategic' && summarizedResult ? summarizedResult : result;
  // Only generate HTML when modal is open to avoid crashes on null data during background renders
  const htmlContent = isOpen ? generateExpertReportHTML(effectiveResult, auditMode, t, language, branding) : '';

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const { generateSectionBasedPDF } = await import('@/utils/sectionBasedPdfExport');
      const urlForFilename = effectiveResult.url || result.url || effectiveResult.domain || result.domain || '';
      const domain = (() => { try { const u = urlForFilename.includes('.') ? urlForFilename : 'report'; return new URL(u.startsWith('http') ? u : `https://${u}`).hostname.replace(/^www\./, ''); } catch { return urlForFilename.replace(/^www\./, '').replace(/[^a-zA-Z0-9.-]/g, '_') || 'report'; } })();
      const { getReportFilename } = await import('@/utils/reportFilename');
      const auditType = auditMode === 'technical' ? 'audittechnique' as const : 'auditstrategique' as const;
      const filename = getReportFilename(domain, auditType, 'pdf');

      await generateSectionBasedPDF({ htmlContent, filename });
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
      const { data: responseData, error } = await supabase.functions.invoke('share-actions', {
        body: {
          action: 'create',
          type: 'expert-audit',
          url: result.url,
          data: { result: effectiveResult, auditMode },
          language,
          preRenderedHtml: htmlContent,
        },
      });

      if (error) throw error;

      const shareId = responseData?.shareId || responseData?.shareUrl?.split('/').pop();
      if (shareId) {
        const crawlersUrl = `https://crawlers.fr/temporarylink/${shareId}`;
        setShareUrl(crawlersUrl);
        await navigator.clipboard.writeText(crawlersUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success(t.shareSuccess);
      } else {
        throw new Error('No share ID returned');
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
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
    document.body.appendChild(iframe);
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc || !iframe.contentWindow) return;
    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col p-0 [&>button]:hidden" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        {/* Header with actions */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-border bg-card">
          {!isMobile && <h2 className="text-lg font-semibold">{auditMode === 'technical' ? t.technicalAudit : t.strategic}</h2>}
          <div className="flex items-center gap-2 md:gap-3 ml-auto">
            <Button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF || (auditMode === 'strategic' && isSummarizing)}
              size={isMobile ? 'icon' : 'default'}
              className={isMobile ? 'bg-primary hover:bg-primary/90' : 'gap-2 bg-primary hover:bg-primary/90'}
            >
              {isGeneratingPDF ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {!isMobile && (isGeneratingPDF ? t.generating : isSummarizing ? (language === 'fr' ? 'Résumé IA…' : language === 'es' ? 'Resumen IA…' : 'AI Summary…') : t.download)}
            </Button>
            <Button
              onClick={handlePrint}
              variant="outline"
              size={isMobile ? 'icon' : 'default'}
              className={isMobile ? '' : 'gap-2'}
            >
              <Printer className="h-4 w-4" />
              {!isMobile && t.print}
            </Button>
            <Button
              onClick={handleShare}
              disabled={isSharing}
              variant="outline"
              size={isMobile ? 'icon' : 'default'}
              className={isMobile ? '' : 'gap-2'}
            >
              {isSharing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : copied && shareUrl ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {!isMobile && (isSharing ? t.sharing : copied && shareUrl ? t.copied : t.share)}
            </Button>
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="ml-1 md:ml-2"
            >
              <X className="h-5 w-5" />
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
        <div className="flex-1 overflow-auto bg-muted/30 relative">
          {isSummarizing && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-sm">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>{language === 'fr' ? 'Résumé IA en cours…' : language === 'es' ? 'Resumen IA en curso…' : 'AI summary in progress…'}</span>
              </div>
            </div>
          )}
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