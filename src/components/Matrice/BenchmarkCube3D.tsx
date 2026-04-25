/**
 * BenchmarkCube3D — Vue 3D pour le mode Benchmark Citabilité.
 *
 * Axes :
 *   X · Thème        (les questions / sujets benchmarkés)
 *   Y · Moteur       (ChatGPT, Gemini, Perplexity, Claude, Mistral…)
 *   Z · Famille      (axe : Comparatif, Local, Transactionnel, Informationnel — 1 onglet XLSX = 1 famille)
 *
 * Score voxel = crawlers_score (0–100) → palette violet → gold (charte).
 * Voxels non cités = opacité réduite. Voxels cités au rang #1 = bord doré.
 *
 * Charte stricte : violet, gold, noir/blanc. Pas d'emoji. Pas de bleu IA.
 */

import { Suspense, useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Html, GizmoHelper, GizmoViewcube, Edges } from '@react-three/drei';
import { Box, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { bucketToHsl, scoreToBucket } from '@/utils/matrice/heatmapScale';

interface BenchmarkResult {
  id: string;
  prompt: string;
  theme: string;
  engine: string;
  axe?: string;
  crawlers_score: number;
  citation_found: boolean;
  citation_rank: number | null;
  citation_context?: string;
  raw_data?: Record<string, any>;
}

export interface BenchmarkCube3DProps {
  results: BenchmarkResult[];
  themes: string[];
  engines: string[];
  className?: string;
}

interface BenchVoxel {
  x: number; y: number; z: number;
  score: number | null;
  cited: boolean;
  rank: number | null;
  count: number;
  themeLabel: string;
  engineLabel: string;
  familyLabel: string;
  results: BenchmarkResult[];
}

interface BenchLayout {
  voxels: BenchVoxel[];
  axes: {
    x: { id: string; label: string }[]; // themes
    y: { id: string; label: string }[]; // engines
    z: { id: string; label: string }[]; // families (axe)
  };
}

const STEP = 1.4;
const SIZE = 1;

function buildBenchLayout(results: BenchmarkResult[], themes: string[], engines: string[]): BenchLayout {
  // Z axis = unique values of `axe` (or "Général" fallback)
  const zSet = new Set<string>();
  for (const r of results) zSet.add((r.axe || 'Général').trim() || 'Général');
  const z = Array.from(zSet).sort((a, b) => a.localeCompare(b, 'fr'))
    .map((label) => ({ id: label, label }));

  const x = themes.map((t) => ({ id: t, label: t }));
  const y = engines.map((e) => ({ id: e, label: e }));

  // Bucket by (theme, engine, family)
  const bucket = new Map<string, BenchmarkResult[]>();
  for (const r of results) {
    const fam = (r.axe || 'Général').trim() || 'Général';
    const key = `${r.theme}||${r.engine}||${fam}`;
    if (!bucket.has(key)) bucket.set(key, []);
    bucket.get(key)!.push(r);
  }

  const voxels: BenchVoxel[] = [];
  for (const [key, items] of bucket.entries()) {
    const [theme, engine, fam] = key.split('||');
    const xi = x.findIndex((c) => c.id === theme);
    const yi = y.findIndex((c) => c.id === engine);
    const zi = z.findIndex((c) => c.id === fam);
    if (xi < 0 || yi < 0 || zi < 0) continue;

    const scores = items.map((s) => s.crawlers_score).filter((s) => typeof s === 'number' && s >= 0);
    const score = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const cited = items.some((s) => s.citation_found);
    const ranks = items.map((s) => s.citation_rank).filter((r): r is number => typeof r === 'number');
    const bestRank = ranks.length ? Math.min(...ranks) : null;

    voxels.push({
      x: xi, y: yi, z: zi,
      score, cited, rank: bestRank,
      count: items.length,
      themeLabel: theme, engineLabel: engine, familyLabel: fam,
      results: items,
    });
  }

  return { voxels, axes: { x, y, z } };
}

interface VoxelMeshProps {
  voxel: BenchVoxel;
  origin: { x: number; y: number; z: number };
  hovered: boolean;
  selected: boolean;
  onHover: (v: BenchVoxel | null) => void;
  onSelect: (v: BenchVoxel) => void;
}

function VoxelMesh({ voxel, origin, hovered, selected, onHover, onSelect }: VoxelMeshProps) {
  const color = useMemo(() => bucketToHsl(scoreToBucket(voxel.score)), [voxel.score]);
  const px = (voxel.x - origin.x) * STEP;
  const py = (voxel.y - origin.y) * STEP;
  const pz = (voxel.z - origin.z) * STEP;
  const scale = hovered || selected ? 1.18 : 1;
  const baseOpacity = voxel.score == null ? 0.35 : voxel.cited ? 0.95 : 0.55;
  const isPodium = voxel.cited && voxel.rank != null && voxel.rank <= 3;

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
        opacity={baseOpacity}
        emissive={selected ? color : '#000000'}
        emissiveIntensity={selected ? 0.4 : 0}
        roughness={0.45}
        metalness={0.15}
      />
      <Edges threshold={15} color={isPodium ? 'hsl(45 93% 50%)' : '#1a0033'} />
    </mesh>
  );
}

function AxisLabels({
  axes, origin, extents,
}: {
  axes: BenchLayout['axes'];
  origin: { x: number; y: number; z: number };
  extents: { x: number; y: number; z: number };
}) {
  const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  return (
    <>
      {axes.x.map((c, i) => (
        <Html key={`x-${c.id}`} position={[(i - origin.x) * STEP, -origin.y * STEP - STEP, -origin.z * STEP - STEP * 0.5]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <span className="text-[10px] font-mono text-foreground/70 whitespace-nowrap">{truncate(c.label, 22)}</span>
        </Html>
      ))}
      {axes.y.map((c, i) => (
        <Html key={`y-${c.id}`} position={[-origin.x * STEP - STEP, (i - origin.y) * STEP, -origin.z * STEP - STEP * 0.5]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <span className="text-[10px] font-mono text-foreground/70 whitespace-nowrap">{truncate(c.label, 14)}</span>
        </Html>
      ))}
      {axes.z.map((c, i) => (
        <Html key={`z-${c.id}`} position={[-origin.x * STEP - STEP * 0.5, -origin.y * STEP - STEP, (i - origin.z) * STEP]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <span className="text-[10px] font-mono text-foreground/70 whitespace-nowrap">{truncate(c.label, 18)}</span>
        </Html>
      ))}
      <Html position={[extents.x * STEP, -origin.y * STEP - STEP * 1.6, -origin.z * STEP]} center distanceFactor={10}>
        <span className="text-[11px] font-semibold text-brand-violet">X · Thème</span>
      </Html>
      <Html position={[-origin.x * STEP - STEP * 1.6, extents.y * STEP, -origin.z * STEP]} center distanceFactor={10}>
        <span className="text-[11px] font-semibold text-brand-violet">Y · Moteur</span>
      </Html>
      <Html position={[-origin.x * STEP - STEP * 0.5, -origin.y * STEP - STEP, extents.z * STEP]} center distanceFactor={10}>
        <span className="text-[11px] font-semibold text-brand-violet">Z · Famille</span>
      </Html>
    </>
  );
}

function SnapshotBridge({ snapshotRef }: { snapshotRef: React.MutableRefObject<(() => string | null) | null> }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    snapshotRef.current = () => {
      try {
        gl.render(scene, camera);
        return gl.domElement.toDataURL('image/png');
      } catch (err) {
        console.error('[BenchmarkCube3D] snapshot failed', err);
        return null;
      }
    };
    return () => { snapshotRef.current = null; };
  }, [gl, scene, camera, snapshotRef]);
  return null;
}

const voxelKey = (v: BenchVoxel) => `${v.x}-${v.y}-${v.z}`;

export function BenchmarkCube3D({ results, themes, engines, className }: BenchmarkCube3DProps) {
  const layout = useMemo(() => buildBenchLayout(results, themes, engines), [results, themes, engines]);
  const [hovered, setHovered] = useState<BenchVoxel | null>(null);
  const [selected, setSelected] = useState<BenchVoxel | null>(null);
  const snapshotRef = useRef<(() => string | null) | null>(null);

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

  const handleSelect = useCallback((v: BenchVoxel) => {
    setSelected((prev) => (prev && voxelKey(prev) === voxelKey(v) ? null : v));
  }, []);

  const handleSnapshot = useCallback(() => {
    if (!snapshotRef.current) return;
    const dataUrl = snapshotRef.current();
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `benchmark-cube-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  }, []);

  const cameraDistance = Math.max(
    8,
    Math.max(layout.axes.x.length, layout.axes.y.length, layout.axes.z.length) * 2.2,
  );

  const tooltip = hovered ?? selected;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Cube 3D — Thème × Moteur × Famille</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-mono">
            {layout.voxels.length} voxels · {results.length} prompts
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
        'relative min-h-[480px] h-[480px] border-2 border-brand-violet rounded-md bg-transparent overflow-hidden',
      )}>
        {results.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Box className="h-10 w-10 text-brand-violet mx-auto mb-3" aria-hidden />
              <p className="text-sm text-muted-foreground">
                Le cube benchmark sera peuplé après le premier audit
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
                const isHovered = !!hovered && voxelKey(hovered) === voxelKey(v);
                const isSelected = !!selected && voxelKey(selected) === voxelKey(v);
                return (
                  <VoxelMesh
                    key={voxelKey(v)}
                    voxel={v}
                    origin={origin}
                    hovered={isHovered}
                    selected={isSelected}
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

        {tooltip && results.length > 0 && (
          <div className="absolute top-3 left-3 max-w-[280px] border-2 border-brand-violet bg-background/95 backdrop-blur-sm rounded-md p-3 text-xs space-y-1 pointer-events-none">
            <div className="font-semibold text-foreground truncate" title={tooltip.themeLabel}>
              {tooltip.themeLabel}
            </div>
            <div className="text-muted-foreground font-mono">
              {tooltip.engineLabel} · {tooltip.familyLabel}
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-foreground/10">
              <span className="text-muted-foreground">Score</span>
              <span className="font-mono font-semibold" style={{ color: bucketToHsl(scoreToBucket(tooltip.score)) }}>
                {tooltip.score == null ? '—' : `${tooltip.score}/100`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cité</span>
              <span className="font-mono">
                {tooltip.cited ? (tooltip.rank != null ? `Oui · rang ${tooltip.rank}` : 'Oui') : 'Non'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Prompts agrégés</span>
              <span className="font-mono">{tooltip.count}</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs flex-wrap">
        <span className="text-muted-foreground">Échelle :</span>
        {[0, 1, 2, 3, 4].map((b) => (
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
        <span className="ml-3 inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm border-2" style={{ borderColor: 'hsl(45 93% 50%)' }} />
          <span className="text-muted-foreground">Cité top 3</span>
        </span>
        <span className="ml-auto text-muted-foreground">Glisser · Molette · Clic</span>
      </div>
    </div>
  );
}

export default BenchmarkCube3D;
