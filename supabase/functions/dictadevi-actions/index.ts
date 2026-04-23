import { getServiceClient } from '../_shared/supabaseClient.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts'
import { DICTADEVI_BASE_URL, getDictadeviApiKey } from '../_shared/domainUtils.ts'

/**
 * dictadevi-actions
 *
 * Pont API entre Crawlers et l'API Content de Dictadevi (miroir d'iktracker-actions).
 * Permet à Parménion (autopilot-engine + parmenion-orchestrator) de piloter dictadevi.io
 * en autonomie complète.
 *
 * Actions supportées:
 *   - Pages    : list-pages, get-page, create-page, update-page, delete-page
 *   - Posts    : list-posts, get-post, create-post, update-post, delete-post
 *   - Code     : push-code-head, push-code-body, push-code-page,
 *                get-injection-head, get-injection-body-end, get-injection-page
 *   - SEO      : get-robots-txt, update-robots-txt
 *   - Redirects: list-redirects, create-redirect, delete-redirect
 *   - Events   : push-event (autopilot)
 *   - Misc     : test-connection
 *
 * Garde éditoriale : Parménion ne modifie pas un contenu dont il est l'auteur,
 * ni un contenu de plus de 6 mois (cohérence avec iktracker-actions).
 *
 * Auth API key : récupérée via getDictadeviApiKey() qui lit d'abord
 * l'env DICTADEVI_API_KEY puis fallback sur parmenion_targets.api_key_name.
 */

// ── Editorial Guard (mêmes règles qu'iktracker) ──
const PARMENION_AUTHOR_PATTERNS = ['parménion', 'parmenion', 'crawlers autopilot']
const EDITORIAL_AGE_LIMIT_MONTHS = 6

interface EditorialGuardResult {
  allowed: boolean
  reason?: string
}

function checkEditorialGuard(content: Record<string, unknown>): EditorialGuardResult {
  const author = ((content.author_name || content.author || '') as string).toLowerCase().trim()
  if (PARMENION_AUTHOR_PATTERNS.some(p => author.includes(p))) {
    return { allowed: false, reason: `Parménion ne peut pas modifier un contenu dont il est l'auteur (author: "${author}")` }
  }
  const dateStr = (content.published_at || content.created_at || '') as string
  if (dateStr) {
    const publishedDate = new Date(dateStr)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - EDITORIAL_AGE_LIMIT_MONTHS)
    if (publishedDate < sixMonthsAgo) {
      return { allowed: false, reason: `Contenu trop ancien (${dateStr}) — limite de ${EDITORIAL_AGE_LIMIT_MONTHS} mois dépassée` }
    }
  }
  return { allowed: true }
}

// ── HTTP helper ──
async function callDictadevi(
  method: string,
  path: string,
  apiKey: string,
  body?: Record<string, unknown>,
  timeoutMs: number = 15000,
): Promise<{ status: number; data: unknown }> {
  const url = `${DICTADEVI_BASE_URL}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
  }
  const init: RequestInit = { method, headers, signal: AbortSignal.timeout(timeoutMs) }
  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    init.body = JSON.stringify(body)
  }
  console.log(`[dictadevi-actions] ${method} ${url}`)
  try {
    const resp = await fetch(url, init)
    const data = await resp.json().catch(() => null)
    return { status: resp.status, data }
  } catch (e) {
    console.error(`[dictadevi-actions] Network error on ${method} ${url}:`, e)
    return { status: 0, data: { error: e instanceof Error ? e.message : String(e) } }
  }
}

// ── Action handlers ──

async function testConnection(apiKey: string) {
  const result = await callDictadevi('GET', '/pages', apiKey)
  return {
    connected: result.status === 200,
    status: result.status,
    pages_count: Array.isArray(result.data) ? result.data.length : 0,
  }
}

const listPages   = (k: string) => callDictadevi('GET', '/pages', k)
const getPage     = (k: string, key: string) => callDictadevi('GET', `/pages/${key}`, k)
const createPage  = (k: string, body: Record<string, unknown>) => callDictadevi('POST', '/pages', k, body)
const deletePage  = (k: string, key: string) => callDictadevi('DELETE', `/pages/${key}`, k)

async function updatePage(apiKey: string, pageKey: string, updates: Record<string, unknown>) {
  const existing = await callDictadevi('GET', `/pages/${pageKey}`, apiKey)
  if (existing.status === 200 && existing.data) {
    const guard = checkEditorialGuard(existing.data as Record<string, unknown>)
    if (!guard.allowed) {
      console.warn(`[dictadevi-actions] EDITORIAL GUARD BLOCKED update-page "${pageKey}": ${guard.reason}`)
      return { status: 403, data: null, error: guard.reason, _editorial_guard: true }
    }
  }
  return callDictadevi('PUT', `/pages/${pageKey}`, apiKey, updates)
}

async function listPosts(apiKey: string, limit = 50, offset = 0, statusFilter = 'all') {
  const search = new URLSearchParams({ limit: String(limit), offset: String(offset), status: statusFilter })
  return callDictadevi('GET', `/posts?${search.toString()}`, apiKey)
}
const getPost = (k: string, slug: string) => callDictadevi('GET', `/posts/${slug}`, k)

async function createPost(apiKey: string, body: Record<string, unknown>) {
  const slug = (body.slug as string) || ''
  // Upsert : si slug existe déjà, on bascule en UPDATE (avec garde éditoriale)
  if (slug) {
    try {
      const existing = await callDictadevi('GET', `/posts/${slug}`, apiKey)
      if (existing.status === 200 && existing.data) {
        const guard = checkEditorialGuard(existing.data as Record<string, unknown>)
        if (!guard.allowed) {
          console.warn(`[dictadevi-actions] EDITORIAL GUARD BLOCKED upsert "${slug}": ${guard.reason}`)
          return { status: 403, data: null, error: guard.reason, _editorial_guard: true, _original_action: 'create-post' }
        }
        console.log(`[dictadevi-actions] Post "${slug}" exists → UPDATE`)
        const updated = await callDictadevi('PUT', `/posts/${slug}`, apiKey, body)
        return { ...updated, _upserted: true, _original_action: 'create-post' }
      }
    } catch (_) { /* 404 = continue */ }
  }
  return callDictadevi('POST', '/posts', apiKey, body)
}

async function updatePost(apiKey: string, slug: string, updates: Record<string, unknown>) {
  const existing = await callDictadevi('GET', `/posts/${slug}`, apiKey)
  if (existing.status === 200 && existing.data) {
    const guard = checkEditorialGuard(existing.data as Record<string, unknown>)
    if (!guard.allowed) {
      return { status: 403, data: null, error: guard.reason, _editorial_guard: true }
    }
  }
  return callDictadevi('PUT', `/posts/${slug}`, apiKey, updates)
}

const deletePost = (k: string, slug: string) => callDictadevi('DELETE', `/posts/${slug}`, k)

// Code injection
const pushCodeHead     = (k: string, code: string) => callDictadevi('POST', '/inject/head', k, { code })
const pushCodeBody     = (k: string, code: string) => callDictadevi('POST', '/inject/body-end', k, { code })
const pushCodePage     = (k: string, pageKey: string, code: string) => callDictadevi('POST', `/inject/page/${pageKey}`, k, { code })
const getInjectionHead = (k: string) => callDictadevi('GET', '/inject/head', k)
const getInjectionBody = (k: string) => callDictadevi('GET', '/inject/body-end', k)
const getInjectionPage = (k: string, pageKey: string) => callDictadevi('GET', `/inject/page/${pageKey}`, k)

// SEO
const getRobotsTxt    = (k: string) => callDictadevi('GET', '/robots.txt', k)
const updateRobotsTxt = (k: string, content: string) => callDictadevi('PUT', '/robots.txt', k, { content })

// Redirects
const listRedirects   = (k: string) => callDictadevi('GET', '/redirects', k)
const createRedirect  = (k: string, body: Record<string, unknown>) => callDictadevi('POST', '/redirects', k, body)
const deleteRedirect  = (k: string, id: string) => callDictadevi('DELETE', `/redirects/${id}`, k)

// Autopilot events
const pushEvent = (k: string, event: Record<string, unknown>) => callDictadevi('POST', '/events', k, event)

// ── Main handler ──
Deno.serve(handleRequest(async (req: Request) => {
  if (req.method !== 'POST') return jsonError('Method not allowed', 405)

  let payload: { action?: string; params?: Record<string, unknown> } = {}
  try {
    payload = await req.json()
  } catch {
    return jsonError('Invalid JSON body', 400)
  }

  const action = (payload.action || '').toString().trim()
  const params = payload.params || {}
  if (!action) return jsonError('action is required', 400)

  const supabase = getServiceClient()
  const apiKey = await getDictadeviApiKey(supabase)
  if (!apiKey) {
    console.error('[dictadevi-actions] No API key found (env DICTADEVI_API_KEY missing AND no row in parmenion_targets)')
    return jsonError('DICTADEVI_API_KEY not configured', 500)
  }

  try {
    let result: unknown
    switch (action) {
      // Misc
      case 'test-connection':       result = await testConnection(apiKey); break
      // Pages
      case 'list-pages':            result = await listPages(apiKey); break
      case 'get-page':              result = await getPage(apiKey, String(params.page_key || '')); break
      case 'create-page':           result = await createPage(apiKey, params); break
      case 'update-page':           result = await updatePage(apiKey, String(params.page_key || ''), params); break
      case 'delete-page':           result = await deletePage(apiKey, String(params.page_key || '')); break
      // Posts
      case 'list-posts':            result = await listPosts(apiKey, Number(params.limit ?? 50), Number(params.offset ?? 0), String(params.status ?? 'all')); break
      case 'get-post':              result = await getPost(apiKey, String(params.slug || '')); break
      case 'create-post':           result = await createPost(apiKey, params); break
      case 'update-post':           result = await updatePost(apiKey, String(params.slug || ''), params); break
      case 'delete-post':           result = await deletePost(apiKey, String(params.slug || '')); break
      // Code injection
      case 'push-code-head':        result = await pushCodeHead(apiKey, String(params.code || '')); break
      case 'push-code-body':        result = await pushCodeBody(apiKey, String(params.code || '')); break
      case 'push-code-page':        result = await pushCodePage(apiKey, String(params.page_key || ''), String(params.code || '')); break
      case 'get-injection-head':    result = await getInjectionHead(apiKey); break
      case 'get-injection-body-end':result = await getInjectionBody(apiKey); break
      case 'get-injection-page':    result = await getInjectionPage(apiKey, String(params.page_key || '')); break
      // SEO
      case 'get-robots-txt':        result = await getRobotsTxt(apiKey); break
      case 'update-robots-txt':     result = await updateRobotsTxt(apiKey, String(params.content || '')); break
      // Redirects
      case 'list-redirects':        result = await listRedirects(apiKey); break
      case 'create-redirect':       result = await createRedirect(apiKey, params); break
      case 'delete-redirect':       result = await deleteRedirect(apiKey, String(params.id || '')); break
      // Autopilot events
      case 'push-event':            result = await pushEvent(apiKey, params); break
      default:                      return jsonError(`Unknown action: ${action}`, 400)
    }
    return jsonOk(result)
  } catch (e) {
    console.error(`[dictadevi-actions] Error on action "${action}":`, e)
    return jsonError(e instanceof Error ? e.message : 'Unknown error', 500)
  }
}))
