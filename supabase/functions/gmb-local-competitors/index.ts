import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { trackPaidApiCall } from '../_shared/tokenTracker.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * gmb-local-competitors — Scan & track local competitors on Google Maps
 *
 * Actions:
 *   - scan: Find competitors via DataForSEO Maps + SerpAPI fallback
 *   - list: Get stored competitor snapshots
 *
 * Requires: DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD, SERPAPI_KEY
 */

const DATAFORSEO_LOGIN = Deno.env.get('DATAFORSEO_LOGIN')
const DATAFORSEO_PASSWORD = Deno.env.get('DATAFORSEO_PASSWORD')
const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY')

function getAuthHeader(): string {
  return `Basic ${btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`)}`
}

// Estimate search radius based on category
function estimateRadiusKm(category: string, city: string): number {
  const localCategories = ['restaurant', 'boulangerie', 'coiffeur', 'salon', 'café', 'bar', 'pizzeria', 'boucherie', 'fleuriste', 'pharmacie']
  const regionalCategories = ['avocat', 'dentiste', 'médecin', 'garage', 'agence immobilière', 'comptable', 'architecte', 'notaire']

  const catLower = (category || '').toLowerCase()
  if (localCategories.some(c => catLower.includes(c))) return 3
  if (regionalCategories.some(c => catLower.includes(c))) return 10
  return 5 // default
}

interface CompetitorItem {
  name: string
  place_id?: string
  address?: string
  category?: string
  website?: string
  phone?: string
  rating?: number
  reviews_count?: number
  position: number
  distance_km?: number
}

async function scanViaDataForSEO(query: string, location: string): Promise<CompetitorItem[] | null> {
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) return null

  try {
    const response = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/advanced', {
      method: 'POST',
      headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        keyword: query,
        location_name: location,
        language_name: 'French',
        depth: 20,
      }]),
    })

    if (!response.ok) {
      console.error('[gmb-local-competitors] DataForSEO error:', response.status)
      return null
    }

    trackPaidApiCall('gmb-local-competitors', 'dataforseo', 'serp/google/maps')
    const data = await response.json()
    const items = data.tasks?.[0]?.result?.[0]?.items || []

    return items
      .filter((item: any) => item.type === 'maps_search')
      .slice(0, 10)
      .map((item: any, idx: number) => ({
        name: item.title || 'Unknown',
        place_id: item.place_id || null,
        address: item.address || null,
        category: item.category || null,
        website: item.url || item.domain || null,
        phone: item.phone || null,
        rating: item.rating?.value || null,
        reviews_count: item.rating?.votes_count || null,
        position: item.rank_absolute || idx + 1,
        distance_km: null,
      }))
  } catch (e) {
    console.error('[gmb-local-competitors] DataForSEO error:', e)
    return null
  }
}

async function scanViaSerpAPI(query: string, location: string): Promise<CompetitorItem[] | null> {
  if (!SERPAPI_KEY) return null

  try {
    const url = new URL('https://serpapi.com/search.json')
    url.searchParams.set('api_key', SERPAPI_KEY)
    url.searchParams.set('engine', 'google_maps')
    url.searchParams.set('q', query)
    url.searchParams.set('ll', '') // Will use location text
    url.searchParams.set('type', 'search')
    url.searchParams.set('hl', 'fr')

    // SerpAPI uses location text
    if (location) url.searchParams.set('location', location)

    const response = await fetch(url.toString())
    if (!response.ok) return null

    const data = await response.json()
    const results = data.local_results || []

    return results.slice(0, 10).map((item: any, idx: number) => ({
      name: item.title || 'Unknown',
      place_id: item.place_id || null,
      address: item.address || null,
      category: item.type || null,
      website: item.website || null,
      phone: item.phone || null,
      rating: item.rating || null,
      reviews_count: item.reviews || null,
      position: item.position || idx + 1,
      distance_km: null,
    }))
  } catch (e) {
    console.error('[gmb-local-competitors] SerpAPI error:', e)
    return null
  }
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

    // Pro Agency check
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan_type')
      .eq('user_id', user.id)
      .single()

    const isAdmin = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' })
    if (profile?.plan_type !== 'agency_pro' && !isAdmin?.data) {
      return jsonError('Pro Agency required', 403)
    }

    switch (action) {
      case 'scan': {
        const { gmb_location_id, tracked_site_id } = params

        if (!gmb_location_id || !tracked_site_id) {
          return jsonError('gmb_location_id and tracked_site_id required', 400)
        }

        // Fetch GMB location data
        const { data: gmbLoc } = await supabase
          .from('gmb_locations')
          .select('location_name, category, address')
          .eq('id', gmb_location_id)
          .eq('user_id', user.id)
          .single()

        if (!gmbLoc) {
          return jsonError('GMB location not found', 404)
        }

        // Build search query from category + city
        const addressParts = (gmbLoc.address || '').split(',').map((s: string) => s.trim())
        const city = addressParts.length >= 2 ? addressParts[addressParts.length - 2] : addressParts[0] || 'France'
        const category = gmbLoc.category || gmbLoc.location_name
        const searchQuery = `${category} ${city}`
        const locationText = `${city}, France`

        console.log(`[gmb-local-competitors] Scanning: "${searchQuery}" in "${locationText}"`)

        // Try DataForSEO first, fallback to SerpAPI
        let competitors = await scanViaDataForSEO(searchQuery, locationText)
        let source = 'dataforseo'

        if (!competitors || competitors.length === 0) {
          console.log('[gmb-local-competitors] Falling back to SerpAPI...')
          competitors = await scanViaSerpAPI(searchQuery, locationText)
          source = 'serpapi'
        }

        if (!competitors || competitors.length === 0) {
          return jsonOk({ error: 'No competitors found', competitors: [] })
        }

        // Filter out own business
        const ownName = gmbLoc.location_name.toLowerCase()
        const filtered = competitors.filter(c =>
          !c.name.toLowerCase().includes(ownName) && !ownName.includes(c.name.toLowerCase())
        ).slice(0, 10)

        const weekStart = new Date()
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
        const weekStr = weekStart.toISOString().split('T')[0]

        // Get previous week's data for position change
        const prevWeek = new Date(weekStart)
        prevWeek.setDate(prevWeek.getDate() - 7)
        const prevWeekStr = prevWeek.toISOString().split('T')[0]

        const { data: prevData } = await supabase
          .from('gmb_local_competitors')
          .select('competitor_place_id, maps_position')
          .eq('gmb_location_id', gmb_location_id)
          .eq('snapshot_week', prevWeekStr)

        const prevMap = new Map((prevData || []).map(d => [d.competitor_place_id, d.maps_position]))

        // Upsert competitors
        for (const comp of filtered) {
          const prevPos = comp.place_id ? prevMap.get(comp.place_id) : null
          const posChange = prevPos != null && comp.position != null ? prevPos - comp.position : 0

          await supabase.from('gmb_local_competitors').upsert({
            user_id: user.id,
            tracked_site_id,
            gmb_location_id,
            competitor_name: comp.name,
            competitor_place_id: comp.place_id,
            competitor_address: comp.address,
            competitor_category: comp.category,
            competitor_website: comp.website,
            competitor_phone: comp.phone,
            avg_rating: comp.rating,
            total_reviews: comp.reviews_count,
            maps_position: comp.position,
            previous_position: prevPos || null,
            position_change: posChange,
            search_query: searchQuery,
            snapshot_week: weekStr,
          }, {
            onConflict: 'gmb_location_id,competitor_place_id,snapshot_week',
          })
        }

        // Track API call
        await supabase.from('analytics_events').insert({
          user_id: user.id,
          event_type: 'api_call:gmb_local_competitors',
          event_data: { action: 'scan', source, query: searchQuery, results_count: filtered.length },
        })

        return jsonOk({
          competitors: filtered,
          search_query: searchQuery,
          location: locationText,
          source,
          radius_km: estimateRadiusKm(category, city),
        })
      }

      case 'list': {
        const { gmb_location_id } = params

        if (!gmb_location_id) {
          return jsonError('gmb_location_id required', 400)
        }

        // Get latest week's competitors
        const { data, error } = await supabase
          .from('gmb_local_competitors')
          .select('*')
          .eq('gmb_location_id', gmb_location_id)
          .eq('user_id', user.id)
          .order('snapshot_week', { ascending: false })
          .order('maps_position', { ascending: true })
          .limit(10)

        if (error) {
          return jsonError(error.message, 500)
        }

        return jsonOk({ competitors: data || [] })
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[gmb-local-competitors] error:', msg)
    return jsonError(msg, 500)
  }
}))