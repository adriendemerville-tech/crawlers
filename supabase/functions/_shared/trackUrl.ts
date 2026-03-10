import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Upserts the analyzed URL server-side using service_role.
 * Fire-and-forget — errors are swallowed so they never block the main response.
 */
export async function trackAnalyzedUrl(url: string): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) return;

    const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Single atomic upsert — replaces the old SELECT + UPDATE/INSERT pattern
    const { error } = await supabase.rpc('upsert_analyzed_url', {
      p_url: url,
      p_domain: domain,
    });

    if (error) {
      console.error('[trackAnalyzedUrl] RPC error (non-blocking):', error.message);
    }
  } catch (e) {
    console.error('[trackAnalyzedUrl] Error (non-blocking):', e);
  }
}
