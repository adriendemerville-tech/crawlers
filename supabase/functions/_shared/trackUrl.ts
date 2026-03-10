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

    // Single UPSERT — no SELECT needed
    await supabase
      .from('analyzed_urls')
      .upsert(
        {
          url,
          domain,
          analysis_count: 1,
          last_analyzed_at: new Date().toISOString(),
        },
        { onConflict: 'url', ignoreDuplicates: false }
      );

    // Increment counter separately via RPC or raw update for existing rows
    // Since upsert resets analysis_count to 1, use a raw SQL increment instead
    await supabase.rpc('increment_analysis_count' as any, { p_url: url });
  } catch (e) {
    console.error('[trackAnalyzedUrl] Error (non-blocking):', e);
  }
}
