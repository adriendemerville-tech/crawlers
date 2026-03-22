import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Download, FileSpreadsheet, Link2, Mail, Printer, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface MatriceReportData {
  kind: 'matrice';
  url: string;
  results: Array<{
    prompt: string;
    axe: string;
    poids: number;
    score: number;
    seuil_bon: number;
    seuil_moyen: number;
    seuil_mauvais: number;
  }>;
  totalWeight: number;
  weightedScore: number;
}

function getScoreLabel(score: number, bon: number, moyen: number): string {
  if (score >= bon) return '✅ Bon';
  if (score >= moyen) return '⚠️ Moyen';
  return '❌ Mauvais';
}

function generateMatriceHTML(data: MatriceReportData, branding?: { logoUrl?: string | null; primaryColor?: string | null }): string {
  const primary = branding?.primaryColor || '#6366f1';
  const rows = data.results.map(r => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;font-size:13px;">${r.prompt}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${r.axe}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${r.poids}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;font-weight:bold;color:${r.score >= r.seuil_bon ? '#16a34a' : r.score >= r.seuil_moyen ? '#ca8a04' : '#dc2626'}">${r.score}/100</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${getScoreLabel(r.score, r.seuil_bon, r.seuil_moyen)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:40px;color:#1a1a2e;}table{width:100%;border-collapse:collapse;margin:24px 0;}th{background:${primary};color:white;padding:10px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.5px;}h1{color:${primary};font-size:22px;}h2{font-size:16px;margin-top:32px;color:#555;}</style></head><body>
    ${branding?.logoUrl ? `<img src="${branding.logoUrl}" alt="Logo" style="height:32px;margin-bottom:16px;" />` : ''}
    <h1>Rapport Matrice d'audit</h1>
    <p style="color:#666;font-size:14px;">URL analysée : <strong>${data.url}</strong></p>
    <p style="font-size:18px;margin:16px 0;">Score pondéré global : <strong style="color:${primary}">${data.weightedScore}/100</strong></p>
    <table><thead><tr><th>Prompt / KPI</th><th>Axe</th><th>Poids</th><th>Score</th><th>Verdict</th></tr></thead><tbody>${rows}</tbody></table>
    <p style="color:#999;font-size:11px;margin-top:40px;">Généré par ${branding?.logoUrl ? '' : 'Crawlers AI — '}${new Date().toLocaleDateString('fr-FR')}</p>
  </body></html>`;
}

export default function RapportMatrice() {
  const { language } = useLanguage();
  const { profile } = useAuth();
  const [data, setData] = useState<MatriceReportData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('rapport_matrice_data');
    if (!raw) return;
    try { setData(JSON.parse(raw)); } catch { /* noop */ }
  }, []);

  const branding = profile?.plan_type === 'agency_pro' && (profile.agency_logo_url || profile.agency_primary_color)
    ? { logoUrl: profile.agency_logo_url, primaryColor: profile.agency_primary_color }
    : undefined;

  const htmlContent = useMemo(() => {
    if (!data) return '';
    return generateMatriceHTML(data, branding);
  }, [data, branding]);

  const handleCsv = () => {
    if (!data) return;
    const header = 'Prompt,Axe,Poids,Score,Seuil Bon,Seuil Moyen,Seuil Mauvais,Verdict\n';
    const lines = data.results.map(r =>
      `"${r.prompt}","${r.axe}",${r.poids},${r.score},${r.seuil_bon},${r.seuil_moyen},${r.seuil_mauvais},"${getScoreLabel(r.score, r.seuil_bon, r.seuil_moyen)}"`
    ).join('\n');
    const blob = new Blob(['\uFEFF' + header + lines], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rapport-matrice.csv';
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
            <h1 className="text-base sm:text-lg font-semibold truncate">Rapport Matrice — {data.url}</h1>
            <div className="flex items-center gap-2 flex-shrink-0">
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
          <iframe title="Rapport Matrice" srcDoc={htmlContent} className="w-full h-[calc(100vh-57px-40px)] bg-white" />
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
