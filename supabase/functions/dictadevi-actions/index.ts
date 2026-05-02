import { getServiceClient } from '../_shared/supabaseClient.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts'
import { DICTADEVI_BASE_URL, DICTADEVI_PUBLIC_RESOURCES, getDictadeviApiKey } from '../_shared/domainUtils.ts'
import { marked } from 'https://esm.sh/marked@12.0.2'

// ── Markdown → HTML guard ──
// Dictadevi attend du HTML rendu. Parménion / pipeline éditorial peuvent
// produire spontanément du Markdown. On convertit défensivement avant push.
const CONTENT_FIELDS = ['content', 'body', 'excerpt'] as const
const MD_SIGNALS = /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|>\s|\d+\.\s|```)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\[[^\]]+\]\([^)]+\))/

function looksLikeHtml(s: string): boolean {
  // Considère HTML dès qu'on voit un tag de structure éditoriale connu.
  return /<\s*(p|h[1-6]|ul|ol|li|blockquote|section|article|div|figure|table|br|strong|em|a)\b/i.test(s)
}

function looksLikeMarkdown(s: string): boolean {
  if (!s || typeof s !== 'string') return false
  if (looksLikeHtml(s)) return false
  return MD_SIGNALS.test(s)
}

function convertMarkdownToHtml(md: string): string {
  try {
    marked.setOptions({ gfm: true, breaks: false })
    const html = marked.parse(md, { async: false }) as string
    return html.trim()
  } catch (e) {
    console.warn('[dictadevi-actions] marked.parse failed, returning original:', (e as Error).message)
    return md
  }
}

/** Convertit en place les champs textuels Markdown → HTML. Mutation idempotente. */
function ensureHtmlContent(body: Record<string, unknown>, ctx: string): void {
  for (const field of CONTENT_FIELDS) {
    const val = body[field]
    if (typeof val !== 'string' || !val.trim()) continue
    if (looksLikeMarkdown(val)) {
      const html = convertMarkdownToHtml(val)
      console.log(`[dictadevi-actions] ${ctx}: champ "${field}" converti Markdown→HTML (${val.length} → ${html.length} chars)`)
      body[field] = html
    }
  }
}

/**
 * dictadevi-actions
 *
 * Pont API entre Crawlers (Parménion / autopilot-engine) et l'API REST custom
 * de Dictadevi (v1). Voir knowledge/tech/api/dictadevi-bridge-fr.md.
 *
 * Base URL : https://dictadevi.io/api/v1
 * Auth     : Authorization: Bearer dk_xxxxxxxx
 *
 * Actions supportées par l'API Dictadevi (CMS minimaliste, posts + pages):
 *   - test-connection      → GET /health
 *   - list-posts           → GET /posts        (status, slug, limit, offset)
 *   - get-post             → GET /posts/:slug
 *   - create-post          → POST /posts       (upsert: si slug existe, bascule en update)
 *   - update-post          → PUT /posts/:slug  (garde éditoriale Parménion)
 *   - delete-post          → DELETE /posts/:slug
 *   - get-page             → GET /pages/:key
 *   - get-public-resources → liste statique des sitemaps/llms.txt (no auth)
 *
 * Actions non supportées (Dictadevi n'expose PAS ces endpoints) → 501 not_supported :
 *   - push-code-head/body/page, get-injection-*, redirects, robots.txt,
 *     push-event, list-pages, create/update/delete-page.
 *   Le routeur Parménion (cmsActionRouter) doit les éviter pour Dictadevi.
 *
 * Garde éditoriale (cohérence avec iktracker-actions):
 *   - Refus si auteur ∈ {parménion, parmenion, crawlers autopilot}
 *   - Refus si published_at > 6 mois
 */

// ── Editorial Guard ──
const PARMENION_AUTHOR_PATTERNS = ['parménion', 'parmenion', 'crawlers autopilot']
const EDITORIAL_AGE_LIMIT_MONTHS = 6

interface EditorialGuardResult { allowed: boolean; reason?: string }

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
  apiKey: string | null,
  body?: Record<string, unknown>,
  timeoutMs = 15000,
): Promise<{ status: number; data: unknown }> {
  const url = `${DICTADEVI_BASE_URL}${path}`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
  const init: RequestInit = { method, headers, signal: AbortSignal.timeout(timeoutMs) }
  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) init.body = JSON.stringify(body)

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

async function testConnection(apiKey: string | null) {
  // /health is public, no auth required
  const result = await callDictadevi('GET', '/health', null)
  let writeReady = false
  if (apiKey) {
    const probe = await callDictadevi('GET', '/posts?limit=1', apiKey)
    writeReady = probe.status === 200
  }
  return {
    connected: result.status === 200,
    health_status: result.status,
    auth_configured: !!apiKey,
    write_ready: writeReady,
    base_url: DICTADEVI_BASE_URL,
  }
}

async function listPosts(apiKey: string, params: Record<string, unknown>) {
  const search = new URLSearchParams()
  if (params.status)  search.set('status', String(params.status))
  if (params.slug)    search.set('slug', String(params.slug))
  if (params.limit !== undefined)  search.set('limit', String(params.limit))
  if (params.offset !== undefined) search.set('offset', String(params.offset))
  const qs = search.toString()
  return callDictadevi('GET', `/posts${qs ? `?${qs}` : ''}`, apiKey)
}

const getPost = (apiKey: string, slug: string) => callDictadevi('GET', `/posts/${slug}`, apiKey)

async function createPost(apiKey: string, body: Record<string, unknown>) {
  const slug = (body.slug as string) || ''
  // Upsert behaviour: if slug already exists, switch to update (with guard).
  if (slug) {
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

const deletePost = (apiKey: string, slug: string) => callDictadevi('DELETE', `/posts/${slug}`, apiKey)
const getPage    = (apiKey: string, key: string)  => callDictadevi('GET', `/pages/${key}`, apiKey)

function getPublicResources() {
  return { resources: DICTADEVI_PUBLIC_RESOURCES, note: 'All URLs are public (no auth required).' }
}

// Actions explicitly not supported by Dictadevi v1 — surfaced clearly so callers
// (autopilot-engine, parmenion) can route them elsewhere or skip.
const UNSUPPORTED_ACTIONS = new Set<string>([
  'push-code-head', 'push-code-body', 'push-code-page',
  'get-injection-head', 'get-injection-body-end', 'get-injection-page',
  'get-robots-txt', 'update-robots-txt',
  'list-redirects', 'create-redirect', 'delete-redirect',
  'push-event',
  'list-pages', 'create-page', 'update-page', 'delete-page',
])

// ── Main handler ──
Deno.serve(handleRequest(async (req: Request) => {
  if (req.method !== 'POST') return jsonError('Method not allowed', 405)

  let payload: { action?: string; params?: Record<string, unknown> } = {}
  try { payload = await req.json() } catch { return jsonError('Invalid JSON body', 400) }

  const action = (payload.action || '').toString().trim()
  const params = payload.params || {}
  if (!action) return jsonError('action is required', 400)

  // Public actions (no API key required)
  if (action === 'get-public-resources') {
    return jsonOk(getPublicResources())
  }

  // Unsupported actions — return 501 with explicit reason (not 400)
  if (UNSUPPORTED_ACTIONS.has(action)) {
    console.warn(`[dictadevi-actions] Action "${action}" is not supported by Dictadevi API v1`)
    return new Response(JSON.stringify({
      success: false,
      error: `Action "${action}" not supported by Dictadevi API v1`,
      _not_supported_by_dictadevi: true,
      hint: 'Dictadevi v1 expose uniquement /posts (CRUD), /pages/:key (GET) et /health.',
    }), { status: 501, headers: { 'Content-Type': 'application/json' } })
  }

  const supabase = getServiceClient()
  const apiKey = await getDictadeviApiKey(supabase)

  // /health is the only auth-less route on Dictadevi → tolerate missing key for test-connection
  if (!apiKey && action !== 'test-connection') {
    console.error('[dictadevi-actions] No API key found (env DICTADEVI_API_KEY missing AND no row in parmenion_targets)')
    return jsonError('DICTADEVI_API_KEY not configured (set env or seed parmenion_targets row for dictadevi.io)', 500)
  }

  try {
    let result: unknown
    switch (action) {
      case 'test-connection': result = await testConnection(apiKey); break
      // Posts
      case 'list-posts':      result = await listPosts(apiKey!, params); break
      case 'get-post':        result = await getPost(apiKey!, String(params.slug || '')); break
      case 'create-post':     result = await createPost(apiKey!, params); break
      case 'update-post':     result = await updatePost(apiKey!, String(params.slug || ''), params); break
      case 'delete-post':     result = await deletePost(apiKey!, String(params.slug || '')); break
      // Pages (read-only)
      case 'get-page':        result = await getPage(apiKey!, String(params.page_key || params.key || '')); break
      default:
        return jsonError(`Unknown action: ${action}`, 400)
    }
    return jsonOk(result)
  } catch (e) {
    console.error(`[dictadevi-actions] Error on action "${action}":`, e)
    return jsonError(e instanceof Error ? e.message : 'Unknown error', 500)
  }
}))
