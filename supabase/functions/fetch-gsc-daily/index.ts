/**
 * fetch-gsc-daily — Alimentation Search Console des signaux Breathing Spiral
 *
 * Pour chaque site dont l'utilisateur a connecté sa Search Console :
 *  1. gsc_daily_positions ← positions quotidiennes par requête (velocity decay + anomalies J-1)
 *  2. keyword_universe.current_position / best_position ← moyenne 28 j (couverture SERP)
 *
 * Les sites sans connexion Google sont ignorés : aucun signal n'est inventé.
 *
 * POST { all: true, days?: number, sync_keywords?: boolean }  → mode cron (header x-cron-secret)
 * POST { tracked_site_id }                                    → un seul site
 * POST { }                                                    → tous les sites de l'appelant
 */
import { getAuthenticatedUser } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts'
import { resolveGscAccess, queryGscRows, gscWindow, type GscAccess } from '../_shared/gscQuery.ts'

interface Site {
  id: string
  domain: string
  user_id: string
  target_countries?: string[] | null
}

const SITE_COLUMNS = 'id, domain, user_id, target_countries'

Deno.serve(handleRequest(async (req) => {
  const headerSecret = req.headers.get('x-cron-secret')
  const isCron = !!headerSecret && [Deno.env.get('CRON_SECRET'), Deno.env.get('CRON_SECRET_V2')]
    .some((s) => !!s && s === headerSecret)

  const auth = isCron ? null : await getAuthenticatedUser(req)
  if (!isCron && !auth) return jsonError('Unauthorized', 401)

  const body = await req.json().catch(() => ({}))
  const supabase = getServiceClient()

  const days = Math.min(90, Math.max(1, Number(body.days) || 3))
  const syncKeywords = body.sync_keywords !== false

  // ─── Sélection des sites ───────────────────────────────────────────
  let sites: Site[] = []
  if (body.tracked_site_id) {
    const { data } = await supabase.from('tracked_sites').select(SITE_COLUMNS)
      .eq('id', body.tracked_site_id).maybeSingle()
    if (data) sites = [data as Site]
  } else if (body.all || isCron) {
    const { data, error } = await supabase.from('tracked_sites').select(SITE_COLUMNS).limit(300)
    if (error) return jsonError(`sites_query_failed: ${error.message}`, 500)
    sites = (data || []) as Site[]
  } else {
    const { data } = await supabase.from('tracked_sites').select(SITE_COLUMNS).eq('user_id', auth!.userId)
    sites = (data || []) as Site[]
  }

  let dailyRows = 0
  let keywordsUpdated = 0
  let sitesWithGsc = 0
  const skipped: string[] = []

  for (const site of sites) {
    const cleanDomain = site.domain.replace(/^www\./, '').toLowerCase()

    let access: GscAccess | null = null
    try {
      access = await resolveGscAccess(supabase, site.user_id, site.domain)
    } catch (e) {
      console.error(`[fetch-gsc-daily] résolution GSC impossible pour ${cleanDomain}:`, e)
    }
    if (!access) { skipped.push(cleanDomain); continue }
    sitesWithGsc++

    const countries = site.target_countries?.length ? site.target_countries : [null]

    for (const country of countries) {
      try {
        dailyRows += await syncDailyPositions(supabase, site, cleanDomain, access, days, country)
      } catch (e) {
        console.error(`[fetch-gsc-daily] positions quotidiennes ${cleanDomain}/${country ?? 'all'}:`, e)
      }
    }

    if (syncKeywords) {
      try {
        keywordsUpdated += await syncKeywordPositions(supabase, site, cleanDomain, access)
      } catch (e) {
        console.error(`[fetch-gsc-daily] couverture SERP ${cleanDomain}:`, e)
      }
    }
  }

  console.log(
    `[fetch-gsc-daily] ${sitesWithGsc}/${sites.length} sites GSC — ${dailyRows} lignes quotidiennes, ${keywordsUpdated} mots-clés positionnés`,
  )

  return jsonOk({
    success: true,
    sites_processed: sites.length,
    sites_with_gsc: sitesWithGsc,
    sites_without_gsc: skipped.length,
    rows_inserted: dailyRows,
    keywords_updated: keywordsUpdated,
    window_days: days,
  })
}, 'fetch-gsc-daily'))

// ─── 1. Positions quotidiennes (velocity decay + détection d'anomalies) ──

async function syncDailyPositions(
  supabase: any,
  site: Site,
  cleanDomain: string,
  access: GscAccess,
  days: number,
  country: string | null,
): Promise<number> {
  const { startDate, endDate } = gscWindow(days)
  const rows = await queryGscRows(access, {
    startDate,
    endDate,
    dimensions: ['date', 'query'],
    rowLimit: days > 7 ? 5000 : 1000,
    country,
  })
  if (!rows.length) return 0

  const payload = rows
    .filter((r) => r.date && r.query)
    .map((r) => ({
      tracked_site_id: site.id,
      user_id: site.user_id,
      domain: cleanDomain,
      query: r.query,
      position: r.position,
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      date_val: r.date,
      country: country ?? 'all',
    }))

  let inserted = 0
  for (let i = 0; i < payload.length; i += 200) {
    const batch = payload.slice(i, i + 200)
    const { error } = await supabase.from('gsc_daily_positions').upsert(batch, {
      onConflict: 'tracked_site_id,query,date_val,country',
      ignoreDuplicates: false,
    })
    if (error) console.error(`[fetch-gsc-daily] upsert ${cleanDomain}:`, error.message)
    else inserted += batch.length
  }
  return inserted
}

// ─── 2. Couverture SERP (keyword_universe.current_position) ─────────────

async function syncKeywordPositions(
  supabase: any,
  site: Site,
  cleanDomain: string,
  access: GscAccess,
): Promise<number> {
  const { startDate, endDate } = gscWindow(28)
  const rows = await queryGscRows(access, {
    startDate,
    endDate,
    dimensions: ['query'],
    rowLimit: 5000,
  })
  if (!rows.length) return 0

  const positionByQuery = new Map<string, number>()
  for (const r of rows) {
    if (!r.query || !r.position) continue
    positionByQuery.set(normalize(r.query), Math.round(r.position))
  }

  // Univers de mots-clés du site (tracked_site_id prioritaire, repli domaine)
  let { data: universe } = await supabase
    .from('keyword_universe')
    .select('id, keyword, current_position, best_position')
    .eq('tracked_site_id', site.id)
    .limit(5000)

  if (!universe?.length) {
    const res = await supabase
      .from('keyword_universe')
      .select('id, keyword, current_position, best_position')
      .eq('domain', cleanDomain)
      .eq('user_id', site.user_id)
      .limit(5000)
    universe = res.data
  }
  if (!universe?.length) return 0

  const updates = universe
    .map((kw: any) => {
      const pos = positionByQuery.get(normalize(kw.keyword || ''))
      if (!pos) return null
      if (kw.current_position === pos) return null
      return {
        id: kw.id,
        current_position: pos,
        best_position: kw.best_position ? Math.min(kw.best_position, pos) : pos,
      }
    })
    .filter(Boolean) as { id: string; current_position: number; best_position: number }[]

  let updated = 0
  for (let i = 0; i < updates.length; i += 25) {
    const batch = updates.slice(i, i + 25)
    const results = await Promise.all(
      batch.map((u) =>
        supabase.from('keyword_universe').update({
          current_position: u.current_position,
          best_position: u.best_position,
          updated_at: new Date().toISOString(),
        }).eq('id', u.id),
      ),
    )
    updated += results.filter((r: any) => !r.error).length
  }

  console.log(`[fetch-gsc-daily] ${cleanDomain}: ${updated}/${universe.length} mots-clés positionnés via GSC`)
  return updated
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
}
