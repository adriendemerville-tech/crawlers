import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * gmb-actions — Router for Google My Business operations
 * 
 * Actions:
 *   - get-location: Fetch GMB location info
 *   - get-reviews: Fetch reviews for a location
 *   - reply-review: Reply to a review
 *   - flag-review: Flag a review
 *   - get-performance: Fetch performance stats
 *   - create-post: Create a new post
 *   - update-info: Update business info (hours, phone, etc.)
 *   - upload-photo: Upload a photo
 * 
 * NOTE: Currently returns simulated data. Will be connected to
 * Google Business Profile API once access is approved.
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = getServiceClient()
    const { action, ...params } = await req.json()

    // Auth check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    switch (action) {
      case 'get-performance': {
        const { tracked_site_id } = params
        if (!tracked_site_id) {
          return new Response(JSON.stringify({ error: 'tracked_site_id required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // TODO: Replace with real Google Business Profile Performance API call
        // For now, return simulated data
        const now = new Date()
        const weeks = Array.from({ length: 12 }, (_, i) => {
          const d = new Date(now.getTime() - (11 - i) * 7 * 24 * 60 * 60 * 1000)
          const weekStart = new Date(d)
          weekStart.setDate(d.getDate() - d.getDay() + 1)
          return weekStart.toISOString().split('T')[0]
        })

        const simulatedPerformance = weeks.map((week, i) => ({
          week_start_date: week,
          search_views: 120 + Math.floor(Math.random() * 80) + i * 5,
          maps_views: 80 + Math.floor(Math.random() * 60) + i * 3,
          website_clicks: 25 + Math.floor(Math.random() * 20) + i * 2,
          direction_requests: 8 + Math.floor(Math.random() * 12),
          phone_calls: 3 + Math.floor(Math.random() * 8),
          photo_views: 40 + Math.floor(Math.random() * 30) + i * 2,
        }))

        return new Response(JSON.stringify({
          data: simulatedPerformance,
          summary: {
            total_search_views: simulatedPerformance.reduce((s, w) => s + w.search_views, 0),
            total_maps_views: simulatedPerformance.reduce((s, w) => s + w.maps_views, 0),
            total_website_clicks: simulatedPerformance.reduce((s, w) => s + w.website_clicks, 0),
            total_direction_requests: simulatedPerformance.reduce((s, w) => s + w.direction_requests, 0),
            total_phone_calls: simulatedPerformance.reduce((s, w) => s + w.phone_calls, 0),
            avg_rating: 4.3,
            total_reviews: 47,
          },
          simulated: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'get-reviews': {
        // TODO: Connect to Google My Business v4 reviews API
        const simulatedReviews = [
          { id: '1', reviewer_name: 'Marie Dupont', star_rating: 5, comment: 'Excellent service, très professionnel !', review_created_at: '2026-03-10T10:00:00Z', reply_comment: 'Merci beaucoup Marie ! Nous sommes ravis de votre satisfaction.', is_flagged: false },
          { id: '2', reviewer_name: 'Jean Martin', star_rating: 4, comment: 'Très bien dans l\'ensemble, juste un petit temps d\'attente.', review_created_at: '2026-03-08T15:30:00Z', reply_comment: null, is_flagged: false },
          { id: '3', reviewer_name: 'Sophie Bernard', star_rating: 5, comment: 'Je recommande vivement, équipe au top !', review_created_at: '2026-03-05T09:15:00Z', reply_comment: 'Merci Sophie, au plaisir de vous revoir !', is_flagged: false },
          { id: '4', reviewer_name: 'Pierre Durand', star_rating: 2, comment: 'Accueil moyen, le produit n\'était pas en stock.', review_created_at: '2026-03-01T14:00:00Z', reply_comment: null, is_flagged: false },
          { id: '5', reviewer_name: 'Utilisateur Google', star_rating: 1, comment: 'Faux avis concurrent clairement...', review_created_at: '2026-02-28T11:00:00Z', reply_comment: null, is_flagged: true },
          { id: '6', reviewer_name: 'Claire Moreau', star_rating: 5, comment: 'Superbe expérience, je reviendrai !', review_created_at: '2026-02-25T16:45:00Z', reply_comment: 'Merci Claire !', is_flagged: false },
          { id: '7', reviewer_name: 'Luc Petit', star_rating: 4, comment: 'Bon rapport qualité-prix.', review_created_at: '2026-02-20T12:00:00Z', reply_comment: null, is_flagged: false },
          { id: '8', reviewer_name: 'Emma Laurent', star_rating: 3, comment: 'Correct sans plus, des améliorations possibles.', review_created_at: '2026-02-15T10:30:00Z', reply_comment: null, is_flagged: false },
        ]

        return new Response(JSON.stringify({
          data: simulatedReviews,
          total: simulatedReviews.length,
          avg_rating: 3.6,
          simulated: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'get-posts': {
        const simulatedPosts = [
          { id: '1', post_type: 'STANDARD', summary: '🎉 Nouvelle collection printemps disponible ! Venez découvrir nos nouveautés en magasin.', status: 'published', published_at: '2026-03-15T09:00:00Z', media_url: null },
          { id: '2', post_type: 'EVENT', summary: '📅 Journée portes ouvertes le 22 mars. Réductions exclusives de -20% sur tout le magasin.', status: 'published', published_at: '2026-03-10T10:00:00Z', media_url: null },
          { id: '3', post_type: 'OFFER', summary: '🔥 Offre spéciale : -15% avec le code SPRING26 jusqu\'au 31 mars.', status: 'draft', published_at: null, media_url: null },
        ]

        return new Response(JSON.stringify({
          data: simulatedPosts,
          simulated: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'get-location-info': {
        const simulatedInfo = {
          name: 'Mon Entreprise',
          address: '12 Rue de la Paix, 75002 Paris, France',
          phone: '+33 1 23 45 67 89',
          website: 'https://mon-entreprise.fr',
          category: 'Agence de communication',
          hours: {
            monday: { open: '09:00', close: '18:00' },
            tuesday: { open: '09:00', close: '18:00' },
            wednesday: { open: '09:00', close: '18:00' },
            thursday: { open: '09:00', close: '18:00' },
            friday: { open: '09:00', close: '17:00' },
            saturday: { open: '10:00', close: '13:00' },
            sunday: null,
          },
          photos_count: 24,
          verified: true,
        }

        return new Response(JSON.stringify({
          data: simulatedInfo,
          simulated: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[gmb-actions] error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
