import { useState } from 'react';
import { Download, Loader2, Printer, Link2, Check, Copy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

interface MarinaReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  htmlContent: string;
  domain: string;
}

export function MarinaReportPreviewModal({ isOpen, onClose, htmlContent, domain }: MarinaReportPreviewModalProps) {
  const isMobile = useIsMobile();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const { default: jsPDF } = await import('jspdf');

      // Render HTML in a hidden iframe
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;border:none;';
      document.body.appendChild(iframe);
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error('Cannot access iframe');
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      // Wait for content + images to render
      await new Promise((r) => setTimeout(r, 1500));

      // Section-based capture (same approach as Expert audit reports)
      const container = iframeDoc.querySelector('.container') || iframeDoc.body;
      const sections = Array.from(container.children) as HTMLElement[];

      const pdfWidthMm = 210;
      const pdfHeightMm = 297;
      const marginTopMm = 15;
      const marginBottomMm = 15;
      const marginSideMm = 10;
      const usableHeightMm = pdfHeightMm - marginTopMm - marginBottomMm;
      const usableWidthMm = pdfWidthMm - marginSideMm * 2;
      const scale = 2;

      const doc = new jsPDF('p', 'mm', 'a4');
      let cursorYMm = marginTopMm;
      let isFirstPage = true;

      for (const section of sections) {
        const canvas = await html2canvas(section, {
          scale,
          useCORS: true,
          allowTaint: true,
          width: 794 - 32,
          windowWidth: 794,
          logging: false,
          backgroundColor: '#f8fafc',
        });

        const imgData = canvas.toDataURL('image/png');
        const sectionWidthMm = usableWidthMm;
        const sectionHeightMm = (canvas.height * sectionWidthMm) / canvas.width;

        if (cursorYMm + sectionHeightMm <= pdfHeightMm - marginBottomMm) {
          doc.addImage(imgData, 'PNG', marginSideMm, cursorYMm, sectionWidthMm, sectionHeightMm);
          cursorYMm += sectionHeightMm + 2;
        } else if (sectionHeightMm <= usableHeightMm) {
          if (!isFirstPage || cursorYMm > marginTopMm + 5) {
            doc.addPage();
            cursorYMm = marginTopMm;
          }
          doc.addImage(imgData, 'PNG', marginSideMm, cursorYMm, sectionWidthMm, sectionHeightMm);
          cursorYMm += sectionHeightMm + 2;
        } else {
          // Section taller than one page — slice across pages
          const pixelsPerMm = canvas.height / sectionHeightMm;
          let srcYPx = 0;
          let remaining = sectionHeightMm;

          while (remaining > 0) {
            const spaceOnPage = (pdfHeightMm - marginBottomMm) - cursorYMm;
            const sliceHeightMm = Math.min(remaining, spaceOnPage);
            const sliceHeightPx = Math.round(sliceHeightMm * pixelsPerMm);

            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = sliceHeightPx;
            const ctx = sliceCanvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(canvas, 0, srcYPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
              const sliceImg = sliceCanvas.toDataURL('image/png');
              doc.addImage(sliceImg, 'PNG', marginSideMm, cursorYMm, sectionWidthMm, sliceHeightMm);
            }

            srcYPx += sliceHeightPx;
            remaining -= sliceHeightMm;
            cursorYMm += sliceHeightMm;

            if (remaining > 0) {
              doc.addPage();
              cursorYMm = marginTopMm;
            }
          }
          cursorYMm += 2;
        }
        isFirstPage = false;
      }

      document.body.removeChild(iframe);

      const { getReportFilename } = await import('@/utils/reportFilename');
      doc.save(getReportFilename(domain, 'marina' as any, 'pdf'));
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Erreur de génération PDF');
    } finally {
      setIsGeneratingPDF(false);
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

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const { data: responseData, error } = await supabase.functions.invoke('share-actions', {
        body: {
          action: 'create',
          type: 'marina',
          url: domain,
          data: {},
          language: 'fr',
          preRenderedHtml: htmlContent,
        },
      });
      if (error) throw error;

      // Use the short shareUrl returned by the edge function
      const shortUrl = responseData?.shareUrl;
      if (shortUrl) {
        setShareUrl(shortUrl);
        await navigator.clipboard.writeText(shortUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('Lien de partage copié !');
      } else {
        // Fallback to legacy format
        const shareId = responseData?.shareId;
        if (!shareId) throw new Error('No share ID returned');
        const fallbackUrl = `https://crawlers.lovable.app/temporarylink/${shareId}`;
        setShareUrl(fallbackUrl);
        await navigator.clipboard.writeText(fallbackUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('Lien de partage copié !');
      }
    } catch (error) {
      console.error('Share error:', error);
      toast.error('Erreur de partage');
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col p-0 [&>button]:hidden" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        {/* Header — same style as ExpertReportPreviewModal */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-border bg-card">
          {!isMobile && <h2 className="text-lg font-semibold">Rapport Marina — {domain}</h2>}
          <div className="flex items-center gap-2 md:gap-3 ml-auto">
            <Button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              size={isMobile ? 'icon' : 'default'}
              className={isMobile ? 'bg-primary hover:bg-primary/90' : 'gap-2 bg-primary hover:bg-primary/90'}
            >
              {isGeneratingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {!isMobile && (isGeneratingPDF ? 'Génération…' : 'Télécharger')}
            </Button>
            <Button onClick={handlePrint} variant="outline" size={isMobile ? 'icon' : 'default'} className={isMobile ? '' : 'gap-2'}>
              <Printer className="h-4 w-4" />
              {!isMobile && 'Imprimer'}
            </Button>
            <Button onClick={handleShare} disabled={isSharing} variant="outline" size={isMobile ? 'icon' : 'default'} className={isMobile ? '' : 'gap-2'}>
              {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : copied && shareUrl ? <Check className="h-4 w-4 text-green-500" /> : <Link2 className="h-4 w-4" />}
              {!isMobile && (isSharing ? 'Partage…' : copied && shareUrl ? 'Copié !' : 'Partager')}
            </Button>
            <Button onClick={onClose} variant="ghost" size="icon" className="ml-1 md:ml-2">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Share link display */}
        {shareUrl && (
          <div className="px-6 py-3 bg-muted/50 border-b border-border">
            <p className="text-xs text-muted-foreground mb-2">Lien de partage :</p>
            <div className="flex items-center gap-2">
              <input type="text" value={shareUrl} readOnly className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-md font-mono" />
              <Button onClick={handleCopyLink} variant="outline" size="sm" className="gap-2">
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copié !' : 'Copier'}
              </Button>
            </div>
          </div>
        )}

        {/* HTML Preview */}
        <div className="flex-1 overflow-auto bg-muted/30">
          <iframe srcDoc={htmlContent} className="w-full h-full min-h-[600px]" title="Marina Report Preview" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
