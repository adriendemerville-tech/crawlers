/**
 * generate-social-content — Generates multi-platform social content
 * from workbench items, keywords, and seasonal context.
 * Uses Gemini Flash for cost-efficient generation.
 */
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { callOpenRouter } from '../_shared/openRouterAI.ts';
import { logAIUsageFromResponse } from '../_shared/logAIUsage.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { runEditorialPipeline } from '../_shared/editorialPipeline.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODEL = 'google/gemini-2.5-flash';

Deno.serve(handleRequest(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    if (auth.planType === 'free') {
      return new Response(JSON.stringify({ error: 'Pro Agency required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { topic, keyword, workbench_item_id, tracked_site_id, platforms, tone, language, custom_instructions } = await req.json();

    if (!topic && !keyword && !workbench_item_id) {
      return new Response(JSON.stringify({ error: 'topic, keyword, or workbench_item_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = getServiceClient();

    // Gather context
    let context = '';
    let finalTopic = topic || keyword || '';

    if (workbench_item_id) {
      const { data: item } = await supabase
        .from('architect_workbench')
        .select('title, description, finding_category, target_url, payload')
        .eq('id', workbench_item_id)
        .single();
      if (item) {
        finalTopic = item.title;
        context += `\nWorkbench: ${item.title} — ${item.description || ''}\nURL cible: ${item.target_url || ''}\nKeyword: ${item.payload?.keyword || ''}\n`;
      }
    }

    // Get seasonal context if available
    if (tracked_site_id) {
      const { data: site } = await supabase
        .from('tracked_sites')
        .select('domain, market_sector')
        .eq('id', tracked_site_id)
        .single();

      if (site?.market_sector) {
        const { data: seasonal } = await supabase
          .from('seasonal_context')
          .select('event_name, description, peak_keywords')
          .contains('sectors', [site.market_sector])
          .limit(3);

        if (seasonal?.length) {
          context += `\nContexte saisonnier:\n${seasonal.map(s => `- ${s.event_name}: ${s.description}`).join('\n')}\n`;
        }
      }

      context += `\nDomaine: ${site?.domain || ''}\n`;
    }

    const targetPlatforms = platforms || ['linkedin', 'facebook', 'instagram'];
    const toneStr = tone || 'professionnel et engageant';
    const lang = language || 'fr';

    const systemPrompt = `Tu es un expert en social media marketing SEO. Tu génères du contenu optimisé pour les réseaux sociaux, adapté à chaque plateforme.
Règles:
- LinkedIn: professionnel, storytelling, 1300 chars max, emojis modérés, CTA clair
- Facebook: conversationnel, 500 chars idéal, question d'engagement
- Instagram: visuel-first, 2200 chars max, 20-30 hashtags pertinents, emojis expressifs
- Ton: ${toneStr}
- Langue: ${lang}
- Toujours inclure un appel à l'action
- Suggérer des hashtags pertinents
${custom_instructions ? `\nInstructions spécifiques: ${custom_instructions}` : ''}`;

    const userPrompt = `Génère du contenu social media sur le sujet suivant:
Sujet: ${finalTopic}
${context}
Plateformes: ${targetPlatforms.join(', ')}

Réponds en JSON strict:
{
  "content_linkedin": "...",
  "content_facebook": "...",
  "content_instagram": "...",
  "hashtags": ["tag1", "tag2", ...],
  "suggested_title": "...",
  "suggested_cta": "...",
  "suggested_emoji": "🚀"
}`;

    const result = await callOpenRouter({
      model: MODEL,
      system: systemPrompt,
      user: userPrompt,
      maxTokens: 2000,
      temperature: 0.7,
    });

    // Log AI usage for cost tracking
    logAIUsageFromResponse(supabase, MODEL, 'generate-social-content', result.usage);

    // Parse JSON response
    let parsed;
    try {
      let text = result.content.trim();
      if (text.startsWith('```')) text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      parsed = JSON.parse(text);
    } catch {
      parsed = { content_linkedin: result.content, content_facebook: result.content, content_instagram: result.content, hashtags: [], suggested_title: finalTopic };
    }

    // Check & increment quota
    const { data: profile } = await supabase
      .from('profiles')
      .select('social_posts_this_month, plan_type')
      .eq('user_id', auth.userId)
      .single();

    const limit = auth.planType === 'agency_premium' ? 100 : 30;
    const used = profile?.social_posts_this_month || 0;

    if (used >= limit && !auth.isAdmin) {
      return new Response(JSON.stringify({ error: 'Quota mensuel de posts atteint', used, limit }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Log analytics event for finance tracking
    supabase.from('analytics_events').insert({
      event_type: 'ai_token_usage',
      event_data: {
        function_name: 'generate-social-content',
        model: MODEL,
        prompt_tokens: result.usage?.prompt_tokens || 0,
        completion_tokens: result.usage?.completion_tokens || 0,
        total_tokens: result.usage?.total_tokens || 0,
      },
      user_id: auth.userId,
      url: finalTopic,
    }).then(() => {}).catch(() => {});

    return new Response(JSON.stringify({ success: true, ...parsed, quota: { used, limit } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[generate-social-content] Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}, 'generate-social-content'))
