import { mergeMarinaReports } from './mergeReports';

export interface BatchReportItem {
  id: string;
  url?: string | null;
  domain?: string | null;
  hasReport?: boolean;
  status?: string | null;
}

/**
 * Reconstruit le rapport consolidé d'un lot multipages à partir des rapports
 * individuels stockés. On lit chaque rapport via le proxy same-origin
 * `/api/public/marina-report?id=<jobId>` (les URL signées Storage sont
 * cross-origin et expirent), puis on fusionne avec mutualisation.
 *
 * Retourne `null` si aucun rapport n'est récupérable.
 */
export async function buildMergedBatchReport(
  items: BatchReportItem[],
): Promise<{ html: string; missing: number } | null> {
  const parts: { url: string; html: string }[] = [];
  let missing = 0;

  for (const item of items) {
    if (item.status && item.status !== 'completed' && item.status !== 'partial') continue;
    try {
      const resp = await fetch(`/api/public/marina-report?id=${encodeURIComponent(item.id)}`);
      const text = resp.ok ? await resp.text() : '';
      if (/<html/i.test(text) && !text.includes('Rapport introuvable')) {
        parts.push({ url: item.url || item.domain || item.id, html: text });
      } else {
        missing += 1;
      }
    } catch {
      missing += 1;
    }
  }

  if (parts.length === 0) return null;
  return { html: mergeMarinaReports(parts), missing };
}
