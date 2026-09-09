import { getServiceClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

Deno.serve(handleRequest(async (req) => {
  try {
    const supabase = getServiceClient();

    // Get client IP from various headers (Cloudflare, X-Forwarded-For, etc.)
    const clientIp = 
      req.headers.get('cf-connecting-ip') || 
      req.headers.get('x-real-ip') || 
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
      'unknown';

    const body = await req.json();
    const { event_type, session_id, url, user_id, event_data, target_url, analyzed_url } = body;

    // Enregistrement serveur des URLs analysées (jamais écrit depuis le navigateur)
    if (typeof analyzed_url === 'string' && analyzed_url.length > 0) {
      try {
        const parsed = new URL(analyzed_url);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          const { data: existing } = await supabase
            .from('analyzed_urls')
            .select('id, analysis_count')
            .eq('url', analyzed_url)
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
            await supabase.from('analyzed_urls').upsert({
              url: analyzed_url,
              domain: parsed.hostname,
              analysis_count: 1,
              last_analyzed_at: new Date().toISOString(),
            }, { onConflict: 'url' });
          }
        }
      } catch {
        // best-effort
      }
      if (!event_type) return jsonOk({ success: true });
    }

    if (!event_type) {
      return jsonError('event_type is required', 400);
    }


    // Merge IP into event_data
    const enrichedEventData = {
      ...(event_data || {}),
      ip: clientIp,
    };

    console.log(`[track-analytics] Event: ${event_type}, IP: ${clientIp}, URL: ${url}`);

    // Insert the analytics event
    const { error } = await supabase.from('analytics_events').insert({
      event_type,
      session_id: session_id || null,
      url: url || null,
      user_id: user_id || null,
      event_data: enrichedEventData,
      target_url: target_url || null,
    });

    if (error) {
      console.error('[track-analytics] Insert error:', error);
      return jsonError('Failed to track event', 500);
    }

    return jsonOk({ success: true });

  } catch (error) {
    console.error('[track-analytics] Error:', error);
    return jsonError('Internal server error', 500);
  }
}));