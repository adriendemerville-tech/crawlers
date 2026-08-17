/**
 * geoLexicon.ts — Lexique géographique FR déterministe (0 token LLM).
 * Sert à extraire des candidats "localisation" depuis du texte libre
 * (commercial_area, requêtes GSC, mots-clés du Keyword Universe).
 */

export interface GeoCandidate {
  /** Valeur canonique affichée et stockée (ex. "Aix-en-Provence"). */
  value: string;
  level: 'region' | 'department' | 'city';
  /** Région de rattachement pour la hiérarchie pilier/fille. */
  region?: string;
}

export const FR_REGIONS: string[] = [
  'Auvergne-Rhône-Alpes',
  'Bourgogne-Franche-Comté',
  'Bretagne',
  'Centre-Val de Loire',
  'Corse',
  'Grand Est',
  'Hauts-de-France',
  'Île-de-France',
  'Normandie',
  'Nouvelle-Aquitaine',
  'Occitanie',
  'Pays de la Loire',
  "Provence-Alpes-Côte d'Azur",
];

/** Alias fréquents (saisie utilisateur, requêtes GSC) → région canonique. */
export const REGION_ALIASES: Record<string, string> = {
  paca: "Provence-Alpes-Côte d'Azur",
  'provence alpes cote d azur': "Provence-Alpes-Côte d'Azur",
  'provence-alpes-cote-d-azur': "Provence-Alpes-Côte d'Azur",
  'cote d azur': "Provence-Alpes-Côte d'Azur",
  provence: "Provence-Alpes-Côte d'Azur",
  idf: 'Île-de-France',
  'ile de france': 'Île-de-France',
  aura: 'Auvergne-Rhône-Alpes',
  'rhone alpes': 'Auvergne-Rhône-Alpes',
  'nouvelle aquitaine': 'Nouvelle-Aquitaine',
  'hauts de france': 'Hauts-de-France',
  'grand est': 'Grand Est',
  'pays de la loire': 'Pays de la Loire',
  'centre val de loire': 'Centre-Val de Loire',
  'bourgogne franche comte': 'Bourgogne-Franche-Comté',
};

/** Villes principales par région (couverture volontairement limitée aux pôles réels). */
export const FR_CITIES_BY_REGION: Record<string, string[]> = {
  "Provence-Alpes-Côte d'Azur": [
    'Marseille', 'Nice', 'Toulon', 'Aix-en-Provence', 'Avignon', 'Antibes', 'Cannes',
    'La Seyne-sur-Mer', 'Hyères', 'Arles', 'Fréjus', 'Grasse', 'Martigues', 'Aubagne',
    'Cavaillon', 'Draguignan', 'Salon-de-Provence', 'Gap', 'Digne-les-Bains', 'Manosque',
    'Vitrolles', 'Istres', 'Menton', 'Le Cannet', 'Brignoles', 'Carpentras', 'Orange',
  ],
  'Île-de-France': [
    'Paris', 'Boulogne-Billancourt', 'Saint-Denis', 'Argenteuil', 'Montreuil', 'Nanterre',
    'Créteil', 'Versailles', 'Vitry-sur-Seine', 'Colombes', 'Asnières-sur-Seine', 'Courbevoie',
    'Cergy', 'Évry-Courcouronnes', 'Meaux', 'Melun', 'Levallois-Perret', 'Issy-les-Moulineaux',
  ],
  'Auvergne-Rhône-Alpes': [
    'Lyon', 'Saint-Étienne', 'Grenoble', 'Villeurbanne', 'Clermont-Ferrand', 'Valence',
    'Chambéry', 'Annecy', 'Vénissieux', 'Bourg-en-Bresse', 'Roanne', 'Vichy', 'Aurillac',
  ],
  Occitanie: [
    'Toulouse', 'Montpellier', 'Nîmes', 'Perpignan', 'Béziers', 'Narbonne', 'Albi',
    'Carcassonne', 'Sète', 'Tarbes', 'Castres', 'Alès', 'Montauban', 'Rodez',
  ],
  'Nouvelle-Aquitaine': [
    'Bordeaux', 'Limoges', 'Poitiers', 'Pau', 'La Rochelle', 'Mérignac', 'Pessac',
    'Bayonne', 'Angoulême', 'Niort', 'Agen', 'Périgueux', 'Biarritz', 'Brive-la-Gaillarde',
  ],
  'Hauts-de-France': [
    'Lille', 'Amiens', 'Roubaix', 'Tourcoing', 'Dunkerque', 'Calais', 'Villeneuve-d\u2019Ascq',
    'Saint-Quentin', 'Beauvais', 'Valenciennes', 'Boulogne-sur-Mer', 'Compiègne', 'Arras',
  ],
  'Grand Est': [
    'Strasbourg', 'Reims', 'Metz', 'Nancy', 'Mulhouse', 'Colmar', 'Troyes', 'Charleville-Mézières',
    'Châlons-en-Champagne', 'Épinal', 'Haguenau', 'Thionville',
  ],
  'Pays de la Loire': [
    'Nantes', 'Angers', 'Le Mans', 'Saint-Nazaire', 'Cholet', 'La Roche-sur-Yon', 'Laval',
    'Saint-Herblain', 'Rezé',
  ],
  Bretagne: [
    'Rennes', 'Brest', 'Quimper', 'Lorient', 'Vannes', 'Saint-Malo', 'Saint-Brieuc', 'Lanester',
  ],
  Normandie: [
    'Le Havre', 'Rouen', 'Caen', 'Cherbourg-en-Cotentin', 'Évreux', 'Dieppe', 'Alençon', 'Lisieux',
  ],
  'Centre-Val de Loire': [
    'Tours', 'Orléans', 'Bourges', 'Blois', 'Chartres', 'Châteauroux', 'Dreux', 'Vierzon',
  ],
  'Bourgogne-Franche-Comté': [
    'Dijon', 'Besançon', 'Belfort', 'Chalon-sur-Saône', 'Nevers', 'Auxerre', 'Mâcon', 'Sens',
  ],
  Corse: ['Ajaccio', 'Bastia', 'Porto-Vecchio', 'Corte'],
};

/** Normalise pour comparaison : minuscules, sans accents, tirets → espaces. */
export function normalizeGeo(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let CITY_INDEX: Map<string, GeoCandidate> | null = null;
let REGION_INDEX: Map<string, GeoCandidate> | null = null;

function buildIndexes() {
  if (CITY_INDEX && REGION_INDEX) return;
  CITY_INDEX = new Map();
  REGION_INDEX = new Map();
  for (const region of FR_REGIONS) {
    REGION_INDEX.set(normalizeGeo(region), { value: region, level: 'region' });
  }
  for (const [alias, region] of Object.entries(REGION_ALIASES)) {
    REGION_INDEX.set(normalizeGeo(alias), { value: region, level: 'region' });
  }
  for (const [region, cities] of Object.entries(FR_CITIES_BY_REGION)) {
    for (const city of cities) {
      CITY_INDEX.set(normalizeGeo(city), { value: city, level: 'city', region });
    }
  }
}

/**
 * Extrait les localisations mentionnées dans un texte libre.
 * Purement lexical : aucune inférence, aucun appel réseau.
 */
export function extractGeoCandidates(text: string): GeoCandidate[] {
  buildIndexes();
  const haystack = ` ${normalizeGeo(text)} `;
  const found = new Map<string, GeoCandidate>();

  for (const [key, candidate] of REGION_INDEX!) {
    if (haystack.includes(` ${key} `)) found.set(`region:${candidate.value}`, candidate);
  }
  for (const [key, candidate] of CITY_INDEX!) {
    if (haystack.includes(` ${key} `)) found.set(`city:${candidate.value}`, candidate);
  }
  return [...found.values()];
}

/** Région de rattachement d'une ville connue, sinon null. */
export function regionOfCity(city: string): string | null {
  buildIndexes();
  return CITY_INDEX!.get(normalizeGeo(city))?.region ?? null;
}

/** Villes connues d'une région (pour proposer une expansion cohérente). */
export function citiesOfRegion(region: string): string[] {
  const canonical = REGION_ALIASES[normalizeGeo(region)] ?? region;
  return FR_CITIES_BY_REGION[canonical] ?? [];
}
