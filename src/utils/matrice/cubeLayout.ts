/**
 * cubeLayout — Maps MatrixResult[] into a 3D voxel grid.
 * Axes:
 *   X · Famille  (criterionCategory or sourceFunction)
 *   Y · Type     (matchType : exact | partial | custom_only | …)
 *   Z · Poids    (criterionWeight bucketized 0..N)
 * Each voxel carries the mean score of underlying results + raw items for tooltip.
 */

import type { MatrixResult } from './matrixOrchestrator';

export interface Voxel {
  x: number;
  y: number;
  z: number;
  score: number | null;       // 0..100
  count: number;
  familyId: string;
  familyLabel: string;
  typeId: string;
  typeLabel: string;
  weightLabel: string;
  results: MatrixResult[];
}

export interface CubeLayout {
  voxels: Voxel[];
  axes: {
    x: { id: string; label: string }[];
    y: { id: string; label: string }[];
    z: { id: string; label: string }[];
  };
}

const TYPE_LABELS: Record<string, string> = {
  exact: 'Score direct',
  partial: 'Prompt custom',
  custom_only: 'LLM seul',
};

const FAMILY_LABELS: Record<string, string> = {
  'check-meta-tags': 'Balises & Meta',
  'check-structured-data': 'Données structurées',
  'check-robots-indexation': 'Robots & Indexation',
  'check-images': 'Images',
  'check-pagespeed': 'Performance',
  'check-backlinks': 'Backlinks',
  'check-crawlers': 'Bots & Crawlers',
  'check-geo': 'GEO / IA',
  'check-direct-answer': 'Réponse directe',
  'check-eeat': 'E-E-A-T',
  'check-content-quality': 'Qualité contenu',
  'check-llm': 'Visibilité LLM',
  'expert-audit': 'Audit expert',
};

function familyOf(r: MatrixResult): { id: string; label: string } {
  const cat = (r as any).criterionCategory as string | undefined;
  if (cat && cat !== 'general') return { id: `cat:${cat}`, label: cat };
  return { id: r.sourceFunction, label: FAMILY_LABELS[r.sourceFunction] || r.sourceFunction };
}

function weightBucket(w: number | null | undefined): { id: string; label: string } {
  const v = typeof w === 'number' ? w : 1;
  if (v >= 3) return { id: 'w:high', label: 'Poids fort' };
  if (v >= 2) return { id: 'w:mid', label: 'Poids moyen' };
  return { id: 'w:low', label: 'Poids faible' };
}

function mean(scores: number[]): number | null {
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function buildCubeLayout(results: MatrixResult[]): CubeLayout {
  // Discover axes
  const xMap = new Map<string, string>();
  const yMap = new Map<string, string>();
  const zMap = new Map<string, string>();

  for (const r of results) {
    const fam = familyOf(r);
    xMap.set(fam.id, fam.label);
    yMap.set(r.matchType, TYPE_LABELS[r.matchType] || r.matchType);
    const w = weightBucket((r as any).criterionWeight);
    zMap.set(w.id, w.label);
  }

  const x = Array.from(xMap, ([id, label]) => ({ id, label })).sort((a, b) =>
    a.label.localeCompare(b.label, 'fr'),
  );
  const y = Array.from(yMap, ([id, label]) => ({ id, label }));
  const z = Array.from(zMap, ([id, label]) => ({ id, label }));
  // Stable order for Z: low → mid → high
  const zOrder = ['w:low', 'w:mid', 'w:high'];
  z.sort((a, b) => zOrder.indexOf(a.id) - zOrder.indexOf(b.id));

  // Bucket by (x,y,z)
  const bucket = new Map<string, MatrixResult[]>();
  for (const r of results) {
    const fam = familyOf(r);
    const w = weightBucket((r as any).criterionWeight);
    const key = `${fam.id}|${r.matchType}|${w.id}`;
    if (!bucket.has(key)) bucket.set(key, []);
    bucket.get(key)!.push(r);
  }

  const voxels: Voxel[] = [];
  for (const [key, items] of bucket.entries()) {
    const [fxId, tyId, wzId] = key.split('|');
    const xi = x.findIndex(c => c.id === fxId);
    const yi = y.findIndex(c => c.id === tyId);
    const zi = z.findIndex(c => c.id === wzId);
    if (xi < 0 || yi < 0 || zi < 0) continue;

    const scores = items.map(s => s.parsedScore).filter((s): s is number => typeof s === 'number');
    voxels.push({
      x: xi,
      y: yi,
      z: zi,
      score: mean(scores),
      count: items.length,
      familyId: fxId,
      familyLabel: x[xi].label,
      typeId: tyId,
      typeLabel: y[yi].label,
      weightLabel: z[zi].label,
      results: items,
    });
  }

  return { voxels, axes: { x, y, z } };
}
