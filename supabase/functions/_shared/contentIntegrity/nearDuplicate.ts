/**
 * contentIntegrity/nearDuplicate.ts
 *
 * Détection de contenus quasi-dupliqués : SimHash + LSH par bandes,
 * vérification Jaccard, clustering transitif (union-find).
 */

import type { NormalizedPage } from './normalize.ts';
import { shingles, simhash, hamming, bandKeys, jaccard, hashShingleSet } from './simhash.ts';

/** Seuil de base ; ajusté ensuite par la couche de qualification. */
export const DEFAULT_SIMILARITY_THRESHOLD = 0.85;
const MAX_HAMMING = 12;
const MAX_PAIRS = 20_000;
const MIN_TOKENS = 40;

export interface NearDuplicatePage {
  url: string;
  similarity: number; // similarité au pivot
  usefulWords: number;
  seoScore: number | null;
}

export interface NearDuplicateCluster {
  id: string;
  /** Page de référence (meilleur score SEO puis contenu le plus long). */
  pivot_url: string;
  pages: NearDuplicatePage[];
  /** Similarité moyenne intra-cluster (0-1). */
  avg_similarity: number;
  max_similarity: number;
  /** Part de gabarit moyenne des pages du cluster (0-1). */
  template_ratio: number;
}

export interface NearDuplicateInput {
  url: string;
  seoScore?: number | null;
}

export function detectNearDuplicates(
  normalized: NormalizedPage[],
  meta: Map<string, NearDuplicateInput>,
  threshold = DEFAULT_SIMILARITY_THRESHOLD,
): NearDuplicateCluster[] {
  const eligible = normalized.filter((p) => p.tokens.length >= MIN_TOKENS);
  if (eligible.length < 2) return [];

  const fingerprints: bigint[] = [];
  const shingleSets: Set<bigint>[] = [];
  const buckets = new Map<string, number[]>();

  eligible.forEach((page, index) => {
    const shs = shingles(page.tokens);
    const fp = simhash(shs);
    fingerprints.push(fp);
    shingleSets.push(hashShingleSet(shs));
    for (const key of bandKeys(fp)) {
      const arr = buckets.get(key);
      if (arr) arr.push(index);
      else buckets.set(key, [index]);
    }
  });

  // Paires candidates via LSH
  const candidates = new Set<string>();
  for (const indices of buckets.values()) {
    if (indices.length < 2 || indices.length > 200) continue; // bucket dégénéré (pages template)
    for (let i = 0; i < indices.length; i++) {
      for (let j = i + 1; j < indices.length; j++) {
        const a = Math.min(indices[i], indices[j]);
        const b = Math.max(indices[i], indices[j]);
        candidates.add(`${a}-${b}`);
        if (candidates.size >= MAX_PAIRS) break;
      }
      if (candidates.size >= MAX_PAIRS) break;
    }
    if (candidates.size >= MAX_PAIRS) break;
  }

  // Vérification exacte
  const parent = new Array(eligible.length).fill(0).map((_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  const pairScores = new Map<string, number>();
  for (const key of candidates) {
    const [a, b] = key.split('-').map(Number);
    if (hamming(fingerprints[a], fingerprints[b]) > MAX_HAMMING) continue;
    const sim = jaccard(shingleSets[a], shingleSets[b]);
    if (sim >= threshold) {
      pairScores.set(key, sim);
      union(a, b);
    }
  }
  if (pairScores.size === 0) return [];

  // Regroupement
  const groups = new Map<number, number[]>();
  for (let i = 0; i < eligible.length; i++) {
    const root = find(i);
    const arr = groups.get(root);
    if (arr) arr.push(i);
    else groups.set(root, [i]);
  }

  const clusters: NearDuplicateCluster[] = [];
  let clusterIndex = 0;
  for (const indices of groups.values()) {
    if (indices.length < 2) continue;

    // Pivot : meilleur score SEO, puis contenu le plus long
    const pivotIdx = indices.reduce((best, idx) => {
      const bs = meta.get(eligible[best].url)?.seoScore ?? -1;
      const cs = meta.get(eligible[idx].url)?.seoScore ?? -1;
      if (cs > bs) return idx;
      if (cs === bs && eligible[idx].usefulWords > eligible[best].usefulWords) return idx;
      return best;
    }, indices[0]);

    const sims: number[] = [];
    const pages: NearDuplicatePage[] = indices.map((idx) => {
      const sim = idx === pivotIdx
        ? 1
        : jaccard(shingleSets[idx], shingleSets[pivotIdx]);
      if (idx !== pivotIdx) sims.push(sim);
      return {
        url: eligible[idx].url,
        similarity: Math.round(sim * 100) / 100,
        usefulWords: eligible[idx].usefulWords,
        seoScore: meta.get(eligible[idx].url)?.seoScore ?? null,
      };
    });

    const avg = sims.length ? sims.reduce((a, b) => a + b, 0) / sims.length : 1;
    const templateRatio =
      indices.reduce((acc, idx) => acc + eligible[idx].templateRatio, 0) / indices.length;

    clusters.push({
      id: `nd_${++clusterIndex}`,
      pivot_url: eligible[pivotIdx].url,
      pages: pages.sort((a, b) => b.similarity - a.similarity),
      avg_similarity: Math.round(avg * 100) / 100,
      max_similarity: Math.round(Math.max(...sims, 1) * 100) / 100,
      template_ratio: Math.round(templateRatio * 100) / 100,
    });
  }

  return clusters.sort((a, b) => b.pages.length - a.pages.length);
}
