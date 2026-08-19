/**
 * _shared/pageFocus.ts
 *
 * Carte d'identité AU NIVEAU DE LA PAGE (100 % déterministe, 0 token LLM).
 *
 * Problème résolu : un audit Marina sur https://exemple.fr/salle-de-bain-marseille
 * et un audit sur https://exemple.fr/saint-remy-de-provence recevaient exactement
 * les mêmes questions de benchmark LLM, parce que l'identité et les besoins testés
 * étaient résolus au niveau DOMAINE. Une page service+ville et une page ville pure
 * n'adressent pas le même marché : elles doivent être testées séparément.
 *
 * Ce module extrait de l'URL (et, quand disponible, du title / H1 crawlé) :
 *   - `slugPhrase`  : « salle de bain marseille »
 *   - `locality`    : « Marseille » / « Saint-Rémy-de-Provence » (détection FR)
 *   - `service`     : la phrase sans la localité (« salle de bain »)
 *   - `focusTerms`  : mots-clés d'ancrage propres à la page
 *
 * Consommateurs : calculate-llm-visibility (topics + questions + clé de cache),
 * marina (scoping du cache de visibilité IA par page).
 */

export type PageKind = 'home' | 'reviews' | 'standard';

export interface PageFocus {
  /** Chemin normalisé sans slash final (« /salle-de-bain-marseille »), '' pour la home. */
  path: string;
  isHome: boolean;
  /** Slug humanisé du dernier segment significatif. */
  slugPhrase: string;
  /** Localité détectée dans le slug (casse restaurée), sinon null. */
  locality: string | null;
  /** Besoin/prestation de la page, hors localité. */
  service: string | null;
  /** Mots-clés d'ancrage spécifiques à la page (service + localité + title/H1). */
  focusTerms: string[];
  /**
   * Nature de la page. `reviews` = page avis / témoignages : son but reste de
   * vendre la prestation, la réputation n'est qu'un angle secondaire.
   */
  kind: PageKind;
  /** Angle secondaire à injecter dans UNE question sur neuf (réputation). */
  secondaryAngle: 'reputation' | null;
  title?: string | null;
  h1?: string | null;
}


const SLUG_STOPWORDS = new Set([
  'de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'et', 'ou', 'en', 'a', 'au', 'aux',
  'pour', 'chez', 'sur', 'par', 'notre', 'nos', 'votre', 'vos', 'the', 'and', 'for',
  'index', 'html', 'htm', 'php', 'page', 'pages', 'fr', 'www',
]);

/** Segments de chemin purement structurels : on remonte au segment précédent. */
const STRUCTURAL_SEGMENTS = /^(fr|en|es|blog|articles?|actualites?|news|services?|prestations?|realisations?|zones?|zone-d-intervention|villes?|agences?|categorie|category|c|p)$/i;

/**
 * Segments « avis / témoignages ». Une page avis ne vend pas des avis : elle
 * vend la prestation de la page (ou de l'agence) parente. On la traite donc
 * comme un segment structurel — le focus est hérité du segment précédent — et
 * on ne garde la réputation que comme angle secondaire (1 question sur 9).
 */
const REVIEW_SEGMENTS = /^(avis|avis-clients?|avis-google|temoignages?|témoignages?|reviews?|testimonials?|notations?|notes|ratings?)$/i;


/** Marqueurs de toponyme français (composition de nom de commune). */
const LOCALITY_PATTERNS: RegExp[] = [
  /^saint(e)?[- ]/i,
  /[- ]sur[- ]/i,
  /[- ]sous[- ]/i,
  /[- ]les?[- ]/i,
  /[- ]en[- ](provence|brie|velay|bresse|yvelines|gohelle|baroeul|laye)/i,
  /[- ]de[- ](provence|marsan|france|beauce)/i,
  /^aix$|^aix[- ]/i,
];

/** Grandes villes / communes fréquentes en SEO local FR (détection directe). */
const KNOWN_CITIES = [
  'paris', 'marseille', 'lyon', 'toulouse', 'nice', 'nantes', 'montpellier', 'strasbourg',
  'bordeaux', 'lille', 'rennes', 'reims', 'toulon', 'saint-etienne', 'le-havre', 'grenoble',
  'dijon', 'angers', 'nimes', 'villeurbanne', 'clermont-ferrand', 'le-mans', 'aix-en-provence',
  'brest', 'tours', 'amiens', 'limoges', 'annecy', 'perpignan', 'besancon', 'metz', 'orleans',
  'rouen', 'mulhouse', 'caen', 'nancy', 'avignon', 'poitiers', 'dunkerque', 'aubervilliers',
  'versailles', 'colmar', 'bayonne', 'cannes', 'antibes', 'la-rochelle', 'calais', 'pau',
  'salon-de-provence', 'aubagne', 'martigues', 'arles', 'istres', 'vitrolles', 'gardanne',
  'cavaillon', 'pertuis', 'manosque', 'draguignan', 'frejus', 'hyeres', 'la-ciotat',
  'saint-remy-de-provence', 'chateaurenard', 'tarascon', 'miramas', 'fos-sur-mer',
  'aix', 'toulon', 'six-fours-les-plages', 'sanary-sur-mer', 'bandol', 'brignoles',
];

function humanize(slug: string): string {
  return slug
    .replace(/\.(html?|php|aspx?)$/i, '')
    .replace(/[_+]+/g, '-')
    .split('-')
    .filter(Boolean)
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Restaure la casse d'un toponyme : « saint-remy-de-provence » → « Saint-Remy-de-Provence ». */
function titleCaseLocality(slug: string): string {
  const small = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'sur', 'sous', 'en', 'lez', 'd']);
  return slug
    .split('-')
    .filter(Boolean)
    .map((w, i) => (i > 0 && small.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('-');
}

/**
 * Isole la localité dans un slug. Deux stratégies, dans l'ordre :
 *  1. correspondance avec une commune connue ou une localité fournie par la carte
 *     d'identité (zone de chalandise) ;
 *  2. motifs de composition de toponyme (« saint- », « -sur- », « -en-provence »).
 */
function extractLocality(slug: string, knownLocalities: string[] = []): { locality: string | null; rest: string } {
  const low = slug.toLowerCase();
  const extra = knownLocalities
    .flatMap((l) => String(l || '').split(/[,;/]/))
    .map((l) => l.trim().toLowerCase().replace(/\s+/g, '-'))
    .filter((l) => l.length >= 4);

  const candidates = [...extra, ...KNOWN_CITIES].sort((a, b) => b.length - a.length);
  for (const city of candidates) {
    const re = new RegExp(`(^|-)${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(-|$)`, 'i');
    if (re.test(low)) {
      const rest = low.replace(re, '-').replace(/^-+|-+$/g, '');
      return { locality: titleCaseLocality(city), rest };
    }
  }

  for (const pattern of LOCALITY_PATTERNS) {
    if (!pattern.test(low)) continue;
    // Le toponyme composé occupe généralement la fin du slug : on prend la plus
    // longue queue qui vérifie le motif, sans avaler le service en tête.
    const parts = low.split('-');
    for (let start = 0; start < parts.length; start++) {
      const tail = parts.slice(start).join('-');
      if (tail.length >= 4 && pattern.test(tail)) {
        return { locality: titleCaseLocality(tail), rest: parts.slice(0, start).join('-') };
      }
    }
  }
  return { locality: null, rest: low };
}

function termsOf(phrase: string): string[] {
  return humanize(phrase)
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !SLUG_STOPWORDS.has(w.toLowerCase()));
}

/**
 * Dérive la carte d'identité de page depuis l'URL auditée.
 * `meta.title` / `meta.h1` (issus du crawl) enrichissent les mots-clés d'ancrage
 * mais ne remplacent jamais le slug : c'est lui qui porte l'intention SEO.
 */
export function derivePageFocus(
  rawUrl: string,
  meta: { title?: string | null; h1?: string | null; knownLocalities?: string[] } = {},
): PageFocus {
  let path = '';
  try {
    path = new URL(rawUrl).pathname.replace(/\/+$/, '');
  } catch {
    path = '';
  }
  const segments = path.split('/').filter(Boolean).map((s) => {
    try { return decodeURIComponent(s); } catch { return s; }
  });

  if (segments.length === 0) {
    return {
      path: '',
      isHome: true,
      slugPhrase: '',
      locality: null,
      service: null,
      focusTerms: [],
      kind: 'home',
      secondaryAngle: null,
      title: meta.title ?? null,
      h1: meta.h1 ?? null,
    };
  }

  // Page avis / témoignages : la réputation devient un angle secondaire, le
  // focus est hérité du segment parent (agence ou prestation + ville).
  const isReviewPage = segments.some((s) => REVIEW_SEGMENTS.test(s.replace(/\.(html?|php|aspx?)$/i, '')));

  // Dernier segment non structurel (« /services/salle-de-bain-marseille »).
  let slug = segments[segments.length - 1];
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i].replace(/\.(html?|php|aspx?)$/i, '');
    if (STRUCTURAL_SEGMENTS.test(seg) || REVIEW_SEGMENTS.test(seg)) continue;
    if (humanize(seg).length >= 3) {
      slug = segments[i];
      break;
    }
  }
  // /avis seul (aucun parent significatif) : on ne teste pas « avis », on
  // retombe au niveau domaine plutôt que de produire un focus vide de sens.
  if (isReviewPage && REVIEW_SEGMENTS.test(slug.replace(/\.(html?|php|aspx?)$/i, ''))) {
    return {
      path,
      isHome: false,
      slugPhrase: '',
      locality: null,
      service: null,
      focusTerms: [],
      kind: 'reviews',
      secondaryAngle: 'reputation',
      title: meta.title ?? null,
      h1: meta.h1 ?? null,
    };
  }

  const { locality, rest } = extractLocality(slug.replace(/\.(html?|php|aspx?)$/i, ''), meta.knownLocalities || []);
  const service = humanize(rest) || null;
  const slugPhrase = humanize(slug);

  const focusTerms: string[] = [];
  const seen = new Set<string>();
  const pushTerm = (t: string) => {
    const key = t.toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    focusTerms.push(t);
  };
  for (const t of termsOf(rest)) pushTerm(t);
  if (locality) pushTerm(locality);
  // Title / H1 : uniquement les mots pleins absents du slug, plafonnés.
  for (const t of [...termsOf(String(meta.h1 || '')), ...termsOf(String(meta.title || ''))]) {
    if (focusTerms.length >= 10) break;
    pushTerm(t);
  }

  return {
    path,
    isHome: false,
    slugPhrase,
    locality,
    service,
    focusTerms,
    kind: isReviewPage ? 'reviews' : 'standard',
    secondaryAngle: isReviewPage ? 'reputation' : null,
    title: meta.title ?? null,
    h1: meta.h1 ?? null,
  };
}


/**
 * Besoin testable porté par la page (« salle de bain à Marseille »).
 * Renvoie '' pour la home : le benchmark reste alors au niveau domaine.
 */
export function pageFocusTopic(focus: PageFocus, lang: 'fr' | 'en' | 'es' = 'fr'): string {
  if (focus.isHome) return '';
  const service = (focus.service || '').trim();
  if (service && focus.locality) {
    const at = lang === 'en' ? 'in' : lang === 'es' ? 'en' : 'à';
    return `${service} ${at} ${focus.locality}`;
  }
  if (service) return service;
  if (focus.locality) return focus.locality;
  return focus.slugPhrase;
}

/** Suffixe de clé de cache : la mesure d'une page ne doit jamais être réutilisée pour une autre. */
export function pageScopeSuffix(focus: PageFocus): string {
  return focus.isHome ? '' : focus.path.toLowerCase();
}
