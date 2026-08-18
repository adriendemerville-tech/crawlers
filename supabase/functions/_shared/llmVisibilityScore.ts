/**
 * _shared/llmVisibilityScore.ts
 *
 * Scoring de la visibilité LLM mesurée, en trois grandeurs SÉPARÉES :
 *
 *  1. `coverage` — taux de citation brut (binaire) : combien d'interrogations
 *     sur le total ont fait apparaître la marque. C'est le chiffre robuste,
 *     lisible et comparable dans le temps. Accompagné de son intervalle de
 *     confiance de Wilson (obligatoire : sur un seul run, 6 hits sur 27
 *     interrogations, c'est 22 % mais l'intervalle réel est [10 % ; 41 %]).
 *
 *  2. `quality` — score composite 0-100 (itération, rang, tonalité, richesse),
 *     agrégé hiérarchiquement : question → axe → global, avec une PONDÉRATION
 *     PAR AXE. Une absence sur « meilleure position SERP » est un signal fort
 *     (le site est 1er sur Google et invisible en IA) ; une absence sur
 *     « potentiel non capté » est un potentiel, pas un défaut. Sans cette
 *     pondération l'échelle redevient plate.
 *
 *  3. `reliability` — fiabilité de la mesure en fonction du nombre de runs et
 *     de la taille de l'échantillon. Un score ponctuel n'est jamais présenté
 *     comme un fait stable.
 *
 * Le score GEO (voir _shared/citationScorer.ts) mesure un POTENTIEL de
 * citabilité de façon déterministe ; ce module mesure une RÉALITÉ observée.
 * `comparePotentialVsMeasured` interprète l'écart entre les deux — c'est le
 * constat le plus utile du rapport et il n'existe nulle part ailleurs.
 *
 * Consommateurs : calculate-llm-visibility, marina.
 */

export type AxisKey = 'covered' | 'ranked' | 'demand' | 'identity';

/**
 * Poids diagnostique par axe de marché.
 * ranked  : corrélation SEO → GEO. Une absence ici est le signal le plus fort.
 * covered : conversion de la couverture éditoriale en citation.
 * demand  : marché laissé aux concurrents — potentiel, jamais échec.
 * identity: repli quand la donnée SERP est trop faible (besoin déclaré).
 */
export const AXIS_WEIGHTS: Record<AxisKey, number> = {
  ranked: 2.0,
  covered: 1.5,
  identity: 1.5,
  demand: 1.0,
};

export function axisWeight(id: string | null | undefined): number {
  return AXIS_WEIGHTS[(id || '') as AxisKey] ?? 1.0;
}

// ═══════════════════════════════════════════════
// 1. COUVERTURE (taux de citation binaire + Wilson)
// ═══════════════════════════════════════════════

export interface CoverageStats {
  /** Interrogations réellement mesurées (questions × modèles), pannes exclues. */
  observations: number;
  /** Interrogations où la marque est apparue (toute itération confondue). */
  hits: number;
  /** Taux de citation en % (0-100), null si aucune observation. */
  rate: number | null;
  /** Bornes de l'intervalle de Wilson à 95 % en % (0-100). */
  ci_low: number | null;
  ci_high: number | null;
}

/**
 * Intervalle de Wilson à 95 % — correct sur petits échantillons, contrairement
 * à l'approximation normale qui produit des bornes négatives dès que hits est
 * proche de 0.
 */
export function wilsonInterval(hits: number, observations: number, z = 1.96): [number, number] {
  if (observations <= 0) return [0, 0];
  const p = hits / observations;
  const n = observations;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  const low = Math.max(0, (centre - margin) / denom);
  const high = Math.min(1, (centre + margin) / denom);
  return [low, high];
}

export function computeCoverage(hits: number, observations: number): CoverageStats {
  if (!observations || observations <= 0) {
    return { observations: 0, hits: 0, rate: null, ci_low: null, ci_high: null };
  }
  const safeHits = Math.max(0, Math.min(hits, observations));
  const [low, high] = wilsonInterval(safeHits, observations);
  return {
    observations,
    hits: safeHits,
    rate: Math.round((safeHits / observations) * 100),
    ci_low: Math.round(low * 100),
    ci_high: Math.round(high * 100),
  };
}

// ═══════════════════════════════════════════════
// 2. QUALITÉ (agrégation hiérarchique pondérée)
// ═══════════════════════════════════════════════

export interface AxisScoreInput {
  id: string;
  /** Score composite moyen de l'axe (0-100), null si non mesuré. */
  score: number | null;
}

/**
 * score_global = Σ(poids_axe × score_axe) / Σ(poids_axe des axes mesurés)
 * Les axes non mesurés sont exclus du numérateur ET du dénominateur : un axe
 * en panne ne tire pas le score vers le bas.
 */
export function weightedGlobalScore(axes: AxisScoreInput[]): number | null {
  const measured = axes.filter(a => a.score !== null && a.score !== undefined);
  if (measured.length === 0) return null;
  let num = 0;
  let den = 0;
  for (const a of measured) {
    const w = axisWeight(a.id);
    num += w * (a.score as number);
    den += w;
  }
  if (den <= 0) return null;
  return Math.round(Math.max(0, Math.min(100, num / den)));
}

// ═══════════════════════════════════════════════
// 3. FIABILITÉ
// ═══════════════════════════════════════════════

export type ReliabilityLevel = 'insufficient' | 'low' | 'medium' | 'solid';

export interface Reliability {
  level: ReliabilityLevel;
  label: string;
  /** Phrase prête à l'affichage, à coller sous le score. */
  caveat: string;
  runs: number;
  observations: number;
}

export function assessReliability(
  observations: number,
  runs = 1,
  stdDev: number | null = null,
): Reliability {
  if (observations <= 0) {
    return {
      level: 'insufficient',
      label: 'Non mesuré',
      caveat: "Aucune interrogation n'a abouti sur ce run : aucun score n'est produit (un zéro serait un faux négatif).",
      runs,
      observations,
    };
  }
  if (runs >= 3 && stdDev !== null && stdDev < 10) {
    return {
      level: 'solid',
      label: 'Fiabilité solide',
      caveat: `Mesure répétée sur ${runs} runs avec un écart-type de ${Math.round(stdDev)} points : la tendance est stable.`,
      runs,
      observations,
    };
  }
  if (runs >= 2) {
    return {
      level: 'medium',
      label: 'Fiabilité moyenne',
      caveat: `Mesure répétée sur ${runs} runs (${observations} interrogations) : la tendance se dégage, l'ordre de grandeur est fiable.`,
      runs,
      observations,
    };
  }
  return {
    level: 'low',
    label: 'Fiabilité faible',
    caveat: `Mesure sur un seul run (${observations} interrogations). Les réponses des modèles ne sont pas déterministes : lire la fourchette, pas le point.`,
    runs,
    observations,
  };
}

// ═══════════════════════════════════════════════
// 4. POTENTIEL (score GEO) vs MESURÉ (taux de citation)
// ═══════════════════════════════════════════════

export type GapVerdict = 'notoriety_gap' | 'structure_gap' | 'aligned' | 'both_low' | 'unknown';

export interface PotentialVsMeasured {
  verdict: GapVerdict;
  label: string;
  explanation: string;
  potential: number | null;
  measured: number | null;
  gap: number | null;
}

/**
 * Interprète l'écart entre le potentiel de citabilité (déterministe : SERP,
 * données structurées, fraîcheur, autorité) et la citation réellement observée.
 *
 * - potentiel élevé + citation faible → le site est techniquement citable mais
 *   absent des réponses : problème d'entité / de notoriété, pas de structure.
 * - potentiel faible + citation correcte → la marque est citée malgré une
 *   structure faible : l'acquis vient de la notoriété, la structure est le
 *   levier d'amplification.
 */
export function comparePotentialVsMeasured(
  potential: number | null | undefined,
  measuredRate: number | null | undefined,
): PotentialVsMeasured {
  const p = typeof potential === 'number' && Number.isFinite(potential) ? Math.round(potential) : null;
  const m = typeof measuredRate === 'number' && Number.isFinite(measuredRate) ? Math.round(measuredRate) : null;

  if (p === null || m === null) {
    return {
      verdict: 'unknown',
      label: 'Comparaison indisponible',
      explanation:
        "L'un des deux indicateurs n'a pas pu être mesuré sur ce run : l'écart entre potentiel de citabilité et citation observée n'est pas interprétable.",
      potential: p,
      measured: m,
      gap: null,
    };
  }

  const gap = p - m;

  if (gap >= 25) {
    return {
      verdict: 'notoriety_gap',
      label: 'Potentiel non converti',
      explanation:
        `Le potentiel de citabilité est de ${p}/100 alors que la citation réellement observée n'est que de ${m} %. ` +
        "Les fondations techniques sont donc en place — le frein est la notoriété de l'entité : la marque n'est pas assez " +
        "reconnue et rattachée à son domaine dans les sources que les modèles consultent. Le levier est la présence hors-site " +
        "(mentions, annuaires de référence, presse, profils d'auteurs), pas une nouvelle passe technique.",
      potential: p,
      measured: m,
      gap,
    };
  }

  if (gap <= -25) {
    return {
      verdict: 'structure_gap',
      label: 'Notoriété en avance sur la structure',
      explanation:
        `La marque est citée dans ${m} % des interrogations alors que son potentiel de citabilité n'est que de ${p}/100. ` +
        "La notoriété porte donc déjà les citations, mais rien ne les consolide côté site : données structurées, " +
        "fraîcheur et passages citables sont le levier d'amplification le plus rentable, car ils s'appuient sur un acquis existant.",
      potential: p,
      measured: m,
      gap,
    };
  }

  if (p < 35 && m < 35) {
    return {
      verdict: 'both_low',
      label: 'Fondations et citations faibles',
      explanation:
        `Potentiel de citabilité ${p}/100 et citation observée ${m} % : les deux indicateurs sont bas et cohérents entre eux. ` +
        "La priorité est séquentielle — structurer d'abord (données structurées, passages citables, fraîcheur), " +
        "puis travailler la notoriété de l'entité. Inverser l'ordre produit des mentions que rien ne rattache au site.",
      potential: p,
      measured: m,
      gap,
    };
  }

  return {
    verdict: 'aligned',
    label: 'Potentiel et citations alignés',
    explanation:
      `Potentiel de citabilité ${p}/100 et citation observée ${m} % : les deux indicateurs concordent. ` +
      "La mesure ne révèle pas de goulot isolé — la progression viendra d'une poussée simultanée sur la structure et sur la notoriété.",
    potential: p,
    measured: m,
    gap,
  };
}

// ═══════════════════════════════════════════════
// 5. AGRÉGAT COMPLET (ce que consomme Marina)
// ═══════════════════════════════════════════════

export interface LlmVisibilityAggregate {
  coverage: CoverageStats;
  /** Score de qualité pondéré par axe (0-100), null si rien de mesuré. */
  quality_score: number | null;
  /** Score de qualité non pondéré, pour comparaison / historique. */
  flat_score: number | null;
  reliability: Reliability;
  axis_weights: Record<string, number>;
  per_axis: Array<{ id: string; label: string; weight: number; score: number | null; coverage: CoverageStats }>;
}

export function buildAggregate(
  axes: Array<{ id: string; label: string; score: number | null; hits: number; observations: number }>,
  runs = 1,
): LlmVisibilityAggregate {
  const totalHits = axes.reduce((s, a) => s + (a.hits || 0), 0);
  const totalObs = axes.reduce((s, a) => s + (a.observations || 0), 0);
  const measured = axes.filter(a => a.score !== null && a.score !== undefined);

  return {
    coverage: computeCoverage(totalHits, totalObs),
    quality_score: weightedGlobalScore(axes.map(a => ({ id: a.id, score: a.score }))),
    flat_score: measured.length
      ? Math.round(measured.reduce((s, a) => s + (a.score as number), 0) / measured.length)
      : null,
    reliability: assessReliability(totalObs, runs),
    axis_weights: { ...AXIS_WEIGHTS },
    per_axis: axes.map(a => ({
      id: a.id,
      label: a.label,
      weight: axisWeight(a.id),
      score: a.score,
      coverage: computeCoverage(a.hits, a.observations),
    })),
  };
}
