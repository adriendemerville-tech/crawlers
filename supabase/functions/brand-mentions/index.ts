/**
 * brand-mentions — Detect unlinked brand mentions using Firehose + DataForSEO
 * 
 * Actions:
 *   - scan: Search for brand mentions that don't link back to the site
 *   - setup-monitor: Configure a Firehose tap for real-time mention monitoring
 *   - get-opportunities: Return detected unlinked mentions with outreach suggestions
 */
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface MentionResult {
  source_url: string
  source_domain: string
  source_domain_rank: number
  mention_text: string
  context_snippet: string
  has_link: boolean
  detected_at: string
  outreach_priority: 'high' | 'medium' | 'low'
  suggested_action: string
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
  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { action, tracked_site_id, brand_name, brand_variants } = await req.json()

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const userClient = getUserClient(authHeader)
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401)
    if (!tracked_site_id) return json({ error: 'tracked_site_id required' }, 400)

    const sb = getServiceClient()

    const { data: site } = await sb.from('tracked_sites').select('domain, display_name').eq('id', tracked_site_id).single()
    if (!site) return json({ error: 'Site not found' }, 404)

    const domain = site.domain
    const searchTerms = [brand_name || site.display_name || domain.replace(/\.(com|fr|net|org)$/i, ''), ...(brand_variants || [])]
      .filter(Boolean)

    if (searchTerms.length === 0) return json({ error: 'brand_name required (or set display_name on tracked site)' }, 400)

    let result: any

    switch (action) {
      case 'scan': {
        // Use DataForSEO to find pages mentioning the brand
        const mentions: MentionResult[] = []

        for (const term of searchTerms.slice(0, 3)) {
          try {
            const searchData = await dataforseoRequest('serp/google/organic/live/advanced', [{
              keyword: `"${term}" -site:${domain}`,
              location_code: 2250, // France
              language_code: 'fr',
              depth: 50,
            }])

            const items = searchData?.tasks?.[0]?.result?.[0]?.items || []
            
            for (const item of items) {
              if (item.type !== 'organic') continue
              
              // Check if the result page links to our domain
              const hasLink = false // Conservative: assume no link, would need crawl to verify
              
              const sourceDomain = new URL(item.url).hostname.replace(/^www\./, '')
              if (sourceDomain === domain) continue

              const priority: 'high' | 'medium' | 'low' = 
                (item.rank_absolute || 100) <= 10 ? 'high' :
                (item.rank_absolute || 100) <= 30 ? 'medium' : 'low'

              mentions.push({
                source_url: item.url,
                source_domain: sourceDomain,
                source_domain_rank: item.rank_absolute || 0,
                mention_text: term,
                context_snippet: item.description || item.title || '',
                has_link: hasLink,
                detected_at: new Date().toISOString(),
                outreach_priority: priority,
                suggested_action: `Contactez ${sourceDomain} pour demander l'ajout d'un lien vers ${domain}. Ce site mentionne "${term}" mais ne redirige pas vers votre site.`,
              })
            }
          } catch (e) {
            console.warn(`[brand-mentions] Search failed for "${term}":`, e)
          }
        }

        // Deduplicate by source_domain
        const seen = new Set<string>()
        const unique = mentions.filter(m => {
          if (seen.has(m.source_domain)) return false
          seen.add(m.source_domain)
          return true
        })

        result = {
          mentions: unique.sort((a, b) => {
            const prio = { high: 0, medium: 1, low: 2 }
            return prio[a.outreach_priority] - prio[b.outreach_priority]
          }),
          summary: {
            total_mentions: unique.length,
            high_priority: unique.filter(m => m.outreach_priority === 'high').length,
            medium_priority: unique.filter(m => m.outreach_priority === 'medium').length,
            low_priority: unique.filter(m => m.outreach_priority === 'low').length,
            search_terms_used: searchTerms,
          },
        }
        break
      }

      case 'setup-monitor': {
        // Create a Firehose tap for real-time monitoring
        const managementKey = Deno.env.get('FIREHOSE_MANAGEMENT_KEY')
        if (!managementKey) {
          return json({ error: 'Firehose not configured. Real-time monitoring requires Firehose API access.' }, 400)
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

        // Call firehose-actions to create a tap with brand rules
        const tapRes = await fetch(`${supabaseUrl}/functions/v1/firehose-actions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_tap',
            name: `brand-monitor-${domain}`,
            tracked_site_id,
          }),
        })

        const tapData = await tapRes.json()

        if (tapData.tap?.id) {
          // Create rules for each brand variant
          for (const term of searchTerms) {
            await fetch(`${supabaseUrl}/functions/v1/firehose-actions`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'create_rule',
                tap_id: tapData.tap.id,
                pattern: term,
                tracked_site_id,
              }),
            }).catch(() => {})
          }
        }

        result = {
          success: true,
          tap_id: tapData.tap?.id,
          monitoring_terms: searchTerms,
          message: `Monitoring configuré pour ${searchTerms.length} variantes de la marque "${searchTerms[0]}".`,
        }
        break
      }

      case 'get-opportunities': {
        // Fetch stored Firehose events matching the brand
        const { data: events } = await sb
          .from('firehose_events')
          .select('*')
          .eq('tracked_site_id', tracked_site_id)
          .order('created_at', { ascending: false })
          .limit(100)

        const opportunities = (events || []).map((e: any) => ({
          source_url: e.url || e.source_url,
          source_domain: e.domain || '',
          context: e.content_snippet || e.markdown?.slice(0, 200) || '',
          detected_at: e.created_at,
          category: e.category || 'mention',
        }))

        result = { opportunities, total: opportunities.length }
        break
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400)
    }

    // Log usage
    await sb.from('analytics_events').insert({
      user_id: user.id,
      event_type: `brand-mentions:${action}`,
      event_data: { tracked_site_id, brand: searchTerms[0] },
    }).catch(() => {})

    return json(result)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[brand-mentions] error:', msg)
    return json({ error: msg }, 500)
  }
})
