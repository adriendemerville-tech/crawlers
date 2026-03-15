/**
 * Safe Body Parser — prevents DoS via oversized JSON payloads.
 * Drop-in replacement for `await req.json()`.
 * 
 * Default max size: 512 KB (generous for any legitimate API call).
 */

const DEFAULT_MAX_BYTES = 512 * 1024; // 512 KB

export class PayloadTooLargeError extends Error {
  constructor(size: number, max: number) {
    super(`Payload too large: ${size} bytes (max: ${max})`);
    this.name = 'PayloadTooLargeError';
  }
}

/**
 * Parse JSON body with size limit.
 * Throws PayloadTooLargeError if body exceeds maxBytes.
 */
export async function safeJsonParse<T = any>(
  req: Request,
  maxBytes = DEFAULT_MAX_BYTES,
): Promise<T> {
  // Check Content-Length header first (fast path)
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    throw new PayloadTooLargeError(parseInt(contentLength, 10), maxBytes);
  }

  // Read body with size guard
  const reader = req.body?.getReader();
  if (!reader) {
    throw new Error('No request body');
  }

  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalSize += value.length;
      if (totalSize > maxBytes) {
        reader.cancel();
        throw new PayloadTooLargeError(totalSize, maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  // Concatenate and parse
  const combined = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  const text = new TextDecoder().decode(combined);
  return JSON.parse(text) as T;
}

/**
 * Helper: return a 413 response for oversized payloads.
 */
export function payloadTooLargeResponse(corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Payload too large. Maximum request size is 512 KB.',
    }),
    {
      status: 413,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
}
