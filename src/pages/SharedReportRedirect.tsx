import { useEffect, useState, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, useSearchParams } from 'react-router-dom';
import { Download, Loader2, Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';

const translations = {
  fr: {
    loading: 'Ouverture du rapport…',
    error: 'Lien invalide ou expiré',
    download: 'Télécharger',
    print: 'Imprimer',
    generating: 'Génération…',
    close: 'Fermer',
    report: 'Rapport partagé',
  },
  en: {
    loading: 'Opening report…',
    error: 'Invalid or expired link',
    download: 'Download',
    print: 'Print',
    generating: 'Generating…',
    close: 'Close',
    report: 'Shared report',
  },
  es: {
    loading: 'Abriendo informe…',
    error: 'Enlace inválido o expirado',
    download: 'Descargar',
    print: 'Imprimir',
    generating: 'Generando…',
    close: 'Cerrar',
    report: 'Informe compartido',
  },
};

export default function SharedReportRedirect() {
  const { shareId } = useParams();
  const [searchParams] = useSearchParams();
  const { language } = useLanguage();
  const isMobile = useIsMobile();
  const t = translations[language as keyof typeof translations] || translations.fr;

  const [error, setError] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!shareId) return;

      // Track referral click if ref param present
      const ref = searchParams.get('ref');
      if (ref) {
        try {
          await supabase.functions.invoke('share-actions', {
            body: {
              action: 'track-click',
              report_id: shareId,
              referrer_id: ref,
              visitor_ip: await getVisitorIP(),
            },
          });
        } catch (e) {
          console.warn('Share click tracking failed:', e);
        }
      }

      try {
        const { data, error } = await supabase.functions.invoke('share-actions', {
          body: { action: 'resolve', shareId },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Invalid link');

        const signedUrl = data.signedUrl as string;
        const response = await fetch(signedUrl);
        if (!response.ok) throw new Error('Failed to load report');
        const html = await response.text();
        setHtmlContent(html);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || t.error);
      }
    };
    run();
  }, [shareId, searchParams]);

  const handleDownloadPDF = async () => {
    if (!htmlContent) return;
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

      doc.save(`rapport-partage-${shareId?.slice(0, 8) || 'report'}.pdf`);
      
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error(language === 'fr' ? 'Erreur de génération PDF' : 'PDF generation error');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handlePrint = () => {
    if (!htmlContent) return;
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

  const handleClose = () => {
    window.close();
    // Fallback if window.close() doesn't work (not opened by script)
    window.location.href = '/';
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!htmlContent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{t.loading}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>Rapport partagé | Crawlers.fr</title>
        <meta name="description" content="Consultez un rapport d'audit SEO & GEO partagé via Crawlers.fr." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      {/* Header with actions — same style as ExpertReportPreviewModal */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-border bg-card sticky top-0 z-50">
        {!isMobile && <h2 className="text-lg font-semibold">{t.report}</h2>}
        <div className="flex items-center gap-2 md:gap-3 ml-auto">
          <Button
            onClick={handleDownloadPDF}
            disabled={isGeneratingPDF}
            size={isMobile ? 'icon' : 'default'}
            className={isMobile ? 'bg-primary hover:bg-primary/90' : 'gap-2 bg-primary hover:bg-primary/90'}
          >
            {isGeneratingPDF ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {!isMobile && (isGeneratingPDF ? t.generating : t.download)}
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
            onClick={handleClose}
            variant="ghost"
            size="icon"
            className="ml-1 md:ml-2"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* HTML Preview */}
      <div className="flex-1 overflow-auto bg-muted/30">
        <iframe
          srcDoc={htmlContent}
          className="w-full h-[calc(100vh-65px)]"
          title="Report Preview"
        />
      </div>
    </div>
  );
}

async function getVisitorIP(): Promise<string> {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return data.ip || 'unknown';
  } catch {
    return 'unknown';
  }
}
