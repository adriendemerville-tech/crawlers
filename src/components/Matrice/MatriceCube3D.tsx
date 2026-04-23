/**
 * MatriceCube3D — Immersive 3D voxel cube placeholder (Sprint 3 wiring with R3F).
 * Currently a static scaffold with axes legend, no react-three-fiber import yet.
 * Charte: bordered, no bg fill, violet → gold heatmap (no IA-blue).
 */

import { cn } from '@/lib/utils';
import { Box } from 'lucide-react';
import { bucketToHsl } from '@/utils/matrice/heatmapScale';
import type { MatrixResult } from '@/utils/matrice/matrixOrchestrator';

export interface MatriceCube3DProps {
  results: MatrixResult[];
  className?: string;
}

export function MatriceCube3D({ results, className }: MatriceCube3DProps) {
  const sample = results.slice(0, 25);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Vue Cube 3D</h3>
        <span className="text-xs text-muted-foreground font-mono">
          {results.length} critères
        </span>
      </div>

      <div className={cn(
        'relative flex items-center justify-center',
        'min-h-[320px] p-6 border-2 border-brand-violet rounded-md bg-transparent overflow-hidden',
      )}>
        {results.length === 0 ? (
          <div className="text-center">
            <Box className="h-10 w-10 text-brand-violet mx-auto mb-3" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Le cube 3D sera peuplé après le premier audit
            </p>
          </div>
        ) : (
          <>
            {/* Static voxel preview — Sprint 3 will replace with @react-three/fiber */}
            <div className="grid grid-cols-5 gap-1.5" aria-label="Aperçu voxels (statique)">
              {sample.map((r, i) => {
                const score = r.parsedScore ?? 0;
                const bucket = score >= 80 ? 4 : score >= 60 ? 3 : score >= 40 ? 2 : score >= 20 ? 1 : 0;
                return (
                  <div
                    key={r.criterionId + i}
                    className="w-10 h-10 rounded-sm border border-foreground/10 transition-transform hover:scale-110"
                    style={{ backgroundColor: bucketToHsl(bucket as 0|1|2|3|4) }}
                    title={`${r.criterionTitle} — ${score}/100`}
                  />
                );
              })}
            </div>

            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>X · Famille</span>
              <span>Y · Type</span>
              <span>Z · Poids</span>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Échelle :</span>
        {[0, 1, 2, 3, 4].map(b => (
          <div key={b} className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded-sm border border-foreground/10"
              style={{ backgroundColor: bucketToHsl(b as 0|1|2|3|4) }}
              aria-hidden
            />
            <span className="font-mono">{b * 20}</span>
          </div>
        ))}
        <span className="font-mono">100</span>
      </div>

      <p className="text-xs text-muted-foreground">
        Aperçu statique — Sprint 3 activera la rotation libre, le zoom et les info-bulles via @react-three/fiber.
      </p>
    </div>
  );
}

export default MatriceCube3D;
