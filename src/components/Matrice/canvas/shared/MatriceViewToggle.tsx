import { Button } from '@/components/ui/button';
import { Grid3X3, Layers, Box } from 'lucide-react';
import type { MatriceSubView } from '../types';

interface Props {
  value: MatriceSubView;
  onChange: (v: MatriceSubView) => void;
  /** Cacher certaines vues si non pertinentes pour le variant. */
  hide?: Partial<Record<MatriceSubView, boolean>>;
}

/**
 * Toggle commun aux 3 sous-vues — utilisé par tous les *Canvas variants.
 * Pas d'icône supplémentaire : juste les 3 boutons unifiés.
 */
export function MatriceViewToggle({ value, onChange, hide }: Props) {
  return (
    <div className="flex items-center gap-1">
      {!hide?.heatmap && (
        <Button
          variant={value === 'heatmap' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 px-2 text-xs gap-1"
          onClick={() => onChange('heatmap')}
        >
          <Grid3X3 className="h-3.5 w-3.5" /> Heatmap
        </Button>
      )}
      {!hide?.tabs && (
        <Button
          variant={value === 'tabs' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 px-2 text-xs gap-1"
          onClick={() => onChange('tabs')}
        >
          <Layers className="h-3.5 w-3.5" /> Par moteur
        </Button>
      )}
      {!hide?.cube && (
        <Button
          variant={value === 'cube' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 px-2 text-xs gap-1"
          onClick={() => onChange('cube')}
        >
          <Box className="h-3.5 w-3.5" /> Cube 3D
        </Button>
      )}
    </div>
  );
}
