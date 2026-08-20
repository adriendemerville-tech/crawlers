/**
 * content-pruning — Audit de pruning (consolidation / suppression / redirection)
 *
 * Source unique de vérité : `_shared/parmenionPriority.ts`
 *   - `pruneRoi`   → verdict page par page + ROI comparable aux tâches de création
 *   - `computeDebtFromCorpus` → dette de pruning au niveau site (régime sain / encombré / saturé)
 *
 * Données : dernier crawl terminé du domaine (`site_crawls` + `crawl_pages`)
 * et métriques Search Console au niveau page (`_shared/gscPages.ts`).
 * Sans mesure GSC, aucune action destructive n'est proposée (protection dure).
 *
 * Actions :
 *   - analyze : audit complet, persistance de la dette + constats dans `architect_workbench`
 *
 * Authentification : JWT utilisateur, ou appel interne (clé de service / CRON_SECRET)
 * pour les exécutions planifiées.
 */
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { handleRequest } from '../_shared/serveHandler.ts'
import {
  pruneRoi,
  computeDebtFromCorpus,
  type PruneVerdict,
  type DebtPageInput,
} from '../_shared/parmenionPriority.ts'
import { fetchGscPageMetrics, normalizeUrlKey } from '../_shared/gscPages.ts'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Candidat de fusion : page conservée du même répertoire au libellé le plus proche. */
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  const m = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      m[i][j] = a[i - 1] === b[j - 1]
        ? m[i - 1][j - 1]
        : Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + 1)
    }
  }
  return 1 - m[a.length][b.length] / maxLen
}

function slugOf(url: string): string {
  try { return new URL(url).pathname.split('/').filter(Boolean).pop() || '' }
  catch { return url.split('/').filter(Boolean).pop() || '' }
}

function attachMergeTargets(verdicts: (PruneVerdict & { merge_candidate?: string })[]): void {
  const keepers = verdicts.filter((v) => v.decision === 'keep' || v.decision === 'update')
  for (const v of verdicts) {
    if (v.decision !== 'merge' && v.decision !== 'redirect' && v.decision !== 'delete') continue
    const s = slugOf(v.url)
    if (!s) continue
    let best: { url: string; score: number } | null = null
    for (const k of keepers) {
      const ks = slugOf(k.url)
      if (!ks || ks === s) continue
      const score = ks.includes(s) || s.includes(ks) ? 0.9 : similarity(s, ks)
      if (score > 0.45 && (!best || score > best.score)) best = { url: k.url, score }
    }
    if (best) v.merge_candidate = best.url
    // Une page morte qui recouvre sémantiquement une page conservée se fusionne :
    // sans profil de backlink page à page, le juge partagé conclurait à tort
    // à une suppression sèche et détruirait un signal réutilisable.
    if (v.decision === 'delete' && v.merge_candidate) {
      v.decision = 'merge'
      v.reasons = [...v.reasons, 'Recouvrement sémantique avec une page conservée : fusion plutôt que suppression']
    }
  }
}

/**
 * Pages fonctionnelles (application, formulaires, pages légales) : elles n'ont
 * aucune vocation à capter du trafic organique, donc leur absence de clic ne
 * fonde aucun verdict destructif.
 */
const FUNCTIONAL_PATH =
  /^\/(app|auth|login|connexion|signup|inscription|compte|dashboard|contact|panier|checkout|mentions|mentions-legales|cgv|cgu|cgvu|politique|privacy|confidentialite|plan-du-site|sitemap|merci|404)(\/|$)/i

function isFunctionalUrl(url: string): boolean {
  try { return FUNCTIONAL_PATH.test(new URL(url).pathname) } catch { return false }
}


const CATEGORY: Record<string, string> = {
  merge: 'cannibalization',
  redirect: 'cannibalization',
  delete: 'thin_content',
  update: 'rewrite_content',
}

Deno.serve(handleRequest(async (req) => {
  try {
    const body = await req.json().catch(() => ({}))
    const { action = 'analyze', tracked_site_id, domain: domainArg, persist = true, max_findings = 40 } = body

    const authHeader = req.headers.get('Authorization') || ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const cronSecret = Deno.env.get('CRON_SECRET') || ''
    const isInternal =
      (serviceKey.length > 0 && authHeader === `Bearer ${serviceKey}`) ||
      (cronSecret.length > 0 && req.headers.get('x-internal-secret') === cronSecret)

    const sb = getServiceClient()
    let userId: string | null = null

    if (!isInternal) {
      if (!authHeader) return json({ error: 'Unauthorized' }, 401)
      const { data: { user }, error: userErr } = await getUserClient(authHeader).auth.getUser()
      if (userErr || !user) return json({ error: 'Unauthorized' }, 401)
      userId = user.id
    }

    if (action !== 'analyze') return json({ error: `Unknown action: ${action}` }, 400)
    if (!tracked_site_id && !domainArg) return json({ error: 'tracked_site_id ou domain requis' }, 400)

    // 1. Résolution du site suivi
    let site: { id: string; domain: string; user_id: string } | null = null
    if (tracked_site_id) {
      const { data } = await sb.from('tracked_sites').select('id, domain, user_id').eq('id', tracked_site_id).maybeSingle()
      site = data as any
    } else {
      const bareArg = String(domainArg).replace(/^www\./, '').toLowerCase()
      const { data } = await sb.from('tracked_sites').select('id, domain, user_id, created_at')
        .or(`domain.eq.${bareArg},domain.eq.www.${bareArg}`)
        .order('created_at', { ascending: false })
      const candidates = (data || []) as any[]
      // Un même domaine peut être suivi par plusieurs comptes : on privilégie
      // celui dont le compte Google couvre la propriété, sinon la mesure GSC
      // serait absente et l'audit dégénérerait en verdict « non mesuré ».
      const { data: conns } = await sb.from('google_connections').select('user_id, gsc_site_urls')
      const gscOwners = new Set(
        (conns || [])
          .filter((c: any) => JSON.stringify(c.gsc_site_urls || []).toLowerCase().includes(bareArg))
          .map((c: any) => c.user_id),
      )
      site = (candidates.find((c) => gscOwners.has(c.user_id)) || candidates[0]) as any
    }

    if (!site) return json({ error: 'Site non trouvé' }, 404)
    if (!isInternal && site.user_id !== userId) return json({ error: 'Forbidden' }, 403)

    const bare = site.domain.replace(/^www\./, '').toLowerCase()
    const ownerId = site.user_id

    // 2. Dernier crawl terminé
    const { data: crawls } = await sb.from('site_crawls')
      .select('id, domain, completed_at, created_at')
      .eq('status', 'completed')
      .or(`domain.eq.${bare},domain.eq.www.${bare}`)
      .order('created_at', { ascending: false }).limit(1)
    const crawl = (crawls || [])[0]
    if (!crawl) return json({ error: 'Aucun crawl terminé pour ce domaine — lancer un crawl d\'abord' }, 409)

    const { data: rawPages } = await sb.from('crawl_pages')
      .select('url, path, title, word_count, is_indexable, http_status, page_intent, near_duplicate_group, internal_links')
      .eq('crawl_id', crawl.id).limit(10000)
    const pages = (rawPages || []) as (DebtPageInput & { internal_links?: number })[]
    if (pages.length === 0) return json({ error: 'Crawl vide' }, 409)

    // 3. Métriques Search Console page par page (null = non mesuré)
    const metrics = await fetchGscPageMetrics(sb, ownerId, bare, 90).catch(() => null)
    const metricsMissing = metrics === null

    // 4. Verdicts page par page
    const indexable = pages.filter((p) => p.is_indexable !== false && (p.http_status ?? 200) < 400)
    const verdicts: (PruneVerdict & { merge_candidate?: string; clicks_90d: number; impressions_90d: number })[] =
      indexable.map((p) => {
        const m = metrics?.get(normalizeUrlKey(p.url))
        const v = pruneRoi({
          url: p.url,
          clicks_90d: m?.clicks ?? 0,
          impressions_90d: m?.impressions ?? 0,
          position: m?.position ?? 0,
          word_count: p.word_count ?? 0,
          backlinks: 0,
          last_modified: (p as any).last_modified ?? null,
          title: p.title,
          http_status: p.http_status ?? 200,
          metrics_missing: metricsMissing,
        }, { pagesAnalyzed: indexable.length })
        return { ...v, clicks_90d: m?.clicks ?? 0, impressions_90d: m?.impressions ?? 0 }
      })
    attachMergeTargets(verdicts)

    // 5. Dette agrégée
    const debt = computeDebtFromCorpus({ pages, metrics })

    const summary = {
      total_pages: pages.length,
      analyzed: verdicts.length,
      keep: verdicts.filter((v) => v.decision === 'keep').length,
      update: verdicts.filter((v) => v.decision === 'update').length,
      merge: verdicts.filter((v) => v.decision === 'merge').length,
      redirect: verdicts.filter((v) => v.decision === 'redirect').length,
      delete: verdicts.filter((v) => v.decision === 'delete').length,
      protected: verdicts.filter((v) => v.protected).length,
      metrics_available: !metricsMissing,
      debt: debt.debt,
      regime: debt.regime,
      crawl_id: crawl.id,
      crawl_date: crawl.completed_at || crawl.created_at,
    }

    // 6. Persistance
    let persisted = 0
    if (persist) {
      await sb.from('site_pruning_debt').insert({
        domain: bare,
        tracked_site_id: site.id,
        user_id: ownerId,
        debt: debt.debt,
        regime: debt.regime,
        corpus_size: debt.corpus_size,
        useful_pages: debt.useful_pages,
        mute_ratio: debt.mute_ratio,
        cannibal_ratio: debt.cannibal_ratio,
        cannibal_clusters: debt.cannibal_clusters,
        prunable_ratio: debt.prunable_ratio,
        concentration: debt.concentration,
        metrics_available: debt.metrics_available,
        insufficient_data: debt.insufficient_data,
        explanation: debt.explanation,
        items_scored: verdicts.length,
        computed_at: new Date().toISOString(),
      })

      const actionable = verdicts
        .filter((v) => v.decision === 'merge' || v.decision === 'redirect' || v.decision === 'delete')
        .sort((a, b) => b.priority_score - a.priority_score)
        .slice(0, Math.max(1, Math.min(100, max_findings)))

      if (actionable.length > 0) {
        const urls = actionable.map((v) => v.url)
        const { data: existing } = await sb.from('architect_workbench')
          .select('target_url')
          .eq('domain', bare)
          .eq('source_function', 'content-pruning')
          .in('status', ['pending', 'in_progress'])
          .in('target_url', urls)
        const known = new Set((existing || []).map((e: any) => e.target_url))

        const rows = actionable.filter((v) => !known.has(v.url)).map((v) => ({
          user_id: ownerId,
          tracked_site_id: site!.id,
          domain: bare,
          source_function: 'content-pruning',
          source_type: 'audit_strategic',
          finding_category: CATEGORY[v.decision] || 'content',
          severity: v.decision === 'delete' ? 'high' : 'medium',
          status: 'pending',
          target_url: v.url,
          target_operation: v.decision,
          title: `${v.decision === 'delete' ? 'Supprimer' : v.decision === 'redirect' ? 'Rediriger' : 'Fusionner'} : ${v.url.replace(/^https?:\/\//, '')}`,
          description: `${v.reasons.join(' · ')}${v.merge_candidate ? ` — cible proposée : ${v.merge_candidate}` : ''}`,
          priority_score: v.priority_score,
          roi_tier: v.roi.tier,
          is_quick_win: v.is_quick_win,
          payload: {
            decision: v.decision,
            conservation: v.conservation,
            merge_candidate: v.merge_candidate ?? null,
            clicks_90d: v.clicks_90d,
            impressions_90d: v.impressions_90d,
            protected: v.protected,
            protection_reason: v.protection_reason ?? null,
            roi: v.roi,
            debt_regime: debt.regime,
            crawl_id: crawl.id,
            provenance: metricsMissing ? 'deduit' : 'mesure',
          },
        }))

        if (rows.length > 0) {
          const { error: insErr } = await sb.from('architect_workbench').insert(rows)
          if (insErr) console.error('[content-pruning] workbench insert:', insErr.message)
          else persisted = rows.length
        }
      }

      await sb.from('analytics_events').insert({
        user_id: ownerId,
        event_type: 'content-pruning:analyze',
        event_data: { tracked_site_id: site.id, domain: bare, ...summary, findings: persisted },
      })
    }

    return json({
      domain: bare,
      summary,
      debt,
      findings_persisted: persisted,
      pages: verdicts.sort((a, b) => a.conservation - b.conservation).slice(0, 200),
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[content-pruning] error:', msg)
    return json({ error: msg }, 500)
  }
}))
