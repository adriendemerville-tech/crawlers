import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { trackPaidApiCall } from '../_shared/tokenTracker.ts'

/**
 * fetch-serp-kpis
 * 
 * Fetches SERP ranking data from DataForSEO ranked_keywords/live endpoint.
 * Returns: avg position, homepage position, total keywords, top 3/10/50 distribution.
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { domain, url } = await req.json()

    if (!domain) {
      return new Response(JSON.stringify({ error: 'Missing domain' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const login = Deno.env.get('DATAFORSEO_LOGIN')
    const password = Deno.env.get('DATAFORSEO_PASSWORD')

    if (!login || !password) {
      return new Response(JSON.stringify({ error: 'DataForSEO credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authHeader = 'Basic ' + btoa(`${login}:${password}`)

    // Fetch ranked keywords (limit 1000 for comprehensive distribution)
    const resp = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{
        target: domain,
        language_code: 'fr',
        location_code: 2250, // France
        limit: 1000,
        order_by: ['ranked_serp_element.serp_item.rank_absolute,asc'],
      }]),
    })

    if (!resp.ok) {
      const errorText = await resp.text()
      console.error('[fetch-serp-kpis] DataForSEO error:', resp.status, errorText)
      return new Response(JSON.stringify({ error: 'DataForSEO API error', status: resp.status }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await resp.json()
    const result = data?.tasks?.[0]?.result?.[0]

    if (!result) {
      return new Response(JSON.stringify({
        data: {
          total_keywords: 0,
          avg_position: null,
          homepage_position: null,
          top_3: 0,
          top_10: 0,
          top_50: 0,
          etv: 0,
          sample_keywords: [],
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    trackPaidApiCall('fetch-serp-kpis', 'dataforseo', 'ranked_keywords/live')

    const items = result.items || []
    const totalKeywords = result.total_count || items.length

    // Calculate distribution
    let top3 = 0, top10 = 0, top50 = 0
    let positionSum = 0
    let positionCount = 0
    let homepagePosition: number | null = null

    // Normalize homepage URL for matching
    const bareHomepage = domain.replace(/^www\./, '').toLowerCase()
    const homepagePatterns = [
      `https://${bareHomepage}`,
      `https://${bareHomepage}/`,
      `https://www.${bareHomepage}`,
      `https://www.${bareHomepage}/`,
      `http://${bareHomepage}`,
      `http://${bareHomepage}/`,
    ]

    for (const item of items) {
      const pos = item.ranked_serp_element?.serp_item?.rank_absolute
      if (typeof pos !== 'number') continue

      positionSum += pos
      positionCount++

      if (pos <= 3) top3++
      if (pos <= 10) top10++
      if (pos <= 50) top50++

      // Check if this keyword ranks for the homepage
      const rankUrl = (item.ranked_serp_element?.serp_item?.url || '').toLowerCase().replace(/\/+$/, '')
      if (homepagePosition === null || pos < homepagePosition) {
        const isHomepage = homepagePatterns.some(p => rankUrl === p || rankUrl === p.replace(/\/+$/, ''))
        if (isHomepage) {
          homepagePosition = pos
        }
      }
    }

    const avgPosition = positionCount > 0 ? parseFloat((positionSum / positionCount).toFixed(1)) : null

    // Extract ETV from metrics if available
    const etv = result.metrics?.organic?.etv ?? 0

    // Sample top keywords (first 20)
    const sampleKeywords = items.slice(0, 20).map((item: any) => ({
      keyword: item.keyword_data?.keyword,
      position: item.ranked_serp_element?.serp_item?.rank_absolute,
      search_volume: item.keyword_data?.keyword_info?.search_volume,
      url: item.ranked_serp_element?.serp_item?.url,
    }))

    const serpData = {
      total_keywords: totalKeywords,
      avg_position: avgPosition,
      homepage_position: homepagePosition,
      top_3: top3,
      top_10: top10,
      top_50: top50,
      etv: Math.round(etv),
      sample_keywords: sampleKeywords,
      measured_at: new Date().toISOString(),
    }

    console.log(`[fetch-serp-kpis] ✅ ${domain}: ${totalKeywords} keywords, avg pos ${avgPosition}, top3=${top3}, top10=${top10}, top50=${top50}`)

    return new Response(JSON.stringify({ data: serpData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[fetch-serp-kpis] Error:', error)
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
