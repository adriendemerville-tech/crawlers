/**
 * gmb-optimization — GMB Profile completeness scoring & optimization suggestions
 * 
 * Actions:
 *   - score-profile: Calculates completeness score from location info
 *   - suggest-optimizations: Returns prioritized optimization suggestions
 *   - suggest-posts: Generates post ideas based on category & recent activity
 *   - compute-power-score: Computes & stores the 7-dimension GMB power score
 */
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { computeGmbPowerScore, getWeekStart, type GmbPowerInput } from '../_shared/gmbPowerScore.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function err(message: string, status = 400) { return json({ error: message }, status) }

interface ProfileField {
  field: string
  label: string
  weight: number
  present: boolean
  tip: string
}

function scoreProfile(locationData: any): { score: number; fields: ProfileField[]; grade: string } {
  const fields: ProfileField[] = [
    { field: 'name', label: 'Nom de l\'entreprise', weight: 10, present: !!locationData.name, tip: 'Ajoutez le nom exact de votre entreprise tel qu\'il apparaît légalement.' },
    { field: 'address', label: 'Adresse complète', weight: 10, present: !!locationData.address, tip: 'Renseignez votre adresse physique complète avec code postal.' },
    { field: 'phone', label: 'Numéro de téléphone', weight: 8, present: !!locationData.phone, tip: 'Ajoutez un numéro de téléphone local pour améliorer la confiance.' },
    { field: 'website', label: 'Site web', weight: 8, present: !!locationData.website, tip: 'Liez votre site web pour rediriger le trafic.' },
    { field: 'category', label: 'Catégorie principale', weight: 10, present: !!locationData.category, tip: 'Choisissez la catégorie la plus précise possible.' },
    { field: 'hours', label: 'Horaires d\'ouverture', weight: 8, present: !!(locationData.hours && Object.values(locationData.hours).some((h: any) => h !== null)), tip: 'Renseignez vos horaires pour chaque jour, y compris les jours fermés.' },
    { field: 'description', label: 'Description de l\'entreprise', weight: 10, present: !!locationData.description, tip: 'Rédigez une description de 750 caractères max intégrant vos mots-clés locaux.' },
    { field: 'photos', label: 'Photos (>5)', weight: 8, present: (locationData.photo_count || 0) >= 5, tip: 'Ajoutez au moins 5 photos HD : façade, intérieur, équipe, produits.' },
    { field: 'logo', label: 'Logo', weight: 5, present: !!locationData.logo_url, tip: 'Uploadez votre logo en haute résolution (250x250px min).' },
    { field: 'cover', label: 'Photo de couverture', weight: 5, present: !!locationData.cover_url, tip: 'Ajoutez une photo de couverture attrayante (1080x608px).' },
    { field: 'attributes', label: 'Attributs (Wi-Fi, parking...)', weight: 5, present: (locationData.attributes_count || 0) > 0, tip: 'Renseignez tous les attributs pertinents : Wi-Fi, parking, accessibilité PMR...' },
    { field: 'services', label: 'Liste de services/produits', weight: 5, present: (locationData.services_count || 0) > 0, tip: 'Ajoutez vos services avec descriptions et tarifs.' },
    { field: 'posts_recent', label: 'Posts récents (<30 jours)', weight: 4, present: !!locationData.has_recent_posts, tip: 'Publiez au moins 1 post par semaine : offres, actus, événements.' },
    { field: 'reviews_replied', label: 'Réponses aux avis (>80%)', weight: 4, present: (locationData.review_reply_rate || 0) >= 0.8, tip: 'Répondez à tous les avis, positifs comme négatifs, sous 24-48h.' },
  ]

  const maxScore = fields.reduce((s, f) => s + f.weight, 0)
  const currentScore = fields.filter(f => f.present).reduce((s, f) => s + f.weight, 0)
  const score = Math.round((currentScore / maxScore) * 100)

  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F'

  return { score, fields, grade }
}

function generateOptimizations(fields: ProfileField[], locationData: any): any[] {
  const missing = fields.filter(f => !f.present)
  
  const optimizations = missing.map((f, i) => ({
    priority: i + 1,
    field: f.field,
    label: f.label,
    impact_weight: f.weight,
    action: f.tip,
    difficulty: f.weight >= 8 ? 'easy' : 'medium',
    estimated_impact: f.weight >= 8 ? 'high' : f.weight >= 5 ? 'medium' : 'low',
  }))

  // Add category-specific suggestions
  const category = (locationData.category || '').toLowerCase()
  if (category.includes('restaurant') || category.includes('food')) {
    optimizations.push({
      priority: optimizations.length + 1,
      field: 'menu',
      label: 'Menu en ligne',
      impact_weight: 7,
      action: 'Ajoutez votre menu directement dans votre fiche GMB pour augmenter les conversions.',
      difficulty: 'medium',
      estimated_impact: 'high',
    })
  }

  if (category.includes('hôtel') || category.includes('hotel')) {
    optimizations.push({
      priority: optimizations.length + 1,
      field: 'booking',
      label: 'Lien de réservation',
      impact_weight: 7,
      action: 'Configurez le lien de réservation directe pour capter plus de clients.',
      difficulty: 'easy',
      estimated_impact: 'high',
    })
  }

  return optimizations.sort((a, b) => b.impact_weight - a.impact_weight)
}

function suggestPosts(locationData: any): any[] {
  const category = (locationData.category || '').toLowerCase()
  const name = locationData.name || 'votre entreprise'
  const now = new Date()
  const month = now.toLocaleDateString('fr-FR', { month: 'long' })

  const posts = [
    { type: 'UPDATE', title: `Actualité de ${month}`, content: `📢 Découvrez les nouveautés de ${name} ce mois-ci ! [Décrivez vos dernières actualités, offres ou changements]`, cta: 'En savoir plus', frequency: 'weekly' },
    { type: 'OFFER', title: 'Offre promotionnelle', content: `🎁 Offre spéciale chez ${name} ! [Détaillez votre promotion, durée, conditions]`, cta: 'Voir l\'offre', frequency: 'bi-weekly' },
    { type: 'EVENT', title: 'Événement à venir', content: `📅 Rejoignez-nous pour [nom de l'événement] ! [Date, lieu, programme]`, cta: 'S\'inscrire', frequency: 'monthly' },
    { type: 'PRODUCT', title: 'Produit/service en avant', content: `⭐ Focus sur [produit/service] — [description courte + avantage clé]`, cta: 'Commander', frequency: 'weekly' },
  ]

  // Category-specific posts
  if (category.includes('restaurant') || category.includes('traiteur')) {
    posts.push(
      { type: 'UPDATE', title: 'Plat du jour', content: `🍽️ Découvrez notre plat du jour : [nom du plat]. Fait maison avec des produits frais !`, cta: 'Réserver', frequency: 'daily' },
      { type: 'UPDATE', title: 'Coulisses cuisine', content: `👨‍🍳 En coulisses chez ${name} — notre chef prépare [plat]. Photo + recette simplifiée !`, cta: 'Voir le menu', frequency: 'weekly' },
    )
  }

  if (category.includes('agence') || category.includes('consultant')) {
    posts.push(
      { type: 'UPDATE', title: 'Étude de cas client', content: `📊 Comment nous avons aidé [client] à [résultat]. Découvrez notre méthodologie !`, cta: 'Nous contacter', frequency: 'monthly' },
      { type: 'UPDATE', title: 'Conseil expert', content: `💡 Conseil SEO/Marketing : [conseil actionnable en 2-3 phrases]. #expertise`, cta: 'En savoir plus', frequency: 'weekly' },
    )
  }

  return posts.map((p, i) => ({ ...p, id: `suggestion-${i + 1}` }))
}

Deno.serve(handleRequest(async (req) => {
try {
    const { action, tracked_site_id, ...params } = await req.json()

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return err('Unauthorized', 401)

    const userClient = getUserClient(authHeader)
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return err('Unauthorized', 401)
    if (!tracked_site_id) return err('tracked_site_id required')

    const sb = getServiceClient()

    // Fetch location info from gmb-actions first
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    let locationData = params.location_data
    if (!locationData) {
      // Try to get from gmb-actions
      const gmbRes = await fetch(`${supabaseUrl}/functions/v1/gmb-actions`, {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-location-info', tracked_site_id }),
      })
      const gmbData = await gmbRes.json()
      locationData = gmbData.data || {}
    }

    let result: any

    switch (action) {
      case 'score-profile': {
        const { score, fields, grade } = scoreProfile(locationData)
        result = { score, grade, fields, location_name: locationData.name || null, simulated: locationData.simulated ?? true }
        break
      }

      case 'audit-full': {
        const { score, fields, grade } = scoreProfile(locationData)
        const missing = fields.filter(f => !f.present)
        const completed = fields.filter(f => f.present)

        // Group by category
        const categories = [
          { id: 'identity', label: 'Identité', fields: ['name', 'category', 'description'] },
          { id: 'contact', label: 'Contact & accès', fields: ['address', 'phone', 'website', 'hours'] },
          { id: 'media', label: 'Médias', fields: ['photos', 'logo', 'cover'] },
          { id: 'enrichment', label: 'Enrichissement', fields: ['attributes', 'services'] },
          { id: 'engagement', label: 'Engagement', fields: ['posts_recent', 'reviews_replied'] },
        ]

        const auditCategories = categories.map(cat => {
          const catFields = fields.filter(f => cat.fields.includes(f.field))
          const catMax = catFields.reduce((s, f) => s + f.weight, 0)
          const catCurrent = catFields.filter(f => f.present).reduce((s, f) => s + f.weight, 0)
          return {
            id: cat.id,
            label: cat.label,
            score: catMax > 0 ? Math.round((catCurrent / catMax) * 100) : 100,
            total_points: catMax,
            earned_points: catCurrent,
            fields: catFields.map(f => ({
              field: f.field,
              label: f.label,
              present: f.present,
              weight: f.weight,
              fix_tip: f.tip,
              fix_difficulty: f.weight >= 8 ? 'easy' : f.weight >= 5 ? 'medium' : 'hard',
              fix_impact: f.weight >= 8 ? 'high' : f.weight >= 5 ? 'medium' : 'low',
              fix_action: f.present ? null : {
                type: 'update_field',
                field: f.field,
                instruction: f.tip,
                estimated_time_minutes: f.weight >= 8 ? 2 : f.weight >= 5 ? 5 : 10,
              },
            })),
          }
        })

        const priorityFixes = missing
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 5)
          .map((f, i) => ({
            rank: i + 1,
            field: f.field,
            label: f.label,
            points_gain: f.weight,
            new_score_estimate: Math.round(((fields.filter(ff => ff.present).reduce((s, ff) => s + ff.weight, 0) + f.weight) / fields.reduce((s, ff) => s + ff.weight, 0)) * 100),
            action: f.tip,
          }))

        result = {
          score,
          grade,
          total_points: fields.reduce((s, f) => s + f.weight, 0),
          earned_points: completed.reduce((s, f) => s + f.weight, 0),
          completed_count: completed.length,
          missing_count: missing.length,
          total_criteria: fields.length,
          categories: auditCategories,
          priority_fixes: priorityFixes,
          location_name: locationData.name || null,
          simulated: locationData.simulated ?? true,
        }
        break
      }

      case 'suggest-optimizations': {
        const { fields } = scoreProfile(locationData)
        const optimizations = generateOptimizations(fields, locationData)
        result = { optimizations, total_missing: optimizations.length }
        break
      }

      case 'suggest-posts': {
        result = { posts: suggestPosts(locationData) }
        break
      }

      case 'compute-power-score': {
        const powerInput: GmbPowerInput = {
          completeness: {
            name: locationData.name,
            address: locationData.address,
            phone: locationData.phone,
            website: locationData.website,
            category: locationData.category,
            hours: locationData.hours,
            description: locationData.description,
            attributes_count: locationData.attributes_count,
            services_count: locationData.services_count,
          },
          reputation: {
            rating: locationData.rating ?? params.rating,
            total_reviews: locationData.total_reviews ?? locationData.reviews_count ?? params.total_reviews,
            review_reply_rate: locationData.review_reply_rate ?? params.review_reply_rate,
          },
          activity: {
            has_recent_posts: locationData.has_recent_posts ?? params.has_recent_posts,
            posts_last_30_days: locationData.posts_last_30_days ?? params.posts_last_30_days,
            last_post_days_ago: params.last_post_days_ago,
            last_review_reply_days_ago: params.last_review_reply_days_ago,
          },
          local_serp: {
            local_pack_appearances: params.local_pack_appearances,
            local_pack_avg_position: params.local_pack_avg_position,
            total_local_keywords: params.total_local_keywords,
          },
          nap: {
            name_matches_site: params.name_matches_site,
            address_matches_site: params.address_matches_site,
            phone_matches_site: params.phone_matches_site,
            nap_score: params.nap_score,
          },
          media: {
            photo_count: locationData.photo_count ?? params.photo_count,
            has_logo: !!locationData.logo_url || params.has_logo,
            has_cover: !!locationData.cover_url || params.has_cover,
            has_video: params.has_video,
            owner_photos: params.owner_photos,
          },
          trust: {
            is_verified: locationData.is_verified ?? params.is_verified,
            is_claimed: locationData.is_claimed ?? params.is_claimed,
            years_active: params.years_active,
            has_website_link: !!locationData.website,
          },
        };

        const powerResult = computeGmbPowerScore(powerInput);

        // Get tracked_site domain
        const { data: siteRow } = await sb.from('tracked_sites').select('domain').eq('id', tracked_site_id).single();
        const domain = siteRow?.domain || locationData.name || '';

        const weekStart = getWeekStart();

        // Upsert snapshot
        await sb.from('gmb_power_snapshots').upsert({
          tracked_site_id,
          user_id: user.id,
          domain,
          total_score: powerResult.total_score,
          grade: powerResult.grade,
          completeness_score: powerResult.dimensions.completeness_score,
          reputation_score: powerResult.dimensions.reputation_score,
          activity_score: powerResult.dimensions.activity_score,
          local_serp_score: powerResult.dimensions.local_serp_score,
          nap_consistency_score: powerResult.dimensions.nap_consistency_score,
          media_score: powerResult.dimensions.media_score,
          trust_score: powerResult.dimensions.trust_score,
          raw_data: powerResult.raw_data,
          week_start_date: weekStart,
        }, { onConflict: 'tracked_site_id,week_start_date' });

        result = {
          ...powerResult,
          week_start_date: weekStart,
          stored: true,
        };
        break;
      }

      default:
        return err(`Unknown action: ${action}`)
    }

    // Log usage
    await sb.from('analytics_events').insert({
      user_id: user.id,
      event_type: `gmb-optimization:${action}`,
      event_data: { tracked_site_id, action },
    }).catch(() => {})

    return json(result)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[gmb-optimization] error:', msg)
    return json({ error: msg }, 500)
  }
})