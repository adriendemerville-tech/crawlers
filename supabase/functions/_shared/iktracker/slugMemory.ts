/**
 * iktracker/slugMemory.ts — Persistence layer to prevent the agent from
 * republishing the same articles in a loop after IKtracker admin rejection.
 *
 * Backed by Supabase table `public.iktracker_slug_memory` (admin-readable, service-role-writable).
 *
 * Three core primitives:
 *  - isBlocked(slug, domain)        → check BEFORE POST
 *  - shouldUsePut(slug, domain, hash) → routing helper for content updates
 *  - recordResult(...)              → persist verdict AFTER each API call
 *
 * Design choices (vs original prompt):
 *  - NO auto-blacklist of year variants (yearly content is legitimately distinct)
 *  - Levenshtein computed ONLY on year-stripped root (avoids `tva` vs `tvq` false positives)
 *  - Stores `iktracker_post_id` to enable PUT (update) instead of POST when content changes
 *  - Service-role only writes — agent cannot bypass from client
 */

import { getServiceClient } from '../supabaseClient.ts';

const SLUG_TABLE = 'iktracker_slug_memory';
const SKIPPED_COOLDOWN_DAYS = 7;
const ROOT_LEVENSHTEIN_MAX = 2; // strict threshold on year-stripped root

export type SlugStatus = 'published' | 'blacklisted' | 'skipped' | 'duplicate' | 'error' | 'trashed';

export interface BlockedResult {
  blocked: boolean;
  reason?: string;
  status?: SlugStatus;
  matched_slug?: string; // when blocked by variant detection
  blocked_until?: string;
}

export interface RecordInput {
  slug: string;
  domain?: string;
  trackedSiteId?: string | null;
  httpStatus: number;
  responseBody: Record<string, unknown> | null;
  contentHash?: string | null;
}

// ─────────────────────────────────────────────────────────────────
// Slug normalization & temporal detection
// ─────────────────────────────────────────────────────────────────

/** Match a 4-digit year (1990-2099) anywhere in the slug. */
const YEAR_REGEX = /\b(19[9]\d|20\d{2})\b/g;

/**
 * Returns true if the slug contains an explicit year token.
 * Yearly content (barème 2026, frais réels 2025) is legitimately distinct
 * across years and MUST NOT be auto-blacklisted as a variant.
 */
export function isTemporalSlug(slug: string): boolean {
  return YEAR_REGEX.test(slug);
}

/**
 * Strip year tokens and normalize for root comparison.
 * "frais-reels-ou-forfait-independants-2026" → "frais reels ou forfait independants"
 */
export function normalizeRoot(slug: string): string {
  return slug
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(YEAR_REGEX, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Levenshtein distance — iterative DP, O(n*m) memory O(min(n,m)). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  // Ensure a is the shorter
  if (a.length > b.length) [a, b] = [b, a];
  let prev = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    const curr = [j];
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        curr[i - 1] + 1,        // insertion
        prev[i] + 1,            // deletion
        prev[i - 1] + cost,     // substitution
      );
    }
    prev = curr;
  }
  return prev[a.length];
}

// ─────────────────────────────────────────────────────────────────
// Read API
// ─────────────────────────────────────────────────────────────────

/**
 * Check whether a slug should be blocked BEFORE attempting the API POST.
 *
 * Blocks when:
 *  1. Exact slug is `blacklisted` (definitive — admin rejected)
 *  2. Exact slug is `skipped` AND within cooldown window (7d default)
 *  3. Exact slug has `blocked_until > now()` (explicit cooldown)
 *  4. A NON-TEMPORAL variant within Levenshtein ≤ ROOT_LEVENSHTEIN_MAX
 *     of an existing `blacklisted` root exists (anti-rephrase guard)
 *
 * Does NOT block when:
 *  - Slug is `published` (legitimate; PUT routing handled by shouldUsePut)
 *  - Slug differs from a blacklisted slug only by a year token
 *  - Slug is a temporal variant (contains a year) of a blacklisted temporal slug
 *    with a different year
 */
export async function isBlocked(
  slug: string,
  domain = 'iktracker.fr',
): Promise<BlockedResult> {
  const supabase = getServiceClient();

  // 1) Exact slug lookup
  const { data: exact, error } = await supabase
    .from(SLUG_TABLE)
    .select('status, reason, blocked_until, last_seen_at')
    .eq('slug', slug)
    .eq('domain', domain)
    .maybeSingle();

  if (error) {
    console.error('[slugMemory] isBlocked exact lookup failed:', error.message);
    return { blocked: false }; // fail open — better to attempt than to silently block
  }

  if (exact) {
    if (exact.status === 'blacklisted') {
      return {
        blocked: true,
        reason: `Slug definitively blacklisted by IKtracker admin: ${exact.reason ?? 'no reason given'}`,
        status: 'blacklisted',
        matched_slug: slug,
      };
    }

    // 409 slug_in_trash → soft-delete IKtracker, restauration admin uniquement.
    // Ne JAMAIS retenter automatiquement (cf. CRAWLERS_BLOG_STATUS_UPDATE_PROMPT).
    if (exact.status === 'trashed') {
      return {
        blocked: true,
        reason: `Slug in IKtracker trash (soft-deleted): ${exact.reason ?? 'awaiting admin restore'}`,
        status: 'trashed',
        matched_slug: slug,
      };
    }

    if (exact.blocked_until && new Date(exact.blocked_until) > new Date()) {
      return {
        blocked: true,
        reason: `Slug under explicit cooldown until ${exact.blocked_until}`,
        status: exact.status as SlugStatus,
        matched_slug: slug,
        blocked_until: exact.blocked_until,
      };
    }

    if (exact.status === 'skipped') {
      const lastSeen = new Date(exact.last_seen_at);
      const cooldownEnd = new Date(lastSeen.getTime() + SKIPPED_COOLDOWN_DAYS * 86400_000);
      if (cooldownEnd > new Date()) {
        return {
          blocked: true,
          reason: `Slug recently skipped by IKtracker (cooldown ${SKIPPED_COOLDOWN_DAYS}d, retry after ${cooldownEnd.toISOString()})`,
          status: 'skipped',
          matched_slug: slug,
          blocked_until: cooldownEnd.toISOString(),
        };
      }
    }
  }

  // 2) Variant detection vs blacklisted slugs (anti-rephrase guard)
  // Only blocks if BOTH slugs are non-temporal OR both temporal with same year
  const candidateRoot = normalizeRoot(slug);
  if (candidateRoot.length < 5) {
    // too short to matter — skip variant check
    return { blocked: false };
  }

  const { data: blacklisted, error: blError } = await supabase
    .from(SLUG_TABLE)
    .select('slug, reason')
    .eq('domain', domain)
    .eq('status', 'blacklisted')
    .limit(500);

  if (blError) {
    console.error('[slugMemory] isBlocked blacklist scan failed:', blError.message);
    return { blocked: false };
  }

  const candidateIsTemporal = isTemporalSlug(slug);
  const candidateYears = candidateIsTemporal
    ? (slug.match(YEAR_REGEX) ?? []).map(String)
    : [];

  for (const row of blacklisted ?? []) {
    const blacklistedSlug = row.slug as string;
    if (blacklistedSlug === slug) continue; // already handled above

    const blacklistedIsTemporal = isTemporalSlug(blacklistedSlug);

    // RULE: if either side is temporal but they don't share a year → DO NOT block
    // (legitimate yearly content variation, e.g. bareme-2026 vs bareme-2027)
    if (candidateIsTemporal !== blacklistedIsTemporal) {
      // one is temporal, the other isn't → different intent, allow
      continue;
    }
    if (candidateIsTemporal && blacklistedIsTemporal) {
      const blYears = (blacklistedSlug.match(YEAR_REGEX) ?? []).map(String);
      const sharesYear = candidateYears.some((y) => blYears.includes(y));
      if (!sharesYear) continue; // different years → different content, allow
    }

    // Compare year-stripped roots with strict Levenshtein
    const blacklistedRoot = normalizeRoot(blacklistedSlug);
    if (blacklistedRoot.length < 5) continue;
    const dist = levenshtein(candidateRoot, blacklistedRoot);
    if (dist <= ROOT_LEVENSHTEIN_MAX) {
      return {
        blocked: true,
        reason: `Slug is a near-variant (Levenshtein ${dist}) of blacklisted slug "${blacklistedSlug}": ${row.reason ?? 'no reason'}`,
        status: 'blacklisted',
        matched_slug: blacklistedSlug,
      };
    }
  }

  return { blocked: false };
}

/**
 * Returns the IKtracker post_id if the slug was previously published AND
 * the new content hash differs from the stored one (i.e. legitimate update).
 * Returns null if no update routing should happen.
 */
export async function shouldUsePut(
  slug: string,
  newContentHash: string,
  domain = 'iktracker.fr',
): Promise<{ postId: string; previousHash: string } | null> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from(SLUG_TABLE)
    .select('status, hash_content, iktracker_post_id')
    .eq('slug', slug)
    .eq('domain', domain)
    .maybeSingle();

  if (error || !data) return null;
  if (data.status !== 'published') return null;
  if (!data.iktracker_post_id) return null;
  if (data.hash_content === newContentHash) return null; // identical → no-op

  return {
    postId: data.iktracker_post_id as string,
    previousHash: (data.hash_content as string) ?? '',
  };
}

// ─────────────────────────────────────────────────────────────────
// Write API
// ─────────────────────────────────────────────────────────────────

/**
 * Compute a stable SHA-256 hash for a content payload (title + content body).
 * Order-independent for object keys at top level only.
 */
export async function hashContent(payload: Record<string, unknown>): Promise<string> {
  const stable = JSON.stringify({
    title: payload.title ?? '',
    content: payload.content ?? '',
    excerpt: payload.excerpt ?? '',
  });
  const buf = new TextEncoder().encode(stable);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Persist the verdict from an IKtracker API call.
 *
 * Status mapping:
 *  - 201                  → 'published' + store post_id + hash
 *  - 200 _skipped         → 'skipped'
 *  - 200 _upserted        → 'published' (treat upsert as publish)
 *  - 403 editorial        → 'duplicate'
 *  - 409 slug_blacklisted → 'blacklisted' (definitive admin reject)
 *  - 409 slug_in_trash    → 'trashed' (soft-delete corbeille IKtracker, never retry)
 *  - 409 saturated/other  → 'duplicate'
 *  - 5xx                  → 'error' (does NOT increment definitive blocking)
 */
export async function recordResult(input: RecordInput): Promise<void> {
  const supabase = getServiceClient();
  const domain = input.domain ?? 'iktracker.fr';
  const body = input.responseBody ?? {};

  const status = mapStatusFromResponse(input.httpStatus, body);
  const reason = extractReason(input.httpStatus, body);
  const postId = extractPostId(body);

  // Upsert with attempts_count increment via SQL function call
  // (we read existing first to compute attempts_count — keep it simple)
  const { data: existing } = await supabase
    .from(SLUG_TABLE)
    .select('attempts_count')
    .eq('slug', input.slug)
    .eq('domain', domain)
    .maybeSingle();

  const attempts = (existing?.attempts_count ?? 0) + 1;

  const row: Record<string, unknown> = {
    slug: input.slug,
    domain,
    tracked_site_id: input.trackedSiteId ?? null,
    status,
    reason,
    attempts_count: attempts,
    last_response: body,
  };

  // Only update hash + post_id on successful publish
  if (status === 'published') {
    if (input.contentHash) row.hash_content = input.contentHash;
    if (postId) row.iktracker_post_id = postId;
  }

  // Set explicit cooldown for skipped (7 days) so isBlocked can rely on it
  if (status === 'skipped') {
    row.blocked_until = new Date(Date.now() + SKIPPED_COOLDOWN_DAYS * 86400_000).toISOString();
  }

  const { error } = await supabase
    .from(SLUG_TABLE)
    .upsert(row, { onConflict: 'slug,domain' });

  if (error) {
    console.error('[slugMemory] recordResult upsert failed:', error.message, { slug: input.slug });
  } else {
    console.log(`[slugMemory] recorded ${input.slug} → ${status} (attempt #${attempts})`);
  }
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function mapStatusFromResponse(httpStatus: number, body: Record<string, unknown>): SlugStatus {
  if (httpStatus === 201) return 'published';
  if (httpStatus === 200) {
    if (body._skipped === true) return 'skipped';
    if (body._upserted === true) return 'published';
    return 'published';
  }
  if (httpStatus === 403 && body._editorial_guard === true) return 'duplicate';
  if (httpStatus === 409) {
    const errStr = String(body.error ?? '').toLowerCase();
    if (errStr.includes('blacklist')) return 'blacklisted';
    if (errStr === 'slug_in_trash' || errStr.includes('trash')) return 'trashed';
    return 'duplicate';
  }
  if (body.error === 'slug_blacklisted') return 'blacklisted';
  if (body.error === 'slug_in_trash') return 'trashed';
  return 'error';
}

function extractReason(httpStatus: number, body: Record<string, unknown>): string | null {
  if (typeof body.error === 'string') return body.error;
  if (typeof body._reason === 'string') return body._reason as string;
  if (httpStatus >= 400) return `HTTP ${httpStatus}`;
  return null;
}

function extractPostId(body: Record<string, unknown>): string | null {
  // IKtracker returns either { data: { id } } or { id } depending on action
  const data = body.data as Record<string, unknown> | undefined;
  if (data && typeof data.id !== 'undefined') return String(data.id);
  if (typeof body.id !== 'undefined') return String(body.id);
  return null;
}
