/**
 * Cartographie des silos SEO de crawlers.fr (réorganisation post-audit Semrush).
 *
 * Quatre piliers seulement. Toute page satellite doit pointer vers son pilier,
 * et le pilier référence ses satellites — jamais de satellite orphelin, jamais
 * deux pages qui visent la même intention.
 */

export interface SiloLink {
  label: string;
  to: string;
  note?: string;
}

export interface Silo {
  id: 'crawler' | 'geo' | 'outil-crawl' | 'comparatifs';
  /** Intention principale servie par le pilier */
  intent: string;
  pillar: SiloLink;
  satellites: SiloLink[];
}

export const SILOS: Record<Silo['id'], Silo> = {
  crawler: {
    id: 'crawler',
    intent: 'crawler, les crawlers, définition crawler SEO',
    pillar: {
      label: 'Crawler : définition SEO & GEO',
      to: '/blog/crawler-definition-seo-geo',
      note: 'Page de référence du silo « crawler »',
    },
    satellites: [
      { label: 'Analyse des bots IA (GPTBot, PerplexityBot)', to: '/analyse-bots-ia' },
      { label: 'Monitoring GPTBot & Perplexity', to: '/monitoring-gptbot-perplexity' },
      { label: 'Analyse de logs serveur', to: '/analyse-logs' },
    ],
  },
  geo: {
    id: 'geo',
    intent: 'audit SEO GEO, référencement IA, score GEO, visibilité LLM',
    pillar: {
      label: 'Audit GEO SEO : la page de référence',
      to: '/audit-geo-seo',
      note: 'Tête du silo GEO : diagnostic, correctifs, contenus et fiche Google Maps',
    },
    satellites: [
      {
        label: 'Référencement IA & GEO : le guide complet',
        to: '/generative-engine-optimization',
        note: 'Guide éditorial du silo',
      },
      { label: 'Audit GEO gratuit (232 points)', to: '/audit-geo' },
      { label: 'Méthode d’audit SEO GEO', to: '/audit-seo-geo' },
      { label: 'Visibilité IA : mesurer ses citations', to: '/visibilite-ia' },
      { label: 'Audit SEO par IA : ce qui est mesuré', to: '/audit-seo-par-ia' },
      { label: 'SEO avec Claude (MCP)', to: '/seo-avec-claude' },
      { label: 'Serveur MCP GEO : visibilité IA par agent', to: '/geo-mcp-server' },
      { label: 'SEO MCP Server (EN)', to: '/seo-mcp-server' },
      { label: 'E-E-A-T : autorité et citations IA', to: '/eeat' },
      { label: 'Place d’échange de backlinks', to: '/marketplace-backlinks' },
      { label: 'Collaborations Instagram', to: '/collab-instagram' },
      { label: 'Audit gratuit avec Marina', to: '/marina' },
    ],
  },

  'outil-crawl': {
    id: 'outil-crawl',
    intent: 'crawl website, crawl wordpress, site crawler, outil de crawl',
    pillar: {
      label: 'Outil de crawl de site web',
      to: '/crawl',
      note: 'Page produit canonique du crawler multi-pages',
    },
    satellites: [
      { label: 'Audit expert 200+ critères', to: '/audit-expert' },
      { label: 'Cocon sémantique 3D', to: '/features/cocoon' },
      { label: 'API SEO REST : endpoints et tarifs', to: '/api-seo' },
      { label: 'Modifier le code WordPress', to: '/modifier-code-wordpress' },
    ],
  },
  comparatifs: {
    id: 'comparatifs',
    intent:
      'alternative Semrush, alternative Ahrefs, alternative Screaming Frog, comparatif outil SEO',
    pillar: {
      label: 'Crawlers.fr vs Semrush : comparatif 28 critères',
      to: '/comparatif-crawlers-semrush',
      note: 'Pilier du silo comparatifs',
    },
    satellites: [
      { label: 'Crawlers.fr vs Ahrefs', to: '/comparatif-crawlers-ahrefs' },
      { label: 'Crawlers.fr vs Screaming Frog', to: '/comparatif-crawlers-screaming-frog' },
      { label: 'Crawlers.fr vs Claude', to: '/comparatif-claude-vs-crawlers' },
      { label: 'Plateformes SEO IA comparées', to: '/comparatif-plateforme-seo-ia' },
      { label: 'Meilleurs outils SEO GEO 2027', to: '/meilleurs-outils-seo-geo-2027' },
    ],
  },
};

export const SILO_LIST: Silo[] = [
  SILOS.crawler,
  SILOS.geo,
  SILOS['outil-crawl'],
  SILOS.comparatifs,
];

/**
 * Résout le silo auquel appartient un chemin (pilier ou satellite).
 * Retourne undefined pour les pages hors silo — le bloc de maillage
 * n'est alors pas affiché.
 */
export function siloForPath(path: string): Silo | undefined {
  const clean = path === '/' ? '/' : `/${path.replace(/^\/+|\/+$/g, '')}`;
  return SILO_LIST.find(
    (silo) => silo.pillar.to === clean || silo.satellites.some((s) => s.to === clean),
  );
}

/**
 * Rattachement des 27 fiches /lexique/* à un pilier.
 *
 * Ces fiches (180-680 mots) restent des satellites courts : elles ne doivent
 * jamais vivre en circuit fermé entre elles. Chaque fiche remonte donc vers le
 * pilier du silo qui couvre son intention.
 */
const LEXIQUE_CATEGORY_SILO: Record<string, Silo['id']> = {
  'anti-bot': 'crawler',
  architecture: 'outil-crawl',
  'data-ai': 'geo',
  ethics: 'crawler',
};

/** Exceptions par slug, quand la catégorie ne reflète pas l'intention réelle. */
const LEXIQUE_SLUG_SILO: Record<string, Silo['id']> = {
  'crawl-budget': 'outil-crawl',
  'concurrency-control': 'outil-crawl',
  'robots-txt-interpretation': 'crawler',
  'ethical-scraping': 'crawler',
  'marina-prospection': 'geo',
  'observatoire-sectoriel': 'comparatifs',
  'smart-recommendations': 'outil-crawl',
  'fair-use-quotas': 'outil-crawl',
  'roi-retour-investissement': 'comparatifs',
  'cro-conversion-rate-optimization': 'comparatifs',
  'sea-search-engine-advertising': 'comparatifs',
  'ssr-vs-csr': 'crawler',
  'headless-browsing': 'crawler',
  'shadow-dom': 'crawler',
  'dom-parsing': 'crawler',
  'http2-http3': 'outil-crawl',
};

/** Silo de rattachement d'une fiche du lexique. */
export function siloForLexiqueTerm(slug: string, category?: string): Silo['id'] {
  return (
    LEXIQUE_SLUG_SILO[slug] ??
    (category ? LEXIQUE_CATEGORY_SILO[category] : undefined) ??
    'geo'
  );
}
