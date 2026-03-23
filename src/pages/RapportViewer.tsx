import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Download, FileSpreadsheet, Link2, Mail, Printer, Loader2, Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { generateExpertReportHTML, expertReportTranslations, summarizeStrategicResult } from '@/components/ExpertAudit/expertReportExport';
import type { ExpertAuditResult } from '@/types/expertAudit';
// Cocoon HTML is pre-rendered and passed via sessionStorage

/* ------------------------------------------------------------------ */
/*  i18n                                                               */
/* ------------------------------------------------------------------ */

const ui = {
  fr: {
    loading: 'Chargement du rapport…',
    noData: 'Aucun rapport à afficher.',
    csv: 'CSV',
    pdf: 'PDF',
    copyLink: 'Copier le lien',
    email: 'Envoyer par mail',
    print: 'Imprimer',
    copied: 'Copié !',
    linkCreating: 'Création…',
    linkReady: 'Lien copié !',
    linkError: 'Impossible de créer le lien',
    emailSubject: (t: string) => `Rapport Crawlers AI — ${t}`,
    emailBody: (t: string, l: string) =>
      `Bonjour,\n\nJe vous partage ce rapport : ${t}.\n\nLien (valable 7 jours) : ${l}\n\n— Crawlers AI`,
    auditTechnique: 'Audit Technique',
    auditStrategique: 'Audit Stratégique',
    cocoonReport: 'Rapport de Maillage',
    summaryInProgress: 'Résumé IA en cours…',
  },
  en: {
    loading: 'Loading report…',
    noData: 'No report to display.',
    csv: 'CSV',
    pdf: 'PDF',
    copyLink: 'Copy link',
    email: 'Send by email',
    print: 'Print',
    copied: 'Copied!',
    linkCreating: 'Creating…',
    linkReady: 'Link copied!',
    linkError: 'Could not create link',
    emailSubject: (t: string) => `Crawlers AI report — ${t}`,
    emailBody: (t: string, l: string) =>
      `Hi,\n\nSharing this report: ${t}.\n\nLink (valid 7 days): ${l}\n\n— Crawlers AI`,
    auditTechnique: 'Technical Audit',
    auditStrategique: 'Strategic Audit',
    cocoonReport: 'Internal Linking Report',
    summaryInProgress: 'AI summary in progress…',
  },
  es: {
    loading: 'Cargando informe…',
    noData: 'No hay informe que mostrar.',
    csv: 'CSV',
    pdf: 'PDF',
    copyLink: 'Copiar enlace',
    email: 'Enviar por email',
    print: 'Imprimir',
    copied: '¡Copiado!',
    linkCreating: 'Creando…',
    linkReady: '¡Enlace copiado!',
    linkError: 'No se pudo crear el enlace',
    emailSubject: (t: string) => `Informe Crawlers AI — ${t}`,
    emailBody: (t: string, l: string) =>
      `Hola,\n\nComparto este informe: ${t}.\n\nEnlace (válido 7 días): ${l}\n\n— Crawlers AI`,
    auditTechnique: 'Auditoría Técnica',
    auditStrategique: 'Auditoría Estratégica',
    cocoonReport: 'Informe de Enlazado Interno',
    summaryInProgress: 'Resumen IA en curso…',
  },
} as const;

function getPublicBaseUrl(): string {
  const origin = window.location.origin;
  if (origin.includes('lovable.app')) return 'https://crawlers.fr';
  return origin;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ReportKind = 'audit' | 'cocoon';

interface AuditPayload {
  kind: 'audit';
  result: ExpertAuditResult;
  auditMode: 'technical' | 'strategic';
  preSummarizedResult?: ExpertAuditResult | null;
}

interface CocoonPayload {
  kind: 'cocoon';
  html: string;
  domain: string;
  siteName: string;
  nodes: any[];
}

type ReportPayload = AuditPayload | CocoonPayload;

/* ------------------------------------------------------------------ */
/*  Helper: extract CSV from HTML tables                               */
/* ------------------------------------------------------------------ */

function htmlTablesToCsv(htmlString: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const tables = doc.querySelectorAll('table');
  if (tables.length === 0) {
    // fallback: extract text lines
    const body = doc.body.textContent || '';
    return body;
  }
  const lines: string[] = [];
  tables.forEach((table, ti) => {
    if (ti > 0) lines.push('');
    table.querySelectorAll('tr').forEach(row => {
      const cells: string[] = [];
      row.querySelectorAll('th, td').forEach(cell => {
        const text = (cell.textContent || '').replace(/"/g, '""').trim();
        cells.push(`"${text}"`);
      });
      lines.push(cells.join(','));
    });
  });
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function RapportViewer() {
  const { language } = useLanguage();
  const { profile } = useAuth();
  const location = useLocation();
  const t = ui[language as keyof typeof ui] || ui.fr;

  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summarizedResult, setSummarizedResult] = useState<ExpertAuditResult | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Determine kind from path
  const kind: ReportKind = location.pathname.includes('/rapport/cocoon') ? 'cocoon' : 'audit';

  // Read payload from sessionStorage on mount
  useEffect(() => {
    const key = kind === 'cocoon' ? 'rapport_cocoon_data' : 'rapport_audit_data';
    const raw = sessionStorage.getItem(key);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setPayload(parsed);
    } catch {
      console.error('Failed to parse rapport data');
    }
  }, [kind]);

  // For strategic audits, trigger AI summarization
  useEffect(() => {
    if (!payload || payload.kind !== 'audit') return;
    if (payload.auditMode !== 'strategic') return;
    if (payload.preSummarizedResult) {
      setSummarizedResult(payload.preSummarizedResult);
      return;
    }
    let cancelled = false;
    setIsSummarizing(true);
    summarizeStrategicResult(payload.result, language).then(r => {
      if (!cancelled) {
        setSummarizedResult(r);
        setIsSummarizing(false);
      }
    });
    return () => { cancelled = true; };
  }, [payload, language]);

  // White-label branding
  const branding = profile?.plan_type === 'agency_pro' && (profile.agency_logo_url || profile.agency_primary_color)
    ? { logoUrl: profile.agency_logo_url, primaryColor: profile.agency_primary_color }
    : undefined;

  // Build HTML content
  const htmlContent = useMemo(() => {
    if (!payload) return '';
    if (payload.kind === 'cocoon') return payload.html;
    // Audit
    const effectiveResult = payload.auditMode === 'strategic' && summarizedResult
      ? summarizedResult
      : payload.result;
    const et = expertReportTranslations[language as keyof typeof expertReportTranslations] || expertReportTranslations.fr;
    return generateExpertReportHTML(effectiveResult, payload.auditMode, et, language, branding);
  }, [payload, summarizedResult, language, branding]);

  // Title
  const pageTitle = useMemo(() => {
    if (!payload) return 'Rapport';
    if (payload.kind === 'cocoon') return `${t.cocoonReport} — ${payload.domain}`;
    return payload.auditMode === 'technical' ? t.auditTechnique : t.auditStrategique;
  }, [payload, t]);

  /* --- Actions --- */

  const handleCsv = () => {
    if (!htmlContent) return;
    const csv = htmlTablesToCsv(htmlContent);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const { getReportFilename } = await import('@/utils/reportFilename');
    const domain = payload?.kind === 'audit' ? payload.result?.domain || '' : payload?.domain || '';
    const auditType = kind === 'cocoon' ? 'maillage' as const : (payload?.kind === 'audit' && payload.auditMode === 'strategic' ? 'auditstrategique' as const : 'audittechnique' as const);
    a.download = getReportFilename(domain, auditType, 'csv');
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handlePdf = () => {
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

  const handleCopyLink = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(t.copied);
      return;
    }
    // Create a share link
    setIsSharing(true);
    try {
      let body: any;
      if (payload?.kind === 'audit') {
        const effectiveResult = payload.auditMode === 'strategic' && summarizedResult ? summarizedResult : payload.result;
        body = {
          action: 'create',
          type: 'expert-audit',
          url: effectiveResult.url,
          data: { result: effectiveResult, auditMode: payload.auditMode },
          language,
          preRenderedHtml: htmlContent,
        };
      } else if (payload?.kind === 'cocoon') {
        body = {
          action: 'create',
          type: 'cocoon',
          url: `https://${payload.domain}`,
          data: { nodes: payload.nodes, domain: payload.domain },
          language,
          preRenderedHtml: htmlContent,
        };
      }
      const { data: responseData, error } = await supabase.functions.invoke('share-actions', { body });
      if (error) throw error;
      if (!responseData?.success) throw new Error(responseData?.error || 'share failed');
      const shareId = responseData.shareId as string;
      const link = `${getPublicBaseUrl()}/temporarylink/${shareId}`;
      setShareUrl(link);
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(t.linkReady);
    } catch (e) {
      console.error(e);
      toast.error(t.linkError);
    } finally {
      setIsSharing(false);
    }
  };

  const handleEmail = async () => {
    // Ensure link exists first
    if (!shareUrl) await handleCopyLink();
    const link = shareUrl || '';
    if (!link) return;
    const subject = t.emailSubject(pageTitle);
    const body = t.emailBody(pageTitle, link);
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
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

  /* --- Render --- */

  if (!payload) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">{t.noData}</p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content="Rapport d'audit SEO & GEO détaillé généré par Crawlers.fr. Performance, technique, sémantique et visibilité IA." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold truncate">{pageTitle}</h1>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Button onClick={handleCsv} variant="outline" size="sm" className="gap-1.5">
                <FileSpreadsheet className="h-4 w-4" />
                <span className="hidden sm:inline">{t.csv}</span>
              </Button>

              <Button onClick={handlePdf} variant="outline" size="sm" className="gap-1.5">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">{t.pdf}</span>
              </Button>

              <Button
                onClick={handleCopyLink}
                disabled={isSharing}
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                {isSharing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : copied ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">{isSharing ? t.linkCreating : copied ? t.copied : t.copyLink}</span>
              </Button>

              <Button onClick={handleEmail} variant="outline" size="sm" className="gap-1.5">
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">{t.email}</span>
              </Button>

              <Button onClick={handlePrint} variant="outline" size="sm" className="gap-1.5">
                <Printer className="h-4 w-4" />
                <span className="hidden sm:inline">{t.print}</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Report iframe */}
        <main className="flex-1 relative">
          {isSummarizing && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-sm">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>{t.summaryInProgress}</span>
              </div>
            </div>
          )}
          <iframe
            title="Report"
            srcDoc={htmlContent}
            className="w-full h-[calc(100vh-57px-40px)] bg-white"
          />
        </main>

        {/* Branded footer */}
        <footer className="sticky bottom-0 z-50 border-t border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className="mx-auto max-w-6xl px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {branding?.logoUrl ? (
                <img src={branding.logoUrl} alt="Logo" className="h-5 max-w-[120px] object-contain" />
              ) : (
                <span className="text-xs font-semibold text-foreground">Crawlers</span>
              )}
              {branding?.primaryColor ? null : (
                <span className="text-[10px] text-muted-foreground">crawlers.fr</span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">
              © {new Date().getFullYear()} {branding?.logoUrl ? '' : 'Crawlers'}
            </span>
          </div>
        </footer>
      </div>
    </>
  );
}
