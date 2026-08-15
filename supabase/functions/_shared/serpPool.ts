/**
 * Pool SERP mutualisé — point d'entrée unique pour toute requête SERP.
 *
 * Principe : la donnée SERP est publique et non personnelle, donc partagée
 * entre tous les utilisateurs via la table `serp_pool` (clé = requête
 * normalisée + moteur + pays + langue + device + location).
 * L'attribution/quota reste dans `serp_pool_hits`.
 *
 * getSerp() est read-through :
 *  1. hit frais dans le pool (TTL selon la classe d'usage) → 0 $
 *  2. sinon appel provider (DataForSEO → Serper → SerpAPI), écriture dans le
 *     pool, puis fan-out des positions vers `keyword_universe` pour TOUS les
 *     domaines suivis présents dans le top 100.
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

export type SerpUsageClass = 'position' | 'intent' | 'volume';

export interface SerpOptions {
  engine?: string;
  country?: string;
  language?: string;
  device?: 'desktop' | 'mobile';
  location?: string;
  usageClass?: SerpUsageClass;
  /** Contexte d'attribution (journal + quotas) */
  caller: string;
  userId?: string | null;
  trackedSiteId?: string | null;
  /** Ne jamais appeler de provider payant : renvoie null si pas de hit pool */
  poolOnly?: boolean;
  /** Force le rafraîchissement même si un hit frais existe */
  forceRefresh?: boolean;
  /** Désactive le fan-out des positions (utile pour les analyses d'intention) */
  skipFanout?: boolean;
}

export interface SerpOrganicResult {
  position: number;
  url: string;
  domain: string;
  title: string;
  snippet: string;
}

export interface SerpResult {
  queryNormalized: string;
  organic: SerpOrganicResult[];
  paa: string[];
  relatedSearches: string[];
  knowledgeGraph: unknown | null;
  /** Types de blocs SERP non organiques rencontrés (people_also_ask, video, …) */
  serpFeatures: string[];
  /** Nombre de résultats annoncés par le moteur (utile pour `site:`) */
  seResultsCount: number | null;
  provider: string;
  source: 'pool' | 'provider';
  fetchedAt: string;
  costUsd: number;
  fanoutRows: number;
}


/** TTL par classe d'usage (heures) */
const TTL_HOURS: Record<SerpUsageClass, number> = {
  position: 24,
  intent: 24 * 7,
  volume: 24 * 30,
};

/** Coût estimé d'un appel provider (USD), utilisé pour le compteur d'économies */
const PROVIDER_COST: Record<string, number> = {
  dataforseo: 0.0006,
  serper: 0.001,
  serpapi: 0.005,
};

const LOCATION_CODES: Record<string, number> = {
  fr: 2250,
  be: 2056,
  ch: 2756,
  ca: 2124,
  us: 2840,
  gb: 2826,
  es: 2724,
  it: 2380,
  de: 2276,
};

function admin(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

/** Normalisation de la requête : minuscules, accents conservés, espaces compactés */
export function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    // on conserve : . / _ - pour ne pas casser les opérateurs (site:, inurl:)
    .replace(/[^\p{L}\p{N}'\-:._/\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

interface PoolKey {
  query_normalized: string;
  engine: string;
  country: string;
  language: string;
  device: string;
  location: string;
}

function poolKey(query: string, opts: SerpOptions): PoolKey {
  return {
    query_normalized: normalizeQuery(query),
    engine: (opts.engine ?? 'google').toLowerCase(),
    country: (opts.country ?? 'fr').toLowerCase(),
    language: (opts.language ?? 'fr').toLowerCase(),
    device: opts.device ?? 'desktop',
    location: (opts.location ?? '').toLowerCase(),
  };
}

// ---------------------------------------------------------------- providers

export interface ProviderPayload {
  provider: string;
  organic: SerpOrganicResult[];
  paa: string[];
  relatedSearches: string[];
  knowledgeGraph: unknown | null;
  serpFeatures?: string[];
  seResultsCount?: number | null;
  raw: unknown;
}


async function fetchDataForSeo(key: PoolKey): Promise<ProviderPayload | null> {
  const login = Deno.env.get('DATAFORSEO_LOGIN');
  const password = Deno.env.get('DATAFORSEO_PASSWORD');
  if (!login || !password) return null;

  const body = [{
    keyword: key.query_normalized,
    location_code: LOCATION_CODES[key.country] ?? 2250,
    language_code: key.language,
    device: key.device,
    depth: 100,
  }];

  const resp = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${login}:${password}`),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) return null;

  const json = await resp.json();
  const taskResult = json?.tasks?.[0]?.result?.[0];
  const items = taskResult?.items ?? [];
  const organic: SerpOrganicResult[] = [];
  const paa: string[] = [];
  const related: string[] = [];
  const features = new Set<string>();

  for (const item of items) {
    if (item?.type === 'organic' && item.url) {
      organic.push({
        position: item.rank_absolute ?? organic.length + 1,
        url: item.url,
        domain: extractDomain(item.url),
        title: item.title ?? '',
        snippet: item.description ?? '',
      });
    } else {
      if (item?.type) features.add(String(item.type));
      if (item?.type === 'people_also_ask') {
        for (const q of item.items ?? []) if (q?.title) paa.push(q.title);
      } else if (item?.type === 'related_searches') {
        for (const q of item.items ?? []) {
          if (typeof q === 'string') related.push(q);
          else if (q?.title) related.push(q.title);
        }
      }
    }
  }

  return {
    provider: 'dataforseo',
    organic,
    paa,
    relatedSearches: related,
    knowledgeGraph: null,
    serpFeatures: Array.from(features),
    seResultsCount: typeof taskResult?.se_results_count === 'number' ? taskResult.se_results_count : null,
    raw: null,
  };
}


async function fetchSerper(key: PoolKey): Promise<ProviderPayload | null> {
  const apiKey = Deno.env.get('SERPER_API_KEY');
  if (!apiKey) return null;

  const resp = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: key.query_normalized,
      gl: key.country,
      hl: key.language,
      num: 100,
      ...(key.location ? { location: key.location } : {}),
    }),
  });
  if (!resp.ok) return null;

  const json = await resp.json();
  const organic: SerpOrganicResult[] = (json?.organic ?? []).map((r: Record<string, unknown>, i: number) => ({
    position: (r['position'] as number) ?? i + 1,
    url: String(r['link'] ?? ''),
    domain: extractDomain(String(r['link'] ?? '')),
    title: String(r['title'] ?? ''),
    snippet: String(r['snippet'] ?? ''),
  })).filter((r: SerpOrganicResult) => !!r.url);

  const features: string[] = [];
  if (json?.peopleAlsoAsk) features.push('people_also_ask');
  if (json?.knowledgeGraph) features.push('knowledge_graph');
  if (json?.topStories) features.push('top_stories');
  if (json?.videos) features.push('video');
  if (json?.images) features.push('images');

  return {
    provider: 'serper',
    organic,
    paa: (json?.peopleAlsoAsk ?? []).map((p: Record<string, unknown>) => String(p['question'] ?? '')).filter(Boolean),
    relatedSearches: (json?.relatedSearches ?? []).map((p: Record<string, unknown>) => String(p['query'] ?? '')).filter(Boolean),
    knowledgeGraph: json?.knowledgeGraph ?? null,
    serpFeatures: features,
    seResultsCount: typeof json?.searchInformation?.totalResults === 'string'
      ? Number(json.searchInformation.totalResults) || null
      : null,
    raw: null,
  };
}


async function fetchSerpApi(key: PoolKey): Promise<ProviderPayload | null> {
  const apiKey = Deno.env.get('SERPAPI_KEY');
  if (!apiKey) return null;

  const params = new URLSearchParams({
    api_key: apiKey,
    q: key.query_normalized,
    engine: 'google',
    gl: key.country,
    hl: key.language,
    num: '100',
    device: key.device,
  });
  if (key.location) params.set('location', key.location);

  const resp = await fetch(`https://serpapi.com/search.json?${params}`);
  if (!resp.ok) return null;

  const json = await resp.json();
  const organic: SerpOrganicResult[] = (json?.organic_results ?? []).map((r: Record<string, unknown>, i: number) => ({
    position: (r['position'] as number) ?? i + 1,
    url: String(r['link'] ?? ''),
    domain: extractDomain(String(r['link'] ?? '')),
    title: String(r['title'] ?? ''),
    snippet: String(r['snippet'] ?? ''),
  })).filter((r: SerpOrganicResult) => !!r.url);

  return {
    provider: 'serpapi',
    organic,
    paa: (json?.related_questions ?? []).map((p: Record<string, unknown>) => String(p['question'] ?? '')).filter(Boolean),
    relatedSearches: (json?.related_searches ?? []).map((p: Record<string, unknown>) => String(p['query'] ?? '')).filter(Boolean),
    knowledgeGraph: json?.knowledge_graph ?? null,
    raw: null,
  };
}

async function callProvider(key: PoolKey): Promise<ProviderPayload | null> {
  for (const fn of [fetchDataForSeo, fetchSerper, fetchSerpApi]) {
    try {
      const out = await fn(key);
      if (out && out.organic.length > 0) return out;
    } catch (e) {
      console.warn(`[serpPool] provider failed: ${(e as Error).message}`);
    }
  }
  return null;
}

// ----------------------------------------------------------------- fan-out

/**
 * Déploie une SERP achetée sur tous les domaines suivis présents dans le top 100 :
 * une requête payée renseigne jusqu'à 100 lignes de positions.
 */
export async function fanoutPositions(
  supabase: SupabaseClient,
  queryNormalized: string,
  organic: SerpOrganicResult[],
): Promise<number> {
  if (organic.length === 0) return 0;

  const { data: rows, error } = await supabase
    .from('keyword_universe')
    .select('id, domain, current_position, best_position')
    .eq('keyword', queryNormalized);

  if (error || !rows || rows.length === 0) return 0;

  const positionByDomain = new Map<string, number>();
  for (const r of organic) {
    if (r.domain && !positionByDomain.has(r.domain)) positionByDomain.set(r.domain, r.position);
  }

  let updated = 0;
  for (const row of rows) {
    const domain = String(row.domain ?? '').replace(/^www\./, '').toLowerCase();
    if (!domain) continue;
    const position = positionByDomain.get(domain) ?? null;
    if (position === null) continue;
    if (row.current_position === position) continue;

    const best = row.best_position === null || position < Number(row.best_position)
      ? position
      : Number(row.best_position);

    const { error: upErr } = await supabase
      .from('keyword_universe')
      .update({ current_position: position, best_position: best, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (!upErr) updated++;
  }
  return updated;
}

// ------------------------------------------------------------------ getSerp

export async function getSerp(query: string, opts: SerpOptions): Promise<SerpResult | null> {
  const supabase = admin();
  const key = poolKey(query, opts);
  if (!key.query_normalized) return null;

  const usageClass: SerpUsageClass = opts.usageClass ?? 'position';
  const nowIso = new Date().toISOString();

  // 1. hit pool
  if (!opts.forceRefresh) {
    const { data: hit } = await supabase
      .from('serp_pool')
      .select('*')
      .match(key)
      .gt('expires_at', nowIso)
      .maybeSingle();

    if (hit) {
      await supabase.from('serp_pool').update({ hit_count: (hit.hit_count ?? 0) + 1 }).eq('id', hit.id);
      await logHit(supabase, {
        serp_pool_id: hit.id,
        query_normalized: key.query_normalized,
        usage_class: usageClass,
        source: 'pool',
        provider: hit.provider,
        cost_usd: 0,
        saved_usd: PROVIDER_COST[hit.provider] ?? 0.001,
        fanout_rows: 0,
      }, opts);

      return {
        queryNormalized: key.query_normalized,
        organic: (hit.organic_results ?? []) as SerpOrganicResult[],
        paa: (hit.paa ?? []) as string[],
        relatedSearches: (hit.related_searches ?? []) as string[],
        knowledgeGraph: hit.knowledge_graph ?? null,
        provider: hit.provider,
        source: 'pool',
        fetchedAt: hit.fetched_at,
        costUsd: 0,
        fanoutRows: 0,
      };
    }
  }

  if (opts.poolOnly) return null;

  // 2. appel provider
  const payload = await callProvider(key);
  if (!payload) return null;

  const cost = PROVIDER_COST[payload.provider] ?? 0.001;
  const expiresAt = new Date(Date.now() + TTL_HOURS[usageClass] * 3600_000).toISOString();

  const { data: saved } = await supabase
    .from('serp_pool')
    .upsert({
      ...key,
      query_raw: query,
      provider: payload.provider,
      usage_class: usageClass,
      organic_results: payload.organic,
      paa: payload.paa,
      related_searches: payload.relatedSearches,
      knowledge_graph: payload.knowledgeGraph,
      result_count: payload.organic.length,
      cost_usd: cost,
      fetched_at: new Date().toISOString(),
      expires_at: expiresAt,
      hit_count: 0,
    }, { onConflict: 'query_normalized,engine,country,language,device,location' })
    .select('id')
    .maybeSingle();

  // 3. fan-out des positions vers tous les domaines suivis
  let fanoutRows = 0;
  if (!opts.skipFanout) {
    try {
      fanoutRows = await fanoutPositions(supabase, key.query_normalized, payload.organic);
    } catch (e) {
      console.warn(`[serpPool] fanout failed: ${(e as Error).message}`);
    }
  }

  await logHit(supabase, {
    serp_pool_id: saved?.id ?? null,
    query_normalized: key.query_normalized,
    usage_class: usageClass,
    source: 'provider',
    provider: payload.provider,
    cost_usd: cost,
    saved_usd: 0,
    fanout_rows: fanoutRows,
  }, opts);

  return {
    queryNormalized: key.query_normalized,
    organic: payload.organic,
    paa: payload.paa,
    relatedSearches: payload.relatedSearches,
    knowledgeGraph: payload.knowledgeGraph,
    provider: payload.provider,
    source: 'provider',
    fetchedAt: new Date().toISOString(),
    costUsd: cost,
    fanoutRows,
  };
}

/** Lecture par lot : sert d'abord le pool, n'achète que les requêtes manquantes */
export async function getSerpBatch(
  queries: string[],
  opts: SerpOptions,
): Promise<Map<string, SerpResult>> {
  const out = new Map<string, SerpResult>();
  const unique = [...new Set(queries.map(normalizeQuery).filter(Boolean))];
  for (const q of unique) {
    const res = await getSerp(q, opts);
    if (res) out.set(q, res);
  }
  return out;
}

async function logHit(
  supabase: SupabaseClient,
  entry: Record<string, unknown>,
  opts: SerpOptions,
): Promise<void> {
  try {
    await supabase.from('serp_pool_hits').insert({
      ...entry,
      caller: opts.caller,
      user_id: opts.userId ?? null,
      tracked_site_id: opts.trackedSiteId ?? null,
    });
  } catch (e) {
    console.warn(`[serpPool] hit log failed: ${(e as Error).message}`);
  }
}

/** Compteur d'économies (admin) */
export async function getPoolSavings(days = 30): Promise<{
  poolHits: number;
  providerCalls: number;
  costUsd: number;
  savedUsd: number;
  fanoutRows: number;
}> {
  const supabase = admin();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await supabase
    .from('serp_pool_hits')
    .select('source, cost_usd, saved_usd, fanout_rows')
    .gte('created_at', since);

  const rows = data ?? [];
  return {
    poolHits: rows.filter((r) => r.source === 'pool').length,
    providerCalls: rows.filter((r) => r.source === 'provider').length,
    costUsd: rows.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0),
    savedUsd: rows.reduce((s, r) => s + Number(r.saved_usd ?? 0), 0),
    fanoutRows: rows.reduce((s, r) => s + Number(r.fanout_rows ?? 0), 0),
  };
}
