/**
 * enrichSiteContext — Auto-fills tracked_sites identity card via LLM
 * 
 * When a tracked site has empty context fields (market_sector, products_services,
 * target_audience, commercial_area), this helper asks an LLM to deduce them
 * from the domain name alone, then persists the result.
 * 
 * Uses Lovable AI Gateway (preferred) or OpenRouter as fallback.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const LOVABLE_AI_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

interface SiteContext {
  market_sector?: string
  products_services?: string
  target_audience?: string
  commercial_area?: string
  company_size?: string
  site_name?: string
}

interface EnrichResult {
  enriched: boolean
  context: SiteContext
}

/**
 * Check if a site needs enrichment (all key fields are empty)
 */
function needsEnrichment(site: Record<string, unknown>): boolean {
  return !site.market_sector && !site.products_services && !site.target_audience
}

/**
 * Call LLM to deduce site context from domain name
 */
async function inferContextFromDomain(
  domain: string,
  siteName: string,
): Promise<SiteContext | null> {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY')
  const openrouterKey = Deno.env.get('OPENROUTER_API_KEY')

  if (!lovableKey && !openrouterKey) return null

  const prompt = `Analyse le domaine "${domain}" (nom du site : "${siteName || domain}").

Déduis les informations suivantes sur cette entreprise/ce site web. Sois précis et concret.

Réponds UNIQUEMENT en JSON valide avec ces champs :
{
  "market_sector": "Le secteur d'activité principal (ex: 'E-commerce culturel et électronique', 'SaaS marketing', 'Restauration rapide')",
  "products_services": "Les principaux produits ou services vendus (ex: 'Livres, musique, électronique, jeux vidéo, billetterie spectacles', 'Logiciel d'emailing et CRM')",
  "target_audience": "La cible principale (ex: 'Grand public, consommateurs français', 'PME et startups B2B', 'Professionnels de santé')",
  "commercial_area": "La zone commerciale (ex: 'France métropolitaine et DOM-TOM', 'Europe francophone', 'International')",
  "company_size": "Estimation de la taille (ex: 'Grande entreprise', 'PME', 'Startup', 'ETI')",
  "site_name": "Le vrai nom de la marque/entreprise (ex: 'Fnac', 'Decathlon', 'Semrush')"
}

Si tu ne connais pas un champ, mets une valeur générique raisonnable basée sur le TLD et le nom de domaine. Ne laisse aucun champ vide.`

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
 * Returns the (possibly enriched) site context.
 */
export async function ensureSiteContext(
  site: Record<string, unknown>,
): Promise<SiteContext> {
  // If already enriched, return existing context
  if (!needsEnrichment(site)) {
    return {
      market_sector: site.market_sector as string | undefined,
      products_services: site.products_services as string | undefined,
      target_audience: site.target_audience as string | undefined,
      commercial_area: site.commercial_area as string | undefined,
      company_size: site.company_size as string | undefined,
      site_name: site.site_name as string | undefined,
    }
  }

  const domain = (site.domain as string) || ''
  const siteName = (site.site_name as string) || ''
  const siteId = site.id as string

  console.log(`[enrich-site] 🔍 ${domain} needs enrichment, calling LLM...`)

  const inferred = await inferContextFromDomain(domain, siteName)

  if (!inferred) {
    console.warn(`[enrich-site] ❌ Could not enrich ${domain}`)
    return {
      market_sector: site.market_sector as string | undefined,
      products_services: site.products_services as string | undefined,
      target_audience: site.target_audience as string | undefined,
      commercial_area: site.commercial_area as string | undefined,
      company_size: site.company_size as string | undefined,
      site_name: site.site_name as string | undefined,
    }
  }

  // Persist enriched data to tracked_sites
  if (siteId) {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, serviceKey)

      const updatePayload: Record<string, string> = {}
      if (inferred.market_sector) updatePayload.market_sector = inferred.market_sector
      if (inferred.products_services) updatePayload.products_services = inferred.products_services
      if (inferred.target_audience) updatePayload.target_audience = inferred.target_audience
      if (inferred.commercial_area) updatePayload.commercial_area = inferred.commercial_area
      if (inferred.company_size) updatePayload.company_size = inferred.company_size
      if (inferred.site_name && (!siteName || siteName === domain)) {
        updatePayload.site_name = inferred.site_name
      }

      if (Object.keys(updatePayload).length > 0) {
        const { error } = await supabase
          .from('tracked_sites')
          .update(updatePayload)
          .eq('id', siteId)

        if (error) {
          console.error(`[enrich-site] DB update error for ${domain}:`, error)
        } else {
          console.log(`[enrich-site] 💾 ${domain} identity card saved`)
        }
      }
    } catch (err) {
      console.error(`[enrich-site] Persist error:`, err)
    }
  }

  return {
    market_sector: inferred.market_sector || (site.market_sector as string | undefined),
    products_services: inferred.products_services || (site.products_services as string | undefined),
    target_audience: inferred.target_audience || (site.target_audience as string | undefined),
    commercial_area: inferred.commercial_area || (site.commercial_area as string | undefined),
    company_size: inferred.company_size || (site.company_size as string | undefined),
    site_name: inferred.site_name || (site.site_name as string | undefined),
  }
}
