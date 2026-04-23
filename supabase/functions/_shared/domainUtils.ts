/**
 * domainUtils.ts — Centralized domain detection & URL normalization.
 * Replaces duplicated logic across autopilot-engine, cmsContentScanner,
 * cocoon-deploy-links, iktracker-actions, etc.
 */

/** IKtracker blog API base URL (single source of truth) */
export const IKTRACKER_BASE_URL = 'https://yarjaudctshlxkatqgeb.supabase.co/functions/v1/blog-api';

/** Dictadevi API base URL (single source of truth) */
export const DICTADEVI_BASE_URL = 'https://dictadevi.io/api';

/** Get IKtracker API key from environment */
export function getIktrackerApiKey(): string | undefined {
  return Deno.env.get('IKTRACKER_API_KEY');
}

/**
 * Get Dictadevi API key — first tries env (DICTADEVI_API_KEY), then falls back
 * to the per-target value stored in parmenion_targets.api_key_name.
 * Async because the fallback requires a DB lookup via the service role client.
 */
export async function getDictadeviApiKey(supabase?: {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>
}): Promise<string | undefined> {
  const envKey = Deno.env.get('DICTADEVI_API_KEY');
  if (envKey) return envKey;
  if (!supabase) return undefined;
  try {
    const { data, error } = await supabase.rpc('get_parmenion_target_api_key', { p_domain: 'dictadevi.io' });
    if (error || !data) return undefined;
    return typeof data === 'string' ? data : undefined;
  } catch (_) {
    return undefined;
  }
}

/** Check if domain belongs to IKtracker */
export function isIktrackerDomain(domain: string): boolean {
  return domain.toLowerCase().includes('iktracker');
}

/** Check if domain belongs to Dictadevi */
export function isDictadeviDomain(domain: string): boolean {
  return domain.toLowerCase().includes('dictadevi');
}

/** Check if domain belongs to Crawlers */
export function isCrawlersDomain(domain: string): boolean {
  return domain.toLowerCase().includes('crawlers');
}

/** Classify domain platform */
export function detectPlatform(domain: string): 'iktracker' | 'dictadevi' | 'crawlers' | 'external' {
  const d = domain.toLowerCase().replace(/^www\./, '');
  if (d.includes('iktracker')) return 'iktracker';
  if (d.includes('dictadevi')) return 'dictadevi';
  if (d.includes('crawlers')) return 'crawlers';
  return 'external';
}

/**
 * Normalize a target URL or slug into a clean page key.
 * Used by autopilot-engine, parmenion, and CMS action routing.
 *
 * Examples:
 *   "https://iktracker.fr/blog/my-post" → "my-post"
 *   "my-post" → "my-post"
 *   "/" or "" → "homepage"
 */
export function normalizePageKey(targetUrl?: string | null): string | null {
  if (!targetUrl) return null;

  const trimmed = targetUrl.trim();
  // Already a clean slug (no slashes, no protocol) → return as-is
  if (/^[a-z0-9][a-z0-9-]*$/i.test(trimmed)) return trimmed.toLowerCase();

  try {
    const parsed = new URL(trimmed);
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return 'homepage';
    return segments[segments.length - 1].toLowerCase();
  } catch {
    // Not a valid URL — strip protocol/domain if present
    const normalized = trimmed.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+|\/+$/g, '');
    if (!normalized) return 'homepage';
    const segments = normalized.split('/').filter(Boolean);
    return (segments[segments.length - 1] || 'homepage').toLowerCase();
  }
}

/**
 * Build an IKtracker fetch helper with built-in auth headers.
 * Returns null if API key is not configured.
 */
export function createIktrackerFetcher() {
  const apiKey = getIktrackerApiKey();
  if (!apiKey) return null;

  return async function iktrackerFetch(
    path: string,
    method: string = 'GET',
    body?: Record<string, unknown>,
    timeoutMs: number = 15000,
  ): Promise<{ status: number; data: unknown }> {
    const url = `${IKTRACKER_BASE_URL}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    };
    const init: RequestInit = { method, headers, signal: AbortSignal.timeout(timeoutMs) };
    if (body && method !== 'GET') init.body = JSON.stringify(body);

    const resp = await fetch(url, init);
    const data = await resp.json().catch(() => null);
    return { status: resp.status, data };
  };
}
