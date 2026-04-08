import { corsHeaders } from '../_shared/cors.ts';
import { getBrowserlessMetaUrl, getBrowserlessKey } from '../_shared/browserlessConfig.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * Browserless v2 Cloud: /metrics endpoint no longer exists.
 * We use /meta (returns active sessions) + our own paid_api_calls table for usage tracking.
 */

Deno.serve(handleRequest(async (_req) => {
  const token = getBrowserlessKey();
  if (!token) {
    return jsonError('RENDERING_API_KEY not configured', 500);
  }

  try {
    // 1. Get /meta info (active sessions, queued, etc.)
    const metaRes = await fetch(getBrowserlessMetaUrl(token), {
      signal: AbortSignal.timeout(10000),
    });

    let metaData: Record<string, unknown> = {};
    if (metaRes.ok) {
      metaData = await metaRes.json();
    } else {
      console.warn(`[browserless-metrics] /meta returned ${metaRes.status}`);
    }

    // 2. Get our own usage stats from paid_api_calls table
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Count Browserless calls this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    
    const { count: monthlyCallCount } = await supabase
      .from('paid_api_calls')
      .select('*', { count: 'exact', head: true })
      .eq('api_provider', 'browserless')
      .gte('called_at', monthStart);

    const usedUnits = monthlyCallCount ?? 0;

    return jsonOk({
      // Meta info from Browserless
      activeSessions: metaData.running ?? 0,
      queued: metaData.queued ?? 0,
      maxConcurrent: metaData.maxConcurrent ?? 10,
      // Usage from our tracking
      unitsUsedThisMonth: usedUnits,
      planUnitsPerMonth: 1000,
      unitsRemaining: Math.max(0, 1000 - usedUnits),
      concurrencyLimit: 10,
      source: 'meta+paid_api_calls',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonError(msg, 500);
  }
}));
