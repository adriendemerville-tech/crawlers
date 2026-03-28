/**
 * enrichSiteContext — Auto-fills tracked_sites identity card via LLM
 * 
 * When a tracked site has empty context fields (market_sector, products_services,
 * target_audience, commercial_area), this helper asks an LLM to deduce them
 * from the domain name alone, then persists the result.
 * 
 * v2: Added confidence scoring algorithm
 * 
 * Uses Lovable AI Gateway (preferred) or OpenRouter as fallback.
 */

import { writeIdentity } from './identityGateway.ts'

const LOVABLE_AI_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

// Re-enrichment window: don't re-enrich if enriched less than 7 days ago
const RE_ENRICH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

export interface SiteContext {
  market_sector?: string
  products_services?: string
  target_audience?: string
  commercial_area?: string
  company_size?: string
  site_name?: string
  address?: string
  entity_type?: string        // 'business' | 'media' | 'blog' | 'institutional'
  media_specialties?: string[] // e.g. ['politique', 'économie', 'tech']
  commercial_model?: string   // 'commercial' | 'non_commercial'
  nonprofit_type?: string     // 'service_public' | 'association_locale' | 'ong' | 'organisation_internationale' | 'federation_sportive' | 'syndicat' | 'autre'
  identity_confidence?: number
  identity_source?: string
  identity_enriched_at?: string
}

interface EnrichResult {
  enriched: boolean
  context: SiteContext
}

/**
 * ─── Confidence Algorithm ────────────────────────────────────────────
 * 
 * Score 0–100 based on:
 *   - Field completeness (0–50 pts): 10 pts per filled key field (5 fields max)
 *   - Source quality (0–30 pts): user_manual=30, llm_verified=20, llm_auto=10, none=0
 *   - Freshness (0–20 pts): <7d=20, <30d=15, <90d=10, <180d=5, else=0
 */
export function calculateConfidence(site: Record<string, unknown>): number {
  let score = 0

  // 1. Field completeness (10 pts each, max 50)
  const keyFields = ['market_sector', 'products_services', 'target_audience', 'commercial_area', 'company_size']
  for (const f of keyFields) {
    if (site[f] && typeof site[f] === 'string' && (site[f] as string).trim().length > 2) {
      score += 10
    }
  }

  // 2. Source quality (max 30)
  const source = (site.identity_source as string) || 'none'
  if (source === 'user_manual') score += 30
  else if (source === 'llm_verified') score += 20
  else if (source === 'llm_auto') score += 10

  // 3. Freshness (max 20)
  const enrichedAt = site.identity_enriched_at as string | null
  if (enrichedAt) {
    const ageMs = Date.now() - new Date(enrichedAt).getTime()
    const days = ageMs / (24 * 60 * 60 * 1000)
    if (days < 7) score += 20
    else if (days < 30) score += 15
    else if (days < 90) score += 10
    else if (days < 180) score += 5
  }

  return Math.min(100, score)
}

/**
 * Check if a site needs enrichment
 * - All key fields empty → needs initial enrichment
 * - LLM-sourced + older than RE_ENRICH_INTERVAL → needs refresh
 */
function needsEnrichment(site: Record<string, unknown>): 'full' | 'refresh' | false {
  const hasFields = !!(site.market_sector || site.products_services || site.target_audience)
  
  if (!hasFields) return 'full'

  // If source is LLM and enrichment is stale, do a soft refresh
  const source = (site.identity_source as string) || 'none'
  const enrichedAt = site.identity_enriched_at as string | null
  
  if (source === 'user_manual') return false // Never overwrite user data
  
  if (enrichedAt) {
    const age = Date.now() - new Date(enrichedAt).getTime()
    if (age > RE_ENRICH_INTERVAL_MS) return 'refresh'
  } else if (hasFields && source !== 'user_manual') {
    // Has fields but no enriched_at → legacy data, mark for refresh
    return 'refresh'
  }

  return false
}

/**
 * Call LLM to deduce site context from domain name
 */
async function inferContextFromDomain(
  domain: string,
  siteName: string,
  existingContext?: SiteContext,
): Promise<SiteContext | null> {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY')
  const openrouterKey = Deno.env.get('OPENROUTER_API_KEY')

  if (!lovableKey && !openrouterKey) return null

  // If we have existing context, ask LLM to verify/improve it
  const existingHint = existingContext?.market_sector
    ? `\n\nContexte existant (à vérifier et améliorer si nécessaire) :
- Secteur: ${existingContext.market_sector || '?'}
- Produits/Services: ${existingContext.products_services || '?'}
- Cible: ${existingContext.target_audience || '?'}
- Zone: ${existingContext.commercial_area || '?'}
- Taille: ${existingContext.company_size || '?'}`
    : ''

  const prompt = `Analyse le domaine "${domain}" (nom du site : "${siteName || domain}").${existingHint}

Déduis les informations suivantes sur cette entreprise/ce site web. Sois précis et concret.

Réponds UNIQUEMENT en JSON valide avec ces champs :
{
  "entity_type": "Le type d'entité : 'business' (entreprise qui vend produits/services), 'media' (site d'information, journal, magazine), 'blog' (blog personnel ou thématique), 'institutional' (administration, gouvernement, association). IMPORTANT: un média/blog ne vend PAS de produits/services, il produit du contenu.",
  "commercial_model": "'commercial' si l'entité vend des produits/services à but lucratif, 'non_commercial' si c'est un service public, une association, une ONG, une fédération sportive, un syndicat ou toute organisation sans but lucratif.",
  "nonprofit_type": "Si commercial_model est 'non_commercial', précise le sous-type parmi : 'service_public' (mairie, préfecture, ministère, hôpital public, école publique), 'association_locale' (association loi 1901, club local, comité de quartier), 'ong' (ONG humanitaire, caritative, environnementale), 'organisation_internationale' (ONU, UNESCO, Croix-Rouge internationale), 'federation_sportive' (fédération, ligue, comité olympique), 'syndicat' (syndicat professionnel, patronal, interprofessionnel), 'autre' (fondation, mutuelle, coopérative). Si commercial_model est 'commercial', mettre null.",
  "media_specialties": ["Si entity_type est 'media' ou 'blog', liste les domaines de spécialité. Ex: ['politique', 'économie', 'tech', 'sport']. Pour 'business', mettre []"],
  "market_sector": "Le secteur d'activité principal (ex: 'E-commerce culturel', 'Information politique', 'Blog tech')",
  "products_services": "Pour un business: les produits/services vendus. Pour un média/blog: les sujets couverts formulés comme des requêtes utilisateur (ex: 'actualité politique française, débats parlementaires, interviews ministres'). Pour un non_commercial: les services rendus ou missions principales.",
  "target_audience": "La cible principale (ex: 'Grand public', 'Citoyens français intéressés par la politique')",
  "commercial_area": "La zone géographique couverte",
  "company_size": "Estimation de la taille",
  "site_name": "Le vrai nom de la marque/entreprise/média/organisation"
}

Si tu ne connais pas un champ, mets une valeur générique raisonnable. Ne laisse aucun champ vide.`

  const messages = [
    { role: 'system', content: 'Tu es un analyste de marché expert. Tu connais très bien les entreprises et marques du web. Réponds uniquement en JSON valide.' },
    { role: 'user', content: prompt },
  ]

  // Try Lovable AI first, then OpenRouter
  const attempts: Array<{ url: string; headers: Record<string, string>; model: string }> = []

  if (lovableKey) {
    attempts.push({
      url: LOVABLE_AI_URL,
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      model: 'google/gemini-2.5-flash',
    })
  }

  if (openrouterKey) {
    attempts.push({
      url: OPENROUTER_URL,
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://crawlers.lovable.app',
        'X-Title': 'Crawlers.fr - Site Enrichment',
      },
      model: 'google/gemini-2.5-flash',
    })
  }

  for (const attempt of attempts) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)

      const resp = await fetch(attempt.url, {
        method: 'POST',
        headers: attempt.headers,
        body: JSON.stringify({
          model: attempt.model,
          messages,
          temperature: 0.3,
          max_tokens: 500,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!resp.ok) {
        console.warn(`[enrich-site] ${attempt.url} returned ${resp.status}`)
        continue
      }

      const data = await resp.json()
      const content = data.choices?.[0]?.message?.content || ''

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.warn('[enrich-site] No JSON found in LLM response')
        continue
      }

      const parsed = JSON.parse(jsonMatch[0])
      console.log(`[enrich-site] ✅ ${domain} enriched: sector="${parsed.market_sector}", products="${parsed.products_services?.slice(0, 50)}"`)
      return parsed as SiteContext
    } catch (err) {
      console.warn(`[enrich-site] Attempt failed for ${domain}:`, err)
      continue
    }
  }

  return null
}

/**
 * Main enrichment function: checks if site needs enrichment, calls LLM, persists result.
 * Returns the (possibly enriched) site context with confidence score.
 * 
 * @param site - The tracked_sites row (must include id, domain, site_name, and context fields)
 * @param forceRefresh - Force re-enrichment even if data is fresh
 */
export async function ensureSiteContext(
  site: Record<string, unknown>,
  forceRefresh = false,
): Promise<SiteContext> {
  const enrichmentType = forceRefresh ? 'refresh' : needsEnrichment(site)

  // Build current context
  const currentContext: SiteContext = {
    market_sector: site.market_sector as string | undefined,
    products_services: site.products_services as string | undefined,
    target_audience: site.target_audience as string | undefined,
    commercial_area: site.commercial_area as string | undefined,
    company_size: site.company_size as string | undefined,
    site_name: site.site_name as string | undefined,
    address: site.address as string | undefined,
    entity_type: (site.entity_type as string) || 'business',
    media_specialties: (site.media_specialties as string[]) || [],
    commercial_model: site.commercial_model as string | undefined,
    nonprofit_type: site.nonprofit_type as string | undefined,
    identity_confidence: site.identity_confidence as number | undefined,
    identity_source: site.identity_source as string | undefined,
    identity_enriched_at: site.identity_enriched_at as string | undefined,
  }

  // If no enrichment needed, just recalculate confidence and return
  if (!enrichmentType) {
    currentContext.identity_confidence = calculateConfidence(site)
    return currentContext
  }

  const domain = (site.domain as string) || ''
  const siteName = (site.site_name as string) || ''
  const siteId = site.id as string

  console.log(`[enrich-site] 🔍 ${domain} needs ${enrichmentType} enrichment, calling LLM...`)

  const inferred = await inferContextFromDomain(
    domain,
    siteName,
    enrichmentType === 'refresh' ? currentContext : undefined,
  )

  if (!inferred) {
    console.warn(`[enrich-site] ❌ Could not enrich ${domain}`)
    currentContext.identity_confidence = calculateConfidence(site)
    return currentContext
  }

  // Determine source: if this is a refresh of existing LLM data, mark as verified
  const previousSource = (site.identity_source as string) || 'none'
  const newSource = enrichmentType === 'refresh' && previousSource === 'llm_auto'
    ? 'llm_verified'
    : 'llm_auto'

  // Merge: for refresh, only overwrite empty fields (don't destroy user edits)
  const merged: SiteContext = {
    market_sector: (enrichmentType === 'full' ? inferred.market_sector : (currentContext.market_sector || inferred.market_sector)),
    products_services: (enrichmentType === 'full' ? inferred.products_services : (currentContext.products_services || inferred.products_services)),
    target_audience: (enrichmentType === 'full' ? inferred.target_audience : (currentContext.target_audience || inferred.target_audience)),
    commercial_area: (enrichmentType === 'full' ? inferred.commercial_area : (currentContext.commercial_area || inferred.commercial_area)),
    company_size: (enrichmentType === 'full' ? inferred.company_size : (currentContext.company_size || inferred.company_size)),
    site_name: inferred.site_name && (!siteName || siteName === domain) ? inferred.site_name : siteName,
    address: currentContext.address,
    entity_type: inferred.entity_type || currentContext.entity_type || 'business',
    media_specialties: inferred.media_specialties?.length ? inferred.media_specialties : (currentContext.media_specialties || []),
    commercial_model: inferred.commercial_model || currentContext.commercial_model,
    nonprofit_type: inferred.nonprofit_type || currentContext.nonprofit_type,
  }

  // Persist enriched data via Identity Gateway (single write point)
  if (siteId) {
    try {
      const fields: Record<string, unknown> = {}
      if (merged.market_sector) fields.market_sector = merged.market_sector
      if (merged.products_services) fields.products_services = merged.products_services
      if (merged.target_audience) fields.target_audience = merged.target_audience
      if (merged.commercial_area) fields.commercial_area = merged.commercial_area
      if (merged.company_size) fields.company_size = merged.company_size
      if (merged.entity_type) fields.entity_type = merged.entity_type
      if (merged.media_specialties?.length) fields.media_specialties = merged.media_specialties
      if (merged.commercial_model) fields.commercial_model = merged.commercial_model
      if (merged.nonprofit_type) fields.nonprofit_type = merged.nonprofit_type
      if (merged.site_name && merged.site_name !== domain) {
        fields.site_name = merged.site_name
      }

      const result = await writeIdentity({
        siteId,
        fields,
        source: newSource as any,
        forceDirectWrite: true, // enrichSiteContext always does direct writes
      })

      merged.identity_confidence = result.confidence
      merged.identity_source = newSource
      merged.identity_enriched_at = new Date().toISOString()
      
      console.log(`[enrich-site] 💾 ${domain} via gateway: ${result.applied.length} applied, confidence: ${result.confidence}`)
    } catch (err) {
      console.error(`[enrich-site] Persist error:`, err)
    }
  }

  return merged
}
