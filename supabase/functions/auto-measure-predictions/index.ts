import { getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts'
import { resolveGoogleToken } from '../_shared/resolveGoogleToken.ts'
import { fetchGA4Engagement, type GA4Engagement } from '../_shared/fetchGA4.ts'
import { trackPaidApiCall, trackEdgeFunctionError } from '../_shared/tokenTracker.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * auto-measure-predictions (CRON — weekly)
 * 
 * Closes the prediction feedback loop:
 * 1. Finds predictions older than 90 days without actual_results
 * 2. Fetches real GSC + GA4 data for each domain
 * 3. Computes COMPOSITE accuracy (GSC clicks + GA4 sessions)
 * 4. Inserts into actual_results with accuracy_gap + enriched context
 * 5. Triggers recalculate_reliability()
 */

// Singleton client via _shared/supabaseClient.ts

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

// ─── Composite accuracy: blend GSC + GA4 for richer signal ──────
interface CompositeAccuracy {
  /** Primary: GSC-based MAPE */
  gsc_gap: number | null
  /** Secondary: GA4 sessions vs predicted (cross-validation) */
  ga4_session_gap: number | null
  /** Blended accuracy gap (0 = perfect, 1 = 100% off) */
  composite_gap: number | null
  /** Engagement quality score (0-100) — penalty if bounce_rate high */
  quality_score: number | null
  data_sources: string[]
}

function computeCompositeAccuracy(
  predictedTraffic: number,
  realClicks: number | null,
  ga4: GA4Engagement | null,
  baselineTraffic: number,
): CompositeAccuracy {
  const sources: string[] = []

  // GSC accuracy
  let gscGap: number | null = null
  if (realClicks !== null && predictedTraffic > 0) {
    gscGap = Math.abs(realClicks - predictedTraffic) / predictedTraffic
    sources.push('gsc')
  }

  // GA4 sessions as traffic proxy (cross-validation)
  let ga4Gap: number | null = null
  if (ga4 && predictedTraffic > 0) {
    // Sessions ≈ organic visits; compare to predicted organic traffic
    ga4Gap = Math.abs(ga4.sessions - predictedTraffic) / predictedTraffic
    sources.push('ga4')
  }

  // Quality score: penalize high bounce + low engagement
  let qualityScore: number | null = null
  if (ga4) {
    // engagement_rate is 0-1, bounce_rate is 0-1
    const engagementBonus = ga4.engagement_rate * 50  // 0-50
    const bouncePenalty = ga4.bounce_rate * 30         // 0-30
    const durationBonus = Math.min(20, (ga4.avg_session_duration / 180) * 20) // 0-20 (3min = max)
    qualityScore = Math.round(Math.max(0, Math.min(100, engagementBonus - bouncePenalty + durationBonus)))
    sources.push('quality')
  }

  // Composite: weighted blend (GSC 70%, GA4 30% when both available)
  let compositeGap: number | null = null
  if (gscGap !== null && ga4Gap !== null) {
    compositeGap = gscGap * 0.7 + ga4Gap * 0.3
  } else if (gscGap !== null) {
    compositeGap = gscGap
  } else if (ga4Gap !== null) {
    compositeGap = ga4Gap
  }

  return {
    gsc_gap: gscGap !== null ? Math.round(gscGap * 10000) / 10000 : null,
    ga4_session_gap: ga4Gap !== null ? Math.round(ga4Gap * 10000) / 10000 : null,
    composite_gap: compositeGap !== null ? Math.round(compositeGap * 10000) / 10000 : null,
    quality_score: qualityScore,
    data_sources: sources,
  }
}

Deno.serve(handleRequest(async (req) => {
const supabase = getServiceClient()

  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

    const { data: predictions, error: predErr } = await supabase
      .from('predictions')
      .select('id, client_id, domain, predicted_traffic, predicted_increase_pct, baseline_traffic, created_at')
      .lt('created_at', ninetyDaysAgo)
      .order('created_at', { ascending: true })
      .limit(20)

    if (predErr) throw new Error(`Failed to fetch predictions: ${predErr.message}`)
    if (!predictions || predictions.length === 0) {
      return jsonOk({ message: 'No predictions due for measurement', processed: 0 })
    }

    // Filter out already measured
    const predIds = predictions.map(p => p.id)
    const { data: existingResults } = await supabase
      .from('actual_results')
      .select('prediction_id')
      .in('prediction_id', predIds)

    const alreadyMeasured = new Set((existingResults || []).map(r => r.prediction_id))
    const toMeasure = predictions.filter(p => !alreadyMeasured.has(p.id))

    if (toMeasure.length === 0) {
      return jsonOk({ message: 'All due predictions already measured', processed: 0 })
    }

    // Group by domain
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
      // 1. Find tracked sites
      const { data: trackedSites } = await supabase
        .from('tracked_sites')
        .select('id, user_id, current_config, last_widget_ping')
        .ilike('domain', `%${domain}%`)
        .limit(5)

      // 2. Deployment context
      let deploymentStatus = 'unknown'
      let widgetActive = false
      let wpSynced = false

      if (trackedSites && trackedSites.length > 0) {
        const site = trackedSites[0]
        const cfg = site.current_config as Record<string, any> | null
        if (cfg?.last_sync && cfg?.fixes?.length > 0) {
          wpSynced = true
          deploymentStatus = 'wp_deployed'
        }
        if (site.last_widget_ping) {
          const pingAge = Date.now() - new Date(site.last_widget_ping).getTime()
          if (pingAge < 7 * 24 * 60 * 60 * 1000) {
            widgetActive = true
            if (deploymentStatus === 'unknown') deploymentStatus = 'gtm_active'
          }
        }
        if (deploymentStatus === 'unknown') deploymentStatus = 'not_deployed'
      }

      // 3. Validated corrective codes
      const { data: validatedCodes } = await supabase
        .from('saved_corrective_codes')
        .select('id')
        .ilike('url', `%${domain}%`)
        .not('validated_at', 'is', null)
      const correctiveCodesValidated = validatedCodes?.length || 0

      // 4. Latest impact snapshot
      const { data: latestSnapshot } = await supabase
        .from('audit_impact_snapshots')
        .select('impact_score, reliability_grade, corrective_code_deployed, gsc_t90')
        .eq('domain', domain)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      // 5. Fetch GSC + GA4 via resolveGoogleToken
      let realClicks: number | null = null
      let ga4Engagement: GA4Engagement | null = null
      const clientId = Deno.env.get('GOOGLE_GSC_CLIENT_ID')!
      const clientSecret = Deno.env.get('GOOGLE_GSC_CLIENT_SECRET')!

      for (const site of (trackedSites || [])) {
        const resolved = await resolveGoogleToken(supabase, site.user_id, domain, clientId, clientSecret)
        if (!resolved) continue

        if (realClicks === null) {
          realClicks = await fetchGscClicks(resolved.access_token, domain)
        }

        if (!ga4Engagement && resolved.ga4_property_id) {
          ga4Engagement = await fetchGA4Engagement({
            accessToken: resolved.access_token,
            propertyId: resolved.ga4_property_id,
          })
          if (ga4Engagement) {
            trackPaidApiCall('auto-measure-predictions', 'google-ga4', 'runReport')
          }
        }

        if (realClicks !== null) break
      }

      // Skip domain if no traffic data at all
      if (realClicks === null && !ga4Engagement) {
        skipped += preds.length
        continue
      }

      // 6. Insert actual_results with COMPOSITE accuracy
      for (const pred of preds) {
        const composite = computeCompositeAccuracy(
          pred.predicted_traffic,
          realClicks,
          ga4Engagement,
          pred.baseline_traffic,
        )

        const contextData = {
          deployment_status: deploymentStatus,
          widget_active: widgetActive,
          wp_synced: wpSynced,
          corrective_codes_validated: correctiveCodesValidated,
          impact_score: latestSnapshot?.impact_score ?? null,
          impact_reliability_grade: latestSnapshot?.reliability_grade ?? null,
          snapshot_corrective_deployed: latestSnapshot?.corrective_code_deployed || false,
          snapshot_gsc_t90: latestSnapshot?.gsc_t90 || null,
          // ─── GA4 enrichment (NEW) ───
          ga4_engagement: ga4Engagement,
          composite_accuracy: composite,
          measured_at: new Date().toISOString(),
        }

        const { error: insertErr } = await supabase
          .from('actual_results')
          .insert({
            prediction_id: pred.id,
            real_traffic_after_90_days: realClicks ?? ga4Engagement?.sessions ?? 0,
            accuracy_gap: composite.composite_gap,
            context_data: contextData,
          })

        if (insertErr) {
          errors.push(`${pred.id}: ${insertErr.message}`)
        } else {
          processed++
        }
      }
    }

    if (processed > 0) {
      await supabase.rpc('recalculate_reliability')
    }

    console.log(`[auto-measure-predictions] processed=${processed} skipped=${skipped} errors=${errors.length}`)

    return jsonOk({
      success: true,
      processed,
      skipped,
      errors: errors.slice(0, 5),
    })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[auto-measure-predictions] error:', msg)
    await trackEdgeFunctionError('auto-measure-predictions', msg).catch(() => {})
    return jsonError(msg, 500)
  }
}));