/**
 * gmb-optimization — GMB Profile completeness scoring & optimization suggestions
 * 
 * Actions:
 *   - score-profile: Calculates completeness score from location info
 *   - suggest-optimizations: Returns prioritized optimization suggestions
 *   - suggest-posts: Generates post ideas based on category & recent activity
 */
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

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
