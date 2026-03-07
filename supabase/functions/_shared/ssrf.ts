/**
 * SSRF Protection — blocks private IPs and non-HTTP protocols.
 * Import and call `assertSafeUrl(url)` before any `fetch(userUrl)`.
 */

const BLOCKED_HOSTS_RE = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|\[::1\]|\[fd[0-9a-f]{2}:)/i;

const ALLOWED_PROTOCOLS = ['http:', 'https:'];

export function assertSafeUrl(input: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error(`Invalid URL: ${input}`);
  }

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    throw new Error(`Blocked protocol: ${parsed.protocol}`);
  }

  if (BLOCKED_HOSTS_RE.test(parsed.hostname)) {
    throw new Error(`Blocked host (private/internal IP): ${parsed.hostname}`);
  }

  return parsed;
}
