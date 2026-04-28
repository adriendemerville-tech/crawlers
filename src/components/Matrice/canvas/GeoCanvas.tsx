import BenchmarkHeatmap from '../BenchmarkHeatmap';
import type { BenchmarkData } from './types';

interface Props {
  benchmark: BenchmarkData;
}

/**
 * Variant geo : matrice GEO benchmark theme×engine, agencement standard.
 * Réutilise BenchmarkHeatmap (heatmap + tabs + cube intégrés).
 */
export function GeoCanvas({ benchmark }: Props) {
  return (
    <section className="space-y-3" data-matrice-variant="geo">
      <header>
        <h2 className="text-sm font-semibold text-foreground">
          Matrice GEO — Thèmes × Moteurs IA
        </h2>
        <p className="text-[11px] text-muted-foreground">
          Citabilité agrégée par thème de prompt et par moteur LLM.
        </p>
      </header>

      <BenchmarkHeatmap
        results={benchmark.results}
        themes={benchmark.themes}
        engines={benchmark.engines}
        heatmap={benchmark.heatmap}
        globalScore={benchmark.globalScore}
        citationRate={benchmark.citationRate}
      />
    </section>
  );
}
