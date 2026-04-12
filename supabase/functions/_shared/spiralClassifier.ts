/**
 * spiralClassifier — Breathing Spiral: Classifies keywords into semantic rings and assigns clusters
 * 
 * Part of the Breathing Spiral system — a homeostatic SEO engine that dynamically
 * oscillates between contraction (Ring 1 consolidation) and expansion (Ring 2/3 growth).
 * 
 * Ring 1 (Core): Keywords directly matching the site's market_sector + products_services
 * Ring 2 (Adjacent): Keywords related to target_audience, use cases, or complementary topics
 * Ring 3 (Authority): Broader industry/informational keywords
 * 
 * Also creates/updates cluster_definitions and assigns cluster_id to keywords.
 */

import { getServiceClient } from './supabaseClient.ts'

interface SiteIdentity {
  market_sector?: string
  products_services?: string
  target_audience?: string
  brand_name?: string
  entity_type?: string
  media_specialties?: string[]
}

interface ClassifiedKeyword {
  keyword: string
  ring: number // 1, 2, or 3
  cluster_name: string
}

/**
 * Build ring classification terms from the identity card.
 * Ring 1 terms = core business concepts
 * Ring 2 terms = audience + adjacent concepts
 */
function buildRingTerms(identity: SiteIdentity): { ring1: string[], ring2: string[] } {
  const ring1: string[] = []
  const ring2: string[] = []

  // Ring 1: market sector + products/services + brand
  if (identity.market_sector) {
    ring1.push(...identity.market_sector.toLowerCase().split(/[,;/|]+/).map(s => s.trim()).filter(Boolean))
  }
  if (identity.products_services) {
    ring1.push(...identity.products_services.toLowerCase().split(/[,;/|]+/).map(s => s.trim()).filter(Boolean))
  }
  if (identity.brand_name) {
    ring1.push(identity.brand_name.toLowerCase().trim())
  }
  if (identity.media_specialties?.length) {
    ring1.push(...identity.media_specialties.map(s => s.toLowerCase().trim()))
  }

  // Ring 2: target audience + entity-related terms
  if (identity.target_audience) {
    ring2.push(...identity.target_audience.toLowerCase().split(/[,;/|]+/).map(s => s.trim()).filter(Boolean))
  }

  return { ring1, ring2 }
}

/**
 * Jaccard-like token overlap score between a keyword and a set of reference terms.
 * Returns a value between 0 and 1.
 */
function tokenOverlap(keyword: string, referenceTerms: string[]): number {
  if (referenceTerms.length === 0) return 0

  const kwTokens = new Set(
    keyword.toLowerCase()
      .replace(/[^a-zàâäéèêëïîôùûüÿçœæ0-9\s-]/g, '')
      .split(/[\s-]+/)
      .filter(t => t.length > 2)
  )

  if (kwTokens.size === 0) return 0

  let bestScore = 0
  for (const term of referenceTerms) {
    const termTokens = new Set(
      term.replace(/[^a-zàâäéèêëïîôùûüÿçœæ0-9\s-]/g, '')
        .split(/[\s-]+/)
        .filter(t => t.length > 2)
    )
    if (termTokens.size === 0) continue

    // Count intersection
    let intersection = 0
    for (const t of kwTokens) {
      for (const rt of termTokens) {
        if (t === rt || t.includes(rt) || rt.includes(t)) {
          intersection++
          break
        }
      }
    }

    const union = new Set([...kwTokens, ...termTokens]).size
    const score = union > 0 ? intersection / union : 0
    if (score > bestScore) bestScore = score
  }

  return bestScore
}

/**
 * Classify a single keyword into a ring based on identity card overlap.
 */
function classifyKeyword(keyword: string, ring1Terms: string[], ring2Terms: string[]): number {
  const r1Score = tokenOverlap(keyword, ring1Terms)
  const r2Score = tokenOverlap(keyword, ring2Terms)

  if (r1Score >= 0.3) return 1
  if (r2Score >= 0.3 || r1Score >= 0.15) return 2
  return 3
}

/**
 * Derive a cluster name from a keyword by taking the first 2-3 meaningful tokens.
 */
function deriveClusterName(keyword: string): string {
  const tokens = keyword
    .toLowerCase()
    .replace(/[^a-zàâäéèêëïîôùûüÿçœæ0-9\s-]/g, '')
    .split(/[\s-]+/)
    .filter(t => t.length > 2)
    .slice(0, 3)

  return tokens.join(' ') || keyword.substring(0, 30)
}

/**
 * Main classification function.
 * 
 * 1. Fetches the site's identity card
 * 2. Classifies each keyword into Ring 1/2/3
 * 3. Creates/updates cluster_definitions
 * 4. Updates keyword_universe with semantic_ring and cluster_id
 * 
 * @param domain - The site domain
 * @param userId - The user ID
 * @param trackedSiteId - The tracked site ID (optional)
 * @param keywords - Array of { keyword, target_url? }
 */
export async function classifyAndAssignRings(
  domain: string,
  userId: string,
  trackedSiteId: string | null,
  keywords: { keyword: string; target_url?: string }[],
): Promise<{ classified: number; clusters_created: number }> {
  if (!keywords.length || !trackedSiteId) return { classified: 0, clusters_created: 0 }

  const supabase = getServiceClient()

  // 1. Fetch identity card
  const { data: site } = await supabase
    .from('tracked_sites')
    .select('market_sector, products_services, target_audience, brand_name, entity_type, media_specialties')
    .eq('id', trackedSiteId)
    .maybeSingle()

  const identity: SiteIdentity = site || {}
  const { ring1, ring2 } = buildRingTerms(identity)

  // 2. Classify keywords
  const classified: ClassifiedKeyword[] = keywords.map(kw => {
    const ring = classifyKeyword(kw.keyword, ring1, ring2)
    const clusterName = deriveClusterName(kw.keyword)
    return { keyword: kw.keyword, ring, cluster_name: clusterName }
  })

  // 3. Group by cluster name and determine cluster ring (majority vote)
  const clusterGroups = new Map<string, { ring: number; keywords: string[] }>()
  for (const kw of classified) {
    const existing = clusterGroups.get(kw.cluster_name)
    if (existing) {
      existing.keywords.push(kw.keyword)
    } else {
      clusterGroups.set(kw.cluster_name, { ring: kw.ring, keywords: [kw.keyword] })
    }
  }

  // 4. Upsert cluster_definitions
  let clustersCreated = 0
  const clusterIdMap = new Map<string, string>()

  for (const [clusterName, group] of clusterGroups) {
    const { data: existing } = await supabase
      .from('cluster_definitions')
      .select('id, keywords')
      .eq('tracked_site_id', trackedSiteId)
      .eq('cluster_name', clusterName)
      .maybeSingle()

    if (existing) {
      // Merge keywords
      const mergedKw = [...new Set([...(existing.keywords || []), ...group.keywords])]
      await supabase
        .from('cluster_definitions')
        .update({ keywords: mergedKw, ring: group.ring, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      clusterIdMap.set(clusterName, existing.id)
    } else {
      const { data: inserted } = await supabase
        .from('cluster_definitions')
        .insert({
          tracked_site_id: trackedSiteId,
          user_id: userId,
          cluster_name: clusterName,
          ring: group.ring,
          keywords: group.keywords,
        })
        .select('id')
        .maybeSingle()

      if (inserted) {
        clusterIdMap.set(clusterName, inserted.id)
        clustersCreated++
      }
    }
  }

  // 5. Update keyword_universe with semantic_ring and cluster_id
  for (const kw of classified) {
    const clusterId = clusterIdMap.get(kw.cluster_name)
    await supabase
      .from('keyword_universe')
      .update({ semantic_ring: kw.ring, cluster_id: clusterId || null })
      .eq('domain', domain)
      .ilike('keyword', kw.keyword)
  }

  console.log(`[spiralClassifier] ✅ ${domain}: ${classified.length} keywords classified (R1:${classified.filter(k => k.ring === 1).length}, R2:${classified.filter(k => k.ring === 2).length}, R3:${classified.filter(k => k.ring === 3).length}), ${clustersCreated} new clusters`)

  return { classified: classified.length, clusters_created: clustersCreated }
}
