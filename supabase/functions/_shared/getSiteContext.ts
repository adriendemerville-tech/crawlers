/**
 * getSiteContext — Universal helper to fetch + enrich site identity card
 * 
 * Works with either a tracked_site_id OR a domain name.
 * Always calls ensureSiteContext to keep the card fresh.
 * 
 * Usage in any edge function:
 *   import { getSiteContext } from '../_shared/getSiteContext.ts'
 *   const ctx = await getSiteContext(supabase, { domain: 'example.com' })
 *   // or
 *   const ctx = await getSiteContext(supabase, { trackedSiteId: 'uuid', userId: 'uuid' })
 */

import { ensureSiteContext, SiteContext } from './enrichSiteContext.ts'

interface GetByDomain {
  domain: string
  trackedSiteId?: never
  userId?: string
}

interface GetBySiteId {
  trackedSiteId: string
  userId?: string
  domain?: never
}

type GetContextParams = GetByDomain | GetBySiteId

const CONTEXT_FIELDS = 'id, domain, site_name, market_sector, products_services, target_audience, commercial_area, company_size, address, identity_confidence, identity_source, identity_enriched_at, primary_language, brand_name, business_type, competitors, cms_platform, founding_year, siren_siret, gmb_presence, gmb_city, social_profiles'

/**
 * Fetch site from DB and ensure its identity card is enriched.
 * Returns null if no matching site found.
 */
export async function getSiteContext(
  supabase: any,
  params: GetContextParams,
): Promise<SiteContext | null> {
  let site: Record<string, unknown> | null = null

  if ('trackedSiteId' in params && params.trackedSiteId) {
    let query = supabase
      .from('tracked_sites')
      .select(CONTEXT_FIELDS)
      .eq('id', params.trackedSiteId)

    if (params.userId) {
      query = query.eq('user_id', params.userId)
    }

    const { data, error } = await query.maybeSingle()
    if (error) {
      console.warn(`[getSiteContext] DB error for site ${params.trackedSiteId}:`, error.message)
    }
    site = data
  } else if ('domain' in params && params.domain) {
    // Normalize domain
    const normalizedDomain = params.domain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '')
      .toLowerCase()

    let query = supabase
      .from('tracked_sites')
      .select(CONTEXT_FIELDS)
      .ilike('domain', `%${normalizedDomain}%`)

    if (params.userId) {
      query = query.eq('user_id', params.userId)
    }

    const { data, error } = await query.limit(1).maybeSingle()
    if (error) {
      console.warn(`[getSiteContext] DB error for domain ${normalizedDomain}:`, error.message)
    }
    site = data
  }

  if (!site) return null

  // Enrich and return
  return ensureSiteContext(site)
}

/**
 * Extract domain from a URL string
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '')
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
  }
}
