/**
 * keywordVolumeSource.ts — Résolution mutualisée des volumes de recherche.
 *
 * Ordre de résolution (du gratuit vers le payant) :
 *   1. `keyword_volume_pool` — cache global partagé entre tous les users (TTL 30 j)
 *   2. Google Keyword Planner (Google Ads API) — gratuit, requiert une connexion Ads
 *   3. DataForSEO `keywords_data/google_ads/search_volume` — payant, dernier recours
 *
 * Tout résultat obtenu en 2 ou 3 est écrit dans le pool : un mot-clé n'est donc
 * jamais payé deux fois, quel que soit l'utilisateur qui le demande.
 */

import { resolveAdsCredentials, fetchPlannerMetrics, plannerDifficulty, dedupe, chunk } from './keywordPlanner.ts';

export interface VolumeRecord {
  keyword: string;
  search_volume: number;
  difficulty: number | null;
  competition: string | null;
  cpc_usd: number | null;
  source: 'pool' | 'keyword_planner' | 'dataforseo';
}

export interface VolumeResult {
  volumes: Map<string, VolumeRecord>;
  stats: {
    requested: number;
    from_pool: number;
    from_planner: number;
    from_dataforseo: number;
    unresolved: number;
    paid_calls: number;
  };
}

const POOL_TTL_DAYS = 30;

export async function getKeywordVolumes(
  supabase: any,
  userId: string,
  keywords: string[],
  opts: { geo?: string; language?: string; allowPaid?: boolean } = {},
): Promise<VolumeResult> {
  const geo = (opts.geo || 'fr').toLowerCase();
  const language = (opts.language || 'fr').toLowerCase();
  const allowPaid = opts.allowPaid !== false;

  const wanted = dedupe(keywords);
  const volumes = new Map<string, VolumeRecord>();
  const stats = { requested: wanted.length, from_pool: 0, from_planner: 0, from_dataforseo: 0, unresolved: 0, paid_calls: 0 };
  if (wanted.length === 0) return { volumes, stats };

  // ─── 1. Pool mutualisé ───────────────────────────────────────────
  const freshAfter = new Date(Date.now() - POOL_TTL_DAYS * 86_400_000).toISOString();
  for (const batch of chunk(wanted, 500)) {
    const { data } = await supabase
      .from('keyword_volume_pool')
      .select('keyword, search_volume, difficulty, competition, cpc_usd')
      .eq('geo', geo)
      .eq('language', language)
      .gte('fetched_at', freshAfter)
      .in('keyword', batch);
    for (const r of data || []) {
      volumes.set(r.keyword, {
        keyword: r.keyword,
        search_volume: r.search_volume ?? 0,
        difficulty: r.difficulty,
        competition: r.competition,
        cpc_usd: r.cpc_usd,
        source: 'pool',
      });
      stats.from_pool++;
    }
  }

  let missing = wanted.filter((k) => !volumes.has(k));
  if (missing.length === 0) return { volumes, stats };

  // ─── 2. Google Keyword Planner (gratuit) ─────────────────────────
  const creds = await resolveAdsCredentials(supabase, userId);
  if (creds) {
    const metrics = await fetchPlannerMetrics(creds, missing, { geo, language });
    const rows: any[] = [];
    for (const [kw, m] of metrics) {
      const rec: VolumeRecord = {
        keyword: kw,
        search_volume: m.avg_monthly_searches,
        difficulty: plannerDifficulty(m),
        competition: m.competition,
        cpc_usd: m.high_top_of_page_bid_micros != null ? m.high_top_of_page_bid_micros / 1_000_000 : null,
        source: 'keyword_planner',
      };
      volumes.set(kw, rec);
      stats.from_planner++;
      rows.push(poolRow(rec, geo, language, 'keyword_planner'));
    }
    await writePool(supabase, rows);
    missing = missing.filter((k) => !volumes.has(k));
  }

  if (missing.length === 0 || !allowPaid) {
    stats.unresolved = missing.length;
    return { volumes, stats };
  }

  // ─── 3. DataForSEO (payant, dernier recours) ─────────────────────
  const login = Deno.env.get('DATAFORSEO_LOGIN');
  const password = Deno.env.get('DATAFORSEO_PASSWORD');
  if (login && password) {
    const auth = btoa(`${login}:${password}`);
    const locationCode = DFS_LOCATIONS[geo] ?? 2250;
    for (const batch of chunk(missing, 700)) {
      try {
        const resp = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live', {
          method: 'POST',
          headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
          body: JSON.stringify([{ keywords: batch, location_code: locationCode, language_code: language }]),
        });
        stats.paid_calls++;
        if (!resp.ok) continue;
        const json = await resp.json();
        const items = json?.tasks?.[0]?.result || [];
        const rows: any[] = [];
        for (const it of items) {
          const kw = (it.keyword || '').toLowerCase();
          if (!kw) continue;
          const rec: VolumeRecord = {
            keyword: kw,
            search_volume: it.search_volume ?? 0,
            difficulty: it.competition_index ?? (it.competition != null ? Math.round(it.competition * 100) : null),
            competition: typeof it.competition === 'string' ? it.competition : null,
            cpc_usd: it.cpc ?? null,
            source: 'dataforseo',
          };
          volumes.set(kw, rec);
          stats.from_dataforseo++;
          rows.push(poolRow(rec, geo, language, 'dataforseo'));
        }
        await writePool(supabase, rows);
      } catch (e) {
        console.error('[keywordVolumeSource] DataForSEO error', e);
      }
    }
  }

  stats.unresolved = wanted.filter((k) => !volumes.has(k)).length;
  return { volumes, stats };
}

const DFS_LOCATIONS: Record<string, number> = {
  fr: 2250, be: 2056, ch: 2756, ca: 2124, lu: 2442,
  de: 2276, gb: 2826, us: 2840, es: 2724, it: 2380,
};

function poolRow(rec: VolumeRecord, geo: string, language: string, source: string) {
  return {
    keyword: rec.keyword,
    geo,
    language,
    search_volume: rec.search_volume,
    difficulty: rec.difficulty,
    competition: rec.competition,
    cpc_usd: rec.cpc_usd,
    source,
    fetched_at: new Date().toISOString(),
  };
}

async function writePool(supabase: any, rows: any[]) {
  if (rows.length === 0) return;
  for (const batch of chunk(rows, 500)) {
    const { error } = await supabase
      .from('keyword_volume_pool')
      .upsert(batch, { onConflict: 'keyword,geo,language' });
    if (error) console.error('[keywordVolumeSource] pool upsert error', error.message);
  }
}
