/**
 * MatriceCube3D — Interactive 3D voxel cube (Sprint 3 + 5).
 * Built on @react-three/fiber + drei (OrbitControls, Html tooltips).
 * Axes: X = famille, Y = type d'évaluation, Z = poids.
 *
 * Sprint 5 additions:
 * - `selectedFamilyId`: dims voxels not matching the externally selected family
 * - `onSelect(voxel)`: fired on click, also enables external drill-down panels
 * - PNG snapshot button via the canvas WebGL context
 *
 * Charte stricte: violet → gold heatmap, bordures, bg transparent, no IA-blue, no emoji.
 */

import { Suspense, useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Html, GizmoHelper, GizmoViewcube, Edges } from '@react-three/drei';
import { Box, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { bucketToHsl, scoreToBucket } from '@/utils/matrice/heatmapScale';
import { buildCubeLayout, type Voxel } from '@/utils/matrice/cubeLayout';
import type { MatrixResult } from '@/utils/matrice/matrixOrchestrator';

export interface MatriceCube3DProps {
  results: MatrixResult[];
  className?: string;
  /** Optional click handler when the user selects a voxel. */
  onVoxelClick?: (voxel: Voxel | null) => void;
  /** External family selection — voxels not in this family are dimmed. */
  selectedFamilyId?: string | null;
  /** Externally controlled voxel selection (Sprint 5 cross-filter). */
  selectedVoxelKey?: string | null;
}

// Spacing between voxel centers
const STEP = 1.4;
const SIZE = 1;

const voxelKey = (v: Voxel) => `${v.x}-${v.y}-${v.z}`;

interface VoxelMeshProps {
  voxel: Voxel;
  origin: { x: number; y: number; z: number };
  hovered: boolean;
  selected: boolean;
  dimmed: boolean;
  onHover: (v: Voxel | null) => void;
  onSelect: (v: Voxel) => void;
}

function VoxelMesh({ voxel, origin, hovered, selected, dimmed, onHover, onSelect }: VoxelMeshProps) {
  const color = useMemo(() => bucketToHsl(scoreToBucket(voxel.score)), [voxel.score]);
  const px = (voxel.x - origin.x) * STEP;
  const py = (voxel.y - origin.y) * STEP;
  const pz = (voxel.z - origin.z) * STEP;
  const scale = hovered || selected ? 1.15 : 1;
  const baseOpacity = voxel.score == null ? 0.35 : 0.92;
  const opacity = dimmed ? Math.min(baseOpacity, 0.18) : baseOpacity;

  return (
    <mesh
      position={[px, py, pz]}
      scale={scale}
      onPointerOver={(e) => { e.stopPropagation(); onHover(voxel); document.body.style.cursor = 'pointer'; }}
      onPointerOut={(e) => { e.stopPropagation(); onHover(null); document.body.style.cursor = 'default'; }}
      onClick={(e) => { e.stopPropagation(); onSelect(voxel); }}
    >
      <boxGeometry args={[SIZE, SIZE, SIZE]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={opacity}
        emissive={selected ? color : '#000000'}
        emissiveIntensity={selected ? 0.4 : 0}
        roughness={0.45}
        metalness={0.15}
      />
      <Edges threshold={15} color="#1a0033" />
    </mesh>
  );
}

function AxisLabels({
  axes,
  origin,
  extents,
}: {
  axes: ReturnType<typeof buildCubeLayout>['axes'];
  origin: { x: number; y: number; z: number };
  extents: { x: number; y: number; z: number };
}) {
  return (
    <>
      {axes.x.map((c, i) => (
        <Html
          key={`x-${c.id}`}
          position={[(i - origin.x) * STEP, -origin.y * STEP - STEP, -origin.z * STEP - STEP * 0.5]}
          center
          distanceFactor={10}
          style={{ pointerEvents: 'none' }}
        >
          <span className="text-[10px] font-mono text-foreground/70 whitespace-nowrap">
            {c.label}
          </span>
        </Html>
      ))}
      {axes.y.map((c, i) => (
        <Html
          key={`y-${c.id}`}
          position={[-origin.x * STEP - STEP, (i - origin.y) * STEP, -origin.z * STEP - STEP * 0.5]}
          center
          distanceFactor={10}
          style={{ pointerEvents: 'none' }}
        >
          <span className="text-[10px] font-mono text-foreground/70 whitespace-nowrap">
            {c.label}
          </span>
        </Html>
      ))}
      {axes.z.map((c, i) => (
        <Html
          key={`z-${c.id}`}
          position={[-origin.x * STEP - STEP * 0.5, -origin.y * STEP - STEP, (i - origin.z) * STEP]}
          center
          distanceFactor={10}
          style={{ pointerEvents: 'none' }}
        >
          <span className="text-[10px] font-mono text-foreground/70 whitespace-nowrap">
            {c.label}
          </span>
        </Html>
      ))}
      {/* Axis caption anchors */}
      <Html position={[extents.x * STEP, -origin.y * STEP - STEP * 1.6, -origin.z * STEP]} center distanceFactor={10}>
        <span className="text-[11px] font-semibold text-brand-violet">X · Famille</span>
      </Html>
      <Html position={[-origin.x * STEP - STEP * 1.6, extents.y * STEP, -origin.z * STEP]} center distanceFactor={10}>
        <span className="text-[11px] font-semibold text-brand-violet">Y · Type</span>
      </Html>
      <Html position={[-origin.x * STEP - STEP * 0.5, -origin.y * STEP - STEP, extents.z * STEP]} center distanceFactor={10}>
        <span className="text-[11px] font-semibold text-brand-violet">Z · Poids</span>
      </Html>
    </>
  );
}

/**
 * Captures the canvas image data via the active WebGL context.
 * Stored in a ref so the parent component can trigger a snapshot on demand.
 */
function SnapshotBridge({ snapshotRef }: { snapshotRef: React.MutableRefObject<(() => string | null) | null> }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    snapshotRef.current = () => {
      try {
        // Force a fresh render (drei OrbitControls may not redraw between frames)
        gl.render(scene, camera);
        return gl.domElement.toDataURL('image/png');
      } catch (err) {
        console.error('[MatriceCube3D] snapshot failed', err);
        return null;
      }
    };
    return () => { snapshotRef.current = null; };
  }, [gl, scene, camera, snapshotRef]);
  return null;
}

export function MatriceCube3D({
  results,
  className,
  onVoxelClick,
  selectedFamilyId,
  selectedVoxelKey,
}: MatriceCube3DProps) {
  const layout = useMemo(() => buildCubeLayout(results), [results]);
  const [hovered, setHovered] = useState<Voxel | null>(null);
  const [internalSelected, setInternalSelected] = useState<Voxel | null>(null);
  const snapshotRef = useRef<(() => string | null) | null>(null);

  // Sync external voxel selection
  useEffect(() => {
    if (!selectedVoxelKey) {
      setInternalSelected(null);
      return;
    }
    const match = layout.voxels.find(v => voxelKey(v) === selectedVoxelKey);
    if (match) setInternalSelected(match);
  }, [selectedVoxelKey, layout]);

  const origin = useMemo(() => ({
    x: Math.max(0, (layout.axes.x.length - 1) / 2),
    y: Math.max(0, (layout.axes.y.length - 1) / 2),
    z: Math.max(0, (layout.axes.z.length - 1) / 2),
  }), [layout]);

  const extents = useMemo(() => ({
    x: layout.axes.x.length - 1 - origin.x,
    y: layout.axes.y.length - 1 - origin.y,
    z: layout.axes.z.length - 1 - origin.z,
  }), [layout, origin]);

  const handleSelect = useCallback((v: Voxel) => {
    const sameAsBefore = internalSelected
      && voxelKey(internalSelected) === voxelKey(v);
    const next = sameAsBefore ? null : v;
    setInternalSelected(next);
    onVoxelClick?.(next);
  }, [internalSelected, onVoxelClick]);

  const handleSnapshot = useCallback(() => {
    if (!snapshotRef.current) return;
    const dataUrl = snapshotRef.current();
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `matrice-cube-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  }, []);

  const cameraDistance = Math.max(8, Math.max(layout.axes.x.length, layout.axes.y.length, layout.axes.z.length) * 2.2);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Vue Cube 3D</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-mono">
            {layout.voxels.length} voxels · {results.length} critères
          </span>
          {results.length > 0 && (
            <button
              type="button"
              onClick={handleSnapshot}
              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs border border-brand-violet text-foreground rounded-md hover:border-brand-gold transition-colors bg-transparent"
              aria-label="Exporter le cube en PNG"
              title="Exporter le cube en PNG"
            >
              <Camera className="h-3.5 w-3.5" />
              PNG
            </button>
          )}
        </div>
      </div>

      <div className={cn(
        'relative min-h-[420px] h-[420px] border-2 border-brand-violet rounded-md bg-transparent overflow-hidden',
      )}>
        {results.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Box className="h-10 w-10 text-brand-violet mx-auto mb-3" aria-hidden />
              <p className="text-sm text-muted-foreground">
                Le cube 3D sera peuplé après le premier audit
              </p>
            </div>
          </div>
        ) : (
          <Canvas
            camera={{ position: [cameraDistance, cameraDistance * 0.8, cameraDistance], fov: 38 }}
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
            style={{ background: 'transparent' }}
          >
            <ambientLight intensity={0.65} />
            <directionalLight position={[5, 8, 5]} intensity={0.7} />
            <directionalLight position={[-5, -3, -5]} intensity={0.25} />

            <Suspense fallback={null}>
              {layout.voxels.map((v) => {
                const isHovered = !!hovered && hovered.x === v.x && hovered.y === v.y && hovered.z === v.z;
                const isSelected = !!internalSelected && voxelKey(internalSelected) === voxelKey(v);
                const dimmed = !!selectedFamilyId && v.familyId !== selectedFamilyId;
                return (
                  <VoxelMesh
                    key={voxelKey(v)}
                    voxel={v}
                    origin={origin}
                    hovered={isHovered}
                    selected={isSelected}
                    dimmed={dimmed}
                    onHover={setHovered}
                    onSelect={handleSelect}
                  />
                );
              })}

              <AxisLabels axes={layout.axes} origin={origin} extents={extents} />
            </Suspense>

            <OrbitControls
              enableDamping
              dampingFactor={0.08}
              rotateSpeed={0.7}
              zoomSpeed={0.8}
              minDistance={4}
              maxDistance={cameraDistance * 2.5}
            />

            <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
              <GizmoViewcube
                color="hsl(var(--brand-violet))"
                opacity={0.85}
                strokeColor="hsl(var(--brand-gold))"
                textColor="white"
              />
            </GizmoHelper>

            <SnapshotBridge snapshotRef={snapshotRef} />
          </Canvas>
        )}

        {/* Floating tooltip — overlay HTML, not part of R3F */}
        {(hovered || internalSelected) && results.length > 0 && (() => {
          const v = hovered ?? internalSelected!;
          return (
            <div className="absolute top-3 left-3 max-w-[260px] border-2 border-brand-violet bg-background/95 backdrop-blur-sm rounded-md p-3 text-xs space-y-1 pointer-events-none">
              <div className="font-semibold text-foreground">{v.familyLabel}</div>
              <div className="text-muted-foreground font-mono">
                {v.typeLabel} · {v.weightLabel}
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-foreground/10">
                <span className="text-muted-foreground">Score moyen</span>
                <span className="font-mono font-semibold" style={{ color: bucketToHsl(scoreToBucket(v.score)) }}>
                  {v.score == null ? '—' : `${v.score}/100`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Critères agrégés</span>
                <span className="font-mono">{v.count}</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Heatmap legend */}
      <div className="flex items-center gap-2 text-xs flex-wrap">
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
        <span className="ml-auto text-muted-foreground">
          Glisser · Molette · Clic
        </span>
      </div>
    </div>
  );
}

export default MatriceCube3D;
