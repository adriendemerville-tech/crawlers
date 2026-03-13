import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * refresh-serp-all
 * 
 * Weekly cron job: refreshes SERP KPIs for all tracked sites.
 * Called by pg_cron every Monday at 06:00 UTC.
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

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

    // Process sites sequentially to avoid rate limiting
    for (const site of sites) {
      try {
        // Call fetch-serp-kpis
        const serpResp = await fetch(`${supabaseUrl}/functions/v1/fetch-serp-kpis`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ domain: site.domain }),
        })

        if (!serpResp.ok) {
          console.error(`[refresh-serp-all] Failed for ${site.domain}: ${serpResp.status}`)
          errors++
          continue
        }

        const serpResult = await serpResp.json()
        const serpData = serpResult?.data

        if (!serpData) {
          errors++
          continue
        }

        // 1. Write to dedicated serp_snapshots table (primary storage)
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
        }

        // 2. Also update raw_data in user_stats_history (backward compatibility)
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

        refreshed++
        console.log(`[refresh-serp-all] ✅ ${site.domain}`)

        // Small delay between calls to avoid rate limiting
        await new Promise(r => setTimeout(r, 500))
      } catch (err) {
        console.error(`[refresh-serp-all] Error for ${site.domain}:`, err)
        errors++
      }
    }

    console.log(`[refresh-serp-all] Done: ${refreshed} refreshed, ${errors} errors out of ${sites.length} sites`)

    return new Response(JSON.stringify({ refreshed, errors, total: sites.length }), {
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
