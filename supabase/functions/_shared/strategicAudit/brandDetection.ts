/**
 * Probabilistic brand name detection from HTML signals + domain.
 */
import type { BrandSignal } from './types.ts';

/**
 * Probabilistic algorithm to detect the real brand/company name from 5 HTML signals + domain.
 * Returns { name, confidence }. If confidence >= 0.95, name is the detected brand (capitalized).
 * Otherwise, name falls back to the target URL.
 */
export function resolveBrandName(signals: BrandSignal[], domain: string, url: string): { name: string; confidence: number } {
  if (signals.length === 0) return { name: url, confidence: 0 };

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-zàâäéèêëïîôùûüÿçœæ0-9]/g, '').trim();
  const domainSlug = normalize(domain.replace(/^www\./, '').split('.')[0]);

  // Group signals by normalized value
  const groups = new Map<string, { totalWeight: number; bestValue: string; sources: string[] }>();
  for (const sig of signals) {
    const rawVal = sig.value.trim();
    if (rawVal.length > 40) {
      console.log(`⏭️ Brand detection: skipping too-long signal "${rawVal.substring(0, 50)}..." from ${sig.source}`);
      continue;
    }
    const norm = normalize(rawVal);
    if (!norm || norm.length < 2) continue;
    const existing = groups.get(norm);
    if (existing) {
      existing.totalWeight += sig.weight;
      existing.sources.push(sig.source);
      if (sig.value.length >= existing.bestValue.length) existing.bestValue = sig.value;
    } else {
      groups.set(norm, { totalWeight: sig.weight, bestValue: sig.value, sources: [sig.source] });
    }
  }

  if (groups.size === 0) return { name: url, confidence: 0 };

  // Check for near-matches (one group contains the other)
  const groupKeys = [...groups.keys()];
  for (let i = 0; i < groupKeys.length; i++) {
    for (let j = i + 1; j < groupKeys.length; j++) {
      const a = groupKeys[i], b = groupKeys[j];
      if (a.includes(b) || b.includes(a)) {
        const shorter = a.length <= b.length ? a : b;
        const longer = shorter === a ? b : a;
        const merged = groups.get(shorter)!;
        const other = groups.get(longer)!;
        merged.totalWeight += other.totalWeight;
        merged.sources.push(...other.sources);
        groups.delete(longer);
      }
    }
  }

  // Find the best group
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  let best = { norm: '', totalWeight: 0, bestValue: '', sources: [] as string[] };
  for (const [norm, g] of groups) {
    if (g.totalWeight > best.totalWeight) {
      best = { norm, ...g };
    }
  }

  // Calculate confidence
  let confidence = best.totalWeight / totalWeight;
  if (best.sources.length >= 3) confidence = Math.min(1, confidence + 0.15);
  else if (best.sources.length >= 2) confidence = Math.min(1, confidence + 0.08);
  if (normalize(best.bestValue) === domainSlug) confidence = Math.min(1, confidence + 0.05);

  // Ensure proper capitalization
  let finalName = best.bestValue.trim();
  if (finalName === finalName.toLowerCase() && finalName.length > 1) {
    finalName = finalName.replace(/\b\w/g, c => c.toUpperCase());
  }

  console.log(`🎯 Brand detection: "${finalName}" (confidence: ${(confidence * 100).toFixed(1)}%, sources: ${best.sources.join(',')})`);

  if (confidence >= 0.95) {
    return { name: finalName, confidence };
  }
  return { name: url, confidence };
}

export function humanizeBrandName(slug: string): string {
  if (!slug || slug.length < 1) return slug;
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function sanitizeBrandNameInResponse(obj: any, domainSlug: string, humanName: string): any {
  if (!obj || !domainSlug || !humanName || domainSlug === humanName) return obj;
  const slugLower = domainSlug.toLowerCase();
  function replaceInString(str: string): string {
    if (!str || typeof str !== 'string') return str;
    const regex = new RegExp(slugLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return str.replace(regex, humanName);
  }
  function walk(node: any): any {
    if (typeof node === 'string') return replaceInString(node);
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const out: any = {};
      for (const [k, v] of Object.entries(node)) { out[k] = walk(v); }
      return out;
    }
    return node;
  }
  return walk(obj);
}
