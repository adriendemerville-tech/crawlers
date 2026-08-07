/**
 * auditMethodology.ts — Fiche méthodologique des scores Crawlers.
 *
 * Sert à la skill `compare_methodology` : quand un audit tiers annonce un
 * chiffre différent du nôtre, l'agent doit pouvoir expliquer POURQUOI
 * (périmètre, seuils, source de données) au lieu d'arbitrer au hasard.
 *
 * 0 appel LLM, 0 requête DB : contenu statique versionné avec le code.
 */

export interface MethodologyEntry {
  metric: string;
  scale: string;
  source: string;
  perimeter: string;
  thresholds: string;
  known_divergences: string[];
}

export const CRAWLERS_METHODOLOGY: MethodologyEntry[] = [
  {
    metric: 'Score SEO (computeSeoScoreV2)',
    scale: '0-100',
    source: 'Crawl multi-page Crawlers (HTML rendu) + signaux on-page',
    perimeter: 'Pages effectivement crawlées lors du dernier crawl complet, hors URLs bloquées par robots.txt',
    thresholds: 'Pondération title/meta/H1/profondeur/maillage interne/poids de contenu utile',
    known_divergences: [
      "Semrush/Ahrefs notent surtout l'autorité (backlinks) : un score bas chez eux avec un score haut chez nous est cohérent, ce ne sont pas les mêmes axes.",
      "Les outils tiers crawlent souvent le HTML brut : sur un site rendu côté client, ils sous-estiment le contenu que nous voyons.",
    ],
  },
  {
    metric: 'Score GEO / visibilité IA',
    scale: '0-100',
    source: 'Audit stratégique Crawlers (structure de réponse, passages citables, JSON-LD, fan-out) + hits de bots IA vérifiés (rDNS + ASN)',
    perimeter: 'Page auditée + empreinte du domaine sur les requêtes du Keyword Universe',
    thresholds: 'Vérification des bots en 3 niveaux : vérifié / suspect / furtif',
    known_divergences: [
      "La plupart des audits tiers n'ont aucune mesure GEO : une absence de chiffre chez eux n'est pas une contradiction.",
      "Les outils qui déclarent un « score IA » à partir du seul user-agent surestiment le trafic bot (pas de vérification rDNS/ASN).",
    ],
  },
  {
    metric: 'Quasi-doublons (near-duplicate)',
    scale: 'Similarité 0-100 %',
    source: 'SimHash + LSH sur le contenu utile normalisé (boilerplate retiré)',
    perimeter: 'Pages du dernier crawl complet, minimum 2 pages analysées',
    thresholds: 'Seuil de base 45 % ajusté par tolérance sectorielle → verdict cannibalisation / à surveiller / normal',
    known_divergences: [
      "Les outils tiers comparent souvent le HTML complet (menus, footer) : ils remontent des taux de similarité artificiellement hauts.",
      "Un e-commerce a une tolérance sectorielle plus élevée : deux fiches proches ne sont pas une cannibalisation.",
    ],
  },
  {
    metric: 'Contenu pauvre (thin content)',
    scale: 'Thin score 0-100',
    source: 'Comptage des mots utiles (hors navigation/footer/CTA répétés)',
    perimeter: 'Pages du dernier crawl, idéal de longueur par secteur et par type de page',
    thresholds: 'Comparaison à un idéal sectoriel, pas à un seuil absolu de 300 mots',
    known_divergences: [
      "Un seuil fixe « < 300 mots = thin » utilisé par les audits tiers produit des faux positifs sur les pages de contact, tarifs ou catégories.",
    ],
  },
  {
    metric: 'Position / volume de mots-clés',
    scale: 'Position 1-100, volume mensuel',
    source: 'Google Search Console (données propriétaires réelles) + DataForSEO / SerpApi pour le hors-périmètre',
    perimeter: 'GSC = clics et impressions réels du site ; DataForSEO = SERP observée à une date donnée',
    thresholds: 'Position moyenne pondérée par les impressions',
    known_divergences: [
      "Les audits tiers utilisent des positions estimées : un écart de quelques rangs est normal. Nos chiffres GSC sont prioritaires car propriétaires.",
      "Un volume différent vient du fournisseur de données, pas d'une erreur : à documenter, pas à arbitrer.",
    ],
  },
  {
    metric: 'Maillage interne / profondeur',
    scale: 'Nombre de liens, profondeur BFS',
    source: 'Graphe cocoon Crawlers (BFS depuis la home)',
    perimeter: 'Liens internes réellement présents dans le HTML rendu',
    thresholds: 'Orpheline = 0 lien entrant interne ; profondeur > 3 = signal négatif',
    known_divergences: [
      "Les crawlers tiers qui ignorent le rendu JavaScript déclarent des pages orphelines qui ne le sont pas.",
    ],
  },
];

export function methodologyFor(metrics?: string[]): MethodologyEntry[] {
  if (!metrics || metrics.length === 0) return CRAWLERS_METHODOLOGY;
  const needles = metrics.map((m) => m.toLowerCase());
  const matched = CRAWLERS_METHODOLOGY.filter((e) =>
    needles.some((n) => e.metric.toLowerCase().includes(n) || n.includes(e.metric.toLowerCase().split(' ')[0])),
  );
  return matched.length > 0 ? matched : CRAWLERS_METHODOLOGY;
}
