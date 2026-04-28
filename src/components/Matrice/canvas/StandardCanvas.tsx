import type { BenchmarkData } from './types';

interface Props {
  benchmark?: BenchmarkData;
}

/**
 * Variant standard : matrice SEO classique (criteria × pages, sans engines IA).
 * Stub initial — sera enrichi quand on branchera le rendu SEO sur les 3 vues.
 */
export function StandardCanvas({ benchmark }: Props) {
  return (
    <section className="space-y-3" data-matrice-variant="standard">
      <header>
        <h2 className="text-sm font-semibold text-foreground">
          Matrice SEO standard
        </h2>
        <p className="text-[11px] text-muted-foreground">
          Critères × pages — vues Heatmap / Détail / Cube 3D à brancher.
        </p>
      </header>
      {!benchmark && (
        <div className="border rounded-lg p-6 text-xs text-muted-foreground bg-muted/20">
          Aucun rendu spécifique pour ce variant pour l'instant. La table principale
          de la page reste la source de vérité.
        </div>
      )}
    </section>
  );
}
