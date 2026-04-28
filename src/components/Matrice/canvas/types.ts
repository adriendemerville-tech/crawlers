/**
 * Shared types for the MatriceCanvas family.
 *
 * Architecture:
 *   MatriceCanvas (dispatcher)
 *     ├─ ScoredWideCanvas   ← format "scored-wide" (Score_Citabilite par moteur)
 *     ├─ StandardCanvas     ← matrice SEO classique (criteria × pages)
 *     ├─ GeoCanvas          ← matrice GEO benchmark (theme × engine)
 *     └─ ExpertCanvas       ← matrice expert/hybrid (multi-axes, libre)
 *
 * Chaque variant expose les 3 mêmes sous-vues : Heatmap / Par moteur / Cube 3D.
 */

export type MatriceVariant = 'scored-wide' | 'standard' | 'geo' | 'expert';

export type MatriceSubView = 'heatmap' | 'tabs' | 'cube';

export interface BenchmarkResultLite {
  id: string;
  prompt: string;
  theme: string;
  engine: string;
  axe?: string;
  crawlers_score: number;
  citation_found: boolean;
  citation_rank: number | null;
  citation_context: string;
  raw_data?: Record<string, any>;
}

export interface BenchmarkData {
  results: BenchmarkResultLite[];
  themes: string[];
  engines: string[];
  heatmap?: Record<string, Record<string, { score: number; cited: boolean; rank: number | null }>>;
  globalScore: number;
  citationRate: number;
}

export interface MatriceCanvasProps {
  /** Forcer un variant. Sinon auto-détecté à partir des données. */
  variant?: MatriceVariant;
  /** Données benchmark (theme × engine) — utilisées par scored-wide / geo. */
  benchmark?: BenchmarkData;
  /** Vue par défaut. Sinon résolue par le variant. */
  defaultView?: MatriceSubView;
}
