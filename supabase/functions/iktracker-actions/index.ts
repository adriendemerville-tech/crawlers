import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * iktracker-actions
 * 
 * Pont API entre Crawlers et l'API Content d'IKtracker.
 * Permet de lire/modifier les articles de blog, pages statiques,
 * injecter du code correctif (head/body-end/page), gérer le SEO
 * (robots.txt, redirects) et piloter le registre Autopilot.
 * 
 * Actions: list-pages, get-page, update-page, create-page, delete-page,
 *          list-posts, get-post, create-post, update-post, delete-post,
 *          push-code-head, push-code-body, push-code-page,
 *          get-injection-head, get-injection-body-end, get-injection-page,
 *          get-robots-txt, update-robots-txt, list-redirects, create-redirect, delete-redirect,
 *          push-event, autopilot-registry, autopilot-health, autopilot-events, autopilot-summary,
 *          test-connection
 */

const IKTRACKER_BASE_URL = 'https://yarjaudctshlxkatqgeb.supabase.co/functions/v1/blog-api'

async function getApiKey(): Promise<string> {
  const key = Deno.env.get('IKTRACKER_API_KEY')
  if (!key) throw new Error('IKTRACKER_API_KEY not configured')
  return key
}

async function callIktracker(
  method: string,
  path: string,
  apiKey: string,
  body?: Record<string, unknown>
): Promise<{ status: number; data: unknown }> {
  const url = `${IKTRACKER_BASE_URL}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
  }

  const opts: RequestInit = { method, headers }
  if (body && ['POST', 'PUT'].includes(method)) {
    opts.body = JSON.stringify(body)
  }

  console.log(`[iktracker-actions] ${method} ${url}`)
  const resp = await fetch(url, opts)
  const data = await resp.json().catch(() => null)
  return { status: resp.status, data }
}

// ── Action handlers ──

async function testConnection(apiKey: string) {
  // Try to list pages as a connection test
  const result = await callIktracker('GET', '/pages', apiKey)
  return {
    connected: result.status === 200,
    status: result.status,
    pages_count: Array.isArray(result.data) ? result.data.length : 0,
  }
}

async function listPages(apiKey: string) {
  return callIktracker('GET', '/pages', apiKey)
}

async function getPage(apiKey: string, pageKey: string) {
  return callIktracker('GET', `/pages/${pageKey}`, apiKey)
}

async function updatePage(apiKey: string, pageKey: string, updates: Record<string, unknown>) {
  return callIktracker('PUT', `/pages/${pageKey}`, apiKey, updates)
}

async function createPage(apiKey: string, body: Record<string, unknown>) {
  return callIktracker('POST', '/pages', apiKey, body)
}

async function deletePage(apiKey: string, pageKey: string) {
  return callIktracker('DELETE', `/pages/${pageKey}`, apiKey)
}

async function listPosts(apiKey: string, limit = 50, offset = 0) {
  return callIktracker('GET', `/posts?limit=${limit}&offset=${offset}`, apiKey)
}

async function getPost(apiKey: string, slug: string) {
  return callIktracker('GET', `/posts/${slug}`, apiKey)
}

async function createPost(apiKey: string, body: Record<string, unknown>) {
  // Anti-duplicate: if slug provided, check if post already exists → convert to update
  const slug = (body.slug as string) || ''
  if (slug) {
    try {
      const existing = await callIktracker('GET', `/posts/${slug}`, apiKey)
      // callIktracker returns {status, data} — check status 200 and data exists
      if (existing && existing.status === 200 && existing.data) {
        console.log(`[iktracker-actions] Post with slug "${slug}" already exists, converting to UPDATE`)
        const updateResult = await callIktracker('PUT', `/posts/${slug}`, apiKey, body)
        return { ...updateResult, _upserted: true, _original_action: 'create-post' }
      }
    } catch (_) {
      // 404 or error = doesn't exist, proceed with creation
    }
  }
  return callIktracker('POST', '/posts', apiKey, body)
}

async function updatePost(apiKey: string, slug: string, updates: Record<string, unknown>) {
  return callIktracker('PUT', `/posts/${slug}`, apiKey, updates)
}

async function deletePost(apiKey: string, slug: string) {
  return callIktracker('DELETE', `/posts/${slug}`, apiKey)
}

// ── Code Injection (via /cms-push-code alias) ──

async function getInjectionHead(apiKey: string) {
  return callIktracker('GET', '/cms-push-code/head', apiKey)
}

async function putInjectionHead(apiKey: string, body: Record<string, unknown>) {
  return callIktracker('PUT', '/cms-push-code/head', apiKey, body)
}

async function getInjectionBodyEnd(apiKey: string) {
  return callIktracker('GET', '/cms-push-code/body-end', apiKey)
}

async function putInjectionBodyEnd(apiKey: string, body: Record<string, unknown>) {
  return callIktracker('PUT', '/cms-push-code/body-end', apiKey, body)
}

async function getInjectionPage(apiKey: string, pageKey: string) {
  return callIktracker('GET', `/cms-push-code/page/${pageKey}`, apiKey)
}

async function putInjectionPage(apiKey: string, pageKey: string, body: Record<string, unknown>) {
  return callIktracker('PUT', `/cms-push-code/page/${pageKey}`, apiKey, body)
}

// ── SEO (robots.txt, sitemap, redirects) ──

async function getRobotsTxt(apiKey: string) {
  return callIktracker('GET', '/seo/robots-txt', apiKey)
}

async function putRobotsTxt(apiKey: string, content: string) {
  return callIktracker('PUT', '/seo/robots-txt', apiKey, { content })
}

async function getRedirects(apiKey: string) {
  return callIktracker('GET', '/seo/redirects', apiKey)
}

async function createRedirect(apiKey: string, body: Record<string, unknown>) {
  return callIktracker('POST', '/seo/redirects', apiKey, body)
}

async function deleteRedirect(apiKey: string, redirectId: string) {
  return callIktracker('DELETE', `/seo/redirects/${redirectId}`, apiKey)
}

// ── Autopilot: Events ──

async function pushEvent(apiKey: string, body: Record<string, unknown>) {
  return callIktracker('POST', '/autopilot/events', apiKey, body)
}

async function getAutopilotRegistry(apiKey: string, includeReverted = true, limit = 200) {
  return callIktracker('GET', `/autopilot/registry?include_reverted=${includeReverted}&limit=${limit}`, apiKey)
}

async function getAutopilotHealth(apiKey: string) {
  return callIktracker('GET', '/autopilot/health', apiKey)
}

async function getAutopilotEvents(apiKey: string, resolved?: boolean) {
  const qs = resolved !== undefined ? `?resolved=${resolved}` : ''
  return callIktracker('GET', `/autopilot/events${qs}`, apiKey)
}

async function getAutopilotSummary(apiKey: string) {
  return callIktracker('GET', '/autopilot/summary', apiKey)
}

// ── Main handler ──

Deno.serve(handleRequest(async (req) => {
try {
    const apiKey = await getApiKey()
    const { action, ...params } = await req.json()

    if (!action) {
      return jsonError('action required', 400)
    }

    let result: unknown

    switch (action) {
      case 'test-connection':
        result = await testConnection(apiKey)
        break

      // ── Pages ──
      case 'list-pages':
        result = await listPages(apiKey)
        break
      case 'get-page':
        if (!params.page_key) throw new Error('page_key required')
        result = await getPage(apiKey, params.page_key)
        break
      case 'update-page':
        if (!params.page_key) throw new Error('page_key required')
        result = await updatePage(apiKey, params.page_key, params.updates || {})
        break
      case 'create-page':
        result = await createPage(apiKey, params.body || params)
        break
      case 'delete-page':
        if (!params.page_key) throw new Error('page_key required')
        result = await deletePage(apiKey, params.page_key)
        break

      // ── Posts ──
      case 'list-posts':
        result = await listPosts(apiKey, params.limit, params.offset)
        break
      case 'get-post':
        if (!params.slug) throw new Error('slug required')
        result = await getPost(apiKey, params.slug)
        break
      case 'create-post':
        result = await createPost(apiKey, params.body || params)
        break
      case 'update-post':
        if (!params.slug) throw new Error('slug required')
        result = await updatePost(apiKey, params.slug, params.updates || {})
        break
      case 'delete-post':
        if (!params.slug) throw new Error('slug required')
        result = await deletePost(apiKey, params.slug)
        break

      // ── Autopilot ──
      case 'push-event':
        if (!params.event_type) throw new Error('event_type required')
        result = await pushEvent(apiKey, {
          event_type: params.event_type,
          severity: params.severity || 'info',
          page_key: params.page_key || null,
          message: params.message || '',
          details: params.details || {},
          audit_log_id: params.audit_log_id || null,
        })
        break
      case 'autopilot-registry':
        result = await getAutopilotRegistry(apiKey, params.include_reverted, params.limit)
        break
      case 'autopilot-health':
        result = await getAutopilotHealth(apiKey)
        break
      case 'autopilot-events':
        result = await getAutopilotEvents(apiKey, params.resolved)
        break
      case 'autopilot-summary':
        result = await getAutopilotSummary(apiKey)
        break

      // ── Code Injection ──
      case 'get-injection-head':
        result = await getInjectionHead(apiKey)
        break
      case 'push-code-head':
        result = await putInjectionHead(apiKey, {
          content: params.code || params.content,
          label: params.label || 'Crawlers SEO Fix',
          is_active: params.is_active !== false,
        })
        break
      case 'get-injection-body-end':
        result = await getInjectionBodyEnd(apiKey)
        break
      case 'push-code-body':
        result = await putInjectionBodyEnd(apiKey, {
          content: params.code || params.content,
          label: params.label || 'Crawlers SEO Fix',
          is_active: params.is_active !== false,
        })
        break
      case 'get-injection-page':
        if (!params.page_key) throw new Error('page_key required')
        result = await getInjectionPage(apiKey, params.page_key)
        break
      case 'push-code-page':
        if (!params.page_key) throw new Error('page_key required')
        result = await putInjectionPage(apiKey, params.page_key, {
          content: params.code || params.content,
          label: params.label,
          is_active: params.is_active !== false,
        })
        break

      // ── SEO ──
      case 'get-robots-txt':
        result = await getRobotsTxt(apiKey)
        break
      case 'update-robots-txt':
        if (!params.content) throw new Error('content required')
        result = await putRobotsTxt(apiKey, params.content)
        break
      case 'list-redirects':
        result = await getRedirects(apiKey)
        break
      case 'create-redirect':
        if (!params.source_path || !params.target_url) throw new Error('source_path and target_url required')
        result = await createRedirect(apiKey, {
          source_path: params.source_path,
          target_url: params.target_url,
          status_code: params.status_code || 301,
          is_active: params.is_active !== false,
        })
        break
      case 'delete-redirect':
        if (!params.redirect_id) throw new Error('redirect_id required')
        result = await deleteRedirect(apiKey, params.redirect_id)
        break

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    // Log action for traceability — detect upsert (create that became update)
    try {
      const supabase = getServiceClient()
      const wasUpserted = result && typeof result === 'object' && (result as any)._upserted === true
      const effectiveAction = wasUpserted ? 'update-post' : action
      const logData: Record<string, unknown> = {
        action: effectiveAction,
        original_action: wasUpserted ? 'create-post' : action,
        was_upserted: wasUpserted,
        params_keys: Object.keys(params),
      }
      // Capture identifiers for history display
      if (params.slug) logData.slug = params.slug
      if (params.page_key) logData.page_key = params.page_key
      if (params.updates) logData.updates_keys = Object.keys(params.updates)
      if (params.body?.title) logData.title = params.body.title
      if (params.body?.slug) logData.slug = params.body.slug
      // Capture push-event context for accurate report labeling
      if (params.event_type) logData.event_type = params.event_type
      if (params.details?.phase) logData.pipeline_phase = params.details.phase
      if (params.details?.status) logData.final_status = params.details.status
      if (params.message) logData.message = params.message
      // Capture result status
      if (result && typeof result === 'object' && 'status' in (result as any)) {
        logData.response_status = (result as any).status
      }
      await supabase.from('analytics_events').insert({
        event_type: 'cms_action:iktracker',
        event_data: logData,
      })
    } catch (e) {
      console.warn('[iktracker-actions] Analytics log failed:', e)
    }

    return jsonOk({ success: true, action, result })
  } catch (error) {
    console.error('[iktracker-actions] Error:', error)
    return jsonError(error instanceof Error ? error.message : 'Unknown error', 500)
  }
})