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
  // New insights
  duplicateTitles?: Array<{ title: string; count: number; urls: string[] }>;
  thinContentPages?: Array<{ url: string; path: string; word_count: number }>;
  deepPages?: Array<{ url: string; path: string; depth: number }>;
  brokenLinks?: Array<{ source_url: string; broken_url: string; status?: number }>;
  indexabilityRatio?: { indexable: number; noindex: number; total: number };
  // External authority
  externalBacklinks?: Array<{
    url: string;
    path: string;
    referring_domains: number;
    backlinks_total: number;
    domain_rank_avg: number;
    top_anchors: string[];
    top_sources: Array<{ domain: string; rank: number }>;
  }>;
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
    duplicateTitles: 'Titres dupliqués',
    duplicateOn: 'pages partagent ce titre',
    thinContent: 'Contenu mince',
    thinContentDesc: 'Pages avec moins de 300 mots',
    deepPages: 'Pages profondes',
    deepPagesDesc: 'Pages à plus de 3 clics de la homepage',
    depth: 'profondeur',
    brokenLinks: 'Liens cassés',
    brokenLinksDesc: 'Liens internes pointant vers des erreurs',
    from: 'depuis',
    indexability: 'Ratio d\'indexabilité',
    indexable: 'Indexables',
    notIndexable: 'Non indexables',
    externalAuthority: 'Sources d\'autorité externe',
    externalAuthorityDesc: 'Pages recevant le plus de backlinks externes (top 10)',
    referringDomains: 'domaines référents',
    backlinksTotal: 'backlinks',
    topAnchors: 'Ancres principales',
    topSources: 'Sources principales',
    avgDomainRank: 'Rang moyen des sources',
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
    duplicateTitles: 'Duplicate titles',
    duplicateOn: 'pages share this title',
    thinContent: 'Thin content',
    thinContentDesc: 'Pages with fewer than 300 words',
    deepPages: 'Deep pages',
    deepPagesDesc: 'Pages more than 3 clicks from homepage',
    depth: 'depth',
    brokenLinks: 'Broken links',
    brokenLinksDesc: 'Internal links pointing to errors',
    from: 'from',
    indexability: 'Indexability ratio',
    indexable: 'Indexable',
    notIndexable: 'Not indexable',
    externalAuthority: 'External authority sources',
    externalAuthorityDesc: 'Pages receiving the most external backlinks (top 10)',
    referringDomains: 'referring domains',
    backlinksTotal: 'backlinks',
    topAnchors: 'Top anchors',
    topSources: 'Top sources',
    avgDomainRank: 'Avg source domain rank',
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
    duplicateTitles: 'Títulos duplicados',
    duplicateOn: 'páginas comparten este título',
    thinContent: 'Contenido delgado',
    thinContentDesc: 'Páginas con menos de 300 palabras',
    deepPages: 'Páginas profundas',
    deepPagesDesc: 'Páginas a más de 3 clics del inicio',
    depth: 'profundidad',
    brokenLinks: 'Enlaces rotos',
    brokenLinksDesc: 'Enlaces internos apuntando a errores',
    from: 'desde',
    indexability: 'Ratio de indexabilidad',
    indexable: 'Indexables',
    notIndexable: 'No indexables',
    externalAuthority: 'Fuentes de autoridad externa',
    externalAuthorityDesc: 'Páginas que reciben más backlinks externos (top 10)',
    referringDomains: 'dominios referentes',
    backlinksTotal: 'backlinks',
    topAnchors: 'Anclas principales',
    topSources: 'Fuentes principales',
    avgDomainRank: 'Rango promedio de fuentes',
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

  // HTTP Status Distribution donut chart (SVG)
  const statusGroups: Record<string, number> = {};
  data.pages.forEach(p => {
    const s = p.http_status;
    const group = !s ? 'unknown' : s === 200 ? '200' : s >= 200 && s < 300 ? '2xx' : s >= 300 && s < 400 ? '3xx' : s >= 400 && s < 500 ? '4xx' : s >= 500 ? '5xx' : 'unknown';
    statusGroups[group] = (statusGroups[group] || 0) + 1;
  });
  const statusColors: Record<string, string> = { '200': '#10b981', '2xx': '#34d399', '3xx': '#f59e0b', '4xx': '#ef4444', '5xx': '#dc2626', 'unknown': '#6b7280' };
  const statusLabels: Record<string, string> = language === 'fr'
    ? { '200': '200 OK', '2xx': 'Autres succès (2xx)', '3xx': 'Redirection (3xx)', '4xx': 'Erreur client (4xx)', '5xx': 'Erreur serveur (5xx)', 'unknown': 'Inconnu' }
    : language === 'es'
    ? { '200': '200 OK', '2xx': 'Otros éxitos (2xx)', '3xx': 'Redirección (3xx)', '4xx': 'Error cliente (4xx)', '5xx': 'Error servidor (5xx)', 'unknown': 'Desconocido' }
    : { '200': '200 OK', '2xx': 'Other Success (2xx)', '3xx': 'Redirect (3xx)', '4xx': 'Client Error (4xx)', '5xx': 'Server Error (5xx)', 'unknown': 'Unknown' };
  const statusTitle = language === 'fr' ? 'Codes de réponse HTTP' : language === 'es' ? 'Códigos de respuesta HTTP' : 'HTTP Response Codes';
  const statusEntries = ['200', '2xx', '3xx', '4xx', '5xx', 'unknown'].filter(k => statusGroups[k] > 0);
  const totalPages = data.pages.length;

  // Build SVG donut
  let donutPaths = '';
  let startAngle = 0;
  statusEntries.forEach(k => {
    const pct = statusGroups[k] / totalPages;
    const angle = pct * 360;
    const endAngle = startAngle + angle;
    const largeArc = angle > 180 ? 1 : 0;
    const r = 80, ir = 50, cx = 110, cy = 110;
    const s1 = Math.sin((startAngle * Math.PI) / 180), c1 = Math.cos((startAngle * Math.PI) / 180);
    const s2 = Math.sin((endAngle * Math.PI) / 180), c2 = Math.cos((endAngle * Math.PI) / 180);
    const x1o = cx + r * s1, y1o = cy - r * c1;
    const x2o = cx + r * s2, y2o = cy - r * c2;
    const x1i = cx + ir * s2, y1i = cy - ir * c2;
    const x2i = cx + ir * s1, y2i = cy - ir * c1;
    donutPaths += `<path d="M${x1o},${y1o} A${r},${r} 0 ${largeArc} 1 ${x2o},${y2o} L${x1i},${y1i} A${ir},${ir} 0 ${largeArc} 0 ${x2i},${y2i} Z" fill="${statusColors[k]}" />`;
    startAngle = endAngle;
  });

  const statusLegend = statusEntries.map(k => `
    <div style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
      <div style="width: 12px; height: 12px; border-radius: 50%; background: ${statusColors[k]}; flex-shrink: 0;"></div>
      <span style="color: #9ca3af;">${statusLabels[k]}</span>
      <span style="font-weight: 600; margin-left: auto;">${statusGroups[k]} (${((statusGroups[k] / totalPages) * 100).toFixed(1)}%)</span>
    </div>
  `).join('');

  const httpStatusChart = statusEntries.length > 0 ? `
    <div class="card" style="padding: 20px; margin-bottom: 24px;">
      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">🌐 ${statusTitle}</h3>
      <div style="display: flex; align-items: center; gap: 32px;">
        <div style="display: flex; flex-direction: column; gap: 8px; min-width: 200px;">
          ${statusLegend}
        </div>
        <div style="flex: 1; display: flex; justify-content: center;">
          <svg viewBox="0 0 220 220" width="200" height="200">${donutPaths}</svg>
        </div>
      </div>
    </div>
  ` : '';

  // ── NEW: 5 Insights sections ──

  // 1. Indexability ratio
  const idx = data.indexabilityRatio;
  const indexabilitySection = idx ? (() => {
    const pctIndexable = idx.total > 0 ? ((idx.indexable / idx.total) * 100).toFixed(1) : '0';
    const pctNoindex = idx.total > 0 ? ((idx.noindex / idx.total) * 100).toFixed(1) : '0';
    const barColor = Number(pctIndexable) >= 80 ? '#10b981' : Number(pctIndexable) >= 60 ? '#f59e0b' : '#ef4444';
    return `
      <div class="card" style="padding: 20px; margin-bottom: 24px;">
        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">📊 ${t.indexability}</h3>
        <div style="display: flex; gap: 24px; align-items: center;">
          <div style="flex: 1;">
            <div style="height: 24px; background: rgba(255,255,255,0.06); border-radius: 12px; overflow: hidden; position: relative;">
              <div style="height: 100%; width: ${pctIndexable}%; background: ${barColor}; border-radius: 12px; transition: width 0.4s;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px; color: #9ca3af;">
              <span>✅ ${t.indexable}: ${idx.indexable} (${pctIndexable}%)</span>
              <span>🚫 ${t.notIndexable}: ${idx.noindex} (${pctNoindex}%)</span>
            </div>
          </div>
        </div>
      </div>`;
  })() : '';

  // 2. Duplicate titles
  const dupes = data.duplicateTitles || [];
  const duplicateTitlesSection = dupes.length > 0 ? `
    <div class="card" style="padding: 20px; margin-bottom: 24px;">
      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">🔁 ${t.duplicateTitles} <span style="font-size: 13px; font-weight: 400; color: #9ca3af;">(${dupes.length})</span></h3>
      ${dupes.slice(0, 10).map(d => `
        <div style="padding: 10px 12px; background: rgba(255,255,255,0.03); border-radius: 8px; margin-bottom: 6px;">
          <div style="font-size: 13px; font-weight: 500; margin-bottom: 4px;">"${(d.title || '').substring(0, 80)}"</div>
          <div style="font-size: 11px; color: #f59e0b;">⚠ ${d.count} ${t.duplicateOn}</div>
          <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">${d.urls.slice(0, 3).join(' · ')}${d.urls.length > 3 ? ` … +${d.urls.length - 3}` : ''}</div>
        </div>
      `).join('')}
      ${dupes.length > 10 ? `<div style="text-align: center; font-size: 12px; color: #6b7280; padding-top: 8px;">… +${dupes.length - 10}</div>` : ''}
    </div>
  ` : '';

  // 3. Thin content
  const thin = data.thinContentPages || [];
  const thinContentSection = thin.length > 0 ? `
    <div class="card" style="padding: 20px; margin-bottom: 24px;">
      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">📝 ${t.thinContent} <span style="font-size: 13px; font-weight: 400; color: #9ca3af;">(${thin.length})</span></h3>
      <p style="font-size: 12px; color: #6b7280; margin-bottom: 16px;">${t.thinContentDesc}</p>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;">
        ${thin.slice(0, 20).map(p => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: rgba(255,255,255,0.03); border-radius: 6px; font-size: 12px;">
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 80%;" title="${p.url}">${p.path}</span>
            <span style="color: #ef4444; font-weight: 600; white-space: nowrap;">${p.word_count} ${t.words}</span>
          </div>
        `).join('')}
      </div>
      ${thin.length > 20 ? `<div style="text-align: center; font-size: 12px; color: #6b7280; padding-top: 8px;">… +${thin.length - 20}</div>` : ''}
    </div>
  ` : '';

  // 4. Deep pages
  const deep = data.deepPages || [];
  const deepPagesSection = deep.length > 0 ? `
    <div class="card" style="padding: 20px; margin-bottom: 24px;">
      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">🕳️ ${t.deepPages} <span style="font-size: 13px; font-weight: 400; color: #9ca3af;">(${deep.length})</span></h3>
      <p style="font-size: 12px; color: #6b7280; margin-bottom: 16px;">${t.deepPagesDesc}</p>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;">
        ${deep.slice(0, 20).map(p => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: rgba(255,255,255,0.03); border-radius: 6px; font-size: 12px;">
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 75%;" title="${p.url}">${p.path}</span>
            <span style="color: #f59e0b; font-weight: 600; white-space: nowrap;">${t.depth} ${p.depth}</span>
          </div>
        `).join('')}
      </div>
      ${deep.length > 20 ? `<div style="text-align: center; font-size: 12px; color: #6b7280; padding-top: 8px;">… +${deep.length - 20}</div>` : ''}
    </div>
  ` : '';

  // 5. Broken links
  const broken = data.brokenLinks || [];
  const brokenLinksSection = broken.length > 0 ? `
    <div class="card" style="padding: 20px; margin-bottom: 24px;">
      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">🔗 ${t.brokenLinks} <span style="font-size: 13px; font-weight: 400; color: #ef4444;">(${broken.length})</span></h3>
      <p style="font-size: 12px; color: #6b7280; margin-bottom: 16px;">${t.brokenLinksDesc}</p>
      ${broken.slice(0, 15).map(b => `
        <div style="padding: 8px 12px; background: rgba(239,68,68,0.05); border-left: 3px solid #ef4444; border-radius: 4px; margin-bottom: 6px;">
          <div style="font-size: 12px; font-family: monospace; color: #ef4444; word-break: break-all;">${b.broken_url}${b.status ? ` (${b.status})` : ''}</div>
          <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">${t.from}: ${b.source_url}</div>
        </div>
      `).join('')}
      ${broken.length > 15 ? `<div style="text-align: center; font-size: 12px; color: #6b7280; padding-top: 8px;">… +${broken.length - 15}</div>` : ''}
    </div>
  ` : '';

  // 6. External authority (backlinks)
  const extBl = data.externalBacklinks || [];
  const externalBacklinksSection = extBl.length > 0 ? `
    <div class="card" style="padding: 20px; margin-bottom: 24px; border-left: 3px solid #f59e0b;">
      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">🔗 ${t.externalAuthority} <span style="font-size: 13px; font-weight: 400; color: #f59e0b;">(${extBl.length})</span></h3>
      <p style="font-size: 12px; color: #6b7280; margin-bottom: 16px;">${t.externalAuthorityDesc}</p>
      ${extBl.sort((a, b) => b.referring_domains - a.referring_domains).map(bl => `
        <div style="padding: 12px; background: rgba(245,158,11,0.04); border-radius: 8px; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60%;" title="${bl.url}">${bl.path}</span>
            <div style="display: flex; gap: 12px; font-size: 12px;">
              <span style="color: #f59e0b; font-weight: 600;">🌐 ${bl.referring_domains} ${t.referringDomains}</span>
              <span style="color: #9ca3af;">🔗 ${bl.backlinks_total} ${t.backlinksTotal}</span>
            </div>
          </div>
          ${bl.domain_rank_avg > 0 ? `<div style="font-size: 11px; color: #6b7280; margin-bottom: 4px;">📊 ${t.avgDomainRank}: ${bl.domain_rank_avg.toFixed(1)}</div>` : ''}
          ${bl.top_sources.length > 0 ? `
            <div style="font-size: 11px; color: #9ca3af; margin-bottom: 2px;">
              ${t.topSources}: ${bl.top_sources.slice(0, 3).map(s => `<span style="background: rgba(255,255,255,0.06); padding: 1px 6px; border-radius: 3px; margin-right: 4px;">${s.domain}</span>`).join('')}
            </div>
          ` : ''}
          ${bl.top_anchors.length > 0 ? `
            <div style="font-size: 11px; color: #6b7280;">
              ${t.topAnchors}: ${bl.top_anchors.slice(0, 3).map(a => `"${a}"`).join(', ')}
            </div>
          ` : ''}
        </div>
      `).join('')}
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
    <div data-pdf-section="crawl-title" class="section-title">${t.title} — ${data.domain}</div>
    <div data-pdf-section="crawl-metrics">${metrics}</div>
    ${aiSummary ? `<div data-pdf-section="crawl-ai-summary">${aiSummary}</div>` : ''}
    ${recos ? `<div data-pdf-section="crawl-recos">${recos}</div>` : ''}
    ${indexabilitySection ? `<div data-pdf-section="crawl-indexability">${indexabilitySection}</div>` : ''}
    ${topErrors ? `<div data-pdf-section="crawl-errors">${topErrors}</div>` : ''}
    ${httpStatusChart ? `<div data-pdf-section="crawl-http">${httpStatusChart}</div>` : ''}
    ${duplicateTitlesSection ? `<div data-pdf-section="crawl-dupes">${duplicateTitlesSection}</div>` : ''}
    ${thinContentSection ? `<div data-pdf-section="crawl-thin">${thinContentSection}</div>` : ''}
    ${deepPagesSection ? `<div data-pdf-section="crawl-deep">${deepPagesSection}</div>` : ''}
    ${brokenLinksSection ? `<div data-pdf-section="crawl-broken">${brokenLinksSection}</div>` : ''}
    ${externalBacklinksSection ? `<div data-pdf-section="crawl-backlinks">${externalBacklinksSection}</div>` : ''}
    <div data-pdf-section="crawl-pages">${pagesTable}</div>
  `;
}
