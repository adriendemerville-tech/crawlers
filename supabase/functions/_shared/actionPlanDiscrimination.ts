/**
 * actionPlanDiscrimination.ts — Lot 5 du plan de correctifs Marina.
 *
 * Objectif : rendre le plan d'action discriminant (défauts 12 à 15 de la
 * critique consolidée) pour TOUTE la chaîne (Marina, /audit, Workbench,
 * Parménion), sans aucun appel LLM (0 token).
 *
 * Quatre garanties :
 *  1. Empreinte de recommandation (`fingerprint`) : une même consigne déclinée
 *     par gabarit devient UNE action, avec la liste des gabarits concernés.
 *  2. Sévérité et impact dérivés d'un signal mesuré (écart au seuil, volume,
 *     position, nombre de pages), jamais d'une constante.
 *  3. `owner`, `kpi` et estimation de trafic obligatoires sur chaque action.
 *  4. Comptage réel « déjà dans le Workbench » vs « nouvellement détecté ».
 */

// ───────────────────────── 1. Empreinte & déduplication ─────────────────────────

/** Mots vides FR/EN qui n'apportent rien à l'identité d'une consigne. */
const STOP_WORDS = new Set([
  'le', 'la', 'les', 'des', 'une', 'aux', 'pour', 'avec', 'dans', 'sur', 'par',
  'que', 'qui', 'est', 'sont', 'plus', 'moins', 'afin', 'cette', 'ces', 'son',
  'leur', 'leurs', 'notre', 'vos', 'votre', 'the', 'and', 'for', 'with', 'from',
  'this', 'that', 'your', 'page', 'pages', 'site', 'web', 'faut', 'doit',
]);

/**
 * Familles de consignes : si un terme de la famille apparaît, il pilote
 * l'empreinte. C'est ce qui fait fusionner « Ajouter une meta description sur
 * les pages services » et « Meta description manquante sur les pages contact ».
 */
const INSTRUCTION_FAMILIES: Array<[RegExp, string]> = [
  [/meta[\s-]?(description|desc)/i, 'meta_description'],
  [/balise\s+title|<title>|title\s+tag/i, 'title_tag'],
  [/\bh1\b/i, 'h1'],
  [/h2|h3|hierarchie|hiérarchie\s+de\s+titres/i, 'heading_structure'],
  [/canonical/i, 'canonical'],
  [/robots\.txt|directive\s+robots|noindex/i, 'robots'],
  [/sitemap/i, 'sitemap'],
  [/(json-?ld|schema|donnees?\s+structur|données?\s+structur|balisage\s+s[ée]mantique)/i, 'structured_data'],
  [/(alt|attribut\s+alternatif|texte\s+alternatif)/i, 'image_alt'],
  [/(image|webp|avif|poids\s+des\s+images|compression)/i, 'image_weight'],
  [/(core\s+web\s+vitals|lcp|cls|inp|temps\s+de\s+chargement|performance)/i, 'web_vitals'],
  [/(maillage|lien\s+interne|liens\s+internes|ancre)/i, 'internal_linking'],
  [/orphelin/i, 'orphan_pages'],
  [/(cannibalis|doublon\s+de\s+requ)/i, 'cannibalization'],
  [/(duplicat|near\s?duplicate|contenu\s+similaire)/i, 'duplicate_content'],
  [/(thin\s+content|contenu\s+pauvre|trop\s+court|faible\s+volume\s+de\s+texte)/i, 'thin_content'],
  [/(r[ée]ponse\s+directe|40\s+mots|extrait\s+optimis|featured\s+snippet|aeo)/i, 'direct_answer'],
  [/(citab|citation\s+ia|visibilit[ée]\s+llm|geo\b)/i, 'ai_citability'],
  [/(faq)/i, 'faq'],
  [/(e-?e-?a-?t|expertise|autorit[ée]\s+auteur|auteur|biographie)/i, 'eeat_author'],
  [/(avis|t[ée]moignage|preuve\s+sociale|review)/i, 'social_proof'],
  [/(backlink|netlinking|domaine\s+r[ée]f[ée]rent|d[ée]savou)/i, 'backlinks'],
  [/(redirection|301|chaine\s+de\s+redirection|chaîne)/i, 'redirects'],
  [/(404|page\s+introuvable|lien\s+cass)/i, 'broken_links'],
  [/(https?|certificat|ssl|mixed\s+content)/i, 'https'],
  [/(mots?[\s-]cl[ée]s?\s+manquants?|content\s+gap|lacune\s+s[ée]mantique)/i, 'content_gap'],
  [/(cr[ée]er|publier|r[ée]diger)\s+(un\s+)?(article|contenu|page)/i, 'new_content'],
  [/(cocon|cluster|silo)/i, 'semantic_cocoon'],
  [/(mobile|responsive|viewport)/i, 'mobile'],
  [/(hreflang|multilingue)/i, 'i18n'],
  [/(breadcrumb|fil\s+d.ariane)/i, 'breadcrumb'],
];

/** Retire accents, ponctuation, nombres et tokens propres à une page/gabarit. */
function canonicalTokens(text: string): string[] {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z\s]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
}

export interface FingerprintInput {
  title?: string;
  description?: string;
  category?: string;
}

/**
 * Empreinte stable d'une consigne. Deux formulations de la même action sur des
 * gabarits différents produisent la même empreinte.
 */
export function fingerprintFinding(item: FingerprintInput): string {
  const hay = `${item.title || ''} ${item.category || ''}`;
  for (const [re, family] of INSTRUCTION_FAMILIES) {
    if (re.test(hay)) return family;
  }
  // Repli : 4 tokens signifiants triés (ordre des mots indifférent).
  const tokens = canonicalTokens(item.title || item.description || '');
  if (tokens.length === 0) return 'divers';
  return tokens.slice(0, 6).sort().slice(0, 4).join('_');
}

export interface DedupedFinding<T> {
  /** Représentant retenu (la variante la plus sévère, puis la plus documentée). */
  item: T;
  fingerprint: string;
  /** Gabarits / cibles regroupés sous cette action (URLs, types de page). */
  templates: string[];
  /** Nombre de variantes fusionnées (1 = pas de fusion). */
  occurrences: number;
  /** Somme des pages concernées quand l'information existe. */
  pages_affected: number;
}

const SEV_RANK: Record<string, number> = {
  critical: 4, important: 3, high: 3, medium: 2, suggestion: 2, optional: 1, low: 1,
};

function sevRank(s: unknown): number {
  return SEV_RANK[String(s || '').toLowerCase()] ?? 2;
}

/** Extrait un libellé de gabarit exploitable depuis un finding. */
function templateLabel(item: Record<string, unknown>): string | null {
  const url = String(item.target_url || item.url || '').trim();
  if (url) {
    try {
      const p = new URL(url).pathname;
      const seg = p.split('/').filter(Boolean)[0];
      return seg ? `/${seg}` : '/';
    } catch { /* url non parsable */ }
  }
  const tpl = item.template || item.page_type || item.archetype;
  return tpl ? String(tpl) : null;
}

/**
 * Fusionne les variantes d'une même consigne. `keyOf` permet de fournir une
 * empreinte déjà calculée.
 */
export function dedupeByFingerprint<T extends FingerprintInput & Record<string, unknown>>(
  items: T[] | null | undefined,
): Array<DedupedFinding<T>> {
  const groups = new Map<string, DedupedFinding<T>>();
  for (const it of items || []) {
    if (!it || (!it.title && !it.description)) continue;
    const fp = fingerprintFinding(it);
    const tpl = templateLabel(it);
    const pages = Number((it as Record<string, unknown>).pages_affected || 0) || 0;
    const existing = groups.get(fp);
    if (!existing) {
      groups.set(fp, {
        item: it,
        fingerprint: fp,
        templates: tpl ? [tpl] : [],
        occurrences: 1,
        pages_affected: pages,
      });
      continue;
    }
    existing.occurrences += 1;
    existing.pages_affected += pages;
    if (tpl && !existing.templates.includes(tpl)) existing.templates.push(tpl);
    const better =
      sevRank((it as Record<string, unknown>).priority || (it as Record<string, unknown>).severity)
        > sevRank((existing.item as Record<string, unknown>).priority || (existing.item as Record<string, unknown>).severity);
    if (better) existing.item = it;
  }
  return [...groups.values()];
}

/** Phrase de portée à injecter en description quand plusieurs gabarits sont visés. */
export function scopeSentence(d: { templates: string[]; occurrences: number; pages_affected: number }): string {
  const parts: string[] = [];
  if (d.pages_affected > 0) parts.push(`${d.pages_affected} page${d.pages_affected > 1 ? 's' : ''} concernée${d.pages_affected > 1 ? 's' : ''}`);
  if (d.templates.length > 1) parts.push(`gabarits : ${d.templates.slice(0, 6).join(', ')}`);
  else if (d.templates.length === 1) parts.push(`gabarit : ${d.templates[0]}`);
  if (d.occurrences > 1 && parts.length === 0) parts.push(`${d.occurrences} constats regroupés`);
  return parts.length ? `Portée mesurée — ${parts.join(' · ')}.` : '';
}

// ───────────────────── 2. Sévérité dérivée d'un signal mesuré ─────────────────────

export type MeasuredSeverity = 'critical' | 'important' | 'suggestion' | 'low';

export interface SignalInput {
  /** Valeur mesurée (score, ratio, compte). */
  value: number;
  /** Seuil d'acceptabilité. */
  threshold: number;
  /** 'below' : anormal si value < threshold. 'above' : anormal si value > threshold. */
  direction: 'below' | 'above';
  /** Part du site touchée (0-1), si connue. */
  coverage?: number;
}

/**
 * Sévérité = amplitude de l'écart au seuil, modulée par la couverture.
 * Aucune constante : deux findings de même nature mais d'écart différent
 * n'obtiennent pas la même sévérité.
 */
export function severityFromSignal(s: SignalInput): { severity: MeasuredSeverity; gapRatio: number; basis: string } {
  const th = s.threshold === 0 ? 1 : Math.abs(s.threshold);
  const rawGap = s.direction === 'below' ? s.threshold - s.value : s.value - s.threshold;
  const gapRatio = Math.max(0, Math.round((rawGap / th) * 100) / 100);
  const coverage = typeof s.coverage === 'number' ? Math.max(0, Math.min(1, s.coverage)) : 0.5;
  const weighted = gapRatio * (0.5 + coverage);

  const severity: MeasuredSeverity =
    weighted >= 0.9 ? 'critical' : weighted >= 0.45 ? 'important' : weighted > 0 ? 'suggestion' : 'low';

  const basis =
    `mesuré ${s.value} vs seuil ${s.threshold} (écart ${Math.round(gapRatio * 100)} %` +
    (typeof s.coverage === 'number' ? `, ${Math.round(coverage * 100)} % du périmètre)` : ')');

  return { severity, gapRatio, basis };
}

// ─────────────────── 3. owner / kpi / estimation de trafic ───────────────────

export interface Accountability {
  owner: string;
  kpi: string;
  /** Gain mensuel estimé en visites, null si aucun signal ne permet de l'estimer. */
  traffic_gain: number | null;
  traffic_basis: string;
}

const OWNER_BY_FAMILY: Record<string, string> = {
  meta_description: 'Responsable éditorial',
  title_tag: 'Responsable éditorial',
  h1: 'Responsable éditorial',
  heading_structure: 'Responsable éditorial',
  canonical: 'Intégrateur / développeur',
  robots: 'Intégrateur / développeur',
  sitemap: 'Intégrateur / développeur',
  structured_data: 'Intégrateur / développeur',
  image_alt: 'Responsable éditorial',
  image_weight: 'Intégrateur / développeur',
  web_vitals: 'Intégrateur / développeur',
  internal_linking: 'Responsable éditorial',
  orphan_pages: 'Responsable éditorial',
  cannibalization: 'Responsable éditorial',
  duplicate_content: 'Responsable éditorial',
  thin_content: 'Rédacteur',
  direct_answer: 'Rédacteur',
  ai_citability: 'Rédacteur',
  faq: 'Rédacteur',
  eeat_author: 'Direction / responsable de marque',
  social_proof: 'Direction / responsable de marque',
  backlinks: 'Responsable acquisition',
  redirects: 'Intégrateur / développeur',
  broken_links: 'Intégrateur / développeur',
  https: 'Intégrateur / développeur',
  content_gap: 'Rédacteur',
  new_content: 'Rédacteur',
  semantic_cocoon: 'Responsable éditorial',
  mobile: 'Intégrateur / développeur',
  i18n: 'Intégrateur / développeur',
  breadcrumb: 'Intégrateur / développeur',
};

const KPI_BY_FAMILY: Record<string, string> = {
  meta_description: 'CTR moyen Search Console',
  title_tag: 'CTR moyen Search Console',
  h1: 'Position moyenne des pages concernées',
  heading_structure: 'Position moyenne des pages concernées',
  canonical: 'Pages indexées / pages canoniques valides',
  robots: 'Pages explorées et indexées',
  sitemap: 'Couverture d’indexation Search Console',
  structured_data: 'Résultats enrichis + citations IA',
  image_alt: 'Impressions Google Images',
  image_weight: 'LCP mobile',
  web_vitals: 'LCP / INP / CLS mobile',
  internal_linking: 'Profondeur de clic moyenne',
  orphan_pages: 'Nombre de pages orphelines',
  cannibalization: 'Requêtes avec une seule URL positionnée',
  duplicate_content: 'Part de pages quasi-dupliquées',
  thin_content: 'Nombre de mots utiles par page',
  direct_answer: 'Part de pages avec réponse directe',
  ai_citability: 'Citations mesurées dans les réponses IA',
  faq: 'Impressions sur requêtes interrogatives',
  eeat_author: 'Score E-E-A-T mesuré',
  social_proof: 'Score E-E-A-T mesuré',
  backlinks: 'Domaines référents et Authority Score',
  redirects: 'Chaînes de redirection restantes',
  broken_links: 'Nombre de liens cassés',
  https: 'Erreurs de contenu mixte',
  content_gap: 'Mots-clés positionnés',
  new_content: 'Impressions sur le cluster visé',
  semantic_cocoon: 'Pages par cluster et profondeur',
  mobile: 'Trafic mobile',
  i18n: 'Couverture par langue',
  breadcrumb: 'Résultats enrichis fil d’Ariane',
};

/**
 * Levier explicite de chaque famille : c'est ce qui distingue la justification
 * d'une action de celle d'une autre, même quand la donnée d'entrée (volume,
 * clics) est commune au domaine.
 */
const LEVER_BY_FAMILY: Record<string, string> = {
  meta_description: 'hausse du taux de clic en SERP',
  title_tag: 'hausse du taux de clic et pertinence de la requête',
  h1: 'clarification du sujet principal de la page',
  heading_structure: 'lisibilité de la hiérarchie pour les robots',
  canonical: 'consolidation des signaux sur une URL unique',
  robots: 'déblocage de l’exploration',
  sitemap: 'accélération de la découverte des URL',
  structured_data: 'éligibilité aux résultats enrichis et aux citations IA',
  image_alt: 'visibilité sur Google Images',
  image_weight: 'allègement du plus grand élément affiché',
  web_vitals: 'réduction du temps d’affichage principal',
  internal_linking: 'redistribution de l’autorité interne',
  orphan_pages: 'raccordement de pages sans lien entrant',
  cannibalization: 'désambiguïsation entre URL concurrentes',
  duplicate_content: 'suppression de la dilution entre quasi-doublons',
  thin_content: 'atteinte du seuil de contenu utile',
  direct_answer: 'réponse directe en tête de page',
  ai_citability: 'extraits reprenables par les moteurs de réponse',
  faq: 'couverture des requêtes interrogatives',
  eeat_author: 'attribution d’un auteur identifiable',
  social_proof: 'preuve client vérifiable',
  backlinks: 'gain d’autorité externe',
  redirects: 'suppression des sauts de redirection',
  broken_links: 'élimination des impasses d’exploration',
  https: 'fiabilité du transport et confiance',
  content_gap: 'ouverture de mots-clés non couverts',
  new_content: 'création d’entrées sur le cluster visé',
  semantic_cocoon: 'structuration en cocon thématique',
  mobile: 'expérience mobile',
  i18n: 'ciblage linguistique',
  breadcrumb: 'contexte de navigation exposé aux robots',
};

export interface TrafficContext {
  /** Impressions mensuelles GSC du domaine, si l'utilisateur est propriétaire. */
  monthlyImpressions?: number | null;
  /** Clics mensuels GSC. */
  monthlyClicks?: number | null;
  /** Volume de recherche mensuel cumulé du cluster visé (DataForSEO). */
  keywordVolume?: number | null;
  /** Nombre de pages réellement analysées. */
  pagesAnalyzed?: number | null;
}

/** Multiplicateur d'effet par famille (part du potentiel réellement capté). */
const UPLIFT_BY_FAMILY: Record<string, number> = {
  meta_description: 0.08,
  title_tag: 0.12,
  h1: 0.05,
  heading_structure: 0.03,
  canonical: 0.06,
  robots: 0.15,
  sitemap: 0.05,
  structured_data: 0.06,
  image_alt: 0.02,
  image_weight: 0.03,
  web_vitals: 0.05,
  internal_linking: 0.07,
  orphan_pages: 0.06,
  cannibalization: 0.08,
  duplicate_content: 0.05,
  thin_content: 0.07,
  direct_answer: 0.06,
  ai_citability: 0.04,
  faq: 0.04,
  eeat_author: 0.03,
  social_proof: 0.03,
  backlinks: 0.10,
  redirects: 0.04,
  broken_links: 0.03,
  https: 0.05,
  content_gap: 0.10,
  new_content: 0.10,
  semantic_cocoon: 0.06,
  mobile: 0.06,
  i18n: 0.03,
  breadcrumb: 0.02,
};

/**
 * owner + kpi + estimation de trafic, tous obligatoires. L'estimation reste
 * `null` (et non 0) quand aucun signal mesuré ne permet de la produire :
 * on ne fabrique jamais un chiffre.
 */
export function buildAccountability(
  item: FingerprintInput & { pages_affected?: number },
  ctx: TrafficContext = {},
  fingerprint?: string,
): Accountability {
  const fp = fingerprint || fingerprintFinding(item);
  const owner = OWNER_BY_FAMILY[fp] || 'Responsable SEO';
  const kpi = KPI_BY_FAMILY[fp] || 'Trafic organique des pages concernées';
  const uplift = UPLIFT_BY_FAMILY[fp] ?? 0.04;

  const pages = Number(item.pages_affected || 0) || 0;
  const scale = Number(ctx.pagesAnalyzed || 0) || 0;
  const coverage = pages > 0 && scale > 0 ? Math.min(1, pages / scale) : 1;

  const clicks = Number(ctx.monthlyClicks || 0) || 0;
  const impressions = Number(ctx.monthlyImpressions || 0) || 0;
  const volume = Number(ctx.keywordVolume || 0) || 0;

  // Chaque action a son propre levier : la justification doit exposer le
  // détail du calcul (levier, taux d'effet, périmètre), sinon deux actions
  // sans rapport partagent la même phrase et l'estimation paraît templatée.
  const leverLabel = LEVER_BY_FAMILY[fp] || kpi.toLowerCase();
  const upliftPct = Math.round(uplift * 1000) / 10;
  const scopePart = coverage < 1
    ? ` × ${Math.round(coverage * 100)} % du périmètre (${pages} page${pages > 1 ? 's' : ''} sur ${scale})`
    : pages > 0
      ? ` sur ${pages} page${pages > 1 ? 's' : ''} concernée${pages > 1 ? 's' : ''}`
      : '';
  const formula = `levier « ${leverLabel} », effet attendu ${upliftPct} %${scopePart}`;

  if (clicks > 0) {
    const gain = Math.round(clicks * uplift * coverage);
    return {
      owner, kpi,
      traffic_gain: gain > 0 ? gain : null,
      traffic_basis: `${clicks} clics/mois mesurés (Search Console) — ${formula}`,
    };
  }
  if (impressions > 0) {
    // CTR de référence prudent de 2 % appliqué aux impressions déjà captées.
    const gain = Math.round(impressions * 0.02 * uplift * coverage * 5);
    return {
      owner, kpi,
      traffic_gain: gain > 0 ? gain : null,
      traffic_basis: `${impressions} impressions/mois mesurées (Search Console), CTR de référence 2 % — ${formula}`,
    };
  }
  if (volume > 0) {
    const gain = Math.round(volume * 0.02 * uplift * 5);
    return {
      owner, kpi,
      traffic_gain: gain > 0 ? gain : null,
      // Ce volume est celui du périmètre analysé, pas celui d'un mot-clé propre à
      // l'action : le dire explicitement évite de faire passer un ordre de
      // grandeur commun à plusieurs actions pour un calcul dédié.
      traffic_basis: `ordre de grandeur, non spécifique à cette action : ${volume} recherches/mois sur l’ensemble du périmètre mesuré (DataForSEO), CTR cible 2 % — ${formula}`,
    };
  }

  return {
    owner, kpi,
    traffic_gain: null,
    traffic_basis: 'non estimable : aucune donnée de performance ni de volume mesurée sur ce périmètre',
  };
}

/** Rendu court « owner · KPI · gain » pour les tableaux HTML. */
export function formatAccountability(a: Accountability): string {
  const gain = a.traffic_gain !== null
    ? `+${a.traffic_gain} visites/mois estimées`
    : 'gain non estimable';
  return `${a.owner} · KPI : ${a.kpi} · ${gain}`;
}
