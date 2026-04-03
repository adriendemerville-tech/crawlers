import { corsHeaders } from '../_shared/cors.ts';
import { BROWSERLESS_BASE_URL, getBrowserlessKey } from '../_shared/browserlessConfig.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

Deno.serve(handleRequest(async (req) => {
const token = getBrowserlessKey();
  if (!token) {
    return new Response(JSON.stringify({ error: 'RENDERING_API_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const metricsRes = await fetch(`${BROWSERLESS_BASE_URL}/metrics?token=${token}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!metricsRes.ok) {
      return new Response(JSON.stringify({ error: `Browserless /metrics returned ${metricsRes.status}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const metrics = await metricsRes.json();

    // metrics is an array of time-bucketed entries
    // Aggregate totals from all entries
    const totals = {
      successful: 0,
      error: 0,
      timedout: 0,
      queued: 0,
      rejected: 0,
      unauthorized: 0,
      units: 0,
      running: 0,
      maxConcurrent: 0,
    };

    if (Array.isArray(metrics)) {
      for (const m of metrics) {
        totals.successful += m.successful || 0;
        totals.error += m.error || 0;
        totals.timedout += m.timedout || 0;
        totals.queued += m.queued || 0;
        totals.rejected += m.rejected || 0;
        totals.unauthorized += m.unauthorized || 0;
        totals.units += m.units || 0;
        // running & maxConcurrent: take latest values
        totals.running = m.running ?? totals.running;
        totals.maxConcurrent = m.maxConcurrent ?? totals.maxConcurrent;
      }
    }

    return new Response(JSON.stringify({
      ...totals,
      planUnitsPerMonth: 1000,
      unitsRemaining: Math.max(0, 1000 - totals.units),
      concurrencyLimit: 10,
      entriesCount: Array.isArray(metrics) ? metrics.length : 0,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}));