import type { MatriceVariant, BenchmarkData } from './types';

/**
 * Heuristique pour choisir le bon canvas en fonction des données.
 *
 * - scored-wide  : ≥1 colonne `<Engine>_Score_Citabilite` détectée à l'import
 *                  → généralement reflété par engines IA dans le benchmark.
 * - geo          : benchmark theme×engine standard (sans suffixe scored-wide).
 * - expert       : >5 axes distincts ou colonnes hétérogènes.
 * - standard     : fallback par défaut (matrice SEO classique).
 */
export function detectMatriceVariant(input: {
  benchmark?: BenchmarkData;
  importedFormat?: 'scored-wide' | 'standard' | null;
  axesCount?: number;
}): MatriceVariant {
  const { benchmark, importedFormat, axesCount } = input;

  if (importedFormat === 'scored-wide') return 'scored-wide';

  if (benchmark && benchmark.engines.length > 0 && benchmark.themes.length > 0) {
    return 'geo';
  }

  if ((axesCount ?? 0) > 5) return 'expert';

  return 'standard';
}
