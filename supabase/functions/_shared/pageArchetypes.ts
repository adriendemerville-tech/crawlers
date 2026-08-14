/**
 * Page Archetypes — segmentation d'un crawl en « types de pages » (agence, produit,
 * avis, service, blog, conversion, institutionnel…), notation par type, conclusion
 * intermédiaire par type puis synthèse business globale.
 *
 * 100 % déterministe : aucun appel LLM, aucun token consommé.
 * Consommé par Marina (section « Audit par type de page ») et réutilisable par
 * Parménion / Stratège cocoon via le même objet ArchetypeAnalysis.
 */

export interface ArchetypePageInput {
  url: string;
  path?: string | null;
  title?: string | null;
  meta_description?: string | null;
  h1?: string | null;
  word_count?: number | null;
  internal_links?: number | null;
  seo_score?: number | null;
  thin_score?: number | null;
  near_duplicate_group?: string | null;
  is_indexable?: boolean | null;
  has_schema_org?: boolean | null;
  has_canonical?: boolean | null;
  images_without_alt?: number | null;
  http_status?: number | null;
  crawl_depth?: number | null;
  page_intent?: string | null;
  page_type_override?: string | null;
}

export type ArchetypeRole = 'core_business' | 'auxiliary_pillar' | 'support' | 'functional';

export interface ArchetypeExample {
  url: string;
  h1: string | null;
  title: string | null;
}

export interface ArchetypeGroup {
  key: string;
  label: string;
  role: ArchetypeRole;
  purpose: string;
  pages: number;
  sample: string[];
  /** Exemples concrets (URL cliquable + H1) affichés dans la carte du type. */
  examples: ArchetypeExample[];
  avgSeoScore: number | null;
  avgWordCount: number;
  avgInternalLinks: number;
  thinPages: number;
  duplicateGroups: number;
  missingMeta: number;
  missingTitleOrH1: number;
  noSchema: number;
  notIndexable: number;
  strengths: string[];
  failures: string[];
  optimizations: string[];
  verdict: 'strong' | 'ok' | 'weak';
}


export type MixAction = 'balanced' | 'expand' | 'prune' | 'differentiate' | 'create';

/**
 * Fourchette de référence calibrée sur les observations réelles d'un secteur
 * (percentiles de la part de chaque gabarit). Fournie par la mémoire de marché ;
 * en son absence on retombe sur les cibles a priori, et le rapport le dit.
 */
export interface ArchetypeMixReference {
  archetypeKey: string;
  p20: number;
  p50: number;
  p80: number;
  sampleSize: number;
  scope: 'sector_model' | 'sector';
}

export type TargetSource = 'benchmark' | 'a_priori';

export interface ArchetypeMixEntry {
  key: string;
  label: string;
  role: ArchetypeRole;
  crawledPages: number;
  crawlShare: number;          // 0-1
  sitemapPages: number | null; // null si sitemap indisponible
  sitemapShare: number | null; // 0-1
  targetMin: number;           // 0-1
  targetMax: number;           // 0-1
  targetSource: TargetSource;
  targetMedian: number | null; // médiane sectorielle observée (benchmark seulement)
  targetSample: number | null; // nombre de domaines de l'échantillon
  action: MixAction;
  rationale: string;
}

export interface ArchetypeMix {
  basis: 'crawl' | 'crawl+sitemap';
  crawlPages: number;
  sitemapPages: number | null;
  coverage: number | null;     // pages crawlées / pages sitemap
  entries: ArchetypeMixEntry[];
  missing: Array<{ key: string; label: string; role: ArchetypeRole; rationale: string }>;
  verdict: 'balanced' | 'unbalanced';
  targetBasis: 'benchmark' | 'a_priori' | 'mixed';
  benchmarkScope: 'sector_model' | 'sector' | null;
  benchmarkSample: number | null;
  sectorLabel: string | null;
  /** Modèle d'affaires ayant servi à choisir les fourchettes a priori. */
  commercialModel: string | null;
  commercialModelLabel: string | null;
  synthesis: string;
}

export interface ArchetypeAnalysisOptions {
  sitemapUrls?: string[] | null;
  /** Fourchettes calibrées par secteur × modèle commercial (mémoire de marché). */
  benchmarks?: ArchetypeMixReference[] | null;
  /** Libellé lisible du secteur retenu, affiché dans le rapport. */
  sectorLabel?: string | null;
  /** Modèle d'affaires normalisé (carte d'identité résolue en phase 0). */
  commercialModel?: string | null;
  commercialModelLabel?: string | null;
  /**
   * Audit ciblé sur une URL précise : l'analyse se limite alors à cette page et
   * à son voisinage de liens (pages atteintes par les liens sortants et pages
   * qui pointent vers elle), au lieu de segmenter le site entier.
   */
  focusUrl?: string | null;
  /** URLs du voisinage de liens de focusUrl (entrants et sortants confondus). */
  linkedUrls?: string[] | null;
}



export interface ArchetypeAnalysis {
  totalPages: number;
  groups: ArchetypeGroup[];
  coreGroups: ArchetypeGroup[];
  mainProblem: string | null;
  globalVerdict: 'strong' | 'ok' | 'weak';
  synthesis: string;
  mix: ArchetypeMix | null;
  /** 'site' = segmentation du périmètre crawlé ; 'url' = URL ciblée + voisinage de liens. */
  scope: 'site' | 'url';
  focusUrl: string | null;
  /** Nombre de pages du voisinage de liens retenues en scope 'url'. */
  neighborhoodPages: number;
}




interface ArchetypeDef {
  key: string;
  label: string;
  role: ArchetypeRole;
  purpose: string;
  pattern: RegExp;
}

/** Ordre = priorité de matching (le premier qui matche gagne). */
const DEFS: ArchetypeDef[] = [
  {
    key: 'agency',
    label: 'Pages agence / point de vente',
    role: 'core_business',
    purpose: "capter la demande locale (« métier + ville ») et convertir en prise de contact",
    pattern: /\/(agence|agences|magasin|magasins|boutique-?locale|point-de-vente|showroom|centre|centres|succursale|nos-agences)\b/i,
  },
  {
    key: 'product',
    label: 'Pages produit',
    role: 'core_business',
    purpose: 'répondre à une intention d\'achat précise et déclencher la commande ou la demande de devis',
    pattern: /\/(produit|produits|product|products|catalogue|modele|modeles|reference|references)\b/i,
  },
  {
    key: 'service',
    label: 'Pages service / prestation',
    role: 'core_business',
    purpose: "positionner l'offre sur les requêtes métier commerciales et amener au devis",
    pattern: /\/(service|services|prestation|prestations|travaux|realisation|realisations|solution|solutions|metier|metiers|specialite|specialites)\b/i,
  },
  {
    key: 'conversion',
    label: 'Pages de conversion (devis, contact commercial)',
    role: 'core_business',
    purpose: 'transformer un visiteur qualifié en lead',
    pattern: /\/(devis|estimation|simulateur|demande|rendez-vous|rdv|reservation|contact-commercial|tarif|tarifs|prix|pricing)\b/i,
  },
  {
    key: 'feature',
    label: 'Pages fonctionnalité / outil',
    role: 'core_business',
    purpose: "expliquer ce que fait précisément une fonctionnalité ou un outil et déclencher l'essai",
    pattern: /\/(fonctionnalite|fonctionnalites|feature|features|outil|outils|tool|tools|module|modules|application|logiciel|plateforme|platform)\b/i,
  },
  {
    key: 'comparison',
    label: 'Pages comparatif / alternative',
    role: 'core_business',
    purpose: "capter les requêtes de fin de parcours (« X vs Y », « alternative à X ») et emporter l'arbitrage",
    pattern: /\/([^/]*-vs-[^/]*|comparatif|comparatifs|comparaison|compare|alternative|alternatives|versus|concurrent|concurrents)\b/i,
  },
  {
    key: 'case_study',
    label: 'Pages étude de cas / références clients',
    role: 'auxiliary_pillar',
    purpose: "prouver le résultat obtenu avec des chiffres réels et nourrir les signaux E-E-A-T",
    pattern: /\/(etude|etudes|etude-de-cas|etudes-de-cas|case-study|case-studies|cas-client|cas-clients|client|clients|portfolio|references-clients)\b/i,
  },
  {
    key: 'reviews',
    label: 'Pages avis / témoignages',
    role: 'auxiliary_pillar',
    purpose: 'apporter la preuve sociale et les signaux E-E-A-T qui rassurent avant la conversion',
    pattern: /\/(avis|temoignage|temoignages|review|reviews|notation|satisfaction|clients?-satisfaits?)\b/i,
  },
  {
    key: 'editorial',
    label: 'Pages éditoriales (blog, guides, actualités)',
    role: 'auxiliary_pillar',
    purpose: 'capter la demande informationnelle, alimenter le maillage interne et nourrir les moteurs de réponse IA',
    pattern: /\/(blog|article|articles|actualite|actualites|news|guide|guides|conseil|conseils|dossier|dossiers|tutoriel|faq|lexique|glossaire)\b/i,
  },
  {
    key: 'docs',
    label: 'Pages documentation / support',
    role: 'support',
    purpose: "réduire la friction à l'usage et capter les requêtes de support technique",
    pattern: /\/(doc|docs|documentation|api|developpeur|developers|aide|help|support|assistance|changelog|integration|integrations)\b/i,
  },
  {
    key: 'landing',
    label: 'Pages landing / offre ciblée',
    role: 'core_business',
    purpose: "adresser une cible ou une promesse unique en un seul écran et convertir sans détour",
    pattern: /\/(lp|landing|offre|offres|promo|promotion|campagne|essai|essai-gratuit|demo|demonstration|inscription-offre)\b/i,
  },
  {
    key: 'listing',
    label: 'Pages de listing / catégories',
    role: 'support',
    purpose: 'distribuer le maillage interne vers les pages business et structurer les thématiques',
    pattern: /\/(categorie|categories|category|rubrique|rubriques|tag|tags|liste|recherche|search|page\/\d+)\b/i,
  },
  {
    key: 'institutional',
    label: 'Pages institutionnelles',
    role: 'functional',
    purpose: "porter la confiance de marque et les mentions obligatoires",
    pattern: /\/(a-propos|qui-sommes-nous|equipe|notre-histoire|entreprise|about|recrutement|carriere|carrieres|partenaires?|auteur|auteurs)\b/i,
  },
  {
    key: 'account',
    label: 'Pages compte / espace applicatif',
    role: 'functional',
    purpose: "servir les utilisateurs déjà connectés ; aucun objectif d'acquisition organique",
    pattern: /\/(app|dashboard|console|compte|profil|mon-compte|login|connexion|auth|inscription|signup|signin|admin|checkout|panier|espace-client)\b/i,
  },
  {
    key: 'legal',
    label: 'Pages légales et utilitaires',
    role: 'functional',
    purpose: 'conformité et navigation ; aucun objectif d\'acquisition',
    pattern: /\/(mentions|mentions-legales|cgv|cgu|confidentialite|privacy|cookies|plan-du-site|sitemap|contact)\b/i,
  },
];

/**
 * Second passage de classement : mots-clés cherchés dans le title, le H1 et le
 * slug quand l'URL seule ne dit rien. C'est ce passage qui évite de déverser la
 * moitié du site dans « Autres pages ».
 */
const KEYWORD_HINTS: Array<{ key: string; words: RegExp }> = [
  { key: 'comparison', words: /\b(vs|versus|comparatif|comparaison|alternative|alternatives|meilleur|meilleurs|meilleure|top \d+|classement)\b/ },
  { key: 'conversion', words: /\b(devis|tarif|tarifs|prix|pricing|abonnement|combien coute|essai gratuit|demander|reserver|rendez-vous)\b/ },
  { key: 'feature', words: /\b(fonctionnalite|fonctionnalites|outil|outils|logiciel|plateforme|generateur|analyseur|audit automatique|module)\b/ },
  { key: 'case_study', words: /\b(etude de cas|cas client|resultats|retour d.experience|temoignage client|reference client)\b/ },
  { key: 'editorial', words: /\b(guide|comment|pourquoi|definition|qu.est-ce|tutoriel|checklist|exemples?|conseils?|actualite)\b/ },
  { key: 'service', words: /\b(prestation|accompagnement|consulting|expertise|service|agence de|externalisation)\b/ },
  { key: 'agency', words: /\b(agence de |notre agence|point de vente|showroom|nous trouver)\b/ },
  { key: 'product', words: /\b(fiche produit|reference|modele|gamme|collection|acheter)\b/ },
  { key: 'reviews', words: /\b(avis|temoignages|notes clients|satisfaction)\b/ },
  { key: 'docs', words: /\b(documentation|api|integration|changelog|aide|support technique)\b/ },
  { key: 'institutional', words: /\b(a propos|qui sommes-nous|notre equipe|notre histoire|recrutement|auteur)\b/ },
];

function deaccent(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}


function isHome(path: string): boolean {
  return path === '/' || path === '' || /^\/(index(\.html?)?)?$/i.test(path);
}

function pagePath(p: ArchetypePageInput): string {
  if (p.path) return p.path;
  try { return new URL(p.url).pathname; } catch { return '/'; }
}

function defByKey(key: string): ArchetypeDef {
  return DEFS.find((d) => d.key === key)!;
}

function classify(p: ArchetypePageInput): ArchetypeDef {
  const path = pagePath(p);
  if (isHome(path)) {
    return { key: 'home', label: "Page d'accueil", role: 'core_business', purpose: "porter le positionnement global et distribuer l'autorité vers les pages business", pattern: /^$/ };
  }
  const override = (p.page_type_override || '').toLowerCase();
  if (override) {
    const hit = DEFS.find((d) => d.key === override);
    if (hit) return hit;
  }
  for (const def of DEFS) if (def.pattern.test(deaccent(path))) return def;

  // 2e passage : mots-clés du slug, du title et du H1. Sans ce passage, tout ce
  // qui n'a pas de préfixe d'URL normalisé finissait dans « Autres pages ».
  const haystack = deaccent([path.replace(/[-_/]+/g, ' '), p.title || '', p.h1 || ''].join(' '));
  for (const hint of KEYWORD_HINTS) {
    if (hint.words.test(haystack)) return defByKey(hint.key);
  }

  // 3e passage : intention détectée au crawl
  const intent = (p.page_intent || '').toLowerCase();
  if (intent === 'buy') return defByKey('product');
  if (intent === 'do') return defByKey('conversion');
  if (intent === 'know') return defByKey('editorial');
  if (intent === 'navigate') return defByKey('institutional');

  // Dernier repli : une page de premier niveau sans marqueur est presque
  // toujours une page d'offre ciblée ; au-delà, on assume l'incertitude.
  const depth = Number.isFinite(Number(p.crawl_depth)) ? Number(p.crawl_depth) : (path.split('/').filter(Boolean).length);
  if (depth <= 1) return defByKey('landing');

  return { key: 'other', label: 'Pages non typées', role: 'support', purpose: "rôle non déterminé ni par l'URL, ni par le contenu, ni par l'intention détectée", pattern: /^$/ };
}


function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function buildGroup(def: ArchetypeDef, pages: ArchetypePageInput[]): ArchetypeGroup {
  const seoScores = pages.map((p) => Number(p.seo_score)).filter((n) => Number.isFinite(n) && n > 0);
  const avgSeoScore = seoScores.length ? Math.round(avg(seoScores)) : null;
  const avgWordCount = Math.round(avg(pages.map((p) => Number(p.word_count || 0))));
  const avgInternalLinks = Math.round(avg(pages.map((p) => Number(p.internal_links || 0))));
  const thinPages = pages.filter((p) => Number(p.thin_score || 0) >= 60 || Number(p.word_count || 0) < 250).length;
  const duplicateGroups = new Set(pages.map((p) => p.near_duplicate_group).filter(Boolean) as string[]).size;
  const missingMeta = pages.filter((p) => !p.meta_description || String(p.meta_description).trim().length < 50).length;
  const missingTitleOrH1 = pages.filter((p) => !p.title || !p.h1).length;
  const noSchema = pages.filter((p) => p.has_schema_org === false).length;
  const notIndexable = pages.filter((p) => p.is_indexable === false || Number(p.http_status || 200) >= 400).length;
  const n = pages.length;
  const pct = (x: number) => (n ? x / n : 0);

  const strengths: string[] = [];
  const failures: string[] = [];
  const optimizations: string[] = [];

  if (avgSeoScore !== null && avgSeoScore >= 70) strengths.push(`socle technique correct (score SEO moyen ${avgSeoScore}/100)`);
  if (avgWordCount >= 600) strengths.push(`contenu suffisamment développé (${avgWordCount} mots en moyenne)`);
  if (pct(missingMeta) < 0.2) strengths.push('métadonnées renseignées sur la quasi-totalité des pages');
  if (pct(noSchema) < 0.3 && n > 1) strengths.push('balisage structuré présent sur la majorité des pages');
  if (avgInternalLinks >= 15) strengths.push(`maillage interne actif (${avgInternalLinks} liens internes par page)`);

  if (pct(thinPages) >= 0.3) failures.push(`${thinPages} page(s) sur ${n} au contenu trop léger pour se différencier`);
  if (duplicateGroups > 0 && n > 1) failures.push(`${duplicateGroups} groupe(s) de pages quasi identiques : elles se neutralisent entre elles`);
  if (pct(missingMeta) >= 0.3) failures.push(`${missingMeta} page(s) sans meta description exploitable`);
  if (pct(missingTitleOrH1) >= 0.2) failures.push(`${missingTitleOrH1} page(s) sans title ou sans H1 unique`);
  if (pct(noSchema) >= 0.5) failures.push('absence de données structurées, donc peu de reprise possible par les moteurs de réponse IA');
  if (notIndexable > 0) failures.push(`${notIndexable} page(s) non indexables ou en erreur`);
  if (avgWordCount > 0 && avgWordCount < 350) failures.push(`volume rédactionnel faible (${avgWordCount} mots en moyenne)`);
  if (avgInternalLinks > 0 && avgInternalLinks < 5) failures.push('pages trop isolées dans le maillage interne');

  if (pct(thinPages) >= 0.3) optimizations.push('enrichir chaque page avec des éléments réellement propres à son contexte (chiffres, cas, contraintes locales, questions fréquentes)');
  if (duplicateGroups > 0) optimizations.push('différencier les gabarits dupliqués ou fusionner les pages redondantes avec une canonique claire');
  if (pct(noSchema) >= 0.5) optimizations.push(`ajouter le balisage structuré adapté au type (${def.key === 'product' ? 'Product/Offer' : def.key === 'reviews' ? 'Review/AggregateRating' : def.key === 'agency' ? 'LocalBusiness' : def.key === 'editorial' ? 'Article/FAQPage' : 'WebPage/Organization'})`);
  if (pct(missingMeta) >= 0.3) optimizations.push('rédiger des meta descriptions différenciées, orientées bénéfice et intention de recherche');
  if (avgInternalLinks < 10) optimizations.push('renforcer les liens contextuels entrants depuis les pages éditoriales et de listing');
  if (def.role === 'core_business') optimizations.push('exposer un bloc de réponse citable (question/réponse factuelle) pour être reprise par les moteurs IA');

  let verdict: ArchetypeGroup['verdict'] = 'ok';
  if (failures.length === 0 && (avgSeoScore === null || avgSeoScore >= 65)) verdict = 'strong';
  if (failures.length >= 3 || notIndexable > 0 || (avgSeoScore !== null && avgSeoScore < 45)) verdict = 'weak';

  // Exemples : on privilégie les pages qui ont un H1 exploitable et le contenu
  // le plus développé — c'est la page la plus représentative du gabarit.
  const ranked = [...pages].sort((a, b) => {
    const ha = a.h1 ? 1 : 0, hb = b.h1 ? 1 : 0;
    if (ha !== hb) return hb - ha;
    return Number(b.word_count || 0) - Number(a.word_count || 0);
  });
  const examples: ArchetypeExample[] = ranked.slice(0, 3).map((p) => ({
    url: p.url,
    h1: p.h1 || null,
    title: p.title || null,
  }));

  return {
    key: def.key,
    label: def.label,
    role: def.role,
    purpose: def.purpose,
    pages: n,
    sample: examples.map((e) => e.url),
    examples,

    avgSeoScore,
    avgWordCount,
    avgInternalLinks,
    thinPages,
    duplicateGroups,
    missingMeta,
    missingTitleOrH1,
    noSchema,
    notIndexable,
    strengths: strengths.slice(0, 4),
    failures: failures.slice(0, 4),
    optimizations: optimizations.slice(0, 4),
    verdict,
  };
}

/**
 * Fourchettes de référence POSÉES A PRIORI de la part de chaque type dans un
 * site d'acquisition. Ce sont des repères de bon sens, pas des benchmarks
 * mesurés : ils ne servent que de repli quand la mémoire de marché n'a pas
 * encore assez d'observations dans le secteur (< 5 domaines). Le rapport
 * indique toujours laquelle des deux sources a été utilisée.
 *
 * Elles sont désormais sélectionnées PAR MODÈLE D'AFFAIRES : le mix attendu d'un
 * service local multi-agences n'a rien à voir avec celui d'un e-commerce, d'un
 * SaaS ou d'un média. Une cible globale unique était la principale faiblesse de
 * ce module.
 */
const MIX_TARGETS_GENERIC: Record<string, [number, number]> = {
  home: [0, 0.05],
  agency: [0, 0.35],
  product: [0, 0.45],
  service: [0, 0.30],
  feature: [0, 0.20],
  comparison: [0, 0.10],
  landing: [0, 0.15],
  conversion: [0.01, 0.08],
  reviews: [0, 0.10],
  case_study: [0, 0.10],
  editorial: [0.15, 0.50],
  listing: [0, 0.20],
  docs: [0, 0.15],
  institutional: [0.01, 0.08],
  account: [0, 0.08],
  legal: [0, 0.05],
  other: [0, 0.15],
};

const MIX_TARGETS_BY_MODEL: Record<string, Record<string, [number, number]>> = {
  local_service: {
    home: [0, 0.05],
    agency: [0.15, 0.50],
    service: [0.10, 0.40],
    reviews: [0.02, 0.12],
    case_study: [0, 0.12],
    conversion: [0.02, 0.10],
    editorial: [0.10, 0.40],
    listing: [0.01, 0.12],
    product: [0, 0.15],
    feature: [0, 0.05],
    comparison: [0, 0.05],
    landing: [0, 0.10],
    docs: [0, 0.05],
    institutional: [0.01, 0.08],
    account: [0, 0.05],
    legal: [0, 0.05],
    other: [0, 0.15],
  },
  ecommerce: {
    home: [0, 0.03],
    product: [0.30, 0.75],
    listing: [0.05, 0.25],
    editorial: [0.05, 0.30],
    reviews: [0.01, 0.10],
    case_study: [0, 0.05],
    conversion: [0.01, 0.06],
    service: [0, 0.10],
    agency: [0, 0.10],
    feature: [0, 0.05],
    comparison: [0, 0.08],
    landing: [0, 0.10],
    docs: [0, 0.06],
    institutional: [0.01, 0.06],
    account: [0, 0.06],
    legal: [0, 0.04],
    other: [0, 0.12],
  },
  saas: {
    home: [0, 0.05],
    feature: [0.10, 0.35],
    service: [0, 0.35],
    comparison: [0.02, 0.12],
    conversion: [0.02, 0.12],
    landing: [0.02, 0.15],
    editorial: [0.25, 0.65],
    case_study: [0.02, 0.12],
    reviews: [0, 0.10],
    docs: [0, 0.30],
    listing: [0, 0.10],
    product: [0, 0.15],
    agency: [0, 0],
    institutional: [0.01, 0.08],
    account: [0, 0.08],
    legal: [0, 0.06],
    other: [0, 0.15],
  },
  lead_gen: {
    home: [0, 0.05],
    service: [0.15, 0.45],
    conversion: [0.03, 0.12],
    editorial: [0.20, 0.55],
    reviews: [0.02, 0.12],
    case_study: [0.02, 0.12],
    agency: [0, 0.20],
    product: [0, 0.12],
    feature: [0, 0.15],
    comparison: [0, 0.10],
    landing: [0.02, 0.15],
    docs: [0, 0.10],
    listing: [0, 0.12],
    institutional: [0.01, 0.08],
    account: [0, 0.06],
    legal: [0, 0.05],
    other: [0, 0.15],
  },
  media: {
    home: [0, 0.02],
    editorial: [0.55, 0.92],
    listing: [0.02, 0.20],
    institutional: [0, 0.05],
    conversion: [0, 0.05],
    service: [0, 0.08],
    product: [0, 0.10],
    agency: [0, 0],
    reviews: [0, 0.06],
    case_study: [0, 0.05],
    feature: [0, 0.05],
    comparison: [0, 0.08],
    landing: [0, 0.06],
    docs: [0, 0.05],
    account: [0, 0.05],
    legal: [0, 0.04],
    other: [0, 0.12],
  },
  non_commercial: {
    home: [0, 0.05],
    editorial: [0.30, 0.75],
    institutional: [0.05, 0.25],
    conversion: [0, 0.10],
    listing: [0, 0.15],
    service: [0, 0.20],
    agency: [0, 0],
    product: [0, 0.08],
    reviews: [0, 0.06],
    case_study: [0, 0.10],
    feature: [0, 0.10],
    comparison: [0, 0.05],
    landing: [0, 0.08],
    docs: [0, 0.15],
    account: [0, 0.06],
    legal: [0, 0.06],
    other: [0, 0.15],
  },
};


interface ResolvedTarget {
  min: number;
  max: number;
  source: TargetSource;
  median: number | null;
  sample: number | null;
  /** Modèle d'affaires ayant servi à choisir la fourchette a priori. */
  modelScoped: boolean;
}

function mixTarget(
  key: string,
  role: ArchetypeRole,
  benchmarks: Map<string, ArchetypeMixReference> | null,
  commercialModel?: string | null,
): ResolvedTarget {
  const bench = benchmarks?.get(key);
  if (bench && bench.sampleSize >= 5 && Number.isFinite(bench.p20) && Number.isFinite(bench.p80)) {
    // Fourchette interquintile observée, légèrement élargie : on ne veut
    // signaler qu'un écart net, pas un site simplement atypique.
    const span = Math.max(0.02, (bench.p80 - bench.p20) * 0.15);
    return {
      min: Math.max(0, bench.p20 - span),
      max: Math.min(1, bench.p80 + span),
      source: 'benchmark',
      median: bench.p50,
      sample: bench.sampleSize,
      modelScoped: false,
    };
  }

  const modelTable = commercialModel && commercialModel !== 'unknown'
    ? MIX_TARGETS_BY_MODEL[commercialModel]
    : null;
  const scoped = modelTable?.[key];
  if (scoped) {
    return { min: scoped[0], max: scoped[1], source: 'a_priori', median: null, sample: null, modelScoped: true };
  }

  const fallback = MIX_TARGETS_GENERIC[key]
    ?? (role === 'core_business' ? [0.05, 0.40] : role === 'auxiliary_pillar' ? [0.10, 0.45] : [0, 0.15]);
  return { min: fallback[0], max: fallback[1], source: 'a_priori', median: null, sample: null, modelScoped: false };
}



function pct1(x: number): string {
  return `${Math.round(x * 1000) / 10} %`;
}

function buildMix(
  groups: ArchetypeGroup[],
  crawlPages: number,
  options: ArchetypeAnalysisOptions,
): ArchetypeMix | null {
  if (!crawlPages) return null;
  const sitemapUrls = options.sitemapUrls;

  const benchList = (options.benchmarks || []).filter((b) => b && b.archetypeKey && b.sampleSize >= 5);
  const benchmarks = benchList.length ? new Map(benchList.map((b) => [b.archetypeKey, b])) : null;
  const benchmarkScope: ArchetypeMix['benchmarkScope'] = benchList.length
    ? (benchList.some((b) => b.scope === 'sector_model') ? 'sector_model' : 'sector')
    : null;
  const benchmarkSample = benchList.length ? Math.min(...benchList.map((b) => b.sampleSize)) : null;

  // Répartition du sitemap par type (même classifieur, sur la seule URL)
  let sitemapCounts: Map<string, number> | null = null;
  let sitemapTotal: number | null = null;
  const cleanSitemap = (sitemapUrls || []).filter((u) => typeof u === 'string' && u.startsWith('http'));
  if (cleanSitemap.length >= 5) {
    sitemapCounts = new Map();
    for (const url of cleanSitemap) {
      const key = classify({ url }).key;
      sitemapCounts.set(key, (sitemapCounts.get(key) || 0) + 1);
    }
    sitemapTotal = cleanSitemap.length;
  }

  const reference = sitemapCounts && sitemapTotal ? { counts: sitemapCounts, total: sitemapTotal } : null;

  const entries: ArchetypeMixEntry[] = groups.map((g) => {
    const crawlShare = g.pages / crawlPages;
    const sitemapPages = reference ? (reference.counts.get(g.key) || 0) : null;
    const sitemapShare = reference && sitemapPages !== null ? sitemapPages / reference.total : null;
    const share = sitemapShare ?? crawlShare;
    const target = mixTarget(g.key, g.role, benchmarks, options.commercialModel ?? null);
    const targetMin = target.min;
    const targetMax = target.max;
    const origin = target.source === 'benchmark'
      ? `fourchette observée sur ${target.sample} site(s) comparable(s)`
      : target.modelScoped
        ? `fourchette de référence pour un modèle « ${options.commercialModelLabel || options.commercialModel} »`
        : 'fourchette de référence générique';


    const thinRatio = g.pages ? g.thinPages / g.pages : 0;
    const unhealthy = g.verdict === 'weak' || thinRatio >= 0.4 || g.duplicateGroups > 0;

    let action: MixAction = 'balanced';
    let rationale = `part de ${pct1(share)} du site, cohérente avec la ${origin} (${pct1(targetMin)}–${pct1(targetMax)}${target.median !== null ? `, médiane ${pct1(target.median)}` : ''}).`;

    if (share > targetMax && unhealthy) {
      action = 'prune';
      rationale = `${pct1(share)} du site pour ce seul gabarit, dont ${g.thinPages} page(s) trop légère(s)${g.duplicateGroups ? ` et ${g.duplicateGroups} groupe(s) quasi identique(s)` : ''} : élaguer ou fusionner les pages les plus faibles avant d'en créer d'autres (${origin} : max ${pct1(targetMax)}).`;
    } else if (share > targetMax) {
      action = 'differentiate';
      rationale = `${pct1(share)} du site, au-dessus de la ${origin} (max ${pct1(targetMax)}) : le volume est là, l'enjeu est de différencier ces pages plutôt que d'en ajouter.`;
    } else if (share < targetMin) {
      action = 'expand';
      rationale = `seulement ${pct1(share)} du site (${g.pages} page(s)) contre ${pct1(targetMin)} attendu au minimum selon la ${origin} : ce gabarit est sous-représenté au regard de son rôle.`;
    }

    return {
      key: g.key, label: g.label, role: g.role,
      crawledPages: g.pages, crawlShare,
      sitemapPages, sitemapShare,
      targetMin, targetMax,
      targetSource: target.source,
      targetMedian: target.median,
      targetSample: target.sample,
      action, rationale,
    };
  });


  // Un type manquant n'est signalé que s'il est réellement attendu pour ce
  // modèle d'affaires : on ne reproche pas à un SaaS de ne pas avoir de pages
  // agence ou de pages devis locales.
  const present = new Set(groups.map((g) => g.key));
  const missing = DEFS.filter((d) => {
    if (present.has(d.key)) return false;
    const t = mixTarget(d.key, d.role, benchmarks, options.commercialModel ?? null);
    return t.min > 0;
  }).map((d) => ({
    key: d.key, label: d.label, role: d.role,
    rationale: `aucune page de ce type n'a été détectée alors qu'elle est attendue pour ce modèle d'affaires : créer ce gabarit pour ${d.purpose}.`,
  }));


  const coverage = reference ? Math.min(1, crawlPages / reference.total) : null;
  const flagged = entries.filter((e) => e.action !== 'balanced');
  const verdict: ArchetypeMix['verdict'] = flagged.length || missing.length ? 'unbalanced' : 'balanced';

  const toPrune = entries.filter((e) => e.action === 'prune');
  const toExpand = entries.filter((e) => e.action === 'expand');
  const toDiff = entries.filter((e) => e.action === 'differentiate');

  const parts: string[] = [];
  parts.push(reference
    ? `Répartition établie sur ${reference.total} URL(s) du sitemap, recoupée avec ${crawlPages} page(s) réellement crawlée(s)${coverage !== null ? ` (couverture ${pct1(coverage)})` : ''}.`
    : `Répartition établie sur les ${crawlPages} page(s) crawlée(s) — sitemap non exploitable, les parts sont donc indicatives du périmètre crawlé et non du site entier.`);
  if (verdict === 'balanced') {
    parts.push("Le ratio entre gabarits est équilibré : aucun type n'est nettement sur- ou sous-représenté, l'effort doit porter sur la qualité des pages existantes plutôt que sur leur nombre.");
  } else {
    if (toPrune.length) parts.push(`À élaguer en priorité : ${toPrune.map((e) => e.label.toLowerCase()).join(', ')} — le volume produit de la dilution, pas de la couverture.`);
    if (toDiff.length) parts.push(`À différencier sans en créer davantage : ${toDiff.map((e) => e.label.toLowerCase()).join(', ')}.`);
    if (toExpand.length) parts.push(`À développer : ${toExpand.map((e) => e.label.toLowerCase()).join(', ')}.`);
    if (missing.length) parts.push(`Gabarit(s) à créer, aujourd'hui absent(s) : ${missing.map((m) => m.label.toLowerCase()).join(', ')}.`);
  }
  parts.push("Ces arbitrages de volume rejoignent ceux du module Cocoon (élagage, cannibalisation, création de piliers) : les traiter au même endroit évite de créer des pages qui viendraient concurrencer les existantes.");

  const benchCount = entries.filter((e) => e.targetSource === 'benchmark').length;
  const targetBasis: ArchetypeMix['targetBasis'] =
    benchCount === 0 ? 'a_priori' : benchCount === entries.length ? 'benchmark' : 'mixed';

  const modelScopedCount = entries.filter((e) => e.targetSource === 'a_priori').length;
  if (targetBasis === 'a_priori') {
    parts.push(
      options.commercialModel && options.commercialModel !== 'unknown'
        ? `Attention à la lecture : faute d'un échantillon sectoriel suffisant${options.sectorLabel ? ` pour le secteur « ${options.sectorLabel} »` : ''}, les fourchettes utilisées ici sont des repères posés a priori pour un modèle « ${options.commercialModelLabel || options.commercialModel} » — pas des normes mesurées. Elles signalent un déséquilibre probable au regard de ce modèle, pas une règle.`
        : `Attention à la lecture : le modèle d'affaires du site n'a pas pu être résolu et l'échantillon sectoriel est insuffisant. Les fourchettes utilisées sont donc génériques : elles signalent au mieux une anomalie grossière, et un écart isolé ne doit pas être interprété.`,
    );
  } else {
    parts.push(`Les fourchettes utilisées sont ${targetBasis === 'benchmark' ? '' : 'en partie '}calibrées sur les répartitions réellement observées ${options.sectorLabel ? `dans le secteur « ${options.sectorLabel} »` : 'sur des sites comparables'}${benchmarkSample ? ` (au moins ${benchmarkSample} domaine(s) par gabarit)` : ''}${benchmarkScope === 'sector' ? ', modèle commercial confondu' : ''} — les ${modelScopedCount} gabarit(s) sans échantillon suffisant restent comparés à un repère a priori${options.commercialModelLabel ? ` propre au modèle « ${options.commercialModelLabel} »` : ''}.`);
  }

  return {
    basis: reference ? 'crawl+sitemap' : 'crawl',
    crawlPages,
    sitemapPages: reference?.total ?? null,
    coverage,
    entries,
    missing,
    verdict,
    targetBasis,
    benchmarkScope,
    benchmarkSample,
    sectorLabel: options.sectorLabel ?? null,
    commercialModel: options.commercialModel ?? null,
    commercialModelLabel: options.commercialModelLabel ?? null,
    synthesis: parts.join(' '),
  };
}


export function analyzePageArchetypes(
  pages: ArchetypePageInput[],
  sitemapUrlsOrOptions?: string[] | null | ArchetypeAnalysisOptions,
  maybeOptions?: ArchetypeAnalysisOptions,
): ArchetypeAnalysis | null {

  // Compat : l'ancienne signature (pages, sitemapUrls) reste acceptée.
  const options: ArchetypeAnalysisOptions = Array.isArray(sitemapUrlsOrOptions) || sitemapUrlsOrOptions == null
    ? { ...(maybeOptions || {}), sitemapUrls: (sitemapUrlsOrOptions as string[] | null) ?? maybeOptions?.sitemapUrls ?? null }
    : (sitemapUrlsOrOptions as ArchetypeAnalysisOptions);

  const norm = (u: string): string => {
    try {
      const x = new URL(u);
      return `${x.hostname.replace(/^www\./, '')}${x.pathname.replace(/\/+$/, '')}`.toLowerCase();
    } catch { return u.replace(/\/+$/, '').toLowerCase(); }
  };

  let usable = (pages || []).filter((p) => p && p.url);

  // Périmètre ciblé : l'audit porte sur une URL précise. On ne segmente alors
  // que cette page et son voisinage de liens (entrants + sortants), sinon on
  // décrirait des gabarits que l'audit n'a pas réellement examinés.
  const focusUrl = options.focusUrl || null;
  const scope: ArchetypeAnalysis['scope'] = focusUrl ? 'url' : 'site';
  let neighborhoodPages = 0;
  if (focusUrl) {
    const allowed = new Set<string>([norm(focusUrl), ...(options.linkedUrls || []).filter((u) => typeof u === 'string').map(norm)]);
    const scoped = usable.filter((p) => allowed.has(norm(p.url)));
    if (scoped.length) {
      usable = scoped;
      neighborhoodPages = Math.max(0, scoped.length - 1);
    }
  }

  if (usable.length < (focusUrl ? 1 : 3)) return null;



  const buckets = new Map<string, { def: ArchetypeDef; pages: ArchetypePageInput[] }>();
  for (const p of usable) {
    const def = classify(p);
    const entry = buckets.get(def.key) || { def, pages: [] };
    entry.pages.push(p);
    buckets.set(def.key, entry);
  }

  const groups = Array.from(buckets.values())
    .map(({ def, pages: gp }) => buildGroup(def, gp))
    .sort((a, b) => {
      const roleWeight: Record<ArchetypeRole, number> = { core_business: 0, auxiliary_pillar: 1, support: 2, functional: 3 };
      if (roleWeight[a.role] !== roleWeight[b.role]) return roleWeight[a.role] - roleWeight[b.role];
      return b.pages - a.pages;
    });

  const coreGroups = groups.filter((g) => g.role === 'core_business' && g.pages > 0);
  const auxGroups = groups.filter((g) => g.role === 'auxiliary_pillar');

  // Problème principal = le blocage le plus fréquent sur les types business
  const problemCandidates: Array<{ weight: number; text: string }> = [];
  for (const g of coreGroups.length ? coreGroups : groups) {
    if (g.notIndexable > 0) problemCandidates.push({ weight: 100 + g.pages, text: `des pages « ${g.label.toLowerCase()} » ne sont pas indexables, elles ne peuvent produire aucun résultat` });
    if (g.duplicateGroups > 0) problemCandidates.push({ weight: 80 + g.duplicateGroups, text: `les pages « ${g.label.toLowerCase()} » sont bâties sur un gabarit trop uniforme et se cannibalisent` });
    if (g.pages && g.thinPages / g.pages >= 0.3) problemCandidates.push({ weight: 70 + g.thinPages, text: `les pages « ${g.label.toLowerCase()} » manquent de contenu propre et restent interchangeables aux yeux des moteurs` });
    if (g.avgInternalLinks < 5) problemCandidates.push({ weight: 40, text: `les pages « ${g.label.toLowerCase()} » sont insuffisamment maillées et reçoivent peu d'autorité interne` });
  }
  problemCandidates.sort((a, b) => b.weight - a.weight);
  const mainProblem = problemCandidates[0]?.text || null;

  const coreWeak = coreGroups.filter((g) => g.verdict === 'weak').length;
  const globalVerdict: ArchetypeAnalysis['globalVerdict'] =
    coreGroups.length === 0 ? 'ok' : coreWeak >= Math.max(1, Math.ceil(coreGroups.length / 2)) ? 'weak' : coreWeak > 0 ? 'ok' : 'strong';

  const coreLabels = coreGroups.slice(0, 2).map((g) => g.label.toLowerCase()).join(' et ');
  const auxLabels = auxGroups.slice(0, 2).map((g) => g.label.toLowerCase()).join(' et ');
  const auxPlaying = auxGroups.length ? auxGroups.every((g) => g.verdict !== 'weak') : null;

  const synthesis = [
    coreGroups.length
      ? `À périmètre constant, les pages les plus importantes pour le business sont celles de type ${coreLabels}. ` +
        (globalVerdict === 'strong'
          ? "Elles remplissent leur rôle : socle technique tenu, contenu propre à chaque page, maillage suffisant — le site n'est pas freiné par ses pages business."
          : globalVerdict === 'ok'
            ? "Elles tiennent partiellement leur rôle : le socle technique est là, mais leur différenciation éditoriale reste insuffisante, ce qui plafonne la performance globale du site."
            : "Elles échouent à tenir leur rôle : contenu trop uniforme, signaux structurés absents ou indexation défaillante — le site est freiné par ses pages les plus stratégiques.")
      : "Aucun type de page clairement commercial n'a été identifié sur le périmètre crawlé : le site s'adresse aujourd'hui davantage à une audience informationnelle qu'à une intention d'achat.",
    auxLabels
      ? auxPlaying
        ? `Les pages ${auxLabels}, qui servent de piliers auxiliaires, jouent leur rôle de preuve et d'apport de trafic amont.`
        : `Les pages ${auxLabels}, qui devraient servir de piliers auxiliaires, ne jouent pas ce rôle : trop légères ou mal maillées, elles n'alimentent ni la preuve ni les pages business.`
      : "Aucun pilier auxiliaire (avis, contenus éditoriaux) n'a été détecté : les pages business avancent sans preuve sociale ni apport de trafic amont.",
    mainProblem ? `Le problème principal est simple : ${mainProblem}.` : null,
  ].filter(Boolean).join(' ');

  // En périmètre ciblé, une pondération de mix n'a aucun sens statistique.
  const mix = scope === 'url' ? null : buildMix(groups, usable.length, options);
  const scopeNote = scope === 'url'
    ? ` Périmètre de cette analyse : l'URL auditée et son voisinage de liens (${neighborhoodPages} page(s) atteinte(s) par ses liens internes) — aucune extrapolation au site entier n'est faite, et aucune pondération de mix n'est calculée.`
    : '';
  const fullSynthesis = `${synthesis}${mix ? ` ${mix.synthesis}` : ''}${scopeNote}`;

  return { totalPages: usable.length, groups, coreGroups, mainProblem, globalVerdict, synthesis: fullSynthesis, mix, scope, focusUrl, neighborhoodPages };



}

const ROLE_LABELS: Record<ArchetypeRole, string> = {
  core_business: 'Type business prioritaire',
  auxiliary_pillar: 'Pilier auxiliaire',
  support: 'Rôle de distribution',
  functional: 'Rôle fonctionnel',
};

const VERDICT_LABELS: Record<ArchetypeGroup['verdict'], { text: string; color: string }> = {
  strong: { text: 'remplit son rôle', color: '#22c55e' },
  ok: { text: 'partiellement à la hauteur', color: '#d4af37' },
  weak: { text: 'ne remplit pas son rôle', color: '#ef4444' },
};

function list(items: string[], color: string, title: string): string {
  if (!items.length) return '';
  return `<div style="margin:8px 0 0 0;">
    <div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:${color};margin-bottom:4px;">${title}</div>
    <ul style="padding-left:18px;margin:0;font-size:12.5px;line-height:1.65;color:#374151;">${items.map((i) => `<li>${i}</li>`).join('')}</ul>
  </div>`;
}

/** Rendu HTML de la section « Audit par type de page » (déterministe). */
export function renderPageArchetypesHTML(analysis: ArchetypeAnalysis, domain: string): string {
  const cards = analysis.groups.map((g) => {
    const v = VERDICT_LABELS[g.verdict];
    return `<div data-marina-block="archetype-${g.key}" style="border:1px solid #e5e7eb;border-left:4px solid ${v.color};border-radius:8px;padding:14px 16px;margin:0 0 12px 0;background:#ffffff;">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline;flex-wrap:wrap;">
        <div>
          <div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;">${ROLE_LABELS[g.role]}</div>
          <div style="font-size:15px;font-weight:700;color:#111827;">${g.label}</div>
        </div>
        <div style="font-size:12px;color:${v.color};font-weight:600;">${v.text}</div>
      </div>
      <p style="font-size:12.5px;color:#4b5563;line-height:1.7;margin:6px 0 0 0;">
        Ce que ces pages visent : ${g.purpose}. Périmètre mesuré : ${g.pages} page(s)${g.avgSeoScore !== null ? `, score SEO moyen ${g.avgSeoScore}/100` : ''}, ${g.avgWordCount} mots et ${g.avgInternalLinks} liens internes en moyenne.
      </p>
      ${list(g.strengths, '#16a34a', 'Ce qui fonctionne')}
      ${list(g.failures, '#b91c1c', 'Ce qui échoue')}
      ${list(g.optimizations, '#6d28d9', 'Comment les optimiser')}
      ${g.sample.length ? `<div style="font-size:11px;color:#9ca3af;margin-top:8px;word-break:break-all;">Exemples : ${g.sample.join(' · ')}</div>` : ''}
    </div>`;
  }).join('');

  const mix = analysis.mix;
  const ACTION_LABELS: Record<MixAction, { text: string; color: string }> = {
    balanced: { text: 'Ratio correct', color: '#22c55e' },
    expand: { text: 'Créer plus de pages', color: '#6d28d9' },
    prune: { text: 'Élaguer / fusionner', color: '#ef4444' },
    differentiate: { text: 'Différencier, ne pas en créer', color: '#d4af37' },
    create: { text: 'Gabarit à créer', color: '#6d28d9' },
  };

  const mixHTML = !mix ? '' : `
  <div data-marina-block="archetype-mix" data-pdf-section style="border:1px solid #e5e7eb;border-left:4px solid #d4af37;border-radius:8px;padding:14px 16px;margin:0 0 12px 0;background:#ffffff;">
    <div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;">Pondération du mix de pages</div>
    <div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:6px;">Ratio entre gabarits : ${mix.verdict === 'balanced' ? 'équilibré' : 'déséquilibré'}</div>
    <p style="font-size:12.5px;color:#4b5563;line-height:1.7;margin:0 0 10px 0;">
      Base de calcul : ${mix.basis === 'crawl+sitemap' ? `sitemap (${mix.sitemapPages} URL) recoupé avec le crawl (${mix.crawlPages} pages)` : `crawl seul (${mix.crawlPages} pages), sitemap non exploitable`}. Origine des fourchettes : ${
        mix.targetBasis === 'benchmark'
          ? `répartitions réellement observées${mix.sectorLabel ? ` sur des sites du secteur « ${mix.sectorLabel} »` : ' sur des sites comparables'}${mix.benchmarkSample ? `, ${mix.benchmarkSample} domaine(s) minimum par gabarit` : ''}${mix.benchmarkScope === 'sector' ? ', modèle commercial confondu' : ''}`
          : mix.targetBasis === 'mixed'
            ? `mixte — certains gabarits sont comparés aux répartitions observées${mix.sectorLabel ? ` dans le secteur « ${mix.sectorLabel} »` : ''}, les autres à un repère posé a priori faute d'échantillon suffisant`
            : `repères posés a priori (aucun échantillon sectoriel suffisant à ce jour)${mix.commercialModelLabel ? `, calés sur un modèle « ${mix.commercialModelLabel} »` : ' et non calés sur un modèle d\'affaires identifié'} : ils signalent un déséquilibre probable, ils ne constituent pas une norme`
      }. Seuls les écarts nets sont signalés.

    </p>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="background:#faf9f5;color:#374151;text-align:left;">
          <th style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">Type de page</th>
          <th style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">Crawl</th>
          <th style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">Sitemap</th>
          <th style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">Référence</th>
          <th style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">Source</th>
          <th style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">Arbitrage</th>
        </tr>
      </thead>
      <tbody>
        ${mix.entries.map((e) => `<tr>
          <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;color:#111827;">${e.label}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;color:#4b5563;">${e.crawledPages} (${pct1(e.crawlShare)})</td>
          <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;color:#4b5563;">${e.sitemapPages !== null ? `${e.sitemapPages} (${pct1(e.sitemapShare || 0)})` : 'n/d'}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${pct1(e.targetMin)}–${pct1(e.targetMax)}${e.targetMedian !== null ? ` (méd. ${pct1(e.targetMedian)})` : ''}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${e.targetSource === 'benchmark' ? `observé (n=${e.targetSample})` : 'a priori'}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;color:${ACTION_LABELS[e.action].color};font-weight:600;">${ACTION_LABELS[e.action].text}</td>
        </tr>`).join('')}
      </tbody>
    </table>

    <ul style="padding-left:18px;margin:10px 0 0 0;font-size:12.5px;line-height:1.65;color:#374151;">
      ${mix.entries.filter((e) => e.action !== 'balanced').map((e) => `<li><strong>${e.label}</strong> — ${e.rationale}</li>`).join('')}
      ${mix.missing.map((m) => `<li><strong>${m.label}</strong> — ${m.rationale}</li>`).join('')}
    </ul>
  </div>`;

  return `
  <div class="section" data-marina-scope="site" data-marina-block="archetypes" data-pdf-section style="border-left:6px solid #6d28d9;">
    <h2 style="font-size:19px;margin:0 0 10px 0;">Audit par type de page</h2>
    <p style="font-size:12.5px;line-height:1.7;color:#4b5563;background:#faf9f5;border-left:3px solid #d4af37;padding:10px 14px;border-radius:6px;margin:0 0 16px 0;">
      Ce que mesure cette section : un site ne se juge pas page par page mais gabarit par gabarit. Les ${analysis.totalPages} pages retenues sur ${domain} sont regroupées par type (agence, produit, service, avis, éditorial…), chaque type est confronté à l'objectif qu'il est censé servir, puis une conclusion intermédiaire précise s'il le remplit. La pondération du mix indique enfin s'il faut créer, élaguer ou simplement différencier chaque gabarit. Le verdict global du site en découle.
    </p>
    ${cards}
    ${mixHTML}
    <div style="border:2px solid #6d28d9;border-left:6px solid #d4af37;border-radius:10px;padding:16px 18px;background:#ffffff;">
      <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;margin-bottom:4px;">Conclusion par types de pages</div>
      <p style="font-size:13.5px;line-height:1.8;color:#111827;margin:0;">${analysis.synthesis}</p>
    </div>
  </div>`;
}

