// Dynamic import for jsPDF - only loaded when user generates PDF (~140KB savings on initial load)
import type jsPDF from 'jspdf';
import { CrawlResult } from '@/types/crawler';
import { GeoResult } from '@/types/geo';
import { LLMAnalysisResult } from '@/types/llm';
import { PageSpeedResult } from '@/types/pagespeed';

type ReportType = 'crawlers' | 'geo' | 'llm' | 'pagespeed';

// Lazy load PDF libraries
const loadPDFLibraries = async () => {
  const [jspdfModule, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable')
  ]);
  return { jsPDF: jspdfModule.default, autoTable: autoTableModule.default };
};

const translations = {
  fr: {
    crawlers: 'Rapport Crawlers IA',
    geo: 'Rapport GEO',
    llm: 'Rapport Visibilité LLM',
    pagespeed: 'Rapport PageSpeed',
    scannedAt: 'Scanné le',
    analyzedAt: 'Analysé le',
    summary: 'Résumé',
    allowed: 'Autorisés',
    blocked: 'Bloqués',
    unknown: 'Inconnu',
    bot: 'Bot',
    company: 'Entreprise',
    status: 'Statut',
    reason: 'Raison',
    factor: 'Facteur',
    score: 'Score',
    cited: 'Cité',
    iterations: 'Itérations',
    sentiment: 'Sentiment',
    recommends: 'Recommande',
    metric: 'Métrique',
    value: 'Valeur',
    performance: 'Performance',
    accessibility: 'Accessibilité',
    bestPractices: 'Bonnes Pratiques',
    seo: 'SEO',
    mainScores: 'Scores principaux',
    coreWebVitals: 'Core Web Vitals',
    positive: 'Positif',
    neutral: 'Neutre',
    negative: 'Négatif',
    yes: 'Oui',
    no: 'Non',
    poweredBy: 'Crawlers AI - crawlers.fr',
    ctaText: 'Audit expert du SEO et du GEO de votre site',
    pdfError: 'La génération PDF a échoué. Le rapport HTML a été téléchargé à la place.',
    downloadHtml: 'Télécharger en HTML',
  },
  en: {
    crawlers: 'AI Crawlers Report',
    geo: 'GEO Report',
    llm: 'LLM Visibility Report',
    pagespeed: 'PageSpeed Report',
    scannedAt: 'Scanned at',
    analyzedAt: 'Analyzed at',
    summary: 'Summary',
    allowed: 'Allowed',
    blocked: 'Blocked',
    unknown: 'Unknown',
    bot: 'Bot',
    company: 'Company',
    status: 'Status',
    reason: 'Reason',
    factor: 'Factor',
    score: 'Score',
    cited: 'Cited',
    iterations: 'Iterations',
    sentiment: 'Sentiment',
    recommends: 'Recommends',
    metric: 'Metric',
    value: 'Value',
    performance: 'Performance',
    accessibility: 'Accessibility',
    bestPractices: 'Best Practices',
    seo: 'SEO',
    mainScores: 'Main Scores',
    coreWebVitals: 'Core Web Vitals',
    positive: 'Positive',
    neutral: 'Neutral',
    negative: 'Negative',
    yes: 'Yes',
    no: 'No',
    poweredBy: 'Crawlers AI - crawlers.fr',
    ctaText: 'Expert SEO & GEO audit for your site',
    pdfError: 'PDF generation failed. The HTML report was downloaded instead.',
    downloadHtml: 'Download as HTML',
  },
  es: {
    crawlers: 'Informe Crawlers IA',
    geo: 'Informe GEO',
    llm: 'Informe Visibilidad LLM',
    pagespeed: 'Informe PageSpeed',
    scannedAt: 'Escaneado el',
    analyzedAt: 'Analizado el',
    summary: 'Resumen',
    allowed: 'Permitidos',
    blocked: 'Bloqueados',
    unknown: 'Desconocido',
    bot: 'Bot',
    company: 'Empresa',
    status: 'Estado',
    reason: 'Razón',
    factor: 'Factor',
    score: 'Puntuación',
    cited: 'Citado',
    iterations: 'Iteraciones',
    sentiment: 'Sentimiento',
    recommends: 'Recomienda',
    metric: 'Métrica',
    value: 'Valor',
    performance: 'Rendimiento',
    accessibility: 'Accesibilidad',
    bestPractices: 'Mejores Prácticas',
    seo: 'SEO',
    mainScores: 'Puntuaciones principales',
    coreWebVitals: 'Core Web Vitals',
    positive: 'Positivo',
    neutral: 'Neutro',
    negative: 'Negativo',
    yes: 'Sí',
    no: 'No',
    poweredBy: 'Crawlers AI - crawlers.fr',
    ctaText: 'Auditoría experta de SEO y GEO',
    pdfError: 'La generación del PDF falló. El informe HTML fue descargado en su lugar.',
    downloadHtml: 'Descargar como HTML',
  },
};

function addHeader(doc: jsPDF, title: string) {
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, doc.internal.pageSize.width, 30, 'F');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('🤖 Crawlers AI', 20, 18);
  doc.setFontSize(12);
  doc.text(title, doc.internal.pageSize.width - 20, 18, { align: 'right' });
}

function addFooter(doc: jsPDF, t: typeof translations.fr) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.height;
    doc.setFillColor(37, 99, 235);
    doc.rect(0, pageHeight - 25, doc.internal.pageSize.width, 25, 'F');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(t.poweredBy, 20, pageHeight - 12);
    doc.setFontSize(9);
    doc.text(t.ctaText + ' → crawlers.fr/audit-expert', doc.internal.pageSize.width / 2, pageHeight - 12, { align: 'center' });
    doc.text(`${i} / ${pageCount}`, doc.internal.pageSize.width - 20, pageHeight - 12, { align: 'right' });
  }
}

// ─── HTML Fallback Generator ───
function generateFallbackHTML(type: ReportType, data: any, language: string): string {
  const t = translations[language as keyof typeof translations] || translations.en;
  const title = t[type] || 'Report';
  const now = new Date().toLocaleString(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US');

  let body = '';

  if (type === 'crawlers' && data?.bots) {
    const d = data as CrawlResult;
    const allowed = d.bots.filter(b => b.status === 'allowed').length;
    const blocked = d.bots.filter(b => b.status === 'blocked').length;
    body = `
      <p><strong>URL:</strong> ${d.url}</p>
      <p><strong>${t.scannedAt}:</strong> ${new Date(d.scannedAt).toLocaleString()}</p>
      <p><strong>HTTP Status:</strong> ${d.httpStatus}</p>
      <h2>${t.summary}</h2>
      <p style="color:green">${t.allowed}: ${allowed}</p>
      <p style="color:red">${t.blocked}: ${blocked}</p>
      <table><thead><tr><th>${t.bot}</th><th>${t.company}</th><th>${t.status}</th><th>${t.reason}</th></tr></thead><tbody>
      ${d.bots.map(b => `<tr><td>${b.name}</td><td>${b.company}</td><td>${b.status}</td><td>${b.reason || '-'}</td></tr>`).join('')}
      </tbody></table>`;
  } else if (type === 'geo' && data?.factors) {
    const d = data as GeoResult;
    body = `
      <p><strong>URL:</strong> ${d.url}</p>
      <h2>${t.score} GEO: ${d.totalScore}/100</h2>
      <table><thead><tr><th>${t.factor}</th><th>${t.status}</th><th>${t.score}</th></tr></thead><tbody>
      ${d.factors.map(f => `<tr><td>${f.name}</td><td>${f.status}</td><td>${f.score}/${f.maxScore}</td></tr>`).join('')}
      </tbody></table>`;
  } else if (type === 'llm' && data?.citations) {
    const d = data as LLMAnalysisResult;
    body = `
      <p><strong>Domain:</strong> ${d.domain}</p>
      <h2>${t.score}: ${d.overallScore}/100</h2>
      <table><thead><tr><th>LLM</th><th>${t.cited}</th><th>${t.sentiment}</th></tr></thead><tbody>
      ${d.citations.map(c => `<tr><td>${c.provider.name}</td><td>${c.cited ? t.yes : t.no}</td><td>${c.sentiment || '-'}</td></tr>`).join('')}
      </tbody></table>`;
  } else if (type === 'pagespeed' && data?.scores) {
    const d = data as PageSpeedResult;
    body = `
      <p><strong>URL:</strong> ${d.url}</p>
      <h2>${t.mainScores}</h2>
      <table><thead><tr><th>${t.metric}</th><th>${t.score}</th></tr></thead><tbody>
      <tr><td>${t.performance}</td><td>${d.scores.performance}/100</td></tr>
      <tr><td>${t.accessibility}</td><td>${d.scores.accessibility}/100</td></tr>
      <tr><td>${t.bestPractices}</td><td>${d.scores.bestPractices}/100</td></tr>
      <tr><td>${t.seo}</td><td>${d.scores.seo}/100</td></tr>
      </tbody></table>
      <h2>${t.coreWebVitals}</h2>
      <table><thead><tr><th>${t.metric}</th><th>${t.value}</th></tr></thead><tbody>
      <tr><td>FCP</td><td>${d.scores.fcp}</td></tr>
      <tr><td>LCP</td><td>${d.scores.lcp}</td></tr>
      <tr><td>CLS</td><td>${d.scores.cls}</td></tr>
      <tr><td>TBT</td><td>${d.scores.tbt}</td></tr>
      </tbody></table>`;
  } else {
    body = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
  }

  return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Crawlers AI</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #1a1a2e; }
    h1 { background: #2563eb; color: white; padding: 16px 24px; border-radius: 8px; margin: 0 0 24px; }
    h2 { color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f3f4f6; font-weight: 600; }
    tr:hover { background: #f9fafb; }
    footer { margin-top: 40px; text-align: center; color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
    @media print { body { max-width: 100%; } h1 { break-inside: avoid; } table { break-inside: avoid; } }
  </style>
</head>
<body>
  <h1>🤖 ${title}</h1>
  <p style="color:#6b7280;font-size:13px">${now}</p>
  ${body}
  <footer>${t.poweredBy} — ${t.ctaText} → <a href="https://crawlers.fr/audit-expert">crawlers.fr</a></footer>
</body>
</html>`;
}

function downloadHTML(html: string, filename: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── PDF Generators (wrapped with try-catch → HTML fallback) ───

async function generateCrawlersPDF(result: CrawlResult, language: string) {
  const { jsPDF, autoTable } = await loadPDFLibraries();
  const t = translations[language as keyof typeof translations] || translations.en;
  const doc = new jsPDF();
  
  addHeader(doc, t.crawlers);
  
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`URL: ${result.url}`, 20, 45);
  doc.text(`${t.scannedAt}: ${new Date(result.scannedAt).toLocaleString()}`, 20, 52);
  doc.text(`HTTP Status: ${result.httpStatus}`, 20, 59);
  
  const allowedCount = result.bots.filter(b => b.status === 'allowed').length;
  const blockedCount = result.bots.filter(b => b.status === 'blocked').length;
  const unknownCount = result.bots.filter(b => b.status === 'unknown').length;
  
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(t.summary, 20, 75);
  
  doc.setFontSize(11);
  doc.setTextColor(22, 101, 52);
  doc.text(`${t.allowed}: ${allowedCount}`, 20, 85);
  doc.setTextColor(153, 27, 27);
  doc.text(`${t.blocked}: ${blockedCount}`, 70, 85);
  doc.setTextColor(146, 64, 14);
  doc.text(`${t.unknown}: ${unknownCount}`, 120, 85);
  
  const tableData = result.bots.map(bot => [
    bot.name,
    bot.company,
    bot.status === 'allowed' ? t.allowed : bot.status === 'blocked' ? t.blocked : t.unknown,
    bot.reason || '-'
  ]);
  
  autoTable(doc, {
    startY: 95,
    head: [[t.bot, t.company, t.status, t.reason]],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 9 },
  });
  
  addFooter(doc, t);
  const { getReportFilename } = await import('@/utils/reportFilename');
  doc.save(getReportFilename(result.url, 'crawl', 'pdf'));
}

async function generateGeoPDF(result: GeoResult, language: string) {
  const { jsPDF, autoTable } = await loadPDFLibraries();
  const t = translations[language as keyof typeof translations] || translations.en;
  const doc = new jsPDF();
  
  addHeader(doc, t.geo);
  
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`URL: ${result.url}`, 20, 45);
  doc.text(`${t.analyzedAt}: ${new Date(result.scannedAt).toLocaleString()}`, 20, 52);
  
  doc.setFontSize(24);
  doc.setTextColor(37, 99, 235);
  doc.text(`${t.score} GEO: ${result.totalScore}/100`, 20, 72);
  
  const tableData = result.factors.map(factor => [
    factor.name,
    factor.description.substring(0, 50) + (factor.description.length > 50 ? '...' : ''),
    factor.status === 'good' ? '✓' : factor.status === 'warning' ? '⚠' : '✗',
    `${factor.score}/${factor.maxScore}`
  ]);
  
  autoTable(doc, {
    startY: 85,
    head: [[t.factor, 'Description', t.status, t.score]],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 9 },
    columnStyles: { 1: { cellWidth: 60 } }
  });
  
  addFooter(doc, t);
  const { getReportFilename } = await import('@/utils/reportFilename');
  doc.save(getReportFilename(result.url, 'geo', 'pdf'));
}

async function generateLLMPDF(result: LLMAnalysisResult, language: string) {
  const { jsPDF, autoTable } = await loadPDFLibraries();
  const t = translations[language as keyof typeof translations] || translations.en;
  const doc = new jsPDF();
  
  addHeader(doc, t.llm);
  
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Domain: ${result.domain}`, 20, 45);
  doc.text(`${t.analyzedAt}: ${new Date(result.scannedAt).toLocaleString()}`, 20, 52);
  
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(`${t.score}: ${result.overallScore}/100`, 20, 68);
  doc.text(`${t.cited}: ${result.citationRate.cited}/${result.citationRate.total}`, 80, 68);
  
  const sentimentLabel = result.overallSentiment === 'positive' ? t.positive : 
                        result.overallSentiment === 'negative' ? t.negative : t.neutral;
  doc.text(`${t.sentiment}: ${sentimentLabel}`, 140, 68);
  
  const tableData = result.citations.map(citation => [
    citation.provider.name,
    citation.provider.company,
    citation.cited ? t.yes : t.no,
    citation.cited ? citation.iterationDepth.toString() : '-',
    citation.cited ? (citation.sentiment === 'positive' ? t.positive : 
                     citation.sentiment === 'negative' ? t.negative : t.neutral) : '-',
    citation.recommends ? t.yes : t.no
  ]);
  
  autoTable(doc, {
    startY: 80,
    head: [['LLM', t.company, t.cited, t.iterations, t.sentiment, t.recommends]],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 9 },
  });
  
  addFooter(doc, t);
  const { getReportFilename } = await import('@/utils/reportFilename');
  doc.save(getReportFilename(result.domain, 'llm', 'pdf'));
}

async function generatePageSpeedPDF(result: PageSpeedResult, language: string) {
  const { jsPDF, autoTable } = await loadPDFLibraries();
  const t = translations[language as keyof typeof translations] || translations.en;
  const doc = new jsPDF();
  
  addHeader(doc, t.pagespeed);
  
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`URL: ${result.url}`, 20, 45);
  
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(t.mainScores, 20, 62);
  
  const scoresData = [
    [t.performance, `${result.scores.performance}/100`],
    [t.accessibility, `${result.scores.accessibility}/100`],
    [t.bestPractices, `${result.scores.bestPractices}/100`],
    [t.seo, `${result.scores.seo}/100`],
  ];
  
  autoTable(doc, {
    startY: 68,
    head: [[t.metric, t.score]],
    body: scoresData,
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 10 },
  });
  
  const finalY = (doc as any).lastAutoTable.finalY || 120;
  doc.setFontSize(14);
  doc.text(t.coreWebVitals, 20, finalY + 15);
  
  const vitalsData = [
    ['First Contentful Paint (FCP)', result.scores.fcp],
    ['Largest Contentful Paint (LCP)', result.scores.lcp],
    ['Cumulative Layout Shift (CLS)', result.scores.cls],
    ['Total Blocking Time (TBT)', result.scores.tbt],
    ['Speed Index', result.scores.speedIndex],
    ['Time to Interactive (TTI)', result.scores.tti],
  ];
  
  autoTable(doc, {
    startY: finalY + 20,
    head: [[t.metric, t.value]],
    body: vitalsData,
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 10 },
  });
  
  addFooter(doc, t);
  const { getReportFilename } = await import('@/utils/reportFilename');
  doc.save(getReportFilename(result.url, 'pagespeed', 'pdf'));
}

/**
 * Main export — generates PDF with automatic HTML fallback on failure.
 * Returns { success: true } for PDF, { success: true, fallback: 'html' } for HTML.
 */
export async function generatePDF(
  type: ReportType, 
  data: any, 
  url: string, 
  language: string
): Promise<{ success: boolean; fallback?: 'html'; error?: string }> {
  try {
    switch (type) {
      case 'crawlers':
        await generateCrawlersPDF(data as CrawlResult, language);
        break;
      case 'geo':
        await generateGeoPDF(data as GeoResult, language);
        break;
      case 'llm':
        await generateLLMPDF(data as LLMAnalysisResult, language);
        break;
      case 'pagespeed':
        await generatePageSpeedPDF(data as PageSpeedResult, language);
        break;
    }
    return { success: true };
  } catch (pdfError) {
    console.error(`[PDF] Generation failed for ${type}, falling back to HTML:`, pdfError);

    try {
      const html = generateFallbackHTML(type, data, language);
      const sanitizedUrl = url.replace(/[^a-zA-Z0-9]/g, '-');
      downloadHTML(html, `${type}-report-${sanitizedUrl}.html`);
      return { success: true, fallback: 'html', error: pdfError instanceof Error ? pdfError.message : 'Unknown PDF error' };
    } catch (htmlError) {
      console.error('[PDF] HTML fallback also failed:', htmlError);
      return { success: false, error: 'Both PDF and HTML generation failed' };
    }
  }
}
