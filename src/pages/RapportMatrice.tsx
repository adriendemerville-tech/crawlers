import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Download, FileSpreadsheet, Printer, Loader2, Check, Share2, FileText, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MatricePivotView, MatriceCube3D } from '@/components/Matrice';
import { legacyToMatrixResults } from '@/utils/matrice/legacyToMatrixResult';

interface MatriceReportData {
  kind: 'matrice';
  url: string;
  results: Array<{
    prompt: string;
    axe: string;
    poids: number;
    score: number;
    parsed_score?: number;
    crawlers_score?: number;
    seuil_bon: number;
    seuil_moyen: number;
    seuil_mauvais: number;
  }>;
  totalWeight: number;
  weightedScore: number;
  parsedWeightedScore?: number;
}

function getScoreLabel(score: number, bon: number, moyen: number): string {
  if (score >= bon) return '✅ Bon';
  if (score >= moyen) return '⚠️ Moyen';
  return '❌ Mauvais';
}

function generateMatriceHTML(data: MatriceReportData, branding?: { logoUrl?: string | null; primaryColor?: string | null }): string {
  const primary = branding?.primaryColor || '#6366f1';
  const rows = data.results.map(r => {
    const pScore = r.parsed_score ?? r.score;
    const cScore = r.crawlers_score ?? r.score;
    return `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;font-size:13px;">${r.prompt}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;"><span style="background:#f1f5f9;padding:2px 8px;border-radius:4px;font-size:11px;">${r.axe}</span></td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${r.poids}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;font-weight:bold;color:${pScore >= r.seuil_bon ? '#16a34a' : pScore >= r.seuil_moyen ? '#ca8a04' : '#dc2626'}">${pScore}/100</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;font-weight:bold;color:${cScore >= r.seuil_bon ? '#16a34a' : cScore >= r.seuil_moyen ? '#ca8a04' : '#dc2626'}">${cScore}/100</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${getScoreLabel(cScore, r.seuil_bon, r.seuil_moyen)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:40px;color:#1a1a2e;}table{width:100%;border-collapse:collapse;margin:24px 0;}th{background:${primary};color:white;padding:10px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.5px;}h1{color:${primary};font-size:22px;}h2{font-size:16px;margin-top:32px;color:#555;}</style></head><body>
    ${branding?.logoUrl ? `<img src="${branding.logoUrl}" alt="Logo" style="height:32px;margin-bottom:16px;" />` : ''}
    <h1>Rapport Matrice d'audit</h1>
    <p style="color:#666;font-size:14px;">URL analysée : <strong>${data.url}</strong></p>
    <p style="font-size:18px;margin:16px 0;">Score Parsé : <strong>${data.parsedWeightedScore ?? data.weightedScore}/100</strong> — Score Crawlers : <strong style="color:${primary}">${data.weightedScore}/100</strong></p>
    <table><thead><tr><th>KPI</th><th>Catégorie</th><th>Poids</th><th>Parsé</th><th>Crawlers</th><th>Verdict</th></tr></thead><tbody>${rows}</tbody></table>
    <p style="color:#999;font-size:11px;margin-top:40px;">Généré par ${branding?.logoUrl ? '' : 'Crawlers AI — '}${new Date().toLocaleDateString('fr-FR')}</p>
  </body></html>`;
}

export default function RapportMatrice() {
  const { language } = useLanguage();
  const { profile, user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const [data, setData] = useState<MatriceReportData | null>(null);
  const [nativeResults, setNativeResults] = useState<any[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [view, setView] = useState<'document' | 'interactive'>('document');
  // Admin guard
  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) navigate('/auth');
      else if (!isAdmin) navigate('/');
    }
  }, [authLoading, adminLoading, user, isAdmin, navigate]);

  useEffect(() => {
    const raw = sessionStorage.getItem('rapport_matrice_data');
    if (raw) {
      try { setData(JSON.parse(raw)); } catch { /* noop */ }
    }
    // Sprint 4 — load enriched MatrixResult[] if produced by MatricePrompt
    const native = sessionStorage.getItem('rapport_matrice_results_native');
    if (native) {
      try { setNativeResults(JSON.parse(native)); } catch { /* noop */ }
    }
  }, []);

  const branding = profile?.plan_type === 'agency_pro' && (profile.agency_logo_url || profile.agency_primary_color)
    ? { logoUrl: profile.agency_logo_url, primaryColor: profile.agency_primary_color }
    : undefined;

  const htmlContent = useMemo(() => {
    if (!data) return '';
    return generateMatriceHTML(data, branding);
  }, [data, branding]);

  // Adapter for the interactive Pivot + Cube views.
  // Prefer native MatrixResult[] (Sprint 4) when available; fallback to legacy adapter.
  const matrixResults = useMemo(() => {
    if (nativeResults && nativeResults.length > 0) return nativeResults as any;
    if (!data) return [];
    return legacyToMatrixResults(data.results);
  }, [data, nativeResults]);

  const handleCsv = async () => {
    if (!data) return;
    const header = 'Prompt,Axe,Poids,Score,Seuil Bon,Seuil Moyen,Seuil Mauvais,Verdict\n';
    const lines = data.results.map(r =>
      `"${r.prompt}","${r.axe}",${r.poids},${r.score},${r.seuil_bon},${r.seuil_moyen},${r.seuil_mauvais},"${getScoreLabel(r.score, r.seuil_bon, r.seuil_moyen)}"`
    ).join('\n');
    const blob = new Blob(['\uFEFF' + header + lines], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const { getReportFilename } = await import('@/utils/reportFilename');
    a.download = getReportFilename('matrice', 'matrice', 'csv');
    a.click();
  };

  const handlePrint = () => {
    if (!htmlContent) return;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc || !iframe.contentWindow) return;
    doc.open(); doc.write(htmlContent); doc.close();
    setTimeout(() => { iframe.contentWindow?.print(); setTimeout(() => document.body.removeChild(iframe), 1000); }, 500);
  };

  const handlePdfDownload = async () => {
    if (!htmlContent) return;
    setIsGeneratingPdf(true);
    try {
      const printFrame = document.createElement('iframe');
      printFrame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
      document.body.appendChild(printFrame);
      const doc = printFrame.contentDocument || printFrame.contentWindow?.document;
      if (!doc || !printFrame.contentWindow) throw new Error('Cannot create iframe');
      doc.open();
      doc.write(htmlContent);
      doc.close();
      await new Promise(r => setTimeout(r, 500));
      printFrame.contentWindow.print();
      setTimeout(() => document.body.removeChild(printFrame), 2000);
      toast.success('Utilisez "Enregistrer en PDF" dans la boîte de dialogue d\'impression');
    } catch {
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleShare = useCallback(async () => {
    if (!data || !user) return;
    setIsSharing(true);
    try {
      // Store the report in shared-reports bucket with a random ID
      const shareId = crypto.randomUUID();
      const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
      const filePath = `matrice/${shareId}.html`;

      const { error } = await supabase.storage
        .from('shared-reports')
        .upload(filePath, htmlBlob, { contentType: 'text/html', upsert: false });

      if (error) throw error;

      // Create a signed URL valid for 7 days
      const { data: signedData, error: signedError } = await supabase.storage
        .from('shared-reports')
        .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 days

      if (signedError || !signedData?.signedUrl) throw signedError || new Error('No URL');

      await navigator.clipboard.writeText(signedData.signedUrl);
      setCopied(true);
      toast.success('Lien copié ! Valide 7 jours.');
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('[Share]', err);
      toast.error('Erreur lors du partage');
    } finally {
      setIsSharing(false);
    }
  }, [data, user, htmlContent]);

  if (!data) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Aucun rapport à afficher.</p></div>;
  }

  return (
    <>
      <Helmet>
        <title>Rapport Matrice d'audit — Crawlers.fr</title>
        <meta name="description" content="Résultats détaillés de votre matrice d'audit : balises, données structurées, performance, sécurité, prompts LLM et score pondéré global." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
            <h1 className="text-base sm:text-lg font-semibold truncate">Rapport Matrice d'audit — {data.url}</h1>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* View toggle: Document vs Interactive */}
              <div className="hidden md:inline-flex border border-border rounded-md overflow-hidden mr-1">
                <button
                  type="button"
                  onClick={() => setView('document')}
                  className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${view === 'document' ? 'bg-brand-violet/10 text-brand-violet' : 'text-muted-foreground hover:text-foreground'}`}
                  aria-pressed={view === 'document'}
                >
                  <FileText className="h-3.5 w-3.5" /> Document
                </button>
                <button
                  type="button"
                  onClick={() => setView('interactive')}
                  className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors border-l border-border ${view === 'interactive' ? 'bg-brand-violet/10 text-brand-violet' : 'text-muted-foreground hover:text-foreground'}`}
                  aria-pressed={view === 'interactive'}
                >
                  <LayoutGrid className="h-3.5 w-3.5" /> Pivot + Cube
                </button>
              </div>

              <Button onClick={handlePdfDownload} variant="outline" size="sm" className="gap-1.5" disabled={isGeneratingPdf}>
                {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                <span className="hidden sm:inline">PDF</span>
              </Button>
              <Button onClick={handleShare} variant="outline" size="sm" className="gap-1.5" disabled={isSharing}>
                {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                <span className="hidden sm:inline">{copied ? 'Copié !' : 'Partager'}</span>
              </Button>
              <Button onClick={handleCsv} variant="outline" size="sm" className="gap-1.5">
                <FileSpreadsheet className="h-4 w-4" /><span className="hidden sm:inline">CSV</span>
              </Button>
              <Button onClick={handlePrint} variant="outline" size="sm" className="gap-1.5">
                <Printer className="h-4 w-4" /><span className="hidden sm:inline">Imprimer</span>
              </Button>
            </div>
          </div>
        </header>
        <main className="flex-1 relative">
          {view === 'document' ? (
            <iframe title="Rapport Matrice" srcDoc={htmlContent} className="w-full h-[calc(100vh-57px-40px)] bg-white" />
          ) : (
            <div className="mx-auto max-w-7xl px-4 py-6 grid gap-6 lg:grid-cols-5">
              <section className="lg:col-span-3 border-2 border-brand-violet rounded-md p-4 bg-transparent">
                <MatricePivotView results={matrixResults} />
              </section>
              <section className="lg:col-span-2 border-2 border-brand-violet rounded-md p-4 bg-transparent">
                <MatriceCube3D results={matrixResults} />
              </section>
            </div>
          )}
        </main>
        <footer className="sticky bottom-0 z-50 border-t border-border bg-background/90 backdrop-blur">
          <div className="mx-auto max-w-6xl px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {branding?.logoUrl ? (
                <img src={branding.logoUrl} alt="Logo" className="h-5 max-w-[120px] object-contain" />
              ) : (
                <span className="text-xs font-semibold text-foreground">Crawlers</span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">© {new Date().getFullYear()} {branding?.logoUrl ? '' : 'Crawlers'}</span>
          </div>
        </footer>
      </div>
    </>
  );
}
