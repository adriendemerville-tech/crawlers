import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { trackPaidApiCall } from '../_shared/tokenTracker.ts'
import { cacheKey, getCached, setCache } from '../_shared/auditCache.ts'
import { trackTokenUsage } from '../_shared/tokenTracker.ts'

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
    const { domain, url, tracked_site_id, user_id: caller_user_id, location_code, language_code, site_context } = await req.json()
    const effectiveLocationCode = location_code || 2250
    const effectiveLanguageCode = language_code || 'fr'

    if (!domain) {
      return new Response(JSON.stringify({ error: 'Missing domain' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // #1: Check audit_cache first (24h TTL for SERP data)
    const ck = cacheKey('fetch-serp-kpis', { domain, location_code: effectiveLocationCode })
    const cached = await getCached(ck)
    if (cached) {
      console.log(`[fetch-serp-kpis] Cache hit for ${domain}`)
      return new Response(JSON.stringify({ data: cached }), {
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

    // Fetch ranked keywords with timeout (#2)
    const controller = new AbortController()
    const fetchTimeout = setTimeout(() => controller.abort(), 30000)
    const resp = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{
        target: domain,
        language_code: effectiveLanguageCode,
        location_code: effectiveLocationCode,
        limit: 1000,
        order_by: ['ranked_serp_element.serp_item.rank_absolute,asc'],
      }]),
      signal: controller.signal,
    })
    clearTimeout(fetchTimeout)

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

    // Sample top keywords (first 50 for semantic authority)
    const sampleKeywords = items.slice(0, 50).map((item: any) => ({
      keyword: item.keyword_data?.keyword,
      position: item.ranked_serp_element?.serp_item?.rank_absolute,
      search_volume: item.keyword_data?.keyword_info?.search_volume,
      url: item.ranked_serp_element?.serp_item?.url,
    }))

    // Fetch indexed pages count via SERP API (site:domain)
    let indexed_pages: number | null = null
    try {
      const indexResp = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{
          keyword: `site:${bareHomepage}`,
          language_code: effectiveLanguageCode,
          location_code: effectiveLocationCode,
          device: 'desktop',
          depth: 1,
        }]),
      })

      if (indexResp.ok) {
        const indexData = await indexResp.json()
        const indexResult = indexData?.tasks?.[0]?.result?.[0]
        indexed_pages = indexResult?.se_results_count ?? null
        console.log(`[fetch-serp-kpis] Indexed pages for ${bareHomepage}: ${indexed_pages}`)
        trackPaidApiCall('fetch-serp-kpis', 'dataforseo', 'serp/organic/live (indexed pages)')
      } else {
        console.error('[fetch-serp-kpis] Indexed pages API error:', indexResp.status)
      }
    } catch (err) {
      console.error('[fetch-serp-kpis] Indexed pages fetch error:', err)
    }

    // === Semantic Authority: LLM-scored keyword relevance × position × volume ===
    let semantic_authority: number | null = null
    if (site_context && sampleKeywords.length > 0) {
      try {
        const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
        if (LOVABLE_API_KEY) {
          const identityDesc = [
            site_context.products_services && `Produits/Services: ${site_context.products_services}`,
            site_context.market_sector && `Secteur: ${site_context.market_sector}`,
            site_context.target_audience && `Audience cible: ${site_context.target_audience}`,
            site_context.commercial_area && `Zone: ${site_context.commercial_area}`,
          ].filter(Boolean).join('. ')

          if (identityDesc) {
            const kwList = sampleKeywords
              .filter((kw: any) => kw.keyword && kw.position > 0)
              .map((kw: any, i: number) => `${i + 1}. "${kw.keyword}"`)
              .join('\n')

            const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'google/gemini-2.5-flash-lite',
                messages: [
                  {
                    role: 'system',
                    content: `Tu es un expert SEO. On te donne la carte d'identité d'un site et une liste de mots-clés sur lesquels il se positionne. Pour chaque mot-clé, donne un score de pertinence de 0 à 100 par rapport au cœur de cible du site. 100 = parfaitement aligné avec l'activité principale. 0 = aucun rapport.`
                  },
                  {
                    role: 'user',
                    content: `CARTE D'IDENTITÉ DU SITE:\n${identityDesc}\n\nMOTS-CLÉS:\n${kwList}`
                  }
                ],
                tools: [{
                  type: 'function',
                  function: {
                    name: 'score_keywords',
                    description: 'Score de pertinence pour chaque mot-clé',
                    parameters: {
                      type: 'object',
                      properties: {
                        scores: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              index: { type: 'number', description: 'Numéro du mot-clé (1-based)' },
                              relevance: { type: 'number', description: 'Score 0-100' }
                            },
                            required: ['index', 'relevance'],
                            additionalProperties: false
                          }
                        }
                      },
                      required: ['scores'],
                      additionalProperties: false
                    }
                  }
                }],
                tool_choice: { type: 'function', function: { name: 'score_keywords' } },
                temperature: 0.1,
              }),
              signal: AbortSignal.timeout(15000),
            })

            if (resp.ok) {
              const data = await resp.json()
              trackTokenUsage('fetch-serp-kpis', 'google/gemini-2.5-flash-lite', data.usage, domain)
              
              const toolCall = data.choices?.[0]?.message?.tool_calls?.[0]
              if (toolCall?.function?.arguments) {
                const parsed = JSON.parse(toolCall.function.arguments)
                const relevanceMap = new Map<number, number>()
                for (const s of (parsed.scores || [])) {
                  relevanceMap.set(s.index, Math.min(100, Math.max(0, s.relevance)))
                }

                // Compute weighted authority score
                let weightedSum = 0
                let totalWeight = 0
                const validKws = sampleKeywords.filter((kw: any) => kw.keyword && kw.position > 0)
                
                validKws.forEach((kw: any, i: number) => {
                  const relevance = relevanceMap.get(i + 1) ?? 0
                  if (relevance < 20) return // Skip irrelevant keywords
                  
                  const posScore = Math.max(0, Math.round(100 * Math.exp(-0.05 * (kw.position - 1))))
                  const volume = kw.search_volume || 1
                  const weight = volume * (relevance / 100)
                  
                  weightedSum += posScore * weight
                  totalWeight += weight
                })

                semantic_authority = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null
                console.log(`[fetch-serp-kpis] Semantic authority for ${domain}: ${semantic_authority}/100 (${validKws.length} kws scored)`)
              }
            } else {
              console.error(`[fetch-serp-kpis] LLM relevance scoring failed: ${resp.status}`)
            }
          }
        }
      } catch (err) {
        console.error('[fetch-serp-kpis] Semantic authority LLM error:', err)
      }
    }

    const serpData = {
      total_keywords: totalKeywords,
      avg_position: avgPosition,
      homepage_position: homepagePosition,
      top_3: top3,
      top_10: top10,
      top_50: top50,
      etv: Math.round(etv),
      indexed_pages,
      semantic_authority,
      sample_keywords: sampleKeywords,
      measured_at: new Date().toISOString(),
    }

    console.log(`[fetch-serp-kpis] ✅ ${domain}: ${totalKeywords} keywords, avg pos ${avgPosition}, top3=${top3}, top10=${top10}, top50=${top50}`)

    // #1: Cache result for 24h to avoid duplicate API calls
    await setCache(ck, 'fetch-serp-kpis', serpData, 1440)

    // If tracked_site_id provided, persist to serp_snapshots
    if (tracked_site_id && caller_user_id) {
      const supabase = getServiceClient()

      const { error: insertErr } = await supabase
        .from('serp_snapshots')
        .insert({
          tracked_site_id,
          user_id: caller_user_id,
          domain,
          total_keywords: serpData.total_keywords,
          avg_position: serpData.avg_position,
          homepage_position: serpData.homepage_position,
          top_3: serpData.top_3,
          top_10: serpData.top_10,
          top_50: serpData.top_50,
          etv: serpData.etv,
          indexed_pages: serpData.indexed_pages,
          sample_keywords: serpData.sample_keywords,
          measured_at: serpData.measured_at,
        })

      if (insertErr) {
        console.error('[fetch-serp-kpis] serp_snapshots insert error:', insertErr)
      }
    }

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
