/**
 * fetch-social-stats — Polls engagement metrics from LinkedIn & Meta APIs
 * for published posts and stores them in social_post_metrics.
 */
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function fetchLinkedInStats(accessToken: string, postUrn: string) {
  try {
    const resp = await fetch(`https://api.linkedin.com/v2/socialActions/${postUrn}`, {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'X-Restli-Protocol-Version': '2.0.0' },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return {
      likes: data.likeSummary?.totalLikes || 0,
      comments: data.commentSummary?.totalFirstLevelComments || 0,
      shares: data.shareSummary?.totalShares || 0,
    };
  } catch { return null; }
}

async function fetchFacebookStats(accessToken: string, postId: string) {
  try {
    const resp = await fetch(`https://graph.facebook.com/v18.0/${postId}?fields=insights.metric(post_impressions,post_clicks,post_reactions_by_type_total)&access_token=${accessToken}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    const insights = data.insights?.data || [];
    const getMetric = (name: string) => insights.find((i: any) => i.name === name)?.values?.[0]?.value || 0;
    return {
      impressions: getMetric('post_impressions'),
      clicks: getMetric('post_clicks'),
      likes: typeof getMetric('post_reactions_by_type_total') === 'object' ? Object.values(getMetric('post_reactions_by_type_total') as Record<string, number>).reduce((a, b) => a + b, 0) : 0,
    };
  } catch { return null; }
}

async function fetchInstagramStats(accessToken: string, mediaId: string) {
  try {
    const resp = await fetch(`https://graph.facebook.com/v18.0/${mediaId}/insights?metric=impressions,reach,likes,comments,shares,saved&access_token=${accessToken}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    const metrics = data.data || [];
    const getVal = (name: string) => metrics.find((m: any) => m.name === name)?.values?.[0]?.value || 0;
    return {
      impressions: getVal('impressions'),
      reach: getVal('reach'),
      likes: getVal('likes'),
      comments: getVal('comments'),
      shares: getVal('shares'),
      saves: getVal('saved'),
    };
  } catch { return null; }
}

Deno.serve(handleRequest(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { post_id, fetch_all } = await req.json();
    const supabase = getServiceClient();

    // Get published posts
    let query = supabase.from('social_posts').select('id, external_ids, publish_platforms, user_id').eq('user_id', auth.userId).eq('status', 'published');
    if (post_id && !fetch_all) query = query.eq('id', post_id);
    else query = query.limit(50);

    const { data: posts } = await query;
    if (!posts?.length) return new Response(JSON.stringify({ success: true, updated: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Get accounts
    const { data: accounts } = await supabase.from('social_accounts').select('*').eq('user_id', auth.userId).eq('status', 'active');
    const accountMap = new Map((accounts || []).map(a => [a.platform, a]));

    let updated = 0;

    for (const post of posts) {
      const externalIds = (post.external_ids || {}) as Record<string, string>;

      for (const [platform, extId] of Object.entries(externalIds)) {
        const account = accountMap.get(platform);
        if (!account || !extId) continue;

        let stats: any = null;
        if (platform === 'linkedin') stats = await fetchLinkedInStats(account.access_token, extId);
        else if (platform === 'facebook') stats = await fetchFacebookStats(account.access_token, extId);
        else if (platform === 'instagram') stats = await fetchInstagramStats(account.access_token, extId);

        if (stats) {
          const engagementTotal = (stats.likes || 0) + (stats.comments || 0) + (stats.shares || 0);
          const engagementRate = stats.impressions > 0 ? (engagementTotal / stats.impressions) * 100 : 0;

          await supabase.from('social_post_metrics').insert({
            post_id: post.id,
            platform,
            impressions: stats.impressions || 0,
            clicks: stats.clicks || 0,
            likes: stats.likes || 0,
            shares: stats.shares || 0,
            comments: stats.comments || 0,
            engagement_rate: Math.round(engagementRate * 100) / 100,
            reach: stats.reach || 0,
            saves: stats.saves || 0,
            raw_data: stats,
          });
          updated++;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, updated, posts_checked: posts.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[fetch-social-stats] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}, 'fetch-social-stats'))
