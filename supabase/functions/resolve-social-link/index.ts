/**
 * resolve-social-link — Smart link resolution for social posts.
 * Scores candidate pages from the site to find the best one to link in a post.
 * Uses keyword_universe, cocoon_sessions, architect_workbench, and optionally Firecrawl.
 */
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CandidatePage {
  url: string;
  score: number;
  source: string;
  keyword?: string;
  reason: string;
}

Deno.serve(handleRequest(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { topic, keyword, tracked_site_id, domain, max_results } = await req.json();

    if (!domain && !tracked_site_id) {
      return new Response(JSON.stringify({ error: 'domain or tracked_site_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = getServiceClient();
    const candidates: CandidatePage[] = [];

    // Resolve domain
    let siteDomain = domain;
    if (!siteDomain && tracked_site_id) {
      const { data: site } = await supabase.from('tracked_sites').select('domain').eq('id', tracked_site_id).single();
      siteDomain = site?.domain;
    }

    const searchTerms = [keyword, topic].filter(Boolean).map(t => t!.toLowerCase());

    // 1. keyword_universe — pages ranking on the topic (40% weight)
    if (searchTerms.length) {
      const { data: kwData } = await supabase
        .from('keyword_universe')
        .select('keyword, target_url, current_position, search_volume, opportunity_score')
        .eq('domain', siteDomain)
        .eq('user_id', auth.userId)
        .not('target_url', 'is', null)
        .order('opportunity_score', { ascending: false })
        .limit(50);

      if (kwData) {
        for (const kw of kwData) {
          const matchScore = searchTerms.some(t => kw.keyword.includes(t) || t.includes(kw.keyword)) ? 40 : 0;
          if (matchScore > 0 && kw.target_url) {
            candidates.push({
              url: kw.target_url,
              score: matchScore + Math.min(20, (kw.opportunity_score || 0) / 5),
              source: 'keyword_universe',
              keyword: kw.keyword,
              reason: `Ranke sur "${kw.keyword}" (position #${kw.current_position || '?'}, volume ${kw.search_volume})`,
            });
          }
        }
      }
    }

    // 2. cocoon_sessions — pillar pages from clusters (25% weight)
    const { data: cocoons } = await supabase
      .from('cocoon_sessions')
      .select('nodes_snapshot, domain')
      .eq('domain', siteDomain)
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (cocoons) {
      for (const cocoon of cocoons) {
        const nodes = (cocoon.nodes_snapshot || []) as any[];
        for (const node of nodes) {
          if (node.url && node.type === 'pillar') {
            const matchScore = searchTerms.some(t =>
              (node.title || '').toLowerCase().includes(t) ||
              (node.keyword || '').toLowerCase().includes(t)
            ) ? 25 : 0;

            if (matchScore > 0) {
              candidates.push({
                url: node.url,
                score: matchScore,
                source: 'cocoon_pillar',
                keyword: node.keyword,
                reason: `Page pilier du cocon "${node.title || node.keyword}"`,
              });
            }
          }
        }
      }
    }

    // 3. architect_workbench — pages with low EEAT to boost (15% weight)
    if (searchTerms.length) {
      const { data: workbenchItems } = await supabase
        .from('architect_workbench')
        .select('target_url, title, finding_category, severity')
        .eq('domain', siteDomain)
        .eq('user_id', auth.userId)
        .in('finding_category', ['eeat', 'content_gap', 'geo_visibility'])
        .in('status', ['pending', 'assigned'])
        .limit(20);

      if (workbenchItems) {
        for (const item of workbenchItems) {
          const matchScore = searchTerms.some(t => (item.title || '').toLowerCase().includes(t)) ? 15 : 5;
          if (item.target_url) {
            candidates.push({
              url: item.target_url,
              score: matchScore + (item.severity === 'high' ? 5 : 0),
              source: 'workbench_eeat',
              reason: `Page à booster: ${item.title} (${item.finding_category})`,
            });
          }
        }
      }
    }

    // Deduplicate and sort by score
    const urlMap = new Map<string, CandidatePage>();
    for (const c of candidates) {
      const existing = urlMap.get(c.url);
      if (!existing || c.score > existing.score) {
        urlMap.set(c.url, c);
      }
    }

    const sorted = Array.from(urlMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, max_results || 5);

    return new Response(JSON.stringify({
      success: true,
      candidates: sorted,
      best: sorted[0] || null,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[resolve-social-link] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}, 'resolve-social-link'))
