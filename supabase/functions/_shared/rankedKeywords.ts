/**
 * Mots-clés positionnés (DataForSEO Labs — ranked_keywords).
 *
 * Source unique pour le bloc « Mots-clés positionnés » affiché dans l'audit
 * SEO expert et le rapport de crawl : un seul appel payant par domaine,
 * mis en cache 24 h (table audit_cache) pour ne pas multiplier la dépense.
 *
 * Ne throw jamais : renvoie `null` quand les identifiants manquent, quand
 * DataForSEO ne répond pas, ou quand le domaine n'a aucun positionnement.
 */
import { cacheKey, getCached, setCache } from './auditCache.ts';

const DATAFORSEO_LOGIN = Deno.env.get('DATAFORSEO_LOGIN');
const DATAFORSEO_PASSWORD = Deno.env.get('DATAFORSEO_PASSWORD');

/** France / français par défaut : le parc Crawlers est francophone. */
const DEFAULT_LOCATION_CODE = 2250;
const DEFAULT_LANGUAGE_CODE = 'fr';
const CACHE_TTL_MINUTES = 24 * 60;

export interface RankedKeywordItem {
  keyword: string;
  position: number;
  volume: number;
  url: string;
}

export interface RankedKeywordsSnapshot {
  domain: string;
  /** Total de mots-clés positionnés dans le top 100 (estimation DataForSEO). */
  total_ranked_keywords: number;
  /** Trafic organique estimé mensuel (ETV cumulé de l'échantillon). */
  estimated_traffic: number;
  average_position: number;
  top3: number;
  top10: number;
  /** Les 10 mots-clés au plus fort volume. */
  top_keywords: RankedKeywordItem[];
  location_code: number;
  language_code: string;
  source: 'dataforseo_labs';
  fetched_at: string;
}

function normalizeDomain(raw: string): string {
  return raw
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
    .trim();
}

export function hasRankedKeywordsCredentials(): boolean {
  return Boolean(DATAFORSEO_LOGIN && DATAFORSEO_PASSWORD);
}

export async function fetchRankedKeywordsSnapshot(
  rawDomain: string,
  opts?: { locationCode?: number; languageCode?: string; skipCache?: boolean },
): Promise<RankedKeywordsSnapshot | null> {
  const domain = normalizeDomain(rawDomain);
  if (!domain || !hasRankedKeywordsCredentials()) return null;

  const locationCode = opts?.locationCode ?? DEFAULT_LOCATION_CODE;
  const languageCode = opts?.languageCode ?? DEFAULT_LANGUAGE_CODE;
  const key = cacheKey('ranked-keywords', { domain, loc: locationCode, lang: languageCode, v: 1 });

  if (!opts?.skipCache) {
    const cached = await getCached(key);
    if (cached?.source === 'dataforseo_labs') return cached as RankedKeywordsSnapshot;
  }

  try {
    const auth = 'Basic ' + btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`);
    const response = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        target: domain,
        location_code: locationCode,
        language_code: languageCode,
        limit: 100,
        order_by: ['keyword_data.keyword_info.search_volume,desc'],
        filters: ['keyword_data.keyword_info.search_volume', '>', '0'],
      }]),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`[ranked-keywords] DataForSEO HTTP ${response.status} pour ${domain}`);
      return null;
    }

    const data = await response.json();
    const taskResult = data?.tasks?.[0]?.result?.[0];
    const items: unknown[] = taskResult?.items ?? [];
    if (items.length === 0) return null;

    let sumPosition = 0;
    let totalEtv = 0;
    let top3 = 0;
    let top10 = 0;
    const topKeywords: RankedKeywordItem[] = [];

    for (const raw of items) {
      const item = raw as Record<string, any>;
      const serpItem = item.ranked_serp_element?.serp_item ?? {};
      const position = serpItem.rank_absolute || serpItem.rank_group || 999;
      sumPosition += position;
      totalEtv += serpItem.etv || 0;
      if (position <= 3) top3++;
      if (position <= 10) top10++;
      if (topKeywords.length < 10) {
        topKeywords.push({
          keyword: item.keyword_data?.keyword ?? '',
          position,
          volume: item.keyword_data?.keyword_info?.search_volume ?? 0,
          url: serpItem.url ?? '',
        });
      }
    }

    const snapshot: RankedKeywordsSnapshot = {
      domain,
      total_ranked_keywords: taskResult?.total_count || items.length,
      estimated_traffic: Math.round(totalEtv),
      average_position: Math.round((sumPosition / items.length) * 10) / 10,
      top3,
      top10,
      top_keywords: topKeywords,
      location_code: locationCode,
      language_code: languageCode,
      source: 'dataforseo_labs',
      fetched_at: new Date().toISOString(),
    };

    await setCache(key, 'ranked-keywords', snapshot, CACHE_TTL_MINUTES);
    return snapshot;
  } catch (error) {
    console.error('[ranked-keywords] Erreur DataForSEO:', error);
    return null;
  }
}
