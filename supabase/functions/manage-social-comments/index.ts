/**
 * manage-social-comments — Read, reply, hide comments on social posts
 * Supports LinkedIn and Facebook/Instagram via their APIs.
 */
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { action, platform, post_external_id, comment_id, reply_text } = await req.json();

    if (!action || !platform || !post_external_id) {
      return new Response(JSON.stringify({ error: 'action, platform, post_external_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = getServiceClient();
    const { data: account } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', auth.userId)
      .eq('platform', platform)
      .eq('status', 'active')
      .single();

    if (!account) return new Response(JSON.stringify({ error: 'No connected account for this platform' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    let result: any;

    if (platform === 'facebook' || platform === 'instagram') {
      if (action === 'list') {
        const resp = await fetch(`https://graph.facebook.com/v18.0/${post_external_id}/comments?fields=id,message,from,created_time,like_count&access_token=${account.access_token}`);
        result = await resp.json();
      } else if (action === 'reply' && comment_id && reply_text) {
        const resp = await fetch(`https://graph.facebook.com/v18.0/${comment_id}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: reply_text, access_token: account.access_token }),
        });
        result = await resp.json();
      } else if (action === 'hide' && comment_id) {
        const resp = await fetch(`https://graph.facebook.com/v18.0/${comment_id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_hidden: true, access_token: account.access_token }),
        });
        result = await resp.json();
      }
    } else if (platform === 'linkedin') {
      if (action === 'list') {
        const resp = await fetch(`https://api.linkedin.com/v2/socialActions/${post_external_id}/comments?count=50`, {
          headers: { 'Authorization': `Bearer ${account.access_token}`, 'X-Restli-Protocol-Version': '2.0.0' },
        });
        result = await resp.json();
      } else if (action === 'reply' && comment_id && reply_text) {
        const resp = await fetch(`https://api.linkedin.com/v2/socialActions/${post_external_id}/comments`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${account.access_token}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
          },
          body: JSON.stringify({
            actor: `urn:li:organization:${account.page_id}`,
            message: { text: reply_text },
            parentComment: comment_id,
          }),
        });
        result = await resp.json();
      }
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[manage-social-comments] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
