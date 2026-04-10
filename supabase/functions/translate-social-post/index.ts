/**
 * translate-social-post — Translates social post content to EN/ES
 * using Gemini Flash Lite for cost-efficient translation.
 */
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { callOpenRouter } from '../_shared/openRouterAI.ts';
import { logAIUsageFromResponse } from '../_shared/logAIUsage.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LANG_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish (Spain)',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
};

const MODEL = 'google/gemini-2.5-flash-lite';

Deno.serve(handleRequest(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { content, target_language, platform, hashtags } = await req.json();

    if (!content || !target_language) {
      return new Response(JSON.stringify({ error: 'content and target_language required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const langName = LANG_NAMES[target_language] || target_language;

    const systemPrompt = `Tu es un traducteur expert en social media marketing. Tu traduis le contenu tout en:
- Conservant le ton et l'intention marketing
- Adaptant les expressions culturellement (pas de traduction littérale)
- Gardant les emojis et la mise en forme
- Adaptant les hashtags au marché cible
- Conservant les mentions @ telles quelles
- Conservant les liens/URLs tels quels
${platform ? `Plateforme: ${platform} — respecte les contraintes de longueur` : ''}`;

    const userPrompt = `Traduis ce contenu social media en ${langName}:

${content}

${hashtags?.length ? `\nHashtags à adapter: ${hashtags.join(' ')}` : ''}

Réponds en JSON:
{
  "translated_content": "...",
  "translated_hashtags": ["tag1", "tag2", ...]
}`;

    const result = await callOpenRouter({
      model: MODEL,
      system: systemPrompt,
      user: userPrompt,
      maxTokens: 1500,
      temperature: 0.3,
    });

    const supabase = getServiceClient();

    // Log AI usage for cost tracking
    logAIUsageFromResponse(supabase, MODEL, 'translate-social-post', result.usage);

    // Log analytics event for finance tracking
    supabase.from('analytics_events').insert({
      event_type: 'ai_token_usage',
      event_data: {
        function_name: 'translate-social-post',
        model: MODEL,
        prompt_tokens: result.usage?.prompt_tokens || 0,
        completion_tokens: result.usage?.completion_tokens || 0,
        total_tokens: result.usage?.total_tokens || 0,
      },
      user_id: auth.userId,
    }).then(() => {}).catch(() => {});

    let parsed;
    try {
      let text = result.content.trim();
      if (text.startsWith('```')) text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      parsed = JSON.parse(text);
    } catch {
      parsed = { translated_content: result.content, translated_hashtags: [] };
    }

    return new Response(JSON.stringify({ success: true, ...parsed, target_language }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[translate-social-post] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}, 'translate-social-post'))
