/**
 * publish-to-social — Publishes content to LinkedIn, Facebook, Instagram
 * via their respective APIs using stored OAuth tokens.
 */
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function publishToLinkedIn(account: any, content: string, imageUrl?: string): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    const body: any = {
      author: `urn:li:organization:${account.page_id}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: content },
          shareMediaCategory: imageUrl ? 'IMAGE' : 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    };

    const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${account.access_token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: `LinkedIn ${response.status}: ${err.slice(0, 200)}` };
    }

    const postId = response.headers.get('x-restli-id') || '';
    return { success: true, postId };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function publishToFacebook(account: any, content: string, imageUrl?: string): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    const url = imageUrl
      ? `https://graph.facebook.com/v18.0/${account.page_id}/photos`
      : `https://graph.facebook.com/v18.0/${account.page_id}/feed`;

    const params: any = { message: content, access_token: account.access_token };
    if (imageUrl) params.url = imageUrl;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await response.json();
    if (data.error) return { success: false, error: data.error.message };
    return { success: true, postId: data.id || data.post_id };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function publishToInstagram(account: any, content: string, imageUrl: string): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    if (!imageUrl) return { success: false, error: 'Instagram requires an image' };

    // Step 1: Create media container
    const containerResp = await fetch(`https://graph.facebook.com/v18.0/${account.page_id}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, caption: content, access_token: account.access_token }),
    });
    const container = await containerResp.json();
    if (container.error) return { success: false, error: container.error.message };

    // Step 2: Publish
    const publishResp = await fetch(`https://graph.facebook.com/v18.0/${account.page_id}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: container.id, access_token: account.access_token }),
    });
    const published = await publishResp.json();
    if (published.error) return { success: false, error: published.error.message };

    return { success: true, postId: published.id };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { post_id } = await req.json();
    if (!post_id) return new Response(JSON.stringify({ error: 'post_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = getServiceClient();

    // Get post
    const { data: post, error: postErr } = await supabase
      .from('social_posts')
      .select('*')
      .eq('id', post_id)
      .eq('user_id', auth.userId)
      .single();

    if (postErr || !post) return new Response(JSON.stringify({ error: 'Post not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Update status to publishing
    await supabase.from('social_posts').update({ status: 'publishing' }).eq('id', post_id);

    // Get connected accounts
    const { data: accounts } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', auth.userId)
      .eq('status', 'active')
      .in('platform', post.publish_platforms || []);

    const results: Record<string, any> = {};
    const externalIds: Record<string, string> = {};
    const imageUrl = post.image_urls?.[0];
    let allSuccess = true;

    for (const account of (accounts || [])) {
      const content = account.platform === 'linkedin' ? post.content_linkedin
        : account.platform === 'facebook' ? post.content_facebook
        : post.content_instagram;

      if (!content) continue;

      let result;
      if (account.platform === 'linkedin') result = await publishToLinkedIn(account, content, imageUrl);
      else if (account.platform === 'facebook') result = await publishToFacebook(account, content, imageUrl);
      else if (account.platform === 'instagram') result = await publishToInstagram(account, content, imageUrl!);
      else continue;

      results[account.platform] = result;
      if (result?.success && result.postId) externalIds[account.platform] = result.postId;
      if (!result?.success) allSuccess = false;
    }

    // Update post
    await supabase.from('social_posts').update({
      status: allSuccess ? 'published' : 'failed',
      published_at: allSuccess ? new Date().toISOString() : null,
      external_ids: externalIds,
      error_message: allSuccess ? null : JSON.stringify(Object.fromEntries(Object.entries(results).filter(([, v]) => !v.success).map(([k, v]) => [k, v.error]))),
    }).eq('id', post_id);

    // Increment quota
    if (allSuccess) {
      await supabase.rpc('atomic_credit_update' as any, { p_user_id: auth.userId, p_amount: 0 }); // no-op, just to verify
      await supabase
        .from('profiles')
        .update({ social_posts_this_month: (post as any).social_posts_this_month + 1 } as any)
        .eq('user_id', auth.userId);
    }

    return new Response(JSON.stringify({ success: allSuccess, results, external_ids: externalIds }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[publish-to-social] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
