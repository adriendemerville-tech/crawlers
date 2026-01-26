import { useState } from 'react';
import { Download, Printer, Mail, X, Loader2, Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CrawlResult } from '@/types/crawler';
import { GeoResult } from '@/types/geo';
import { LLMAnalysisResult } from '@/types/llm';
import { PageSpeedResult } from '@/types/pagespeed';
import { generateReportHTML } from './reportHtmlGenerator';
import { generatePDF } from './pdfGenerator';

type ReportType = 'crawlers' | 'geo' | 'llm' | 'pagespeed';

interface ReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: ReportType;
  crawlResult?: CrawlResult | null;
  geoResult?: GeoResult | null;
  llmResult?: LLMAnalysisResult | null;
  pageSpeedResult?: PageSpeedResult | null;
}

export function ReportPreviewModal({
  isOpen,
  onClose,
  type,
  crawlResult,
  geoResult,
  llmResult,
  pageSpeedResult,
}: ReportPreviewModalProps) {
  const { language } = useLanguage();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const getTranslations = () => {
    switch (language) {
      case 'fr':
        return {
          title: 'Aperçu du Rapport',
          download: 'Télécharger PDF',
          print: 'Imprimer',
          email: 'Envoyer par e-mail',
          generating: 'Génération...',
          sending: 'Envoi...',
          shareLink: 'Lien de partage (valide 7 jours)',
          copyLink: 'Copier le lien',
          copied: 'Copié !',
          emailSent: 'Lien de partage généré avec succès !',
          emailError: 'Erreur lors de la génération du lien',
          pdfSuccess: 'PDF téléchargé avec succès !',
          pdfError: 'Erreur lors de la génération du PDF',
        };
      case 'es':
        return {
          title: 'Vista previa del informe',
          download: 'Descargar PDF',
          print: 'Imprimir',
          email: 'Enviar por correo',
          generating: 'Generando...',
          sending: 'Enviando...',
          shareLink: 'Enlace para compartir (válido 7 días)',
          copyLink: 'Copiar enlace',
          copied: '¡Copiado!',
          emailSent: '¡Enlace de compartir generado con éxito!',
          emailError: 'Error al generar el enlace',
          pdfSuccess: '¡PDF descargado con éxito!',
          pdfError: 'Error al generar el PDF',
        };
      default:
        return {
          title: 'Report Preview',
          download: 'Download PDF',
          print: 'Print',
          email: 'Send by email',
          generating: 'Generating...',
          sending: 'Sending...',
          shareLink: 'Share link (valid 7 days)',
          copyLink: 'Copy link',
          copied: 'Copied!',
          emailSent: 'Share link generated successfully!',
          emailError: 'Error generating share link',
          pdfSuccess: 'PDF downloaded successfully!',
          pdfError: 'Error generating PDF',
        };
    }
  };

  const t = getTranslations();

  const getData = (): CrawlResult | GeoResult | LLMAnalysisResult | PageSpeedResult | null => {
    switch (type) {
      case 'crawlers':
        return crawlResult || null;
      case 'geo':
        return geoResult || null;
      case 'llm':
        return llmResult || null;
      case 'pagespeed':
        return pageSpeedResult || null;
      default:
        return null;
    }
  };

  const getUrl = (): string => {
    switch (type) {
      case 'crawlers':
        return crawlResult?.url || '';
      case 'geo':
        return geoResult?.url || '';
      case 'llm':
        return llmResult?.domain || '';
      case 'pagespeed':
        return pageSpeedResult?.url || '';
      default:
        return '';
    }
  };

  const data = getData();
  const url = getUrl();

  if (!data) return null;

  const htmlContent = generateReportHTML(type, data, url, language);

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      await generatePDF(type, data, url, language);
      toast.success(t.pdfSuccess);
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error(t.pdfError);
    } finally {
      setIsGeneratingPDF(false);
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

  const handleSendEmail = async () => {
    setIsSendingEmail(true);
    try {
      const { data: responseData, error } = await supabase.functions.invoke('share-report', {
        body: {
          type,
          url,
          data,
          language,
        },
      });

      if (error) throw error;

      if (responseData?.shareUrl) {
        setShareUrl(responseData.shareUrl);
        toast.success(t.emailSent);
      }
    } catch (error) {
      console.error('Share error:', error);
      toast.error(t.emailError);
    } finally {
      setIsSendingEmail(false);
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <span>{t.title}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 py-4 border-b border-border flex-shrink-0">
          <Button
            onClick={handleDownloadPDF}
            disabled={isGeneratingPDF}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
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
            onClick={handleSendEmail}
            disabled={isSendingEmail}
            variant="outline"
            className="gap-2"
          >
            {isSendingEmail ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            {isSendingEmail ? t.sending : t.email}
          </Button>
        </div>

        {/* Share link display */}
        {shareUrl && (
          <div className="p-4 bg-muted rounded-lg flex-shrink-0">
            <p className="text-sm text-muted-foreground mb-2">{t.shareLink}</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-md"
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
        <div className="flex-1 overflow-auto mt-4 border border-border rounded-lg bg-white">
          <iframe
            srcDoc={htmlContent}
            className="w-full h-full min-h-[500px]"
            title="Report Preview"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
