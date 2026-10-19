/**
 * Parsers et plafonds des outils MCP DataForSEO. Aucun appel réseau, aucune
 * écriture. Les appels vivent dans mcpDataForSeo.ts et ne journalisent que
 * `trackPaidApiCall`, comme le reste de la plateforme.
 *
 * Les requêtes reprennent les endpoints déjà utilisés dans la plateforme :
 * - Labs `keyword_ideas` (idées + volume + keyword_properties.keyword_difficulty),
 *   même famille que `keyword_suggestions` (audit-local-seo, copilot) ;
 * - `bulk_keyword_difficulty` uniquement si la difficulté Labs est absente ;
 * - `serp/google/organic/live/regular` (serpPool, generate-more-keywords) ;
 * - `backlinks/summary|referring_domains|anchors` (backlink-scanner, domainAuthority).
 *
 * Estimations de coût (octobre 2026, grilles publiques, pas un débit) :
 * voir DATAFORSEO_COST_NOTES.
 */

export const DATAFORSEO_COST_NOTES = {
  sources: [
    'https://dataforseo.com/pricing',
    'https://dataforseo.com/apis/dataforseo-labs-api/keyword-research',
    'https://dataforseo.com/pricing/serp/google-organic-serp-api',
    'https://dataforseo.com/pricing/backlinks/backlinks',
  ],
  /** Labs keyword_ideas live : 0,012 $ / tâche + 0,00012 $ / item. */
  keywordIdeasPerTaskUsd: 0.012,
  keywordIdeasPerItemUsd: 0.00012,
  /** Labs bulk_keyword_difficulty live : 0,0012 $ / tâche + 0,00012 $ / mot-clé. */
  bulkDifficultyPerTaskUsd: 0.0012,
  bulkDifficultyPerKeywordUsd: 0.00012,
  /** SERP Google organic live : 0,002 $ par page de 10 résultats (depth). */
  serpLivePer10ResultsUsd: 0.002,
  /** Backlinks live : 0,024 $ / tâche + 0,000036 $ / ligne. */
  backlinksPerTaskUsd: 0.024,
  backlinksPerRowUsd: 0.000036,
} as const;

export const MCP_DATA_LIMITS = {
  keywordSeeds: 5,
  keywordSeedLength: 80,
  keywordResultsDefault: 15,
  keywordResultsMax: 25,
  serpDepthDefault: 10,
  serpDepthMax: 20,
  backlinkRowsDefault: 10,
  backlinkRowsMax: 20,
} as const;

/** Codes pays déjà mappés dans keywordVolumeSource / serpPool. France par défaut. */
export const LOCATION_CODES: Record<string, number> = {
  fr: 2250,
  be: 2056,
  ch: 2756,
  ca: 2124,
  lu: 2442,
  de: 2276,
  gb: 2826,
  us: 2840,
  es: 2724,
  it: 2380,
};

export class DataForSeoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataForSeoError';
  }
}

export interface KeywordIdea {
  keyword: string;
  search_volume: number;
  keyword_difficulty: number | null;
  difficulty_source: 'keyword_properties' | 'bulk_keyword_difficulty' | null;
  cpc: number | null;
  competition: number | null;
}

export interface OrganicHit {
  position: number;
  url: string;
  domain: string;
  title: string;
  snippet: string;
}

export interface ReferringDomainRow {
  domain: string;
  rank: number;
  backlinks: number;
}

export interface AnchorRow {
  anchor: string;
  backlinks: number;
  referring_domains: number;
}

export function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new DataForSeoError(`limite invalide (entier entre ${min} et ${max}).`);
  }
  return n;
}

export function resolveLocation(country: unknown, locationCode: unknown): { country: string; location_code: number } {
  if (locationCode !== undefined && locationCode !== null && locationCode !== '') {
    const n = typeof locationCode === 'number' ? locationCode : Number(locationCode);
    if (!Number.isInteger(n) || n < 1 || n > 10_000_000) {
      throw new DataForSeoError('location_code invalide.');
    }
    const fromCode = Object.entries(LOCATION_CODES).find(([, code]) => code === n);
    return { country: fromCode?.[0] ?? 'custom', location_code: n };
  }
  const cc = String(country ?? 'fr').trim().toLowerCase();
  const code = LOCATION_CODES[cc];
  if (!code) {
    throw new DataForSeoError(`country doit valoir ${Object.keys(LOCATION_CODES).join(', ')}.`);
  }
  return { country: cc, location_code: code };
}

export function normalizeLanguage(language: unknown): string {
  const lang = String(language ?? 'fr').trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(lang)) throw new DataForSeoError('language_code doit être un code ISO à 2 lettres.');
  return lang;
}

export function normalizeSeeds(input: { keyword?: unknown; keywords?: unknown }): string[] {
  const raw: unknown[] = [];
  if (Array.isArray(input.keywords)) raw.push(...input.keywords);
  if (typeof input.keyword === 'string' && input.keyword.trim()) raw.push(input.keyword);
  const seeds: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const kw = String(item ?? '').trim().replace(/\s+/g, ' ');
    if (!kw) continue;
    if (kw.length > MCP_DATA_LIMITS.keywordSeedLength) {
      throw new DataForSeoError(`chaque graine fait au plus ${MCP_DATA_LIMITS.keywordSeedLength} caractères.`);
    }
    const key = kw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    seeds.push(kw);
    if (seeds.length > MCP_DATA_LIMITS.keywordSeeds) {
      throw new DataForSeoError(`au plus ${MCP_DATA_LIMITS.keywordSeeds} graines par appel.`);
    }
  }
  if (seeds.length === 0) throw new DataForSeoError('keyword ou keywords est requis.');
  return seeds;
}

export function bareDomain(raw: unknown): string {
  let s = String(raw ?? '').trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]?.split('?')[0] ?? '';
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(s)) {
    throw new DataForSeoError('domaine invalide.');
  }
  return s;
}

/** Difficulté Labs (0-100). Jamais `competition_index` Google Ads. */
export function readKeywordDifficulty(item: Record<string, unknown> | null | undefined): number | null {
  const nested = item?.['keyword_data'] as Record<string, unknown> | undefined;
  const candidates = [
    (item?.['keyword_properties'] as Record<string, unknown> | undefined)?.['keyword_difficulty'],
    (nested?.['keyword_properties'] as Record<string, unknown> | undefined)?.['keyword_difficulty'],
  ];
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c)) return c;
  }
  return null;
}

export function parseKeywordIdeas(payload: unknown, limit: number): KeywordIdea[] {
  const items = (payload as { tasks?: Array<{ result?: Array<{ items?: unknown[] }> }> })
    ?.tasks?.[0]?.result?.[0]?.items;
  if (!Array.isArray(items)) return [];
  const out: KeywordIdea[] = [];
  const seen = new Set<string>();
  for (const raw of items) {
    const item = raw as Record<string, unknown>;
    const nested = item?.['keyword_data'] as Record<string, unknown> | undefined;
    const keyword = String(item?.['keyword'] ?? nested?.['keyword'] ?? '').trim();
    if (!keyword) continue;
    const key = keyword.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const info = (item?.['keyword_info'] ?? nested?.['keyword_info'] ?? {}) as Record<string, unknown>;
    const kd = readKeywordDifficulty(item);
    out.push({
      keyword,
      search_volume: typeof info['search_volume'] === 'number' ? info['search_volume'] : 0,
      keyword_difficulty: kd,
      difficulty_source: kd === null ? null : 'keyword_properties',
      cpc: typeof info['cpc'] === 'number' ? info['cpc'] : null,
      competition: typeof info['competition'] === 'number' ? info['competition'] : null,
    });
  }
  out.sort((a, b) => b.search_volume - a.search_volume || a.keyword.localeCompare(b.keyword));
  return out.slice(0, limit);
}

export function applyBulkDifficulty(ideas: KeywordIdea[], payload: unknown): KeywordIdea[] {
  const items = (payload as { tasks?: Array<{ result?: Array<{ items?: unknown[] }> }> })
    ?.tasks?.[0]?.result?.[0]?.items;
  const map = new Map<string, number>();
  if (Array.isArray(items)) {
    for (const raw of items) {
      const it = raw as Record<string, unknown>;
      const k = String(it['keyword'] ?? '').toLowerCase();
      if (k && typeof it['keyword_difficulty'] === 'number' && Number.isFinite(it['keyword_difficulty'] as number)) {
        map.set(k, it['keyword_difficulty'] as number);
      }
    }
  }
  return ideas.map((idea) => {
    if (idea.keyword_difficulty !== null) return idea;
    const kd = map.get(idea.keyword.toLowerCase());
    if (kd === undefined) return idea;
    return { ...idea, keyword_difficulty: kd, difficulty_source: 'bulk_keyword_difficulty' as const };
  });
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

export function parseOrganicSerp(payload: unknown, limit: number): OrganicHit[] {
  const items = (payload as { tasks?: Array<{ result?: Array<{ items?: unknown[] }> }> })
    ?.tasks?.[0]?.result?.[0]?.items ?? [];
  const out: OrganicHit[] = [];
  if (!Array.isArray(items)) return out;
  for (const raw of items) {
    const item = raw as Record<string, unknown>;
    if (item['type'] !== 'organic' || typeof item['url'] !== 'string' || !item['url']) continue;
    const url = item['url'];
    out.push({
      position: typeof item['rank_absolute'] === 'number'
        ? item['rank_absolute']
        : (typeof item['rank_group'] === 'number' ? item['rank_group'] : out.length + 1),
      url,
      domain: typeof item['domain'] === 'string' && item['domain'] ? item['domain'] : hostnameOf(url),
      title: typeof item['title'] === 'string' ? item['title'] : '',
      snippet: typeof item['description'] === 'string' ? item['description'] : '',
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** Position du domaine dans les résultats organiques déjà parsés. */
export function domainPosition(hits: OrganicHit[], domain: string | null): number | null {
  if (!domain) return null;
  const clean = domain.replace(/^www\./, '').toLowerCase();
  for (const hit of hits) {
    const host = hit.domain.replace(/^www\./, '').toLowerCase();
    if (host === clean || host.endsWith(`.${clean}`)) return hit.position;
  }
  return null;
}

export function parseReferringDomains(payload: unknown, limit: number): ReferringDomainRow[] {
  const items = (payload as { tasks?: Array<{ result?: Array<{ items?: unknown[] }> }> })
    ?.tasks?.[0]?.result?.[0]?.items;
  if (!Array.isArray(items)) return [];
  return items.slice(0, limit).map((raw) => {
    const it = raw as Record<string, unknown>;
    return {
      domain: String(it['domain'] ?? ''),
      rank: typeof it['rank'] === 'number' ? it['rank'] : 0,
      backlinks: typeof it['backlinks'] === 'number' ? it['backlinks'] : 0,
    };
  }).filter((r) => r.domain);
}

export function parseAnchors(payload: unknown, limit: number): AnchorRow[] {
  const items = (payload as { tasks?: Array<{ result?: Array<{ items?: unknown[] }> }> })
    ?.tasks?.[0]?.result?.[0]?.items;
  if (!Array.isArray(items)) return [];
  return items.slice(0, limit).map((raw) => {
    const it = raw as Record<string, unknown>;
    return {
      anchor: String(it['anchor'] ?? '').trim(),
      backlinks: typeof it['backlinks'] === 'number' ? it['backlinks'] : 0,
      referring_domains: typeof it['referring_domains'] === 'number' ? it['referring_domains'] : 0,
    };
  }).filter((a) => a.anchor);
}

export function parseBacklinkSummary(payload: unknown): Record<string, unknown> | null {
  const row = (payload as { tasks?: Array<{ result?: unknown[] }> })?.tasks?.[0]?.result?.[0];
  if (!row || typeof row !== 'object') return null;
  const s = row as Record<string, unknown>;
  return {
    backlinks: typeof s['backlinks'] === 'number' ? s['backlinks'] : 0,
    referring_domains: typeof s['referring_domains'] === 'number' ? s['referring_domains'] : 0,
    referring_main_domains: typeof s['referring_main_domains'] === 'number' ? s['referring_main_domains'] : 0,
    rank: typeof s['rank'] === 'number' ? s['rank'] : null,
    broken_backlinks: typeof s['broken_backlinks'] === 'number' ? s['broken_backlinks'] : null,
    spam_score: typeof s['backlinks_spam_score'] === 'number' ? s['backlinks_spam_score'] : null,
    first_seen: typeof s['first_seen'] === 'string' ? s['first_seen'] : null,
  };
}

export function estimateKeywordResearchUsd(resultCount: number, bulkCalls: number): number {
  const items = Math.max(0, resultCount);
  const ideas = DATAFORSEO_COST_NOTES.keywordIdeasPerTaskUsd + items * DATAFORSEO_COST_NOTES.keywordIdeasPerItemUsd;
  const bulk = bulkCalls > 0
    ? DATAFORSEO_COST_NOTES.bulkDifficultyPerTaskUsd + items * DATAFORSEO_COST_NOTES.bulkDifficultyPerKeywordUsd
    : 0;
  return roundUsd(ideas + bulk);
}

export function estimateSerpUsd(depth: number): number {
  const pages = Math.max(1, Math.ceil(depth / 10));
  return roundUsd(pages * DATAFORSEO_COST_NOTES.serpLivePer10ResultsUsd);
}

export function estimateBacklinkUsd(referringRows: number, anchorRows: number): number {
  const tasks = 3;
  const rows = 1 + Math.max(0, referringRows) + Math.max(0, anchorRows);
  return roundUsd(tasks * DATAFORSEO_COST_NOTES.backlinksPerTaskUsd + rows * DATAFORSEO_COST_NOTES.backlinksPerRowUsd);
}

function roundUsd(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
