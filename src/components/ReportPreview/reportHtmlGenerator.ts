import { CrawlResult } from '@/types/crawler';
import { GeoResult } from '@/types/geo';
import { LLMAnalysisResult } from '@/types/llm';
import { PageSpeedResult } from '@/types/pagespeed';
import { getReportStyles, icons } from './reportStyles';
import { reportTranslations, TranslationKeys } from './translations';
import { generateCrawlersHTML } from './generators/crawlersHtmlGenerator';
import { generateGeoHTML } from './generators/geoHtmlGenerator';
import { generateLLMHTML } from './generators/llmHtmlGenerator';
import { generatePageSpeedHTML } from './generators/pagespeedHtmlGenerator';

export type ReportType = 'crawlers' | 'geo' | 'llm' | 'pagespeed' | 'full';

interface ReportData {
  crawlResult?: CrawlResult | null;
  geoResult?: GeoResult | null;
  llmResult?: LLMAnalysisResult | null;
  pageSpeedResult?: PageSpeedResult | null;
}

function generateHeader(t: TranslationKeys, title: string, date: string): string {
  return `
    <div class="header">
      <div class="logo-wrapper">
        <div class="logo-icon">
          ${icons.bot}
        </div>
        <span class="logo-text">Crawlers AI</span>
      </div>
      <h1 style="font-size: 20px; font-weight: 600; margin: 8px 0 4px;">${title}</h1>
      <div class="date">${t.generatedAt} ${date}</div>
    </div>
  `;
}

function generateFooter(t: TranslationKeys): string {
  return `
    <div class="footer">
      <div class="footer-brand">${t.poweredBy}</div>
      <div class="footer-cta">${t.ctaAudit}</div>
      <a href="https://crawlers.fr/audit-expert" class="footer-link">${t.ctaLink}</a>
    </div>
  `;
}

function generateSeparator(): string {
  return `<div style="height: 32px;"></div>`;
}

export function generateReportHTML(
  type: ReportType, 
  data: ReportData | CrawlResult | GeoResult | LLMAnalysisResult | PageSpeedResult, 
  url: string, 
  language: string
): string {
  const t = reportTranslations[language as keyof typeof reportTranslations] || reportTranslations.fr;
  const now = new Date().toLocaleString(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US');

  let content = '';
  let title = '';

  if (type === 'full') {
    // Combined report with all available results
    const reportData = data as ReportData;
    title = t.full;
    
    const sections: string[] = [];
    
    if (reportData.crawlResult) {
      sections.push(generateCrawlersHTML(reportData.crawlResult, t));
    }
    
    if (reportData.geoResult) {
      if (sections.length > 0) sections.push(generateSeparator());
      sections.push(generateGeoHTML(reportData.geoResult, t));
    }
    
    if (reportData.llmResult) {
      if (sections.length > 0) sections.push(generateSeparator());
      sections.push(generateLLMHTML(reportData.llmResult, t));
    }
    
    if (reportData.pageSpeedResult) {
      if (sections.length > 0) sections.push(generateSeparator());
      sections.push(generatePageSpeedHTML(reportData.pageSpeedResult, t));
    }
    
    content = sections.join('');
  } else {
    // Single report type
    switch (type) {
      case 'crawlers':
        title = t.crawlers;
        content = generateCrawlersHTML(data as CrawlResult, t);
        break;
      case 'geo':
        title = t.geo;
        content = generateGeoHTML(data as GeoResult, t);
        break;
      case 'llm':
        title = t.llm;
        content = generateLLMHTML(data as LLMAnalysisResult, t);
        break;
      case 'pagespeed':
        title = t.pagespeed;
        content = generatePageSpeedHTML(data as PageSpeedResult, t);
        break;
    }
  }

  return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.title} - ${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    ${getReportStyles()}
  </style>
</head>
<body>
  <div class="container">
    ${generateHeader(t, title, now)}
    ${content}
    ${generateFooter(t)}
  </div>
</body>
</html>`;
}
