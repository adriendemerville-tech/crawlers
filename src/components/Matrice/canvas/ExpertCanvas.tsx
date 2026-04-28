import BenchmarkHeatmap from '../BenchmarkHeatmap';
import type { BenchmarkData } from './types';

interface Props {
  benchmark?: BenchmarkData;
}

/**
 * Variant expert / hybrid : matrice multi-axes (SEO + GEO mélangés, axes libres).
 * Si on a des données benchmark, on les rend ; sinon stub.
 */
export function ExpertCanvas({ benchmark }: Props) {
  return (
    <section className="space-y-3" data-matrice-variant="expert">
      <header>
        <h2 className="text-sm font-semibold text-foreground">
          Matrice Expert — Vue hybride multi-axes
        </h2>
        <p className="text-[11px] text-muted-foreground">
          Mix SEO + GEO, axes libres. Rendu spécifique en cours d'implémentation.
        </p>
      </header>

      {benchmark ? (
        <BenchmarkHeatmap
          results={benchmark.results}
          themes={benchmark.themes}
          engines={benchmark.engines}
          heatmap={benchmark.heatmap}
          globalScore={benchmark.globalScore}
          citationRate={benchmark.citationRate}
        />
      ) : (
        <div className="border rounded-lg p-6 text-xs text-muted-foreground bg-muted/20">
          Pas de données benchmark à rendre pour ce variant expert.
        </div>
      )}
    </section>
  );
}
