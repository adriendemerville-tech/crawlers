/**
 * ctrOpportunities — Quick wins CTR déterministes (zéro LLM, zéro crédit)
 *
 * Principe : une page positionnée 4-10 avec beaucoup d'impressions mais un CTR
 * nettement sous le benchmark de sa position perd des clics récupérables par
 * simple réécriture du title / de la meta description.
 *
 *  1. Search Console 28 j, dimensions [page, query]
 *  2. Agrégation par page : impressions, clics, position moyenne pondérée
 *  3. Écart au benchmark CTR par position → clics récupérables estimés
 *  4. Au-delà des seuils de confiance → alerte `gsc_ctr` dans anomaly_alerts
 *     (elle remonte automatiquement dans le bandeau défilant de /console)
 */
import { resolveGscAccess, queryGscRows, gscWindow, type GscAccess } from '../_shared/gscQuery.ts'

export const CTR_SOURCE = 'gsc_ctr'

/** Benchmark CTR (%) par position moyenne — courbe déterministe, aucune API externe. */
const CTR_BENCHMARK: Record<number, number> = {
  1: 27.6, 2: 15.8, 3: 11.0, 4: 8.0, 5: 6.1, 6: 4.9, 7: 4.0, 8: 3.3, 9: 2.7, 10: 2.2,
}

function expectedCtr(position: number): number {
  const p = Math.max(1, Math.min(10, position))
  const lo = Math.floor(p)
  const hi = Math.min(10, lo + 1)
  const a = CTR_BENCHMARK[lo]
  const b = CTR_BENCHMARK[hi]
  return a + (b - a) * (p - lo)
}

export interface CtrThresholds {
  minImpressions: number      // sur 28 jours
  minGapRatio: number         // CTR réel sous le benchmark (0.30 = 30 %)
  minRecoverableClicks: number
  maxPerSite: number
}

export const CTR_DEFAULTS: CtrThresholds = {
  minImpressions: 500,
  minGapRatio: 0.30,
  minRecoverableClicks: 50,
  maxPerSite: 20,
}

interface PageAgg {
  page: string
  impressions: number
  clicks: number
  weightedPos: number
  topQuery: string
  topQueryImpressions: number
}

/**
 * Détecte et enregistre les opportunités CTR d'un site.
 * Retourne le nombre d'alertes créées (0 si pas de connexion Search Console).
 */
export async function detectCtrOpportunities(
  supabase: any,
  site: { id: string; domain: string; user_id: string },
  th: CtrThresholds = CTR_DEFAULTS,
): Promise<number> {
  const cleanDomain = site.domain.replace(/^www\./, '').toLowerCase()

  let access: GscAccess | null = null
  try {
    access = await resolveGscAccess(supabase, site.user_id, site.domain)
  } catch (e) {
    console.error(`[ctr-opportunities] accès GSC impossible ${cleanDomain}:`, e)
  }
  if (!access) return 0

  const { startDate, endDate } = gscWindow(28)
  const rows = await queryGscRows(access, {
    startDate,
    endDate,
    dimensions: ['page', 'query'],
    rowLimit: 5000,
  })
  if (!rows.length) return 0

  const byPage = new Map<string, PageAgg>()
  for (const r of rows) {
    if (!r.page || !r.impressions) continue
    const agg = byPage.get(r.page) ?? {
      page: r.page, impressions: 0, clicks: 0, weightedPos: 0, topQuery: '', topQueryImpressions: 0,
    }
    agg.impressions += r.impressions
    agg.clicks += r.clicks
    agg.weightedPos += r.position * r.impressions
    if (r.impressions > agg.topQueryImpressions) {
      agg.topQueryImpressions = r.impressions
      agg.topQuery = r.query
    }
    byPage.set(r.page, agg)
  }

  const candidates = [...byPage.values()]
    .map((agg) => {
      const position = agg.impressions > 0 ? agg.weightedPos / agg.impressions : 0
      const actualCtr = agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0
      const benchmark = expectedCtr(position)
      const gapRatio = benchmark > 0 ? (benchmark - actualCtr) / benchmark : 0
      const recoverableClicks = Math.round(agg.impressions * ((benchmark - actualCtr) / 100))
      return { ...agg, position, actualCtr, benchmark, gapRatio, recoverableClicks }
    })
    .filter((c) =>
      c.position >= 3.5 && c.position <= 10.5 &&
      c.impressions >= th.minImpressions &&
      c.gapRatio >= th.minGapRatio &&
      c.recoverableClicks >= th.minRecoverableClicks
    )
    .sort((a, b) => b.recoverableClicks - a.recoverableClicks)
    .slice(0, th.maxPerSite)

  // Purge des opportunités obsolètes (les alertes écartées restent en historique)
  await supabase.from('anomaly_alerts').delete()
    .eq('tracked_site_id', site.id).eq('metric_source', CTR_SOURCE).eq('is_dismissed', false)

  if (!candidates.length) return 0

  // Respecte les opportunités déjà écartées par l'utilisateur (30 derniers jours)
  const since = new Date(Date.now() - 30 * 86400_000).toISOString()
  const { data: dismissed } = await supabase.from('anomaly_alerts')
    .select('metric_name')
    .eq('tracked_site_id', site.id).eq('metric_source', CTR_SOURCE)
    .eq('is_dismissed', true).gte('detected_at', since)
  const dismissedKeys = new Set(((dismissed || []) as any[]).map((d) => d.metric_name))

  const alerts = candidates
    .map((c) => {
      const metricName = `Opportunité CTR — ${safePath(c.page)}`
      if (dismissedKeys.has(metricName)) return null
      return {
        tracked_site_id: site.id,
        user_id: site.user_id,
        domain: cleanDomain,
        metric_name: metricName,
        metric_source: CTR_SOURCE,
        severity: 'opportunity',
        direction: 'up',
        z_score: 0,
        current_value: c.recoverableClicks,
        baseline_mean: Math.round(c.benchmark * 100) / 100,
        baseline_stddev: 0,
        change_pct: -Math.round(c.gapRatio * 1000) / 10,
        affected_pages: 1,
        description:
          `Position ${c.position.toFixed(1)} — CTR ${c.actualCtr.toFixed(1)} % contre ${c.benchmark.toFixed(1)} % attendu ` +
          `sur ${c.impressions.toLocaleString('fr-FR')} impressions : environ ${c.recoverableClicks} clics récupérables ` +
          `en réécrivant le title et la meta description (requête principale : "${c.topQuery}")`,
      }
    })
    .filter(Boolean)

  if (!alerts.length) return 0

  const { error } = await supabase.from('anomaly_alerts').insert(alerts)
  if (error) {
    console.error(`[ctr-opportunities] insert ${cleanDomain}:`, error.message)
    return 0
  }
  console.log(`[ctr-opportunities] ${cleanDomain}: ${alerts.length} opportunités CTR`)
  return alerts.length
}

function safePath(url: string): string {
  try {
    const p = new URL(url).pathname
    return p.length > 48 ? `${p.slice(0, 45)}…` : p
  } catch {
    return url.slice(0, 48)
  }
}
