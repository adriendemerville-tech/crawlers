import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * auto-measure-predictions (CRON — weekly)
 * 
 * Closes the prediction feedback loop:
 * 1. Finds predictions older than 90 days without actual_results
 * 2. Fetches real GSC data for each domain
 * 3. Compares predicted_traffic to real traffic
 * 4. Inserts into actual_results with accuracy_gap
 * 5. Triggers recalculate_reliability()
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// ─── GSC token refresh ─────────────────────────────────────────
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

// ─── Fetch GSC clicks for a domain (last 28 days) ──────────────
async function fetchGscClicks(accessToken: string, domain: string): Promise<number | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const sitesResp = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      signal: controller.signal,
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
    const startDate = new Date(endDate.getTime() - 28 * 24 * 60 * 60 * 1000)

    const resp = await fetch(
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
        signal: controller.signal,
      }
    )
    if (!resp.ok) return null

    const data = await resp.json()
    const rows = data.rows || []
    if (rows.length === 0) return null

    return Math.round(rows[0].clicks || 0)
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  try {
    // Find predictions older than 90 days without actual_results
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

    const { data: predictions, error: predErr } = await supabase
      .from('predictions')
      .select(`
        id, client_id, domain, predicted_traffic, predicted_increase_pct,
        baseline_traffic, created_at
      `)
      .lt('created_at', ninetyDaysAgo)
      .order('created_at', { ascending: true })
      .limit(20) // Process in batches to stay within Edge Function timeout

    if (predErr) throw new Error(`Failed to fetch predictions: ${predErr.message}`)
    if (!predictions || predictions.length === 0) {
      return new Response(JSON.stringify({ message: 'No predictions due for measurement', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Filter out predictions that already have actual_results
    const predIds = predictions.map(p => p.id)
    const { data: existingResults } = await supabase
      .from('actual_results')
      .select('prediction_id')
      .in('prediction_id', predIds)

    const alreadyMeasured = new Set((existingResults || []).map(r => r.prediction_id))
    const toMeasure = predictions.filter(p => !alreadyMeasured.has(p.id))

    if (toMeasure.length === 0) {
      return new Response(JSON.stringify({ message: 'All due predictions already measured', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Group by domain to avoid duplicate GSC calls
    const domainMap = new Map<string, typeof toMeasure>()
    for (const p of toMeasure) {
      if (!p.domain) continue
      const d = p.domain.toLowerCase()
      if (!domainMap.has(d)) domainMap.set(d, [])
      domainMap.get(d)!.push(p)
    }

    let processed = 0
    let skipped = 0
    const errors: string[] = []

    for (const [domain, preds] of domainMap) {
      // Find a user with GSC connected for this domain
      const { data: trackedSites } = await supabase
        .from('tracked_sites')
        .select('user_id')
        .ilike('domain', `%${domain}%`)
        .limit(5)

      let realClicks: number | null = null

      // Try each user's GSC until we get data
      for (const site of (trackedSites || [])) {
        const token = await getGscAccessToken(supabase, site.user_id)
        if (!token) continue

        realClicks = await fetchGscClicks(token, domain)
        if (realClicks !== null) break
      }

      if (realClicks === null) {
        skipped += preds.length
        continue
      }

      // Insert actual_results for each prediction on this domain
      for (const pred of preds) {
        const accuracyGap = pred.predicted_traffic > 0
          ? Math.abs(realClicks - pred.predicted_traffic) / pred.predicted_traffic
          : null

        const { error: insertErr } = await supabase
          .from('actual_results')
          .insert({
            prediction_id: pred.id,
            real_traffic_after_90_days: realClicks,
            accuracy_gap: accuracyGap !== null ? Math.round(accuracyGap * 10000) / 10000 : null,
          })

        if (insertErr) {
          errors.push(`${pred.id}: ${insertErr.message}`)
        } else {
          processed++
        }
      }
    }

    // Recalculate global reliability score
    if (processed > 0) {
      await supabase.rpc('recalculate_reliability')
    }

    console.log(`[auto-measure-predictions] processed=${processed} skipped=${skipped} errors=${errors.length}`)

    return new Response(JSON.stringify({
      success: true,
      processed,
      skipped,
      errors: errors.slice(0, 5),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[auto-measure-predictions] error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
