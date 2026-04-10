/**
 * translate-social-post — Translates social post content to EN/ES
 * using Gemini Flash for cost-efficient translation.
 */
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { callOpenRouterText } from '../_shared/openRouterAI.ts';

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

Deno.serve(async (req) => {
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

    const result = await callOpenRouterText({
      model: 'google/gemini-2.5-flash-lite',
      system: systemPrompt,
      user: userPrompt,
      maxTokens: 1500,
      temperature: 0.3,
    });

    let parsed;
    try {
      let text = result.trim();
      if (text.startsWith('```')) text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      parsed = JSON.parse(text);
    } catch {
      parsed = { translated_content: result, translated_hashtags: [] };
    }

    return new Response(JSON.stringify({ success: true, ...parsed, target_language }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[translate-social-post] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
