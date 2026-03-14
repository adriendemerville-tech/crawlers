/**
 * IP-based Rate Limiter — protects against burst traffic (1000+ simultaneous).
 * 
 * In-memory sliding window. Resets on cold start (acceptable for Deno Deploy).
 * This is the FIRST line of defense before any auth or DB call.
 */

interface WindowEntry {
  timestamps: number[];
}

const windows = new Map<string, WindowEntry>();

// Cleanup old entries every 5 minutes
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  const cutoff = now - 120_000; // 2 minutes ago
  for (const [key, entry] of windows) {
    entry.timestamps = entry.timestamps.filter(t => t > cutoff);
    if (entry.timestamps.length === 0) windows.delete(key);
  }
}

/**
 * Check if an IP is within rate limits.
 * 
 * @param ip - Client IP address
 * @param endpoint - Function name (for per-endpoint limits)
 * @param maxRequests - Max requests in the window (default: 30)
 * @param windowMs - Window duration in ms (default: 60s)
 * @returns { allowed, retryAfterMs }
 */
export function checkIpRate(
  ip: string,
  endpoint: string,
  maxRequests = 30,
  windowMs = 60_000,
): { allowed: boolean; retryAfterMs?: number; current: number } {
  cleanup();

  const key = `${ip}:${endpoint}`;
  const now = Date.now();
  const cutoff = now - windowMs;

  if (!windows.has(key)) {
    windows.set(key, { timestamps: [now] });
    return { allowed: true, current: 1 };
  }

  const entry = windows.get(key)!;
  entry.timestamps = entry.timestamps.filter(t => t > cutoff);
  entry.timestamps.push(now);

  if (entry.timestamps.length > maxRequests) {
    const oldest = entry.timestamps[0];
    const retryAfterMs = oldest + windowMs - now;
    return { allowed: false, retryAfterMs, current: entry.timestamps.length };
  }

  return { allowed: true, current: entry.timestamps.length };
}

/**
 * Global concurrency limiter for heavy functions.
 * Prevents more than N simultaneous executions.
 */
const activeCounts = new Map<string, number>();

export function acquireConcurrency(endpoint: string, maxConcurrent = 50): boolean {
  const current = activeCounts.get(endpoint) || 0;
  if (current >= maxConcurrent) return false;
  activeCounts.set(endpoint, current + 1);
  return true;
}

export function releaseConcurrency(endpoint: string): void {
  const current = activeCounts.get(endpoint) || 0;
  activeCounts.set(endpoint, Math.max(0, current - 1));
}

/**
 * Extract client IP from request headers (Deno Deploy / Supabase Edge).
 */
export function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || req.headers.get('cf-connecting-ip')
    || '0.0.0.0';
}

/**
 * Create a 429 Too Many Requests response.
 */
export function rateLimitResponse(corsHeaders: Record<string, string>, retryAfterMs = 60_000): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Trop de requêtes. Veuillez patienter avant de réessayer.',
      retry_after_seconds: Math.ceil(retryAfterMs / 1000),
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil(retryAfterMs / 1000)),
      },
    },
  );
}

/**
 * Create a 503 Service Unavailable response (concurrency exceeded).
 */
export function concurrencyResponse(corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Service temporairement surchargé. Réessayez dans quelques secondes.',
    }),
    {
      status: 503,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': '10',
      },
    },
  );
}
