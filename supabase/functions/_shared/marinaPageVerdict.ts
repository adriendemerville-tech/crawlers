/**
 * marinaPageVerdict.ts — Conclusion intermédiaire PROPRE À CHAQUE URL.
 *
 * Contrat (fusion multipages) :
 *   - Le crawl, le cocon global, l'indexation et la visibilité IA sont mutualisés
 *     au niveau du domaine (data-marina-scope="site").
 *   - Le score SEO technique, le score GEO et les recommandations de cocon
 *     applicables à la page sont PROPRES À L'URL (data-marina-scope="page").
 *   - Chaque fiche d'URL débute par une conclusion intermédiaire spécifique,
 *     qui porte aussi ses métriques en `data-marina-page-meta` (JSON encodé)
 *     afin que la synthèse exécutive du document fusionné puisse les agréger
 *     sans recalcul ni appel LLM.
 *
 * 100 % déterministe : 0 token LLM.
 */

export interface PageVerdictMeta {
  url: string;
  path: string;
  tech: number | null;
  geo: number | null;
  global: number | null;
  band: 'strong' | 'ok' | 'weak' | 'critical' | 'unknown';
  headline: string;
  cluster?: string | null;
  linksIn?: number | null;
  linksOut?: number | null;
  criticalCount?: number;
  actions: string[];
  /** Faits mesurés remontés pour la synthèse réseau des rapports multipages. */
  words?: number | null;
  lcpMs?: number | null;
  isThin?: boolean;
  isOrphan?: boolean;
  cannibalWith?: string[];
  /**
   * Cibles internes RÉELLES de cette page (chemins), issues des arêtes du cocon.
   * Permet à la synthèse réseau de MESURER si les URLs auditées se lient entre
   * elles, au lieu de le déduire d'un compteur de liens entrants.
   */
  internalTargets?: string[];
  /**
   * Quasi-doublons MESURÉS (SimHash/LSH du module d'intégrité) impliquant cette
   * URL — indépendant de la morphologie des slugs.
   */
  nearDup?: Array<{ url: string; similarity: number; verdict: string }>;
  /** Score de minceur mesuré (0-100) si cette URL est remontée en contenu pauvre. */
  thinScore?: number | null;
}

function pathOf(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.pathname === '/' ? '/' : u.pathname.replace(/\/$/, '');
  } catch {
    return url;
  }
}

/** Clé de comparaison d'URL : protocole, www et slash final neutralisés. */
export function pageKey(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '') || '/'}`.toLowerCase();
  } catch {
    return String(url).toLowerCase();
  }
}

function esc(v: string): string {
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function band(score: number | null): PageVerdictMeta['band'] {
  if (score === null) return 'unknown';
  return score >= 75 ? 'strong' : score >= 55 ? 'ok' : score >= 35 ? 'weak' : 'critical';
}

const BAND_LABEL: Record<PageVerdictMeta['band'], { fr: string; color: string }> = {
  strong: { fr: 'Page solide', color: '#15803d' },
  ok: { fr: 'Page fonctionnelle mais incomplète', color: '#b45309' },
  weak: { fr: 'Page insuffisante', color: '#c2410c' },
  critical: { fr: 'Page en défaut critique', color: '#b91c1c' },
  unknown: { fr: 'Page non consolidée', color: '#6b7280' },
};

interface CocoonPageFacts {
  cluster: string | null;
  linksIn: number | null;
  linksOut: number | null;
  isOrphan: boolean;
  isThin: boolean;
  cannibalWith: string[];
  suggestedLinks: string[];
  geoScore: number | null;
  /** Chemins des cibles internes réellement liées depuis cette page. */
  outTargets: string[];
}

/**
 * Extraction des faits de cocon qui concernent EXACTEMENT l'URL auditée
 * (et non le domaine) à partir du snapshot cocoon partagé.
 */
export function extractCocoonPageFacts(cocoonData: any, url: string): CocoonPageFacts {
  const key = pageKey(url);
  const nodes: any[] = cocoonData?.nodes || cocoonData?.nodes_snapshot || [];
  const edges: any[] = cocoonData?.edges || cocoonData?.edges_snapshot || [];
  const details = cocoonData?.graph_details || {};

  const node = nodes.find((n) => n?.url && pageKey(String(n.url)) === key) || null;

  const linksOut = edges.filter((e) => e?.source && pageKey(String(e.source)) === key);
  const linksIn = edges.filter((e) => e?.target && pageKey(String(e.target)) === key);

  const orphan = (details?.orphan_pages || []).some((p: any) => p?.url && pageKey(String(p.url)) === key);
  const thin = (details?.thin_content_pages || []).some((p: any) => p?.url && pageKey(String(p.url)) === key);

  const cannibalWith: string[] = [];
  for (const risk of details?.cannibalization_risks || []) {
    const urls: string[] = (risk?.urls || risk?.pages || []).map((u: any) => String(u?.url || u));
    if (urls.some((u) => pageKey(u) === key)) {
      for (const u of urls) if (pageKey(u) !== key) cannibalWith.push(u);
    }
  }

  // Liens suggérés : voisins sémantiques les plus proches non encore liés.
  const linkedKeys = new Set(linksOut.map((e) => pageKey(String(e.target))));
  const suggestedLinks = (node?.similarity_edges || [])
    .filter((e: any) => e?.target_url && !linkedKeys.has(pageKey(String(e.target_url))))
    .sort((a: any, b: any) => Number(b?.score || 0) - Number(a?.score || 0))
    .slice(0, 3)
    .map((e: any) => String(e.target_url));

  return {
    cluster: node?.cluster_id || node?.cluster || null,
    linksIn: linksIn.length || (node?.internal_links_in ?? null),
    linksOut: linksOut.length || (node?.internal_links_out ?? null),
    isOrphan: orphan || (Number(node?.internal_links_in ?? 1) === 0),
    isThin: thin,
    cannibalWith: cannibalWith.slice(0, 4),
    suggestedLinks,
    outTargets: [...new Set(linksOut.map((e) => pathOf(String(e.target))))].slice(0, 60),
    geoScore: node?.geo_score != null ? Math.round(Number(node.geo_score)) : null,
  };
}

/**
 * Bloc « Cocon — ce que cette page doit corriger » : périmètre PAGE, recommandations
 * dérivées de la position réelle de l'URL dans le graphe du site.
 */
export function buildCocoonPageFocusHTML(cocoonData: any, url: string, lang = 'fr'): string {
  const f = extractCocoonPageFacts(cocoonData, url);
  const has = f.cluster || f.linksIn !== null || f.linksOut !== null || f.cannibalWith.length || f.suggestedLinks.length;
  if (!has) return '';
  const isEn = lang === 'en';
  const t = (fr: string, en: string) => (isEn ? en : fr);

  const recos: string[] = [];
  if (f.isOrphan) {
    recos.push(t(
      `Cette page ne reçoit aucun lien interne : elle est orpheline. Ajoutez au moins deux liens entrants depuis des pages de son cluster.`,
      `This page receives no internal link: add at least two inbound links from pages in its cluster.`,
    ));
  } else if ((f.linksIn ?? 0) <= 2) {
    recos.push(t(
      `Seulement ${f.linksIn} lien(s) interne(s) entrant(s) : renforcez le maillage entrant pour transmettre de l'autorité à cette URL.`,
      `Only ${f.linksIn} inbound internal link(s): reinforce inbound linking to pass authority to this URL.`,
    ));
  }
  if ((f.linksOut ?? 0) <= 2) {
    recos.push(t(
      `Peu de liens sortants internes (${f.linksOut ?? 0}) : reliez cette page aux contenus proches pour clarifier son cluster.`,
      `Few internal outbound links (${f.linksOut ?? 0}): link this page to its closest content to clarify its cluster.`,
    ));
  }
  if (f.isThin) {
    recos.push(t(
      `Contenu jugé fin sur cette URL : elle a besoin d'un apport de contenu propre avant tout travail de maillage.`,
      `Thin content on this URL: it needs its own content before any linking work.`,
    ));
  }
  if (f.cannibalWith.length) {
    recos.push(t(
      `Cette page entre en concurrence avec : ${f.cannibalWith.map(esc).join(', ')}. Désignez une page pivot pour l'intention visée et redirigez ou différenciez les autres.`,
      `This page competes with: ${f.cannibalWith.map(esc).join(', ')}. Designate one pivot page for the intent and differentiate or redirect the others.`,
    ));
  }
  if (f.suggestedLinks.length) {
    recos.push(t(
      `Liens internes à ajouter en priorité depuis cette page : ${f.suggestedLinks.map(esc).join(', ')}.`,
      `Internal links to add from this page first: ${f.suggestedLinks.map(esc).join(', ')}.`,
    ));
  }
  if (!recos.length) {
    recos.push(t(
      `Aucun défaut de maillage détecté sur cette URL : son intégration dans le cocon est conforme.`,
      `No linking defect detected on this URL: its integration in the cocoon is compliant.`,
    ));
  }

  const facts = [
    f.cluster ? `${t('Cluster', 'Cluster')} : ${esc(String(f.cluster))}` : '',
    f.linksIn !== null ? `${t('Liens entrants', 'Inbound links')} : ${f.linksIn}` : '',
    f.linksOut !== null ? `${t('Liens sortants', 'Outbound links')} : ${f.linksOut}` : '',
    f.geoScore !== null ? `${t('GEO de la page', 'Page GEO')} : ${f.geoScore}/100` : '',
  ].filter(Boolean);

  return `
  <div class="section" data-marina-scope="page" data-marina-block="cocoon_page" data-pdf-section style="border-left:6px solid #6d28d9;">
    <h2 style="font-size:18px;margin:0 0 6px 0;">${t('Cocon sémantique — ce que cette page doit corriger', 'Semantic cocoon — what this page must fix')}</h2>
    <p style="font-size:13px;color:#6b7280;line-height:1.7;margin:0 0 10px 0;">
      ${t(
        `Le graphe du site est calculé une seule fois pour le domaine ; cette sous-section n'en retient que la position et les correctifs de maillage de cette URL précise.`,
        `The site graph is computed once for the domain; this sub-section only keeps this specific URL's position and linking fixes.`,
      )}
    </p>
    ${facts.length ? `<p style="font-size:13px;color:#374151;margin:0 0 10px 0;">${facts.join(' · ')}</p>` : ''}
    <ul style="padding-left:20px;font-size:13px;color:#374151;line-height:1.75;margin:0;">
      ${recos.map((r) => `<li style="margin:0 0 6px 0;">${r}</li>`).join('')}
    </ul>
  </div>`;
}

/**
 * Conclusion intermédiaire d'URL, en TÊTE de la partie qui concerne cette URL.
 * Porte ses métriques en `data-marina-page-meta` pour la synthèse fusionnée.
 */
export function buildPageVerdictHTML(
  lang: string,
  domain: string,
  url: string,
  ctx: {
    techScore: number | null;
    geoScore: number | null;
    criticalCount?: number;
    pageActions?: Array<{ severity?: string; title: string }>;
    cocoonData?: any;
    /** Faits mesurés sur cette URL, propagés à la synthèse réseau multipages. */
    words?: number | null;
    lcpMs?: number | null;
    /** Résumé d'intégrité du contenu (quasi-doublons et pages pauvres mesurés). */
    integrity?: any;
  },
): { html: string; meta: PageVerdictMeta } {
  const isEn = lang === 'en';
  const t = (fr: string, en: string) => (isEn ? en : fr);

  const tech = ctx.techScore != null && ctx.techScore > 0 ? Math.round(ctx.techScore) : null;
  const geo = ctx.geoScore != null && ctx.geoScore > 0 ? Math.round(ctx.geoScore) : null;
  const scores = [tech, geo].filter((v): v is number => typeof v === 'number');
  const global = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  const critical = Number(ctx.criticalCount || 0);
  const raw = band(global);
  const b: PageVerdictMeta['band'] =
    critical > 0 && raw === 'strong' ? 'ok' : critical >= 3 && raw === 'ok' ? 'weak' : raw;

  const f = ctx.cocoonData ? extractCocoonPageFacts(ctx.cocoonData, url) : null;

  const gaps: string[] = [];
  if (tech !== null && tech < 70) gaps.push(t(`conformité technique à reprendre (${tech}/100)`, `technical compliance to fix (${tech}/100)`));
  if (geo !== null && geo < 60) gaps.push(t(`citabilité IA faible (${geo}/100)`, `low AI citability (${geo}/100)`));
  if (f?.isOrphan) gaps.push(t(`page orpheline dans le maillage interne`, `orphan page in internal linking`));
  else if (f && (f.linksIn ?? 9) <= 2) gaps.push(t(`maillage entrant trop faible`, `too few inbound links`));
  if (f?.isThin) gaps.push(t(`contenu trop fin`, `thin content`));
  if (f?.cannibalWith.length) gaps.push(t(`concurrence interne avec ${f.cannibalWith.length} autre(s) page(s)`, `internal competition with ${f.cannibalWith.length} other page(s)`));

  const label = BAND_LABEL[b];
  const headline =
    b === 'unknown'
      ? t(`Les scores de cette URL n'ont pas pu être consolidés : lisez les sections page par page.`,
          `This URL's scores could not be consolidated: read the page sections one by one.`)
      : gaps.length
      ? t(`${label.fr} (${global}/100) : ${gaps.join(', ')}.`,
          `Score ${global}/100 for this URL: ${gaps.join(', ')}.`)
      : t(`${label.fr} (${global}/100) : aucun défaut bloquant propre à cette URL, les gains restants sont d'optimisation.`,
          `Score ${global}/100 for this URL: no blocking defect of its own, remaining gains are optimisation.`);

  const actions = (ctx.pageActions || [])
    .slice(0, 3)
    .map((a) => String(a.title || '').trim())
    .filter(Boolean);

  const meta: PageVerdictMeta = {
    url,
    path: pathOf(url),
    tech,
    geo,
    global,
    band: b,
    headline,
    cluster: f?.cluster ?? null,
    linksIn: f?.linksIn ?? null,
    linksOut: f?.linksOut ?? null,
    criticalCount: critical,
    actions,
    words: ctx.words != null && Number(ctx.words) > 0 ? Math.round(Number(ctx.words)) : null,
    lcpMs: ctx.lcpMs != null && Number(ctx.lcpMs) > 0 ? Math.round(Number(ctx.lcpMs)) : null,
    isThin: f?.isThin ?? false,
    isOrphan: f?.isOrphan ?? false,
    cannibalWith: f?.cannibalWith ?? [],
  };

  const cell = (l: string, v: string) => `
    <div style="flex:1 1 130px;border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;background:#ffffff;">
      <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;margin-bottom:4px;">${l}</div>
      <div style="font-size:19px;font-weight:700;color:#111827;">${v}</div>
    </div>`;

  const html = `
  <div class="section" data-marina-scope="page" data-marina-block="page-verdict" data-pdf-section
       data-marina-page-meta="${encodeURIComponent(JSON.stringify(meta))}"
       style="border-left:6px solid ${label.color};">
    <p style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#6b7280;margin:0 0 4px 0;">
      ${t('Conclusion intermédiaire — cette URL', 'Interim conclusion — this URL')}
    </p>
    <h2 style="font-size:19px;margin:0 0 4px 0;">${esc(pathOf(url))}</h2>
    <p style="font-size:12px;color:#6b7280;margin:0 0 10px 0;">${esc(domain)}</p>
    <p style="font-size:14px;line-height:1.75;color:#374151;margin:0 0 12px 0;"><strong>${headline}</strong></p>
    <div style="display:flex;flex-wrap:wrap;gap:10px;">
      ${cell(t('Score de la page', 'Page score'), global === null ? 'n/d' : `${global}/100`)}
      ${cell(t('SEO technique', 'Technical SEO'), tech === null ? 'n/d' : `${tech}/100`)}
      ${cell(t('GEO / citabilité IA', 'GEO / AI citability'), geo === null ? 'n/d' : `${geo}/100`)}
      ${f && f.linksIn !== null ? cell(t('Liens internes entrants', 'Inbound links'), String(f.linksIn)) : ''}
    </div>
    ${actions.length ? `
    <p style="font-size:13px;font-weight:600;color:#111827;margin:14px 0 6px 0;">${t('À corriger sur cette page', 'To fix on this page')}</p>
    <ol style="padding-left:20px;font-size:13px;color:#374151;line-height:1.7;margin:0;">
      ${actions.map((a) => `<li style="margin:0 0 6px 0;">${esc(a)}</li>`).join('')}
    </ol>` : ''}
    <p style="font-size:12px;color:#6b7280;line-height:1.7;margin:12px 0 0 0;">
      ${t(
        `Ces scores sont propres à cette URL et ne sont jamais moyennés avec les autres pages auditées. Les analyses de périmètre site (crawl, cocon global, indexation, visibilité IA) sont présentées une seule fois pour le domaine.`,
        `These scores belong to this URL and are never averaged with the other audited pages. Site-scope analyses are presented once for the domain.`,
      )}
    </p>
  </div>`;

  return { html, meta };
}
