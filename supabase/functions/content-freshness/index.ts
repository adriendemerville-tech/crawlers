/**
 * content-freshness — Score pages by freshness and update frequency
 *
 * Combines last-modified dates, GSC click trends, and crawl history
 * to identify stale content that needs updating.
 *
 * Actions:
 *   - analyze : analyse de fraîcheur d'un site suivi (crawl_pages)
 *   - scan    : audit hebdomadaire du blog crawlers.fr → file de travail admin
 *               (`content_freshness_queue`). NE MODIFIE AUCUN ARTICLE.
 *   - draft   : génère UN brouillon IA de révision pour un élément de la file
 *   - approve : validation humaine → applique le brouillon, met à jour
 *               `updated_at`, puis IndexNow + Google Indexing (RSS et sitemap
 *               étant dynamiques, ils reflètent la mise à jour aussitôt)
 *   - dismiss : écarte un élément de la file
 *
 * Rationalisation LLM : zéro appel IA pendant le scan ; un seul appel borné
 * (12 000 caractères d'entrée) par brouillon explicitement demandé.
 */
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getSiteContext } from '../_shared/getSiteContext.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts'
import { resolveGscAccess } from '../_shared/gscQuery.ts'
import { submitToIndexNow } from '../_shared/urlIndexing.ts'
import { resolveIndexingToken, notifyGoogleIndexing } from '../_shared/googleIndexing.ts'
import { callRoutedAI } from '../_shared/aiRouter.ts'

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
  isSeasonal = false,
): number {
  let score = 100

  // Age penalty — seasonal sites get more lenient thresholds
  const ageFactor = isSeasonal ? 1.5 : 1.0
  if (daysSinceUpdate !== null) {
    if (daysSinceUpdate > 730 * ageFactor) score -= 50
    else if (daysSinceUpdate > 365 * ageFactor) score -= 35
    else if (daysSinceUpdate > 180 * ageFactor) score -= 20
    else if (daysSinceUpdate > 90 * ageFactor) score -= 10
  } else {
    score -= 15
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

// ═══════════════════════════════════════════════════════════════════════════
// File de travail éditoriale — blog crawlers.fr (aucune écriture automatique)
// ═══════════════════════════════════════════════════════════════════════════

const SITE = 'https://crawlers.fr'
const DOMAIN = 'crawlers.fr'
const STALE_WARN_DAYS = 183   // 6 mois
const STALE_CRIT_DAYS = 365   // 12 mois
const MAX_LINK_CHECKS_PER_ARTICLE = 8
const MAX_ARTICLES_PER_SCAN = 120
const DRAFT_INPUT_CHARS = 12000

type Severity = 'critical' | 'warning' | 'info'
interface Reason { code: string; severity: Severity; label: string; detail?: string }
interface PageStat { clicks: number; impressions: number; ctr: number; position: number }

/** Années citées strictement antérieures à l'année courante (hors contexte historique). */
export function findOutdatedYears(text: string, currentYear: number): string[] {
  const found = new Set<string>()
  const re = /\b(20[1-4]\d)\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const year = Number(m[1])
    if (year >= currentYear) continue
    if (year < currentYear - 2) continue // année lointaine = référence historique
    const before = text.slice(Math.max(0, m.index - 40), m.index).toLowerCase()
    if (/(depuis|dès|entre|historiqu|fondé|créé|jusqu'en)\s*$/.test(before)) continue
    found.add(m[1]!)
  }
  return [...found]
}

/** Barèmes / chiffres rattachés à une année passée (prix, quotas, pourcentages). */
export function findStaleFigures(text: string, currentYear: number): string[] {
  const hits = new Set<string>()
  const patterns: RegExp[] = [
    /\d+[\s,.]?\d*\s?(?:€|euros?)\s?(?:\/|par\s)?(?:mois|an)?/gi,
    /\b\d{1,3}\s?%/g,
    /\b\d{2,5}\s?(?:requêtes|crédits|urls?|pages?)\s?\/\s?(?:jour|mois)/gi,
  ]
  const stalePeriod = new RegExp(`\\b(${currentYear - 1}|${currentYear - 2})\\b`)
  for (const p of patterns) {
    let m: RegExpExecArray | null
    while ((m = p.exec(text)) !== null) {
      const win = text.slice(Math.max(0, m.index - 120), m.index + 120)
      if (stalePeriod.test(win)) hits.add(m[0]!.trim())
      if (hits.size >= 6) return [...hits]
    }
  }
  return [...hits]
}

export function extractExternalLinks(html: string): string[] {
  const urls = new Set<string>()
  const re = /href\s*=\s*["'](https?:\/\/[^"'\s>]+)["']/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    try {
      const u = new URL(m[1]!)
      if (u.hostname.replace(/^www\./, '') === DOMAIN) continue
      u.hash = ''
      urls.add(u.toString())
    } catch { /* lien invalide ignoré */ }
  }
  return [...urls].slice(0, MAX_LINK_CHECKS_PER_ARTICLE)
}

async function checkLink(url: string): Promise<{ url: string; status: number | null } | null> {
  const attempt = async (method: 'HEAD' | 'GET') => {
    const res = await fetch(url, {
      method,
      redirect: 'follow',
      headers: { 'User-Agent': 'Crawlers.fr freshness-audit (+https://crawlers.fr)' },
      signal: AbortSignal.timeout(8000),
    })
    return res.status
  }
  try {
    let status = await attempt('HEAD')
    if (status === 405 || status === 403 || status === 501) status = await attempt('GET')
    return status >= 400 ? { url, status } : null
  } catch {
    return { url, status: null }
  }
}

/** Priorité : trafic réel d'abord, puis ancienneté et défauts factuels. */
export function computePriority(input: {
  stalenessDays: number | null
  outdatedYears: number
  staleFigures: number
  deadLinks: number
  gsc: { clicks: number; ctrDelta: number; positionDelta: number } | null
}): number {
  let score = 0
  const d = input.stalenessDays
  if (d !== null) {
    if (d > STALE_CRIT_DAYS * 2) score += 30
    else if (d > STALE_CRIT_DAYS) score += 22
    else if (d > STALE_WARN_DAYS) score += 12
  }
  score += Math.min(15, input.outdatedYears * 6)
  score += Math.min(10, input.staleFigures * 3)
  score += Math.min(15, input.deadLinks * 5)
  if (input.gsc) {
    score += Math.min(20, Math.log10(1 + input.gsc.clicks) * 10)
    if (input.gsc.ctrDelta < -0.5) score += Math.min(12, Math.abs(input.gsc.ctrDelta) * 8)
    if (input.gsc.positionDelta > 0.8) score += Math.min(12, input.gsc.positionDelta * 3)
  }
  return Math.round(Math.min(100, score) * 10) / 10
}

const normPage = (u: string) => u.replace(/^https?:\/\/(www\.)?/, 'https://').replace(/\/$/, '')

/** Requête GSC dimension `page` (queryGscRows n'expose que la dimension query). */
async function fetchPageStats(
  access: { accessToken: string; siteUrl: string },
  startDate: string,
  endDate: string,
): Promise<Map<string, PageStat>> {
  const out = new Map<string, PageStat>()
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(access.siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${access.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate, endDate, dimensions: ['page'], rowLimit: 500 }),
      signal: AbortSignal.timeout(20000),
    },
  )
  if (!res.ok) {
    console.warn(`[content-freshness] GSC page stats ${res.status}`)
    return out
  }
  const data = await res.json()
  for (const row of data.rows || []) {
    const key = normPage(String(row.keys?.[0] ?? ''))
    if (!key) continue
    out.set(key, {
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: Math.round((row.ctr || 0) * 10000) / 100, // en points de %
      position: Math.round((row.position || 0) * 100) / 100,
    })
  }
  return out
}

async function loadGscDeltas(sb: any): Promise<Map<string, { current: PageStat; previous: PageStat | null }>> {
  const out = new Map<string, { current: PageStat; previous: PageStat | null }>()
  try {
    const { data: site } = await sb
      .from('tracked_sites')
      .select('user_id')
      .or(`domain.eq.${DOMAIN},domain.eq.www.${DOMAIN}`)
      .limit(1)
      .maybeSingle()
    if (!site?.user_id) return out

    const access = await resolveGscAccess(sb, site.user_id, DOMAIN)
    if (!access) return out

    const day = 86400000
    const end = new Date(Date.now() - 2 * day)
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    const curStart = new Date(end.getTime() - 27 * day)
    const prevEnd = new Date(curStart.getTime() - day)
    const prevStart = new Date(prevEnd.getTime() - 27 * day)

    const [cur, prev] = await Promise.all([
      fetchPageStats(access, iso(curStart), iso(end)),
      fetchPageStats(access, iso(prevStart), iso(prevEnd)),
    ])
    for (const [key, current] of cur) out.set(key, { current, previous: prev.get(key) ?? null })
  } catch (e) {
    console.warn('[content-freshness] GSC indisponible :', (e as Error).message)
  }
  return out
}

async function runScan(sb: any, checkLinks: boolean) {
  const currentYear = new Date().getUTCFullYear()
  const { data: articles, error } = await sb
    .from('blog_articles')
    .select('id, slug, title, content, updated_at, published_at, created_at')
    .eq('status', 'published')
    .order('updated_at', { ascending: true })
    .limit(MAX_ARTICLES_PER_SCAN)
  if (error) throw new Error(`articles_query_failed: ${error.message}`)

  const gsc = await loadGscDeltas(sb)
  const now = Date.now()
  let queued = 0
  let cleared = 0

  for (const a of articles || []) {
    const body: string = a.content || ''
    const plain = body.replace(/<[^>]+>/g, ' ')
    const url = `${SITE}/blog/${a.slug}`
    const reasons: Reason[] = []

    const refDate = a.updated_at || a.published_at || a.created_at
    const stalenessDays = refDate ? Math.floor((now - new Date(refDate).getTime()) / 86400000) : null
    if (stalenessDays !== null && stalenessDays > STALE_CRIT_DAYS) {
      reasons.push({ code: 'stale_12m', severity: 'critical', label: `Aucune mise à jour depuis ${Math.round(stalenessDays / 30)} mois` })
    } else if (stalenessDays !== null && stalenessDays > STALE_WARN_DAYS) {
      reasons.push({ code: 'stale_6m', severity: 'warning', label: `Aucune mise à jour depuis ${Math.round(stalenessDays / 30)} mois` })
    }

    const outdatedYears = findOutdatedYears(plain, currentYear)
    if (outdatedYears.length) {
      reasons.push({
        code: 'outdated_year',
        severity: 'critical',
        label: `Année périmée citée : ${outdatedYears.join(', ')} (année courante ${currentYear})`,
      })
    }

    const staleFigures = findStaleFigures(plain, currentYear)
    if (staleFigures.length) {
      reasons.push({
        code: 'stale_figures',
        severity: 'warning',
        label: 'Barème ou chiffre rattaché à une année passée',
        detail: staleFigures.join(' · '),
      })
    }

    let deadLinks: { url: string; status: number | null }[] = []
    if (checkLinks) {
      const results = await Promise.all(extractExternalLinks(body).map(checkLink))
      deadLinks = results.filter((r): r is { url: string; status: number | null } => !!r)
      if (deadLinks.length) {
        reasons.push({
          code: 'dead_links',
          severity: 'critical',
          label: `${deadLinks.length} lien(s) mort(s)`,
          detail: deadLinks.map((d) => `${d.url} (${d.status ?? 'timeout'})`).join(' · '),
        })
      }
    }

    const stats = gsc.get(normPage(url))
    let gscSignals: Record<string, unknown> | null = null
    let gscForScore: { clicks: number; ctrDelta: number; positionDelta: number } | null = null
    if (stats) {
      const ctrDelta = stats.previous ? stats.current.ctr - stats.previous.ctr : 0
      const positionDelta = stats.previous ? stats.current.position - stats.previous.position : 0
      gscForScore = { clicks: stats.current.clicks, ctrDelta, positionDelta }
      gscSignals = {
        clicks_28d: stats.current.clicks,
        impressions_28d: stats.current.impressions,
        ctr_28d: stats.current.ctr,
        position_28d: stats.current.position,
        ctr_delta_points: Math.round(ctrDelta * 100) / 100,
        position_delta: Math.round(positionDelta * 100) / 100,
        provenance: stats.previous ? 'Mesuré (28 j vs 28 j précédents)' : 'Mesuré (période précédente absente)',
      }
      const meaningful = stats.current.clicks >= 10 || stats.current.impressions >= 300
      if (meaningful && ctrDelta < -0.5) {
        reasons.push({
          code: 'gsc_ctr_decline',
          severity: 'critical',
          label: `CTR en baisse de ${Math.abs(ctrDelta).toFixed(2)} pt sur ${stats.current.clicks} clics`,
        })
      }
      if (meaningful && positionDelta > 0.8) {
        reasons.push({
          code: 'gsc_position_decline',
          severity: 'warning',
          label: `Position moyenne dégradée de ${positionDelta.toFixed(1)} rang(s)`,
        })
      }
    }

    if (reasons.length === 0) {
      // Article sain : on retire uniquement ce qui n'a pas encore été arbitré.
      const { error: delErr } = await sb
        .from('content_freshness_queue')
        .delete()
        .eq('article_id', a.id)
        .eq('status', 'pending')
      if (!delErr) cleared++
      continue
    }

    const { data: existing } = await sb
      .from('content_freshness_queue')
      .select('id, status')
      .eq('article_id', a.id)
      .maybeSingle()
    // Jamais réécrire un élément déjà arbitré par un humain.
    if (existing && existing.status !== 'pending' && existing.status !== 'draft_ready') continue

    const priority = computePriority({
      stalenessDays,
      outdatedYears: outdatedYears.length,
      staleFigures: staleFigures.length,
      deadLinks: deadLinks.length,
      gsc: gscForScore,
    })

    const { error: upErr } = await sb.from('content_freshness_queue').upsert({
      article_id: a.id,
      slug: a.slug,
      url,
      title: a.title,
      priority_score: priority,
      staleness_days: stalenessDays,
      reasons,
      outdated_years: outdatedYears,
      dead_links: deadLinks,
      gsc_signals: gscSignals,
      detected_at: new Date().toISOString(),
    }, { onConflict: 'article_id' })
    if (upErr) console.error(`[content-freshness] upsert ${a.slug}:`, upErr.message)
    else queued++
  }

  return { articles_scanned: articles?.length || 0, queued, cleared, gsc_pages: gsc.size }
}

async function generateDraft(sb: any, itemId: string) {
  const { data: item } = await sb
    .from('content_freshness_queue')
    .select('id, article_id, reasons, outdated_years, dead_links, gsc_signals')
    .eq('id', itemId)
    .maybeSingle()
  if (!item) throw new Error('item_not_found')

  const { data: article } = await sb
    .from('blog_articles')
    .select('id, title, excerpt, content')
    .eq('id', item.article_id)
    .maybeSingle()
  if (!article) throw new Error('article_not_found')

  const currentYear = new Date().getUTCFullYear()
  const reasons: Reason[] = Array.isArray(item.reasons) ? item.reasons : []
  const dead: { url: string }[] = Array.isArray(item.dead_links) ? item.dead_links : []

  const system = [
    'Tu es rédacteur SEO senior francophone pour Crawlers.fr (SEO, GEO, visibilité dans les moteurs IA).',
    `Nous sommes en ${currentYear}. Tu révises un article existant, tu ne le réécris pas intégralement.`,
    'Règles strictes : aucun emoji, aucune donnée inventée, aucun superlatif creux, HTML simple (h2, h3, p, ul, li, a, strong).',
    'Tu conserves la structure et le ton existants ; tu corriges le périmé et tu ajoutes les sections ou liens internes manquants.',
    'Réponds STRICTEMENT en JSON : {"changes":[{"type":"...","detail":"..."}],"html":"<article HTML complet révisé>"}',
  ].join('\n')

  const user = [
    `Titre : ${article.title}`,
    `Extrait : ${article.excerpt || '—'}`,
    `Motifs de révision : ${reasons.map((r) => `${r.code} — ${r.label}${r.detail ? ` (${r.detail})` : ''}`).join(' | ') || '—'}`,
    item.outdated_years?.length ? `Années à actualiser : ${item.outdated_years.join(', ')}` : '',
    dead.length ? `Liens morts à remplacer ou retirer : ${dead.map((d) => d.url).join(', ')}` : '',
    item.gsc_signals ? `Signaux Search Console : ${JSON.stringify(item.gsc_signals)}` : '',
    '',
    'Contenu actuel (HTML, éventuellement tronqué) :',
    (article.content || '').slice(0, DRAFT_INPUT_CHARS),
  ].filter(Boolean).join('\n')

  const result = await callRoutedAI('content_freshness_draft', {
    system,
    user,
    jsonMode: true,
    temperature: 0.3,
    maxTokens: 8000,
    fallbackModel: 'google/gemini-3-flash-preview',
    edgeFunction: 'content-freshness',
  })

  let parsed: { changes?: { type: string; detail: string }[]; html?: string }
  try {
    parsed = JSON.parse(result.content.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim())
  } catch {
    throw new Error('draft_parse_failed')
  }
  if (!parsed.html || parsed.html.length < 200) throw new Error('draft_too_short')

  const { error } = await sb.from('content_freshness_queue').update({
    status: 'draft_ready',
    draft_content: parsed.html,
    draft_summary: parsed.changes || [],
    draft_model: result.model_used,
    draft_generated_at: new Date().toISOString(),
  }).eq('id', itemId)
  if (error) throw new Error(`draft_save_failed: ${error.message}`)

  return { item_id: itemId, changes: parsed.changes || [], model: result.model_used, chars: parsed.html.length }
}

async function approveItem(sb: any, itemId: string, userId: string, overrideContent?: string) {
  const { data: item } = await sb
    .from('content_freshness_queue')
    .select('id, article_id, url, draft_content')
    .eq('id', itemId)
    .maybeSingle()
  if (!item) throw new Error('item_not_found')

  const finalHtml = String(overrideContent ?? item.draft_content ?? '').trim()
  if (finalHtml.length < 200) throw new Error('no_draft_to_publish')

  const nowIso = new Date().toISOString()
  const { error: updErr } = await sb
    .from('blog_articles')
    .update({ content: finalHtml, updated_at: nowIso })
    .eq('id', item.article_id)
  if (updErr) throw new Error(`article_update_failed: ${updErr.message}`)

  // C'est la validation humaine — et elle seule — qui déclenche l'indexation.
  const indexnow = await submitToIndexNow([item.url], DOMAIN)
  let google: unknown = { skipped: 'aucun jeton Google disponible' }
  try {
    const clientId = Deno.env.get('GOOGLE_GSC_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_GSC_CLIENT_SECRET')
    if (clientId && clientSecret) {
      const token = await resolveIndexingToken(sb, DOMAIN, clientId, clientSecret)
      if (token?.access_token) {
        google = await notifyGoogleIndexing([item.url], token.access_token, 'URL_UPDATED')
      }
    }
  } catch (e) {
    google = { error: (e as Error).message }
  }

  const indexing_result = { indexnow, google, rss: `${SITE}/rss.xml`, sitemap: `${SITE}/sitemap.xml` }

  await sb.from('content_freshness_queue').update({
    status: 'approved',
    reviewed_by: userId || null,
    reviewed_at: nowIso,
    published_at: nowIso,
    indexing_result,
  }).eq('id', itemId)

  return { item_id: itemId, url: item.url, indexing: indexing_result }
}

Deno.serve(handleRequest(async (req) => {
try {
    const rawBody = await req.json().catch(() => ({}))
    const { action, tracked_site_id } = rawBody

    // ── Actions file de travail éditoriale (cron ou admin) ──────────────────
    if (action === 'scan' || action === 'draft' || action === 'approve' || action === 'dismiss') {
      const headerSecret = req.headers.get('x-cron-secret')
      const isCron = !!headerSecret && [Deno.env.get('CRON_SECRET'), Deno.env.get('CRON_SECRET_V2')]
        .some((s) => !!s && s === headerSecret)

      let actorId = ''
      if (!isCron) {
        const auth = await getAuthenticatedUser(req)
        if (!auth) return json({ error: 'Unauthorized' }, 401)
        if (!auth.isAdmin) return json({ error: 'Administrateur uniquement' }, 403)
        // 'service-role' n'est pas un uuid : reviewed_by reste null dans ce cas.
        actorId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(auth.userId)
          ? auth.userId
          : ''
      }

      const sbq = getServiceClient()
      try {
        if (action === 'scan') {
          const result = await runScan(sbq, rawBody.check_links !== false)
          console.log(`[content-freshness] scan — ${JSON.stringify(result)}`)
          return json({ success: true, ...result })
        }
        if (!rawBody.item_id) return json({ error: 'item_id requis' }, 400)
        if (action === 'draft') {
          return json({ success: true, ...(await generateDraft(sbq, rawBody.item_id)) })
        }
        if (action === 'approve') {
          if (isCron) return json({ error: 'La publication exige une validation humaine' }, 403)
          return json({ success: true, ...(await approveItem(sbq, rawBody.item_id, actorId, rawBody.content)) })
        }
        const { error: dErr } = await sbq.from('content_freshness_queue').update({
          status: 'dismissed',
          reviewed_by: actorId || null,
          reviewed_at: new Date().toISOString(),
        }).eq('id', rawBody.item_id)
        if (dErr) return json({ error: dErr.message }, 500)
        return json({ success: true, item_id: rawBody.item_id })
      } catch (e) {
        console.error('[content-freshness]', (e as Error).message)
        return json({ error: (e as Error).message }, 500)
      }
    }

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

    // Fetch identity card for sector/seasonality context
    const siteContext = await getSiteContext(sb, { trackedSiteId: tracked_site_id, userId: user.id })
    const isSeasonal = !!(siteContext as any)?.is_seasonal
    const sector = siteContext?.market_sector || ''

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

      const score = calculateFreshnessScore(daysSince, clicksTrend, page.word_count || 0, hasGscData, isSeasonal)

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
}));