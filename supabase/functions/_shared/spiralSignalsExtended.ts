/**
 * spiralSignalsExtended — Breathing Spiral: les 4 poids manquants de la formule cible
 *
 * 100 % déterministe (zéro appel LLM). Complète les 6 signaux historiques de
 * `compute-spiral-signals` :
 *
 *  7. Ring Proximity   (0-12) — proximité du cœur de métier (Ring 1 > 2 > 3)
 *  8. Anomaly Urgency  (0-12) — contraction défensive lors d'un événement perturbateur
 *  9. Seasonal Boost   (0-10) — fenêtre saisonnière active ou en préparation
 * 10. Keyword Coverage (0-10) — couverture SERP réelle du cluster (trou = priorité)
 */

export interface ExtendedSignalContext {
  /** cluster_id → ring (1 | 2 | 3) */
  ringByCluster: Map<string, number>
  /** boost site-level issu des anomalies récentes (0-15) */
  anomalyBoost: number
  /** cluster_id → couverture SERP en % (0-100) */
  coverageByCluster: Map<string, number>
  /** événements saisonniers pertinents pour le secteur du site */
  seasonalEvents: SeasonalEvent[]
}

export interface SeasonalEvent {
  event_name: string
  impact_level: string | null
  peak_keywords: string[]
  /** true si la fenêtre (prep incluse) est ouverte aujourd'hui */
  active: boolean
}

const RING_PROXIMITY_MAX = 12
const ANOMALY_URGENCY_MAX = 12
const SEASONAL_BOOST_MAX = 10
const COVERAGE_BOOST_MAX = 10

/** Position moyenne au-delà de laquelle un mot-clé n'est pas considéré comme couvert. */
const COVERED_POSITION_THRESHOLD = 20

// ─── Chargement du contexte (1 seul aller-retour par table) ────────────

export async function loadExtendedSignalContext(
  supabase: any,
  trackedSiteId: string,
  domain: string,
  anomalyBoost: number,
): Promise<ExtendedSignalContext> {
  const [ringByCluster, coverageByCluster, seasonalEvents] = await Promise.all([
    loadRingByCluster(supabase, trackedSiteId),
    loadCoverageByCluster(supabase, trackedSiteId, domain),
    loadSeasonalEvents(supabase, trackedSiteId),
  ])

  return { ringByCluster, anomalyBoost, coverageByCluster, seasonalEvents }
}

async function loadRingByCluster(supabase: any, trackedSiteId: string): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  const { data } = await supabase
    .from('cluster_definitions')
    .select('id, ring')
    .eq('tracked_site_id', trackedSiteId)
  for (const c of data || []) {
    const ring = Number(c.ring)
    map.set(c.id as string, ring === 1 || ring === 2 || ring === 3 ? ring : 3)
  }
  return map
}

async function loadCoverageByCluster(
  supabase: any,
  trackedSiteId: string,
  domain: string,
): Promise<Map<string, number>> {
  const totals = new Map<string, { total: number; covered: number }>()

  let { data } = await supabase
    .from('keyword_universe')
    .select('cluster_id, current_position')
    .eq('tracked_site_id', trackedSiteId)
    .not('cluster_id', 'is', null)
    .limit(3000)

  // Repli sur le domaine si l'univers a été indexé sans tracked_site_id
  if (!data?.length && domain) {
    const res = await supabase
      .from('keyword_universe')
      .select('cluster_id, current_position')
      .eq('domain', domain)
      .not('cluster_id', 'is', null)
      .limit(3000)
    data = res.data
  }

  for (const kw of data || []) {
    const entry = totals.get(kw.cluster_id as string) || { total: 0, covered: 0 }
    entry.total++
    const pos = kw.current_position === null || kw.current_position === undefined
      ? null
      : Number(kw.current_position)
    if (pos !== null && pos > 0 && pos <= COVERED_POSITION_THRESHOLD) entry.covered++
    totals.set(kw.cluster_id as string, entry)
  }

  const coverage = new Map<string, number>()
  for (const [clusterId, { total, covered }] of totals) {
    if (total < 3) continue // échantillon trop faible pour être exploitable
    coverage.set(clusterId, Math.round((covered / total) * 100))
  }
  return coverage
}

async function loadSeasonalEvents(supabase: any, trackedSiteId: string): Promise<SeasonalEvent[]> {
  const { data: site } = await supabase
    .from('tracked_sites')
    .select('identity_card')
    .eq('id', trackedSiteId)
    .maybeSingle()

  const identity = (site?.identity_card ?? {}) as Record<string, unknown>
  const sector = String(identity.market_sector ?? '').toLowerCase().trim()

  const { data: events } = await supabase
    .from('seasonal_context')
    .select('event_name, impact_level, peak_keywords, sectors, start_month, start_day, end_month, end_day, prep_weeks_before')
    .limit(200)

  const result: SeasonalEvent[] = []
  for (const ev of events || []) {
    const sectors: string[] = (ev.sectors || []).map((s: string) => String(s).toLowerCase())
    const sectorMatch = sectors.length === 0
      ? false
      : sectors.some((s) => sector.length > 2 && (sector.includes(s) || s.includes(sector)))
    if (!sectorMatch) continue

    if (!isWindowOpen(ev)) continue

    result.push({
      event_name: String(ev.event_name ?? ''),
      impact_level: ev.impact_level ? String(ev.impact_level) : null,
      peak_keywords: (ev.peak_keywords || []).map((k: string) => String(k).toLowerCase()),
      active: true,
    })
  }
  return result
}

/** Fenêtre saisonnière : [début − prep_weeks, fin], sans année (récurrence). */
function isWindowOpen(ev: any): boolean {
  const now = new Date()
  const year = now.getUTCFullYear()
  const sm = Number(ev.start_month), sd = Number(ev.start_day)
  const em = Number(ev.end_month), ed = Number(ev.end_day)
  if (!sm || !sd || !em || !ed) return false

  const prepDays = (Number(ev.prep_weeks_before) || 0) * 7
  const start = new Date(Date.UTC(year, sm - 1, sd))
  start.setUTCDate(start.getUTCDate() - prepDays)
  let end = new Date(Date.UTC(year, em - 1, ed))
  if (end < new Date(Date.UTC(year, sm - 1, sd))) end = new Date(Date.UTC(year + 1, em - 1, ed))

  return now >= start && now <= end
}

// ─── Calcul par item ──────────────────────────────────────────────────

export interface ExtendedSignals {
  ring_proximity_score: number
  anomaly_urgency_score: number
  seasonal_boost_score: number
  keyword_coverage_score: number
}

export function computeExtendedSignals(
  ctx: ExtendedSignalContext,
  item: { title?: string | null; description?: string | null; target_url?: string | null; cluster_id?: string | null },
): ExtendedSignals {
  const ring = item.cluster_id ? (ctx.ringByCluster.get(item.cluster_id) ?? 3) : 0

  // 7. Ring Proximity — plus l'item est proche du cœur de métier, plus il compte
  const ringProximity = ring === 1 ? RING_PROXIMITY_MAX
    : ring === 2 ? 7
    : ring === 3 ? 3
    : 5 // hors cluster (items tech) → neutre

  // 8. Anomaly Urgency — l'anomalie site-level est amplifiée sur Ring 1
  //    (contraction défensive) et atténuée sur Ring 3
  const ringFactor = ring === 1 ? 1.2 : ring === 2 ? 0.9 : ring === 3 ? 0.5 : 0.8
  const anomalyUrgency = Math.min(
    ANOMALY_URGENCY_MAX,
    Math.round(ctx.anomalyBoost * 0.8 * ringFactor),
  )

  // 9. Seasonal Boost — fenêtre ouverte + recoupement lexical avec l'item
  const haystack = `${item.title ?? ''} ${item.description ?? ''} ${item.target_url ?? ''}`.toLowerCase()
  let seasonalBoost = 0
  for (const ev of ctx.seasonalEvents) {
    const base = ev.impact_level === 'high' ? SEASONAL_BOOST_MAX
      : ev.impact_level === 'medium' ? 6
      : 3
    const keywordHit = ev.peak_keywords.some((k) => k.length > 2 && haystack.includes(k))
    const score = keywordHit ? base : Math.round(base * 0.4)
    if (score > seasonalBoost) seasonalBoost = score
  }
  seasonalBoost = Math.min(SEASONAL_BOOST_MAX, seasonalBoost)

  // 10. Keyword Coverage — un cluster peu couvert en SERP est prioritaire
  let coverageBoost = 0
  if (item.cluster_id && ctx.coverageByCluster.has(item.cluster_id)) {
    const coverage = ctx.coverageByCluster.get(item.cluster_id)!
    coverageBoost = Math.round(((100 - coverage) / 100) * COVERAGE_BOOST_MAX)
  }

  return {
    ring_proximity_score: ringProximity,
    anomaly_urgency_score: anomalyUrgency,
    seasonal_boost_score: seasonalBoost,
    keyword_coverage_score: coverageBoost,
  }
}
