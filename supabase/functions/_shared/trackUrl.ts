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

    // Try to find existing
    const { data: existing } = await supabase
      .from('analyzed_urls')
      .select('id, analysis_count')
      .eq('url', url)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('analyzed_urls')
        .update({
          analysis_count: (existing.analysis_count || 1) + 1,
          last_analyzed_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('analyzed_urls')
        .upsert({
          url,
          domain,
          analysis_count: 1,
          last_analyzed_at: new Date().toISOString(),
        }, { onConflict: 'url' });
    }
  } catch (e) {
    console.error('[trackAnalyzedUrl] Error (non-blocking):', e);
  }
}
