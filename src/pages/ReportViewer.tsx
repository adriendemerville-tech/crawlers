import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Download, Loader2, Mail, Printer, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { generatePDF } from '@/components/ReportPreview';
import { generateExpertPDF, generateExpertReportHTML, expertReportTranslations } from '@/components/ExpertAudit/expertReportExport';
import { generateReportHTML } from '@/components/ReportPreview';

type SavedReportType = 'seo_technical' | 'seo_strategic' | 'llm' | 'geo' | 'pagespeed' | 'crawlers';

type SavedReportRow = {
  id: string;
  title: string;
  url: string;
  report_type: SavedReportType;
  report_data: any;
  pdf_url: string | null;
  created_at: string;
};

const uiTranslations = {
  fr: {
    loading: 'Chargement du rapport…',
    notFound: 'Rapport introuvable',
    download: 'Télécharger (PDF)',
    print: 'Imprimer',
    share: 'Partager',
    shareGenerating: 'Création du lien…',
    shareReady: 'Lien de partage prêt',
    shareError: 'Impossible de créer le lien',
    emailSubject: (title: string) => `Rapport Crawlers AI — ${title}`,
    emailBody: (title: string, link: string) =>
      `Bonjour,\n\nJe vous partage ce rapport : ${title}.\n\nLien (valable 7 jours) : ${link}\n\n— Crawlers AI`,
  },
  en: {
    loading: 'Loading report…',
    notFound: 'Report not found',
    download: 'Download (PDF)',
    print: 'Print',
    share: 'Share',
    shareGenerating: 'Creating link…',
    shareReady: 'Share link ready',
    shareError: 'Could not create link',
    emailSubject: (title: string) => `Crawlers AI report — ${title}`,
    emailBody: (title: string, link: string) =>
      `Hi,\n\nSharing this report: ${title}.\n\nLink (valid 7 days): ${link}\n\n— Crawlers AI`,
  },
  es: {
    loading: 'Cargando informe…',
    notFound: 'Informe no encontrado',
    download: 'Descargar (PDF)',
    print: 'Imprimir',
    share: 'Compartir',
    shareGenerating: 'Creando enlace…',
    shareReady: 'Enlace listo',
    shareError: 'No se pudo crear el enlace',
    emailSubject: (title: string) => `Informe Crawlers AI — ${title}`,
    emailBody: (title: string, link: string) =>
      `Hola,\n\nComparto este informe: ${title}.\n\nEnlace (válido 7 días): ${link}\n\n— Crawlers AI`,
  },
} as const;

function getPublicBaseUrl(): string {
  const origin = window.location.origin;
  // Prefer the canonical domain in prod if we are on a lovable domain.
  if (origin.includes('lovable.app')) return 'https://crawlers.fr';
  return origin;
}

export default function ReportViewer() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const { language } = useLanguage();
  const t = uiTranslations[language as keyof typeof uiTranslations] || uiTranslations.en;
  const [report, setReport] = useState<SavedReportRow | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [loading, user, navigate]);

  useEffect(() => {
    const run = async () => {
      if (!user || !reportId) return;
      setIsFetching(true);
      const { data, error } = await supabase
        .from('saved_reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (error) {
        console.error(error);
        setReport(null);
      } else {
        setReport(data as SavedReportRow);
      }
      setIsFetching(false);
    };
    run();
  }, [user, reportId]);

  // White-label branding
  const branding = profile?.plan_type === 'agency_pro' && (profile.agency_logo_url || profile.agency_primary_color)
    ? { logoUrl: profile.agency_logo_url, primaryColor: profile.agency_primary_color }
    : undefined;

  const htmlContent = useMemo(() => {
    if (!report) return '';
    const type = report.report_type;
    if (type === 'seo_technical' || type === 'seo_strategic') {
      const auditMode = type === 'seo_technical' ? 'technical' : 'strategic';
      const et = expertReportTranslations[language as keyof typeof expertReportTranslations] || expertReportTranslations.fr;
      return generateExpertReportHTML(report.report_data, auditMode, et, language, branding);
    }

    // simple reports
    return generateReportHTML(type as any, report.report_data, report.url, language, branding);
  }, [report, language, branding]);

  const handleDownload = async () => {
    if (!report) return;

    if (report.pdf_url) {
      window.open(report.pdf_url, '_blank', 'noopener,noreferrer');
      return;
    }

    try {
      if (report.report_type === 'seo_technical' || report.report_type === 'seo_strategic') {
        const auditMode = report.report_type === 'seo_technical' ? 'technical' : 'strategic';
        const et = expertReportTranslations[language as keyof typeof expertReportTranslations] || expertReportTranslations.fr;
        generateExpertPDF(report.report_data, auditMode, et, branding, language);
      } else {
        await generatePDF(report.report_type as any, report.report_data, report.url, language);
      }
    } catch (e) {
      console.error(e);
      toast.error('Erreur génération PDF');
    }
  };

  const handlePrint = () => {
    if (!htmlContent) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  };

  const handleShare = async () => {
    if (!report) return;
    setIsSharing(true);
    try {
      const payload =
        report.report_type === 'seo_technical' || report.report_type === 'seo_strategic'
          ? {
              type: 'expert-audit',
              url: report.url,
              data: {
                result: report.report_data,
                auditMode: report.report_type === 'seo_technical' ? 'technical' : 'strategic',
              },
              language,
              preRenderedHtml: htmlContent,
            }
          : {
              type: report.report_type,
              url: report.url,
              data: report.report_data,
              language,
            };

      const { data: responseData, error } = await supabase.functions.invoke('share-actions', {
        body: { action: 'create', ...payload },
      });

      if (error) throw error;
      if (!responseData?.success) throw new Error(responseData?.error || 'share failed');

      const shareId = responseData.shareId as string;
      const link = `${getPublicBaseUrl()}/temporarylink/${shareId}`;
      setShareUrl(link);
      toast.success(t.shareReady);

      const subject = t.emailSubject(report.title);
      const body = t.emailBody(report.title, link);
      window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    } catch (e) {
      console.error(e);
      toast.error(t.shareError);
    } finally {
      setIsSharing(false);
    }
  };

  const pageTitle = report ? report.title : 'Rapport';

  if (loading || isFetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{t.loading}</span>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">{t.notFound}</p>
      </div>
    );
  }

  const badgeLabel =
    report.report_type === 'seo_technical'
      ? (language === 'fr' ? 'Audit Technique SEO' : language === 'es' ? 'Auditoría Técnica SEO' : 'Technical SEO Audit')
      : report.report_type === 'seo_strategic'
      ? (language === 'fr' ? 'Audit Stratégique GEO' : language === 'es' ? 'Auditoría Estratégica GEO' : 'Strategic GEO Audit')
      : report.report_type.toUpperCase();

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
      </Helmet>

      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">{badgeLabel}</p>
              </div>
              <h1 className="text-base sm:text-lg font-semibold truncate">{report.title}</h1>
              <p className="text-xs text-muted-foreground truncate">{report.url}</p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Button onClick={handleDownload} className="gap-2">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">{t.download}</span>
              </Button>
              <Button onClick={handlePrint} variant="outline" className="gap-2">
                <Printer className="h-4 w-4" />
                <span className="hidden sm:inline">{t.print}</span>
              </Button>
              <Button onClick={handleShare} disabled={isSharing} variant="outline" className="gap-2">
                {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                <span className="hidden sm:inline">{isSharing ? t.shareGenerating : t.share}</span>
              </Button>
            </div>
          </div>
        </header>

        {shareUrl && (
          <div className="mx-auto max-w-6xl px-4 py-3">
            <div className="rounded-lg border border-border bg-card p-3 text-sm flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Lien :</span>
              <a className="font-mono underline truncate" href={shareUrl} target="_blank" rel="noreferrer">
                {shareUrl}
              </a>
            </div>
          </div>
        )}

        <main className="mx-auto max-w-6xl px-4 py-6">
          <div className="rounded-xl border border-border overflow-hidden bg-background">
            <iframe
              title="Report"
              srcDoc={htmlContent}
              className="w-full h-[calc(100vh-180px)] bg-white"
            />
          </div>
        </main>
      </div>
    </>
  );
}
