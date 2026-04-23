/**
 * legacyToMatrixResult — Adapter from the legacy `MatriceReportData.results`
 * shape (prompt/axe/poids/score) to enriched `MatrixResult[]` consumable by
 * MatricePivotView and MatriceCube3D.
 *
 * This is a best-effort mapping: legacy data does not carry sourceFunction nor
 * matchType, so we synthesize stable values from the `axe` field.
 */

import type { MatrixResult } from './matrixOrchestrator';

export interface LegacyMatriceRow {
  prompt: string;
  axe: string;
  poids: number;
  score: number;
  parsed_score?: number;
  crawlers_score?: number;
  seuil_bon: number;
  seuil_moyen: number;
  seuil_mauvais: number;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function legacyToMatrixResults(rows: LegacyMatriceRow[]): MatrixResult[] {
  return rows.map((r, i) => {
    const cat = slug(r.axe || 'general') || 'general';
    const parsed = r.parsed_score ?? r.score;
    const crawlers = r.crawlers_score ?? r.score;

    // Heuristic: if both scores are equal we treat it as a direct technical match.
    const matchType: string =
      r.parsed_score != null && r.crawlers_score != null && r.parsed_score !== r.crawlers_score
        ? 'partial'
        : 'exact';

    const result = {
      criterionId: `legacy-${i}-${slug(r.prompt).slice(0, 40)}`,
      criterionTitle: r.prompt,
      matchType,
      parsedScore: typeof parsed === 'number' ? parsed : null,
      parsedResponse: null,
      crawlersScore: typeof crawlers === 'number' ? crawlers : null,
      crawlersData: null,
      sourceFunction: `cat-${cat}`,
      confidence: 1,
    } as MatrixResult;

    // Augment with optional fields consumed by pivot/cube layouts.
    (result as any).criterionCategory = cat;
    (result as any).criterionWeight = r.poids;

    return result;
  });
}
