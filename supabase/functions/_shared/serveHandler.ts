/**
 * Centralized edge function handler with CORS, error handling, and JSON response helpers.
 * Replaces duplicated boilerplate across 58+ edge functions.
 * 
 * Usage:
 *   import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
 *   
 *   Deno.serve(handleRequest(async (req) => {
 *     const body = await req.json();
 *     return jsonOk({ success: true, data: body });
 *   }));
 */

import { corsHeaders } from './cors.ts';

type RequestHandler = (req: Request) => Promise<Response>;

/**
 * Wraps a handler with CORS preflight + global error catching.
 * Automatically handles OPTIONS and catches unhandled errors as 500.
 */
export function handleRequest(handler: RequestHandler): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      return await handler(req);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[serveHandler] Unhandled error:', message);

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
