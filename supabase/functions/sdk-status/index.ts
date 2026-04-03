import { getServiceClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * Edge Function: sdk-status (Kill Switch)
 * 
 * Lightweight endpoint called by the injected SDK before execution.
 * Returns { isEnabled: true/false } based on system_config.
 * 
 * - If the domain is blocked or SDK is globally disabled → isEnabled: false
 * - Must respond in <200ms (ultra-lightweight)
 */
Deno.serve(handleRequest(async (req) => {
  try {
    let domain = '';
    let event = '';
    let fixesCount = 0;
    try {
      const body = await req.json();
      domain = (body.domain || '').toLowerCase().replace(/^www\./, '');
      event = body.event || '';
      fixesCount = body.fixes || 0;
    } catch {
      // If no body, still respond with enabled
    }

    // If this is a telemetry event, log it and respond quickly
    if (event) {
      console.log(`📡 Telemetry [${event}]: ${domain} (${fixesCount} fixes)`);
      // Fire-and-forget: don't block the response for analytics logging
      return jsonOk({ isEnabled: true, telemetryReceived: true });
    }

    const supabase = getServiceClient();

    // Check global SDK kill switch
    const { data: globalConfig } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'sdk_enabled')
      .maybeSingle();

    if (globalConfig && globalConfig.value === false) {
      return jsonOk({ isEnabled: false, reason: 'global_disabled' });
    }

    // Check domain-specific blocklist
    if (domain) {
      const { data: blocklist } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'sdk_blocked_domains')
        .maybeSingle();

      if (blocklist?.value) {
        const blocked = Array.isArray(blocklist.value) ? blocklist.value : [];
        if (blocked.some((d: string) => domain.includes(d.toLowerCase()))) {
          return jsonOk({ isEnabled: false, reason: 'domain_blocked' });
        }
      }
    }

    // All clear
    return jsonOk({ isEnabled: true });

  } catch (error) {
    // Fail-open: if our endpoint crashes, don't break client sites
    console.error('sdk-status error:', error);
    return jsonOk({ isEnabled: true, reason: 'error_failopen' });
  }
}));