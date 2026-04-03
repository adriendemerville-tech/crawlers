import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { trackEdgeFunctionError } from '../_shared/tokenTracker.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * refresh-llm-visibility-all  v2
 * 
 * Weekly cron: triggers calculate-llm-visibility for all tracked sites.
 * Now supports cursor-based pagination + self-re-invocation to handle
 * unlimited sites within Edge Function timeout.
 */

const BATCH_SIZE = 15
const DELAY_BETWEEN_SITES_MS = 2000
const MAX_RUNTIME_MS = 240_000 // 240s safety margin

Deno.serve(handleRequest(async (req) => {
  const supabase = getServiceClient()

  try {
    const body = await req.json().catch(() => ({}))
    const cursor: string | undefined = body.cursor

    let query = supabase
      .from('tracked_sites')
      .select('id, domain, user_id')
      .order('id', { ascending: true })
      .limit(BATCH_SIZE)

    if (cursor) {
      query = query.gt('id', cursor)
    }

    const { data: sites, error } = await query

    if (error || !sites?.length) {
      console.log('[refresh-llm-visibility-all] No (more) sites or error:', error)
      return jsonOk({ refreshed: 0, next_cursor: null })
    }

    let refreshed = 0
    let errors = 0
    const startTime = Date.now()
    let lastProcessedId: string | null = null

    for (const site of sites) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.warn(`[refresh-llm-visibility-all] ⏱ Watchdog: stopping after ${refreshed} sites`)
        break
      }

      lastProcessedId = site.id

      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/calculate-llm-visibility`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tracked_site_id: site.id,
            user_id: site.user_id,
          }),
        })

        if (!resp.ok) {
          console.error(`[refresh-llm-visibility-all] Failed for ${site.domain}: ${resp.status}`)
          errors++
          continue
        }

        refreshed++
        console.log(`[refresh-llm-visibility-all] ✅ ${site.domain}`)

        await new Promise(r => setTimeout(r, DELAY_BETWEEN_SITES_MS))
      } catch (err) {
        console.error(`[refresh-llm-visibility-all] Error for ${site.domain}:`, err)
        await trackEdgeFunctionError('refresh-llm-visibility-all', err instanceof Error ? err.message : String(err), {
          domain: site.domain, user_id: site.user_id,
        }).catch(() => {})
        errors++
      }
    }

    const hasMore = sites.length === BATCH_SIZE && lastProcessedId !== null
    const nextCursor = hasMore ? lastProcessedId : null

    console.log(`[refresh-llm-visibility-all] Batch done: ${refreshed}/${sites.length} (${errors} errors)${nextCursor ? ` | next_cursor: ${nextCursor}` : ' | COMPLETE'}`)

    // ═══ SELF-RE-INVOCATION: continue processing remaining sites ═══
    if (nextCursor) {
      console.log(`[refresh-llm-visibility-all] 🔄 Self-invoking for next batch (cursor: ${nextCursor})`)
      fetch(`${supabaseUrl}/functions/v1/refresh-llm-visibility-all`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cursor: nextCursor }),
      }).catch(err => console.error('[refresh-llm-visibility-all] Self-invoke failed:', err))
    }

    return jsonOk({ refreshed, errors, total: sites.length, next_cursor: nextCursor })
  } catch (error) {
    console.error('[refresh-llm-visibility-all] Fatal:', error)
    await trackEdgeFunctionError('refresh-llm-visibility-all', error instanceof Error ? error.message : 'Fatal').catch(() => {})
    return jsonError(error instanceof Error ? error.message : 'Unknown', 500)
  }
})