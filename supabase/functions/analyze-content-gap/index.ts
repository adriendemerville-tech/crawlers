/**
 * analyze-content-gap — Content Gap Concurrentiel
 * Cross-references GSC real positions (keyword_universe) with competitor SERP data
 * to find keywords competitors rank for but we don't.
 * 
 * POST { tracked_site_id } → analyze content gap for one site
 */
import { getAuthenticatedUser } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { trackPaidApiCall } from '../_shared/tokenTracker.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts'

const DATAFORSEO_LOGIN = Deno.env.get('DATAFORSEO_LOGIN')
const DATAFORSEO_PASSWORD = Deno.env.get('DATAFORSEO_PASSWORD')
function getAuthHeader(): string { return `Basic ${btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`)}` }

interface CompetitorKeyword {
  keyword: string
  position: number
  search_volume: number
  difficulty: number
  intent: string
  url: string
}

async function fetchCompetitorKeywords(competitorDomain: string, locationCode: number, langCode: string): Promise<CompetitorKeyword[]> {
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) return []
  
  try {
    const r = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live', {
      method: 'POST',
      headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        target: competitorDomain,
        location_code: locationCode,
        language_code: langCode,
        limit: 100,
        order_by: ['keyword_data.keyword_info.search_volume,desc'],
        filters: [
          ['ranked_serp_element.serp_item.rank_absolute', '<=', 20]
        ],
      }]),
      signal: AbortSignal.timeout(15000),
    })
    
    if (!r.ok) { await r.text(); return [] }
    trackPaidApiCall('analyze-content-gap', 'dataforseo', 'labs/ranked_keywords')
    
    const data = await r.json()
    const items = data.tasks?.[0]?.result?.[0]?.items || []
    
    return items.map((item: any) => ({
      keyword: item.keyword_data?.keyword || '',
      position: item.ranked_serp_element?.serp_item?.rank_absolute || 0,
      search_volume: item.keyword_data?.keyword_info?.search_volume || 0,
      difficulty: item.keyword_data?.keyword_info?.keyword_difficulty || 0,
      intent: item.keyword_data?.search_intent_info?.main_intent || 'informational',
      url: item.ranked_serp_element?.serp_item?.url || '',
    })).filter((k: CompetitorKeyword) => k.keyword && k.position > 0)
  } catch (e) {
    console.error(`[content-gap] Error fetching keywords for ${competitorDomain}:`, e)
    return []
  }
}

Deno.serve(handleRequest(async (req) => {
  const auth = await getAuthenticatedUser(req)
  if (!auth) return jsonError('Unauthorized', 401)

  const body = await req.json()
  const { tracked_site_id } = body
  if (!tracked_site_id) return jsonError('tracked_site_id required', 400)

  const supabase = getServiceClient()

  // 1. Get site info
  const { data: site } = await supabase
    .from('tracked_sites')
    .select('id, domain, user_id, site_identity_card')
    .eq('id', tracked_site_id)
    .maybeSingle()

  if (!site) return jsonError('Site not found', 404)

  const cleanDomain = site.domain.replace(/^www\./, '').toLowerCase()
  const siteCtx = site.site_identity_card as any || {}
  const locationCode = siteCtx.location_code || 2250
  const langCode = siteCtx.language_code || 'fr'

  // 2. Get our keywords from keyword_universe (GSC-sourced truth)
  const { data: ourKeywords } = await supabase
    .from('keyword_universe')
    .select('keyword, current_position, search_volume, intent, target_url')
    .eq('domain', cleanDomain)

  const ourKwMap = new Map<string, { position: number; volume: number }>()
  for (const kw of (ourKeywords || [])) {
    ourKwMap.set(kw.keyword.toLowerCase(), {
      position: kw.current_position || 999,
      volume: kw.search_volume || 0,
    })
  }

  // 3. Get competitors (from site identity card or content_gap_results history)
  let competitors: string[] = []
  if (siteCtx.competitors?.length) {
    competitors = siteCtx.competitors.slice(0, 3)
  } else {
    // Fetch from strategic-competitors cached data
    const { data: cached } = await supabase
      .from('audit_cache')
      .select('result_data')
      .eq('function_name', 'strategic-competitors')
      .ilike('cache_key', `%${cleanDomain}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (cached?.result_data) {
      const comp = (cached.result_data as any)?.competitors || []
      competitors = comp.map((c: any) => {
        const url = c.url || ''
        try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
      }).filter(Boolean).slice(0, 3)
    }
  }

  if (competitors.length === 0) {
    return jsonOk({ success: true, message: 'No competitors found. Run a strategic audit first.', gaps: [] })
  }

  console.log(`[content-gap] Analyzing ${cleanDomain} vs ${competitors.join(', ')}`)

  // 4. Fetch competitor keywords in parallel
  const competitorResults = await Promise.all(
    competitors.map(c => fetchCompetitorKeywords(c, locationCode, langCode).then(kws => ({ domain: c, keywords: kws })))
  )

  // 5. Compute gap
  const gapRows: any[] = []

  // Clear old results for this site
  await supabase
    .from('content_gap_results')
    .delete()
    .eq('tracked_site_id', tracked_site_id)

  for (const { domain: compDomain, keywords } of competitorResults) {
    for (const ck of keywords) {
      const kwLower = ck.keyword.toLowerCase()
      const ours = ourKwMap.get(kwLower)

      let gapType: string
      if (!ours || ours.position >= 100) {
        gapType = 'missing' // We don't rank at all
      } else if (ours.position > ck.position + 5) {
        gapType = 'weak' // We rank but much worse
      } else if (ours.position > ck.position) {
        gapType = 'opportunity' // Close, could overtake
      } else {
        continue // We already rank better
      }

      // Opportunity score: high volume + low difficulty + large gap = high opportunity
      const volumeScore = Math.min(ck.search_volume / 1000, 10)
      const difficultyPenalty = ck.difficulty / 100
      const gapBonus = gapType === 'missing' ? 2 : gapType === 'weak' ? 1.5 : 1
      const opportunityScore = Math.round((volumeScore * (1 - difficultyPenalty * 0.5) * gapBonus) * 10)

      gapRows.push({
        tracked_site_id,
        user_id: site.user_id,
        domain: cleanDomain,
        competitor_domain: compDomain,
        keyword: ck.keyword,
        search_volume: ck.search_volume,
        difficulty: ck.difficulty,
        competitor_position: ck.position,
        our_position: ours?.position || null,
        gap_type: gapType,
        intent: ck.intent,
        opportunity_score: opportunityScore,
      })
    }
  }

  // Deduplicate: keep best opportunity per keyword
  const bestPerKeyword = new Map<string, any>()
  for (const row of gapRows) {
    const existing = bestPerKeyword.get(row.keyword.toLowerCase())
    if (!existing || row.opportunity_score > existing.opportunity_score) {
      bestPerKeyword.set(row.keyword.toLowerCase(), row)
    }
  }

  const dedupedRows = [...bestPerKeyword.values()]
    .sort((a, b) => b.opportunity_score - a.opportunity_score)
    .slice(0, 200) // Keep top 200

  if (dedupedRows.length > 0) {
    // Insert in batches of 50
    for (let i = 0; i < dedupedRows.length; i += 50) {
      const batch = dedupedRows.slice(i, i + 50)
      const { error } = await supabase.from('content_gap_results').insert(batch)
      if (error) console.error(`[content-gap] Insert error batch ${i}:`, error)
    }
  }

  const summary = {
    total_gaps: dedupedRows.length,
    missing: dedupedRows.filter(r => r.gap_type === 'missing').length,
    weak: dedupedRows.filter(r => r.gap_type === 'weak').length,
    opportunity: dedupedRows.filter(r => r.gap_type === 'opportunity').length,
    competitors_analyzed: competitors.length,
    top_opportunities: dedupedRows.slice(0, 10).map(r => ({
      keyword: r.keyword,
      gap_type: r.gap_type,
      competitor: r.competitor_domain,
      competitor_position: r.competitor_position,
      our_position: r.our_position,
      volume: r.search_volume,
      score: r.opportunity_score,
    })),
  }

  console.log(`[content-gap] ✅ Found ${dedupedRows.length} gaps for ${cleanDomain}`)

  return jsonOk({ success: true, ...summary })
}))
