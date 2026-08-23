/**
 * _shared/geoSubSignals.ts — GEO en 3 piliers à pondération décroissante
 *
 * Le score GEO global (0-100) mélange ce que la machine comprend du site, la
 * valeur du contenu à citer, et ce que le web dit du site. Deux pages peuvent
 * afficher le même chiffre pour des raisons opposées, donc la même
 * recommandation générique.
 *
 * Ce module décompose le GEO en 10 sous-signaux répartis en 3 piliers :
 *
 *   AUTORITÉ DOMAINE (25 pts, constant, mutualisé au domaine)
 *     — crédibilité de la marque et présence mesurées hors de la page.
 *
 *   ACCESSIBILITÉ MACHINE (25 → 10 pts, décroissant)
 *     — ce qu'une machine peut lire et extraire du site tel qu'il est servi.
 *       Son poids est ÉLEVÉ aujourd'hui (le parc de sites concurrents est
 *       encore mal crawlable ou trop lent) et DÉCROÎT à mesure que ce parc se
 *       rénove : c'est un différenciateur transitoire qui se commoditise.
 *
 *   EXPLOITABILITÉ CONTENU (50 → 65 pts, croissant)
 *     — la valeur du contenu à citer (passages autoportants, données
 *       propriétaires, voix experte). Levier durable : son poids MONTE.
 *
 * La somme des trois piliers vaut toujours 100 : seul le partage glisse avec
 * le temps (demi-vie 18 mois, ancrée au 2026-08-01).
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

/**
 * Conservé pour compatibilité : le barème est désormais FIXE, cette valeur n'est
 * plus utilisée dans le calcul des poids.
 */
export function geoElapsedMonths(now: Date = new Date()): number {
  const anchor = Date.UTC(2026, 7, 1); // 2026-08-01 00:00 UTC
  return Math.max(0, (now.getTime() - anchor) / (1000 * 60 * 60 * 24 * (365.25 / 12)));
}

/** Barème GEO fixe (somme = 100) : 25 / 22 / 53. */
export const GEO_PILLAR_POINTS: Record<GeoPillar, number> = {
  authority: 25,
  accessibility: 22,
  content: 53,
};

/**
 * Poids des trois piliers (toujours sur 100, identiques à toute date) :
 *  - autorité domaine    : 25 (mutualisé)
 *  - accessibilité machine : 22 (page)
 *  - exploitabilité contenu : 53 (page)
 * Le paramètre `now` est conservé pour la compatibilité des appelants.
 */
export function geoPillarTotals(_now: Date = new Date()): Record<GeoPillar, number> {
  return { ...GEO_PILLAR_POINTS };
}

/** Tendance de chaque pilier : le barème est fixe, donc constant partout. */
export type GeoPillarTrend = 'constant' | 'decays' | 'grows';
export const GEO_PILLAR_TREND: Record<GeoPillar, GeoPillarTrend> = {
  authority: 'constant',
  accessibility: 'constant',
  content: 'constant',
};


/** Poids relatifs (fixes) des sous-signaux à l'intérieur de chaque pilier. */
export const GEO_PILLAR_REL: Record<GeoPillar, Record<string, number>> = {
  authority: { brand_authority: 14, serp_presence: 11 },
  accessibility: { bot_accessibility: 14, structured_data_quality: 12, content_freshness: 6 },
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

  // ── Pilier accessibilité machine (25 → 10, décroissant) ──────────────────
  {
    key: 'bot_accessibility',
    family: 'accessibility',
    label: 'Contenu accessible aux robots',
    weight: 14,
    provenance: 'mesure',
    meaning: 'Le contenu est présent dans le HTML servi, sans exécution de JavaScript.',
    lever: 'Rendre le contenu au serveur (SSR / prérendu) : sans cela, aucun autre signal de compréhension ne compte.',
  },
  {
    key: 'structured_data_quality',
    family: 'accessibility',
    label: 'Données structurées',
    weight: 12,
    provenance: 'mesure',
    meaning: 'Présence et pertinence des balisages JSON-LD qui déclarent la nature des pages.',
    lever: 'Déclarer les types utiles au domaine (Organization, Person, Article, FAQPage, LocalBusiness, Product).',
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

  // ── Pilier exploitabilité contenu (50 → 65, croissant) ───────────────────
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
  /** Pilier A — autorité domaine (25, constant, mutualisé). */
  authority: GeoFamilyScore;
  /** Pilier B — accessibilité machine (25 → 10, décroissant). */
  accessibility: GeoFamilyScore;
  /** Pilier C — exploitabilité contenu (50 → 65, croissant). */
  content: GeoFamilyScore;
  /** 0-100 : moyenne pondérée des piliers mesurés — reconstitue le GEO lisible. */
  geo_score: number | null;
  /** Poids en points des trois piliers à la date de l'audit (somme = 100). */
  pillar_points: Record<GeoPillar, number>;
  /** Tendance de chaque pilier (constant / décroît / monte). */
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
}

export interface GeoSignalInputs {
  /** citation_breakdown de citationScorer (8 clés). */
  breakdown?: Record<string, number | null | undefined> | null;
  /** true si le HTML servi est une coquille JS (botRenderingShell). */
  isBotShell?: boolean | null;
  /** Nombre de pages où un tag attendu est absent uniquement pour les robots. */
  botOnlyAbsences?: number | null;
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

/** Accessibilité robots : signal binaire dégradé par les absences bot-only. */
function scoreBotAccessibility(i: GeoSignalInputs): number | null {
  if (i.isBotShell === true) return 5;
  const botOnly = Number(i.botOnlyAbsences ?? 0) || 0;
  if (i.isBotShell === false) return botOnly > 0 ? Math.max(35, 90 - botOnly * 15) : 95;
  if (botOnly > 0) return Math.max(35, 90 - botOnly * 15);
  return null;
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
    structured_data_quality: num(b['structured_data_quality']),
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
  const geoParts = [
    { total: pillarTotals.authority, score: authority.score },
    { total: pillarTotals.accessibility, score: accessibility.score },
    { total: pillarTotals.content, score: content.score },
  ].filter((p) => p.score !== null);
  const geoDen = geoParts.reduce((a, p) => a + p.total, 0);
  const geo = geoDen > 0 ? clamp100(geoParts.reduce((a, p) => a + p.total * (p.score as number), 0) / geoDen) : null;

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

/** Barème fixe : chaque pilier porte un poids constant, indiqué en clair. */
function trendText(p: GeoPillar, lang?: string): string {
  const pts = GEO_PILLAR_POINTS[p];
  return lang === 'en' ? `fixed ${pts} pts` : `poids fixe ${pts} pts`;
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
  const trend = trendText(key, lang);
  const introText = lang === 'en'
    ? `${intro} ${f.measured}/${f.total} sub-signals measured (${f.coverage} % of weight). Weight ${pts} pts today — ${trend}.`
    : `${intro} ${f.measured}/${f.total} sous-signaux mesurés (${f.coverage} % du poids). Poids ${pts} pts aujourd’hui — ${trend}.`;
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

  return `<table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;margin:0 0 14px;background:#ffffff;">
    <thead>
      <tr style="background:#f9fafb;">
        <th style="padding:8px 10px;text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">${en ? 'Pillar and its sub-signals' : 'Pilier et ses sous-signaux'}</th>
        <th style="padding:8px 10px;text-align:right;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${en ? 'Weight' : 'Poids'}</th>
        <th style="padding:8px 10px;text-align:right;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${en ? 'Score' : 'Score'}</th>
        <th style="padding:8px 10px;text-align:right;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${en ? 'Earned' : 'Acquis'}</th>
        <th style="padding:8px 10px;text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${en ? 'Trend' : 'Tendance'}</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr style="background:#f9fafb;">
        <td style="padding:8px 10px;font-size:12px;font-weight:700;color:#111827;">${en ? 'GEO total' : 'Total GEO'}</td>
        <td style="padding:8px 10px;text-align:right;font-size:13px;font-weight:700;color:#111827;white-space:nowrap;">100 pts</td>
        <td style="padding:8px 10px;text-align:right;font-size:12px;font-weight:700;color:#111827;white-space:nowrap;">${report.geo_score === null ? 'n/m' : `${report.geo_score}/100`}</td>
        <td style="padding:8px 10px;text-align:right;font-size:12px;font-weight:700;color:#111827;white-space:nowrap;">${report.geo_score === null ? '—' : `${Math.round(totalEarned * 10) / 10} pts`}</td>
        <td style="padding:8px 10px;"></td>
      </tr>
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

  const note = lang === 'en'
    ? `Fixed GEO scale: domain authority 25 pts (mutualized), machine accessibility 22 pts, content exploitability 53 pts. 75 of the 100 pts therefore depend on the audited page itself, and weights are identical across audits — two reports compare directly.`
    : `Barème GEO fixe : autorité domaine 25 pts (mutualisée), accessibilité machine 22 pts, exploitabilité contenu 53 pts. 75 des 100 pts dépendent donc de la page auditée elle-même, et les poids sont identiques d’un audit à l’autre : deux rapports se comparent directement.`;

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
  </div>`;
}
