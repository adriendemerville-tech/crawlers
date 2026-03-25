/**
 * link-intersection — Find shared backlinks across competitors using DataForSEO
 * 
 * Actions:
 *   - analyze: Compare backlink profiles of 2-5 domains to find intersection opportunities
 */
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function dataforseoRequest(endpoint: string, body: unknown): Promise<any> {
  const login = Deno.env.get('DATAFORSEO_LOGIN')
  const password = Deno.env.get('DATAFORSEO_PASSWORD')
  if (!login || !password) throw new Error('DataForSEO credentials not configured')

  const res = await fetch(`https://api.dataforseo.com/v3/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${login}:${password}`),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`DataForSEO API error: ${res.status}`)
  const data = await res.json()
  if (data.status_code !== 20000) throw new Error(`DataForSEO: ${data.status_message}`)
  return data
}

interface IntersectionResult {
  referring_domain: string
  domain_rank: number
  targets_linking_to: string[]
  targets_count: number
  backlink_type: string
  first_seen: string
  is_opportunity: boolean // links to competitors but not to user's site
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { action, tracked_site_id, competitor_domains } = await req.json()

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const userClient = getUserClient(authHeader)
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401)
    if (!tracked_site_id) return json({ error: 'tracked_site_id required' }, 400)
    if (action !== 'analyze') return json({ error: `Unknown action: ${action}` }, 400)

    const sb = getServiceClient()

    // Get user's domain
    const { data: site } = await sb.from('tracked_sites').select('domain').eq('id', tracked_site_id).single()
    if (!site) return json({ error: 'Site not found' }, 404)

    const userDomain = site.domain
    let competitors = competitor_domains || []

    // Auto-detect competitors if not provided
    if (competitors.length === 0) {
      const { data: compData } = await sb
        .from('strategic_competitors')
        .select('competitor_domain')
        .eq('tracked_site_id', tracked_site_id)
        .limit(4)
      competitors = (compData || []).map((c: any) => c.competitor_domain)
    }

    if (competitors.length === 0) {
      return json({ error: 'No competitors found. Add competitor domains or run strategic analysis first.' }, 400)
    }

    // DataForSEO Backlinks Intersection endpoint
    const targets = [userDomain, ...competitors.slice(0, 4)]
    
    const data = await dataforseoRequest('backlinks/domain_intersection/live', [{
      targets: Object.fromEntries(targets.map((d: string, i: number) => [(i + 1).toString(), d])),
      limit: 200,
      order_by: ['rank,desc'],
      filters: ['is_lost', '=', false],
    }])

    const rawResults = data?.tasks?.[0]?.result?.[0]?.items || []

    const results: IntersectionResult[] = rawResults.map((item: any) => {
      const targetLinks = targets.filter((_, i) => item[`target_${i + 1}`])
      return {
        referring_domain: item.domain || item.main_domain,
        domain_rank: item.rank || 0,
        targets_linking_to: targetLinks,
        targets_count: targetLinks.length,
        backlink_type: item.type || 'unknown',
        first_seen: item.first_seen || '',
        is_opportunity: !targetLinks.includes(userDomain) && targetLinks.length >= 2,
      }
    })

    // Separate opportunities (link to competitors but not us) from common links
    const opportunities = results.filter(r => r.is_opportunity).sort((a, b) => b.domain_rank - a.domain_rank)
    const common = results.filter(r => !r.is_opportunity).sort((a, b) => b.targets_count - a.targets_count)

    const summary = {
      total_referring_domains: results.length,
      opportunities_count: opportunities.length,
      common_links_count: common.length,
      avg_opportunity_rank: opportunities.length > 0
        ? Math.round(opportunities.reduce((s, o) => s + o.domain_rank, 0) / opportunities.length)
        : 0,
      competitors_analyzed: competitors,
    }

    // Log usage
    await sb.from('analytics_events').insert({
      user_id: user.id,
      event_type: 'link-intersection:analyze',
      event_data: { tracked_site_id, competitors_count: competitors.length, opportunities: opportunities.length },
    }).catch(() => {})

    return json({ opportunities, common, summary, user_domain: userDomain })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[link-intersection] error:', msg)
    return json({ error: msg }, 500)
  }
})
