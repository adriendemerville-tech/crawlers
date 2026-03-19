import { supabase } from '@/integrations/supabase/client';

interface CocoonReportData {
  nodes: any[];
  domain: string;
  siteName: string;
  trackedSiteId: string;
  userId: string;
  language: string;
  branding?: {
    logoUrl?: string | null;
    primaryColor?: string | null;
    brandName?: string | null;
    contactFirstName?: string | null;
    contactLastName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    reportHeaderText?: string | null;
    reportFooterText?: string | null;
    reportFont?: string | null;
  };
}

interface CrawlStats {
  totalPages: number;
  indexedPages: number;
  noindexPages: number;
  errorPages: { url: string; status: number; title?: string }[];
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getTranslations(lang: string) {
  const t: Record<string, Record<string, string>> = {
    fr: {
      reportTitle: 'Rapport de Maillage Interne',
      siteIdentity: 'Fiche d\'identité du site',
      siteName: 'Nom du site',
      homeUrl: 'URL de la page d\'accueil',
      totalPages: 'Nombre de pages',
      indexedPages: 'Pages indexées',
      noindexPages: 'Pages non indexées',
      linkingErrors: 'Erreurs de maillage',
      structuralIssues: 'Problèmes structurels',
      cannibalization: 'Cannibalisation',
      contentGaps: 'Lacunes de contenu',
      orphanPages: 'Pages orphelines',
      weakLinking: 'Maillage faible',
      errorPages: 'Pages en erreur (404/500)',
      correctiveActions: 'Actions correctives par priorité',
      priority: 'Priorité',
      critical: 'Critique',
      high: 'Élevée',
      medium: 'Moyenne',
      low: 'Faible',
      page: 'Page',
      issue: 'Problème',
      recommendation: 'Recommandation',
      internalLinksIn: 'Liens internes entrants',
      internalLinksOut: 'Liens internes sortants',
      score: 'Score',
      generatedAt: 'Rapport généré le',
      noErrors: 'Aucune erreur détectée',
      noIssues: 'Aucun problème détecté',
      gscVerified: 'Vérifié via Google Search Console',
      crawlOnly: 'Basé sur le crawl uniquement',
      pageType: 'Type de page',
      depth: 'Profondeur',
      authority: 'Autorité',
      status: 'Statut',
      url: 'URL',
      linksDistribution: 'Distribution du maillage',
      avgLinksIn: 'Liens entrants moyens',
      avgLinksOut: 'Liens sortants moyens',
      maxDepth: 'Profondeur maximale',
      healthScore: 'Score de santé du maillage',
    },
    en: {
      reportTitle: 'Internal Linking Report',
      siteIdentity: 'Site Identity Card',
      siteName: 'Site name',
      homeUrl: 'Home page URL',
      totalPages: 'Total pages',
      indexedPages: 'Indexed pages',
      noindexPages: 'Non-indexed pages',
      linkingErrors: 'Linking Errors',
      structuralIssues: 'Structural Issues',
      cannibalization: 'Cannibalization',
      contentGaps: 'Content Gaps',
      orphanPages: 'Orphan Pages',
      weakLinking: 'Weak Linking',
      errorPages: 'Error Pages (404/500)',
      correctiveActions: 'Corrective Actions by Priority',
      priority: 'Priority',
      critical: 'Critical',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
      page: 'Page',
      issue: 'Issue',
      recommendation: 'Recommendation',
      internalLinksIn: 'Incoming internal links',
      internalLinksOut: 'Outgoing internal links',
      score: 'Score',
      generatedAt: 'Report generated on',
      noErrors: 'No errors detected',
      noIssues: 'No issues detected',
      gscVerified: 'Verified via Google Search Console',
      crawlOnly: 'Based on crawl data only',
      pageType: 'Page type',
      depth: 'Depth',
      authority: 'Authority',
      status: 'Status',
      url: 'URL',
      linksDistribution: 'Linking Distribution',
      avgLinksIn: 'Average incoming links',
      avgLinksOut: 'Average outgoing links',
      maxDepth: 'Maximum depth',
      healthScore: 'Linking Health Score',
    },
    es: {
      reportTitle: 'Informe de Enlazado Interno',
      siteIdentity: 'Ficha de identidad del sitio',
      siteName: 'Nombre del sitio',
      homeUrl: 'URL de la página de inicio',
      totalPages: 'Número de páginas',
      indexedPages: 'Páginas indexadas',
      noindexPages: 'Páginas no indexadas',
      linkingErrors: 'Errores de enlazado',
      structuralIssues: 'Problemas estructurales',
      cannibalization: 'Canibalización',
      contentGaps: 'Lagunas de contenido',
      orphanPages: 'Páginas huérfanas',
      weakLinking: 'Enlazado débil',
      errorPages: 'Páginas con errores (404/500)',
      correctiveActions: 'Acciones correctivas por prioridad',
      priority: 'Prioridad',
      critical: 'Crítico',
      high: 'Alta',
      medium: 'Media',
      low: 'Baja',
      page: 'Página',
      issue: 'Problema',
      recommendation: 'Recomendación',
      internalLinksIn: 'Enlaces internos entrantes',
      internalLinksOut: 'Enlaces internos salientes',
      score: 'Puntuación',
      generatedAt: 'Informe generado el',
      noErrors: 'No se detectaron errores',
      noIssues: 'No se detectaron problemas',
      gscVerified: 'Verificado con Google Search Console',
      crawlOnly: 'Basado solo en datos de rastreo',
      pageType: 'Tipo de página',
      depth: 'Profundidad',
      authority: 'Autoridad',
      status: 'Estado',
      url: 'URL',
      linksDistribution: 'Distribución del enlazado',
      avgLinksIn: 'Enlaces entrantes promedio',
      avgLinksOut: 'Enlaces salientes promedio',
      maxDepth: 'Profundidad máxima',
      healthScore: 'Score de salud del enlazado',
    },
  };
  return t[lang] || t.fr;
}

async function fetchCrawlStats(trackedSiteId: string, domain: string, userId: string): Promise<CrawlStats & { hasGsc: boolean }> {
  // Get crawl pages
  const { data: crawls } = await supabase
    .from('site_crawls' as any)
    .select('id')
    .eq('domain', domain)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  let totalPages = 0;
  let indexedPages = 0;
  let noindexPages = 0;
  const errorPages: { url: string; status: number; title?: string }[] = [];

  if (crawls?.[0]) {
    const crawlId = (crawls[0] as any).id;
    const { data: pages } = await supabase
      .from('crawl_pages')
      .select('url, title, http_status, is_indexable, has_noindex')
      .eq('crawl_id', crawlId)
      .limit(1000);

    if (pages) {
      totalPages = pages.length;
      for (const p of pages) {
        if (p.http_status && (p.http_status >= 400)) {
          errorPages.push({ url: p.url, status: p.http_status, title: p.title || undefined });
        }
        if (p.is_indexable && !p.has_noindex) {
          indexedPages++;
        } else {
          noindexPages++;
        }
      }
    }
  }

  // Check if GSC is connected
  const { data: gscData } = await supabase
    .from('gsc_history_log')
    .select('id')
    .eq('tracked_site_id', trackedSiteId)
    .limit(1);

  const hasGsc = (gscData?.length || 0) > 0;

  // If GSC connected, try to get indexed counts from crawl_index_history
  if (hasGsc) {
    const { data: indexHistory } = await supabase
      .from('crawl_index_history')
      .select('total_pages, indexed_count, noindex_count, gsc_indexed_count')
      .eq('tracked_site_id', trackedSiteId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (indexHistory?.[0]) {
      const h = indexHistory[0];
      if (h.gsc_indexed_count != null) {
        indexedPages = h.gsc_indexed_count;
        noindexPages = (h.total_pages || totalPages) - indexedPages;
        totalPages = h.total_pages || totalPages;
      }
    }
  }

  return { totalPages, indexedPages, noindexPages, errorPages, hasGsc };
}

function analyzeNodes(nodes: any[], lang: string) {
  const t = getTranslations(lang);

  // Find issues
  const cannibalizationIssues = nodes
    .filter(n => n.cannibalization_risk > 0.5)
    .sort((a, b) => b.cannibalization_risk - a.cannibalization_risk);

  const contentGapIssues = nodes
    .filter(n => n.content_gap_score > 0.5)
    .sort((a, b) => b.content_gap_score - a.content_gap_score);

  const orphanPages = nodes.filter(n => n.internal_links_in === 0 && n.page_type !== 'homepage');

  const weakLinkingPages = nodes.filter(n => n.internal_links_in < 3 && n.internal_links_in > 0 && n.page_type !== 'homepage');

  // Stats
  const avgLinksIn = nodes.length > 0 ? (nodes.reduce((s, n) => s + n.internal_links_in, 0) / nodes.length) : 0;
  const avgLinksOut = nodes.length > 0 ? (nodes.reduce((s, n) => s + n.internal_links_out, 0) / nodes.length) : 0;
  const maxDepth = Math.max(0, ...nodes.map(n => n.crawl_depth ?? n.depth ?? 0));

  // Health score (0-100)
  const orphanPenalty = Math.min(30, orphanPages.length * 5);
  const cannibPenalty = Math.min(25, cannibalizationIssues.length * 3);
  const depthPenalty = maxDepth > 4 ? Math.min(15, (maxDepth - 4) * 5) : 0;
  const weakPenalty = Math.min(15, weakLinkingPages.length * 2);
  const gapPenalty = Math.min(15, contentGapIssues.length * 2);
  const healthScore = Math.max(0, 100 - orphanPenalty - cannibPenalty - depthPenalty - weakPenalty - gapPenalty);

  // Generate corrective actions
  interface Action { priority: string; page: string; issue: string; recommendation: string }
  const actions: Action[] = [];

  for (const n of orphanPages.slice(0, 10)) {
    actions.push({
      priority: t.critical,
      page: n.title || n.url,
      issue: t.orphanPages,
      recommendation: lang === 'fr'
        ? `Ajouter au moins 3 liens internes pointant vers cette page depuis des pages thématiquement proches.`
        : lang === 'es'
          ? `Añadir al menos 3 enlaces internos apuntando a esta página desde páginas temáticamente cercanas.`
          : `Add at least 3 internal links pointing to this page from thematically related pages.`,
    });
  }

  for (const n of cannibalizationIssues.slice(0, 10)) {
    actions.push({
      priority: t.high,
      page: n.title || n.url,
      issue: `${t.cannibalization} (${Math.round(n.cannibalization_risk * 100)}%)`,
      recommendation: lang === 'fr'
        ? `Fusionner ou différencier le contenu de cette page par rapport aux pages similaires. Utiliser une balise canonical si nécessaire.`
        : lang === 'es'
          ? `Fusionar o diferenciar el contenido de esta página respecto a las páginas similares. Usar una etiqueta canonical si es necesario.`
          : `Merge or differentiate this page's content from similar pages. Use a canonical tag if needed.`,
    });
  }

  for (const n of contentGapIssues.slice(0, 10)) {
    actions.push({
      priority: t.medium,
      page: n.title || n.url,
      issue: `${t.contentGaps} (${Math.round(n.content_gap_score * 100)}%)`,
      recommendation: lang === 'fr'
        ? `Enrichir le contenu de cette page pour couvrir les requêtes manquantes identifiées dans le cluster sémantique.`
        : lang === 'es'
          ? `Enriquecer el contenido de esta página para cubrir las consultas faltantes identificadas en el cluster semántico.`
          : `Enrich this page's content to cover missing queries identified in the semantic cluster.`,
    });
  }

  for (const n of weakLinkingPages.slice(0, 10)) {
    actions.push({
      priority: t.low,
      page: n.title || n.url,
      issue: `${t.weakLinking} (${n.internal_links_in} ${t.internalLinksIn})`,
      recommendation: lang === 'fr'
        ? `Renforcer le maillage en ajoutant des liens contextuels depuis les pages de même cluster ou de cluster parent.`
        : lang === 'es'
          ? `Reforzar el enlazado añadiendo enlaces contextuales desde las páginas del mismo cluster o cluster padre.`
          : `Strengthen linking by adding contextual links from pages in the same or parent cluster.`,
    });
  }

  // Sort by priority
  const priorityOrder: Record<string, number> = {};
  priorityOrder[t.critical] = 0;
  priorityOrder[t.high] = 1;
  priorityOrder[t.medium] = 2;
  priorityOrder[t.low] = 3;
  actions.sort((a, b) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4));

  return {
    cannibalizationIssues,
    contentGapIssues,
    orphanPages,
    weakLinkingPages,
    avgLinksIn,
    avgLinksOut,
    maxDepth,
    healthScore,
    actions,
  };
}

function getPriorityColor(priority: string, t: Record<string, string>): string {
  if (priority === t.critical) return '#ef4444';
  if (priority === t.high) return '#f97316';
  if (priority === t.medium) return '#eab308';
  return '#22c55e';
}

function getHealthColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#eab308';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}

export async function generateCocoonReport(data: CocoonReportData): Promise<void> {
  const { nodes, domain, siteName, trackedSiteId, userId, language, branding } = data;
  const t = getTranslations(language);
  const now = new Date().toLocaleString(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US');

  // Fetch crawl stats
  const crawlStats = await fetchCrawlStats(trackedSiteId, domain, userId);

  // Analyze nodes
  const analysis = analyzeNodes(nodes, language);

  // Find homepage
  const homeNode = nodes.find(n => n.page_type === 'homepage') || nodes[0];
  const homeUrl = homeNode?.url || `https://${domain}`;

  // Branding
  const primaryColor = branding?.primaryColor || '#6d28d9';
  const brandName = branding?.brandName || 'Crawlers AI';
  const fontFamily = branding?.reportFont || 'Inter';
  const hasCustomBranding = !!(branding?.logoUrl || branding?.primaryColor || branding?.brandName);

  const html = `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.reportTitle} — ${siteName || domain}</title>
  <link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: '${fontFamily}', 'Inter', system-ui, sans-serif; background: #f8f9fb; color: #1a1a2e; line-height: 1.6; }
    .container { max-width: 900px; margin: 0 auto; padding: 24px; }
    .header { background: linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd); color: white; padding: 32px 40px; border-radius: 16px 16px 0 0; }
    .header-logo { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .header-logo img { max-height: 36px; }
    .header h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    .header .date { font-size: 12px; opacity: 0.8; }
    .section { background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px 28px; margin-top: 20px; }
    .section-title { font-size: 16px; font-weight: 700; color: ${primaryColor}; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
    .section-title::before { content: ''; display: inline-block; width: 4px; height: 20px; background: ${primaryColor}; border-radius: 2px; }
    .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
    .stat-card { background: #f8f9fb; border-radius: 10px; padding: 16px; text-align: center; border: 1px solid #e5e7eb; }
    .stat-value { font-size: 28px; font-weight: 700; color: ${primaryColor}; }
    .stat-label { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .health-bar { height: 10px; background: #e5e7eb; border-radius: 5px; overflow: hidden; margin-top: 8px; }
    .health-fill { height: 100%; border-radius: 5px; transition: width 0.5s; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f8f9fb; padding: 10px 12px; text-align: left; font-weight: 600; color: #4b5563; border-bottom: 2px solid #e5e7eb; }
    td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    tr:hover td { background: #f8f9fb; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; color: white; }
    .issue-count { font-size: 14px; font-weight: 600; }
    .issue-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
    .issue-row:last-child { border: none; }
    .truncate { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .footer { padding: 24px 40px; text-align: center; background: linear-gradient(135deg, ${primaryColor}15, ${primaryColor}08); border-radius: 0 0 16px 16px; border: 1px solid #e5e7eb; border-top: none; margin-top: -1px; }
    .footer-brand { font-size: 12px; color: #6b7280; }
    .gsc-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 600; margin-left: 8px; }
    .gsc-verified { background: #dcfce7; color: #166534; }
    .gsc-crawl { background: #fef3c7; color: #92400e; }
    .custom-text { font-size: 13px; color: #4b5563; padding: 16px 20px; background: ${primaryColor}08; border-left: 3px solid ${primaryColor}40; border-radius: 0 8px 8px 0; margin: 12px 0; }
    @media print { body { background: white; } .container { padding: 0; } .section { break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="header-logo">
        ${branding?.logoUrl ? `<img src="${branding.logoUrl}" alt="${escapeHtml(brandName)}" />` : ''}
        <span style="font-size: 18px; font-weight: 700;">${escapeHtml(brandName)}</span>
      </div>
      <h1>${escapeHtml(t.reportTitle)}</h1>
      <div class="date">${t.generatedAt} ${now}</div>
    </div>

    ${branding?.reportHeaderText ? `<div class="section"><div class="custom-text">${escapeHtml(branding.reportHeaderText)}</div></div>` : ''}

    <!-- Site Identity -->
    <div class="section">
      <div class="section-title">${escapeHtml(t.siteIdentity)}</div>
      <div class="stat-grid">
        <div class="stat-card">
          <div style="font-size: 15px; font-weight: 600; color: #1a1a2e;">${escapeHtml(siteName || domain)}</div>
          <div class="stat-label">${escapeHtml(t.siteName)}</div>
        </div>
        <div class="stat-card">
          <div style="font-size: 12px; font-weight: 500; color: ${primaryColor}; word-break: break-all;">${escapeHtml(homeUrl)}</div>
          <div class="stat-label">${escapeHtml(t.homeUrl)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${crawlStats.totalPages}</div>
          <div class="stat-label">${escapeHtml(t.totalPages)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: #22c55e;">${crawlStats.indexedPages}</div>
          <div class="stat-label">${escapeHtml(t.indexedPages)} <span class="gsc-badge ${crawlStats.hasGsc ? 'gsc-verified' : 'gsc-crawl'}">${crawlStats.hasGsc ? '✓ GSC' : '○ Crawl'}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: #ef4444;">${crawlStats.noindexPages}</div>
          <div class="stat-label">${escapeHtml(t.noindexPages)}</div>
        </div>
      </div>
    </div>

    <!-- Health Score -->
    <div class="section">
      <div class="section-title">${escapeHtml(t.healthScore)}</div>
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="font-size: 48px; font-weight: 800; color: ${getHealthColor(analysis.healthScore)};">${analysis.healthScore}<span style="font-size: 20px; color: #9ca3af;">/100</span></div>
        <div style="flex: 1;">
          <div class="health-bar"><div class="health-fill" style="width: ${analysis.healthScore}%; background: ${getHealthColor(analysis.healthScore)};"></div></div>
          <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px; color: #6b7280;">
            <span>${t.avgLinksIn}: <strong>${analysis.avgLinksIn.toFixed(1)}</strong></span>
            <span>${t.avgLinksOut}: <strong>${analysis.avgLinksOut.toFixed(1)}</strong></span>
            <span>${t.maxDepth}: <strong>${analysis.maxDepth}</strong></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Structural Issues -->
    <div class="section">
      <div class="section-title">${escapeHtml(t.structuralIssues)}</div>
      <div class="stat-grid" style="grid-template-columns: repeat(4, 1fr);">
        <div class="stat-card">
          <div class="issue-count" style="color: #ef4444;">${analysis.cannibalizationIssues.length}</div>
          <div class="stat-label">${escapeHtml(t.cannibalization)}</div>
        </div>
        <div class="stat-card">
          <div class="issue-count" style="color: #f97316;">${analysis.contentGapIssues.length}</div>
          <div class="stat-label">${escapeHtml(t.contentGaps)}</div>
        </div>
        <div class="stat-card">
          <div class="issue-count" style="color: #ef4444;">${analysis.orphanPages.length}</div>
          <div class="stat-label">${escapeHtml(t.orphanPages)}</div>
        </div>
        <div class="stat-card">
          <div class="issue-count" style="color: #eab308;">${analysis.weakLinkingPages.length}</div>
          <div class="stat-label">${escapeHtml(t.weakLinking)}</div>
        </div>
      </div>
    </div>

    <!-- Error Pages -->
    <div class="section">
      <div class="section-title">${escapeHtml(t.errorPages)}</div>
      ${crawlStats.errorPages.length === 0
        ? `<p style="color: #22c55e; font-weight: 500;">✓ ${escapeHtml(t.noErrors)}</p>`
        : `<table>
          <thead><tr><th>${t.url}</th><th>${t.status}</th><th>Title</th></tr></thead>
          <tbody>
            ${crawlStats.errorPages.slice(0, 30).map(p => `
              <tr>
                <td class="truncate" title="${escapeHtml(p.url)}">${escapeHtml(p.url)}</td>
                <td><span class="badge" style="background: ${p.status >= 500 ? '#ef4444' : '#f97316'};">${p.status}</span></td>
                <td>${escapeHtml(p.title || '—')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>`
      }
    </div>

    <!-- Corrective Actions -->
    <div class="section">
      <div class="section-title">${escapeHtml(t.correctiveActions)}</div>
      ${analysis.actions.length === 0
        ? `<p style="color: #22c55e; font-weight: 500;">✓ ${escapeHtml(t.noIssues)}</p>`
        : `<table>
          <thead><tr><th>${t.priority}</th><th>${t.page}</th><th>${t.issue}</th><th>${t.recommendation}</th></tr></thead>
          <tbody>
            ${analysis.actions.slice(0, 30).map(a => `
              <tr>
                <td><span class="badge" style="background: ${getPriorityColor(a.priority, t)};">${escapeHtml(a.priority)}</span></td>
                <td class="truncate" style="max-width: 180px;" title="${escapeHtml(a.page)}">${escapeHtml(a.page)}</td>
                <td style="font-size: 12px;">${escapeHtml(a.issue)}</td>
                <td style="font-size: 12px;">${escapeHtml(a.recommendation)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>`
      }
    </div>

    ${branding?.reportFooterText ? `<div class="section"><div class="custom-text">${escapeHtml(branding.reportFooterText)}</div></div>` : ''}

    <!-- Footer -->
    <div class="footer">
      ${branding?.logoUrl ? `<img src="${branding.logoUrl}" alt="${escapeHtml(brandName)}" style="max-height: 24px; margin-bottom: 8px;" />` : ''}
      <div class="footer-brand">
        ${hasCustomBranding ? escapeHtml(brandName) : `Powered by ${escapeHtml(brandName)}`}
        ${branding?.contactEmail ? ` — ${escapeHtml(branding.contactEmail)}` : ''}
        ${branding?.contactPhone ? ` — ${escapeHtml(branding.contactPhone)}` : ''}
      </div>
      ${!hasCustomBranding ? `<div style="margin-top: 8px; font-size: 11px; color: #9ca3af;">crawlers.fr</div>` : ''}
    </div>
  </div>
</body>
</html>`;

  // Open in new tab
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  // Clean up after a delay
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
