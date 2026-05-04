import { corsHeaders } from '../_shared/cors.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * gmb-places-autocomplete — Google Places Autocomplete proxy
 * Returns place suggestions for the GMB competitor search bar.
 * Uses Google Places API (New) — ~$2.83/1000 requests.
 */

const GOOGLE_PLACES_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY')

Deno.serve(handleRequest(async (req) => {
  try {
    if (!GOOGLE_PLACES_API_KEY) {
      return jsonError('GOOGLE_PLACES_API_KEY not configured', 500)
    }

    const { query, location_bias } = await req.json()

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return jsonOk({ predictions: [] })
    }

    // Use Places API (New) Autocomplete
    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json')
    url.searchParams.set('input', query.trim())
    url.searchParams.set('key', GOOGLE_PLACES_API_KEY)
    url.searchParams.set('types', 'establishment')
    url.searchParams.set('language', 'fr')
    url.searchParams.set('components', 'country:fr')

    if (location_bias) {
      url.searchParams.set('location', location_bias)
      url.searchParams.set('radius', '10000') // 10km
    }

    const response = await fetch(url.toString())
    if (!response.ok) {
      console.error('[gmb-places-autocomplete] Google API error:', response.status)
      return jsonError('Google API error', { predictions: [] }, 502)
    }

    const data = await response.json()

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('[gmb-places-autocomplete] API status:', data.status, data.error_message)
      return jsonError(data.error_message || data.status, predictions: [], 502)
    }

    // Fetch details for each place to get rating, reviews, etc.
    const predictions = (data.predictions || []).slice(0, 5)
    const enriched = await Promise.all(
      predictions.map(async (p: any) => {
        const base = {
          place_id: p.place_id,
          name: p.structured_formatting?.main_text || p.description,
          address: p.structured_formatting?.secondary_text || '',
          description: p.description,
        }

        // Get place details (rating, reviews, website, phone)
        try {
          const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json')
          detailsUrl.searchParams.set('place_id', p.place_id)
          detailsUrl.searchParams.set('key', GOOGLE_PLACES_API_KEY)
          detailsUrl.searchParams.set('fields', 'rating,user_ratings_total,website,formatted_phone_number,types')
          detailsUrl.searchParams.set('language', 'fr')

          const detRes = await fetch(detailsUrl.toString())
          if (detRes.ok) {
            const detData = await detRes.json()
            const r = detData.result || {}
            return {
              ...base,
              rating: r.rating || null,
              reviews_count: r.user_ratings_total || null,
              website: r.website || null,
              phone: r.formatted_phone_number || null,
              category: r.types?.[0]?.replace(/_/g, ' ') || null,
            }
          }
        } catch (e) {
          console.error('[gmb-places-autocomplete] Details error:', e)
        }

        return base
      })
    )

    return jsonOk({ predictions: enriched })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[gmb-places-autocomplete] error:', msg)
    return jsonError(msg, predictions: [], 500)
  }
})