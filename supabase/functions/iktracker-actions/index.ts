import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { IKTRACKER_BASE_URL } from '../_shared/domainUtils.ts';
import {
  isBlocked as slugMemoryIsBlocked,
  shouldUsePut as slugMemoryShouldUsePut,
  hashContent as slugMemoryHashContent,
  recordResult as slugMemoryRecordResult,
} from '../_shared/iktracker/slugMemory.ts';

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

// ── Editorial Guard ──
// Parménion cannot modify content it authored.
// Parménion can modify content by other authors only if < 6 months old.
const PARMENION_AUTHOR_PATTERNS = ['parménion', 'parmenion', 'crawlers autopilot']
const EDITORIAL_AGE_LIMIT_MONTHS = 6

interface EditorialGuardResult {
  allowed: boolean
  reason?: string
}

function checkEditorialGuard(postOrPage: Record<string, unknown>): EditorialGuardResult {
  const author = ((postOrPage.author_name || postOrPage.author || '') as string).toLowerCase().trim()

  // Rule 1: Parménion cannot modify its own content
  const isParmenionAuthor = PARMENION_AUTHOR_PATTERNS.some(p => author.includes(p))
  if (isParmenionAuthor) {
    return { allowed: false, reason: `Parménion ne peut pas modifier un contenu dont il est l'auteur (author: "${author}")` }
  }

  // Rule 2: Cannot modify content older than 6 months
  const dateStr = (postOrPage.published_at || postOrPage.created_at || '') as string
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

async function listPages(apiKey: string) {
  return callIktracker('GET', '/pages', apiKey)
}

async function getPage(apiKey: string, pageKey: string) {
  return callIktracker('GET', `/pages/${pageKey}`, apiKey)
}

async function updatePage(apiKey: string, pageKey: string, updates: Record<string, unknown>) {
  // Editorial guard: fetch existing page first
  const existing = await callIktracker('GET', `/pages/${pageKey}`, apiKey)
  if (existing.status === 200 && existing.data) {
    const guard = checkEditorialGuard(existing.data as Record<string, unknown>)
    if (!guard.allowed) {
      console.warn(`[iktracker-actions] EDITORIAL GUARD BLOCKED update-page "${pageKey}": ${guard.reason}`)
      return { status: 403, data: null, error: guard.reason, _editorial_guard: true }
    }
  }
  return callIktracker('PUT', `/pages/${pageKey}`, apiKey, updates)
}

async function createPage(apiKey: string, body: Record<string, unknown>) {
  return callIktracker('POST', '/pages', apiKey, body)
}

async function deletePage(apiKey: string, pageKey: string) {
  return callIktracker('DELETE', `/pages/${pageKey}`, apiKey)
}

type IktrackerPostSummary = {
  slug?: string
  status?: string | null
  title?: string
}

const VALID_STATUS_FILTERS = new Set(['draft', 'published', 'all'])

async function listPosts(apiKey: string, limit = 50, offset = 0, statusFilter?: string) {
  const normalised = (statusFilter || 'all').toLowerCase()
  const effectiveStatus = VALID_STATUS_FILTERS.has(normalised) ? normalised : 'all'

  const search = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    status: effectiveStatus,
  })

  return callIktracker('GET', `/posts?${search.toString()}`, apiKey)
}

function extractPostSummaries(data: unknown): IktrackerPostSummary[] {
  if (Array.isArray(data)) {
    return data as IktrackerPostSummary[]
  }

  if (data && typeof data === 'object') {
    const payload = data as { data?: unknown; posts?: unknown }
    if (Array.isArray(payload.posts)) {
      return payload.posts as IktrackerPostSummary[]
    }
    if (Array.isArray(payload.data)) {
      return payload.data as IktrackerPostSummary[]
    }
  }

  return []
}

async function listPostsForDedup(apiKey: string, maxPosts = 300, retries = 2): Promise<IktrackerPostSummary[]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const pageSize = 100
      const postsBySlug = new Map<string, IktrackerPostSummary>()

      for (let offset = 0; offset < maxPosts; offset += pageSize) {
        const result = await listPosts(apiKey, Math.min(pageSize, maxPosts - offset), offset, 'all')
        const pagePosts = extractPostSummaries(result.data)

        for (const post of pagePosts) {
          const dedupKey = post.slug || `${normalizeForComparison(post.title || '')}:${post.status || 'unknown'}`
          if (!postsBySlug.has(dedupKey)) {
            postsBySlug.set(dedupKey, post)
          }
        }

        if (pagePosts.length < pageSize) {
          break
        }
      }

      return Array.from(postsBySlug.values())
    } catch (e) {
      console.warn(`[iktracker-actions] listPostsForDedup attempt ${attempt + 1}/${retries + 1} failed:`, e)
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
      } else {
        throw e // re-throw on final attempt
      }
    }
  }
  return [] // unreachable but TS needs it
}

async function getPost(apiKey: string, slug: string) {
  return callIktracker('GET', `/posts/${slug}`, apiKey)
}

/** Normalize text for fuzzy comparison: lowercase, remove accents, strip punctuation */
function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** French stop words to ignore when extracting core keywords */
const STOP_WORDS = new Set([
  'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'en', 'pour', 'par',
  'sur', 'avec', 'dans', 'que', 'qui', 'est', 'au', 'aux', 'son', 'ses', 'ce',
  'cette', 'ces', 'ou', 'ne', 'pas', 'plus', 'tout', 'tous', 'votre', 'vos',
  'notre', 'nos', 'comment', 'pourquoi', 'quand', 'guide', 'complet', 'complete',
  'article', 'tout', 'savoir', 'connaitre', 'comprendre', 'the', 'and', 'for',
])

/**
 * Domain-specific synonym clusters — words within the same cluster
 * are considered semantically equivalent for dedup purposes.
 * Each cluster represents a single concept.
 */
const SYNONYM_CLUSTERS: string[][] = [
  // IKtracker domain: all terms related to "frais réels vs forfait"
  ['frais', 'reels', 'bareme', 'kilometrique', 'abattement', 'forfaitaire', 'forfait', 'indemnites', 'kilométriques', 'ik'],
  ['impots', 'impot', 'fiscal', 'fiscaux', 'fiscale', 'declaration', 'deduction', 'deduire', 'deductible'],
  ['voiture', 'vehicule', 'auto', 'automobile', 'deplacement', 'trajet', 'kilometrage', 'km'],
]

/** Map each synonym to its cluster index for fast lookup */
const SYNONYM_MAP = new Map<string, number>()
for (let i = 0; i < SYNONYM_CLUSTERS.length; i++) {
  for (const word of SYNONYM_CLUSTERS[i]) {
    SYNONYM_MAP.set(normalizeForComparison(word), i)
  }
}

/** 
 * Compute topic fingerprint: maps each word to its synonym cluster ID,
 * then returns the set of cluster IDs present in the text.
 * Two texts sharing ≥50% of cluster IDs are considered same-topic.
 */
function topicFingerprint(text: string): Set<number> {
  const normalized = normalizeForComparison(text)
  const words = normalized.split(' ').filter(w => w.length > 2 && !STOP_WORDS.has(w))
  const clusters = new Set<number>()
  for (const w of words) {
    const cid = SYNONYM_MAP.get(w)
    if (cid !== undefined) clusters.add(cid)
  }
  return clusters
}

/** 
 * Compute synonym-aware topic overlap between two titles.
 * Maps words to synonym clusters, then computes Jaccard on cluster IDs.
 */
function synonymAwareOverlap(a: string, b: string): number {
  const fpA = topicFingerprint(a)
  const fpB = topicFingerprint(b)
  // Also include non-synonym core keywords
  const coreA = extractCoreKeywords(a)
  const coreB = extractCoreKeywords(b)
  // Merge: cluster IDs (as negative numbers to avoid collision) + core words
  const setA = new Set<string>([...Array.from(fpA).map(c => `~${c}`), ...coreA])
  const setB = new Set<string>([...Array.from(fpB).map(c => `~${c}`), ...coreB])
  if (setA.size === 0 || setB.size === 0) return 0
  let intersection = 0
  for (const w of setA) { if (setB.has(w)) intersection++ }
  return intersection / Math.min(setA.size, setB.size)
}

/** Extract core keywords from a title (words that carry real topic meaning) */
function extractCoreKeywords(text: string): Set<string> {
  const normalized = normalizeForComparison(text)
  const words = normalized.split(' ').filter(w => w.length > 2 && !STOP_WORDS.has(w))
  return new Set(words)
}

/** Compute word-overlap similarity (Jaccard) between two strings, returns 0-1 */
function titleSimilarity(a: string, b: string): number {
  const wordsA = new Set(normalizeForComparison(a).split(' ').filter(w => w.length > 2))
  const wordsB = new Set(normalizeForComparison(b).split(' ').filter(w => w.length > 2))
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  let intersection = 0
  for (const w of wordsA) { if (wordsB.has(w)) intersection++ }
  return intersection / Math.max(wordsA.size, wordsB.size)
}

/** Check if two titles share the same core topic (e.g. "frais reels") */
function coreTopicOverlap(a: string, b: string): number {
  const coreA = extractCoreKeywords(a)
  const coreB = extractCoreKeywords(b)
  if (coreA.size === 0 || coreB.size === 0) return 0
  let intersection = 0
  for (const w of coreA) { if (coreB.has(w)) intersection++ }
  return intersection / Math.min(coreA.size, coreB.size)
}

/** Slug similarity: normalize slugs and compare */
function slugSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
  const wordsA = new Set(normalize(a).split(' ').filter(w => w.length > 2))
  const wordsB = new Set(normalize(b).split(' ').filter(w => w.length > 2))
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  let intersection = 0
  for (const w of wordsA) { if (wordsB.has(w)) intersection++ }
  return intersection / Math.min(wordsA.size, wordsB.size)
}

async function createPost(apiKey: string, body: Record<string, unknown>) {
  const slug = (body.slug as string) || ''
  const title = (body.title as string) || ''

  // ─── Slug Memory pre-check (anti-loop guard) ──────────────────────
  // Blocks if slug was previously blacklisted/skipped by IKtracker admin,
  // or if it's a near-variant of a blacklisted root.
  if (slug) {
    try {
      const memCheck = await slugMemoryIsBlocked(slug)
      if (memCheck.blocked) {
        console.warn(`[iktracker-actions] SLUG MEMORY BLOCKED "${slug}": ${memCheck.reason}`)
        return {
          status: 409,
          data: null,
          error: memCheck.reason,
          _slug_memory_blocked: true,
          _matched_slug: memCheck.matched_slug,
          _memory_status: memCheck.status,
          _blocked_until: memCheck.blocked_until,
          _original_action: 'create-post',
        }
      }
    } catch (e) {
      console.error('[iktracker-actions] slugMemoryIsBlocked failed (fail-open):', e)
    }

    // ─── Content-hash routing: if already published with different content → PUT ───
    try {
      const newHash = await slugMemoryHashContent(body)
      const putRoute = await slugMemoryShouldUsePut(slug, newHash)
      if (putRoute) {
        console.log(`[iktracker-actions] Slug memory: "${slug}" already published (post_id=${putRoute.postId}), content changed → routing to PUT`)
        const updateResult = await callIktracker('PUT', `/posts/${slug}`, apiKey, body)
        // Record result with new hash on success
        await slugMemoryRecordResult({
          slug,
          httpStatus: updateResult.status,
          responseBody: (updateResult.data as Record<string, unknown>) ?? null,
          contentHash: newHash,
        }).catch((e) => console.warn('[slugMemory] record (PUT route) failed:', e))
        return { ...updateResult, _upserted: true, _original_action: 'create-post', _slug_memory_route: 'put' }
      }
    } catch (e) {
      console.error('[iktracker-actions] slug memory PUT routing failed (continuing with POST):', e)
    }
  }


  if (slug) {
    try {
      const existing = await callIktracker('GET', `/posts/${slug}`, apiKey)
      if (existing && existing.status === 200 && existing.data) {
        // Editorial guard on upsert
        const guard = checkEditorialGuard(existing.data as Record<string, unknown>)
        if (!guard.allowed) {
          console.warn(`[iktracker-actions] EDITORIAL GUARD BLOCKED upsert "${slug}": ${guard.reason}`)
          return { status: 403, data: null, error: guard.reason, _editorial_guard: true, _original_action: 'create-post' }
        }
        console.log(`[iktracker-actions] Post with slug "${slug}" already exists, converting to UPDATE`)
        const updateResult = await callIktracker('PUT', `/posts/${slug}`, apiKey, body)
        return { ...updateResult, _upserted: true, _original_action: 'create-post' }
      }
    } catch (_) {
      // 404 = doesn't exist, continue
    }
  }

  // 2) Multi-layer semantic dedup
  if (title || slug) {
    try {
      const posts = await listPostsForDedup(apiKey)
      
      // Layer D: Topic saturation guard — block if ≥2 articles share same topic (synonym-aware)
      let sameTopicCount = 0
      const sameTopicTitles: string[] = []
      for (const post of posts) {
        if (!post.title) continue
        // Use BOTH core overlap AND synonym-aware overlap
        const coreOvl = coreTopicOverlap(title, post.title)
        const synOvl = synonymAwareOverlap(title, post.title)
        const bestOverlap = Math.max(coreOvl, synOvl)
        if (bestOverlap >= 0.50) {
          sameTopicCount++
          sameTopicTitles.push(post.title)
        }
      }
      if (sameTopicCount >= 2) {
        console.warn(`[iktracker-actions] TOPIC SATURATION BLOCKED: "${title}" — ${sameTopicCount} existing articles on same topic: ${sameTopicTitles.slice(0, 5).join(', ')}`)
        return {
          status: 409,
          data: null,
          error: `Topic saturation: ${sameTopicCount} articles already cover this topic (${sameTopicTitles.slice(0, 3).join(', ')}). Choose a different subject or use update-post.`,
          _topic_saturated: true,
          _same_topic_count: sameTopicCount,
          _existing_titles: sameTopicTitles.slice(0, 5),
        }
      }

      for (const post of posts) {
        if (!post.title) continue

        // Layer A: Classic Jaccard on full title
        const sim = titleSimilarity(title, post.title)
        if (sim >= 0.45) {
          const existingSlug = post.slug || ''
          console.log(`[iktracker-actions] Title duplicate detected (jaccard=${sim.toFixed(2)}): "${title}" ≈ "${post.title}" → updating slug "${existingSlug}"`)
          if (existingSlug) {
            const dedupGuard = checkEditorialGuard(post as Record<string, unknown>)
            if (!dedupGuard.allowed) {
              console.warn(`[iktracker-actions] EDITORIAL GUARD BLOCKED dedup-upsert "${existingSlug}": ${dedupGuard.reason}`)
              return { status: 403, data: null, error: dedupGuard.reason, _editorial_guard: true, _original_action: 'create-post', _duplicate_of: existingSlug }
            }
            const updateResult = await callIktracker('PUT', `/posts/${existingSlug}`, apiKey, body)
            return { ...updateResult, _upserted: true, _original_action: 'create-post', _duplicate_of: existingSlug, _similarity: sim, _dedup_layer: 'jaccard' }
          }
        }

        // Layer B: Core topic overlap — if ≥80% of core keywords match
        const coreOverlap = coreTopicOverlap(title, post.title)
        if (coreOverlap >= 0.80) {
          const existingSlug = post.slug || ''
          console.log(`[iktracker-actions] Core topic duplicate detected (overlap=${coreOverlap.toFixed(2)}): "${title}" ≈ "${post.title}" → updating slug "${existingSlug}"`)
          if (existingSlug) {
            const dedupGuard = checkEditorialGuard(post as Record<string, unknown>)
            if (!dedupGuard.allowed) {
              console.warn(`[iktracker-actions] EDITORIAL GUARD BLOCKED dedup-upsert "${existingSlug}": ${dedupGuard.reason}`)
              return { status: 403, data: null, error: dedupGuard.reason, _editorial_guard: true, _original_action: 'create-post', _duplicate_of: existingSlug }
            }
            const updateResult = await callIktracker('PUT', `/posts/${existingSlug}`, apiKey, body)
            return { ...updateResult, _upserted: true, _original_action: 'create-post', _duplicate_of: existingSlug, _similarity: coreOverlap, _dedup_layer: 'core_topic' }
          }
        }

        // Layer E (NEW): Synonym-aware overlap — catches "barème kilométrique" ≈ "abattement forfaitaire"
        const synOverlap = synonymAwareOverlap(title, post.title)
        if (synOverlap >= 0.55) {
          const existingSlug = post.slug || ''
          console.log(`[iktracker-actions] Synonym duplicate detected (synOverlap=${synOverlap.toFixed(2)}): "${title}" ≈ "${post.title}" → updating slug "${existingSlug}"`)
          if (existingSlug) {
            const dedupGuard = checkEditorialGuard(post as Record<string, unknown>)
            if (!dedupGuard.allowed) {
              console.warn(`[iktracker-actions] EDITORIAL GUARD BLOCKED dedup-upsert "${existingSlug}": ${dedupGuard.reason}`)
              return { status: 403, data: null, error: dedupGuard.reason, _editorial_guard: true, _original_action: 'create-post', _duplicate_of: existingSlug }
            }
            const updateResult = await callIktracker('PUT', `/posts/${existingSlug}`, apiKey, body)
            return { ...updateResult, _upserted: true, _original_action: 'create-post', _duplicate_of: existingSlug, _similarity: synOverlap, _dedup_layer: 'synonym' }
          }
        }

        // Layer C: Slug similarity
        if (slug && post.slug) {
          const slugSim = slugSimilarity(slug, post.slug)
          if (slugSim >= 0.70) {
            console.log(`[iktracker-actions] Slug duplicate detected (slugSim=${slugSim.toFixed(2)}): "${slug}" ≈ "${post.slug}" → updating`)
            const dedupGuard = checkEditorialGuard(post as Record<string, unknown>)
            if (!dedupGuard.allowed) {
              console.warn(`[iktracker-actions] EDITORIAL GUARD BLOCKED dedup-upsert "${post.slug}": ${dedupGuard.reason}`)
              return { status: 403, data: null, error: dedupGuard.reason, _editorial_guard: true, _original_action: 'create-post', _duplicate_of: post.slug }
            }
            const updateResult = await callIktracker('PUT', `/posts/${post.slug}`, apiKey, body)
            return { ...updateResult, _upserted: true, _original_action: 'create-post', _duplicate_of: post.slug, _similarity: slugSim, _dedup_layer: 'slug' }
          }
        }
      }
    } catch (e) {
      console.error('[iktracker-actions] Semantic dedup check FAILED after retries — BLOCKING creation to prevent duplicates:', e)
      return { status: 503, data: null, error: 'Dedup check failed — article creation blocked to prevent duplicates. Retry later.', _dedup_blocked: true }
    }
  }

  // Final POST + record verdict in slug memory
  const postResult = await callIktracker('POST', '/posts', apiKey, body)
  if (slug) {
    try {
      const finalHash = await slugMemoryHashContent(body)
      await slugMemoryRecordResult({
        slug,
        httpStatus: postResult.status,
        responseBody: (postResult.data as Record<string, unknown>) ?? null,
        contentHash: finalHash,
      })
    } catch (e) {
      console.warn('[slugMemory] record (POST) failed:', e)
    }
  }
  return postResult
}

async function updatePost(apiKey: string, slug: string, updates: Record<string, unknown>) {
  // Editorial guard: fetch existing post first
  const existing = await callIktracker('GET', `/posts/${slug}`, apiKey)
  if (existing.status === 200 && existing.data) {
    const guard = checkEditorialGuard(existing.data as Record<string, unknown>)
    if (!guard.allowed) {
      console.warn(`[iktracker-actions] EDITORIAL GUARD BLOCKED update-post "${slug}": ${guard.reason}`)
      return { status: 403, data: null, error: guard.reason, _editorial_guard: true }
    }
  }
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

    // Support both GET (query params) and POST (JSON body)
    let action: string | null = null
    let params: Record<string, unknown> = {}

    const url = new URL(req.url)
    if (req.method === 'GET' || req.method === 'HEAD') {
      action = url.searchParams.get('action')
      for (const [key, value] of url.searchParams.entries()) {
        if (key !== 'action') params[key] = value
      }
    } else {
      const body = await req.json()
      action = body.action
      const { action: _, ...rest } = body
      // Support both flat params and nested { params: { ... } }
      params = rest.params && typeof rest.params === 'object' ? { ...rest, ...rest.params } : rest
    }

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
        result = await listPosts(apiKey, params.limit, params.offset, params.status ?? (params.all === true ? 'all' : 'all'))
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
      case 'get-injections': {
        // get-injections is an alias; location param filters (defaults to body_end)
        const location = (params.location as string) || 'body_end'
        if (location === 'head') {
          result = await getInjectionHead(apiKey)
        } else if (location.startsWith('page/') || location.startsWith('page:')) {
          const pageKey = location.replace(/^page[/:]/, '')
          result = await getInjectionPage(apiKey, pageKey)
        } else {
          result = await getInjectionBodyEnd(apiKey)
        }
        break
      }
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
}))