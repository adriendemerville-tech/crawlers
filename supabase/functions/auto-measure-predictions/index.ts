import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { resolveGoogleToken } from '../_shared/resolveGoogleToken.ts'

/**
 * auto-measure-predictions (CRON — weekly)
 * 
 * Closes the prediction feedback loop:
 * 1. Finds predictions older than 90 days without actual_results
 * 2. Fetches real GSC + GA4 data for each domain
 * 3. Compares predicted_traffic to real traffic
 * 4. Inserts into actual_results with accuracy_gap + GA4 engagement
 * 5. Triggers recalculate_reliability()
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GA4_API = 'https://analyticsdata.googleapis.com/v1beta'

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
      // ─── 1. Find tracked sites for this domain ───
      const { data: trackedSites } = await supabase
        .from('tracked_sites')
        .select('id, user_id, current_config, last_widget_ping')
        .ilike('domain', `%${domain}%`)
        .limit(5)

      // ─── 2. Collect deployment context ───
      let deploymentStatus = 'unknown'
      let widgetActive = false
      let wpSynced = false

      if (trackedSites && trackedSites.length > 0) {
        const site = trackedSites[0]
        const cfg = site.current_config as Record<string, any> | null

        // WordPress sync check
        if (cfg?.last_sync && cfg?.fixes?.length > 0) {
          wpSynced = true
          deploymentStatus = 'wp_deployed'
        }

        // GTM widget check (active if pinged < 24h from prediction end date)
        if (site.last_widget_ping) {
          const pingAge = Date.now() - new Date(site.last_widget_ping).getTime()
          if (pingAge < 7 * 24 * 60 * 60 * 1000) { // 7 days tolerance for cron
            widgetActive = true
            if (deploymentStatus === 'unknown') deploymentStatus = 'gtm_active'
          }
        }

        if (deploymentStatus === 'unknown') deploymentStatus = 'not_deployed'
      }

      // ─── 3. Check validated corrective codes ───
      let correctiveCodesValidated = 0
      const { data: validatedCodes } = await supabase
        .from('saved_corrective_codes')
        .select('id')
        .ilike('url', `%${domain}%`)
        .not('validated_at', 'is', null)

      correctiveCodesValidated = validatedCodes?.length || 0

      // ─── 4. Fetch audit_impact_snapshots (latest for this domain) ───
      let impactScore: number | null = null
      let impactReliabilityGrade: string | null = null
      const { data: latestSnapshot } = await supabase
        .from('audit_impact_snapshots')
        .select('impact_score, reliability_grade, corrective_code_deployed, gsc_t90')
        .eq('domain', domain)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestSnapshot) {
        impactScore = latestSnapshot.impact_score
        impactReliabilityGrade = latestSnapshot.reliability_grade
      }

      // ─── 5. Fetch GSC + GA4 real traffic ───
      let realClicks: number | null = null
      let ga4Engagement: any = null
      const clientId = Deno.env.get('GOOGLE_GSC_CLIENT_ID')!
      const clientSecret = Deno.env.get('GOOGLE_GSC_CLIENT_SECRET')!

      for (const site of (trackedSites || [])) {
        const resolved = await resolveGoogleToken(supabase, site.user_id, domain, clientId, clientSecret)
        if (!resolved) continue

        // GSC clicks
        if (realClicks === null) {
          realClicks = await fetchGscClicks(resolved.access_token, domain)
        }

        // GA4 engagement (if property configured)
        if (!ga4Engagement && resolved.ga4_property_id) {
          try {
            const endDate = new Date().toISOString().split('T')[0]
            const startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            const resp = await fetch(`${GA4_API}/properties/${resolved.ga4_property_id}:runReport`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${resolved.access_token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                dateRanges: [{ startDate, endDate }],
                metrics: [
                  { name: 'sessions' },
                  { name: 'totalUsers' },
                  { name: 'bounceRate' },
                  { name: 'engagementRate' },
                  { name: 'averageSessionDuration' },
                ],
              }),
            })
            if (resp.ok) {
              const data = await resp.json()
              const row = data.rows?.[0]
              if (row) {
                const v = row.metricValues || []
                ga4Engagement = {
                  sessions: parseInt(v[0]?.value || '0'),
                  total_users: parseInt(v[1]?.value || '0'),
                  bounce_rate: parseFloat(v[2]?.value || '0'),
                  engagement_rate: parseFloat(v[3]?.value || '0'),
                  avg_session_duration: parseFloat(v[4]?.value || '0'),
                }
              }
            }
          } catch (_) { /* GA4 is best-effort */ }
        }

        if (realClicks !== null) break
      }

      if (realClicks === null) {
        skipped += preds.length
        continue
      }

      // ─── 6. Build enriched context ───
      const contextData = {
        deployment_status: deploymentStatus,
        widget_active: widgetActive,
        wp_synced: wpSynced,
        corrective_codes_validated: correctiveCodesValidated,
        impact_score: impactScore,
        impact_reliability_grade: impactReliabilityGrade,
        snapshot_corrective_deployed: latestSnapshot?.corrective_code_deployed || false,
        snapshot_gsc_t90: latestSnapshot?.gsc_t90 || null,
        measured_at: new Date().toISOString(),
      }

      // ─── 7. Insert actual_results with context ───
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
            context_data: contextData,
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
