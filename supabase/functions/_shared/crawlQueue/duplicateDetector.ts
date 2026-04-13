/**
 * Cross-page analysis: duplicate detection, BFS depth computation.
 */
import type { PageAnalysis } from './types.ts';

// ── Cross-page duplicate detection (title/meta + content hash) ──
export function detectDuplicates(pages: PageAnalysis[]): Record<string, string[]> {
  const titleMap: Record<string, string[]> = {};
  const metaMap: Record<string, string[]> = {};
  const hashMap: Record<string, string[]> = {};
  const duplicateIssues: Record<string, string[]> = {};

  for (const page of pages) {
    if (page.title) {
      const key = page.title.toLowerCase().trim();
      if (!titleMap[key]) titleMap[key] = [];
      titleMap[key].push(page.url);
    }
    if (page.meta_description) {
      const key = page.meta_description.toLowerCase().trim();
      if (!metaMap[key]) metaMap[key] = [];
      metaMap[key].push(page.url);
    }
    if (page.content_hash) {
      if (!hashMap[page.content_hash]) hashMap[page.content_hash] = [];
      hashMap[page.content_hash].push(page.url);
    }
  }

  for (const [, urls] of Object.entries(titleMap)) {
    if (urls.length > 1) {
      for (const url of urls) {
        if (!duplicateIssues[url]) duplicateIssues[url] = [];
        duplicateIssues[url].push('duplicate_title');
      }
    }
  }
  for (const [, urls] of Object.entries(metaMap)) {
    if (urls.length > 1) {
      for (const url of urls) {
        if (!duplicateIssues[url]) duplicateIssues[url] = [];
        duplicateIssues[url].push('duplicate_meta_description');
      }
    }
  }
  for (const [, urls] of Object.entries(hashMap)) {
    if (urls.length > 1) {
      for (const url of urls) {
        if (!duplicateIssues[url]) duplicateIssues[url] = [];
        duplicateIssues[url].push('near_duplicate_content');
      }
    }
  }

  return duplicateIssues;
}

// ── Compute crawl depth via BFS on internal link graph ─────
export function computeBFSDepths(pages: PageAnalysis[], baseUrl: string): Map<string, number> {
  const depths = new Map<string, number>();

  const normalize = (u: string) => {
    try { return new URL(u).pathname.replace(/\/$/, '') || '/'; } catch { return u; }
  };

  const basePath = normalize(baseUrl);
  const allPaths = new Set(pages.map(p => normalize(p.url)));

  const adj = new Map<string, Set<string>>();
  for (const page of pages) {
    const srcPath = normalize(page.url);
    if (!adj.has(srcPath)) adj.set(srcPath, new Set());
    for (const link of (page.anchor_texts || [])) {
      if (link.type === 'internal') {
        const targetPath = normalize(link.href.startsWith('/') ? `https://x${link.href}` : link.href);
        if (allPaths.has(targetPath)) {
          adj.get(srcPath)!.add(targetPath);
        }
      }
    }
  }

  depths.set(basePath, 0);
  const queue = [basePath];
  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    const currentDepth = depths.get(current)!;
    const neighbors = adj.get(current) || new Set();
    for (const neighbor of neighbors) {
      if (!depths.has(neighbor)) {
        depths.set(neighbor, currentDepth + 1);
        queue.push(neighbor);
      }
    }
  }

  for (const page of pages) {
    const path = normalize(page.url);
    if (!depths.has(path)) {
      depths.set(path, path.split('/').filter(Boolean).length);
    }
  }

  return depths;
}

// ── Fallback: compute depth from URL structure ─────────────
export function computeDepth(pageUrl: string, baseUrl: string): number {
  try {
    const basePath = new URL(baseUrl).pathname.replace(/\/$/, '');
    const pagePath = new URL(pageUrl).pathname.replace(/\/$/, '');

    if (pagePath === basePath || pagePath === '') return 0;

    const relativePath = pagePath.startsWith(basePath)
      ? pagePath.slice(basePath.length)
      : pagePath;

    return relativePath.split('/').filter(Boolean).length;
  } catch {
    return 0;
  }
}
