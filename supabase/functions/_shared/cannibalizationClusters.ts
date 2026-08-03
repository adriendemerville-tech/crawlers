/**
 * cannibalizationClusters — clustering déterministe (0 LLM) des pages
 * qui visent la même intention (slug + titre + H1).
 *
 * Source unique partagée entre :
 *  - le skill Copilot `detect_content_cannibalization` (lecture seule, Félix / Stratège)
 *  - le garde de saturation de Parménion (phase prescribe) qui interdit la
 *    création d'un nouvel article dans un cluster déjà surchargé et propose
 *    à la place une consolidation (301 + fusion vers le pilier) = pruning.
 *
 * Aucun appel LLM, aucun service role : le client passé en argument porte le RLS.
 */

export const FR_STOPWORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'da', 'et', 'ou', 'en', 'au', 'aux',
  'pour', 'par', 'sur', 'sous', 'avec', 'sans', 'dans', 'vers', 'chez', 'que', 'qui', 'quoi',
  'comment', 'pourquoi', 'quand', 'est', 'ce', 'cet', 'cette', 'ces', 'son', 'sa', 'ses',
  'mon', 'ma', 'mes', 'votre', 'vos', 'notre', 'nos', 'plus', 'moins', 'tout', 'tous', 'toute',
  'toutes', 'guide', 'complet', 'blog', 'article', 'page', 'fr', 'html', 'index',
  '2024', '2025', '2026', '2027', 'vs', 'ne', 'pas', 'a', 'the', 'and', 'of', 'to',
]);

export function cannibTokens(...parts: (string | null | undefined)[]): Set<string> {
  const raw = parts.filter(Boolean).join(' ')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');
  const out = new Set<string>();
  for (const t of raw.split(' ')) {
    if (t.length < 3) continue;
    if (FR_STOPWORDS.has(t)) continue;
    out.add(t.endsWith('s') && t.length > 4 ? t.slice(0, -1) : t);
  }
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface CannibCluster {
  theme: string;
  tokens: string[];
  size: number;
  pilier: { url: string; path: string; title: string };
  duplicates: { url: string; path: string; title: string }[];
}

export interface CannibResult {
  ok: true;
  crawl_id: string;
  domain: string;
  threshold: number;
  analyzed_pages: number;
  clusters_count: number;
  redundant_pages: number;
  clusters: CannibCluster[];
  report_markdown: string;
}

export interface CannibError { ok: false; error: string }

export async function computeCannibalization(
  supabase: any,
  opts: { domain: string; threshold?: number; pathPrefix?: string; maxClusters?: number },
): Promise<CannibResult | CannibError> {
  const domain = (opts.domain || '').trim().replace(/^www\./, '');
  if (!domain) return { ok: false, error: 'domain requis' };

  const threshold = Math.min(0.8, Math.max(0.3, Number(opts.threshold ?? 0.45) || 0.45));
  const prefix = (opts.pathPrefix || '').trim();
  const maxClusters = opts.maxClusters ?? 20;

  const { data: crawls } = await supabase
    .from('site_crawls')
    .select('id, domain, completed_at')
    .eq('status', 'completed')
    .or(`domain.eq.${domain},domain.eq.www.${domain}`)
    .order('created_at', { ascending: false })
    .limit(1);
  const crawl = crawls?.[0];
  if (!crawl) return { ok: false, error: `Aucun crawl terminé pour ${domain}. Lance un audit d'abord.` };

  const { data: pages } = await supabase
    .from('crawl_pages')
    .select('url, path, title, h1, word_count, seo_score, crawl_depth, is_indexable, page_intent, anchor_texts')
    .eq('crawl_id', crawl.id);

  let list = (pages ?? []) as Record<string, any>[];
  if (prefix) list = list.filter((p) => String(p.path ?? '').startsWith(prefix));
  list = list.filter((p) => p.is_indexable !== false);
  if (list.length < 2) return { ok: false, error: 'Pas assez de pages indexables pour analyser la cannibalisation' };

  const norm = (u: string) => { try { return new URL(u).pathname.replace(/\/$/, '') || '/'; } catch { return u; } };
  const inbound = new Map<string, number>();
  for (const p of list) inbound.set(norm(p.url), 0);
  for (const p of list) {
    for (const link of (p.anchor_texts || [])) {
      if (link?.type === 'internal' && typeof link.href === 'string') {
        const target = norm(link.href.startsWith('/') ? `https://x${link.href}` : link.href);
        if (inbound.has(target)) inbound.set(target, (inbound.get(target) || 0) + 1);
      }
    }
  }

  type Node = { url: string; path: string; title: string; tokens: Set<string>; score: number };
  const nodes: Node[] = list.map((p) => {
    const path = String(p.path ?? norm(p.url));
    const tokens = cannibTokens(path.replace(/\//g, ' '), p.title, p.h1);
    const score =
      (Number(p.seo_score) || 0) * 1.0 +
      Math.min(40, (Number(p.word_count) || 0) / 50) +
      (inbound.get(norm(p.url)) || 0) * 3 -
      (Number(p.crawl_depth) || 0) * 2;
    return { url: String(p.url), path, title: String(p.title ?? p.h1 ?? path), tokens, score };
  }).filter((n) => n.tokens.size >= 2 && n.path !== '/');

  nodes.sort((a, b) => b.tokens.size - a.tokens.size || a.path.localeCompare(b.path));
  const used = new Set<string>();
  const rawClusters: { anchor: Node; members: Node[]; sharedTokens: string[] }[] = [];
  for (const anchor of nodes) {
    if (used.has(anchor.path)) continue;
    const members: Node[] = [anchor];
    used.add(anchor.path);
    for (const cand of nodes) {
      if (used.has(cand.path)) continue;
      if (jaccard(anchor.tokens, cand.tokens) >= threshold) {
        members.push(cand);
        used.add(cand.path);
      }
    }
    if (members.length < 2) continue;
    const shared = [...anchor.tokens].filter((t) => members.every((m) => m.tokens.has(t)));
    rawClusters.push({ anchor, members, sharedTokens: shared });
  }

  rawClusters.sort((a, b) => b.members.length - a.members.length);
  const detailed: CannibCluster[] = rawClusters.map((c) => {
    const ranked = [...c.members].sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
    const pilier = ranked[0];
    const tokens = c.sharedTokens.length ? c.sharedTokens : [...c.anchor.tokens].slice(0, 4);
    return {
      theme: tokens.join(' '),
      tokens,
      size: ranked.length,
      pilier: { url: pilier.url, path: pilier.path, title: pilier.title },
      duplicates: ranked.slice(1).map((m) => ({ url: m.url, path: m.path, title: m.title })),
    };
  });

  const redundant = detailed.reduce((s, c) => s + c.duplicates.length, 0);
  const md: string[] = [
    `## Cannibalisation — ${crawl.domain}${prefix ? ` (${prefix})` : ''}`,
    `_Crawl ${new Date(crawl.completed_at).toLocaleDateString('fr-FR')} • ${nodes.length} pages analysées • seuil ${threshold}_`,
    '',
    detailed.length === 0
      ? 'Aucun cluster de cannibalisation détecté à ce seuil.'
      : `**${detailed.length} clusters** en conflit, **${redundant} pages redondantes** sur ${nodes.length} (${Math.round((redundant / nodes.length) * 100)}%).`,
    '',
  ];
  for (const c of detailed.slice(0, 12)) {
    md.push(`### Cluster « ${c.theme} » — ${c.size} pages`);
    md.push(`- Pilier à conserver : **${c.pilier.path}** — ${c.pilier.title}`);
    md.push(`- À consolider (301 vers le pilier + fusion du contenu utile) :`);
    for (const d of c.duplicates.slice(0, 12)) md.push(`  - ${d.path}`);
    md.push('');
  }
  if (detailed.length > 12) md.push(`_… ${detailed.length - 12} autres clusters non détaillés._`);

  return {
    ok: true,
    crawl_id: crawl.id,
    domain: crawl.domain,
    threshold,
    analyzed_pages: nodes.length,
    clusters_count: detailed.length,
    redundant_pages: redundant,
    clusters: detailed.slice(0, maxClusters),
    report_markdown: md.join('\n'),
  };
}

/**
 * Garde de saturation pour Parménion.
 * - saturated : clusters ayant `saturationSize` pages ou plus (défaut 3).
 * - blocked : true si le sujet proposé recouvre un cluster saturé (Jaccard ≥ overlap).
 * - pruning : cluster le plus lourd à consolider (pilier + doublons à 301).
 */
export function evaluateTopicSaturation(
  result: CannibResult,
  topicText: string,
  opts?: { saturationSize?: number; overlap?: number },
): {
  blocked: boolean;
  matched?: CannibCluster;
  score: number;
  saturated_clusters: CannibCluster[];
  pruning_candidate?: CannibCluster;
} {
  const saturationSize = opts?.saturationSize ?? 3;
  const minOverlap = opts?.overlap ?? 0.5;
  const saturated = result.clusters.filter((c) => c.size >= saturationSize);
  const topicTokens = cannibTokens(topicText);

  let best: CannibCluster | undefined;
  let bestScore = 0;
  for (const c of saturated) {
    const s = jaccard(topicTokens, new Set(c.tokens));
    if (s > bestScore) { bestScore = s; best = c; }
  }

  const pruning = [...result.clusters].sort((a, b) => b.duplicates.length - a.duplicates.length)[0];
  return {
    blocked: !!best && bestScore >= minOverlap,
    matched: best,
    score: Number(bestScore.toFixed(3)),
    saturated_clusters: saturated,
    pruning_candidate: pruning && pruning.duplicates.length > 0 ? pruning : undefined,
  };
}
