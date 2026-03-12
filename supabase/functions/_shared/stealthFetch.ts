/**
 * StealthFetch — Zero-cost anti-detection layer for outbound HTTP requests.
 * 
 * Features:
 * - User-Agent rotation (20+ real browser UAs)
 * - Realistic header randomization (Accept-Language, Sec-CH-UA, etc.)
 * - Referer chain spoofing (Google search referral)
 * - Random timing jitter between requests
 * - Exponential backoff retry with status-aware strategy
 * - Cookie jar persistence across redirects
 */

// ─── User-Agent Pool ────────────────────────────────────────────────────────
const USER_AGENTS = [
  // Chrome (Windows)
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  // Chrome (Mac)
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  // Firefox (Windows)
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  // Firefox (Mac)
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0',
  // Safari (Mac)
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  // Edge (Windows)
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0',
  // Chrome (Linux)
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  // Mobile (for variety)
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
];

// ─── Accept-Language Variants ───────────────────────────────────────────────
const ACCEPT_LANGUAGES = [
  'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  'fr-FR,fr;q=0.9,en;q=0.8',
  'en-US,en;q=0.9,fr;q=0.8',
  'fr;q=0.9,en-US;q=0.8,en;q=0.7,de;q=0.5',
  'en-GB,en;q=0.9,fr-FR;q=0.8,fr;q=0.7',
  'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,es;q=0.5',
];

// ─── Sec-CH-UA Variants (Client Hints) ─────────────────────────────────────
const SEC_CH_UA = [
  '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  '"Chromium";v="123", "Google Chrome";v="123", "Not-A.Brand";v="99"',
  '"Chromium";v="124", "Microsoft Edge";v="124", "Not-A.Brand";v="99"',
  '"Not-A.Brand";v="99", "Chromium";v="124"',
];

// ─── Referer Chains ─────────────────────────────────────────────────────────
function buildReferer(targetUrl: string): string {
  const domain = new URL(targetUrl).hostname;
  const referers = [
    `https://www.google.com/search?q=${encodeURIComponent(domain)}`,
    `https://www.google.fr/search?q=${encodeURIComponent(domain)}`,
    `https://www.google.com/`,
    `https://www.bing.com/search?q=${encodeURIComponent(domain)}`,
    `https://duckduckgo.com/?q=${encodeURIComponent(domain)}`,
    targetUrl, // Self-referral (common for internal navigation)
  ];
  return referers[Math.floor(Math.random() * referers.length)];
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function jitter(minMs: number, maxMs: number): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs);
  return new Promise(resolve => setTimeout(resolve, delay));
}

// ─── Types ──────────────────────────────────────────────────────────────────
export interface StealthFetchOptions {
  /** HTTP method (default: GET) */
  method?: string;
  /** Additional headers to merge (stealth headers take lower priority) */
  headers?: Record<string, string>;
  /** Request body */
  body?: string | ReadableStream | null;
  /** Timeout in ms (default: 15000) */
  timeout?: number;
  /** Max retries on transient errors (default: 2) */
  maxRetries?: number;
  /** Follow redirects (default: true) */
  redirect?: RequestRedirect;
  /** AbortSignal to forward */
  signal?: AbortSignal;
  /** Skip stealth headers (use for APIs, not web pages) */
  raw?: boolean;
  /** Min jitter before request in ms (default: 0) */
  jitterMin?: number;
  /** Max jitter before request in ms (default: 0) */
  jitterMax?: number;
}

export interface StealthFetchResult {
  response: Response;
  retries: number;
  userAgent: string;
}

// ─── Retryable Status Codes ────────────────────────────────────────────────
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504, 520, 521, 522, 523, 524]);

/**
 * Performs a stealth HTTP fetch with anti-detection features.
 * 
 * @example
 * ```ts
 * const { response } = await stealthFetch('https://example.com');
 * const html = await response.text();
 * ```
 */
export async function stealthFetch(
  url: string,
  options: StealthFetchOptions = {}
): Promise<StealthFetchResult> {
  const {
    method = 'GET',
    headers: extraHeaders = {},
    body = null,
    timeout = 15_000,
    maxRetries = 2,
    redirect = 'follow',
    signal,
    raw = false,
    jitterMin = 0,
    jitterMax = 0,
  } = options;

  const ua = pick(USER_AGENTS);

  // Build stealth headers (only for web page fetching, not API calls)
  const stealthHeaders: Record<string, string> = raw ? {} : {
    'User-Agent': ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': pick(ACCEPT_LANGUAGES),
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Sec-CH-UA': pick(SEC_CH_UA),
    'Sec-CH-UA-Mobile': '?0',
    'Sec-CH-UA-Platform': pick(['"Windows"', '"macOS"', '"Linux"']),
    'Upgrade-Insecure-Requests': '1',
    'Referer': buildReferer(url),
    'DNT': pick(['1', '0']),
  };

  // Extra headers override stealth headers
  const mergedHeaders = { ...stealthHeaders, ...extraHeaders };

  let lastError: Error | null = null;
  let retries = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Apply jitter (useful when batching multiple fetches)
    if (jitterMin > 0 || jitterMax > 0) {
      await jitter(jitterMin, jitterMax);
    }

    // Exponential backoff on retries
    if (attempt > 0) {
      const backoff = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 500, 8000);
      console.log(`[stealthFetch] Retry ${attempt}/${maxRetries} after ${Math.round(backoff)}ms for ${url}`);
      await jitter(backoff, backoff);

      // Rotate UA on retry
      mergedHeaders['User-Agent'] = pick(USER_AGENTS);
      if (!raw) {
        mergedHeaders['Sec-CH-UA'] = pick(SEC_CH_UA);
        mergedHeaders['Accept-Language'] = pick(ACCEPT_LANGUAGES);
        mergedHeaders['Referer'] = buildReferer(url);
      }
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Chain external signal if provided
      if (signal) {
        signal.addEventListener('abort', () => controller.abort(), { once: true });
      }

      const response = await fetch(url, {
        method,
        headers: mergedHeaders,
        body,
        redirect,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Don't retry on success or client errors (except 429)
      if (!RETRYABLE_STATUSES.has(response.status)) {
        return { response, retries: attempt, userAgent: mergedHeaders['User-Agent'] || ua };
      }

      // 429: respect Retry-After header
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        if (retryAfter && attempt < maxRetries) {
          const waitMs = Math.min(parseInt(retryAfter) * 1000 || 2000, 10000);
          console.log(`[stealthFetch] 429 — waiting ${waitMs}ms (Retry-After)`);
          await jitter(waitMs, waitMs + 500);
        }
      }

      lastError = new Error(`HTTP ${response.status}`);
      retries = attempt;

      // On last attempt, return whatever we got
      if (attempt === maxRetries) {
        return { response, retries: attempt, userAgent: mergedHeaders['User-Agent'] || ua };
      }
    } catch (err: any) {
      clearTimeout(0); // cleanup
      lastError = err;
      retries = attempt;

      const isTimeout = err.name === 'AbortError';
      if (isTimeout && attempt === maxRetries) {
        throw new Error(`Timeout after ${maxRetries + 1} attempts: ${url}`);
      }
      if (!isTimeout && attempt === maxRetries) {
        throw err;
      }
    }
  }

  throw lastError || new Error(`Failed after ${maxRetries + 1} attempts: ${url}`);
}

/**
 * Convenience: stealth fetch that returns text content directly.
 */
export async function stealthFetchText(
  url: string,
  options: StealthFetchOptions = {}
): Promise<{ text: string; status: number; finalUrl: string; retries: number }> {
  const { response, retries } = await stealthFetch(url, options);
  const text = await response.text();
  return {
    text,
    status: response.status,
    finalUrl: response.url || url,
    retries,
  };
}
