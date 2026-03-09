import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Edge Function: sdk-status (Kill Switch)
 * 
 * Lightweight endpoint called by the injected SDK before execution.
 * Returns { isEnabled: true/false } based on system_config.
 * 
 * - If the domain is blocked or SDK is globally disabled → isEnabled: false
 * - If everything is OK → isEnabled: true
 * - Must respond in <200ms (ultra-lightweight)
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let domain = '';
    try {
      const body = await req.json();
      domain = (body.domain || '').toLowerCase().replace(/^www\./, '');
    } catch {
      // If no body, still respond with enabled
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check global SDK kill switch
    const { data: globalConfig } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'sdk_enabled')
      .maybeSingle();

    if (globalConfig && globalConfig.value === false) {
      return new Response(JSON.stringify({ isEnabled: false, reason: 'global_disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
      });
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
          return new Response(JSON.stringify({ isEnabled: false, reason: 'domain_blocked' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
          });
        }
      }
    }

    // All clear
    return new Response(JSON.stringify({ isEnabled: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
    });

  } catch (error) {
    // Fail-open: if our endpoint crashes, don't break client sites
    console.error('sdk-status error:', error);
    return new Response(JSON.stringify({ isEnabled: true, reason: 'error_failopen' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
    });
  }
});
