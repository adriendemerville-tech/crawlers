/**
 * Centralized edge function handler with CORS, error handling, and JSON response helpers.
 * Replaces duplicated boilerplate across 200+ edge functions.
 * 
 * Usage:
 *   import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
 *   
 *   // Auto-logs unhandled errors to analytics_events with function name:
 *   Deno.serve(handleRequest(async (req) => {
 *     const body = await req.json();
 *     return jsonOk({ success: true, data: body });
 *   }, 'my-function-name'));
 *   
 *   // Works without name too (logs as 'unknown'):
 *   Deno.serve(handleRequest(async (req) => { ... }));
 */

import { corsHeaders } from './cors.ts';
import { logSilentError } from './silentErrorLogger.ts';

type RequestHandler = (req: Request) => Promise<Response>;

/**
 * Wraps a handler with CORS preflight + global error catching + silent error logging.
 * All unhandled errors are automatically logged to analytics_events as 'silent_error'
 * with severity 'critical', making them visible in the CTO dashboard.
 * 
 * @param handler - The request handler function
 * @param functionName - Optional function name for error attribution (auto-detected from URL if omitted)
 */
export function handleRequest(handler: RequestHandler, functionName?: string): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Auto-detect function name from URL path if not provided
    const fnName = functionName || extractFunctionName(req.url);

    try {
      return await handler(req);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      console.error(`[${fnName}] Unhandled error:`, message);

      // Log to analytics_events for CTO visibility (non-blocking)
      logSilentError(fnName, 'unhandled_crash', error, {
        severity: 'critical',
        impact: 'user_facing',
        method: req.method,
        url: new URL(req.url).pathname,
        stack: stack?.substring(0, 2000),
      }).catch(() => {});

      // Propagate known status codes
      const status = (error as { status?: number })?.status;
      if (status && status >= 400 && status < 600) {
        return jsonError(message, status);
      }

      return jsonError('Internal server error', 500);
    }
  };
}

/**
 * Extract function name from the edge function URL.
 * e.g. https://xxx.supabase.co/functions/v1/my-function → 'my-function'
 */
function extractFunctionName(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split('/').filter(Boolean);
    // Typical path: /functions/v1/<function-name>
    const v1Index = segments.indexOf('v1');
    if (v1Index >= 0 && segments[v1Index + 1]) {
      return segments[v1Index + 1];
    }
    return segments[segments.length - 1] || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Return a JSON success response with CORS headers.
 */
export function jsonOk(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Return a JSON error response with CORS headers.
 */
export function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
