/**
 * geo-kpis-aggregate
 * Calcule les 7 KPIs GEO + 5 cartes pour le top 10 des pages stratégiques
 * d'un site donné. Cache hebdomadaire dans geo_kpi_snapshots.
 *
 * Sources :
 *  - geo_visibility_snapshots → score, citation, sentiment, recommandation, deltas
 *  - architect_workbench → quotability, chunkability, AEO, position zéro, fan-out
 *  - cluster_definitions → couverture fan-out par cluster
 *  - competitor_tracked_urls → part de voix
 *  - llm_depth_conversations → URL hallucination rate
 *
 * NB : ai_requests_per_100_visits et ai_referral_ctr restent à null tant que
 * le bouclier Cloudflare (Sprint 2) ne fournit pas la donnée. UI affichera "—".
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  tracked_site_id: string;
  force_refresh?: boolean;
}

const CACHE_TTL_HOURS = 1;

function startOfIsoWeek(d: Date): string {
  const x = new Date(d);
  const day = x.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  x.setUTCDate(x.getUTCDate() + diff);
  x.setUTCHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Auth — accepte user JWT OU service role (cron interne)
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const isServiceCall = token === SUPABASE_SERVICE_ROLE_KEY;

    let callerUserId: string | null = null;
    if (!isServiceCall) {
      const { data: userData } = await supabase.auth.getUser(token);
      if (!userData?.user) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      callerUserId = userData.user.id;
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    if (!body.tracked_site_id) {
      return new Response(JSON.stringify({ error: 'tracked_site_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Vérifier ownership du site (sauf service call)
    const { data: site } = await supabase
      .from('tracked_sites')
      .select('id, domain, user_id')
      .eq('id', body.tracked_site_id)
      .maybeSingle();

    if (!site || (!isServiceCall && site.user_id !== callerUserId)) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const weekStart = startOfIsoWeek(new Date());

    // Cache lookup
    if (!body.force_refresh) {
      const { data: cached } = await supabase
        .from('geo_kpi_snapshots')
        .select('*')
        .eq('tracked_site_id', body.tracked_site_id)
        .eq('week_start_date', weekStart)
        .maybeSingle();

      if (cached) {
        const ageH = (Date.now() - new Date(cached.computed_at).getTime()) / 36e5;
        if (ageH < CACHE_TTL_HOURS) {
          return new Response(JSON.stringify({ ...cached, cached: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // 1. geo_visibility_snapshots — dernier snapshot + baseline
    const { data: geoSnaps } = await supabase
      .from('geo_visibility_snapshots')
      .select('overall_score, citation_rate, avg_sentiment_score, recommendation_rate, delta_overall_score, delta_citation_rate, provider_scores, measurement_phase, measured_at')
      .eq('tracked_site_id', body.tracked_site_id)
      .order('measured_at', { ascending: false })
      .limit(10);

    const latest = geoSnaps?.[0];
    const geo_overall_score = toNumber(latest?.overall_score);
    const geo_overall_delta = toNumber(latest?.delta_overall_score);
    const citation_rate = toNumber(latest?.citation_rate);
    const citation_rate_delta = toNumber(latest?.delta_citation_rate);
    const avg_sentiment = toNumber(latest?.avg_sentiment_score);
    const recommendation_rate = toNumber(latest?.recommendation_rate);

    // Bot traffic mix (depuis provider_scores du dernier snapshot)
    const bot_traffic_mix: Record<string, number> = {};
    if (Array.isArray(latest?.provider_scores)) {
      for (const p of latest.provider_scores as Array<{ provider?: string; cited?: boolean }>) {
        if (p?.cited && p.provider) {
          bot_traffic_mix[p.provider] = (bot_traffic_mix[p.provider] || 0) + 1;
        }
      }
    }

    // 2. architect_workbench → Quotability/Chunkability/AEO + Position Zéro + Fan-Out
    const { data: findings } = await supabase
      .from('architect_workbench')
      .select('finding_category, payload, target_url, severity')
      .eq('tracked_site_id', body.tracked_site_id)
      .in('finding_category', ['content_gap_fanout', 'structure_rag', 'quotability_low', 'aeo_score', 'position_zero'])
      .gte('created_at', new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
      .limit(500);

    const quotabilityScores: number[] = [];
    const chunkabilityScores: number[] = [];
    const aeoScores: number[] = [];
    let position_zero_eligible_pages = 0;
    const fanoutGapsByCluster = new Map<string, { gaps: number; volume: number }>();

    for (const f of findings || []) {
      const p = (f.payload as Record<string, unknown>) || {};
      if (f.finding_category === 'quotability_low' && typeof p.score === 'number') quotabilityScores.push(p.score);
      if (f.finding_category === 'structure_rag' && typeof p.chunkability_score === 'number') chunkabilityScores.push(p.chunkability_score);
      if (f.finding_category === 'aeo_score' && typeof p.score === 'number') aeoScores.push(p.score);
      if (f.finding_category === 'position_zero' && p.eligible === true) position_zero_eligible_pages++;
      if (f.finding_category === 'content_gap_fanout') {
        const cluster = (p.cluster as string) || 'autres';
        const vol = typeof p.search_volume === 'number' ? p.search_volume : 0;
        const cur = fanoutGapsByCluster.get(cluster) || { gaps: 0, volume: 0 };
        cur.gaps++;
        cur.volume += vol;
        fanoutGapsByCluster.set(cluster, cur);
      }
    }

    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    const quotability_avg = avg(quotabilityScores);
    const chunkability_avg = avg(chunkabilityScores);
    const aeo_avg = avg(aeoScores);

    // 3. cluster_definitions — fan-out coverage
    const { data: clusters } = await supabase
      .from('cluster_definitions')
      .select('id, cluster_name, ring, fanout_coverage_pct, maturity_pct')
      .eq('tracked_site_id', body.tracked_site_id);

    const cluster_coverage = (clusters || []).map((c) => ({
      id: c.id,
      name: c.cluster_name,
      ring: c.ring,
      coverage: toNumber(c.fanout_coverage_pct) ?? 0,
      maturity: toNumber(c.maturity_pct) ?? 0,
      gaps: fanoutGapsByCluster.get(c.cluster_name)?.gaps ?? 0,
      gaps_volume: fanoutGapsByCluster.get(c.cluster_name)?.volume ?? 0,
    }));
    const fanout_coverage_avg = cluster_coverage.length
      ? cluster_coverage.reduce((s, c) => s + c.coverage, 0) / cluster_coverage.length
      : null;

    // 4. Part de voix vs concurrents
    const { data: competitors } = await supabase
      .from('competitor_tracked_urls')
      .select('competitor_domain, geo_score')
      .eq('tracked_site_id', body.tracked_site_id);

    let share_of_voice: number | null = null;
    if (competitors && competitors.length && geo_overall_score != null) {
      const totalScore = competitors.reduce((s, c) => s + (toNumber(c.geo_score) ?? 0), geo_overall_score);
      share_of_voice = totalScore > 0 ? (geo_overall_score / totalScore) * 100 : null;
    }

    // 5. URL Hallucination rate (croise URLs citées par LLMs vs domaine du site)
    const { data: convs } = await supabase
      .from('llm_depth_conversations')
      .select('cited_urls, valid_urls')
      .eq('tracked_site_id', body.tracked_site_id)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
      .limit(200);

    let citedTotal = 0;
    let validTotal = 0;
    for (const c of convs || []) {
      const cited = Array.isArray(c.cited_urls) ? c.cited_urls.length : 0;
      const valid = Array.isArray(c.valid_urls) ? c.valid_urls.length : cited;
      citedTotal += cited;
      validTotal += valid;
    }
    const url_hallucination_rate = citedTotal > 0 ? ((citedTotal - validTotal) / citedTotal) * 100 : null;

    // 6. Sample pages stratégiques (top 10 par GSC clicks si dispo)
    const { data: gsc } = await supabase
      .from('gsc_page_metrics')
      .select('page, clicks, impressions, ctr, position')
      .eq('tracked_site_id', body.tracked_site_id)
      .order('clicks', { ascending: false })
      .limit(10);

    const sampled_pages = (gsc || []).map((g) => ({
      url: g.page,
      clicks: g.clicks,
      impressions: g.impressions,
      ctr: g.ctr,
      position: g.position,
    }));

    // KPIs en attente du bouclier Cloudflare (Sprint 2)
    const ai_requests_per_100_visits = null;
    const ai_referral_ctr = null;

    const snapshot = {
      tracked_site_id: body.tracked_site_id,
      user_id: site.user_id,
      domain: site.domain,
      week_start_date: weekStart,
      geo_overall_score,
      geo_overall_delta,
      citation_rate,
      citation_rate_delta,
      avg_sentiment,
      recommendation_rate,
      share_of_voice,
      ai_requests_per_100_visits,
      url_hallucination_rate,
      ai_referral_ctr,
      quotability_avg,
      chunkability_avg,
      aeo_avg,
      position_zero_eligible_pages,
      fanout_coverage_avg,
      bot_traffic_mix,
      cluster_coverage,
      sampled_pages,
      raw_data: {
        snaps_count: geoSnaps?.length || 0,
        findings_count: findings?.length || 0,
        competitors_count: competitors?.length || 0,
        conversations_count: convs?.length || 0,
        last_measured_at: latest?.measured_at,
      },
      computed_at: new Date().toISOString(),
    };

    // Upsert cache
    const { error: upsertErr } = await supabase
      .from('geo_kpi_snapshots')
      .upsert(snapshot, { onConflict: 'tracked_site_id,week_start_date' });

    if (upsertErr) console.error('upsert error', upsertErr);

    return new Response(JSON.stringify({ ...snapshot, cached: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('geo-kpis-aggregate error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'unknown' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
