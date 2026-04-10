/**
 * suggest-social-embed — For a given page, finds the best social post to embed (oEmbed).
 * Used by Content Architect to suggest embedding high-performing social posts.
 */
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateEmbedCode(platform: string, externalId: string): string | null {
  if (platform === 'linkedin') {
    return `<iframe src="https://www.linkedin.com/embed/feed/update/${externalId}" height="400" width="504" frameborder="0" allowfullscreen="" title="Post LinkedIn"></iframe>`;
  }
  if (platform === 'facebook') {
    return `<iframe src="https://www.facebook.com/plugins/post.php?href=https://www.facebook.com/${externalId}&show_text=true&width=500" width="500" height="400" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"></iframe>`;
  }
  if (platform === 'instagram') {
    return `<iframe src="https://www.instagram.com/p/${externalId}/embed" width="400" height="480" frameborder="0" scrolling="no" allowtransparency="true"></iframe>`;
  }
  return null;
}

Deno.serve(handleRequest(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { page_url, keyword, tracked_site_id } = await req.json();

    if (!page_url && !keyword) {
      return new Response(JSON.stringify({ error: 'page_url or keyword required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = getServiceClient();

    // Get published posts with metrics
    let query = supabase
      .from('social_posts')
      .select('id, title, content_linkedin, content_facebook, content_instagram, external_ids, publish_platforms, source_keyword, published_at')
      .eq('user_id', auth.userId)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(50);

    if (tracked_site_id) query = query.eq('tracked_site_id', tracked_site_id);

    const { data: posts } = await query;
    if (!posts?.length) return new Response(JSON.stringify({ success: true, suggestions: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Get metrics for these posts
    const postIds = posts.map(p => p.id);
    const { data: allMetrics } = await supabase
      .from('social_post_metrics')
      .select('post_id, platform, impressions, likes, comments, shares, engagement_rate')
      .in('post_id', postIds)
      .order('measured_at', { ascending: false });

    // Best metric per post
    const metricsMap = new Map<string, { totalEngagement: number; bestPlatform: string; impressions: number }>();
    for (const m of (allMetrics || [])) {
      const existing = metricsMap.get(m.post_id);
      const engagement = (m.likes || 0) + (m.comments || 0) + (m.shares || 0);
      if (!existing || engagement > existing.totalEngagement) {
        metricsMap.set(m.post_id, { totalEngagement: engagement, bestPlatform: m.platform, impressions: m.impressions || 0 });
      }
    }

    // Score posts by relevance to the page
    const searchTerms = [keyword, page_url].filter(Boolean).map(t => t!.toLowerCase());

    const scored = posts.map(post => {
      let relevanceScore = 0;
      const texts = [post.title, post.content_linkedin, post.content_facebook, post.content_instagram, post.source_keyword].filter(Boolean).join(' ').toLowerCase();

      for (const term of searchTerms) {
        if (texts.includes(term)) relevanceScore += 30;
      }

      const metrics = metricsMap.get(post.id);
      const engagementScore = metrics ? Math.min(50, metrics.totalEngagement / 2) : 0;
      const impressionScore = metrics ? Math.min(20, metrics.impressions / 100) : 0;

      return {
        post_id: post.id,
        title: post.title,
        published_at: post.published_at,
        external_ids: post.external_ids,
        total_score: relevanceScore + engagementScore + impressionScore,
        metrics: metrics || null,
      };
    }).filter(p => p.total_score > 0).sort((a, b) => b.total_score - a.total_score).slice(0, 3);

    // Generate embed codes
    const suggestions = scored.map(s => {
      const externalIds = (s.external_ids || {}) as Record<string, string>;
      const embeds: Record<string, string> = {};
      for (const [platform, extId] of Object.entries(externalIds)) {
        const code = generateEmbedCode(platform, extId);
        if (code) embeds[platform] = code;
      }
      return { ...s, embeds };
    });

    return new Response(JSON.stringify({ success: true, suggestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[suggest-social-embed] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}, 'suggest-social-embed'))
