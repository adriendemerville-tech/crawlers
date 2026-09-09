/**
 * Détection déterministe des pages piliers d'un site cible (aucun LLM, aucun
 * appel réseau) : une page pilière concentre le maillage interne et l'autorité
 * interne, tout en restant proche de la racine.
 *
 * Règles (toutes mesurées sur le crawl en cours) :
 *  - la home n'est jamais un pilier (elle a déjà son propre rendu solaire) ;
 *  - profondeur de crawl <= 2 ;
 *  - liens internes entrants >= max(3, p85 du site) OU autorité interne dans le
 *    top 15 % du site avec au moins 3 liens entrants ;
 *  - un gabarit structurant (catégorie, guide, tarifs, service) abaisse le seuil
 *    au-dessus de la médiane des liens entrants.
 */

export interface PillarCandidate {
  id: string;
  crawl_depth?: number;
  depth?: number;
  page_type?: string;
  page_authority?: number;
  internal_links_in?: number;
}

const STRUCTURAL_TYPES = new Set(['catégorie', 'categorie', 'category', 'guide', 'tarifs', 'service', 'services']);

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function detectPillarPages(nodes: PillarCandidate[], homeId?: string | null): Set<string> {
  const pillars = new Set<string>();
  if (nodes.length < 4) return pillars;

  const linksIn = nodes.map((n) => n.internal_links_in ?? 0).sort((a, b) => a - b);
  const authorities = nodes.map((n) => n.page_authority ?? 0).sort((a, b) => a - b);

  const linksP85 = quantile(linksIn, 0.85);
  const linksMedian = quantile(linksIn, 0.5);
  const authP85 = quantile(authorities, 0.85);

  for (const n of nodes) {
    if (homeId && n.id === homeId) continue;
    const depth = n.crawl_depth ?? n.depth ?? 0;
    if (depth === 0 || depth > 2) continue;

    const links = n.internal_links_in ?? 0;
    const authority = n.page_authority ?? 0;
    const type = (n.page_type || '').toLowerCase();
    const structural = STRUCTURAL_TYPES.has(type);

    const strongLinks = links >= Math.max(3, linksP85);
    const strongAuthority = authority > 0 && authority >= authP85 && links >= 3;
    const structuralHub = structural && links > linksMedian && links >= 2;

    if (strongLinks || strongAuthority || structuralHub) pillars.add(n.id);
  }

  return pillars;
}
