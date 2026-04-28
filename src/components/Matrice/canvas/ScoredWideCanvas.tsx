import { useState } from 'react';
import BenchmarkHeatmap from '../BenchmarkHeatmap';
import { MatriceViewToggle } from './shared/MatriceViewToggle';
import type { BenchmarkData, MatriceSubView } from './types';

interface Props {
  benchmark: BenchmarkData;
  defaultView?: MatriceSubView;
}

/**
 * Variant scored-wide :
 *  - 1 colonne par LLM (ChatGPT/Gemini/Perplexity/Claude/Mistral)
 *  - cellule = score + statut Cité/Rang
 *  - rendu calibré comme la capture de référence (lignes = prompts, colonnes = LLM).
 *
 * Aujourd'hui on délègue le rendu à `BenchmarkHeatmap` qui implémente déjà la
 * disposition lignes=thèmes × colonnes=engines + sous-vues. On encapsule ici
 * le titre et l'on prépare la place pour des règles d'affichage spécifiques
 * (ex: tri intelligent par score moyen LLM, coloration accentuée scored-wide).
 */
export function ScoredWideCanvas({ benchmark, defaultView = 'heatmap' }: Props) {
  // View mode est géré par BenchmarkHeatmap en interne ; on garde un state ici
  // pour le jour où on injectera un layout custom propre au scored-wide.
  const [view] = useState<MatriceSubView>(defaultView);

  return (
    <section className="space-y-3" data-matrice-variant="scored-wide" data-default-view={view}>
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Benchmark Citabilité — Scored-Wide
          </h2>
          <p className="text-[11px] text-muted-foreground">
            1 colonne par LLM · score + verdict (cité / rang) par prompt.
          </p>
        </div>
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
