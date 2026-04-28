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

// ─── In-memory cache (per Deno isolate instance) ────────────────────
// Avoids redundant SELECTs when multiple functions run in parallel
// on the same isolate (e.g. Parmenion triggering 5 audits at once).
const CACHE_TTL_MS = 30_000 // 30 seconds
const siteCache = new Map<string, { data: SiteContext; expiresAt: number }>()

function getCached(key: string): SiteContext | null {
  const entry = siteCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    siteCache.delete(key)
    return null
  }
  return entry.data
}

function setCache(key: string, data: SiteContext): void {
  // Cap cache size to prevent memory leaks in long-lived isolates
  if (siteCache.size > 200) {
    const oldest = siteCache.keys().next().value
    if (oldest) siteCache.delete(oldest)
  }
  siteCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS })
}

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

const CONTEXT_FIELDS = 'id, domain, site_name, market_sector, products_services, target_audience, commercial_area, company_size, address, identity_confidence, identity_source, identity_enriched_at, primary_language, brand_name, business_type, competitors, cms_platform, founding_year, siren_siret, gmb_presence, gmb_city, social_profiles, legal_structure, client_targets, jargon_distance, commercial_model, nonprofit_type, entity_type, media_specialties, business_model, business_model_confidence, business_model_source'

/**
 * Fetch site from DB and ensure its identity card is enriched.
 * Returns null if no matching site found.
 */
export async function getSiteContext(
  supabase: any,
  params: GetContextParams,
): Promise<SiteContext | null> {
  // Build cache key
  const cacheKey = 'trackedSiteId' in params && params.trackedSiteId
    ? `id:${params.trackedSiteId}`
    : `dom:${(params as GetByDomain).domain?.toLowerCase()}`

  // Check cache first
  const cached = getCached(cacheKey)
  if (cached) {
    console.log(`[getSiteContext] ⚡ Cache hit for ${cacheKey}`)
    return cached
  }

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

  // Enrich and cache
  const enriched = await ensureSiteContext(site)
  if (enriched) {
    // Attach seasonal context + news
    try {
      const sector = enriched.market_sector || null
      const geo = 'FR'
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

      // Fetch seasonal events + news in parallel
      const [seasonalRes, newsRes] = await Promise.all([
        supabase.rpc('get_active_seasonal_context', { p_sector: sector, p_geo: geo }),
        supabase.rpc('get_seasonal_news', { p_sector: sector, p_geo: geo, p_limit: 5 }),
      ])

      const seasonalData = seasonalRes.data
      const newsData = newsRes.data

      if (seasonalData && seasonalData.length > 0) {
        ;(enriched as any).seasonal_context = seasonalData
        ;(enriched as any).current_season_summary = seasonalData
          .filter((s: any) => s.is_in_peak || s.is_in_prep)
          .map((s: any) => `${s.event_name} (${s.is_in_peak ? 'pic actuel' : `prépa, J-${s.days_until_start}`})`)
          .join(', ') || null
      } else if (sector && supabaseUrl && serviceKey) {
        // No seasonal data — trigger on-demand ingest (fire-and-forget)
        fetch(`${supabaseUrl}/functions/v1/ingest-seasonal-context`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'on-demand', sector, geo }),
        }).catch(e => console.warn('[getSiteContext] on-demand seasonal ingest failed:', e))
      }

      // Attach news
      if (newsData && newsData.length > 0) {
        ;(enriched as any).seasonal_news = newsData
        ;(enriched as any).news_summary = newsData
          .slice(0, 3)
          .map((n: any) => `[${n.news_type}] ${n.headline}`)
          .join(' | ')
      }
    } catch (e) {
      console.warn('[getSiteContext] seasonal context fetch failed:', e)
    }
    setCache(cacheKey, enriched)
  }
  return enriched
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
