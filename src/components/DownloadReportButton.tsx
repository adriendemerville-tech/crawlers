import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { CrawlResult } from '@/types/crawler';
import { GeoResult } from '@/types/geo';
import { LLMAnalysisResult } from '@/types/llm';
import { PageSpeedResult } from '@/types/pagespeed';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type ReportType = 'crawlers' | 'geo' | 'llm' | 'pagespeed';

interface DownloadReportButtonProps {
  type: ReportType;
  crawlResult?: CrawlResult | null;
  geoResult?: GeoResult | null;
  llmResult?: LLMAnalysisResult | null;
  pageSpeedResult?: PageSpeedResult | null;
}

export function DownloadReportButton({ 
  type, 
  crawlResult, 
  geoResult, 
  llmResult, 
  pageSpeedResult 
}: DownloadReportButtonProps) {
  const { t, language } = useLanguage();

  const getButtonLabel = () => {
    switch (language) {
      case 'fr': return 'Rapport';
      case 'es': return 'Informe';
      default: return 'Report';
    }
  };

  const generateCrawlersPDF = (result: CrawlResult) => {
    const doc = new jsPDF();
    const title = language === 'fr' ? 'Rapport Crawlers IA' : language === 'es' ? 'Informe Crawlers IA' : 'AI Crawlers Report';
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(124, 58, 237); // Primary color
    doc.text(title, 20, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`URL: ${result.url}`, 20, 35);
    doc.text(`${language === 'fr' ? 'Scanné le' : language === 'es' ? 'Escaneado el' : 'Scanned at'}: ${new Date(result.scannedAt).toLocaleString()}`, 20, 42);
    doc.text(`HTTP Status: ${result.httpStatus}`, 20, 49);
    
    // Summary
    const allowedCount = result.bots.filter(b => b.status === 'allowed').length;
    const blockedCount = result.bots.filter(b => b.status === 'blocked').length;
    
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(language === 'fr' ? 'Résumé' : language === 'es' ? 'Resumen' : 'Summary', 20, 65);
    
    doc.setFontSize(11);
    doc.setTextColor(34, 197, 94);
    doc.text(`${t.results.allowed}: ${allowedCount}`, 20, 75);
    doc.setTextColor(239, 68, 68);
    doc.text(`${t.results.blocked}: ${blockedCount}`, 80, 75);
    
    // Bot details table
    const tableData = result.bots.map(bot => [
      bot.name,
      bot.company,
      bot.status === 'allowed' ? t.results.allowed : bot.status === 'blocked' ? t.results.blocked : t.results.unknown,
      bot.reason || '-'
    ]);
    
    autoTable(doc, {
      startY: 85,
      head: [[
        'Bot', 
        language === 'fr' ? 'Entreprise' : language === 'es' ? 'Empresa' : 'Company',
        'Status',
        language === 'fr' ? 'Raison' : language === 'es' ? 'Razón' : 'Reason'
      ]],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [124, 58, 237] },
    });
    
    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text('Crawlers AI - crawlers.fr', 20, doc.internal.pageSize.height - 10);
      doc.text(`${i} / ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
    }
    
    doc.save(`crawlers-report-${result.url.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
  };

  const generateGeoPDF = (result: GeoResult) => {
    const doc = new jsPDF();
    const title = language === 'fr' ? 'Rapport GEO' : language === 'es' ? 'Informe GEO' : 'GEO Report';
    
    doc.setFontSize(20);
    doc.setTextColor(124, 58, 237);
    doc.text(title, 20, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`URL: ${result.url}`, 20, 35);
    doc.text(`${language === 'fr' ? 'Analysé le' : language === 'es' ? 'Analizado el' : 'Analyzed at'}: ${new Date(result.scannedAt).toLocaleString()}`, 20, 42);
    
    // Score
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text(`Score GEO: ${result.totalScore}/100`, 20, 58);
    
    // Factors table
    const tableData = result.factors.map(factor => [
      factor.name,
      `${factor.score}/${factor.maxScore}`,
      factor.status === 'good' ? '✓' : factor.status === 'warning' ? '⚠' : '✗',
      factor.description
    ]);
    
    autoTable(doc, {
      startY: 70,
      head: [[
        language === 'fr' ? 'Facteur' : language === 'es' ? 'Factor' : 'Factor',
        'Score',
        'Status',
        'Description'
      ]],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [124, 58, 237] },
      columnStyles: {
        3: { cellWidth: 80 }
      }
    });
    
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text('Crawlers AI - crawlers.fr', 20, doc.internal.pageSize.height - 10);
    }
    
    doc.save(`geo-report-${result.url.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
  };

  const generateLLMPDF = (result: LLMAnalysisResult) => {
    const doc = new jsPDF();
    const title = language === 'fr' ? 'Rapport Visibilité LLM' : language === 'es' ? 'Informe Visibilidad LLM' : 'LLM Visibility Report';
    
    doc.setFontSize(20);
    doc.setTextColor(124, 58, 237);
    doc.text(title, 20, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`${language === 'fr' ? 'Domaine' : language === 'es' ? 'Dominio' : 'Domain'}: ${result.domain}`, 20, 35);
    doc.text(`${language === 'fr' ? 'Analysé le' : language === 'es' ? 'Analizado el' : 'Analyzed at'}: ${new Date(result.scannedAt).toLocaleString()}`, 20, 42);
    
    // Scores
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(`${t.llm.overallVisibility}: ${result.overallScore}/100`, 20, 58);
    doc.text(`${t.llm.citationRate}: ${result.citationRate.cited}/${result.citationRate.total}`, 20, 68);
    
    const sentimentLabel = result.overallSentiment === 'positive' ? t.llm.positive : 
                          result.overallSentiment === 'negative' ? t.llm.negative : t.llm.neutral;
    doc.text(`${t.llm.sentiment}: ${sentimentLabel}`, 20, 78);
    
    // Citations table
    const tableData = result.citations.map(citation => [
      citation.provider.name,
      citation.provider.company,
      citation.cited ? (language === 'fr' ? 'Oui' : language === 'es' ? 'Sí' : 'Yes') : 'No',
      citation.cited ? citation.iterationDepth.toString() : '-',
      citation.cited ? (citation.sentiment === 'positive' ? t.llm.positive : 
                       citation.sentiment === 'negative' ? t.llm.negative : t.llm.neutral) : '-'
    ]);
    
    autoTable(doc, {
      startY: 90,
      head: [['LLM', language === 'fr' ? 'Entreprise' : language === 'es' ? 'Empresa' : 'Company', 
              language === 'fr' ? 'Cité' : language === 'es' ? 'Citado' : 'Cited', 
              t.llm.iterations, t.llm.sentiment]],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [124, 58, 237] },
    });
    
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text('Crawlers AI - crawlers.fr', 20, doc.internal.pageSize.height - 10);
    }
    
    doc.save(`llm-report-${result.domain.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
  };

  const generatePageSpeedPDF = (result: PageSpeedResult) => {
    const doc = new jsPDF();
    const title = language === 'fr' ? 'Rapport PageSpeed' : language === 'es' ? 'Informe PageSpeed' : 'PageSpeed Report';
    
    doc.setFontSize(20);
    doc.setTextColor(124, 58, 237);
    doc.text(title, 20, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`URL: ${result.url}`, 20, 35);
    
    // Main scores
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(language === 'fr' ? 'Scores principaux' : language === 'es' ? 'Puntuaciones principales' : 'Main Scores', 20, 55);
    
    const scoresData = [
      [t.pagespeed.performance, `${result.scores.performance}/100`],
      [t.pagespeed.accessibility, `${result.scores.accessibility}/100`],
      [t.pagespeed.bestPractices, `${result.scores.bestPractices}/100`],
      [t.pagespeed.seo, `${result.scores.seo}/100`],
    ];
    
    autoTable(doc, {
      startY: 60,
      head: [[language === 'fr' ? 'Métrique' : language === 'es' ? 'Métrica' : 'Metric', 'Score']],
      body: scoresData,
      theme: 'striped',
      headStyles: { fillColor: [124, 58, 237] },
    });
    
    // Core Web Vitals
    doc.setFontSize(14);
    doc.text(t.pagespeed.coreWebVitals, 20, 115);
    
    const vitalsData = [
      [t.pagespeed.fcp, result.scores.fcp],
      [t.pagespeed.lcp, result.scores.lcp],
      [t.pagespeed.cls, result.scores.cls],
      [t.pagespeed.tbt, result.scores.tbt],
      [t.pagespeed.speedIndex, result.scores.speedIndex],
      [t.pagespeed.tti, result.scores.tti],
    ];
    
    autoTable(doc, {
      startY: 120,
      head: [[language === 'fr' ? 'Métrique' : language === 'es' ? 'Métrica' : 'Metric', 
              language === 'fr' ? 'Valeur' : language === 'es' ? 'Valor' : 'Value']],
      body: vitalsData,
      theme: 'striped',
      headStyles: { fillColor: [124, 58, 237] },
    });
    
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text('Crawlers AI - crawlers.fr', 20, doc.internal.pageSize.height - 10);
    }
    
    doc.save(`pagespeed-report-${result.url.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
  };

  const handleDownload = () => {
    switch (type) {
      case 'crawlers':
        if (crawlResult) generateCrawlersPDF(crawlResult);
        break;
      case 'geo':
        if (geoResult) generateGeoPDF(geoResult);
        break;
      case 'llm':
        if (llmResult) generateLLMPDF(llmResult);
        break;
      case 'pagespeed':
        if (pageSpeedResult) generatePageSpeedPDF(pageSpeedResult);
        break;
    }
  };

  const hasResult = 
    (type === 'crawlers' && crawlResult) ||
    (type === 'geo' && geoResult) ||
    (type === 'llm' && llmResult) ||
    (type === 'pagespeed' && pageSpeedResult);

  if (!hasResult) return null;

  return (
    <div className="flex justify-center mt-6 mb-8">
      <Button
        onClick={handleDownload}
        size="lg"
        className="gap-3 bg-blue-600 text-white font-bold text-lg px-8 py-6 hover:bg-blue-700"
      >
        {getButtonLabel()}
        <Download className="h-6 w-6" />
      </Button>
    </div>
  );
}