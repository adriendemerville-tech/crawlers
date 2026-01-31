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
  },
};

function addHeader(doc: jsPDF, title: string) {
  // Blue header background
  doc.setFillColor(37, 99, 235); // #2563eb
  doc.rect(0, 0, doc.internal.pageSize.width, 30, 'F');
  
  // Logo
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('🤖 Crawlers AI', 20, 18);
  
  // Title on right
  doc.setFontSize(12);
  doc.text(title, doc.internal.pageSize.width - 20, 18, { align: 'right' });
}

function addFooter(doc: jsPDF, t: typeof translations.fr) {
  const pageCount = doc.getNumberOfPages();
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.height;
    
    // Blue footer background
    doc.setFillColor(37, 99, 235);
    doc.rect(0, pageHeight - 25, doc.internal.pageSize.width, 25, 'F');
    
    // Footer text
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(t.poweredBy, 20, pageHeight - 12);
    
    // CTA
    doc.setFontSize(9);
    doc.text(t.ctaText + ' → crawlers.fr/audit-expert', doc.internal.pageSize.width / 2, pageHeight - 12, { align: 'center' });
    
    // Page number
    doc.text(`${i} / ${pageCount}`, doc.internal.pageSize.width - 20, pageHeight - 12, { align: 'right' });
  }
}

async function generateCrawlersPDF(result: CrawlResult, language: string) {
  const { jsPDF, autoTable } = await loadPDFLibraries();
  const t = translations[language as keyof typeof translations] || translations.en;
  const doc = new jsPDF();
  
  addHeader(doc, t.crawlers);
  
  // URL and date
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`URL: ${result.url}`, 20, 45);
  doc.text(`${t.scannedAt}: ${new Date(result.scannedAt).toLocaleString()}`, 20, 52);
  doc.text(`HTTP Status: ${result.httpStatus}`, 20, 59);
  
  // Summary
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
  
  // Bot details table
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
  doc.save(`crawlers-report-${result.url.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
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
  
  // Score
  doc.setFontSize(24);
  doc.setTextColor(37, 99, 235);
  doc.text(`${t.score} GEO: ${result.totalScore}/100`, 20, 72);
  
  // Factors table
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
  doc.save(`geo-report-${result.url.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
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
  
  // Scores
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(`${t.score}: ${result.overallScore}/100`, 20, 68);
  doc.text(`${t.cited}: ${result.citationRate.cited}/${result.citationRate.total}`, 80, 68);
  
  const sentimentLabel = result.overallSentiment === 'positive' ? t.positive : 
                        result.overallSentiment === 'negative' ? t.negative : t.neutral;
  doc.text(`${t.sentiment}: ${sentimentLabel}`, 140, 68);
  
  // Citations table
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
  doc.save(`llm-report-${result.domain.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
}

async function generatePageSpeedPDF(result: PageSpeedResult, language: string) {
  const { jsPDF, autoTable } = await loadPDFLibraries();
  const t = translations[language as keyof typeof translations] || translations.en;
  const doc = new jsPDF();
  
  addHeader(doc, t.pagespeed);
  
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`URL: ${result.url}`, 20, 45);
  
  // Main scores
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
  
  // Core Web Vitals
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
  doc.save(`pagespeed-report-${result.url.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
}

export async function generatePDF(type: ReportType, data: any, url: string, language: string): Promise<void> {
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
}
