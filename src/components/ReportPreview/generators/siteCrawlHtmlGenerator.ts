import { TranslationKeys } from '../translations';

export interface SiteCrawlReportData {
  domain: string;
  crawledPages: number;
  totalPages: number;
  avgScore: number | null;
  aiSummary: string | null;
  aiRecommendations: Array<{
    title: string;
    description: string;
    priority: string;
    affected_pages?: number;
  }>;
  issueStats: Record<string, number>;
  pages: Array<{
    url: string;
    path: string;
    seo_score: number | null;
    http_status: number | null;
    title: string | null;
    issues: string[];
    has_noindex: boolean | null;
    word_count: number | null;
  }>;
  createdAt: string;
}

const siteCrawlI18n = {
  fr: {
    title: 'Audit Multi-Pages',
    pagesAnalyzed: 'Pages analysées',
    avgScore: 'Score moyen',
    perfectPages: 'Pages parfaites',
    totalErrors: 'Erreurs totales',
    aiSummary: 'Synthèse IA',
    recommendations: 'Recommandations prioritaires',
    pagesAffected: 'pages concernées',
    topErrors: 'Erreurs les plus fréquentes',
    occurrences: 'occurrences',
    pagesList: 'Détail par page',
    score: 'Score',
    issues: 'Problèmes',
    indexed: 'Indexée',
    noindex: 'Noindex',
    words: 'mots',
  },
  en: {
    title: 'Multi-Page Audit',
    pagesAnalyzed: 'Pages analyzed',
    avgScore: 'Average score',
    perfectPages: 'Perfect pages',
    totalErrors: 'Total errors',
    aiSummary: 'AI Summary',
    recommendations: 'Priority recommendations',
    pagesAffected: 'pages affected',
    topErrors: 'Most common errors',
    occurrences: 'occurrences',
    pagesList: 'Page details',
    score: 'Score',
    issues: 'Issues',
    indexed: 'Indexed',
    noindex: 'Noindex',
    words: 'words',
  },
  es: {
    title: 'Auditoría Multi-Páginas',
    pagesAnalyzed: 'Páginas analizadas',
    avgScore: 'Puntuación media',
    perfectPages: 'Páginas perfectas',
    totalErrors: 'Errores totales',
    aiSummary: 'Síntesis IA',
    recommendations: 'Recomendaciones prioritarias',
    pagesAffected: 'páginas afectadas',
    topErrors: 'Errores más frecuentes',
    occurrences: 'ocurrencias',
    pagesList: 'Detalle por página',
    score: 'Puntuación',
    issues: 'Problemas',
    indexed: 'Indexada',
    noindex: 'Noindex',
    words: 'palabras',
  },
};

function getScoreColor(score: number): string {
  if (score >= 160) return '#10b981';
  if (score >= 120) return '#f59e0b';
  return '#ef4444';
}

function getPriorityColor(priority: string): string {
  if (priority === 'critical') return '#ef4444';
  if (priority === 'high') return '#f59e0b';
  return '#6b7280';
}

export function generateSiteCrawlHTML(data: SiteCrawlReportData, _t: TranslationKeys, language: string): string {
  const t = siteCrawlI18n[language as keyof typeof siteCrawlI18n] || siteCrawlI18n.fr;
  const perfectPages = data.pages.filter(p => (p.issues || []).length === 0).length;
  const totalErrors = Object.values(data.issueStats).reduce((s, v) => s + v, 0);
  const avgScore = data.avgScore || 0;

  // Metrics cards
  const metrics = `
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;">
      <div class="card" style="text-align: center; padding: 16px;">
        <div style="font-size: 28px; font-weight: 700;">${data.crawledPages}</div>
        <div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">${t.pagesAnalyzed}</div>
      </div>
      <div class="card" style="text-align: center; padding: 16px;">
        <div style="font-size: 28px; font-weight: 700; color: ${getScoreColor(avgScore)};">${avgScore}/200</div>
        <div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">${t.avgScore}</div>
      </div>
      <div class="card" style="text-align: center; padding: 16px;">
        <div style="font-size: 28px; font-weight: 700; color: #10b981;">${perfectPages}</div>
        <div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">${t.perfectPages}</div>
      </div>
      <div class="card" style="text-align: center; padding: 16px;">
        <div style="font-size: 28px; font-weight: 700; color: #ef4444;">${totalErrors}</div>
        <div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">${t.totalErrors}</div>
      </div>
    </div>
  `;

  // AI Summary
  const aiSummary = data.aiSummary ? `
    <div class="card" style="padding: 20px; margin-bottom: 24px; border-left: 3px solid #8b5cf6;">
      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
        ✨ ${t.aiSummary}
      </h3>
      <p style="font-size: 13px; line-height: 1.7; color: #d1d5db;">${data.aiSummary}</p>
    </div>
  ` : '';

  // Recommendations
  const recos = data.aiRecommendations?.length > 0 ? `
    <div class="card" style="padding: 20px; margin-bottom: 24px;">
      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">📋 ${t.recommendations}</h3>
      ${data.aiRecommendations.map(rec => `
        <div style="display: flex; gap: 12px; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 8px; margin-bottom: 8px;">
          <span style="background: ${getPriorityColor(rec.priority)}22; color: ${getPriorityColor(rec.priority)}; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; height: fit-content; white-space: nowrap;">${rec.priority}</span>
          <div>
            <div style="font-size: 13px; font-weight: 500;">${rec.title}</div>
            <div style="font-size: 12px; color: #9ca3af; margin-top: 2px;">${rec.description}</div>
            ${rec.affected_pages ? `<div style="font-size: 11px; color: #6b7280; margin-top: 4px;">📄 ${rec.affected_pages} ${t.pagesAffected}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  ` : '';

  // Top errors
  const topErrors = Object.keys(data.issueStats).length > 0 ? `
    <div class="card" style="padding: 20px; margin-bottom: 24px;">
      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">⚠️ ${t.topErrors}</h3>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
        ${Object.entries(data.issueStats)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([issue, count]) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(255,255,255,0.03); border-radius: 6px;">
              <span style="font-size: 12px; font-family: monospace;">${issue.replace(/_/g, ' ')}</span>
              <span style="font-size: 11px; background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 4px;">${count}</span>
            </div>
          `).join('')}
      </div>
    </div>
  ` : '';

  // Pages table (top 50)
  const sortedPages = [...data.pages].sort((a, b) => (a.seo_score || 0) - (b.seo_score || 0));
  const displayPages = sortedPages.slice(0, 50);
  const pagesTable = `
    <div class="card" style="padding: 20px;">
      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">📄 ${t.pagesList} (${data.pages.length})</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
            <th style="text-align: left; padding: 8px 4px; color: #9ca3af;">URL</th>
            <th style="text-align: center; padding: 8px 4px; color: #9ca3af; width: 70px;">${t.score}</th>
            <th style="text-align: center; padding: 8px 4px; color: #9ca3af; width: 60px;">HTTP</th>
            <th style="text-align: left; padding: 8px 4px; color: #9ca3af; width: 200px;">${t.issues}</th>
          </tr>
        </thead>
        <tbody>
          ${displayPages.map(p => `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
              <td style="padding: 6px 4px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${p.url}">${p.path || p.url}</td>
              <td style="text-align: center; padding: 6px 4px; font-weight: 600; color: ${getScoreColor(p.seo_score || 0)};">${p.seo_score || '–'}</td>
              <td style="text-align: center; padding: 6px 4px; color: ${(p.http_status || 0) >= 400 ? '#ef4444' : '#10b981'};">${p.http_status || '–'}</td>
              <td style="padding: 6px 4px; font-size: 11px; color: #9ca3af;">${(p.issues || []).slice(0, 3).join(', ') || '✓'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${data.pages.length > 50 ? `<div style="text-align: center; padding: 12px; color: #6b7280; font-size: 12px;">… +${data.pages.length - 50} pages</div>` : ''}
    </div>
  `;

  return `
    <div class="section-title">${t.title} — ${data.domain}</div>
    ${metrics}
    ${aiSummary}
    ${recos}
    ${topErrors}
    ${pagesTable}
  `;
}
