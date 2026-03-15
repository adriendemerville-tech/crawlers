import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { trackPaidApiCall, trackEdgeFunctionError } from '../_shared/tokenTracker.ts'
import { withCircuitBreaker } from '../_shared/circuitBreaker.ts'
import { resolveGoogleToken } from '../_shared/resolveGoogleToken.ts'
import { fetchGA4Engagement } from '../_shared/fetchGA4.ts'

/**
 * refresh-serp-all  v2
 * 
 * Weekly cron job: refreshes SERP KPIs + GSC history + backlink snapshots
 * for tracked sites. Supports cursor-based pagination to handle 100+ sites
 * within the 300s Edge Function timeout.
 * 
 * Call with { cursor: "last-processed-site-id" } to resume from a previous run.
 * Returns { next_cursor } if more sites remain — caller should re-invoke.
 */

const BATCH_SIZE = 30;
const DELAY_BETWEEN_SITES_MS = 800;
const MAX_RUNTIME_MS = 240_000; // 240s — 60s safety margin

// ─── GSC token refresh ───
async function getGscAccessToken(supabase: any, userId: string): Promise<string | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('gsc_access_token, gsc_refresh_token, gsc_token_expiry')
    .eq('user_id', userId)
    .single()

  if (!profile?.gsc_access_token) return null

  let accessToken = profile.gsc_access_token

  if (profile.gsc_token_expiry && new Date(profile.gsc_token_expiry) < new Date()) {
    if (!profile.gsc_refresh_token) {
      // Alert: token expired and no refresh token
      console.warn(`[refresh-serp-all] ⚠️ GSC token EXPIRED for user ${userId} — no refresh token available`)
      return null
    }
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
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      console.warn(`[refresh-serp-all] ⚠️ GSC token refresh FAILED for user ${userId}: ${resp.status} ${errText}`)
      return null
    }
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
}

// ─── Backlinks: DataForSEO /backlinks/summary/live ───
async function fetchBacklinks(domain: string, authHeader: string): Promise<{
  domain_rank: number | null; referring_domains: number; backlinks_total: number;
  referring_domains_new: number; referring_domains_lost: number; anchor_distribution: any[]
} | null> {
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
    throw new Error(`Backlinks API ${resp.status}`)
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
    // Parse cursor from request body (for pagination)
    const body = await req.json().catch(() => ({}))
    const cursor: string | undefined = body.cursor

    // Get tracked sites with cursor-based pagination
    let query = supabase
      .from('tracked_sites')
      .select('id, domain, user_id')
      .order('id', { ascending: true })
      .limit(BATCH_SIZE)

    if (cursor) {
      query = query.gt('id', cursor)
    }

    const { data: sites, error: sitesError } = await query

    if (sitesError || !sites?.length) {
      console.log('[refresh-serp-all] No (more) tracked sites or error:', sitesError)
      return new Response(JSON.stringify({ refreshed: 0, next_cursor: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let refreshed = 0
    let errors = 0
    const stats = { serp: 0, gsc: 0, backlinks: 0, ga4: 0, gsc_expired: 0 }
    const startTime = Date.now()
    let lastProcessedId: string | null = null

    for (const site of sites) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.warn(`[refresh-serp-all] ⏱ Watchdog: stopping after ${refreshed} sites`)
        break
      }

      lastProcessedId = site.id

      try {
        // ═══ 1. SERP (DataForSEO ranked_keywords) — with circuit breaker ═══
        let serpData: any = null
        const serpResult = await withCircuitBreaker('dataforseo-serp', async () => {
          const serpResp = await fetch(`${supabaseUrl}/functions/v1/fetch-serp-kpis`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ domain: site.domain }),
          })
          if (!serpResp.ok) throw new Error(`SERP ${serpResp.status}`)
          const serpJson = await serpResp.json()
          return serpJson?.data
        })

        if (serpResult) {
          serpData = serpResult
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
          if (!snapshotError) stats.serp++
          else console.error(`[${site.domain}] SERP insert error:`, snapshotError)
        }

        // ═══ 2. GSC HISTORY LOG — with circuit breaker ═══
        const gscToken = await getGscAccessToken(supabase, site.user_id)
        if (gscToken) {
          const gscData = await withCircuitBreaker('google-gsc', () => fetchGscWeekly(gscToken, site.domain))
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
            if (!gscError) stats.gsc++
            else console.error(`[${site.domain}] GSC insert error:`, gscError)
          }
        } else {
          // Check if token was expected but expired
          const { data: profile } = await supabase
            .from('profiles')
            .select('gsc_access_token, gsc_token_expiry')
            .eq('user_id', site.user_id)
            .single()
          if (profile?.gsc_access_token && profile?.gsc_token_expiry) {
            const expiry = new Date(profile.gsc_token_expiry)
            if (expiry < new Date()) {
              stats.gsc_expired++
              console.warn(`[refresh-serp-all] ⚠️ GSC EXPIRED for ${site.domain} (user ${site.user_id}, expired ${expiry.toISOString()})`)
            }
          }
        }

        // ═══ 3. BACKLINK SNAPSHOTS — with circuit breaker ═══
        if (dfAuthHeader) {
          const blData = await withCircuitBreaker('dataforseo-backlinks', () => fetchBacklinks(site.domain, dfAuthHeader!))
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
            if (!blError) stats.backlinks++
            else console.error(`[${site.domain}] Backlink insert error:`, blError)
          }
        }

        // ═══ 4. GA4 HISTORY LOG — via resolveGoogleToken + shared helper ═══
        const clientId = Deno.env.get('GOOGLE_GSC_CLIENT_ID')
        const clientSecret = Deno.env.get('GOOGLE_GSC_CLIENT_SECRET')
        if (clientId && clientSecret) {
          try {
            const resolved = await resolveGoogleToken(supabase, site.user_id, site.domain, clientId, clientSecret)
            if (resolved?.ga4_property_id) {
              const ga4Data = await fetchGA4Engagement({
                accessToken: resolved.access_token,
                propertyId: resolved.ga4_property_id,
              })
              if (ga4Data) {
                const { error: ga4Error } = await supabase
                  .from('ga4_history_log')
                  .upsert({
                    tracked_site_id: site.id,
                    user_id: site.user_id,
                    domain: site.domain,
                    sessions: ga4Data.sessions,
                    total_users: ga4Data.total_users,
                    engagement_rate: ga4Data.engagement_rate,
                    bounce_rate: ga4Data.bounce_rate,
                    avg_session_duration: ga4Data.avg_session_duration,
                    pageviews: ga4Data.pageviews,
                    week_start_date: weekStart,
                  }, { onConflict: 'tracked_site_id,week_start_date' })
                if (!ga4Error) {
                  stats.ga4++
                  trackPaidApiCall('refresh-serp-all', 'google-ga4', 'runReport')
                } else {
                  console.error(`[${site.domain}] GA4 insert error:`, ga4Error)
                }
              }
            }
          } catch { /* GA4 best-effort */ }
        }

        // ═══ 5. Backward compat: update user_stats_history ═══
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
        console.log(`[refresh-serp-all] ✅ ${site.domain} (serp:${serpData ? '✓' : '✗'} gsc:${gscToken ? '✓' : '✗'} bl:${dfAuthHeader ? '✓' : '✗'} ga4:${stats.ga4 > 0 ? '✓' : '✗'})`)

        await new Promise(r => setTimeout(r, DELAY_BETWEEN_SITES_MS))
      } catch (err) {
        console.error(`[refresh-serp-all] Error for ${site.domain}:`, err)
        await trackEdgeFunctionError('refresh-serp-all', err instanceof Error ? err.message : String(err), {
          domain: site.domain, user_id: site.user_id,
        }).catch(() => {})
        errors++
      }
    }

    // ═══ 6. COCOON REFRESH for Pro Agency users ═══
    try {
      const { data: proProfiles } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('plan_type', 'agency_pro')
      const proUserIds = new Set((proProfiles || []).map(p => p.user_id))

      const cocoonSites = sites.filter(s => proUserIds.has(s.user_id))
      let cocoonRefreshed = 0

      for (const site of cocoonSites) {
        if (Date.now() - startTime > MAX_RUNTIME_MS) break
        try {
          const resp = await fetch(`${supabaseUrl}/functions/v1/calculate-cocoon-logic`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ tracked_site_id: site.id }),
          })
          if (resp.ok) {
            cocoonRefreshed++
            console.log(`[refresh-serp-all] 🕸️ Cocoon refreshed for ${site.domain}`)
          }
        } catch (err) {
          console.error(`[refresh-serp-all] Cocoon error for ${site.domain}:`, err)
        }
        await new Promise(r => setTimeout(r, 1000))
      }
      if (cocoonRefreshed > 0) {
        console.log(`[refresh-serp-all] 🕸️ Cocoon: ${cocoonRefreshed}/${cocoonSites.length} refreshed`)
      }
    } catch (cocoonErr) {
      console.error('[refresh-serp-all] Cocoon batch error:', cocoonErr)
    }

    // ═══ 7. CLEANUP: Old cocoon chat histories (>90 days) & stale sessions ═══
    try {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      
      // Clean old anonymous chat histories
      const { count: chatCleaned } = await supabase
        .from('cocoon_chat_histories')
        .delete({ count: 'exact' })
        .lt('created_at', ninetyDaysAgo)
      
      // Clean stale cocoon sessions (>180 days, no outcome measured)
      const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
      const { count: sessionsCleaned } = await supabase
        .from('cocoon_sessions')
        .delete({ count: 'exact' })
        .lt('created_at', sixMonthsAgo)
        .is('outcome_measured_at', null)
      
      if ((chatCleaned || 0) > 0 || (sessionsCleaned || 0) > 0) {
        console.log(`[refresh-serp-all] 🧹 Cocoon cleanup: ${chatCleaned || 0} chat histories, ${sessionsCleaned || 0} stale sessions removed`)
      }
    } catch (cleanupErr) {
      console.error('[refresh-serp-all] Cocoon cleanup error:', cleanupErr)
    }

    // Determine if there are more sites to process
    const hasMore = sites.length === BATCH_SIZE
    const nextCursor = hasMore ? lastProcessedId : null

    if (stats.gsc_expired > 0) {
      console.warn(`[refresh-serp-all] ⚠️ ${stats.gsc_expired} site(s) with EXPIRED GSC tokens — users should reconnect`)
    }

    console.log(`[refresh-serp-all] Batch done: ${refreshed}/${sites.length} refreshed, ${errors} errors. SERP:${stats.serp} GSC:${stats.gsc} BL:${stats.backlinks} GA4:${stats.ga4} GSC_expired:${stats.gsc_expired}${nextCursor ? ` | next_cursor: ${nextCursor}` : ' | COMPLETE'}`)

    // ═══ SELF-RE-INVOCATION: continue processing remaining sites ═══
    if (nextCursor) {
      console.log(`[refresh-serp-all] 🔄 Self-invoking for next batch (cursor: ${nextCursor})`)
      fetch(`${supabaseUrl}/functions/v1/refresh-serp-all`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cursor: nextCursor }),
      }).catch(err => console.error('[refresh-serp-all] Self-invoke failed:', err))
    }

    return new Response(JSON.stringify({ refreshed, errors, total: sites.length, stats, next_cursor: nextCursor }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[refresh-serp-all] Fatal error:', error)
    await trackEdgeFunctionError('refresh-serp-all', error instanceof Error ? error.message : 'Fatal error').catch(() => {})
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
