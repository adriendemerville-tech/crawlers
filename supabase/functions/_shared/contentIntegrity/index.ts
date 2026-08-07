/**
 * contentIntegrity/index.ts
 *
 * Point d'entrée unique : analyzeContentIntegrity(pages, identity).
 * Consommé par :
 *   - crawlQueue/finalizer.ts (crawl multi-page)
 *   - marina (audit prospect)
 *   - parmenion-orchestrator & cocoon-strategist (lecture du rapport persisté)
 */

import { normalizeCorpus, type RawPageText } from './normalize.ts';
import { detectNearDuplicates, DEFAULT_SIMILARITY_THRESHOLD, type NearDuplicateInput } from './nearDuplicate.ts';
import { scoreThinContent, inferPageKind, type ThinContentResult } from './thinContent.ts';
import { qualifyClusters, toleranceFor, type QualifiedCluster, type SiteIdentity } from './qualify.ts';

export type { QualifiedCluster, SiteIdentity, Verdict } from './qualify.ts';
export type { ThinContentResult, PageKind } from './thinContent.ts';
export type { NearDuplicateCluster } from './nearDuplicate.ts';

export interface IntegrityPageInput {
  url: string;
  path?: string | null;
  text: string;
  html_size_bytes?: number | null;
  seo_score?: number | null;
  h2_count?: number | null;
  h3_count?: number | null;
  internal_links?: number | null;
  crawl_depth?: number | null;
  is_indexable?: boolean | null;
  schema_org_types?: string[] | null;
  page_intent?: string | null;
}

export interface ContentIntegrityReport {
  version: 2;
  analyzed_pages: number;
  similarity_threshold: number;
  sector_tolerance: number;
  near_duplicate: {
    clusters: QualifiedCluster[];
    pages_affected: number;
    cannibalization_clusters: number;
    watch_clusters: number;
    normal_clusters: number;
  };
  thin_content: {
    pages: ThinContentResult[];
    count: number;
    avg_thin_score: number;
  };
  llm_calls: number;
  computed_at: string;
}

export function emptyReport(): ContentIntegrityReport {
  return {
    version: 2,
    analyzed_pages: 0,
    similarity_threshold: DEFAULT_SIMILARITY_THRESHOLD,
    sector_tolerance: 0.88,
    near_duplicate: {
      clusters: [],
      pages_affected: 0,
      cannibalization_clusters: 0,
      watch_clusters: 0,
      normal_clusters: 0,
    },
    thin_content: { pages: [], count: 0, avg_thin_score: 0 },
    llm_calls: 0,
    computed_at: new Date().toISOString(),
  };
}

export async function analyzeContentIntegrity(
  pages: IntegrityPageInput[],
  identity: SiteIdentity,
  options?: { skipLlm?: boolean; threshold?: number },
): Promise<ContentIntegrityReport> {
  const usable = pages.filter((p) => p.url && (p.text || '').trim().length > 0);
  if (usable.length === 0) return emptyReport();

  const rawTexts: RawPageText[] = usable.map((p) => ({
    url: p.url,
    text: p.text,
    htmlSizeBytes: p.html_size_bytes ?? null,
  }));

  const normalized = normalizeCorpus(rawTexts);
  const normalizedByUrl = new Map(normalized.map((n) => [n.url, n]));

  // ── Near duplicate ──
  const meta = new Map<string, NearDuplicateInput>(
    usable.map((p) => [p.url, { url: p.url, seoScore: p.seo_score ?? null }]),
  );
  const threshold = options?.threshold ?? DEFAULT_SIMILARITY_THRESHOLD;
  const rawClusters = detectNearDuplicates(normalized, meta, threshold);

  const excerpts = new Map<string, string>(
    normalized.map((n) => [n.url, n.segments.slice(0, 6).join('. ')]),
  );

  let qualified: QualifiedCluster[] = [];
  let llmCalls = 0;
  if (rawClusters.length > 0) {
    if (options?.skipLlm) {
      qualified = rawClusters.map((c) => {
        const tol = toleranceFor(identity);
        const verdict =
          c.template_ratio >= 0.75
            ? 'normal'
            : c.avg_similarity >= tol
            ? 'cannibalization'
            : 'watch';
        return {
          ...c,
          verdict,
          verdict_source: 'deterministic' as const,
          rationale: `Similarité moyenne ${Math.round(c.avg_similarity * 100)} % (tolérance secteur ${Math.round(tol * 100)} %).`,
          recommended_action:
            verdict === 'cannibalization'
              ? ('merge_and_redirect' as const)
              : verdict === 'watch'
              ? ('differentiate' as const)
              : ('none' as const),
        };
      });
    } else {
      const res = await qualifyClusters(rawClusters, identity, excerpts);
      qualified = res.clusters;
      llmCalls = res.llm_calls;
    }
  }

  // ── Thin content ──
  const thinResults: ThinContentResult[] = [];
  for (const page of usable) {
    const norm = normalizedByUrl.get(page.url);
    if (!norm) continue;
    const kind = inferPageKind({
      url: page.url,
      path: page.path ?? null,
      schemaOrgTypes: page.schema_org_types ?? null,
      pageIntent: page.page_intent ?? null,
    });
    const result = scoreThinContent(norm, {
      url: page.url,
      kind,
      htmlSizeBytes: page.html_size_bytes ?? null,
      h2Count: page.h2_count ?? null,
      h3Count: page.h3_count ?? null,
      internalLinks: page.internal_links ?? null,
      crawlDepth: page.crawl_depth ?? null,
      isIndexable: page.is_indexable ?? null,
    });
    if (result.is_thin) thinResults.push(result);
  }
  thinResults.sort((a, b) => b.thin_score - a.thin_score);

  const pagesAffected = new Set<string>();
  for (const c of qualified) {
    if (c.verdict !== 'normal') for (const p of c.pages) pagesAffected.add(p.url);
  }

  return {
    version: 2,
    analyzed_pages: usable.length,
    similarity_threshold: threshold,
    sector_tolerance: toleranceFor(identity),
    near_duplicate: {
      clusters: qualified,
      pages_affected: pagesAffected.size,
      cannibalization_clusters: qualified.filter((c) => c.verdict === 'cannibalization').length,
      watch_clusters: qualified.filter((c) => c.verdict === 'watch').length,
      normal_clusters: qualified.filter((c) => c.verdict === 'normal').length,
    },
    thin_content: {
      pages: thinResults.slice(0, 200),
      count: thinResults.length,
      avg_thin_score: thinResults.length
        ? Math.round(thinResults.reduce((a, b) => a + b.thin_score, 0) / thinResults.length)
        : 0,
    },
    llm_calls: llmCalls,
    computed_at: new Date().toISOString(),
  };
}

/**
 * Résumé texte compact, injectable dans un contexte d'agent
 * (Stratège Cocoon, Parménion) sans coûter de tokens supplémentaires inutiles.
 */
export function summarizeIntegrityReport(report: ContentIntegrityReport | null): string {
  if (!report || report.analyzed_pages === 0) return 'Intégrité du contenu : aucune analyse disponible.';
  const nd = report.near_duplicate;
  const lines: string[] = [
    `Intégrité du contenu (${report.analyzed_pages} pages analysées) :`,
    `- Quasi-doublons : ${nd.clusters.length} groupes (${nd.cannibalization_clusters} cannibalisation, ${nd.watch_clusters} à surveiller, ${nd.normal_clusters} normaux), ${nd.pages_affected} pages concernées.`,
    `- Contenus pauvres : ${report.thin_content.count} pages (score moyen ${report.thin_content.avg_thin_score}/100).`,
  ];
  for (const c of nd.clusters.filter((x) => x.verdict === 'cannibalization').slice(0, 5)) {
    lines.push(
      `  • ${c.pages.length} pages ~${Math.round(c.avg_similarity * 100)} % identiques, pivot ${c.pivot_url} — ${c.rationale}`,
    );
  }
  for (const p of report.thin_content.pages.slice(0, 5)) {
    lines.push(`  • ${p.url} — ${p.useful_words} mots utiles (score ${p.thin_score}/100)`);
  }
  return lines.join('\n');
}
