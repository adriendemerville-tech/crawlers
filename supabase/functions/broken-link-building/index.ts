/**
 * broken-link-building — Find broken backlink opportunities on competitor sites
 * 
 * Uses DataForSEO to find 404 pages on competitor domains that have backlinks,
 * then suggests replacement content the user could create.
 * 
 * Actions:
 *   - scan: Scan competitor domains for broken backlink opportunities
 */
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

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

interface BrokenLinkOpportunity {
  broken_url: string
  competitor_domain: string
  referring_domains_count: number
  referring_pages: Array<{
    url: string
    domain: string
    domain_rank: number
    anchor: string
  }>
  topic_hint: string
  difficulty: 'easy' | 'medium' | 'hard'
  potential_value: number // estimated based on referring domain quality
}

Deno.serve(handleRequest(async (req) => {
try {
    const { action, tracked_site_id, competitor_domains } = await req.json()

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const userClient = getUserClient(authHeader)
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401)
    if (!tracked_site_id) return json({ error: 'tracked_site_id required' }, 400)
    if (action !== 'scan') return json({ error: `Unknown action: ${action}` }, 400)

    const sb = getServiceClient()

    const { data: site } = await sb.from('tracked_sites').select('domain').eq('id', tracked_site_id).single()
    if (!site) return json({ error: 'Site not found' }, 404)

    let competitors = competitor_domains || []
    if (competitors.length === 0) {
      const { data: compData } = await sb
        .from('strategic_competitors')
        .select('competitor_domain')
        .eq('tracked_site_id', tracked_site_id)
        .limit(5)
      competitors = (compData || []).map((c: any) => c.competitor_domain)
    }

    if (competitors.length === 0) {
      return json({ error: 'No competitors found. Provide competitor_domains or run strategic analysis first.' }, 400)
    }

    const opportunities: BrokenLinkOpportunity[] = []

    for (const competitor of competitors.slice(0, 3)) {
      try {
        // Find broken pages on competitor site
        const brokenData = await dataforseoRequest('backlinks/broken_pages/live', [{
          target: competitor,
          limit: 50,
          order_by: ['rank,desc'],
        }])

        const brokenPages = brokenData?.tasks?.[0]?.result?.[0]?.items || []

        for (const page of brokenPages) {
          if (!page.broken_url && !page.url) continue

          const brokenUrl = page.broken_url || page.url
          const refDomains = page.referring_domains || page.referring_main_domains || 0

          if (refDomains === 0) continue

          // Extract topic from URL path
          const urlPath = new URL(brokenUrl).pathname
          const topicHint = urlPath
            .split('/')
            .filter(Boolean)
            .pop()
            ?.replace(/[-_]/g, ' ')
            .replace(/\.\w+$/, '') || 'unknown'

          // Get referring pages for this broken URL
          let referringPages: any[] = []
          try {
            const refData = await dataforseoRequest('backlinks/referring_pages/live', [{
              target: brokenUrl,
              limit: 10,
              order_by: ['rank,desc'],
            }])
            referringPages = (refData?.tasks?.[0]?.result?.[0]?.items || []).map((r: any) => ({
              url: r.url || r.page_from,
              domain: r.main_domain || r.domain_from || '',
              domain_rank: r.rank || r.domain_from_rank || 0,
              anchor: r.anchor || '',
            }))
          } catch { /* skip if rate limited */ }

          const avgRank = referringPages.length > 0
            ? referringPages.reduce((s, r) => s + r.domain_rank, 0) / referringPages.length
            : 0

          opportunities.push({
            broken_url: brokenUrl,
            competitor_domain: competitor,
            referring_domains_count: refDomains,
            referring_pages: referringPages,
            topic_hint: topicHint,
            difficulty: refDomains >= 20 ? 'hard' : refDomains >= 5 ? 'medium' : 'easy',
            potential_value: Math.round(refDomains * (avgRank / 100 + 1)),
          })
        }
      } catch (e) {
        console.warn(`[broken-link-building] Error scanning ${competitor}:`, e)
      }
    }

    // Sort by potential value
    opportunities.sort((a, b) => b.potential_value - a.potential_value)

    const summary = {
      competitors_scanned: competitors.length,
      total_opportunities: opportunities.length,
      total_potential_referring_domains: opportunities.reduce((s, o) => s + o.referring_domains_count, 0),
      easy_wins: opportunities.filter(o => o.difficulty === 'easy').length,
      medium: opportunities.filter(o => o.difficulty === 'medium').length,
      hard: opportunities.filter(o => o.difficulty === 'hard').length,
    }

    await sb.from('analytics_events').insert({
      user_id: user.id,
      event_type: 'broken-link-building:scan',
      event_data: { tracked_site_id, ...summary },
    }).catch(() => {})

    return json({ opportunities: opportunities.slice(0, 50), summary, user_domain: site.domain })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[broken-link-building] error:', msg)
    return json({ error: msg }, 500)
  }
})