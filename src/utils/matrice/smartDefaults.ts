/**
 * Smart defaults for matrice audit — adapts seuils, poids, and column labels
 * based on the detected MatriceType AND ScoringMethod.
 * Now config-driven via SCORING_REGISTRY.
 */

import type { MatriceType } from './typeDetector';
import { type ScoringMethodId, getScoringConfig, type ScoringMethod } from './scoringDetector';

export interface MatriceDefaults {
  poids: number;
  axe: string;
  seuil_bon: number;
  seuil_moyen: number;
  seuil_mauvais: number;
  llm_name: string;
  /** Scoring method config (full) */
  scoring: ScoringMethod;
  /** Column header labels for the scoring columns */
  labels: {
    seuil_bon: string;
    seuil_moyen: string;
    seuil_mauvais: string;
    poids: string;
    axe: string;
  };
  /** Help text shown under the table */
  helpText: string;
}

/** Map matrice type → default scoring method */
const TYPE_TO_SCORING: Record<MatriceType, ScoringMethodId> = {
  seo: 'score_100',
  geo: 'score_100',
  hybrid: 'score_100',
  benchmark: 'rank',
};

/** Override axe defaults per matrice type */
const TYPE_AXE: Record<MatriceType, string> = {
  seo: 'SEO',
  geo: 'GEO',
  hybrid: 'Hybride',
  benchmark: 'Benchmark',
};

/** Override thresholds per matrice type (if different from scoring default) */
const TYPE_THRESHOLD_OVERRIDES: Partial<Record<MatriceType, { bon: number; moyen: number }>> = {
  geo: { bon: 60, moyen: 30 },
  hybrid: { bon: 65, moyen: 35 },
};

/**
 * Returns context-aware defaults based on matrice type and optional scoring method override.
 * If scoringMethodId is provided, it takes priority over the matrice type default.
 */
export function getSmartDefaults(type: MatriceType, scoringMethodId?: ScoringMethodId): MatriceDefaults {
  const effectiveScoringId = scoringMethodId || TYPE_TO_SCORING[type] || 'score_100';
  const scoring = getScoringConfig(effectiveScoringId);
  
  const thresholdOverride = TYPE_THRESHOLD_OVERRIDES[type];
  const bon = thresholdOverride?.bon ?? scoring.thresholds.bon;
  const moyen = thresholdOverride?.moyen ?? scoring.thresholds.moyen;

  return {
    poids: 1,
    axe: TYPE_AXE[type] || 'Général',
    seuil_bon: bon,
    seuil_moyen: moyen,
    seuil_mauvais: scoring.thresholds.mauvais,
    llm_name: type === 'benchmark' ? '' : 'google/gemini-2.5-flash',
    scoring,
    labels: scoring.labels,
    helpText: scoring.helpText,
  };
}
