/**
 * contentIntegrity/simhash.ts
 *
 * SimHash 64 bits sur shingles de 5 mots + LSH par bandes.
 * TypeScript pur, aucune dépendance (contrainte TS/Deno du projet).
 */

export const SHINGLE_SIZE = 5;
const BAND_COUNT = 4;
const BAND_BITS = 16; // 4 bandes × 16 bits = 64

/** FNV-1a 64 bits (BigInt) — stable et rapide sur des shingles courts. */
export function fnv1a64(str: string): bigint {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < str.length; i++) {
    hash = (hash ^ BigInt(str.charCodeAt(i))) & mask;
    hash = (hash * prime) & mask;
  }
  return hash;
}

/** Shingles de n mots (dé-dupliqués). */
export function shingles(tokens: string[], size = SHINGLE_SIZE): string[] {
  if (tokens.length === 0) return [];
  if (tokens.length <= size) return [tokens.join(' ')];
  const out: string[] = [];
  for (let i = 0; i + size <= tokens.length; i++) {
    out.push(tokens.slice(i, i + size).join(' '));
  }
  return out;
}

/** Empreinte SimHash 64 bits d'un ensemble de shingles. */
export function simhash(shingleList: string[]): bigint {
  if (shingleList.length === 0) return 0n;
  const weights = new Array<number>(64).fill(0);
  for (const sh of shingleList) {
    const h = fnv1a64(sh);
    for (let bit = 0; bit < 64; bit++) {
      const isSet = (h >> BigInt(bit)) & 1n;
      weights[bit] += isSet === 1n ? 1 : -1;
    }
  }
  let fingerprint = 0n;
  for (let bit = 0; bit < 64; bit++) {
    if (weights[bit] > 0) fingerprint |= 1n << BigInt(bit);
  }
  return fingerprint;
}

/** Distance de Hamming entre deux empreintes 64 bits. */
export function hamming(a: bigint, b: bigint): number {
  let x = a ^ b;
  let count = 0;
  while (x) {
    x &= x - 1n;
    count++;
  }
  return count;
}

/** Clés LSH : une par bande, pour un pré-filtrage sans O(n²). */
export function bandKeys(fingerprint: bigint): string[] {
  const keys: string[] = [];
  const mask = (1n << BigInt(BAND_BITS)) - 1n;
  for (let band = 0; band < BAND_COUNT; band++) {
    const chunk = (fingerprint >> BigInt(band * BAND_BITS)) & mask;
    keys.push(`${band}:${chunk.toString(16)}`);
  }
  return keys;
}

/** Jaccard exact sur ensembles de shingles hashés (contrôle des paires candidates). */
export function jaccard(a: Set<bigint>, b: Set<bigint>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let inter = 0;
  for (const v of small) if (large.has(v)) inter++;
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
}

export function hashShingleSet(shingleList: string[]): Set<bigint> {
  const set = new Set<bigint>();
  for (const sh of shingleList) set.add(fnv1a64(sh));
  return set;
}
