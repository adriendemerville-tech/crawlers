/**
 * content-freshness — Score pages by freshness and update frequency
 * 
 * Combines last-modified dates, GSC click trends, and crawl history
 * to identify stale content that needs updating.
 * 
 * Actions:
 *   - analyze: Full freshness analysis for a tracked site
 */
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getSiteContext } from '../_shared/getSiteContext.ts'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface FreshnessResult {
  url: string
  title: string
  freshness_score: number // 0-100
  last_modified: string | null
  days_since_update: number | null
  clicks_trend: 'rising' | 'stable' | 'declining' | 'unknown'
  urgency: 'critical' | 'high' | 'medium' | 'low'
  recommendation: string
  word_count: number
}

function calculateFreshnessScore(
  daysSinceUpdate: number | null,
  clicksTrend: string,
  wordCount: number,
  hasGscData: boolean,
): number {
  let score = 100

  // Age penalty
  if (daysSinceUpdate !== null) {
    if (daysSinceUpdate > 730) score -= 50        // >2 years
    else if (daysSinceUpdate > 365) score -= 35   // >1 year
    else if (daysSinceUpdate > 180) score -= 20   // >6 months
    else if (daysSinceUpdate > 90) score -= 10    // >3 months
  } else {
    score -= 15 // Unknown age is a mild penalty
  }

  // Click trend bonus/penalty
  if (clicksTrend === 'rising') score += 10
  else if (clicksTrend === 'declining') score -= 15
  else if (clicksTrend === 'unknown' && !hasGscData) score -= 5

  // Content depth bonus
  if (wordCount >= 2000) score += 5
  else if (wordCount < 300) score -= 10

  return Math.max(0, Math.min(100, score))
}

function getRecommendation(score: number, daysSince: number | null, trend: string): string {
  if (score >= 80) return 'Contenu frais — pas d\'action nécessaire.'
  if (score >= 60) {
    if (trend === 'declining') return 'Le trafic diminue. Mettez à jour avec des données récentes et de nouveaux exemples.'
    return 'Contenu vieillissant — planifiez une mise à jour dans les prochaines semaines.'
  }
  if (score >= 40) {
    if (daysSince && daysSince > 365) return `Non mis à jour depuis ${Math.round(daysSince / 30)} mois. Réécrivez les sections obsolètes et ajoutez du contenu frais.`
    return 'Contenu obsolète — refonte recommandée avec des informations à jour.'
  }
  return 'Contenu très ancien. Évaluez s\'il faut réécrire entièrement ou rediriger vers un contenu plus récent.'
}

function detectClicksTrend(recentClicks: number, olderClicks: number): 'rising' | 'stable' | 'declining' | 'unknown' {
  if (recentClicks === 0 && olderClicks === 0) return 'unknown'
  const ratio = olderClicks > 0 ? recentClicks / olderClicks : (recentClicks > 0 ? 2 : 0)
  if (ratio >= 1.2) return 'rising'
  if (ratio <= 0.7) return 'declining'
  return 'stable'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { action, tracked_site_id } = await req.json()

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const userClient = getUserClient(authHeader)
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401)
    if (!tracked_site_id) return json({ error: 'tracked_site_id required' }, 400)
    if (action !== 'analyze') return json({ error: `Unknown action: ${action}` }, 400)

    const sb = getServiceClient()

    const { data: site } = await sb.from('tracked_sites').select('domain').eq('id', tracked_site_id).single()
    if (!site) return json({ error: 'Site not found' }, 404)

    // Fetch crawl data with last_modified
    const { data: crawlPages } = await sb
      .from('crawl_pages')
      .select('url, title, word_count, last_modified, http_status')
      .eq('tracked_site_id', tracked_site_id)
      .eq('http_status', 200)
      .limit(1000)

    // Fetch GSC page-level data for click trends
    const { data: gscRecent } = await sb
      .from('gsc_page_stats')
      .select('page, clicks, impressions')
      .eq('tracked_site_id', tracked_site_id)
      .limit(1000)

    // Build a simple clicks map (recent period)
    const gscMap = new Map((gscRecent || []).map((g: any) => [g.page, { clicks: g.clicks || 0 }]))

    const now = Date.now()
    const results: FreshnessResult[] = (crawlPages || []).map((page: any) => {
      const daysSince = page.last_modified
        ? Math.round((now - new Date(page.last_modified).getTime()) / (1000 * 60 * 60 * 24))
        : null

      const gsc = gscMap.get(page.url)
      const hasGscData = !!gsc
      // Simple trend: if we only have one snapshot, compare clicks to a threshold
      const clicksTrend = gsc ? (gsc.clicks >= 10 ? 'stable' : gsc.clicks >= 1 ? 'declining' : 'unknown') : 'unknown'

      const score = calculateFreshnessScore(daysSince, clicksTrend, page.word_count || 0, hasGscData)

      const urgency: FreshnessResult['urgency'] =
        score < 30 ? 'critical' :
        score < 50 ? 'high' :
        score < 70 ? 'medium' : 'low'

      return {
        url: page.url,
        title: page.title || '',
        freshness_score: score,
        last_modified: page.last_modified,
        days_since_update: daysSince,
        clicks_trend: clicksTrend,
        urgency,
        recommendation: getRecommendation(score, daysSince, clicksTrend),
        word_count: page.word_count || 0,
      }
    })

    // Sort by score ascending (worst first)
    results.sort((a, b) => a.freshness_score - b.freshness_score)

    const summary = {
      total_pages: results.length,
      avg_freshness_score: results.length > 0
        ? Math.round(results.reduce((s, r) => s + r.freshness_score, 0) / results.length)
        : 0,
      critical: results.filter(r => r.urgency === 'critical').length,
      high: results.filter(r => r.urgency === 'high').length,
      medium: results.filter(r => r.urgency === 'medium').length,
      low: results.filter(r => r.urgency === 'low').length,
      oldest_page: results.length > 0 ? {
        url: results[0].url,
        days: results[0].days_since_update,
      } : null,
      freshness_grade: (() => {
        const avg = results.length > 0 ? results.reduce((s, r) => s + r.freshness_score, 0) / results.length : 0
        return avg >= 80 ? 'A' : avg >= 65 ? 'B' : avg >= 50 ? 'C' : avg >= 35 ? 'D' : 'F'
      })(),
    }

    await sb.from('analytics_events').insert({
      user_id: user.id,
      event_type: 'content-freshness:analyze',
      event_data: { tracked_site_id, ...summary },
    }).catch(() => {})

    return json({ pages: results, summary, domain: site.domain })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[content-freshness] error:', msg)
    return json({ error: msg }, 500)
  }
})
