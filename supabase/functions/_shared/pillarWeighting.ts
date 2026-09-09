/**
 * pillarWeighting.ts — Pondération des pages piliers (workbench + maillage).
 *
 * Une page pilier concentre le maillage interne et l'autorité interne tout en
 * restant proche de la racine : un correctif appliqué sur un pilier se propage
 * à tous ses satellites. Elle doit donc passer devant, mais sans écraser la
 * file d'actions — d'où un plafond dur.
 *
 * 100 % déterministe : aucun LLM, aucun coût token.
 * Les seuils de détection sont alignés sur src/lib/cocoon/pillarPages.ts
 * (mêmes règles : home exclue, profondeur <= 2, p85 des liens entrants,
 * top 15 % d'autorité interne, gabarits structurants).
 */

/** Boost de base d'un finding / lien touchant un pilier. */
export const PILLAR_BOOST = 1.3;
/** Boost renforcé : pilier également à fort trafic ou forte autorité interne. */
export const PILLAR_STRONG_BOOST = 1.5;
/** Plafond dur du cumul, sinon les piliers monopoliseraient la file. */
export const PILLAR_BOOST_CAP = 1.8;
/** Malus appliqué à un lien qui sort du silo. */
export const CROSS_SILO_MALUS = 0.7;
/** Deux piliers au-dessus de ce Jaccard d'intention = alerte forte. */
export const PILLAR_CANNIB_JACCARD = 0.6;

export interface PillarNode {
  url: string;
  crawl_depth?: number | null;
  depth?: number | null;
  page_type?: string | null;
  page_authority?: number | null;
  internal_links_in?: number | null;
  traffic_estimate?: number | null;
}

const STRUCTURAL_TYPES = new Set([
  'catégorie', 'categorie', 'category', 'guide', 'tarifs', 'service', 'services',
]);

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function normUrl(u: string): string {
  try {
    const p = new URL(u);
    return `${p.origin}${p.pathname.replace(/\/$/, '') || '/'}`;
  } catch {
    return String(u || '').replace(/\/$/, '');
  }
}

export interface PillarSet {
  /** URLs normalisées des piliers. */
  urls: Set<string>;
  /** Sous-ensemble à fort trafic / forte autorité → boost renforcé. */
  strong: Set<string>;
}

/** Détection déterministe des piliers dans un ensemble de nœuds mesurés. */
export function detectPillars(nodes: PillarNode[]): PillarSet {
  const urls = new Set<string>();
  const strong = new Set<string>();
  if (!Array.isArray(nodes) || nodes.length < 4) return { urls, strong };

  const linksIn = nodes.map((n) => Number(n.internal_links_in ?? 0)).sort((a, b) => a - b);
  const authorities = nodes.map((n) => Number(n.page_authority ?? 0)).sort((a, b) => a - b);
  const traffic = nodes.map((n) => Number(n.traffic_estimate ?? 0)).sort((a, b) => a - b);

  const linksP85 = quantile(linksIn, 0.85);
  const linksMedian = quantile(linksIn, 0.5);
  const authP85 = quantile(authorities, 0.85);
  const trafficP85 = quantile(traffic, 0.85);

  for (const n of nodes) {
    const depth = Number(n.crawl_depth ?? n.depth ?? 0);
    if (depth === 0 || depth > 2) continue;

    const links = Number(n.internal_links_in ?? 0);
    const authority = Number(n.page_authority ?? 0);
    const type = String(n.page_type || '').toLowerCase();
    const structural = STRUCTURAL_TYPES.has(type);

    const strongLinks = links >= Math.max(3, linksP85);
    const strongAuthority = authority > 0 && authority >= authP85 && links >= 3;
    const structuralHub = structural && links > linksMedian && links >= 2;
    if (!(strongLinks || strongAuthority || structuralHub)) continue;

    const key = normUrl(n.url);
    if (!key || key.endsWith('://') ) continue;
    urls.add(key);

    const highTraffic = trafficP85 > 0 && Number(n.traffic_estimate ?? 0) >= trafficP85;
    if (highTraffic || strongAuthority) strong.add(key);
  }
  return { urls, strong };
}

/** Un pilier ? un pilier à forte valeur ? → multiplicateur plafonné. */
export function pillarPriorityMultiplier(opts: {
  isPillar?: boolean;
  highValue?: boolean;
}): number {
  if (!opts.isPillar) return 1;
  const m = opts.highValue ? PILLAR_STRONG_BOOST : PILLAR_BOOST;
  return Math.min(PILLAR_BOOST_CAP, m);
}

/** Priorité d'un lien recommandé : satellite → pilier devant, hors-silo pénalisé. */
export function linkPriorityMultiplier(opts: {
  targetIsPillar?: boolean;
  sourceIsPillar?: boolean;
  crossSilo?: boolean;
}): number {
  let m = 1;
  if (opts.targetIsPillar && !opts.sourceIsPillar) m *= PILLAR_BOOST;
  else if (opts.sourceIsPillar && opts.targetIsPillar) m *= 1; // pilier ↔ pilier : neutre
  else if (opts.sourceIsPillar) m *= PILLAR_BOOST; // pilier → satellite clé
  if (opts.crossSilo) m *= CROSS_SILO_MALUS;
  return Math.min(PILLAR_BOOST_CAP, Math.round(m * 100) / 100);
}

/** Deux piliers sur la même intention : alerte forte, pas simple avertissement. */
export function isPillarCannibalization(jaccardScore: number): boolean {
  return Number.isFinite(jaccardScore) && jaccardScore > PILLAR_CANNIB_JACCARD;
}

export function isPillarUrl(pillars: PillarSet | null | undefined, url?: string | null): boolean {
  if (!pillars || !url) return false;
  return pillars.urls.has(normUrl(url));
}

export function isStrongPillarUrl(pillars: PillarSet | null | undefined, url?: string | null): boolean {
  if (!pillars || !url) return false;
  return pillars.strong.has(normUrl(url));
}

/**
 * Résout les piliers d'un site depuis semantic_nodes (dernier état du cocon).
 * Une seule requête, colonnes minimales. Ne lève jamais.
 */
export async function resolvePillarSet(
  sb: any,
  trackedSiteId: string | null | undefined,
): Promise<PillarSet> {
  const empty: PillarSet = { urls: new Set(), strong: new Set() };
  try {
    if (!sb || !trackedSiteId) return empty;
    const { data, error } = await sb
      .from('semantic_nodes')
      .select('url, crawl_depth, depth, page_type, page_authority, internal_links_in, traffic_estimate')
      .eq('tracked_site_id', trackedSiteId)
      .limit(2000);
    if (error || !Array.isArray(data)) return empty;
    return detectPillars(data as PillarNode[]);
  } catch {
    return empty;
  }
}

export { normUrl as normalizePillarUrl };
