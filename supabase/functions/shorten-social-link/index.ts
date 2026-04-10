/**
 * shorten-social-link — Creates short links with auto UTM params for social posts.
 * Reuses the existing short_links table.
 */
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateCode(length = 6): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let code = '';
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (const byte of arr) code += chars[byte % chars.length];
  return code;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { url, platform, campaign, post_id } = await req.json();

    if (!url) return new Response(JSON.stringify({ error: 'url required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Build UTM parameters
    const utmParams = new URLSearchParams({
      utm_source: platform || 'social',
      utm_medium: 'social',
      utm_campaign: campaign || 'social_content_hub',
      ...(post_id ? { utm_content: post_id } : {}),
    });

    const separator = url.includes('?') ? '&' : '?';
    const fullUrl = `${url}${separator}${utmParams.toString()}`;

    const code = generateCode();
    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from('short_links')
      .insert({
        code,
        target_url: fullUrl,
        created_by: auth.userId,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
      })
      .select('code')
      .single();

    if (error) {
      console.error('[shorten-social-link] DB error:', error);
      return new Response(JSON.stringify({ error: 'Failed to create short link' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const shortUrl = `https://crawlers.lovable.app/s/${data.code}`;

    return new Response(JSON.stringify({ success: true, short_url: shortUrl, code: data.code, full_url: fullUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[shorten-social-link] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
