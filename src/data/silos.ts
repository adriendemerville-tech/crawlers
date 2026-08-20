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
    intent: 'référencement IA, GEO, score GEO, visibilité LLM',
    pillar: {
      label: 'Référencement IA & GEO : le guide pilier',
      to: '/generative-engine-optimization',
      note: 'Absorbe score GEO, outil GEO IA, visibilité LLM, optimisation LLM SEO',
    },
    satellites: [
      { label: 'Méthode d’audit SEO GEO', to: '/audit-seo-geo' },
      { label: 'GEO vs SEO : les différences', to: '/geo-vs-seo' },
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
      { label: 'Cocon sémantique 3D', to: '/app/cocoon' },
      { label: 'Modifier le code WordPress', to: '/modifier-code-wordpress' },
    ],
  },
  comparatifs: {
    id: 'comparatifs',
    intent: 'alternative Semrush, alternative Ahrefs, comparatif outil SEO',
    pillar: {
      label: 'Crawlers.fr vs Semrush : comparatif 28 critères',
      to: '/comparatif-crawlers-semrush',
      note: 'Pilier du silo comparatifs',
    },
    satellites: [
      { label: 'Crawlers.fr vs Ahrefs', to: '/comparatif-crawlers-ahrefs' },
      { label: 'Crawlers.fr vs Claude', to: '/comparatif-claude-vs-crawlers' },
      { label: 'Plateformes SEO IA comparées', to: '/comparatif-plateforme-seo-ia' },
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
