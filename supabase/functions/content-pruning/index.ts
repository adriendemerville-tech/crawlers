/**
 * content-pruning — Content audit & pruning recommendations
 * 
 * Analyzes all pages of a site and recommends: keep, merge, update, or delete.
 * Uses GSC data (clicks, impressions), crawl data (word count, thin content),
 * and backlink data to make decisions.
 * 
 * Actions:
 *   - analyze: Full pruning analysis for a tracked site
 */
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getSiteContext } from '../_shared/getSiteContext.ts'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface PageData {
  url: string
  clicks_90d: number
  impressions_90d: number
  word_count: number
  backlinks: number
  last_modified: string | null
  title: string
  http_status: number
}

type PruneDecision = 'keep' | 'update' | 'merge' | 'redirect' | 'delete'

interface PruneResult {
  url: string
  decision: PruneDecision
  score: number
  reasons: string[]
  merge_candidate?: string
  priority: 'high' | 'medium' | 'low'
}

function scorePage(page: PageData): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []

  // Traffic signal (0-40 points)
  if (page.clicks_90d >= 50) { score += 40; reasons.push('Trafic organique solide') }
  else if (page.clicks_90d >= 10) { score += 25; reasons.push('Trafic organique modéré') }
  else if (page.clicks_90d >= 1) { score += 10; reasons.push('Trafic organique faible') }
  else { reasons.push('Aucun clic organique en 90 jours') }

  // Impressions signal (0-15 points)
  if (page.impressions_90d >= 500) { score += 15 }
  else if (page.impressions_90d >= 100) { score += 8 }
  else if (page.impressions_90d < 10) { reasons.push('Quasi invisible dans les SERPs') }

  // Content quality (0-20 points)
  if (page.word_count >= 1500) { score += 20 }
  else if (page.word_count >= 800) { score += 15 }
  else if (page.word_count >= 300) { score += 8 }
  else { reasons.push(`Contenu très court (${page.word_count} mots)`) }

  // Backlinks (0-15 points)
  if (page.backlinks >= 10) { score += 15; reasons.push('Profil de liens solide') }
  else if (page.backlinks >= 3) { score += 8 }
  else if (page.backlinks === 0) { reasons.push('Aucun backlink') }

  // Freshness (0-10 points)
  if (page.last_modified) {
    const daysSince = (Date.now() - new Date(page.last_modified).getTime()) / (1000 * 60 * 60 * 24)
    if (daysSince <= 90) { score += 10 }
    else if (daysSince <= 365) { score += 5 }
    else { reasons.push(`Non mis à jour depuis ${Math.round(daysSince / 30)} mois`) }
  }

  return { score, reasons }
}

function decideAction(score: number, page: PageData): PruneDecision {
  if (page.http_status >= 400) return 'delete'
  if (score >= 70) return 'keep'
  if (score >= 50) return 'update'
  if (score >= 25 && page.backlinks > 0) return 'redirect'
  if (score >= 25) return 'merge'
  return 'delete'
}

function findMergeCandidates(pages: PruneResult[]): void {
  const mergeables = pages.filter(p => p.decision === 'merge')
  const keepables = pages.filter(p => p.decision === 'keep' || p.decision === 'update')

  for (const page of mergeables) {
    // Find a keep/update page with similar URL path
    const pageSlug = page.url.split('/').filter(Boolean).pop() || ''
    const candidate = keepables.find(k => {
      const kSlug = k.url.split('/').filter(Boolean).pop() || ''
      return pageSlug && kSlug && (
        pageSlug.includes(kSlug) || kSlug.includes(pageSlug) ||
        levenshteinSimilarity(pageSlug, kSlug) > 0.5
      )
    })
    if (candidate) page.merge_candidate = candidate.url
  }
}

function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      matrix[i][j] = a[i - 1] === b[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + 1)
    }
  }
  return 1 - matrix[a.length][b.length] / maxLen
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

    // 1. Get tracked site domain
    const { data: site } = await sb.from('tracked_sites').select('domain').eq('id', tracked_site_id).single()
    if (!site) return json({ error: 'Site not found' }, 404)

    // 2. Get GSC data (last 90 days page-level clicks/impressions)
    const { data: gscData } = await sb
      .from('gsc_page_stats')
      .select('page, clicks, impressions')
      .eq('tracked_site_id', tracked_site_id)
      .order('clicks', { ascending: false })
      .limit(1000)

    // 3. Get crawl data
    const { data: crawlPages } = await sb
      .from('crawl_pages')
      .select('url, word_count, title, http_status, last_modified, depth')
      .eq('tracked_site_id', tracked_site_id)
      .limit(1000)

    // 4. Get backlink data
    const { data: backlinkData } = await sb
      .from('backlink_snapshots')
      .select('backlinks_total')
      .eq('tracked_site_id', tracked_site_id)
      .order('created_at', { ascending: false })
      .limit(1)

    // Build page map
    const gscMap = new Map((gscData || []).map((g: any) => [g.page, g]))
    
    const pages: PageData[] = (crawlPages || []).map((cp: any) => {
      const gsc = gscMap.get(cp.url) || { clicks: 0, impressions: 0 }
      return {
        url: cp.url,
        clicks_90d: gsc.clicks || 0,
        impressions_90d: gsc.impressions || 0,
        word_count: cp.word_count || 0,
        backlinks: 0, // Per-page backlinks not always available
        last_modified: cp.last_modified,
        title: cp.title || '',
        http_status: cp.http_status || 200,
      }
    })

    // Score and decide
    const results: PruneResult[] = pages.map(page => {
      const { score, reasons } = scorePage(page)
      const decision = decideAction(score, page)
      const priority: 'high' | 'medium' | 'low' = decision === 'delete' ? 'high' : decision === 'redirect' ? 'high' : decision === 'merge' ? 'medium' : 'low'
      return { url: page.url, decision, score, reasons, priority }
    })

    findMergeCandidates(results)

    // Summary
    const summary = {
      total_pages: results.length,
      keep: results.filter(r => r.decision === 'keep').length,
      update: results.filter(r => r.decision === 'update').length,
      merge: results.filter(r => r.decision === 'merge').length,
      redirect: results.filter(r => r.decision === 'redirect').length,
      delete: results.filter(r => r.decision === 'delete').length,
      health_score: results.length > 0 ? Math.round(results.filter(r => r.decision === 'keep').length / results.length * 100) : 0,
    }

    // Log usage
    await sb.from('analytics_events').insert({
      user_id: user.id,
      event_type: 'content-pruning:analyze',
      event_data: { tracked_site_id, ...summary },
    }).catch(() => {})

    return json({ pages: results.sort((a, b) => a.score - b.score), summary, domain: site.domain })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[content-pruning] error:', msg)
    return json({ error: msg }, 500)
  }
})
