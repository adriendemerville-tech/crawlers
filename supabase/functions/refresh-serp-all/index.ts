import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { trackPaidApiCall } from '../_shared/tokenTracker.ts'

/**
 * refresh-serp-all
 * 
 * Weekly cron job: refreshes SERP KPIs + GSC history + backlink snapshots
 * for all tracked sites. Called by pg_cron every Monday at 06:00 UTC.
 * 
 * Collects 3 sources simultaneously, aligned on the same week_start_date
 * to eliminate temporal bias when cross-referencing data.
 */

// ─── GSC token refresh (reused from auto-measure-predictions) ───
async function getGscAccessToken(supabase: any, userId: string): Promise<string | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('gsc_access_token, gsc_refresh_token, gsc_token_expiry')
    .eq('user_id', userId)
    .single()

  if (!profile?.gsc_access_token) return null

  let accessToken = profile.gsc_access_token

  if (profile.gsc_token_expiry && new Date(profile.gsc_token_expiry) < new Date()) {
    if (!profile.gsc_refresh_token) return null
    const clientId = Deno.env.get('GOOGLE_GSC_CLIENT_ID')!
    const clientSecret = Deno.env.get('GOOGLE_GSC_CLIENT_SECRET')!

    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: profile.gsc_refresh_token,
        grant_type: 'refresh_token',
      }),
    })
    if (!resp.ok) return null
    const data = await resp.json()
    accessToken = data.access_token
    await supabase.from('profiles').update({
      gsc_access_token: accessToken,
      gsc_token_expiry: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
    }).eq('user_id', userId)
  }

  return accessToken
}

// ─── GSC: Fetch aggregated metrics for last 7 days ───
async function fetchGscWeekly(accessToken: string, domain: string): Promise<{
  clicks: number; impressions: number; ctr: number; avg_position: number; top_queries: any[]
} | null> {
  try {
    // Find matching GSC property
    const sitesResp = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })
    if (!sitesResp.ok) return null

    const { siteEntry = [] } = await sitesResp.json()
    const bare = domain.replace(/^www\./, '').toLowerCase()
    const match = siteEntry.find((s: any) => {
      const su = s.siteUrl.toLowerCase()
      if (su === `sc-domain:${bare}`) return true
      return su.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '') === bare
    })
    if (!match) return null

    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Aggregated metrics
    const aggResp = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(match.siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          dimensions: [],
          rowLimit: 1,
        }),
      }
    )
    if (!aggResp.ok) return null
    const aggData = await aggResp.json()
    const agg = aggData.rows?.[0]

    // Top queries for training context
    const queryResp = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(match.siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          dimensions: ['query'],
          rowLimit: 30,
        }),
      }
    )

    let topQueries: any[] = []
    if (queryResp.ok) {
      const qData = await queryResp.json()
      topQueries = (qData.rows || []).map((r: any) => ({
        query: r.keys?.[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: Math.round((r.ctr || 0) * 10000) / 100,
        position: Math.round((r.position || 0) * 10) / 10,
      }))
    }

    return {
      clicks: Math.round(agg?.clicks || 0),
      impressions: Math.round(agg?.impressions || 0),
      ctr: Math.round((agg?.ctr || 0) * 10000) / 100,
      avg_position: Math.round((agg?.position || 0) * 10) / 10,
      top_queries: topQueries,
    }
  } catch (err) {
    console.error(`[refresh-serp-all] GSC fetch error for ${domain}:`, err)
    return null
  }
}

// ─── Backlinks: DataForSEO /backlinks/summary/live ───
async function fetchBacklinks(domain: string, authHeader: string): Promise<{
  domain_rank: number | null; referring_domains: number; backlinks_total: number;
  referring_domains_new: number; referring_domains_lost: number; anchor_distribution: any[]
} | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)

    const resp = await fetch('https://api.dataforseo.com/v3/backlinks/summary/live', {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify([{ target: domain, internal_list_limit: 0, backlinks_filters: [] }]),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!resp.ok) {
      console.error(`[refresh-serp-all] Backlinks API error for ${domain}: ${resp.status}`)
      return null
    }

    const data = await resp.json()
    const result = data?.tasks?.[0]?.result?.[0]
    if (!result) return null

    trackPaidApiCall('refresh-serp-all', 'dataforseo', 'backlinks/summary/live')

    // Fetch anchor distribution (top 10)
    let anchors: any[] = []
    try {
      const anchorResp = await fetch('https://api.dataforseo.com/v3/backlinks/anchors/live', {
        method: 'POST',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify([{ target: domain, limit: 10, order_by: ['backlinks,desc'] }]),
      })
      if (anchorResp.ok) {
        const anchorData = await anchorResp.json()
        const anchorItems = anchorData?.tasks?.[0]?.result?.[0]?.items || []
        anchors = anchorItems.map((a: any) => ({
          anchor: a.anchor,
          backlinks: a.backlinks,
          referring_domains: a.referring_domains,
        }))
        trackPaidApiCall('refresh-serp-all', 'dataforseo', 'backlinks/anchors/live')
      }
    } catch { /* non-blocking */ }

    return {
      domain_rank: result.rank ?? null,
      referring_domains: result.referring_domains ?? 0,
      backlinks_total: result.backlinks ?? 0,
      referring_domains_new: result.new_referring_domains ?? 0,
      referring_domains_lost: result.lost_referring_domains ?? 0,
      anchor_distribution: anchors,
    }
  } catch (err) {
    console.error(`[refresh-serp-all] Backlinks fetch error for ${domain}:`, err)
    return null
  }
}

// ─── Week start date helper ───
function currentWeekStart(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Monday
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().split('T')[0]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  const dfLogin = Deno.env.get('DATAFORSEO_LOGIN')
  const dfPassword = Deno.env.get('DATAFORSEO_PASSWORD')
  const dfAuthHeader = dfLogin && dfPassword ? 'Basic ' + btoa(`${dfLogin}:${dfPassword}`) : null

  const weekStart = currentWeekStart()

  try {
    // Get all tracked sites
    const { data: sites, error: sitesError } = await supabase
      .from('tracked_sites')
      .select('id, domain, user_id')

    if (sitesError || !sites?.length) {
      console.log('[refresh-serp-all] No tracked sites or error:', sitesError)
      return new Response(JSON.stringify({ refreshed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let refreshed = 0
    let errors = 0
    const stats = { serp: 0, gsc: 0, backlinks: 0 }

    // Process sites sequentially to avoid rate limiting
    // Watchdog: stop 30s before Edge Function timeout (300s)
    const startTime = Date.now()
    const MAX_RUNTIME_MS = 250_000

    for (const site of sites) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.warn(`[refresh-serp-all] ⏱ Watchdog: stopping after ${refreshed} sites to save partial results`)
        break
      }

      try {
        // ═══ 1. SERP (DataForSEO ranked_keywords) ═══
        const serpResp = await fetch(`${supabaseUrl}/functions/v1/fetch-serp-kpis`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ domain: site.domain }),
        })

        let serpData: any = null
        if (serpResp.ok) {
          const serpResult = await serpResp.json()
          serpData = serpResult?.data

          if (serpData) {
            const { error: snapshotError } = await supabase
              .from('serp_snapshots')
              .insert({
                tracked_site_id: site.id,
                user_id: site.user_id,
                domain: site.domain,
                total_keywords: serpData.total_keywords ?? 0,
                avg_position: serpData.avg_position,
                homepage_position: serpData.homepage_position,
                top_3: serpData.top_3 ?? 0,
                top_10: serpData.top_10 ?? 0,
                top_50: serpData.top_50 ?? 0,
                etv: serpData.etv ?? 0,
                indexed_pages: serpData.indexed_pages ?? null,
                sample_keywords: serpData.sample_keywords ?? [],
                measured_at: serpData.measured_at || new Date().toISOString(),
              })
            if (snapshotError) {
              console.error(`[refresh-serp-all] Snapshot insert error for ${site.domain}:`, snapshotError)
            } else {
              stats.serp++
            }
          }
        }

        // ═══ 2. GSC HISTORY LOG ═══
        const gscToken = await getGscAccessToken(supabase, site.user_id)
        if (gscToken) {
          const gscData = await fetchGscWeekly(gscToken, site.domain)
          if (gscData) {
            const { error: gscError } = await supabase
              .from('gsc_history_log')
              .insert({
                tracked_site_id: site.id,
                user_id: site.user_id,
                domain: site.domain,
                clicks: gscData.clicks,
                impressions: gscData.impressions,
                ctr: gscData.ctr,
                avg_position: gscData.avg_position,
                week_start_date: weekStart,
                top_queries: gscData.top_queries,
              })
            if (gscError) {
              console.error(`[refresh-serp-all] GSC log error for ${site.domain}:`, gscError)
            } else {
              stats.gsc++
            }
          }
        }

        // ═══ 3. BACKLINK SNAPSHOTS ═══
        if (dfAuthHeader) {
          const blData = await fetchBacklinks(site.domain, dfAuthHeader)
          if (blData) {
            const { error: blError } = await supabase
              .from('backlink_snapshots')
              .insert({
                tracked_site_id: site.id,
                user_id: site.user_id,
                domain: site.domain,
                domain_rank: blData.domain_rank,
                referring_domains: blData.referring_domains,
                backlinks_total: blData.backlinks_total,
                referring_domains_new: blData.referring_domains_new,
                referring_domains_lost: blData.referring_domains_lost,
                anchor_distribution: blData.anchor_distribution,
                week_start_date: weekStart,
              })
            if (blError) {
              console.error(`[refresh-serp-all] Backlink insert error for ${site.domain}:`, blError)
            } else {
              stats.backlinks++
            }
          }
        }

        // ═══ 4. Backward compat: update user_stats_history ═══
        if (serpData) {
          const { data: latestEntry } = await supabase
            .from('user_stats_history')
            .select('id, raw_data')
            .eq('tracked_site_id', site.id)
            .eq('user_id', site.user_id)
            .order('recorded_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (latestEntry) {
            const existingRaw = (latestEntry.raw_data as Record<string, unknown>) || {}
            await supabase
              .from('user_stats_history')
              .update({ raw_data: { ...existingRaw, serpData } })
              .eq('id', latestEntry.id)
          }
        }

        refreshed++
        console.log(`[refresh-serp-all] ✅ ${site.domain} (serp:${serpData ? '✓' : '✗'} gsc:${gscToken ? '✓' : '✗'} bl:${dfAuthHeader ? '✓' : '✗'})`)

        // Delay between sites to avoid rate limiting
        await new Promise(r => setTimeout(r, 800))
      } catch (err) {
        console.error(`[refresh-serp-all] Error for ${site.domain}:`, err)
        errors++
      }
    }

    console.log(`[refresh-serp-all] Done: ${refreshed} refreshed, ${errors} errors. SERP:${stats.serp} GSC:${stats.gsc} BL:${stats.backlinks}`)

    return new Response(JSON.stringify({ refreshed, errors, total: sites.length, stats }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[refresh-serp-all] Fatal error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
