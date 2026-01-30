import { useState, useEffect } from 'react';
import { Download, Share2, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { CrawlResult } from '@/types/crawler';
import { GeoResult } from '@/types/geo';
import { LLMAnalysisResult } from '@/types/llm';
import { PageSpeedResult } from '@/types/pagespeed';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Copy, Mail, Check, Loader2, Linkedin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DownloadAuthGate } from '@/components/DownloadAuthGate';

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
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [pendingAction, setPendingAction] = useState<'menu' | 'download' | 'share' | null>(null);

  const hasAnyResult = !!(crawlResult || geoResult || llmResult || pageSpeedResult);

  // Check for pending download after auth
  useEffect(() => {
    if (user && hasAnyResult) {
      const pending = sessionStorage.getItem('download_pending');
      if (pending === 'true') {
        sessionStorage.removeItem('download_pending');
        sessionStorage.removeItem('download_return_path');
        // Open menu after successful auth
        setIsMenuOpen(true);
      }
    }
  }, [user, hasAnyResult]);

  if (!hasAnyResult) return null;

  const handleReportButtonClick = () => {
    if (!user) {
      setPendingAction('menu');
      setShowAuthGate(true);
    } else {
      setIsMenuOpen(true);
    }
  };

  const handleAuthSuccess = () => {
    setShowAuthGate(false);
    if (pendingAction === 'menu') {
      setIsMenuOpen(true);
    }
    setPendingAction(null);
  };

  const getButtonLabel = () => {
    switch (language) {
      case 'fr': return 'Rapport';
      case 'es': return 'Informe';
      default: return 'Report';
    }
  };

  const generateFullPDF = () => {
    const doc = new jsPDF();
    let yPos = 20;
    const title = language === 'fr' ? 'Rapport Complet d\'Analyse' : language === 'es' ? 'Informe Completo de Análisis' : 'Complete Analysis Report';

    // Header
    doc.setFontSize(20);
    doc.setTextColor(124, 58, 237);
    doc.text(title, 20, yPos);
    yPos += 15;

    if (currentUrl) {
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text(`URL: ${currentUrl}`, 20, yPos);
      yPos += 7;
      doc.text(`${language === 'fr' ? 'Généré le' : language === 'es' ? 'Generado el' : 'Generated at'}: ${new Date().toLocaleString()}`, 20, yPos);
      yPos += 15;
    }

    // Crawlers section
    if (crawlResult) {
      doc.setFontSize(16);
      doc.setTextColor(0);
      doc.text(language === 'fr' ? '1. Bots IA' : language === 'es' ? '1. Bots IA' : '1. AI Bots', 20, yPos);
      yPos += 10;

      const allowedCount = crawlResult.bots.filter(b => b.status === 'allowed').length;
      const blockedCount = crawlResult.bots.filter(b => b.status === 'blocked').length;

      doc.setFontSize(11);
      doc.setTextColor(34, 197, 94);
      doc.text(`${t.results.allowed}: ${allowedCount}`, 20, yPos);
      doc.setTextColor(239, 68, 68);
      doc.text(`${t.results.blocked}: ${blockedCount}`, 80, yPos);
      yPos += 10;

      const tableData = crawlResult.bots.map(bot => [
        bot.name,
        bot.company,
        bot.status === 'allowed' ? t.results.allowed : bot.status === 'blocked' ? t.results.blocked : t.results.unknown,
        bot.reason || '-'
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Bot', language === 'fr' ? 'Entreprise' : language === 'es' ? 'Empresa' : 'Company', 'Status', language === 'fr' ? 'Raison' : language === 'es' ? 'Razón' : 'Reason']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [124, 58, 237] },
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    // GEO section
    if (geoResult) {
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(16);
      doc.setTextColor(0);
      doc.text(language === 'fr' ? '2. Score GEO' : language === 'es' ? '2. Puntuación GEO' : '2. GEO Score', 20, yPos);
      yPos += 10;

      doc.setFontSize(12);
      doc.text(`Score: ${geoResult.totalScore}/100`, 20, yPos);
      yPos += 10;

      const tableData = geoResult.factors.map(factor => [
        factor.name,
        `${factor.score}/${factor.maxScore}`,
        factor.status === 'good' ? '✓' : factor.status === 'warning' ? '⚠' : '✗',
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [[language === 'fr' ? 'Facteur' : language === 'es' ? 'Factor' : 'Factor', 'Score', 'Status']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [124, 58, 237] },
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    // LLM section
    if (llmResult) {
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(16);
      doc.setTextColor(0);
      doc.text(language === 'fr' ? '3. Visibilité LLM' : language === 'es' ? '3. Visibilidad LLM' : '3. LLM Visibility', 20, yPos);
      yPos += 10;

      doc.setFontSize(12);
      doc.text(`${t.llm.overallVisibility}: ${llmResult.overallScore}/100`, 20, yPos);
      yPos += 7;
      doc.text(`${t.llm.citationRate}: ${llmResult.citationRate.cited}/${llmResult.citationRate.total}`, 20, yPos);
      yPos += 10;

      const tableData = llmResult.citations.map(citation => [
        citation.provider.name,
        citation.cited ? (language === 'fr' ? 'Oui' : language === 'es' ? 'Sí' : 'Yes') : 'No',
        citation.cited ? (citation.sentiment === 'positive' ? t.llm.positive : citation.sentiment === 'negative' ? t.llm.negative : t.llm.neutral) : '-'
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['LLM', language === 'fr' ? 'Cité' : language === 'es' ? 'Citado' : 'Cited', t.llm.sentiment]],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [124, 58, 237] },
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    // PageSpeed section
    if (pageSpeedResult) {
      if (yPos > 200) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(16);
      doc.setTextColor(0);
      doc.text(language === 'fr' ? '4. PageSpeed' : language === 'es' ? '4. PageSpeed' : '4. PageSpeed', 20, yPos);
      yPos += 10;

      const scoresData = [
        [t.pagespeed.performance, `${pageSpeedResult.scores.performance}/100`],
        [t.pagespeed.accessibility, `${pageSpeedResult.scores.accessibility}/100`],
        [t.pagespeed.bestPractices, `${pageSpeedResult.scores.bestPractices}/100`],
        [t.pagespeed.seo, `${pageSpeedResult.scores.seo}/100`],
      ];

      autoTable(doc, {
        startY: yPos,
        head: [[language === 'fr' ? 'Métrique' : language === 'es' ? 'Métrica' : 'Metric', 'Score']],
        body: scoresData,
        theme: 'striped',
        headStyles: { fillColor: [124, 58, 237] },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;

      doc.setFontSize(12);
      doc.text(t.pagespeed.coreWebVitals, 20, yPos);
      yPos += 8;

      const vitalsData = [
        [t.pagespeed.fcp, pageSpeedResult.scores.fcp],
        [t.pagespeed.lcp, pageSpeedResult.scores.lcp],
        [t.pagespeed.cls, pageSpeedResult.scores.cls],
        [t.pagespeed.tbt, pageSpeedResult.scores.tbt],
      ];

      autoTable(doc, {
        startY: yPos,
        head: [[language === 'fr' ? 'Métrique' : language === 'es' ? 'Métrica' : 'Metric', language === 'fr' ? 'Valeur' : language === 'es' ? 'Valor' : 'Value']],
        body: vitalsData,
        theme: 'striped',
        headStyles: { fillColor: [124, 58, 237] },
      });
    }

    // Footer on all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text('Crawlers AI - crawlers.fr', 20, doc.internal.pageSize.height - 10);
      doc.text(`${i} / ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
    }

    const filename = currentUrl
      ? `rapport-complet-${new URL(currentUrl).hostname}.pdf`
      : `rapport-complet-${new Date().toISOString().split('T')[0]}.pdf`;

    doc.save(filename);
    setIsMenuOpen(false);
  };

  const handleGenerateShareLink = async () => {
    setIsLoading(true);
    try {
      const reportData = {
        crawlers: crawlResult,
        geo: geoResult,
        llm: llmResult,
        pagespeed: pageSpeedResult,
      };

      const { data, error } = await supabase.functions.invoke('share-report', {
        body: {
          type: 'full',
          url: currentUrl,
          data: reportData,
          language,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setShareUrl(data.shareUrl);
      toast({
        title: language === 'fr' ? 'Lien généré !' : language === 'es' ? '¡Enlace generado!' : 'Link generated!',
        description: language === 'fr' ? 'Valide pendant 7 jours' : language === 'es' ? 'Válido por 7 días' : 'Valid for 7 days',
      });
    } catch (error) {
      console.error('Error generating share link:', error);
      toast({
        title: language === 'fr' ? 'Erreur' : language === 'es' ? 'Error' : 'Error',
        description: language === 'fr' ? 'Impossible de générer le lien' : language === 'es' ? 'No se pudo generar el enlace' : 'Could not generate link',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: language === 'fr' ? 'Copié !' : language === 'es' ? '¡Copiado!' : 'Copied!',
    });
  };

  const handleSendEmail = () => {
    const subject = language === 'fr'
      ? `📊 Rapport d'analyse complet pour ${currentUrl ? new URL(currentUrl).hostname : 'votre site'}`
      : language === 'es'
      ? `📊 Informe de análisis completo para ${currentUrl ? new URL(currentUrl).hostname : 'su sitio'}`
      : `📊 Complete analysis report for ${currentUrl ? new URL(currentUrl).hostname : 'your site'}`;

    const body = language === 'fr'
      ? `Consultez le rapport complet ici : ${shareUrl}\n\nL'outil est gratuit : https://crawlers.fr`
      : language === 'es'
      ? `Consulta el informe completo aquí: ${shareUrl}\n\nLa herramienta es gratuita: https://crawlers.fr`
      : `View the complete report here: ${shareUrl}\n\nThe tool is free: https://crawlers.fr`;

    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const handleShareLinkedIn = () => {
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
    window.open(linkedInUrl, '_blank', 'width=600,height=600');
  };

  const openShareDialog = () => {
    setIsMenuOpen(false);
    setIsShareOpen(true);
    setShareUrl('');
  };

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        {isMenuOpen ? (
          <div className="flex items-center gap-3 bg-background/95 backdrop-blur-sm border border-border rounded-full px-4 py-3 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
            <Button
              onClick={generateFullPDF}
              className="gap-2 bg-primary hover:bg-primary/90"
            >
              <Download className="h-4 w-4" />
              {language === 'fr' ? 'Télécharger PDF' : language === 'es' ? 'Descargar PDF' : 'Download PDF'}
            </Button>
            <Button
              onClick={openShareDialog}
              variant="outline"
              className="gap-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <Share2 className="h-4 w-4" />
              {language === 'fr' ? 'Partager' : language === 'es' ? 'Compartir' : 'Share'}
            </Button>
            <Button
              onClick={() => setIsMenuOpen(false)}
              variant="ghost"
              size="icon"
              className="rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleReportButtonClick}
            size="lg"
            className="gap-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg px-8 py-6 rounded-full shadow-2xl transition-all hover:scale-105"
          >
            <FileText className="h-6 w-6" />
            {getButtonLabel()}
          </Button>
        )}
      </div>

      {/* Share Dialog */}
      <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {language === 'fr' ? 'Partager le rapport' : language === 'es' ? 'Compartir informe' : 'Share Report'}
            </DialogTitle>
            <DialogDescription>
              {language === 'fr'
                ? 'Générez un lien temporaire (7 jours) vers une version web du rapport.'
                : language === 'es'
                ? 'Genera un enlace temporal (7 días) a una versión web del informe.'
                : 'Generate a temporary link (7 days) to a web version of the report.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {!shareUrl ? (
              <Button
                onClick={handleGenerateShareLink}
                disabled={isLoading}
                className="w-full gap-2"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
                {language === 'fr' ? 'Générer un lien temporaire' : language === 'es' ? 'Generar enlace temporal' : 'Generate temporary link'}
              </Button>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {language === 'fr' ? 'Lien de partage' : language === 'es' ? 'Enlace de compartir' : 'Share link'}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={`crawlers.fr/r/${shareUrl.split('/').pop()?.split('?')[0] || ''}`}
                      readOnly
                      className="flex-1 text-sm font-mono"
                    />
                    <Button variant="outline" size="icon" onClick={handleCopyLink}>
                      {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {language === 'fr' ? 'Lien raccourci valide 7 jours' : language === 'es' ? 'Enlace corto válido 7 días' : 'Short link valid for 7 days'}
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button onClick={handleSendEmail} className="flex-1 gap-2">
                    <Mail className="h-4 w-4" />
                    {language === 'fr' ? 'Email' : 'Email'}
                  </Button>
                  <Button
                    onClick={handleShareLinkedIn}
                    className="flex-1 gap-2 bg-linkedin hover:bg-linkedin/80 text-white"
                  >
                    <Linkedin className="h-4 w-4" />
                    LinkedIn
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Auth Gate Modal */}
      <DownloadAuthGate 
        isOpen={showAuthGate} 
        onClose={() => setShowAuthGate(false)} 
        onAuthenticated={handleAuthSuccess}
      />
    </>
  );
}
