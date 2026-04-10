/**
 * Scoring Method Detector — auto-detects scoring methodology from document columns/values.
 * Extensible: add new ScoringMethod entries to SCORING_REGISTRY without changing any consumer code.
 */

export type ScoringMethodId =
  | 'score_100'      // Classic 0-100 score
  | 'rank'           // Citation rank (1=best)
  | 'boolean'        // Oui/Non, Yes/No, True/False, 1/0
  | 'likert_5'       // 1-5 scale
  | 'likert_10'      // 1-10 scale
  | 'grade_letter'   // A/B/C/D/F
  | 'percent'        // 0-100% (displayed with %)
  | 'stars'          // 1-5 stars ★
  | 'compliance'     // Conforme / Non-conforme / Partiel
  | 'custom';        // Unknown, fallback

export interface ScoringMethod {
  id: ScoringMethodId;
  label: string;
  description: string;
  /** How to interpret: 'higher_better' | 'lower_better' */
  direction: 'higher_better' | 'lower_better';
  /** Value range */
  range: { min: number; max: number };
  /** Threshold configuration */
  thresholds: {
    bon: number;
    moyen: number;
    mauvais: number;
  };
  /** Display configuration */
  display: {
    scoreLabel: string;       // e.g. "Score", "Rang", "Note"
    resultLabel: string;      // e.g. "Résultat", "Citation", "Verdict"
    formatScore: (score: number) => string;
    formatColor: (score: number, bon: number, moyen: number) => 'green' | 'yellow' | 'red';
  };
  /** Column header labels */
  labels: {
    seuil_bon: string;
    seuil_moyen: string;
    seuil_mauvais: string;
    poids: string;
    axe: string;
  };
  helpText: string;
}

/* ── Format helpers ──────────────────────────────────────────────── */

const higherBetterColor = (score: number, bon: number, moyen: number): 'green' | 'yellow' | 'red' => {
  if (score >= bon) return 'green';
  if (score >= moyen) return 'yellow';
  return 'red';
};

const lowerBetterColor = (score: number, bon: number, moyen: number): 'green' | 'yellow' | 'red' => {
  if (score === 0) return 'red'; // not found/cited
  if (score <= bon) return 'green';
  if (score <= moyen) return 'yellow';
  return 'red';
};

/* ── Scoring Registry ────────────────────────────────────────────── */

export const SCORING_REGISTRY: Record<ScoringMethodId, ScoringMethod> = {
  score_100: {
    id: 'score_100',
    label: 'Score /100',
    description: 'Scoring technique classique sur une échelle de 0 à 100',
    direction: 'higher_better',
    range: { min: 0, max: 100 },
    thresholds: { bon: 70, moyen: 40, mauvais: 0 },
    display: {
      scoreLabel: 'Score',
      resultLabel: 'Résultat',
      formatScore: (s) => `${s}/100`,
      formatColor: higherBetterColor,
    },
    labels: { seuil_bon: 'Bon (≥)', seuil_moyen: 'Moyen (≥)', seuil_mauvais: 'Mauvais', poids: 'Poids', axe: 'Catégorie' },
    helpText: 'Scoring classique 0-100. Bon ≥ 70, Moyen ≥ 40.',
  },

  rank: {
    id: 'rank',
    label: 'Rang de citation',
    description: 'Position dans les résultats LLM (1 = premier cité)',
    direction: 'lower_better',
    range: { min: 0, max: 99 },
    thresholds: { bon: 3, moyen: 10, mauvais: 0 },
    display: {
      scoreLabel: 'Rang',
      resultLabel: 'Citation',
      formatScore: (s) => s === 0 ? 'Non cité' : `Rang ${s}`,
      formatColor: lowerBetterColor,
    },
    labels: { seuil_bon: 'Top (rang ≤)', seuil_moyen: 'Acceptable (rang ≤)', seuil_mauvais: 'Absent', poids: 'Poids', axe: 'Moteur' },
    helpText: 'Mode Rang : positions de classement. Top = rang ≤ 3, Acceptable = rang ≤ 10.',
  },

  boolean: {
    id: 'boolean',
    label: 'Oui / Non',
    description: 'Évaluation binaire : présent ou absent',
    direction: 'higher_better',
    range: { min: 0, max: 1 },
    thresholds: { bon: 1, moyen: 1, mauvais: 0 },
    display: {
      scoreLabel: 'Présent',
      resultLabel: 'Verdict',
      formatScore: (s) => s >= 1 ? '✅ Oui' : '❌ Non',
      formatColor: (s) => s >= 1 ? 'green' : 'red',
    },
    labels: { seuil_bon: 'Requis', seuil_moyen: '—', seuil_mauvais: 'Absent', poids: 'Poids', axe: 'Catégorie' },
    helpText: 'Mode binaire : vérifie la présence ou l\'absence d\'un élément.',
  },

  likert_5: {
    id: 'likert_5',
    label: 'Échelle 1-5',
    description: 'Notation sur une échelle de 1 à 5',
    direction: 'higher_better',
    range: { min: 1, max: 5 },
    thresholds: { bon: 4, moyen: 3, mauvais: 1 },
    display: {
      scoreLabel: 'Note',
      resultLabel: 'Évaluation',
      formatScore: (s) => `${s}/5`,
      formatColor: higherBetterColor,
    },
    labels: { seuil_bon: 'Bon (≥)', seuil_moyen: 'Moyen (≥)', seuil_mauvais: 'Faible', poids: 'Poids', axe: 'Catégorie' },
    helpText: 'Échelle de Likert 1-5. Bon ≥ 4, Moyen ≥ 3.',
  },

  likert_10: {
    id: 'likert_10',
    label: 'Échelle 1-10',
    description: 'Notation sur une échelle de 1 à 10',
    direction: 'higher_better',
    range: { min: 1, max: 10 },
    thresholds: { bon: 7, moyen: 5, mauvais: 1 },
    display: {
      scoreLabel: 'Note',
      resultLabel: 'Évaluation',
      formatScore: (s) => `${s}/10`,
      formatColor: higherBetterColor,
    },
    labels: { seuil_bon: 'Bon (≥)', seuil_moyen: 'Moyen (≥)', seuil_mauvais: 'Faible', poids: 'Poids', axe: 'Catégorie' },
    helpText: 'Échelle 1-10. Bon ≥ 7, Moyen ≥ 5.',
  },

  grade_letter: {
    id: 'grade_letter',
    label: 'Notes A-F',
    description: 'Système de notation par lettres (A=5, B=4, C=3, D=2, F=1)',
    direction: 'higher_better',
    range: { min: 1, max: 5 },
    thresholds: { bon: 4, moyen: 3, mauvais: 1 },
    display: {
      scoreLabel: 'Note',
      resultLabel: 'Grade',
      formatScore: (s) => {
        const grades = ['F', 'D', 'C', 'B', 'A'];
        return grades[Math.min(Math.max(Math.round(s) - 1, 0), 4)] || `${s}`;
      },
      formatColor: higherBetterColor,
    },
    labels: { seuil_bon: 'Bon (≥)', seuil_moyen: 'Moyen (≥)', seuil_mauvais: 'Faible', poids: 'Poids', axe: 'Catégorie' },
    helpText: 'Notes par lettre : A (excellent), B (bon), C (moyen), D (faible), F (échec).',
  },

  percent: {
    id: 'percent',
    label: 'Pourcentage',
    description: 'Scoring en pourcentage (0-100%)',
    direction: 'higher_better',
    range: { min: 0, max: 100 },
    thresholds: { bon: 80, moyen: 50, mauvais: 0 },
    display: {
      scoreLabel: 'Taux',
      resultLabel: 'Résultat',
      formatScore: (s) => `${s}%`,
      formatColor: higherBetterColor,
    },
    labels: { seuil_bon: 'Bon (≥)', seuil_moyen: 'Moyen (≥)', seuil_mauvais: 'Faible', poids: 'Poids', axe: 'Catégorie' },
    helpText: 'Scoring en pourcentage. Bon ≥ 80%, Moyen ≥ 50%.',
  },

  stars: {
    id: 'stars',
    label: 'Étoiles ★',
    description: 'Notation par étoiles de 1 à 5',
    direction: 'higher_better',
    range: { min: 0, max: 5 },
    thresholds: { bon: 4, moyen: 3, mauvais: 0 },
    display: {
      scoreLabel: 'Étoiles',
      resultLabel: 'Note',
      formatScore: (s) => '★'.repeat(Math.round(s)) + '☆'.repeat(5 - Math.round(s)),
      formatColor: higherBetterColor,
    },
    labels: { seuil_bon: 'Bon (≥)', seuil_moyen: 'Moyen (≥)', seuil_mauvais: 'Faible', poids: 'Poids', axe: 'Catégorie' },
    helpText: 'Notation par étoiles (1-5). Bon ≥ 4★, Moyen ≥ 3★.',
  },

  compliance: {
    id: 'compliance',
    label: 'Conformité',
    description: 'Conforme / Partiel / Non-conforme',
    direction: 'higher_better',
    range: { min: 0, max: 2 },
    thresholds: { bon: 2, moyen: 1, mauvais: 0 },
    display: {
      scoreLabel: 'Statut',
      resultLabel: 'Conformité',
      formatScore: (s) => s >= 2 ? '✅ Conforme' : s >= 1 ? '⚠️ Partiel' : '❌ Non conforme',
      formatColor: (s) => s >= 2 ? 'green' : s >= 1 ? 'yellow' : 'red',
    },
    labels: { seuil_bon: 'Conforme', seuil_moyen: 'Partiel', seuil_mauvais: 'Non conforme', poids: 'Poids', axe: 'Catégorie' },
    helpText: 'Mode conformité : Conforme, Partiel, ou Non conforme.',
  },

  custom: {
    id: 'custom',
    label: 'Personnalisé',
    description: 'Méthode de scoring détectée automatiquement',
    direction: 'higher_better',
    range: { min: 0, max: 100 },
    thresholds: { bon: 70, moyen: 40, mauvais: 0 },
    display: {
      scoreLabel: 'Score',
      resultLabel: 'Résultat',
      formatScore: (s) => `${s}`,
      formatColor: higherBetterColor,
    },
    labels: { seuil_bon: 'Bon', seuil_moyen: 'Moyen', seuil_mauvais: 'Mauvais', poids: 'Poids', axe: 'Catégorie' },
    helpText: 'Scoring personnalisé détecté depuis le document importé.',
  },
};

/* ── Detection patterns ──────────────────────────────────────────── */

const SCORING_SHEET_PATTERNS = [
  /^scoring$/i, /^notation$/i, /^grille$/i, /^barème$/i, /^scale$/i,
  /^échelle$/i, /^légende$/i, /^legend$/i,
];

const SCORING_COLUMN_PATTERNS: { pattern: RegExp; method: ScoringMethodId }[] = [
  // Rank/citation
  { pattern: /^(rang|rank|position|classement|citation_rank)$/i, method: 'rank' },
  // Boolean
  { pattern: /^(oui.?non|yes.?no|pr[eé]sent|absent|pass.?fail|conforme|v[eé]rifi[eé])$/i, method: 'boolean' },
  // Grade letter
  { pattern: /^(grade|note_lettre|letter_grade|notation_[a-f])$/i, method: 'grade_letter' },
  // Stars
  { pattern: /^([eé]toiles?|stars?|rating)$/i, method: 'stars' },
  // Percent
  { pattern: /^(pourcentage|percent|taux|%)$/i, method: 'percent' },
  // Compliance
  { pattern: /^(conformit[eé]|compliance|statut_conformit[eé])$/i, method: 'compliance' },
  // Likert
  { pattern: /^(likert|[eé]chelle|scale)$/i, method: 'likert_5' },
];

/* ── Value-based detection ───────────────────────────────────────── */

function detectFromValues(sampleValues: (string | number)[]): ScoringMethodId | null {
  const strVals = sampleValues.map(v => String(v).trim().toLowerCase());
  const numVals = sampleValues.map(v => Number(v)).filter(n => !isNaN(n));

  // Boolean detection: all values are oui/non, yes/no, true/false, 0/1
  const boolPatterns = /^(oui|non|yes|no|true|false|vrai|faux|1|0|✅|❌|✓|✗|x)$/i;
  if (strVals.length > 0 && strVals.every(v => boolPatterns.test(v))) return 'boolean';

  // Grade letter detection: all values are A-F
  if (strVals.length > 0 && strVals.every(v => /^[a-f][\+\-]?$/i.test(v))) return 'grade_letter';

  // Compliance detection: conforme/partiel/non conforme
  const compliancePatterns = /^(conforme|non.?conforme|partiel|partial|compliant|non.?compliant|nc|c|p)$/i;
  if (strVals.length > 0 && strVals.every(v => compliancePatterns.test(v))) return 'compliance';

  // Stars detection: values with ★ or values 1-5 with "étoile" header
  if (strVals.some(v => v.includes('★') || v.includes('☆'))) return 'stars';

  // Numeric range detection
  if (numVals.length >= 3) {
    const max = Math.max(...numVals);
    const min = Math.min(...numVals);
    if (max <= 5 && min >= 1) return 'likert_5';
    if (max <= 10 && min >= 1) return 'likert_10';
    // Percentage values often stored as 0-1 decimals
    if (max <= 1 && min >= 0 && numVals.some(n => n > 0 && n < 1)) return 'percent';
  }

  return null;
}

/* ── Scoring sheet detection ─────────────────────────────────────── */

export function detectScoringSheet(sheetNames: string[]): string | null {
  for (const name of sheetNames) {
    if (SCORING_SHEET_PATTERNS.some(p => p.test(name.trim()))) {
      return name;
    }
  }
  return null;
}

/* ── Main detection function ─────────────────────────────────────── */

export interface ScoringDetectionResult {
  method: ScoringMethodId;
  confidence: number;
  source: 'column_header' | 'column_values' | 'scoring_sheet' | 'matrice_type' | 'default';
  detectedColumn?: string;
}

/**
 * Detects the scoring method from document structure.
 * Priority: scoring sheet > column header > value analysis > matrice type fallback
 */
export function detectScoringMethod(
  headers: string[],
  sampleRows: Record<string, any>[],
  matriceType?: string,
  scoringSheetData?: Record<string, any>[],
): ScoringDetectionResult {
  // 1. Check for dedicated scoring sheet data
  if (scoringSheetData && scoringSheetData.length > 0) {
    const sheetHeaders = Object.keys(scoringSheetData[0]);
    for (const { pattern, method } of SCORING_COLUMN_PATTERNS) {
      if (sheetHeaders.some(h => pattern.test(h.trim()))) {
        return { method, confidence: 0.95, source: 'scoring_sheet', detectedColumn: sheetHeaders.find(h => pattern.test(h.trim())) };
      }
    }
  }

  // 2. Check column headers in main data
  for (const { pattern, method } of SCORING_COLUMN_PATTERNS) {
    const match = headers.find(h => pattern.test(h.trim()));
    if (match) {
      return { method, confidence: 0.85, source: 'column_header', detectedColumn: match };
    }
  }

  // 3. Detect from sample values in result/score columns
  const scoreColumnPatterns = /^(score|résultat|result|note|notation|value|valeur|réponse|answer|response)$/i;
  const scoreCol = headers.find(h => scoreColumnPatterns.test(h.trim()));
  if (scoreCol && sampleRows.length > 0) {
    const values = sampleRows.map(r => r[scoreCol]).filter(v => v != null && v !== '');
    const detected = detectFromValues(values);
    if (detected) {
      return { method: detected, confidence: 0.75, source: 'column_values', detectedColumn: scoreCol };
    }
  }

  // 4. Fallback to matrice type
  if (matriceType === 'benchmark') return { method: 'rank', confidence: 0.9, source: 'matrice_type' };
  if (matriceType === 'geo') return { method: 'score_100', confidence: 0.7, source: 'matrice_type' };
  
  // 5. Default
  return { method: 'score_100', confidence: 0.5, source: 'default' };
}

/**
 * Get the full ScoringMethod config for a detected method ID.
 */
export function getScoringConfig(methodId: ScoringMethodId): ScoringMethod {
  return SCORING_REGISTRY[methodId] || SCORING_REGISTRY.custom;
}
