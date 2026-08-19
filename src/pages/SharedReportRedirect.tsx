import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from '@/lib/router-compat';
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
        // Compatibilité : anciens liens courts Marina servis sur /r/<code>
        try {
          const proxy = await fetch(`/api/public/marina-report?id=${encodeURIComponent(shareId)}`);
          const text = proxy.ok ? await proxy.text() : '';
          if (/<html/i.test(text) && !text.includes('Rapport introuvable')) {
            setHtmlContent(text);
            return;
          }
        } catch { /* ignore */ }
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
      const [{ generateSectionBasedPDF }, { getReportFilename }] = await Promise.all([
        import('@/utils/sectionBasedPdfExport'),
        import('@/utils/reportFilename'),
      ]);

      // Export section par section : garantit la section finale « Portée et limites »
      await generateSectionBasedPDF({
        htmlContent,
        filename: getReportFilename(shareId?.slice(0, 8) || 'report', 'audittechnique', 'pdf'),
        disclaimer: { auditType: 'generic', language: (language as 'fr' | 'en' | 'es') || 'fr' },
      });
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
