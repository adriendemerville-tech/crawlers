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
import {
  extractStructuredIdentity,
  renderStructuredEvidenceBlock,
  type StructuredIdentitySignals,
} from './structuredIdentity.ts'
import {
  fetchSiteEvidence,
  renderSecondaryPagesBlock,
  renderStructuralBlock,
  type SiteEvidence,
} from './siteEvidence.ts'
import {
  deriveEnterpriseDimensions,
  extractSirenSiret,
  lookupSirene,
} from './enterpriseDimensions.ts'

const LOVABLE_AI_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

// Re-enrichment window: don't re-enrich if enriched less than 7 days ago
const RE_ENRICH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

export interface SiteContext {
  market_sector?: string
  products_services?: string
  /** Proposition de valeur CENTRALE : le besoin n°1 résolu, vu du client, sans nom de marque */
  value_proposition?: string
  /** Deux propositions de valeur SECONDAIRES, séparées par " ; " */
  secondary_propositions?: string
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

  // Carte d'identité antérieure à la proposition de valeur : un rafraîchissement
  // unique est nécessaire, sinon les benchmarks LLM ne testent jamais l'offre
  // centrale du site.
  if (!site.value_proposition && (site.identity_source as string) !== 'user_manual') return 'refresh'

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
 * Fetch real onsite evidence from the homepage (title, meta, headings, visible text).
 * Without this, the LLM can only guess from the domain name — which produced
 * hallucinated identity cards (e.g. dictadevi.io read as a transcription service
 * instead of a construction/renovation software platform).
 */
export interface OnsiteEvidence {
  title?: string
  description?: string
  headings: string[]
  text: string
  /** Signaux déclarés par le site : JSON-LD, microdata, manifeste web, Open Graph. */
  structured?: StructuredIdentitySignals | null
}

export async function fetchHomepageEvidence(domain: string): Promise<OnsiteEvidence | null> {
  const clean = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const urls = [`https://${clean}`, `https://www.${clean}`]

  for (const url of urls) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CrawlersBot/1.0; +https://crawlers.fr)' },
        redirect: 'follow',
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!resp.ok) continue
      const html = (await resp.text()).slice(0, 400_000)

      const title = html.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i)?.[1]?.trim()
      const description =
        html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]{0,400}?)["']/i)?.[1]?.trim() ||
        html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]{0,400}?)["']/i)?.[1]?.trim()

      const headings: string[] = []
      for (const m of html.matchAll(/<h[1-3][^>]*>([\s\S]{0,200}?)<\/h[1-3]>/gi)) {
        const h = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        if (h.length > 2 && headings.length < 25) headings.push(h)
      }

      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 3500)

      if (!title && !description && headings.length === 0 && text.length < 200) continue
      const structured = await extractStructuredIdentity(html, new URL(url).origin, { fetchManifest: true })
      return { title, description, headings, text, structured }
    } catch {
      continue
    }
  }
  return null
}

/**
 * Call LLM to deduce site context — from real onsite content when available,
 * otherwise (degraded) from the domain name.
 */
async function inferContextFromDomain(
  domain: string,
  siteName: string,
  existingContext?: SiteContext,
  evidence?: SiteEvidence | OnsiteEvidence | null,
): Promise<SiteContext | null> {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY')
  const openrouterKey = Deno.env.get('OPENROUTER_API_KEY')

  if (!lovableKey && !openrouterKey) return null

  // If we have existing context, ask LLM to verify/improve it
  const existingHint = existingContext?.market_sector
    ? `\n\nContexte existant (à VÉRIFIER contre le contenu réel, et à corriger s'il est faux) :
- Secteur: ${existingContext.market_sector || '?'}
- Produits/Services: ${existingContext.products_services || '?'}
- Proposition de valeur centrale: ${existingContext.value_proposition || '?'}
- Propositions secondaires: ${existingContext.secondary_propositions || '?'}
- Cible: ${existingContext.target_audience || '?'}
- Zone: ${existingContext.commercial_area || '?'}
- Taille: ${existingContext.company_size || '?'}`
    : ''

  const multi = (evidence as SiteEvidence | null | undefined)
  const evidenceBlock = evidence
    ? `\n\nCONTENU RÉEL DE LA PAGE D'ACCUEIL (source de vérité, prioritaire sur toute intuition liée au nom de domaine) :
Title: ${evidence.title || '—'}
Meta description: ${evidence.description || '—'}
Titres (H1-H3): ${evidence.headings.slice(0, 20).join(' | ') || '—'}${renderStructuredEvidenceBlock(evidence.structured)}
Texte visible: ${evidence.text}${renderSecondaryPagesBlock(multi?.pages ? multi : null)}${renderStructuralBlock(multi?.structural)}

Règles impératives :
- Déduis le secteur, les produits/services et la cible EXCLUSIVEMENT de ce contenu.
- N'interprète JAMAIS le nom de domaine pour inventer une activité (ex: un domaine contenant "dicta" ne signifie pas que le site vend de la transcription).
- Les faits structurels et les pages secondaires (offre, tarifs, mentions légales) l'emportent sur les formules marketing de l'accueil.
- Si le contexte existant contredit ce contenu, corrige-le.`
    : `\n\nAucun contenu de page n'a pu être récupéré : reste très générique, ne devine pas une activité précise à partir du nom de domaine.`


  const prompt = `Analyse le site "${domain}" (nom du site : "${siteName || domain}").${evidenceBlock}${existingHint}

Déduis les informations suivantes sur cette entreprise/ce site web. Sois précis et concret.

Réponds UNIQUEMENT en JSON valide avec ces champs :
{
  "entity_type": "Le type d'entité : 'business' (entreprise qui vend produits/services), 'media' (site d'information, journal, magazine), 'blog' (blog personnel ou thématique), 'institutional' (administration, gouvernement, association). IMPORTANT: un média/blog ne vend PAS de produits/services, il produit du contenu.",
  "commercial_model": "'commercial' si l'entité vend des produits/services à but lucratif, 'non_commercial' si c'est un service public, une association, une ONG, une fédération sportive, un syndicat ou toute organisation sans but lucratif.",
  "nonprofit_type": "Si commercial_model est 'non_commercial', précise le sous-type parmi : 'service_public' (mairie, préfecture, ministère, hôpital public, école publique), 'association_locale' (association loi 1901, club local, comité de quartier), 'ong' (ONG humanitaire, caritative, environnementale), 'organisation_internationale' (ONU, UNESCO, Croix-Rouge internationale), 'federation_sportive' (fédération, ligue, comité olympique), 'syndicat' (syndicat professionnel, patronal, interprofessionnel), 'autre' (fondation, mutuelle, coopérative). Si commercial_model est 'commercial', mettre null.",
  "media_specialties": ["Si entity_type est 'media' ou 'blog', liste les domaines de spécialité. Ex: ['politique', 'économie', 'tech']. Pour 'business', mettre []"],
  "market_sector": "Le secteur d'activité principal (ex: 'E-commerce culturel', 'Information politique', 'Blog tech')",
  "products_services": "Pour un business: les produits/services vendus. Pour un média/blog: les sujets couverts formulés comme des requêtes utilisateur (ex: 'actualité politique française, débats parlementaires, interviews ministres'). Pour un non_commercial: les services rendus ou missions principales.",
  "value_proposition": "LA proposition de valeur CENTRALE : une phrase courte et concrète décrivant le besoin n°1 que l'entité résout pour son client, formulée du point de vue du client, SANS nommer la marque ni le site. Ex: 'auditer et piloter le référencement SEO et GEO d'un site', 'rénover une salle de bain clé en main', 'acheter et faire livrer un bouquet de fleurs'.",
  "secondary_propositions": ["Deux propositions de valeur SECONDAIRES, réellement distinctes de la centrale, même format court, sans nom de marque"],
  "target_audience": "La cible principale, telle qu'elle apparaît dans le contenu (ex: 'Artisans du bâtiment', 'Grand public')",
  "commercial_area": "La zone géographique couverte",
  "company_size": "Estimation de la taille",
  "site_name": "Le vrai nom de la marque/entreprise/média/organisation"
}

Si tu ne connais pas un champ, mets une valeur générique raisonnable. Ne laisse aucun champ vide.`

  const messages = [
    { role: 'system', content: 'Tu es un analyste de marché expert. Tu te fondes uniquement sur les preuves fournies (contenu de la page) et jamais sur une intuition tirée du nom de domaine. Réponds uniquement en JSON valide.' },
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
      model: 'google/gemini-3-flash-preview',
    })
  }

  if (openrouterKey) {
    attempts.push({
      url: OPENROUTER_URL,
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://crawlers.fr',
        'X-Title': 'Crawlers.fr - Site Enrichment',
      },
      model: 'google/gemini-3-flash-preview',
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
    value_proposition: site.value_proposition as string | undefined,
    secondary_propositions: site.secondary_propositions as string | undefined,
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

  console.log(`[enrich-site] 🔍 ${domain} needs ${enrichmentType} enrichment, fetching homepage evidence...`)

  const evidence = await fetchHomepageEvidence(domain)
  if (!evidence) {
    console.warn(`[enrich-site] ⚠️ No onsite evidence for ${domain} — degraded inference`)
  }

  const inferred = await inferContextFromDomain(
    domain,
    siteName,
    enrichmentType === 'refresh' ? currentContext : undefined,
    evidence,
  )

  if (!inferred) {
    console.warn(`[enrich-site] ❌ Could not enrich ${domain}`)
    currentContext.identity_confidence = calculateConfidence(site)
    return currentContext
  }

  // Source quality depends on evidence: only onsite-grounded inference is "verified"
  const newSource = evidence ? 'llm_verified' : 'llm_auto'

  // With onsite evidence, the LLM output is authoritative over previous LLM guesses
  // (user_manual data stays protected downstream by the Identity Gateway).
  const authoritative = enrichmentType === 'full' || !!evidence
  const pick = (fresh?: string, current?: string) =>
    authoritative ? (fresh || current) : (current || fresh)

  const merged: SiteContext = {
    market_sector: pick(inferred.market_sector, currentContext.market_sector),
    products_services: pick(inferred.products_services, currentContext.products_services),
    value_proposition: pick(inferred.value_proposition, currentContext.value_proposition),
    secondary_propositions: pick(
      Array.isArray((inferred as unknown as { secondary_propositions?: unknown }).secondary_propositions)
        ? ((inferred as unknown as { secondary_propositions: string[] }).secondary_propositions)
            .map((v) => String(v || '').trim()).filter(Boolean).slice(0, 2).join(' ; ')
        : (inferred.secondary_propositions || undefined),
      currentContext.secondary_propositions,
    ),
    target_audience: pick(inferred.target_audience, currentContext.target_audience),
    commercial_area: pick(inferred.commercial_area, currentContext.commercial_area),
    company_size: pick(inferred.company_size, currentContext.company_size),
    site_name: inferred.site_name && (!siteName || siteName === domain) ? inferred.site_name : siteName,
    address: currentContext.address,
    entity_type: inferred.entity_type || currentContext.entity_type || 'business',
    media_specialties: inferred.media_specialties?.length ? inferred.media_specialties : (currentContext.media_specialties || []),
    commercial_model: inferred.commercial_model || currentContext.commercial_model,
    nonprofit_type: inferred.nonprofit_type || currentContext.nonprofit_type,
  }


  /**
   * Dimensions structurelles de l'entreprise (économie, statut légal, taille,
   * structuration, rôle dans la chaîne de valeur, relation client, mode de
   * livraison). Déterministe, sauf le croisement SIRENE (API publique gratuite,
   * jamais bloquant). Ces dimensions ne servent PAS toutes aux questions de
   * benchmark : le tri de pertinence est fait plus tard, croisé avec l'offre.
   */
  const legalBlob = [evidence?.text, evidence?.description, ...(evidence?.headings || [])].filter(Boolean).join(' ')
  const declaredSiren = (currentContext as Record<string, any>).siren_siret || extractSirenSiret(legalBlob)
  const sirene = declaredSiren ? await lookupSirene(String(declaredSiren)) : null
  const dimensions = deriveEnterpriseDimensions({
    products_services: merged.products_services,
    value_proposition: merged.value_proposition,
    market_sector: merged.market_sector,
    target_audience: merged.target_audience,
    business_model: (currentContext as Record<string, any>).business_model,
    entity_type: merged.entity_type,
    company_size: merged.company_size,
    legal_structure: (currentContext as Record<string, any>).legal_structure,
    siren_siret: declaredSiren ? String(declaredSiren) : null,
    legal_html: legalBlob,
    sirene,
  })
  ;(merged as Record<string, any>).enterprise_dimensions = dimensions
  console.log(`[enrich-site] dimensions ${domain}: ${dimensions.delivery_mode || '?'} / ${dimensions.customer_relation || '?'} / ${dimensions.economy_tier || '?'}${sirene ? ' (SIRENE croisé)' : ''}`)

  // Persist enriched data via Identity Gateway (single write point)
  if (siteId) {
    try {
      const fields: Record<string, unknown> = {}
      fields.enterprise_dimensions = dimensions
      if (dimensions.siren) fields.siren_siret = dimensions.siren
      if (dimensions.legal_form) fields.legal_structure = dimensions.legal_form
      if (merged.market_sector) fields.market_sector = merged.market_sector
      if (merged.products_services) fields.products_services = merged.products_services
      if (merged.value_proposition) fields.value_proposition = merged.value_proposition
      if (merged.secondary_propositions) fields.secondary_propositions = merged.secondary_propositions
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
