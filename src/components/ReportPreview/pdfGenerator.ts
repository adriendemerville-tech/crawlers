// Dynamic import for jsPDF - only loaded when user generates PDF (~140KB savings on initial load)
import type jsPDF from 'jspdf';
import { CrawlResult } from '@/types/crawler';
import { GeoResult } from '@/types/geo';
import { LLMAnalysisResult } from '@/types/llm';
import { PageSpeedResult } from '@/types/pagespeed';
import { SiteCrawlReportData } from './reportHtmlGenerator';

type ReportType = 'crawlers' | 'geo' | 'llm' | 'pagespeed' | 'site_crawl';

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
    site_crawl: 'Rapport Crawl',
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
    pagesAnalyzed: 'Pages analysées',
    avgScore: 'Score moyen',
    totalErrors: 'Erreurs totales',
    topPages: 'Top pages',
    issues: 'Problèmes',
    title: 'Titre',
  },
  en: {
    crawlers: 'AI Crawlers Report',
    geo: 'GEO Report',
    llm: 'LLM Visibility Report',
    pagespeed: 'PageSpeed Report',
    site_crawl: 'Crawl Report',
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
    pagesAnalyzed: 'Pages analyzed',
    avgScore: 'Average score',
    totalErrors: 'Total errors',
    topPages: 'Top pages',
    issues: 'Issues',
    title: 'Title',
  },
  es: {
    crawlers: 'Informe Crawlers IA',
    geo: 'Informe GEO',
    llm: 'Informe Visibilidad LLM',
    pagespeed: 'Informe PageSpeed',
    site_crawl: 'Informe Crawl',
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
    pagesAnalyzed: 'Páginas analizadas',
    avgScore: 'Puntuación media',
    totalErrors: 'Errores totales',
    topPages: 'Top páginas',
    issues: 'Problemas',
    title: 'Título',
  },
};

function addHeader(doc: jsPDF, title: string) {
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, doc.internal.pageSize.width, 30, 'F');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('Crawlers AI', 20, 18);
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

function generateFallbackHTML(type: ReportType, data: any, language: string): string {
  const t = translations[language as keyof typeof translations] || translations.en;
  const title = t[type] || 'Report';
  const now = new Date().toLocaleString(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US');

  let body = '';

  if (type === 'crawlers' && data?.bots) {
    const d = data as CrawlResult;
    const allowed = d.bots.filter((b) => b.status === 'allowed').length;
    const blocked = d.bots.filter((b) => b.status === 'blocked').length;
    body = `
      <p><strong>URL:</strong> ${d.url}</p>
      <p><strong>${t.scannedAt}:</strong> ${new Date(d.scannedAt).toLocaleString()}</p>
      <p><strong>HTTP Status:</strong> ${d.httpStatus}</p>
      <h2>${t.summary}</h2>
      <p style="color:green">${t.allowed}: ${allowed}</p>
      <p style="color:red">${t.blocked}: ${blocked}</p>
    `;
  } else if (type === 'geo' && data?.factors) {
    const d = data as GeoResult;
    body = `
      <p><strong>URL:</strong> ${d.url}</p>
      <h2>${t.score} GEO: ${d.totalScore}/100</h2>
    `;
  } else if (type === 'llm' && data?.citations) {
    const d = data as LLMAnalysisResult;
    body = `
      <p><strong>Domain:</strong> ${d.domain}</p>
      <h2>${t.score}: ${d.overallScore}/100</h2>
    `;
  } else if (type === 'pagespeed' && data?.scores) {
    const d = data as PageSpeedResult;
    body = `
      <p><strong>URL:</strong> ${d.url}</p>
      <h2>${t.mainScores}</h2>
    `;
  } else if (type === 'site_crawl' && data?.pages) {
    const d = data as SiteCrawlReportData;
    const totalErrors = Object.values(d.issueStats || {}).reduce((sum, count) => sum + count, 0);
    body = `
      <p><strong>Domain:</strong> ${d.domain}</p>
      <p><strong>${t.pagesAnalyzed}:</strong> ${d.crawledPages}</p>
      <p><strong>${t.avgScore}:</strong> ${d.avgScore ?? 0}/200</p>
      <p><strong>${t.totalErrors}:</strong> ${totalErrors}</p>
    `;
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
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p style="color:#6b7280;font-size:13px">${now}</p>
  ${body}
</body>
</html>`;
}

function downloadHTML(html: string, filename: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const fileUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = fileUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(fileUrl);
}

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

  const allowedCount = result.bots.filter((b) => b.status === 'allowed').length;
  const blockedCount = result.bots.filter((b) => b.status === 'blocked').length;
  const unknownCount = result.bots.filter((b) => b.status === 'unknown').length;

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

  const tableData = result.bots.map((bot) => [bot.name, bot.company, bot.status, bot.reason || '-']);
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

  const tableData = result.factors.map((factor) => [
    factor.name,
    factor.description.substring(0, 50) + (factor.description.length > 50 ? '...' : ''),
    factor.status,
    `${factor.score}/${factor.maxScore}`,
  ]);

  autoTable(doc, {
    startY: 85,
    head: [[t.factor, 'Description', t.status, t.score]],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 9 },
    columnStyles: { 1: { cellWidth: 60 } },
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

  const tableData = result.citations.map((citation) => [
    citation.provider.name,
    citation.provider.company,
    citation.cited ? t.yes : t.no,
    citation.cited ? citation.iterationDepth.toString() : '-',
    citation.sentiment || '-',
    citation.recommends ? t.yes : t.no,
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

  addFooter(doc, t);
  const { getReportFilename } = await import('@/utils/reportFilename');
  doc.save(getReportFilename(result.url, 'pagespeed', 'pdf'));
}

async function generateSiteCrawlPDF(result: SiteCrawlReportData, language: string) {
  const { jsPDF, autoTable } = await loadPDFLibraries();
  const t = translations[language as keyof typeof translations] || translations.en;
  const doc = new jsPDF();
  const totalErrors = Object.values(result.issueStats || {}).reduce((sum, count) => sum + count, 0);

  addHeader(doc, `${t.site_crawl} — ${result.domain}`);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`${t.scannedAt}: ${new Date(result.createdAt).toLocaleString()}`, 20, 45);
  doc.text(`${t.pagesAnalyzed}: ${result.crawledPages}`, 20, 52);
  doc.text(`${t.avgScore}: ${result.avgScore ?? 0}/200`, 20, 59);
  doc.text(`${t.totalErrors}: ${totalErrors}`, 20, 66);

  let cursorY = 78;

  if (result.aiSummary) {
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(t.summary, 20, cursorY);
    doc.setFontSize(10);
    doc.setTextColor(70);
    const summaryLines = doc.splitTextToSize(result.aiSummary, 170);
    doc.text(summaryLines, 20, cursorY + 8);
    cursorY += 12 + summaryLines.length * 5;
  }

  const topPages = result.pages.slice(0, 20).map((page) => [
    page.path || page.url,
    page.seo_score ?? '-',
    page.http_status ?? '-',
    page.title || '-',
    (page.issues || []).slice(0, 2).join(', ') || '-',
  ]);

  autoTable(doc, {
    startY: cursorY,
    head: [[t.topPages, t.score, t.status, t.title, t.issues]],
    body: topPages,
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 42 },
      1: { cellWidth: 18 },
      2: { cellWidth: 18 },
      3: { cellWidth: 52 },
      4: { cellWidth: 55 },
    },
  });

  addFooter(doc, t);
  const { getReportFilename } = await import('@/utils/reportFilename');
  doc.save(getReportFilename(result.domain, 'crawl', 'pdf'));
}

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
      case 'site_crawl':
        await generateSiteCrawlPDF(data as SiteCrawlReportData, language);
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
