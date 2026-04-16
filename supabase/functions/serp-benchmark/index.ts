import { getServiceClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * serp-benchmark — Multi-provider SERP position benchmark
 *
 * Calls up to 4 SERP providers in parallel (DataForSEO, SerpApi, Serper, Bright Data)
 * and computes weighted average positions with single-hit penalty.
 *
 * Actions:
 *   - benchmark: Run a new benchmark query
 *   - list: Get previous benchmark results
 */

interface ProviderResult {
  provider: string;
  results: { url: string; position: number; title?: string; domain?: string }[];
  error?: string;
}

// ── Provider fetchers ──

async function fetchDataForSEO(query: string, location: string, language: string, country: string): Promise<ProviderResult> {
  const login = Deno.env.get('DATAFORSEO_LOGIN');
  const password = Deno.env.get('DATAFORSEO_PASSWORD');
  if (!login || !password) return { provider: 'DataForSEO', results: [], error: 'Not configured' };

  try {
    const resp = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${login}:${password}`),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{
        keyword: query,
        location_name: location,
        language_code: language,
        device: 'desktop',
        depth: 30,
      }]),
    });

    if (!resp.ok) return { provider: 'DataForSEO', results: [], error: `HTTP ${resp.status}` };
    const data = await resp.json();
    const items = data?.tasks?.[0]?.result?.[0]?.items || [];
    const results = items
      .filter((i: any) => i.type === 'organic')
      .map((i: any, idx: number) => ({
        url: i.url || '',
        position: i.rank_absolute || idx + 1,
        title: i.title || '',
        domain: i.domain || '',
      }));
    return { provider: 'DataForSEO', results };
  } catch (e: any) {
    return { provider: 'DataForSEO', results: [], error: e.message };
  }
}

async function fetchSerpApi(query: string, location: string, language: string, country: string): Promise<ProviderResult> {
  const key = Deno.env.get('SERPAPI_KEY');
  if (!key) return { provider: 'SerpApi', results: [], error: 'Not configured' };

  try {
    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('api_key', key);
    url.searchParams.set('engine', 'google');
    url.searchParams.set('q', query);
    url.searchParams.set('location', location);
    url.searchParams.set('hl', language);
    url.searchParams.set('gl', country);
    url.searchParams.set('num', '30');

    const resp = await fetch(url.toString());
    if (!resp.ok) return { provider: 'SerpApi', results: [], error: `HTTP ${resp.status}` };
    const data = await resp.json();
    const organic = data.organic_results || [];
    return {
      provider: 'SerpApi',
      results: organic.map((r: any) => ({
        url: r.link || '',
        position: r.position || 0,
        title: r.title || '',
        domain: r.displayed_link?.replace(/https?:\/\//, '').split('/')[0] || '',
      })),
    };
  } catch (e: any) {
    return { provider: 'SerpApi', results: [], error: e.message };
  }
}

async function fetchSerper(query: string, country: string, language: string): Promise<ProviderResult> {
  const key = Deno.env.get('SERPER_API_KEY');
  if (!key) return { provider: 'Serper', results: [], error: 'Not configured' };

  try {
    const resp = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        gl: country,
        hl: language,
        num: 30,
      }),
    });

    if (!resp.ok) return { provider: 'Serper', results: [], error: `HTTP ${resp.status}` };
    const data = await resp.json();
    const organic = data.organic || [];
    return {
      provider: 'Serper',
      results: organic.map((r: any, idx: number) => ({
        url: r.link || '',
        position: r.position || idx + 1,
        title: r.title || '',
        domain: r.domain || new URL(r.link || 'https://unknown').hostname,
      })),
    };
  } catch (e: any) {
    return { provider: 'Serper', results: [], error: e.message };
  }
}

async function fetchBrightData(query: string, country: string, language: string): Promise<ProviderResult> {
  const rawKey = Deno.env.get('BRIGHTDATA_API_KEY');
  // Strip any non-ASCII / whitespace characters that break ByteString validation
  const key = rawKey ? rawKey.replace(/[^\x20-\x7E]/g, '').trim() : '';
  if (!key) return { provider: 'Bright Data', results: [], error: 'Not configured' };

  try {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&gl=${country}&hl=${language}&num=30`;
    const resp = await fetch('https://api.brightdata.com/request', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        zone: 'serp_api1crawlers',
        url: searchUrl,
        format: 'raw',
      }),
    });

    if (!resp.ok) return { provider: 'Bright Data', results: [], error: `HTTP ${resp.status}` };
    const data = await resp.json();
    const organic = data.organic || [];
    return {
      provider: 'Bright Data',
      results: organic.map((r: any, idx: number) => ({
        url: r.link || r.url || '',
        position: r.rank || r.position || idx + 1,
        title: r.title || '',
        domain: r.display_link || r.domain || '',
      })),
    };
  } catch (e: any) {
    return { provider: 'Bright Data', results: [], error: e.message };
  }
}

// ── Averaging logic ──

interface AveragedSite {
  rank: number;
  url: string;
  domain: string;
  title: string;
  positions: Record<string, number | null>;
  average: number;
}

function computeAveragedResults(
  providerResults: ProviderResult[],
  singleHitPenalty: number,
): AveragedSite[] {
  // Collect all URLs across providers, normalized
  const urlMap = new Map<string, {
    domain: string;
    title: string;
    positions: Record<string, number>;
  }>();

  for (const pr of providerResults) {
    if (pr.error) continue;
    for (const r of pr.results) {
      const normalized = r.url.replace(/\/+$/, '').toLowerCase();
      if (!urlMap.has(normalized)) {
        urlMap.set(normalized, {
          domain: r.domain || new URL(r.url || 'https://unknown').hostname,
          title: r.title || '',
          positions: {},
        });
      }
      urlMap.get(normalized)!.positions[pr.provider] = r.position;
    }
  }

  const activeProviders = providerResults.filter(p => !p.error).map(p => p.provider);
  const numProviders = activeProviders.length;
  if (numProviders === 0) return [];

  const sites: AveragedSite[] = [];
  for (const [url, data] of urlMap) {
    const positionsMap: Record<string, number | null> = {};
    let sum = 0;
    let count = 0;

    for (const provider of activeProviders) {
      const pos = data.positions[provider];
      if (pos !== undefined) {
        positionsMap[provider] = pos;
        sum += pos;
        count++;
      } else {
        positionsMap[provider] = null;
      }
    }

    // Apply single-hit penalty: if only found by 1 provider, add penalty
    let average: number;
    if (count === 1 && numProviders > 1) {
      average = sum + singleHitPenalty;
    } else if (count > 0) {
      average = sum / count;
    } else {
      average = 999;
    }

    sites.push({
      rank: 0,
      url,
      domain: data.domain,
      title: data.title,
      positions: positionsMap,
      average: parseFloat(average.toFixed(1)),
    });
  }

  // Sort by average position
  sites.sort((a, b) => a.average - b.average);
  sites.forEach((s, i) => { s.rank = i + 1; });

  return sites;
}

// ── Main handler ──

Deno.serve(handleRequest(async (req) => {
  const supabase = getServiceClient();
  const authHeader = req.headers.get('Authorization');

  // Try to authenticate — allow anonymous for 'benchmark' action (lead magnet)
  let user: { id: string } | null = null;
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: u }, error: authErr } = await supabase.auth.getUser(token);
    if (!authErr && u) user = u;
  }

  const body = await req.json();
  const { action } = body;

  // Actions that require auth
  if ((action === 'list' || action === 'get') && !user) {
    return jsonError('Unauthorized', 401);
  }

  if (action === 'benchmark') {
    const {
      query,
      tracked_site_id,
      target_domain,
      location = 'France',
      language = 'fr',
      country = 'fr',
      single_hit_penalty = 20,
      providers = ['DataForSEO', 'SerpApi', 'Serper'],
    } = body;

    if (!query) return jsonError('query required', 400);

    // Call selected providers in parallel
    const fetchers: Promise<ProviderResult>[] = [];
    for (const p of providers) {
      switch (p) {
        case 'DataForSEO': fetchers.push(fetchDataForSEO(query, location, language, country)); break;
        case 'SerpApi': fetchers.push(fetchSerpApi(query, location, language, country)); break;
        case 'Serper': fetchers.push(fetchSerper(query, country, language)); break;
        case 'Bright Data': fetchers.push(fetchBrightData(query, country, language)); break;
      }
    }

    const providerResults = await Promise.all(fetchers);
    const averaged = computeAveragedResults(providerResults, single_hit_penalty);

    // Store results only for authenticated users
    let insertedId: string | undefined;
    if (user) {
      const { data: inserted, error: insertErr } = await supabase
        .from('serp_benchmark_results')
        .insert({
          user_id: user.id,
          tracked_site_id: tracked_site_id || null,
          query_text: query,
          target_domain: target_domain || null,
          location,
          language,
          country,
          providers_used: providerResults.filter(p => !p.error).map(p => p.provider),
          providers_data: Object.fromEntries(providerResults.map(p => [p.provider, { results: p.results, error: p.error }])),
          averaged_results: averaged,
          single_hit_penalty,
          total_sites_found: averaged.length,
        })
        .select('id')
        .single();

      if (insertErr) {
        console.error('[serp-benchmark] insert error:', insertErr.message);
      }
      insertedId = inserted?.id;

      // ── Option 3: Enrich keyword_universe + workbench drift detection ──
      if (tracked_site_id && target_domain) {
        const domainNorm = target_domain.replace(/^www\./, '').toLowerCase();
        // Find target domain position in averaged results
        const targetEntry = averaged.find(a => {
          const d = (a.domain || '').replace(/^www\./, '').toLowerCase();
          return d === domainNorm || d.startsWith(domainNorm);
        });
        const realPosition = targetEntry ? targetEntry.average : null;

        // 1. Enrich keyword_universe with real position
        const { error: kwErr } = await supabase
          .from('keyword_universe')
          .update({
            current_position: realPosition ? Math.round(realPosition) : null,
            updated_at: new Date().toISOString(),
          })
          .eq('keyword', query)
          .eq('tracked_site_id', tracked_site_id)
          .eq('user_id', user.id);

        if (kwErr) {
          console.error('[serp-benchmark] keyword_universe update error:', kwErr.message);
        }

        // 2. Check for SERP drift → create workbench finding if anomaly
        const { data: kwData } = await supabase
          .from('keyword_universe')
          .select('best_position, opportunity_score, is_quick_win')
          .eq('keyword', query)
          .eq('tracked_site_id', tracked_site_id)
          .eq('user_id', user.id)
          .single();

        if (kwData && realPosition !== null) {
          const expectedPos = kwData.best_position || 30;
          const drift = realPosition - expectedPos;

          // Alert if real position is 10+ positions worse than expected
          if (drift >= 10) {
            const { error: wbErr } = await supabase
              .from('architect_workbench')
              .insert({
                domain: target_domain,
                tracked_site_id,
                user_id: user.id,
                source_type: 'serp_benchmark',
                source_function: 'serp-benchmark',
                source_record_id: `serp_drift_${target_domain}_${query.replace(/\s+/g, '_')}`,
                finding_category: 'serp_analysis',
                severity: drift >= 20 ? 'critical' : 'high',
                title: `Dérive SERP: "${query}" — position réelle ${Math.round(realPosition)} vs attendue ${expectedPos}`,
                description: `Le mot-clé "${query}" a perdu ${Math.round(drift)} positions par rapport à sa meilleure position connue. Position moyenne multi-providers: ${realPosition.toFixed(1)}.${kwData.is_quick_win ? ' Ce mot-clé est identifié comme Quick Win.' : ''}`,
                target_url: `https://${target_domain}`,
                action_type: 'both',
                target_operation: 'replace',
                payload: {
                  keyword: query,
                  real_position: realPosition,
                  expected_position: expectedPos,
                  drift,
                  opportunity_score: kwData.opportunity_score,
                  is_quick_win: kwData.is_quick_win,
                  providers_used: providerResults.filter(p => !p.error).map(p => p.provider),
                  benchmark_id: insertedId,
                },
              });

            if (wbErr) {
              console.error('[serp-benchmark] workbench insert error:', wbErr.message);
            } else {
              console.log(`[serp-benchmark] SERP drift alert created for "${query}" (drift: +${Math.round(drift)})`);
            }
          }
        }
      }
    }

    return jsonOk({
      id: insertedId,
      providers: providerResults.map(p => ({ provider: p.provider, count: p.results.length, error: p.error })),
      averaged_results: averaged.slice(0, 50),
      total_sites: averaged.length,
      query,
      target_domain,
    });
  }

  if (action === 'list') {
    const { tracked_site_id, limit = 20 } = body;
    let q = supabase
      .from('serp_benchmark_results')
      .select('id, query_text, target_domain, location, providers_used, total_sites_found, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (tracked_site_id) q = q.eq('tracked_site_id', tracked_site_id);
    const { data, error } = await q;
    if (error) return jsonError(error.message, 500);
    return jsonOk({ data });
  }

  if (action === 'get') {
    const { id } = body;
    if (!id) return jsonError('id required', 400);
    const { data, error } = await supabase
      .from('serp_benchmark_results')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    if (error) return jsonError(error.message, 500);
    return jsonOk(data);
  }

  return jsonError(`Unknown action: ${action}`, 400);
}, 'serp-benchmark'));
