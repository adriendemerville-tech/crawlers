import { getServiceClient } from './supabaseClient.ts';

/**
 * Logs a billing alert when a paid API (DataForSEO, etc.) returns 402/429.
 * Stores in anomaly_alerts so admins see it in the dashboard and Felix.
 */
export async function logApiBillingAlert(opts: {
  apiName: string;
  statusCode: number;
  functionName: string;
  domain?: string;
  trackedSiteId?: string;
  userId?: string;
}): Promise<void> {
  try {
    const sb = getServiceClient();
    const description = opts.statusCode === 402
      ? `⚠️ Crédit ${opts.apiName} épuisé (HTTP 402). Fonction: ${opts.functionName}. Fallback SerpAPI activé.`
      : `⚠️ Rate limit ${opts.apiName} atteint (HTTP ${opts.statusCode}). Fonction: ${opts.functionName}.`;

    // Insert anomaly alert for admin visibility
    await sb.from('anomaly_alerts').insert({
      domain: opts.domain || 'system',
      tracked_site_id: opts.trackedSiteId || '00000000-0000-0000-0000-000000000000',
      user_id: opts.userId || '00000000-0000-0000-0000-000000000000',
      metric_name: 'api_billing',
      metric_source: opts.apiName,
      severity: opts.statusCode === 402 ? 'critical' : 'warning',
      direction: 'down',
      description,
      current_value: opts.statusCode,
      baseline_mean: 200,
      baseline_stddev: 0,
      z_score: 10,
    });

    // Also log as analytics event for Felix
    await sb.from('analytics_events').insert({
      event_type: 'api_billing_alert',
      event_data: {
        api_name: opts.apiName,
        status_code: opts.statusCode,
        function_name: opts.functionName,
        domain: opts.domain,
        timestamp: new Date().toISOString(),
      },
      user_id: opts.userId || null,
    });

    console.log(`[apiBillingAlert] Logged ${opts.apiName} ${opts.statusCode} alert`);
  } catch (e) {
    console.error('[apiBillingAlert] Failed to log alert:', e);
  }
}
