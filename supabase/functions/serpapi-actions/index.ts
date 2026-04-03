import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * serpapi-actions — Router for SerpAPI operations
 *
 * Actions:
 *   - search: Run a Google search query via SerpAPI
 *   - search-local: Local search (Google Maps)
 *   - search-news: Google News search
 *   - search-images: Google Images search
 *   - get-cached: Retrieve cached results
 *
 * Requires secret: SERPAPI_KEY
 */

const SERPAPI_BASE = 'https://serpapi.com/search.json'

interface SearchParams {
  query: string
  tracked_site_id?: string
  engine?: string        // google, bing, yahoo, etc.
  location?: string      // e.g. "Paris, France"
  language?: string      // hl param, e.g. "fr"
  country?: string       // gl param, e.g. "fr"
  num?: number           // number of results (max 100)
  start?: number         // pagination offset
  device?: string        // desktop, mobile, tablet
  tbm?: string           // nws (news), isch (images), lcl (local)
}

Deno.serve(handleRequest(async (req) => {
try {
    const supabase = getServiceClient()
    const { action, ...params } = await req.json()

    // Auth check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonError('Unauthorized', 401)
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) {
      return jsonError('Invalid token', 401)
    }

    const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY')
    if (!SERPAPI_KEY) {
      return jsonError('SERPAPI_KEY not configured', 500)
    }

    switch (action) {
      case 'search':
      case 'search-local':
      case 'search-news':
      case 'search-images': {
        const {
          query,
          tracked_site_id,
          engine = 'google',
          location,
          language = 'fr',
          country = 'fr',
          num = 20,
          start = 0,
          device = 'desktop',
        } = params as SearchParams

        if (!query) {
          return jsonError('query required', 400)
        }

        // Determine tbm param based on action
        let tbm: string | undefined
        if (action === 'search-news') tbm = 'nws'
        else if (action === 'search-images') tbm = 'isch'
        else if (action === 'search-local') tbm = 'lcl'

        // Check cache first (24h TTL)
        const cacheKey = `${engine}:${query}:${location || ''}:${language}:${country}:${tbm || ''}:${device}:${start}`
        const { data: cached } = await supabase
          .from('serpapi_cache')
          .select('*')
          .eq('user_id', user.id)
          .eq('query_text', cacheKey)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (cached) {
          return jsonOk({
            ...cached.result_data,
            organic_results: cached.organic_results,
            ads_results: cached.ads_results,
            knowledge_graph: cached.knowledge_graph,
            related_searches: cached.related_searches,
            from_cache: true,
          })
        }

        // Build SerpAPI URL
        const url = new URL(SERPAPI_BASE)
        url.searchParams.set('api_key', SERPAPI_KEY)
        url.searchParams.set('engine', engine)
        url.searchParams.set('q', query)
        url.searchParams.set('hl', language)
        url.searchParams.set('gl', country)
        url.searchParams.set('num', String(num))
        url.searchParams.set('start', String(start))
        url.searchParams.set('device', device)
        if (location) url.searchParams.set('location', location)
        if (tbm) url.searchParams.set('tbm', tbm)

        const response = await fetch(url.toString())
        if (!response.ok) {
          const errBody = await response.text()
          console.error('[serpapi-actions] API error:', response.status, errBody)
          return new Response(JSON.stringify({ error: `SerpAPI error: ${response.status}`, detail: errBody }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const data = await response.json()

        // Extract key sections
        const organic = data.organic_results || []
        const ads = data.ads || data.shopping_results || []
        const kg = data.knowledge_graph || null
        const related = data.related_searches || data.related_questions || []
        const searchMeta = data.search_metadata || {}

        // Cache the result
        await supabase.from('serpapi_cache').insert({
          user_id: user.id,
          tracked_site_id: tracked_site_id || null,
          query_text: cacheKey,
          search_engine: engine,
          location: location || null,
          language,
          country,
          result_data: {
            search_information: data.search_information,
            total_results: data.search_information?.total_results,
            time_taken: data.search_information?.time_taken_displayed,
          },
          organic_results: organic,
          ads_results: ads,
          knowledge_graph: kg,
          related_searches: related,
          search_metadata: searchMeta,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })

        // Track API call
        await supabase.from('analytics_events').insert({
          user_id: user.id,
          event_type: 'api_call:serpapi',
          event_data: {
            action,
            query,
            engine,
            location,
            results_count: organic.length,
          },
        })

        return jsonOk({
          organic_results: organic,
          ads_results: ads,
          knowledge_graph: kg,
          related_searches: related,
          search_information: data.search_information,
          search_metadata: searchMeta,
          from_cache: false,
        })
      }

      case 'get-cached': {
        const { tracked_site_id, limit = 20 } = params

        let q = supabase
          .from('serpapi_cache')
          .select('*')
          .eq('user_id', user.id)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(limit)

        if (tracked_site_id) {
          q = q.eq('tracked_site_id', tracked_site_id)
        }

        const { data, error } = await q

        if (error) {
          return jsonError(error.message, 500)
        }

        return jsonOk({ data })
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[serpapi-actions] error:', msg)
    return jsonError(msg, 500)
  }
})