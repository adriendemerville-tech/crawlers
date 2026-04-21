/**
 * fetch-gsc-daily — Daily GSC position fetcher for anomaly detection
 * 
 * Fetches per-query daily positions from GSC for tracked sites.
 * Runs via cron daily. Feeds gsc_daily_positions table for J-1 anomaly detection.
 * 
 * POST { all: true } → cron mode
 * POST { tracked_site_id } → single site
 */
import { getAuthenticatedUser } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts'

Deno.serve(handleRequest(async (req) => {
  const auth = await getAuthenticatedUser(req)
  if (!auth) return jsonError('Unauthorized', 401)

  const body = await req.json()
  const supabase = getServiceClient()

  // Determine sites to process
  let sites: { id: string; domain: string; user_id: string; target_countries?: string[] }[] = []

  if (body.all) {
    const { data } = await supabase
      .from('tracked_sites')
      .select('id, domain, user_id, target_countries')
      .eq('is_active', true)
      .limit(200)
    sites = data || []
  } else if (body.tracked_site_id) {
    const { data } = await supabase
      .from('tracked_sites')
      .select('id, domain, user_id, target_countries')
      .eq('id', body.tracked_site_id)
      .maybeSingle()
    if (data) sites = [data]
  } else {
    const { data } = await supabase
      .from('tracked_sites')
      .select('id, domain, user_id, target_countries')
      .eq('user_id', auth.userId)
      .eq('is_active', true)
    sites = data || []
  }

  let totalInserted = 0

  for (const site of sites) {
    const countries = site.target_countries?.length ? site.target_countries : ['fra']

    for (const countryCode of countries) {
      try {
        // Get Google connection for this user
        const { data: conn } = await supabase
          .from('google_connections')
          .select('access_token, refresh_token, token_expiry')
          .eq('user_id', site.user_id)
          .maybeSingle()

        if (!conn?.access_token) continue

        // Check if token needs refresh
        let accessToken = conn.access_token
        if (conn.token_expiry && new Date(conn.token_expiry) < new Date()) {
          const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
          const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
          if (clientId && clientSecret && conn.refresh_token) {
            try {
              const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                  client_id: clientId,
                  client_secret: clientSecret,
                  refresh_token: conn.refresh_token,
                  grant_type: 'refresh_token',
                }),
              })
              if (tokenRes.ok) {
                const tokens = await tokenRes.json()
                accessToken = tokens.access_token
                await supabase.from('google_connections').update({
                  access_token: tokens.access_token,
                  token_expiry: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
                }).eq('user_id', site.user_id)
              } else { continue }
            } catch { continue }
          } else { continue }
        }

        const cleanDomain = site.domain.replace(/^www\./, '').toLowerCase()
        const siteUrl = `sc-domain:${cleanDomain}`
        
        // Fetch yesterday's data (GSC has ~2 day delay, try J-2)
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 2)
        const dateStr = yesterday.toISOString().split('T')[0]

        const gscRes = await fetch(
          `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              startDate: dateStr,
              endDate: dateStr,
              dimensions: ['query'],
              rowLimit: 500,
              dimensionFilterGroups: [{
                filters: [{ dimension: 'country', expression: countryCode }]
              }],
            }),
            signal: AbortSignal.timeout(15000),
          }
        )

        if (!gscRes.ok) {
          console.warn(`[fetch-gsc-daily] GSC API error for ${cleanDomain}/${countryCode}: ${gscRes.status}`)
          continue
        }

        const gscData = await gscRes.json()
        const rows = gscData.rows || []

        if (rows.length === 0) continue

        const insertRows = rows.map((row: any) => ({
          tracked_site_id: site.id,
          user_id: site.user_id,
          domain: cleanDomain,
          query: row.keys[0],
          position: Math.round(row.position * 100) / 100,
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
          ctr: Math.round((row.ctr || 0) * 10000) / 100,
          date_val: dateStr,
          country: countryCode,
        }))

        // Upsert (ON CONFLICT do update)
        for (let i = 0; i < insertRows.length; i += 100) {
          const batch = insertRows.slice(i, i + 100)
          const { error } = await supabase.from('gsc_daily_positions').upsert(batch, {
            onConflict: 'tracked_site_id,query,date_val,country',
          })
          if (error) console.error(`[fetch-gsc-daily] Upsert error for ${cleanDomain}/${countryCode}:`, error)
          else totalInserted += batch.length
        }

        console.log(`[fetch-gsc-daily] ${cleanDomain}/${countryCode}: ${rows.length} queries stored for ${dateStr}`)
      } catch (e) {
        console.error(`[fetch-gsc-daily] Error for ${site.domain}/${countryCode}:`, e)
      }
    }
  }

  return jsonOk({ success: true, sites_processed: sites.length, rows_inserted: totalInserted })
}))
