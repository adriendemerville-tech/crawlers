import { useMemo } from 'react';
import { ScoredWideCanvas } from './ScoredWideCanvas';
import { GeoCanvas } from './GeoCanvas';
import { StandardCanvas } from './StandardCanvas';
import { ExpertCanvas } from './ExpertCanvas';
import { detectMatriceVariant } from './detectVariant';
import type { MatriceCanvasProps, MatriceVariant } from './types';

interface Props extends MatriceCanvasProps {
  /** Indices nécessaires à la détection auto si `variant` n'est pas fourni. */
  importedFormat?: 'scored-wide' | 'standard' | null;
  axesCount?: number;
}

/**
 * Dispatcher principal : choisit le bon *Canvas selon le variant
 * détecté (ou forcé). Chaque variant gère ses propres 3 sous-vues.
 */
export function MatriceCanvas(props: Props) {
  const { variant, benchmark, importedFormat, axesCount, defaultView } = props;

  const resolved: MatriceVariant = useMemo(
    () => variant ?? detectMatriceVariant({ benchmark, importedFormat, axesCount }),
    [variant, benchmark, importedFormat, axesCount],
  );

  switch (resolved) {
    case 'scored-wide':
      return benchmark ? (
        <ScoredWideCanvas benchmark={benchmark} defaultView={defaultView} />
      ) : null;
    case 'geo':
      return benchmark ? <GeoCanvas benchmark={benchmark} /> : null;
    case 'expert':
      return <ExpertCanvas benchmark={benchmark} />;
    case 'standard':
    default:
      return <StandardCanvas benchmark={benchmark} />;
  }
}
