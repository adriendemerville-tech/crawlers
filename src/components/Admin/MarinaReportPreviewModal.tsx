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

      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;height:1123px;border:none;';
      document.body.appendChild(iframe);
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error('Cannot access iframe');
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      await new Promise((r) => setTimeout(r, 1200));

      const body = iframeDoc.body;
      const canvas = await html2canvas(body, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        width: 794,
        windowWidth: 794,
        logging: false,
      });
      document.body.removeChild(iframe);

      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const pdfWidth = 210;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pageHeight = 297;
      const doc = new jsPDF('p', 'mm', 'a4');

      let position = 0;
      let remainingHeight = pdfHeight;

      while (remainingHeight > 0) {
        doc.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
        remainingHeight -= pageHeight;
        if (remainingHeight > 0) {
          doc.addPage();
          position -= pageHeight;
        }
      }

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

      const shareId = responseData?.shareId || responseData?.shareUrl?.split('/').pop();
      if (shareId) {
        const crawlersUrl = `https://crawlers.fr/temporarylink/${shareId}`;
        setShareUrl(crawlersUrl);
        await navigator.clipboard.writeText(crawlersUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('Lien de partage copié !');
      } else {
        throw new Error('No share ID returned');
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
