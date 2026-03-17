import { getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get client IP from various headers (Cloudflare, X-Forwarded-For, etc.)
    const clientIp = 
      req.headers.get('cf-connecting-ip') || 
      req.headers.get('x-real-ip') || 
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
      'unknown';

    const body = await req.json();
    const { event_type, session_id, url, user_id, event_data, target_url } = body;

    if (!event_type) {
      return new Response(
        JSON.stringify({ error: 'event_type is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      return new Response(
        JSON.stringify({ error: 'Failed to track event' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[track-analytics] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
