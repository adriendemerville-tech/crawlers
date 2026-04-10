/**
 * Global error-catching wrapper for Edge Functions.
 * Wraps Deno.serve handler with automatic try/catch → silentErrorLogger.
 * 
 * Usage (replaces Deno.serve):
 *   import { serveWithErrorLogging } from '../_shared/serveWithErrorLogging.ts';
 *   serveWithErrorLogging('my-function', async (req) => { ... return new Response(...) });
 * 
 * Benefits:
 * - Zero boilerplate try/catch in each function
 * - All unhandled errors logged to analytics_events as 'silent_error'
 * - CORS headers always included on error responses
 * - Function name auto-tagged for CTO dashboard filtering
 */
import { logSilentError } from './silentErrorLogger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type Handler = (req: Request) => Response | Promise<Response>;

export function serveWithErrorLogging(functionName: string, handler: Handler) {
  Deno.serve(async (req: Request) => {
    // Always handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    try {
      return await handler(req);
    } catch (error: unknown) {
      // Log to analytics_events (non-blocking)
      logSilentError(functionName, 'unhandled_crash', error, {
        severity: 'critical',
        impact: 'user_facing',
        method: req.method,
        url: new URL(req.url).pathname,
      }).catch(() => {});

      // Also console.error for Deno logs
      console.error(`[${functionName}] Unhandled error:`, error);

      const message = error instanceof Error ? error.message : String(error);
      return new Response(
        JSON.stringify({ error: 'Internal server error', detail: message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  });
}
