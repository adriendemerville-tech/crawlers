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
import { generateSiteCrawlHTML, SiteCrawlReportData } from './generators/siteCrawlHtmlGenerator';

export type ReportType = 'crawlers' | 'geo' | 'llm' | 'pagespeed' | 'site_crawl' | 'full';

export interface WhiteLabelBranding {
  logoUrl?: string | null;
  primaryColor?: string | null;
}

interface ReportData {
  crawlResult?: CrawlResult | null;
  geoResult?: GeoResult | null;
  llmResult?: LLMAnalysisResult | null;
  pageSpeedResult?: PageSpeedResult | null;
  siteCrawlData?: SiteCrawlReportData | null;
}

export type { SiteCrawlReportData };

function generateHeader(t: TranslationKeys, title: string, date: string): string {
  return `
    <div class="header" data-pdf-section="header">
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
    <div class="footer" data-pdf-section="footer">
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
  data: ReportData | CrawlResult | GeoResult | LLMAnalysisResult | PageSpeedResult | SiteCrawlReportData, 
  url: string, 
  language: string,
  branding?: WhiteLabelBranding
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
      sections.push(generateCrawlersHTML(reportData.crawlResult, t, language));
    }
    
    if (reportData.geoResult) {
      if (sections.length > 0) sections.push(generateSeparator());
      sections.push(generateGeoHTML(reportData.geoResult, t, language));
    }
    
    if (reportData.llmResult) {
      if (sections.length > 0) sections.push(generateSeparator());
      sections.push(generateLLMHTML(reportData.llmResult, t, language));
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
        content = generateCrawlersHTML(data as CrawlResult, t, language);
        break;
      case 'geo':
        title = t.geo;
        content = generateGeoHTML(data as GeoResult, t, language);
        break;
      case 'llm':
        title = t.llm;
        content = generateLLMHTML(data as LLMAnalysisResult, t, language);
        break;
      case 'pagespeed':
        title = t.pagespeed;
        content = generatePageSpeedHTML(data as PageSpeedResult, t);
        break;
      case 'site_crawl':
        title = language === 'fr' ? 'Audit Multi-Pages' : language === 'es' ? 'Auditoría Multi-Páginas' : 'Multi-Page Audit';
        content = generateSiteCrawlHTML(data as SiteCrawlReportData, t, language);
        break;
    }
  }

  const isWhiteLabel = branding?.logoUrl || branding?.primaryColor;

  // Override header/footer for white-label
  const headerHtml = isWhiteLabel
    ? `<div class="header" data-pdf-section="header" style="background: linear-gradient(135deg, ${branding?.primaryColor || '#3b82f6'}, ${branding?.primaryColor || '#3b82f6'}cc);">
        <div class="logo-wrapper">
          ${branding?.logoUrl ? `<img src="${branding.logoUrl}" alt="Logo" style="max-height: 32px;" />` : ''}
        </div>
        <h1 style="font-size: 20px; font-weight: 600; margin: 8px 0 4px;">${title}</h1>
        <div class="date">${t.generatedAt} ${now}</div>
      </div>`
    : generateHeader(t, title, now);

  const footerHtml = isWhiteLabel
    ? `<div class="footer" data-pdf-section="footer" style="background: linear-gradient(135deg, ${branding?.primaryColor || '#3b82f6'}, ${branding?.primaryColor || '#3b82f6'}cc);">
        ${branding?.logoUrl ? `<div class="footer-brand"><img src="${branding.logoUrl}" alt="Logo" style="max-height: 20px;" /></div>` : ''}
      </div>`
    : generateFooter(t);

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
    ${headerHtml}
    ${content}
    ${footerHtml}
  </div>
</body>
</html>`;
}
