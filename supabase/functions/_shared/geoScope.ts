/**
 * _shared/geoScope.ts
 *
 * Résolution DÉTERMINISTE de la zone de chalandise réellement testable, puis
 * formulation grammaticalement correcte des mentions géographiques dans les
 * questions de benchmark LLM.
 *
 * Deux étages strictement séparés :
 *   1. `resolveGeoScope` : à partir des preuves disponibles (localité de la page
 *      auditée, ville GMB, code postal de l'adresse, zone déclarée), produit un
 *      périmètre TYPÉ ou `null`. Aucune invention : si rien n'est prouvé, on
 *      retourne `null` et AUCUNE question localisée n'est produite.
 *   2. `geoPhrase` : rend la mention (« à Chantilly », « dans l'Oise »,
 *      « en Île-de-France ») avec la bonne préposition et le bon article, issus
 *      d'une table, jamais devinés par un LLM.
 *
 * Règles produit (décidées avec l'utilisateur) :
 *   - Pas de localité prouvée → pas de question localisée du tout.
 *   - Zone déclarée large ou floue (« France entière », « Europe », « toute la
 *     région ») → pas de question localisée : on ne fabrique pas une zone.
 *   - « autour de » / « dans le secteur de » sont réservés aux activités qui se
 *     déplacent. Pour un point de vente, un prospect dit « à VILLE ».
 *
 * Aucun appel LLM, aucun accès réseau : coût nul, sortie reproductible (donc
 * compatible avec l'empreinte de cache des benchmarks).
 */

export type GeoScopeKind = 'city' | 'department' | 'region';

export interface GeoScope {
  kind: GeoScopeKind;
  /** Libellé exact à insérer dans la question (« Chantilly », « Oise »). */
  label: string;
  /** Origine de la preuve, pour la traçabilité dans le rapport. */
  source: 'page' | 'gmb' | 'postal_code' | 'declared_area';
  /** true si l'activité se déplace : autorise « autour de » / « secteur de ». */
  mobile: boolean;
  /** Département déduit, quand il est connu et différent du label. */
  department?: string;
}

// ───────────────────────────────────────────────
// Zones non testables : trop larges ou non géographiques
// ───────────────────────────────────────────────

/**
 * « France » seul disqualifie ; « Île-de-France » ou « Nouvelle-Aquitaine »
 * restent des régions valides (la lookahead/lookbehind évite le faux positif).
 */
const BROAD_AREA_RE =
  /(?<![\w-])(france\s+enti[eè]re|toute\s+la\s+france|france|international\w*|mondial\w*|monde|europe|europ[eé]en\w*|national\w*|worldwide|global\w*|en\s+ligne|online|remote|[àa]\s+distance|partout|toute\s+la\s+r[eé]gion|plusieurs\s+r[eé]gions|multi[-\s]?r[eé]gional)(?![\w-])/i;

/** true si la chaîne décrit une zone trop large pour une question localisée. */
export function isBroadArea(area: string): boolean {
  const a = (area || '').trim();
  if (!a) return true;
  return BROAD_AREA_RE.test(a);
}

// ───────────────────────────────────────────────
// Départements français : article + préfixe postal
// ───────────────────────────────────────────────

type Article = 'le' | 'la' | 'les' | "l'";

/** code INSEE → [nom, article]. Utilisé pour la préposition et le repli postal. */
const DEPARTMENTS: Record<string, [string, Article]> = {
  '01': ['Ain', "l'"], '02': ['Aisne', "l'"], '03': ['Allier', "l'"],
  '04': ['Alpes-de-Haute-Provence', 'les'], '05': ['Hautes-Alpes', 'les'],
  '06': ['Alpes-Maritimes', 'les'], '07': ['Ardèche', "l'"], '08': ['Ardennes', 'les'],
  '09': ['Ariège', "l'"], '10': ['Aube', "l'"], '11': ['Aude', "l'"], '12': ['Aveyron', "l'"],
  '13': ['Bouches-du-Rhône', 'les'], '14': ['Calvados', 'le'], '15': ['Cantal', 'le'],
  '16': ['Charente', 'la'], '17': ['Charente-Maritime', 'la'], '18': ['Cher', 'le'],
  '19': ['Corrèze', 'la'], '2a': ['Corse-du-Sud', 'la'], '2b': ['Haute-Corse', 'la'],
  '21': ["Côte-d'Or", 'la'], '22': ["Côtes-d'Armor", 'les'], '23': ['Creuse', 'la'],
  '24': ['Dordogne', 'la'], '25': ['Doubs', 'le'], '26': ['Drôme', 'la'], '27': ['Eure', "l'"],
  '28': ['Eure-et-Loir', "l'"], '29': ['Finistère', 'le'], '30': ['Gard', 'le'],
  '31': ['Haute-Garonne', 'la'], '32': ['Gers', 'le'], '33': ['Gironde', 'la'],
  '34': ['Hérault', "l'"], '35': ['Ille-et-Vilaine', "l'"], '36': ['Indre', "l'"],
  '37': ['Indre-et-Loire', "l'"], '38': ['Isère', "l'"], '39': ['Jura', 'le'],
  '40': ['Landes', 'les'], '41': ['Loir-et-Cher', 'le'], '42': ['Loire', 'la'],
  '43': ['Haute-Loire', 'la'], '44': ['Loire-Atlantique', 'la'], '45': ['Loiret', 'le'],
  '46': ['Lot', 'le'], '47': ['Lot-et-Garonne', 'le'], '48': ['Lozère', 'la'],
  '49': ['Maine-et-Loire', 'le'], '50': ['Manche', 'la'], '51': ['Marne', 'la'],
  '52': ['Haute-Marne', 'la'], '53': ['Mayenne', 'la'], '54': ['Meurthe-et-Moselle', 'la'],
  '55': ['Meuse', 'la'], '56': ['Morbihan', 'le'], '57': ['Moselle', 'la'],
  '58': ['Nièvre', 'la'], '59': ['Nord', 'le'], '60': ['Oise', "l'"], '61': ['Orne', "l'"],
  '62': ['Pas-de-Calais', 'le'], '63': ['Puy-de-Dôme', 'le'],
  '64': ['Pyrénées-Atlantiques', 'les'], '65': ['Hautes-Pyrénées', 'les'],
  '66': ['Pyrénées-Orientales', 'les'], '67': ['Bas-Rhin', 'le'], '68': ['Haut-Rhin', 'le'],
  '69': ['Rhône', 'le'], '70': ['Haute-Saône', 'la'], '71': ['Saône-et-Loire', 'la'],
  '72': ['Sarthe', 'la'], '73': ['Savoie', 'la'], '74': ['Haute-Savoie', 'la'],
  '75': ['Paris', 'le'], '76': ['Seine-Maritime', 'la'], '77': ['Seine-et-Marne', 'la'],
  '78': ['Yvelines', 'les'], '79': ['Deux-Sèvres', 'les'], '80': ['Somme', 'la'],
  '81': ['Tarn', 'le'], '82': ['Tarn-et-Garonne', 'le'], '83': ['Var', 'le'],
  '84': ['Vaucluse', 'le'], '85': ['Vendée', 'la'], '86': ['Vienne', 'la'],
  '87': ['Haute-Vienne', 'la'], '88': ['Vosges', 'les'], '89': ['Yonne', "l'"],
  '90': ['Territoire de Belfort', 'le'], '91': ['Essonne', "l'"],
  '92': ['Hauts-de-Seine', 'les'], '93': ['Seine-Saint-Denis', 'la'],
  '94': ['Val-de-Marne', 'le'], '95': ["Val-d'Oise", 'le'],
  '971': ['Guadeloupe', 'la'], '972': ['Martinique', 'la'], '973': ['Guyane', 'la'],
  '974': ['La Réunion', 'la'], '976': ['Mayotte', 'la'],
};

/** Régions françaises : la préposition est « en » sauf indication contraire. */
const REGIONS: Record<string, 'en' | 'dans le' | 'dans les'> = {
  'auvergne-rhône-alpes': 'en',
  'bourgogne-franche-comté': 'en',
  'bretagne': 'en',
  'centre-val de loire': 'en',
  'corse': 'en',
  'grand est': 'dans le',
  'hauts-de-france': 'dans les',
  'île-de-france': 'en',
  'ile-de-france': 'en',
  'normandie': 'en',
  'nouvelle-aquitaine': 'en',
  'occitanie': 'en',
  'pays de la loire': 'en',
  "provence-alpes-côte d'azur": 'en',
  'provence': 'en',
};

const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const DEPT_BY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(DEPARTMENTS).map(([code, [name]]) => [norm(name), code]),
);

const REGION_BY_NAME: Record<string, string> = Object.fromEntries(
  Object.keys(REGIONS).map((name) => [norm(name), name]),
);

/** Activités qui se déplacent : seules elles autorisent « autour de ». */
const MOBILE_SIGNAL_RE =
  /travaux|r[eé]novation|chantier|artisan|installation|d[eé]pannage|entretien|plomb|[eé]lectric|couvreur|toiture|isolation|ma[çc]on|peintre|jardin|paysag|serrur|d[eé]m[eé]nag|livraison|intervention|domicile|mobile|taxi|vtc|ambulance|coursier/i;

/** Points de vente : « à VILLE » uniquement, jamais « autour de ». */
const VENUE_SIGNAL_RE =
  /boutique|magasin|restaurant|h[oô]tel|caf[eé]|bar|salon|cabinet|clinique|pharmacie|garage|showroom|agence|librairie|boulangerie/i;

// ───────────────────────────────────────────────
// Résolution
// ───────────────────────────────────────────────

/** Nettoie un libellé de lieu : retire « et alentours », listes, parenthèses. */
function cleanPlace(raw: string): string {
  return (raw || '')
    .replace(/\(.*?\)/g, ' ')
    .split(/[,;/|]| et | & /i)[0]
    .replace(/\b(et\s+)?(ses\s+)?(alentours?|environs?|p[eé]riph[eé]rie|agglom[eé]ration|secteur|r[eé]gion\s+de|autour\s+de|proche\s+de)\b/gi, ' ')
    .replace(/\b\d{5}\b/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Département déduit d'un code postal français (gère la Corse et l'outre-mer). */
export function departmentFromPostalCode(input: string): { code: string; name: string } | null {
  const m = String(input || '').match(/\b(\d{5})\b/);
  if (!m) return null;
  const cp = m[1];
  // Corse : 20000-20190 → Corse-du-Sud, au-delà → Haute-Corse.
  const code = cp.startsWith('97') || cp.startsWith('98')
    ? cp.slice(0, 3)
    : cp.startsWith('20')
      ? (Number(cp) <= 20190 ? '2a' : '2b')
      : cp.slice(0, 2);
  const hit = DEPARTMENTS[code] || DEPARTMENTS[code.toLowerCase()];
  return hit ? { code: code.toUpperCase(), name: hit[0] } : null;
}

/** Classe un libellé nettoyé : région connue, département connu, sinon ville. */
function classify(place: string): { kind: GeoScopeKind; label: string } | null {
  const p = cleanPlace(place);
  if (!p || p.length < 2) return null;
  const n = norm(p);
  if (REGION_BY_NAME[n]) {
    // Le libellé saisi est conservé tel quel (casse et accents d'origine).
    return { kind: 'region', label: p };
  }
  if (DEPT_BY_NAME[n]) return { kind: 'department', label: DEPARTMENTS[DEPT_BY_NAME[n]][0] };
  // Un libellé composé de chiffres seuls n'est pas un lieu.
  if (/^\d+$/.test(n)) return null;
  return { kind: 'city', label: p };
}

export interface GeoScopeInput {
  /** Localité extraite de l'URL auditée (slug, title, H1). Preuve la plus forte. */
  pageLocality?: string | null;
  /** Ville de la fiche Google Business, quand elle est connectée. */
  gmbCity?: string | null;
  /** Adresse structurée du site (schema.org PostalAddress ou mentions légales). */
  address?: string | null;
  /** Zone déclarée dans la carte d'identité. */
  commercialArea?: string | null;
  /** Offre / secteur, pour décider si l'activité se déplace. */
  activityBlob?: string | null;
}

/**
 * Retourne le périmètre testable, ou `null` quand aucune localité n'est prouvée.
 * Ordre de preuve : page auditée > ville GMB > code postal > zone déclarée.
 * La page l'emporte sur le domaine : c'est ce qui rend les benchmarks propres
 * à chaque URL dans un audit multipages.
 */
export function resolveGeoScope(input: GeoScopeInput): GeoScope | null {
  const activity = String(input.activityBlob || '');
  // Un point de vente ancre le prospect sur la commune ; seule une activité qui
  // se déplace justifie « autour de » ou « dans le secteur de ».
  const mobile = MOBILE_SIGNAL_RE.test(activity) && !VENUE_SIGNAL_RE.test(activity);

  const candidates: Array<{ raw: string; source: GeoScope['source'] }> = [];
  if (input.pageLocality) candidates.push({ raw: String(input.pageLocality), source: 'page' });
  if (input.gmbCity) candidates.push({ raw: String(input.gmbCity), source: 'gmb' });

  for (const c of candidates) {
    if (isBroadArea(c.raw)) continue;
    const cls = classify(c.raw);
    if (cls) return { ...cls, source: c.source, mobile };
  }

  // Code postal : ne donne jamais une ville, seulement un département fiable.
  const dept = departmentFromPostalCode(String(input.address || ''));
  if (dept) return { kind: 'department', label: dept.name, source: 'postal_code', mobile };

  const declared = String(input.commercialArea || '');
  // Zone large ou floue : on supprime la question localisée, on n'invente pas.
  if (declared && !isBroadArea(declared)) {
    const cls = classify(declared);
    if (cls) return { ...cls, source: 'declared_area', mobile };
  }

  return null;
}

// ───────────────────────────────────────────────
// Formulation
// ───────────────────────────────────────────────

/** Variantes autorisées, par type de périmètre et par mobilité de l'activité. */
function variantsFor(scope: GeoScope): string[] {
  // Département et région : une seule tournure possible sans casser la
  // grammaire (« dans le secteur de l'Oise » ne se dit pas). La rotation des
  // formulations n'a de sens qu'au niveau d'une commune.
  if (scope.kind === 'region') return ['region_in'];
  if (scope.kind === 'department') return ['dept_in'];
  return scope.mobile ? ['city_at', 'city_around', 'city_sector'] : ['city_at', 'city_center'];
}

function frenchDepartmentPhrase(label: string): string {
  const code = DEPT_BY_NAME[norm(label)];
  const article = code ? DEPARTMENTS[code][1] : 'le';
  if (label === 'Paris') return 'à Paris';
  if (article === "l'") return `dans l'${label}`;
  if (article === 'les') return `dans les ${label}`;
  if (article === 'la') return `dans la ${label}`;
  return `dans le ${label}`;
}

function regionPhrase(label: string): string {
  const key = Object.keys(REGIONS).find((r) => norm(r) === norm(label));
  const prep = key ? REGIONS[key] : 'en';
  return `${prep} ${label}`;
}

/**
 * Mention géographique prête à insérer, SANS espace de tête.
 * `seed` (index de la question) fait tourner les tournures de façon
 * déterministe : deux exécutions du même audit produisent les mêmes questions.
 */
export function geoPhrase(scope: GeoScope, lang: 'fr' | 'en' | 'es' = 'fr', seed = 0): string {
  const label = scope.label;

  if (lang === 'en') {
    if (scope.kind === 'city') return seed % 2 === 0 ? `in ${label}` : `around ${label}`;
    return `in ${label}`;
  }
  if (lang === 'es') {
    if (scope.kind === 'city') return seed % 2 === 0 ? `en ${label}` : `cerca de ${label}`;
    return `en ${label}`;
  }

  const variants = variantsFor(scope);
  const variant = variants[Math.abs(seed) % variants.length];
  switch (variant) {
    case 'city_at': return `à ${label}`;
    case 'city_around': return `autour de ${label}`;
    case 'city_sector': return `dans le secteur de ${label}`;
    case 'city_center': return `dans le centre de ${label}`;
    case 'dept_in': return frenchDepartmentPhrase(label);
    case 'dept_sector': return `dans le secteur de ${label}`;
    case 'region_in': return regionPhrase(label);
    case 'region_area': return `dans la région de ${label}`;
    default: return `à ${label}`;
  }
}

/** Libellé lisible du périmètre pour la traçabilité du rapport. */
export function describeGeoScope(scope: GeoScope): string {
  const kind = scope.kind === 'city' ? 'ville' : scope.kind === 'department' ? 'département' : 'région';
  const src = scope.source === 'page'
    ? 'localité de la page auditée'
    : scope.source === 'gmb'
      ? 'fiche Google Business'
      : scope.source === 'postal_code'
        ? 'code postal de l’adresse'
        : 'zone déclarée';
  return `${scope.label} (${kind}, source : ${src})`;
}
