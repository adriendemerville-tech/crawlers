/**
 * _shared/geoSubSignals.ts — GEO en 3 piliers (barème 25 / 22→17 / 53→58)
 *
 * Le score GEO global (0-100) mélange ce que la machine comprend du site, la
 * valeur du contenu à citer, et ce que le web dit du site. Deux pages peuvent
 * afficher le même chiffre pour des raisons opposées, donc la même
 * recommandation générique.
 *
 * Ce module décompose le GEO en 10 sous-signaux répartis en 3 piliers :
 *
 *   AUTORITÉ DOMAINE (25 pts, mutualisé au domaine)
 *     — crédibilité de la marque et présence mesurées hors de la page.
 *
 *   ACCESSIBILITÉ MACHINE (22 → 17 pts, page)
 *     — ce qu'une machine peut lire et extraire du site tel qu'il est servi.
 *
 *   EXPLOITABILITÉ CONTENU (53 pts, page)
 *     — la valeur du contenu à citer (passages autoportants, données
 *       propriétaires, voix experte). C'est le levier durable, donc le pilier
 *       le plus lourd.
 *
 * La somme des trois piliers vaut 100 et ne varie pas dans le temps : deux
 * audits, quelle que soit leur date, se comparent directement.

 *
 * Aucun appel LLM : agrégation déterministe de signaux déjà mesurés ou testés
 * ailleurs. Chaque sous-signal porte sa provenance (voir provenance.ts).
 *
 * Consommateurs : marina (fiches + bloc stratégique), audit-strategique-ia.
 */

import { provenanceBadge, type ProvenanceLevel } from './provenance.ts';
import { normalizeGates, type AuditGate } from './auditGates.ts';


export type GeoPillar = 'authority' | 'accessibility' | 'content';
/** Le « GeoFamily » historique (compréhension/autorité) devient ces 3 piliers. */
export type GeoFamily = GeoPillar;

/** Ancre du barème : 2026-08-23. */
export const GEO_WEIGHTS_ANCHOR_ISO = '2026-08-23';

/** Mois écoulés depuis l'ancre (0 avant l'ancre). */
export function geoElapsedMonths(now: Date = new Date()): number {
  const anchor = Date.UTC(2026, 7, 23); // 2026-08-23 00:00 UTC
  return Math.max(0, (now.getTime() - anchor) / (1000 * 60 * 60 * 24 * (365.25 / 12)));
}

/** Barème de départ (à l'ancre, somme = 100) : 25 / 22 / 53. */
export const GEO_PILLAR_POINTS: Record<GeoPillar, number> = {
  authority: 25,
  accessibility: 22,
  content: 53,
};

/** Palier de décroissance de l'accessibilité machine : −1 pt tous les 18 mois. */
export const GEO_ACCESSIBILITY_STEP_MONTHS = 18;
/** Plancher de l'accessibilité machine. */
export const GEO_ACCESSIBILITY_FLOOR = 17;

/**
 * Plafond du GEO quand l'autorité domaine n'est pas mesurée : la
 * renormalisation sur les piliers mesurés ne doit jamais laisser croire à une
 * visibilité générative démontrée sans preuve de crédibilité hors site.
 */
export const GEO_NO_AUTHORITY_CAP = 75;

/**
 * Calibration par la citation réellement observée (benchmark LLM).
 *
 * Les 10 sous-signaux mesurent un POTENTIEL de citation (autorité,
 * accessibilité, exploitabilité). Le benchmark, lui, mesure le RÉSULTAT :
 * la marque est-elle citée quand un client potentiel interroge un moteur de
 * réponse ? Plutôt que d'ajouter un 11e sous-signal (qui écraserait la variance
 * par page, la mesure étant mutualisée au domaine), on module le score final de
 * ±GEO_CALIBRATION_MAX_PCT % : le barème reste inchangé, seul l'écart entre
 * potentiel et réel est corrigé.
 *
 * Neutre à GEO_CALIBRATION_NEUTRAL_PCT de couverture ; borne haute atteinte à
 * GEO_CALIBRATION_HIGH_PCT ; 0 % de citation applique la décote maximale.
 * Aucune calibration sous GEO_CALIBRATION_MIN_OBSERVATIONS observations : un
 * échantillon trop court n'est pas une mesure.
 */
export const GEO_CALIBRATION_MAX_PCT = 10;
export const GEO_CALIBRATION_NEUTRAL_PCT = 20;
export const GEO_CALIBRATION_HIGH_PCT = 60;
export const GEO_CALIBRATION_MIN_OBSERVATIONS = 6;

/** Points d'accessibilité machine à une date (22 → 17 par tranche de 1 pt / 18 mois). */
export function geoAccessibilityPoints(now: Date = new Date()): number {
  const steps = Math.floor(geoElapsedMonths(now) / GEO_ACCESSIBILITY_STEP_MONTHS);
  return Math.max(GEO_ACCESSIBILITY_FLOOR, GEO_PILLAR_POINTS.accessibility - steps);
}

/**
 * Poids des trois piliers (somme toujours 100) :
 *  - autorité domaine       : 25 (constant, mutualisé)
 *  - accessibilité machine  : 22 → 17, −1 pt par tranche de 18 mois (page)
 *  - exploitabilité contenu : le reste, donc 53 → 58 (page)
 * Décroissance en marches : le barème est stable pendant 18 mois, donc deux
 * audits d'une même tranche se comparent directement.
 */
export function geoPillarTotals(now: Date = new Date()): Record<GeoPillar, number> {
  const accessibility = geoAccessibilityPoints(now);
  const authority = GEO_PILLAR_POINTS.authority;
  return { authority, accessibility, content: 100 - authority - accessibility };
}

/** Tendance de chaque pilier au regard de la courbe de décroissance. */
export type GeoPillarTrend = 'constant' | 'decays' | 'grows';
export const GEO_PILLAR_TREND: Record<GeoPillar, GeoPillarTrend> = {
  authority: 'constant',
  accessibility: 'decays',
  content: 'grows',
};



/** Poids relatifs (fixes) des sous-signaux à l'intérieur de chaque pilier. */
export const GEO_PILLAR_REL: Record<GeoPillar, Record<string, number>> = {
  authority: { brand_authority: 14, serp_presence: 11 },
  accessibility: {
    bot_accessibility: 14,
    structured_data_quality: 12,
    ai_bot_policy: 8,
    content_freshness: 6,
  },
  content: {
    content_quotability: 10,
    answer_formatting: 8,
    knowledge_graph_signals: 10,
    self_citation_signals: 8,
    person_authority: 6,
  },
};


/**
 * Poids en points de chaque sous-signal à une date : le poids relatif interne
 * est mis à l'échelle pour que le pilier totalise son poids courant.
 */
export function geoSignalWeightsAt(now: Date = new Date()): Record<string, number> {
  const totals = geoPillarTotals(now);
  const out: Record<string, number> = {};
  for (const [pillar, rels] of Object.entries(GEO_PILLAR_REL)) {
    const sum = Object.values(rels).reduce((a, b) => a + b, 0);
    for (const [key, rel] of Object.entries(rels)) {
      out[key] = (totals[pillar as GeoPillar] * rel) / sum;
    }
  }
  return out;
}

export interface GeoSubSignalSpec {
  key: string;
  family: GeoPillar;
  label: string;
  /** Poids RELATIF dans son pilier (proportions de mise à l'échelle). */
  weight: number;
  provenance: ProvenanceLevel;
  /** Ce que le signal mesure, en une phrase lisible par un non-technicien. */
  meaning: string;
  /** Action à mener quand le signal est bas. */
  lever: string;
}

export const GEO_SUB_SIGNALS: GeoSubSignalSpec[] = [
  // ── Pilier autorité domaine (25, constant) ────────────────────────────────
  {
    key: 'brand_authority',
    family: 'authority',
    label: 'Autorité de domaine',
    weight: 14,
    provenance: 'mesure',
    meaning: 'Volume et diversité des domaines qui pointent vers le site.',
    lever: 'Acquérir des liens de domaines de référence du secteur, pas du volume générique.',
  },
  {
    key: 'serp_presence',
    family: 'authority',
    label: 'Présence SERP',
    weight: 11,
    provenance: 'mesure',
    meaning: 'Positions organiques réelles : les moteurs de réponse s’appuient largement sur les sources bien classées.',
    lever: 'Consolider les pages proches du top 10 avant d’en créer de nouvelles.',
  },

  // ── Pilier accessibilité machine (22 pts) ────────────────────────────────
  {
    key: 'bot_accessibility',
    family: 'accessibility',
    label: 'Contenu accessible aux robots',
    weight: 14,
    provenance: 'mesure',
    meaning: 'Le contenu est présent dans le HTML servi, sans exécution de JavaScript, et livré assez vite pour être récupéré par les robots.',
    lever: 'Rendre le contenu au serveur (SSR / prérendu) et servir le premier octet en moins de 800 ms.',
  },
  {
    key: 'structured_data_quality',
    family: 'accessibility',
    label: 'Données structurées et nœud d’identité',
    weight: 12,
    provenance: 'mesure',
    meaning: 'Présence et pertinence des balisages JSON-LD, et complétude du nœud d’identité (adresse postale, point de contact, comptes officiels) qu’un agent lit pour vérifier que l’entreprise est réelle.',
    lever: 'Déclarer les types utiles au domaine (Organization, Person, Article, FAQPage, LocalBusiness, Product) et compléter Organization avec postalAddress, contactPoint et sameAs cohérents avec la fiche établissement et l’annuaire légal.',
  },
  {
    key: 'ai_bot_policy',
    family: 'accessibility',
    label: 'Politique robots IA',
    weight: 8,
    provenance: 'mesure',
    meaning: 'Les robots des moteurs de réponse (GPTBot, ClaudeBot, PerplexityBot, Google-Extended) sont-ils autorisés nommément, et le serveur les laisse-t-il passer sans les brider ? Un blocage involontaire par le WAF ou un 429 produit exactement le même effet qu’un Disallow : le contenu n’existe pas pour ces modèles.',
    lever: 'Autoriser nommément les robots IA dans robots.txt, et vérifier côté WAF / pare-feu applicatif qu’ils ne reçoivent ni 403 ni 429.',
  },

  {
    key: 'content_freshness',
    family: 'accessibility',
    label: 'Fraîcheur',
    weight: 6,
    provenance: 'mesure',
    meaning: 'Dates de mise à jour lisibles et contenu rattaché à la période courante.',
    lever: 'Afficher une date de mise à jour réelle et rafraîchir les pages stratégiques.',
  },

  // ── Pilier exploitabilité contenu (53 pts) ───────────────────────────────
  {
    key: 'content_quotability',
    family: 'content',
    label: 'Passages citables',
    weight: 10,
    provenance: 'test',
    meaning: 'Le contenu contient des passages autoportants qu’un moteur de réponse peut extraire tels quels.',
    lever: 'Ouvrir chaque page par une réponse directe de 2 à 3 phrases, puis développer.',
  },
  {
    key: 'answer_formatting',
    family: 'content',
    label: 'Mise en forme des réponses',
    weight: 8,
    provenance: 'deduction',
    meaning: 'Titres hiérarchisés, questions explicites, listes et définitions qui balisent les réponses.',
    lever: 'Structurer en H2 interrogatifs, ajouter des listes et un bloc de questions fréquentes.',
  },
  {
    key: 'knowledge_graph_signals',
    family: 'content',
    label: 'Entité reconnue',
    weight: 10,
    provenance: 'test',
    meaning: 'La marque est identifiée comme une entité rattachée à son domaine et à son activité.',
    lever: 'Aligner nom, adresse, activité et identifiants sur toutes les sources publiques (fiche établissement, annuaires de référence).',
  },
  {
    key: 'self_citation_signals',
    family: 'content',
    label: 'Sources et attributions',
    weight: 8,
    provenance: 'deduction',
    meaning: 'Le site cite ses sources, ses auteurs et ses preuves de façon vérifiable.',
    lever: 'Signer les contenus, dater, sourcer les chiffres, lier les pages d’auteur.',
  },
  {
    key: 'person_authority',
    family: 'content',
    label: 'Voix experte identifiée',
    weight: 6,
    provenance: 'deduction',
    meaning: 'Une personne nommée porte l’expertise du site et est corroborée hors du site.',
    lever: 'Désigner un porte-parole (dirigeant, fondateur) avec page auteur et présence hors-site cohérente.',
  },
];

export const FAMILY_LABEL: Record<GeoFamily, string> = {
  authority: 'Autorité domaine',
  accessibility: 'Accessibilité machine',
  content: 'Exploitabilité contenu',
};

export const PILLAR_LABEL: Record<GeoPillar, string> = FAMILY_LABEL;

export interface GeoSubSignalValue extends GeoSubSignalSpec {
  /** Poids en POINTS à la date de l'audit (arrondi à 1 décimale). */
  weight: number;
  /** 0-100, ou null si non mesuré sur ce run. */
  value: number | null;
}

export interface GeoFamilyScore {
  family: GeoFamily;
  label: string;
  /** 0-100 : moyenne pondérée des sous-signaux mesurés du pilier. */
  score: number | null;
  /** Part du poids du pilier réellement couverte par une mesure (0-100). */
  coverage: number;
  measured: number;
  total: number;
}

export type GeoGapVerdict =
  | 'authority_lag'
  | 'comprehension_lag'
  | 'both_low'
  | 'aligned'
  | 'aligned_strong'
  | 'unknown';

export interface GeoSubSignalReport {
  signals: GeoSubSignalValue[];
  /** Pilier A — autorité domaine (25 pts, mutualisé). */
  authority: GeoFamilyScore;
  /** Pilier B — accessibilité machine (22 pts, page). */
  accessibility: GeoFamilyScore;
  /** Pilier C — exploitabilité contenu (53 → 58 pts, page). */
  content: GeoFamilyScore;
  /** 0-100 : moyenne pondérée des piliers mesurés — reconstitue le GEO lisible. */
  geo_score: number | null;
  /** Part du barème /100 réellement couverte par une mesure (0-100). */
  geo_coverage: number;
  /** Poids en points des trois piliers à la date de l’audit (somme = 100). */
  pillar_points: Record<GeoPillar, number>;
  /** Tendance du barème : autorité constante, accessibilité décroissante, contenu croissant. */
  pillar_trend: Record<GeoPillar, GeoPillarTrend>;

  /** Date de référence de la pondération (ISO). */
  weight_date: string;
  gap: number | null;
  verdict: GeoGapVerdict;
  verdict_label: string;
  verdict_explanation: string;
  /** Deux à trois leviers déduits des sous-signaux les plus bas. */
  priority_levers: { key: string; label: string; value: number; lever: string }[];
  /**
   * Plafonds de cohérence appliqués au GEO. Une coquille JS ou une page sans
   * corps de texte ne peut pas conserver une citabilité confortable : le
   * balisage seul n'est pas citable. Chaque plafond porte sa preuve chiffrée.
   */
  gates: AuditGate[];
  /**
   * Calibration par la citation réellement observée (benchmark LLM). `applied:
   * false` quand la mesure manque ou que l'échantillon est trop court : le score
   * reste alors purement un potentiel.
   */
  citation_calibration: GeoCitationCalibration;
}

export interface GeoCitationCalibration {
  applied: boolean;
  /** Taux de citation observé (0-100) ou null si non mesuré. */
  rate_pct: number | null;
  /** Nombre d'observations du benchmark (modèles × questions). */
  observations: number | null;
  /** Modulation appliquée, en % du score (−10 → +10). */
  factor_pct: number;
  /** Score avant / après calibration. */
  pre_score: number | null;
  post_score: number | null;
  /** Phrase d'explication prête à afficher. */
  note: string;
}

export interface GeoSignalInputs {
  /** citation_breakdown de citationScorer (8 clés). */
  breakdown?: Record<string, number | null | undefined> | null;
  /**
   * Résultat réellement observé du benchmark LLM (agrégat de
   * calculate-llm-visibility) : taux de couverture et nombre d'observations.
   * Sert uniquement de facteur de calibration ±10 %, jamais de sous-signal.
   */
  observedCitation?: { ratePct?: number | null; observations?: number | null } | null;
  /** true si le HTML servi est une coquille JS (botRenderingShell). */
  isBotShell?: boolean | null;
  /** Nombre de pages où un tag attendu est absent uniquement pour les robots. */
  botOnlyAbsences?: number | null;
  /**
   * Temps de livraison du premier octet (ms), mesuré. Décote l'accessibilité
   * robots seulement : le confort visuel humain (LCP/INP/CLS) reste hors du GEO
   * pour éviter la double pénalité. `null` / absent = aucune décote.
   */
  ttfbMs?: number | null;
  /**
   * Politique robots des moteurs de réponse (check-robots-indexation + faits de
   * crawl). Effet binaire démontrable : un bot bloqué ne voit rien, et un 429 /
   * 403 servi par le WAF a exactement le même effet qu'un Disallow.
   * Tout à `null` / absent = non mesuré, le sous-signal n'est pas noté.
   */
  aiBotPolicy?: {
    /** robots.txt effectivement récupéré (200). */
    robotsFound?: boolean | null;
    /** Robots IA explicitement bloqués (Disallow: /) — noms canoniques. */
    blockedBots?: string[] | null;
    /** Au moins un robot IA autorisé nommément (politique explicite). */
    namedAllowlist?: boolean | null;
    /** Le serveur / WAF a répondu 429 ou 403 à un user-agent de robot IA. */
    throttled?: boolean | null;
  } | null;
  /**
   * Complétude du nœud d'identité (Organization / LocalBusiness). Ce n'est pas
   * de la découvrabilité : c'est ce qu'un agent lit pour décider si l'entreprise
   * est réelle avant de la recommander. Modulateur de
   * `structured_data_quality`, pas un sous-signal séparé.
   */
  identityNode?: {
    hasOrganization?: boolean | null;
    hasPostalAddress?: boolean | null;
    hasContactPoint?: boolean | null;
    sameAsCount?: number | null;
    /** Cohérence nom / adresse / téléphone entre site, fiche établissement et annuaire légal. */
    consistentWithDirectory?: boolean | null;
  } | null;
  /**
   * Qualité des réponses non-200. Effet réel mais marginal : évite le
   * gaspillage de budget de crawl et les mauvaises lectures des liens morts.
   * Traité comme une décote plafonnée de `bot_accessibility`, jamais comme un
   * sous-signal à part entière.
   */
  nonOkResponses?: {
    /** Une URL inexistante renvoie bien un 404/410 (pas un 200 « soft 404 »). */
    correctStatus?: boolean | null;
    /** La réponse d'erreur porte un corps utile plutôt qu'une coquille HTML lourde. */
    usefulBody?: boolean | null;
  } | null;

  /** Agrégats de crawl utiles à la mise en forme des réponses. */
  crawlFormatting?: {
    pagesAnalyzed?: number | null;
    pagesWithH1?: number | null;
    pagesWithFaq?: number | null;
    pagesWithLists?: number | null;
    avgWordCount?: number | null;
  } | null;
  /** Voix experte résolue et corroborée hors site (personAuthority / E-E-A-T). */
  founderResolved?: boolean | null;
  founderCorroborated?: boolean | null;
  /**
   * Faits d'extraction mesurés sur le HTML servi (audit-expert-seo) : nombre de
   * mots réellement extraits et part de texte utile. Ils déclenchent les
   * plafonds de cohérence du GEO. `null` = non mesuré : aucun plafond appliqué,
   * un HTML tronqué ne doit pas fabriquer un défaut.
   */
  extractedWords?: number | null;
  textRatioPct?: number | null;
  /**
   * Date de référence de la pondération. Par défaut `new Date()` (l'audit en
   * cours). Injectable pour les tests et les re-rendus datés.
   */
  now?: Date;
}


function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? clamp100(v) : null;
}

/**
 * Décote de livraison serveur appliquée à l'accessibilité robots.
 *
 * Le TTFB n'est pas une métrique de confort visuel : c'est le temps qu'un
 * crawler attend avant d'obtenir le moindre octet, et les budgets de crawl des
 * robots IA sont bien plus courts que la patience d'un humain. La décote reste
 * volontairement locale à `bot_accessibility` (aucun changement de barème) et
 * ne s'applique qu'à une mesure disponible — un TTFB non mesuré ne fabrique
 * aucun défaut.
 *
 *  - < 800 ms  : plein score (aucune décote)
 *  - 800-1500 ms : −5
 *  - 1,5-2,5 s : −15
 *  - > 2,5 s   : −25
 */
function ttfbPenalty(ttfbMs: unknown): number {
  const t = typeof ttfbMs === 'number' && Number.isFinite(ttfbMs) ? ttfbMs : null;
  if (t === null || t <= 0) return 0;
  if (t < 800) return 0;
  if (t < 1500) return 5;
  if (t <= 2500) return 15;
  return 25;
}

/**
 * Décote des réponses non-200, volontairement plafonnée à −10 : une page
 * d'erreur mal servie gaspille du budget de crawl et fait mal interpréter les
 * liens morts, mais ce n'est jamais ce qui décide qu'une page est citée.
 *  - 200 sur une URL inexistante (soft 404) : −7
 *  - corps d'erreur inutile (coquille HTML lourde) : −3
 */
function nonOkPenalty(i: GeoSignalInputs): number {
  const n = i.nonOkResponses;
  if (!n) return 0;
  let p = 0;
  if (n.correctStatus === false) p += 7;
  if (n.usefulBody === false) p += 3;
  return Math.min(10, p);
}

/** Accessibilité robots : signal binaire dégradé par les absences bot-only, la livraison serveur et les réponses d'erreur. */
function scoreBotAccessibility(i: GeoSignalInputs): number | null {
  // Une coquille JS est déjà le plancher du signal : la décote TTFB n'ajoute
  // rien (le contenu est absent, pas lent).
  if (i.isBotShell === true) return 5;
  const botOnly = Number(i.botOnlyAbsences ?? 0) || 0;
  const penalty = ttfbPenalty(i.ttfbMs) + nonOkPenalty(i);
  const base = i.isBotShell === false
    ? (botOnly > 0 ? Math.max(35, 90 - botOnly * 15) : 95)
    : botOnly > 0 ? Math.max(35, 90 - botOnly * 15) : null;
  if (base === null) {
    // Aucun fait d'accessibilité : un TTFB seul ne suffit pas à noter le signal.
    return null;
  }
  return clamp100(Math.max(20, base - penalty));
}

/**
 * Politique robots IA : le seul point d'accessibilité à effet binaire
 * démontrable. Un robot bloqué ne lit rien, et un 429 / 403 servi par le WAF
 * produit le même résultat qu'un Disallow. Une politique implicite
 * (`User-agent: *`) fonctionne mais n'affirme rien : elle plafonne à 80.
 */
function scoreAiBotPolicy(i: GeoSignalInputs): number | null {
  const p = i.aiBotPolicy;
  if (!p) return null;
  const blocked = Array.isArray(p.blockedBots) ? p.blockedBots.filter(Boolean) : [];
  const measured =
    p.robotsFound != null || p.namedAllowlist != null || p.throttled != null || blocked.length > 0;
  if (!measured) return null;

  if (p.robotsFound === false) {
    // Pas de robots.txt : tout est implicitement autorisé, mais rien n'est
    // affirmé. Le throttling reste opposable.
    return clamp100(p.throttled === true ? 40 : 70);
  }

  let score = p.namedAllowlist === true ? 100 : 80;
  score -= Math.min(75, blocked.length * 25);
  if (p.throttled === true) score -= 30;
  return clamp100(Math.max(5, score));
}

/**
 * Complétude du nœud d'identité : ce qu'un agent lit pour vérifier qu'une
 * entreprise est réelle avant de la recommander. Modulateur de
 * `structured_data_quality` (35 %), pas un sous-signal séparé — c'est la même
 * question, mesurée en profondeur plutôt qu'en présence.
 */
function scoreIdentityNode(i: GeoSignalInputs): number | null {
  const n = i.identityNode;
  if (!n) return null;
  const known =
    n.hasOrganization != null || n.hasPostalAddress != null || n.hasContactPoint != null ||
    n.sameAsCount != null || n.consistentWithDirectory != null;
  if (!known) return null;
  if (n.hasOrganization === false) return 5;

  let s = 0;
  if (n.hasOrganization === true) s += 30;
  if (n.hasPostalAddress === true) s += 25;
  if (n.hasContactPoint === true) s += 20;
  const sameAs = Number(n.sameAsCount ?? 0) || 0;
  s += sameAs >= 2 ? 15 : sameAs === 1 ? 8 : 0;
  if (n.consistentWithDirectory === true) s += 10;
  return clamp100(s);
}

/** Données structurées : présence du balisage (65 %) et complétude du nœud d'identité (35 %). */
function scoreStructuredData(i: GeoSignalInputs, declared: number | null): number | null {
  const identity = scoreIdentityNode(i);
  if (identity === null) return declared;
  if (declared === null) return identity;
  return clamp100(declared * 0.65 + identity * 0.35);
}


/**
 * Mise en forme des réponses : déduite d'agrégats de crawl. Les composantes
 * absentes du crawl sont exclues du numérateur ET du dénominateur — une colonne
 * non collectée ne doit pas être lue comme une absence de balisage.
 */
function scoreAnswerFormatting(i: GeoSignalInputs): number | null {
  const c = i.crawlFormatting;
  if (!c) return null;
  const pages = Number(c.pagesAnalyzed ?? 0) || 0;
  if (pages <= 0) return null;

  const parts: { weight: number; value: number }[] = [];
  const ratio = (v: unknown) => Math.max(0, Math.min(1, (Number(v) || 0) / pages)) * 100;
  if (c.pagesWithH1 != null) parts.push({ weight: 40, value: ratio(c.pagesWithH1) });
  if (c.pagesWithFaq != null) parts.push({ weight: 30, value: ratio(c.pagesWithFaq) });
  if (c.pagesWithLists != null) parts.push({ weight: 20, value: ratio(c.pagesWithLists) });
  if (c.avgWordCount != null) {
    const avg = Number(c.avgWordCount) || 0;
    parts.push({ weight: 10, value: avg >= 900 ? 100 : avg >= 500 ? 70 : avg >= 250 ? 40 : 10 });
  }
  if (parts.length === 0) return null;

  const den = parts.reduce((s, p) => s + p.weight, 0);
  return clamp100(parts.reduce((s, p) => s + p.weight * p.value, 0) / den);
}


/** Voix experte : nommée = 55, nommée et corroborée hors site = 90. */
function scorePersonAuthority(i: GeoSignalInputs): number | null {
  if (i.founderResolved == null && i.founderCorroborated == null) return null;
  if (!i.founderResolved) return 10;
  return i.founderCorroborated ? 90 : 55;
}

function familyScore(family: GeoFamily, signals: GeoSubSignalValue[]): GeoFamilyScore {
  const own = signals.filter((s) => s.family === family);
  const totalWeight = own.reduce((s, x) => s + x.weight, 0);
  const measured = own.filter((s) => s.value !== null);
  const measuredWeight = measured.reduce((s, x) => s + x.weight, 0);
  const score = measuredWeight > 0
    ? clamp100(measured.reduce((s, x) => s + x.weight * (x.value as number), 0) / measuredWeight)
    : null;
  return {
    family,
    label: FAMILY_LABEL[family],
    score,
    coverage: totalWeight > 0 ? Math.round((measuredWeight / totalWeight) * 100) : 0,
    measured: measured.length,
    total: own.length,
  };
}

/**
 * Verdict d'écart entre le bloc page (accessibilité + contenu, ce que l'on peut
 * corriger sur le site) et l'autorité domaine (crédibilité hors site). Conserve
 * le diagnostic historique « comprendre vs autorité » en le recalant sur les
 * piliers : la vraie question reste « le problème est-il sur le site ou hors du
 * site ? ».
 */
function verdictFor(pageSide: number | null, auth: number | null): { verdict: GeoGapVerdict; label: string; explanation: string } {
  if (pageSide === null || auth === null) {
    return {
      verdict: 'unknown',
      label: 'Écart non interprétable',
      explanation:
        'Une des deux faces (bloc page ou autorité domaine) n’a pas assez de sous-signaux mesurés sur ce run : l’écart n’est pas exploitable. Relancez l’audit avec les connexions de données actives.',
    };
  }
  const gap = pageSide - auth;
  if (gap >= 20) {
    return {
      verdict: 'authority_lag',
      label: 'Site exploitable, marque peu crédible',
      explanation:
        `Le bloc page (accessibilité + contenu) est à ${pageSide}/100 alors que l’autorité perçue n’est qu’à ${auth}/100. Le site est correctement structuré : les moteurs de réponse peuvent l’extraire, mais rien ne leur garantit qu’il faut le citer plutôt qu’une autre source. Le levier n’est pas une nouvelle passe technique mais la crédibilité hors site : mentions sur des sources de référence du secteur, cohérence de l’entité, auteurs nommés et corroborés.`,
    };
  }
  if (gap <= -20) {
    return {
      verdict: 'comprehension_lag',
      label: 'Marque crédible, site peu exploitable',
      explanation:
        `L’autorité perçue est à ${auth}/100 alors que le bloc page plafonne à ${pageSide}/100. La notoriété existe déjà : chaque point gagné en accessibilité ou en exploitabilité du contenu se convertit donc vite en citation. Le levier est le site lui-même — rendu accessible aux robots, données structurées, passages autoportants et mise en forme des réponses — avant tout nouvel effort de notoriété.`,
    };
  }
  if (pageSide < 40 && auth < 40) {
    return {
      verdict: 'both_low',
      label: 'Fondations et autorité faibles',
      explanation:
        `Bloc page ${pageSide}/100 et autorité ${auth}/100 : les deux faces sont basses et cohérentes. L’ordre compte — structurer d’abord (accessibilité robots, données structurées, passages citables), travailler la notoriété ensuite. Inversé, l’effort de notoriété produit des mentions que rien ne rattache au site.`,
    };
  }
  if (pageSide >= 65 && auth >= 65) {
    return {
      verdict: 'aligned_strong',
      label: 'Faces alignées à bon niveau',
      explanation:
        `Bloc page ${pageSide}/100 et autorité ${auth}/100 progressent ensemble à bon niveau. Il n’y a pas de blocage structurel : le gain vient désormais de la couverture d’intentions non encore traitées et de la profondeur des pages existantes, pas d’un correctif transversal.`,
    };
  }
  return {
    verdict: 'aligned',
    label: 'Faces alignées, niveau intermédiaire',
    explanation:
      `Bloc page ${pageSide}/100 et autorité ${auth}/100 sont du même ordre : aucune des deux ne bride l’autre. La priorisation se fait donc sous-signal par sous-signal, sur les plus bas, et non par grand pilier.`,
  };
}

export function buildGeoSubSignals(inputs: GeoSignalInputs): GeoSubSignalReport {
  const now = inputs.now || new Date();
  const pillarTotals = geoPillarTotals(now);
  const signalWeights = geoSignalWeightsAt(now);

  const b = inputs.breakdown || {};
  const resolved: Record<string, number | null> = {
    bot_accessibility: scoreBotAccessibility(inputs),
    structured_data_quality: scoreStructuredData(inputs, num(b['structured_data_quality'])),
    ai_bot_policy: scoreAiBotPolicy(inputs),

    content_quotability: num(b['content_quotability']),
    answer_formatting: scoreAnswerFormatting(inputs),
    content_freshness: num(b['content_freshness']),
    brand_authority: num(b['brand_authority']),
    serp_presence: num(b['serp_presence']),
    knowledge_graph_signals: num(b['knowledge_graph_signals']),
    self_citation_signals: num(b['self_citation_signals']),
    person_authority: scorePersonAuthority(inputs),
  };

  // ─── Plafonds de cohérence GEO ───────────────────────────────────────────
  // Le balisage n'est pas citable : sans corps de texte extrait du HTML servi,
  // un moteur de réponse n'a rien à reprendre. Une coquille JS ne peut donc pas
  // conserver une citabilité, une mise en forme de réponses ni des données
  // structurées confortables. Les plafonds ne s'appliquent que sur des faits
  // mesurés — un HTML tronqué (extraction inconnue) ne fabrique aucun défaut.
  const rawGates: Array<{ axis: string; reason: string; evidence: string; measured?: string; target?: string }> = [];
  const words = typeof inputs.extractedWords === 'number' && Number.isFinite(inputs.extractedWords)
    ? Math.max(0, Math.round(inputs.extractedWords)) : null;
  const ratio = typeof inputs.textRatioPct === 'number' && Number.isFinite(inputs.textRatioPct)
    ? Math.max(0, Math.round(inputs.textRatioPct * 10) / 10) : null;

  // Robots IA bloqués ou bridés : fait binaire, remonté en tête du workbench.
  const blockedAiBots = Array.isArray(inputs.aiBotPolicy?.blockedBots)
    ? (inputs.aiBotPolicy!.blockedBots as string[]).filter(Boolean)
    : [];
  const aiThrottled = inputs.aiBotPolicy?.throttled === true;
  if (blockedAiBots.length > 0 || aiThrottled) {
    rawGates.push({
      axis: 'geo_bot_policy',
      reason: blockedAiBots.length > 0
        ? 'Des robots de moteurs de réponse sont explicitement bloqués : pour ces modèles, le contenu du site n’existe pas, quelle que soit sa qualité.'
        : 'Le serveur ou le pare-feu applicatif bride les robots de moteurs de réponse (429 / 403) : l’effet est identique à un Disallow.',
      evidence: [
        blockedAiBots.length > 0 ? `robots bloqués : ${blockedAiBots.join(', ')}` : null,
        aiThrottled ? 'réponse 429 / 403 servie à un user-agent de robot IA' : null,
      ].filter(Boolean).join(' · '),
      measured: blockedAiBots.length > 0 ? `${blockedAiBots.length} robot(s) IA bloqué(s)` : 'robots IA bridés',
      target: 'autorisation nommée dans robots.txt et aucun blocage WAF',
    });
  }


  const shellMeasured = inputs.isBotShell === true;
  const starvedByText = words !== null && words < 200 && (ratio === null || ratio < 5);
  const textStarved = shellMeasured || starvedByText;

  if (textStarved) {
    const evidenceBase = shellMeasured
      ? 'HTML servi identifié comme coquille JS (contenu injecté après exécution du JavaScript)'
      : `${words} mots extraits${ratio !== null ? ` et ${ratio} % de texte utile` : ''}`;

    const capSignal = (key: string, cap: number, axis: string, reason: string, target: string) => {
      const current = resolved[key];
      if (current === null || current === undefined) return;
      if (current <= cap) return;
      resolved[key] = cap;
      rawGates.push({
        axis,
        reason,
        evidence: `${evidenceBase} → cible ${target} (sous-signal ramené de ${current}/100 à ${cap}/100)`,
        measured: shellMeasured ? 'coquille JS' : `${words} mots`,
        target,
      });
    };

    capSignal(
      'content_quotability', 15, 'geo_quotability',
      'Aucun passage citable ne peut être extrait du HTML servi : la citabilité mesurée porte sur du texte absent pour les robots.',
      '≥ 200 mots extraits',
    );
    capSignal(
      'answer_formatting', 25, 'geo_formatting',
      'Les titres, listes et blocs de questions ne balisent aucune réponse tant que le corps de texte n’est pas rendu côté serveur.',
      '≥ 5 % de texte utile',
    );
    capSignal(
      'structured_data_quality', 40, 'geo_structured_data',
      'Les données structurées déclarent un contenu que le HTML servi ne contient pas : elles ne peuvent pas être corroborées.',
      'balisage adossé à un contenu rendu',
    );
  }

  // Chaque sous-signal porte son poids en POINTS à la date de l'audit
  // (arrondi à 1 décimale pour un affichage lisible ; l'erreur sur le total
  // reste < 0,1 point sur 100).
  const signals: GeoSubSignalValue[] = GEO_SUB_SIGNALS.map((s) => ({
    ...s,
    weight: Math.round((signalWeights[s.key] ?? 0) * 10) / 10,
    value: resolved[s.key] ?? null,
  }));

  const authority = familyScore('authority', signals);
  const accessibility = familyScore('accessibility', signals);
  const content = familyScore('content', signals);

  // Bloc page = accessibilité + contenu (ce que l'on corrige sur le site).
  const pageParts = () => [
    { total: pillarTotals.accessibility, score: accessibility.score },
    { total: pillarTotals.content, score: content.score },
  ];
  const calcPageSide = () => {
    const meas = pageParts().filter((p) => p.score !== null);
    const den = meas.reduce((a, p) => a + p.total, 0);
    return den > 0 ? clamp100(meas.reduce((a, p) => a + p.total * (p.score as number), 0) / den) : null;
  };
  let pageSide = calcPageSide();

  // Plafond de bloc page : même après plafonnement des sous-signaux, une page
  // sans texte extractible ne peut pas afficher une exploitabilité confortable.
  // On réduit proportionnellement accessibilité + contenu pour que leur bloc
  // totalise au plus 30/100 — le rendu reste cohérent avec le plafond d'origine
  // sur la « compréhension machine ».
  if (textStarved && pageSide !== null && pageSide > 30) {
    const preCap = pageSide;
    const scale = 30 / pageSide;
    if (accessibility.score !== null) accessibility.score = clamp100(accessibility.score * scale);
    if (content.score !== null) content.score = clamp100(content.score * scale);
    pageSide = calcPageSide();
    rawGates.push({
      axis: 'geo_comprehension',
      reason: 'Bloc page bridé : sans contenu rendu côté serveur, ni l’accessibilité ni l’exploitabilité du contenu ne peuvent produire leur effet.',
      evidence: `${shellMeasured ? 'coquille JS mesurée' : `${words} mots extraits`} → cible contenu rendu au serveur (bloc accessibilité + contenu ramené de ${preCap}/100 à 30/100)`,
      measured: shellMeasured ? 'coquille JS' : `${words} mots`,
      target: 'contenu rendu au serveur',
    });
  }

  const v = verdictFor(pageSide, authority.score);

  // geo_score = moyenne pondérée des piliers mesurés par leur poids courant.
  // La renormalisation sur les seuls piliers mesurés reste nécessaire (sinon un
  // run partiel serait pénalisé comme s'il valait 0), mais elle est désormais
  // bornée : sans autorité domaine mesurée, un score GEO élevé n'est pas
  // démontrable — un site parfaitement structuré mais inconnu ne se fait pas
  // citer. On plafonne donc à GEO_NO_AUTHORITY_CAP et on expose la couverture.
  const geoParts = [
    { total: pillarTotals.authority, score: authority.score },
    { total: pillarTotals.accessibility, score: accessibility.score },
    { total: pillarTotals.content, score: content.score },
  ].filter((p) => p.score !== null);
  const geoDen = geoParts.reduce((a, p) => a + p.total, 0);
  let geo = geoDen > 0 ? clamp100(geoParts.reduce((a, p) => a + p.total * (p.score as number), 0) / geoDen) : null;
  const geoCoverage = Math.round(Math.min(100, geoDen));

  if (geo !== null && authority.score === null && geo > GEO_NO_AUTHORITY_CAP) {
    const preAuthCap = geo;
    geo = GEO_NO_AUTHORITY_CAP;
    rawGates.push({
      axis: 'geo_authority',
      reason: `Autorité domaine non mesurée sur ce run : le score GEO est renormalisé sur ${geoCoverage} % du barème et ne peut donc pas dépasser ${GEO_NO_AUTHORITY_CAP}/100. Être exploitable ne suffit pas : encore faut-il être une source que les moteurs de réponse ont une raison de citer.`,
      evidence: `couverture ${geoCoverage} % du barème (autorité ${pillarTotals.authority.toFixed(0)} pts non mesurés) → ${preAuthCap}/100 ramené à ${GEO_NO_AUTHORITY_CAP}/100`,
      measured: `${geoCoverage} % du barème`,
      target: 'autorité domaine mesurée (backlinks / notoriété)',
    });
  }

  // ─── Calibration par la citation réellement observée (±10 %) ───
  // Les sous-signaux mesurent un potentiel ; le benchmark mesure le résultat.
  // On corrige l'écart sans toucher au barème : un site parfaitement structuré
  // que personne ne cite perd 10 %, un site cité malgré des signaux moyens en
  // gagne 10 %. Le plafond d'autorité reste opposable après calibration.
  const obsRate = num(inputs.observedCitation?.ratePct);
  const obsCount = typeof inputs.observedCitation?.observations === 'number' && Number.isFinite(inputs.observedCitation.observations)
    ? Math.max(0, Math.round(inputs.observedCitation.observations))
    : null;
  let calibration: GeoCitationCalibration = {
    applied: false,
    rate_pct: obsRate,
    observations: obsCount,
    factor_pct: 0,
    pre_score: geo,
    post_score: geo,
    note: obsRate === null
      ? 'Citation réelle non mesurée sur ce run : le score GEO exprime un potentiel de citation, pas un résultat observé.'
      : `Échantillon de benchmark trop court (${obsCount ?? 0} observation${(obsCount ?? 0) > 1 ? 's' : ''}, minimum ${GEO_CALIBRATION_MIN_OBSERVATIONS}) : aucune calibration appliquée.`,
  };

  if (geo !== null && obsRate !== null && (obsCount ?? 0) >= GEO_CALIBRATION_MIN_OBSERVATIONS) {
    const factor =
      obsRate >= GEO_CALIBRATION_NEUTRAL_PCT
        ? GEO_CALIBRATION_MAX_PCT *
          Math.min(1, (obsRate - GEO_CALIBRATION_NEUTRAL_PCT) / (GEO_CALIBRATION_HIGH_PCT - GEO_CALIBRATION_NEUTRAL_PCT))
        : -GEO_CALIBRATION_MAX_PCT * ((GEO_CALIBRATION_NEUTRAL_PCT - obsRate) / GEO_CALIBRATION_NEUTRAL_PCT);
    const factorPct = Math.round(factor * 10) / 10;
    const pre = geo;
    let post = clamp100(pre * (1 + factorPct / 100));
    if (authority.score === null && post > GEO_NO_AUTHORITY_CAP) post = GEO_NO_AUTHORITY_CAP;
    geo = post;
    calibration = {
      applied: true,
      rate_pct: obsRate,
      observations: obsCount,
      factor_pct: factorPct,
      pre_score: pre,
      post_score: post,
      note:
        factorPct === 0
          ? `Citation réelle observée à ${obsRate} % sur ${obsCount} observations : conforme au potentiel mesuré, aucun ajustement.`
          : factorPct > 0
          ? `Citation réelle observée à ${obsRate} % sur ${obsCount} observations : la marque est citée plus souvent que ses signaux ne le laissaient prévoir (+${factorPct} %, ${pre}/100 → ${post}/100).`
          : `Citation réelle observée à ${obsRate} % sur ${obsCount} observations : la marque est citée moins souvent que ses signaux ne le laissaient prévoir (${factorPct} %, ${pre}/100 → ${post}/100).`,
    };
    if (factorPct <= -5) {
      rawGates.push({
        axis: 'geo_citation',
        reason: 'Écart entre potentiel et résultat : les signaux de citabilité sont meilleurs que la citation réellement observée dans les moteurs de réponse. Le score est calibré à la baisse.',
        evidence: `citation observée ${obsRate} % sur ${obsCount} observations → cible ${GEO_CALIBRATION_NEUTRAL_PCT} % (score ${calibration.pre_score}/100 ramené à ${post}/100)`,
        measured: `${obsRate} % de citation`,
        target: `${GEO_CALIBRATION_NEUTRAL_PCT} % de citation observée`,
      });
    }
  }


  const priority = signals
    .filter((s) => s.value !== null && (s.value as number) < 60)
    .sort((a, b2) => (b2.weight * (100 - (b2.value as number))) - (a.weight * (100 - (a.value as number))))
    .slice(0, 3)
    .map((s) => ({ key: s.key, label: s.label, value: s.value as number, lever: s.lever }));

  const round1 = (n: number) => Math.round(n * 10) / 10;

  return {
    signals,
    authority,
    accessibility,
    content,
    geo_score: geo,
    geo_coverage: geoCoverage,
    pillar_points: {
      authority: round1(pillarTotals.authority),
      accessibility: round1(pillarTotals.accessibility),
      content: round1(pillarTotals.content),
    },
    pillar_trend: { ...GEO_PILLAR_TREND },
    weight_date: now.toISOString().slice(0, 10),
    gap: pageSide !== null && authority.score !== null ? Math.round((pageSide - authority.score) * 10) / 10 : null,
    verdict: v.verdict,
    verdict_label: v.label,
    verdict_explanation: v.explanation,
    priority_levers: priority,
    gates: normalizeGates(rawGates, 'geo'),
    citation_calibration: calibration,
  };
}

// ═══════════════════════════════════════════════
// Rendu HTML (charte Crawlers : violet, or, noir, blanc — aucun fond plein)
// ═══════════════════════════════════════════════

const VIOLET = '#6d28d9';
const GOLD = '#8a6d1f';

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const PILLAR_ACCENT: Record<GeoPillar, string> = {
  authority: GOLD,
  accessibility: VIOLET,
  content: '#111827',
};

/** Tendance du barème : autorité constante, accessibilité en marches, contenu croissant. */
function trendText(p: GeoPillar, lang?: string): string {
  const en = lang === 'en';
  if (p === 'authority') return en ? 'constant 25 pts' : 'constant 25 pts';
  if (p === 'accessibility') {
    return en
      ? `−1 pt / ${GEO_ACCESSIBILITY_STEP_MONTHS} months, floor ${GEO_ACCESSIBILITY_FLOOR} pts`
      : `−1 pt / ${GEO_ACCESSIBILITY_STEP_MONTHS} mois, plancher ${GEO_ACCESSIBILITY_FLOOR} pts`;
  }
  const ceiling = 100 - GEO_PILLAR_POINTS.authority - GEO_ACCESSIBILITY_FLOOR;
  return en ? `rises to ${ceiling} pts` : `monte vers ${ceiling} pts`;
}


function barRow(s: GeoSubSignalValue, lang?: string): string {
  const v = s.value;
  const color = v === null ? '#9ca3af' : v >= 60 ? '#111827' : v >= 35 ? GOLD : VIOLET;
  const width = v === null ? 0 : v;
  return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;page-break-inside:avoid;">
    <span style="font-size:11px;color:#374151;width:180px;flex-shrink:0;">${esc(s.label)} <span style="color:#9ca3af;">(${s.weight} pts)</span></span>
    <span style="flex-shrink:0;">${provenanceBadge(s.provenance, lang)}</span>
    <div style="flex:1;border:1px solid #e5e7eb;border-radius:4px;height:8px;overflow:hidden;">
      <div style="width:${width}%;height:100%;background:${color};"></div>
    </div>
    <span style="font-size:11px;font-weight:600;color:${color};width:36px;text-align:right;">${v === null ? 'n/m' : v}</span>
  </div>`;
}

function pillarBlock(
  key: GeoPillar,
  f: GeoFamilyScore,
  report: GeoSubSignalReport,
  signals: GeoSubSignalValue[],
  intro: string,
  lang?: string,
): string {
  const pts = report.pillar_points[key];
  const introText = lang === 'en'
    ? `${intro} ${f.measured}/${f.total} sub-signals measured (${f.coverage} % of weight). Weight ${pts} pts out of 100.`
    : `${intro} ${f.measured}/${f.total} sous-signaux mesurés (${f.coverage} % du poids). Poids ${pts} pts sur 100.`;
  return `<div style="flex:1 1 280px;border:1px solid #e5e7eb;border-left:3px solid ${PILLAR_ACCENT[key]};border-radius:8px;padding:12px 14px;background:#ffffff;">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
      <h4 style="font-size:13px;font-weight:600;color:#111827;margin:0;">${esc(f.label)}</h4>
      <span style="font-size:18px;font-weight:700;color:#111827;">${f.score === null ? 'n/m' : `${f.score}/100`}</span>
    </div>
    <p style="font-size:11px;color:#6b7280;margin:0 0 10px;line-height:1.5;">${esc(introText)}</p>
    ${signals.filter((s) => s.family === key).map((s) => barRow(s, lang)).join('')}
  </div>`;
}

/**
 * Tableau de décomposition du score GEO : une ligne par pilier, avec les
 * sous-signaux qui le composent, le poids en points du jour, le score du pilier
 * et les points effectivement acquis. La dernière ligne totalise à 100 pts et
 * reconstitue le score GEO affiché, pour qu'aucun chiffre du rapport ne soit
 * une boîte noire.
 */
function pillarTableHTML(report: GeoSubSignalReport, lang?: string): string {
  const en = lang === 'en';
  const rows = (['authority', 'accessibility', 'content'] as GeoPillar[]).map((key) => {
    const f = report[key];
    const pts = report.pillar_points[key];
    // Sous-signaux du pilier, du plus lourd au plus léger, avec leur poids en points.
    const members = report.signals
      .filter((s) => s.family === key)
      .sort((a, b) => b.weight - a.weight)
      .map((s) => `${esc(s.label)} ${s.weight.toFixed(1).replace(/\.0$/, '')} pts${s.value === null ? (en ? ' (not measured)' : ' (non mesuré)') : ''}`)
      .join(' · ');
    // Points acquis = score du pilier appliqué à son poids du jour.
    const earned = f.score === null ? null : Math.round((f.score / 100) * pts * 10) / 10;
    const scopeLabel = key === 'authority'
      ? (en ? 'domain (mutualized)' : 'domaine (mutualisé)')
      : (en ? 'page' : 'page');
    return `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;border-left:3px solid ${PILLAR_ACCENT[key]};vertical-align:top;">
        <div style="font-size:12px;font-weight:600;color:#111827;">${esc(f.label)} <span style="font-weight:400;color:#6b7280;">— ${esc(scopeLabel)}</span></div>
        <div style="font-size:10.5px;color:#6b7280;line-height:1.5;margin-top:3px;">${members}</div>
      </td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;font-weight:700;color:#111827;white-space:nowrap;vertical-align:top;">${pts} pts</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px;color:#374151;white-space:nowrap;vertical-align:top;">${f.score === null ? 'n/m' : `${f.score}/100`}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:12px;font-weight:600;color:#111827;white-space:nowrap;vertical-align:top;">${earned === null ? '—' : `${earned} pts`}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:10.5px;color:#6b7280;white-space:nowrap;vertical-align:top;">${esc(trendText(key, lang))}</td>
    </tr>`;
  }).join('');

  const totalEarned = (['authority', 'accessibility', 'content'] as GeoPillar[])
    .reduce((acc, key) => {
      const f = report[key];
      return f.score === null ? acc : acc + (f.score / 100) * report.pillar_points[key];
    }, 0);

  const cal = report.citation_calibration;
  const prePotential = cal.applied && cal.pre_score !== null ? cal.pre_score : report.geo_score;



  return `<table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;margin:0 0 14px;background:#ffffff;">
    <thead>
      <tr style="background:#f9fafb;">
        <th style="padding:8px 10px;text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">${en ? 'Pillar and its sub-signals' : 'Pilier et ses sous-signaux'}</th>
        <th style="padding:8px 10px;text-align:right;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${en ? 'Weight' : 'Poids'}</th>
        <th style="padding:8px 10px;text-align:right;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${en ? 'Score' : 'Score'}</th>
        <th style="padding:8px 10px;text-align:right;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${en ? 'Earned' : 'Acquis'}</th>
        <th style="padding:8px 10px;text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${en ? 'Scale' : 'Barème'}</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr style="background:#f9fafb;">
        <td style="padding:8px 10px;font-size:12px;font-weight:700;color:#111827;">${cal.applied && cal.factor_pct !== 0 ? (en ? 'Sub-total of measured signals (potential)' : 'Sous-total des signaux mesurés (potentiel)') : (en ? 'GEO total' : 'Total GEO')}</td>
        <td style="padding:8px 10px;text-align:right;font-size:13px;font-weight:700;color:#111827;white-space:nowrap;">100 pts</td>
        <td style="padding:8px 10px;text-align:right;font-size:12px;font-weight:700;color:#111827;white-space:nowrap;">${prePotential === null ? 'n/m' : `${prePotential}/100`}</td>
        <td style="padding:8px 10px;text-align:right;font-size:12px;font-weight:700;color:#111827;white-space:nowrap;">${report.geo_score === null ? '—' : `${Math.round(totalEarned * 10) / 10} pts`}</td>
        <td style="padding:8px 10px;"></td>
      </tr>
      ${cal.applied && cal.factor_pct !== 0 ? `
      <tr>
        <td style="padding:8px 10px;border-top:1px solid #e5e7eb;font-size:12px;color:#374151;">
          <strong style="color:#111827;">${en ? 'Observed-citation calibration' : 'Calibration par la citation observée'}</strong>
          <div style="font-size:10.5px;color:#6b7280;margin-top:2px;">${en
            ? `Observed citation rate ${cal.rate_pct} % over ${cal.observations} observations (neutral target ${GEO_CALIBRATION_NEUTRAL_PCT} %).`
            : `Taux de citation observé ${cal.rate_pct} % sur ${cal.observations} observations (cible neutre ${GEO_CALIBRATION_NEUTRAL_PCT} %).`}</div>
        </td>
        <td style="padding:8px 10px;border-top:1px solid #e5e7eb;text-align:right;font-size:12px;color:#6b7280;white-space:nowrap;">±${GEO_CALIBRATION_MAX_PCT} % max</td>
        <td style="padding:8px 10px;border-top:1px solid #e5e7eb;text-align:right;font-size:12px;font-weight:600;color:${cal.factor_pct < 0 ? GOLD : '#111827'};white-space:nowrap;">${cal.factor_pct > 0 ? '+' : ''}${cal.factor_pct} %</td>
        <td style="padding:8px 10px;border-top:1px solid #e5e7eb;text-align:right;font-size:12px;color:#374151;white-space:nowrap;">${cal.pre_score}/100 → ${cal.post_score}/100</td>
        <td style="padding:8px 10px;border-top:1px solid #e5e7eb;font-size:10.5px;color:#6b7280;white-space:nowrap;">${en ? '0 % citation = −10 %' : '0 % de citation = −10 %'}</td>
      </tr>
      <tr style="background:#f9fafb;">
        <td style="padding:8px 10px;font-size:12px;font-weight:700;color:#111827;">${en ? 'GEO total after calibration' : 'Total GEO après calibration'}</td>
        <td style="padding:8px 10px;text-align:right;font-size:13px;font-weight:700;color:#111827;white-space:nowrap;">100 pts</td>
        <td style="padding:8px 10px;text-align:right;font-size:12px;font-weight:700;color:#111827;white-space:nowrap;">${report.geo_score === null ? 'n/m' : `${report.geo_score}/100`}</td>
        <td style="padding:8px 10px;"></td>
        <td style="padding:8px 10px;"></td>
      </tr>` : ''}
    </tbody>
  </table>`;
}


export function geoSubSignalsBlockHTML(report: GeoSubSignalReport, lang?: string): string {
  if (!report || report.signals.every((s) => s.value === null)) return '';
  const accent = report.verdict === 'comprehension_lag' ? VIOLET
    : report.verdict === 'authority_lag' ? GOLD
    : report.verdict === 'both_low' ? '#111827'
    : '#6b7280';

  const levers = report.priority_levers.length > 0
    ? `<ul style="padding-left:20px;font-size:12px;color:#374151;line-height:1.6;margin:8px 0 0;">
        ${report.priority_levers.map((l) => `<li style="margin-bottom:4px;"><strong>${esc(l.label)} (${l.value}/100)</strong> — ${esc(l.lever)}</li>`).join('')}
      </ul>`
    : '';

  const pp = report.pillar_points;
  const note = lang === 'en'
    ? `GEO scale at ${report.weight_date}: domain authority ${pp.authority} pts (mutualized, constant), machine accessibility ${pp.accessibility} pts, content exploitability ${pp.content} pts. ${100 - pp.authority} of the 100 pts therefore depend on the audited page itself. Machine accessibility loses 1 pt every ${GEO_ACCESSIBILITY_STEP_MONTHS} months down to a ${GEO_ACCESSIBILITY_FLOOR} pt floor — the advantage of being crawlable becomes a commodity as the web is renovated — and content exploitability absorbs those points, up to ${100 - GEO_PILLAR_POINTS.authority - GEO_ACCESSIBILITY_FLOOR} pts.`
    : `Barème GEO au ${report.weight_date} : autorité domaine ${pp.authority} pts (mutualisée, constante), accessibilité machine ${pp.accessibility} pts, exploitabilité contenu ${pp.content} pts. ${100 - pp.authority} des 100 pts dépendent donc de la page auditée elle-même. L’accessibilité machine perd 1 pt tous les ${GEO_ACCESSIBILITY_STEP_MONTHS} mois jusqu’à un plancher de ${GEO_ACCESSIBILITY_FLOOR} pts — être crawlable se commoditise à mesure que le parc de sites se rénove — et l’exploitabilité du contenu récupère ces points, jusqu’à ${100 - GEO_PILLAR_POINTS.authority - GEO_ACCESSIBILITY_FLOOR} pts.`;


  return `<div style="margin-top:16px;padding:14px;border:1px solid #e5e7eb;border-radius:8px;background:#ffffff;page-break-inside:avoid;text-align:left;">
    <h4 style="font-size:14px;font-weight:600;color:#111827;margin:0 0 6px;">${lang === 'en' ? 'GEO in 10 sub-signals across 3 pillars' : 'Le GEO en 10 sous-signaux, 3 piliers'}</h4>
    <p style="font-size:12px;color:#374151;line-height:1.6;margin:0 0 12px;">${lang === 'en'
      ? 'A single GEO score hides three realities. The ten sub-signals below are split into three pillars: what the machine can read and extract (accessibility), the value of the content worth citing (exploitability), and the credibility of the brand outside the site (domain authority). Each sub-signal carries the status of its data.'
      : 'Un score GEO global masque trois réalités. Les dix sous-signaux ci-dessous sont répartis en trois piliers : ce que la machine peut lire et extraire du site (accessibilité), la valeur du contenu à citer (exploitabilité), et la crédibilité de la marque hors du site (autorité domaine). Chaque sous-signal porte le statut de sa donnée.'}</p>
    ${pillarTableHTML(report, lang)}
    <div style="display:flex;flex-wrap:wrap;gap:12px;">
      ${pillarBlock('authority', report.authority, report, report.signals, lang === 'en' ? 'Credibility and entity attachment outside the site (mutualized at domain level).' : 'Crédibilité et rattachement de l’entité hors du site (mutualisée au domaine).', lang)}
      ${pillarBlock('accessibility', report.accessibility, report, report.signals, lang === 'en' ? 'Readability and extractability of the site as served.' : 'Lisibilité et extractibilité du site tel qu’il est servi.', lang)}
      ${pillarBlock('content', report.content, report, report.signals, lang === 'en' ? 'Value and quotability of the content itself.' : 'Valeur et citabilité du contenu lui-même.', lang)}
    </div>
    <p style="font-size:11px;color:#6b7280;line-height:1.6;margin:10px 0 0 0;">${esc(note)}</p>
    <div style="margin-top:10px;padding:12px;border:1px solid #e5e7eb;border-left:3px solid ${accent};border-radius:8px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin-bottom:4px;">${lang === 'en' ? 'Gap verdict' : 'Verdict d’écart'}${report.gap !== null ? ` — ${report.gap > 0 ? '+' : ''}${report.gap} points` : ''}</div>
      <p style="font-size:12px;color:#374151;line-height:1.6;margin:0;"><strong>${esc(report.verdict_label)}.</strong> ${esc(report.verdict_explanation)}</p>
      ${levers}
    </div>
    <div style="margin-top:10px;padding:12px;border:1px solid #e5e7eb;border-left:3px solid ${GOLD};border-radius:8px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin-bottom:4px;">${lang === 'en' ? 'Observed-citation calibration' : 'Calibration par la citation observée'}${report.citation_calibration.applied ? ` — ${report.citation_calibration.factor_pct > 0 ? '+' : ''}${report.citation_calibration.factor_pct} %` : ''}</div>
      <p style="font-size:12px;color:#374151;line-height:1.6;margin:0 0 6px;">${esc(report.citation_calibration.note)}</p>
      <p style="font-size:11px;color:#6b7280;line-height:1.6;margin:0;">${lang === 'en'
        ? `Rule: the sub-signals measure a citation <em>potential</em>; the LLM benchmark measures the <em>result</em>. The gap modulates the score by ±${GEO_CALIBRATION_MAX_PCT} % at most, never the scale. ${GEO_CALIBRATION_NEUTRAL_PCT} % observed citation is the neutral target (no adjustment); the penalty grows linearly below it and reaches its maximum, <strong>−${GEO_CALIBRATION_MAX_PCT} % of the score, when the brand is never cited by any answer engine (0 % citation)</strong>; above the target the bonus grows up to +${GEO_CALIBRATION_MAX_PCT} % at ${GEO_CALIBRATION_HIGH_PCT} %. Below ${GEO_CALIBRATION_MIN_OBSERVATIONS} observations no calibration is applied: too short a sample is not a measurement.`
        : `Règle : les sous-signaux mesurent un <em>potentiel</em> de citation, le benchmark LLM mesure le <em>résultat</em>. L’écart module le score de ±${GEO_CALIBRATION_MAX_PCT} % au maximum, jamais le barème. ${GEO_CALIBRATION_NEUTRAL_PCT} % de citation observée est la cible neutre (aucun ajustement) ; en dessous, la pénalité croît linéairement et atteint son maximum, <strong>−${GEO_CALIBRATION_MAX_PCT} % du score lorsque la marque n’est jamais citée par aucun moteur de réponse (0 % de citation)</strong> ; au-dessus de la cible, le bonus monte jusqu’à +${GEO_CALIBRATION_MAX_PCT} % à ${GEO_CALIBRATION_HIGH_PCT} %. Sous ${GEO_CALIBRATION_MIN_OBSERVATIONS} observations, aucune calibration n’est appliquée : un échantillon trop court n’est pas une mesure.`}</p>
    </div>

  </div>`;
}
