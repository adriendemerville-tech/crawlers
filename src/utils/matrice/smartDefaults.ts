/**
 * Smart defaults for matrice audit — adapts seuils, poids, and column labels
 * based on the detected MatriceType (SEO, GEO, Benchmark, Hybrid).
 */

import type { MatriceType } from './typeDetector';

export interface MatriceDefaults {
  poids: number;
  axe: string;
  seuil_bon: number;
  seuil_moyen: number;
  seuil_mauvais: number;
  llm_name: string;
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

/**
 * Returns context-aware defaults based on matrice type.
 * - SEO: classic 0-100 scoring (70/40/0)
 * - GEO: citability scoring (60/30/0) 
 * - Benchmark: ranking-based (Top 3 = Bon, Top 10 = Moyen, Non cité = Mauvais)
 * - Hybrid: balanced (65/35/0)
 */
export function getSmartDefaults(type: MatriceType): MatriceDefaults {
  switch (type) {
    case 'benchmark':
      return {
        poids: 1,
        axe: 'Benchmark',
        seuil_bon: 3,    // Top 3 ranking
        seuil_moyen: 10,  // Top 10
        seuil_mauvais: 0, // Not cited
        llm_name: '',     // Engine comes from the file
        labels: {
          seuil_bon: 'Top (rang ≤)',
          seuil_moyen: 'Acceptable (rang ≤)',
          seuil_mauvais: 'Absent',
          poids: 'Poids',
          axe: 'Moteur',
        },
        helpText: 'Mode Benchmark : les seuils représentent des positions de classement (rang). Top = rang ≤ 3, Acceptable = rang ≤ 10.',
      };

    case 'geo':
      return {
        poids: 1,
        axe: 'GEO',
        seuil_bon: 60,
        seuil_moyen: 30,
        seuil_mauvais: 0,
        llm_name: 'google/gemini-2.5-flash',
        labels: {
          seuil_bon: 'Bon',
          seuil_moyen: 'Moyen',
          seuil_mauvais: 'Mauvais',
          poids: 'Poids',
          axe: 'Catégorie',
        },
        helpText: 'Mode GEO : scoring de citabilité IA (0-100). Bon ≥ 60, Moyen ≥ 30.',
      };

    case 'hybrid':
      return {
        poids: 1,
        axe: 'Hybride',
        seuil_bon: 65,
        seuil_moyen: 35,
        seuil_mauvais: 0,
        llm_name: 'google/gemini-2.5-flash',
        labels: {
          seuil_bon: 'Bon',
          seuil_moyen: 'Moyen',
          seuil_mauvais: 'Mauvais',
          poids: 'Poids',
          axe: 'Catégorie',
        },
        helpText: 'Mode Hybride SEO+GEO : scoring combiné (0-100). Bon ≥ 65, Moyen ≥ 35.',
      };

    case 'seo':
    default:
      return {
        poids: 1,
        axe: 'SEO',
        seuil_bon: 70,
        seuil_moyen: 40,
        seuil_mauvais: 0,
        llm_name: 'google/gemini-2.5-flash',
        labels: {
          seuil_bon: 'Bon',
          seuil_moyen: 'Moyen',
          seuil_mauvais: 'Mauvais',
          poids: 'Poids',
          axe: 'Catégorie',
        },
        helpText: 'Mode SEO : scoring technique (0-100). Bon ≥ 70, Moyen ≥ 40.',
      };
  }
}
