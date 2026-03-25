import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * iktracker-actions
 * 
 * Pont API entre Crawlers et l'API Content d'IKtracker.
 * Permet de lire/modifier les articles de blog et les pages statiques.
 * 
 * Actions: list-pages, get-page, update-page, create-page, delete-page,
 *          list-posts, get-post, create-post, update-post, delete-post,
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
  return callIktracker('POST', '/posts', apiKey, body)
}

async function updatePost(apiKey: string, slug: string, updates: Record<string, unknown>) {
  return callIktracker('PUT', `/posts/${slug}`, apiKey, updates)
}

async function deletePost(apiKey: string, slug: string) {
  return callIktracker('DELETE', `/posts/${slug}`, apiKey)
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const apiKey = await getApiKey()
    const { action, ...params } = await req.json()

    if (!action) {
      return new Response(JSON.stringify({ error: 'action required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    // Log action for traceability
    try {
      const supabase = getServiceClient()
      const logData: Record<string, unknown> = {
        action,
        params_keys: Object.keys(params),
      }
      // Capture identifiers for history display
      if (params.slug) logData.slug = params.slug
      if (params.page_key) logData.page_key = params.page_key
      if (params.updates) logData.updates_keys = Object.keys(params.updates)
      if (params.body?.title) logData.title = params.body.title
      if (params.body?.slug) logData.slug = params.body.slug
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

    return new Response(JSON.stringify({ success: true, action, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[iktracker-actions] Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
