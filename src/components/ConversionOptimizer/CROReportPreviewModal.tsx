import { useState, useRef } from 'react';
import { Download, Link2, Loader2, Check, Copy, Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

interface AxisResult {
  score: number;
  verdict: string;
  detail: string;
}

interface Suggestion {
  axis: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  current_text?: string;
  suggested_text?: string;
  rationale: string;
}

interface IndexationStatus {
  is_indexable: boolean;
  is_indexed: boolean;
  gsc_verdict: string | null;
  gsc_coverage_state: string | null;
  gsc_checked_at: string | null;
  has_noindex: boolean;
  canonical_mismatch: string | null;
  warnings: string[];
}

interface Annotation {
  text: string;
  rect: { x: number; y: number; width: number; height: number; tag?: string } | null;
  axis: string;
  priority: string;
  suggestionIndex?: number;
}

interface CROReportData {
  page_url: string;
  page_intent: string;
  global_score: number;
  axes: Record<string, AxisResult>;
  suggestions: Suggestion[];
  screenshot_url?: string | null;
  screenshot_height?: number | null;
  annotations?: Annotation[];
  indexation_status?: IndexationStatus;
  image_format_report?: { total: number; unoptimized: number; optimized: number };
}

interface CROReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: CROReportData;
  domain: string;
}

const AXIS_LABELS: Record<string, string> = {
  tone: 'Ton',
  cta_pressure: 'Pression CTA',
  alignment: 'Alignement',
  readability: 'Lisibilité',
  conversion: 'Conversion',
  mobile_ux: 'Mobile UX',
  keyword_usage: 'Mots-clés',
};

const AXIS_COLORS: Record<string, string> = {
  tone: '#3b82f6',
  cta_pressure: '#f97316',
  alignment: '#a855f7',
  readability: '#10b981',
  conversion: '#ef4444',
  mobile_ux: '#06b6d4',
  keyword_usage: '#f59e0b',
};

const PRIORITY_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critique', color: '#dc2626', bg: '#fef2f2' },
  high: { label: 'Haute', color: '#ea580c', bg: '#fff7ed' },
  medium: { label: 'Moyenne', color: '#6b7280', bg: '#f3f4f6' },
  low: { label: 'Basse', color: '#9ca3af', bg: '#f9fafb' },
};

function scoreColorHex(score: number) {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

function generateCROReportHTML(data: CROReportData, domain: string): string {
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  
  const sortedSuggestions = [...data.suggestions].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
  });

  const indexationHTML = data.indexation_status ? (() => {
    const s = data.indexation_status;
    if (s.warnings.length === 0 && s.is_indexable && s.is_indexed) {
      return `<div style="display:flex;align-items:center;gap:8px;padding:12px 16px;background:#ecfdf5;border-radius:8px;margin-bottom:24px;border:1px solid #a7f3d0;">
        <span style="color:#059669;font-size:14px;">✓ Page indexable et indexée par Google</span>
      </div>`;
    }
    const isBlocking = !s.is_indexable || !s.is_indexed;
    return `<div style="padding:14px 18px;background:${isBlocking ? '#fef2f2' : '#fffbeb'};border-radius:8px;margin-bottom:24px;border-left:4px solid ${isBlocking ? '#ef4444' : '#f59e0b'};">
      <p style="font-weight:600;font-size:14px;margin:0 0 6px;color:${isBlocking ? '#dc2626' : '#b45309'};">
        ${!s.is_indexable ? '⚠ Page non indexable' : !s.is_indexed ? '⚠ Page non indexée' : '⚠ Avertissements d\'indexation'}
      </p>
      ${s.warnings.map(w => `<p style="font-size:12px;color:#6b7280;margin:3px 0;">${w}</p>`).join('')}
    </div>`;
  })() : '';

  const axesHTML = Object.entries(data.axes).map(([key, axis]) => {
    const label = AXIS_LABELS[key] || key;
    const color = AXIS_COLORS[key] || '#6b7280';
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;">
      <div>
        <span style="display:inline-block;width:10px;height:10px;background:${color};border-radius:50%;margin-right:8px;"></span>
        <strong style="font-size:14px;">${label}</strong>
        <p style="font-size:12px;color:#6b7280;margin:4px 0 0 18px;">${axis.verdict}</p>
      </div>
      <span style="font-size:24px;font-weight:700;color:${scoreColorHex(axis.score)};">${axis.score}</span>
    </div>`;
  }).join('');

  const suggestionsHTML = sortedSuggestions.map((s, i) => {
    const p = PRIORITY_LABELS[s.priority] || PRIORITY_LABELS.medium;
    const axisLabel = AXIS_LABELS[s.axis] || s.axis;
    return `<div style="padding:16px 20px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:12px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;background:${p.bg};color:${p.color};">${p.label}</span>
        <span style="font-size:11px;padding:2px 8px;border-radius:4px;background:#f3f4f6;color:#6b7280;">${axisLabel}</span>
      </div>
      <p style="font-weight:600;font-size:14px;margin:0 0 6px;">${i + 1}. ${s.title}</p>
      <p style="font-size:13px;color:#374151;margin:0 0 8px;">${s.rationale}</p>
      ${s.current_text ? `<div style="padding:8px 12px;background:#fef2f2;border-radius:6px;margin-bottom:6px;">
        <p style="font-size:11px;color:#dc2626;font-weight:600;margin:0 0 2px;">Actuel</p>
        <p style="font-size:12px;color:#7f1d1d;margin:0;">${s.current_text}</p>
      </div>` : ''}
      ${s.suggested_text ? `<div style="padding:8px 12px;background:#ecfdf5;border-radius:6px;">
        <p style="font-size:11px;color:#059669;font-weight:600;margin:0 0 2px;">Suggestion</p>
        <p style="font-size:12px;color:#065f46;margin:0;">${s.suggested_text}</p>
      </div>` : ''}
    </div>`;
  }).join('');

  // Screenshot with annotations sidebar
  const screenshotSection = data.screenshot_url ? (() => {
    const annotations = data.annotations || [];
    const annotationsHTML = annotations.length > 0 ? annotations.map((a, i) => {
      const axisColor = AXIS_COLORS[a.axis] || '#6b7280';
      const pInfo = PRIORITY_LABELS[a.priority] || PRIORITY_LABELS.medium;
      return `<div style="display:flex;gap:8px;align-items:flex-start;padding:10px 12px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;border-left:3px solid ${axisColor};">
        <span style="background:${axisColor};color:#fff;font-size:10px;font-weight:700;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i + 1}</span>
        <div style="min-width:0;">
          <div style="display:flex;gap:4px;align-items:center;margin-bottom:3px;">
            <span style="font-size:10px;font-weight:600;color:${pInfo.color};padding:1px 5px;background:${pInfo.bg};border-radius:3px;">${pInfo.label}</span>
            <span style="font-size:10px;color:#9ca3af;">${AXIS_LABELS[a.axis] || a.axis}</span>
          </div>
          <p style="font-size:11px;color:#374151;margin:0;line-height:1.4;">${a.text}</p>
        </div>
      </div>`;
    }).join('') : '';

    return `<div style="margin-bottom:32px;">
      <h2 style="font-size:20px;font-weight:700;margin:0 0 16px;color:#111827;">Analyse visuelle</h2>
      <div style="display:flex;gap:20px;align-items:flex-start;">
        <div style="flex-shrink:0;width:55%;max-width:600px;">
          <img src="${data.screenshot_url}" style="width:100%;border-radius:10px;border:1px solid #e5e7eb;box-shadow:0 4px 12px rgba(0,0,0,0.08);" />
        </div>
        ${annotations.length > 0 ? `<div style="flex:1;display:flex;flex-direction:column;gap:8px;max-height:800px;overflow-y:auto;">
          ${annotationsHTML}
        </div>` : ''}
      </div>
    </div>`;
  })() : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport CRO — ${domain}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #111827; line-height: 1.5; }
    .container { max-width: 900px; margin: 0 auto; padding: 32px 24px; }
    @media print {
      body { background: #fff; }
      .container { max-width: 100%; padding: 16px; }
    }
  </style>
</head>
<body>
<div class="container">
  <!-- Header -->
  <div style="text-align:center;margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #e5e7eb;">
    <p style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#6b7280;margin-bottom:8px;">Rapport d'optimisation CRO</p>
    <h1 style="font-size:26px;font-weight:800;margin:0 0 8px;color:#111827;">${domain}</h1>
    <p style="font-size:14px;color:#6b7280;margin-bottom:4px;">${data.page_url}</p>
    <p style="font-size:12px;color:#9ca3af;">Généré le ${date} — Intent : ${data.page_intent}</p>
  </div>

  <!-- Indexation Status -->
  ${indexationHTML}

  <!-- Global Score -->
  <div style="text-align:center;padding:28px;background:linear-gradient(135deg,#f0fdf4,#ecfdf5);border:2px solid ${scoreColorHex(data.global_score)}33;border-radius:16px;margin-bottom:32px;">
    <p style="font-size:13px;color:#6b7280;margin-bottom:4px;">Score global CRO</p>
    <p style="font-size:56px;font-weight:800;color:${scoreColorHex(data.global_score)};margin:0;line-height:1;">${data.global_score}<span style="font-size:24px;color:#9ca3af;">/100</span></p>
  </div>

  <!-- Axes -->
  <div style="margin-bottom:32px;">
    <h2 style="font-size:20px;font-weight:700;margin:0 0 16px;color:#111827;">Scores par axe</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      ${axesHTML}
    </div>
  </div>

  <!-- Screenshot + Annotations -->
  ${screenshotSection}

  <!-- Suggestions -->
  <div style="margin-bottom:32px;">
    <h2 style="font-size:20px;font-weight:700;margin:0 0 16px;color:#111827;">Recommandations (${sortedSuggestions.length})</h2>
    ${suggestionsHTML}
  </div>

  <!-- Footer -->
  <div style="text-align:center;padding-top:24px;border-top:1px solid #e5e7eb;">
    <p style="font-size:11px;color:#9ca3af;">Rapport généré par Crawlers.fr — Conversion Optimizer</p>
  </div>
</div>
</body>
</html>`;
}

export function CROReportPreviewModal({ isOpen, onClose, data, domain }: CROReportPreviewModalProps) {
  const isMobile = useIsMobile();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const htmlContent = isOpen ? generateCROReportHTML(data, domain) : '';

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const { generateSectionBasedPDF } = await import('@/utils/sectionBasedPdfExport');
      const { getReportFilename } = await import('@/utils/reportFilename');
      await generateSectionBasedPDF({
        htmlContent,
        filename: getReportFilename(domain, 'cro' as any, 'pdf'),
        iframeWidth: 900,
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Erreur lors de la génération du PDF');
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
          type: 'cro-report',
          url: data.page_url,
          data: { result: data, domain },
          language: 'fr',
          preRenderedHtml: htmlContent,
        },
      });
      if (error) throw error;
      const shareId = responseData?.shareId || responseData?.shareUrl?.split('/').pop();
      if (shareId) {
        const url = `https://crawlers.fr/temporarylink/${shareId}`;
        setShareUrl(url);
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('Lien de partage copié !');
      }
    } catch (error) {
      console.error('Share error:', error);
      toast.error('Erreur lors du partage');
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
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-border bg-card">
          {!isMobile && <h2 className="text-lg font-semibold">Rapport CRO</h2>}
          <div className="flex items-center gap-2 md:gap-3 ml-auto">
            <Button onClick={handleDownloadPDF} disabled={isGeneratingPDF} size={isMobile ? 'icon' : 'default'} className={isMobile ? 'bg-primary hover:bg-primary/90' : 'gap-2 bg-primary hover:bg-primary/90'}>
              {isGeneratingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {!isMobile && (isGeneratingPDF ? 'Génération…' : 'Télécharger')}
            </Button>
            <Button onClick={handlePrint} variant="outline" size={isMobile ? 'icon' : 'default'} className={isMobile ? '' : 'gap-2'}>
              <Printer className="h-4 w-4" />
              {!isMobile && 'Imprimer'}
            </Button>
            <Button onClick={handleShare} disabled={isSharing} variant="outline" size={isMobile ? 'icon' : 'default'} className={isMobile ? '' : 'gap-2'}>
              {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : copied && shareUrl ? <Check className="h-4 w-4 text-emerald-500" /> : <Link2 className="h-4 w-4" />}
              {!isMobile && (isSharing ? 'Partage…' : copied && shareUrl ? 'Copié !' : 'Partager')}
            </Button>
            <Button onClick={onClose} variant="ghost" size="icon" className="ml-1 md:ml-2">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {shareUrl && (
          <div className="px-6 py-3 bg-muted/50 border-b border-border">
            <p className="text-xs text-muted-foreground mb-2">Lien de partage temporaire (7 jours) :</p>
            <div className="flex items-center gap-2">
              <input type="text" value={shareUrl} readOnly className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-md font-mono" />
              <Button onClick={handleCopyLink} variant="outline" size="sm" className="gap-2">
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copié !' : 'Copier'}
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto bg-muted/30">
          <iframe srcDoc={htmlContent} className="w-full h-full min-h-[600px]" title="CRO Report Preview" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
