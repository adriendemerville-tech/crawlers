import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { raw_message, route, context_data } = await req.json();
    if (!raw_message || raw_message.trim().length < 5) {
      return new Response(JSON.stringify({ error: 'Message trop court' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Rate limit: max 3 reports/day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count } = await auth.supabase
      .from('user_bug_reports')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', auth.userId)
      .gte('created_at', today.toISOString());

    if ((count || 0) >= 3) {
      return new Response(JSON.stringify({ error: 'Limite de 3 signalements par jour atteinte' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Duplicate detection: hash of message + route in last 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: dupes } = await auth.supabase
      .from('user_bug_reports')
      .select('id')
      .eq('user_id', auth.userId)
      .eq('raw_message', raw_message.trim())
      .gte('created_at', oneDayAgo);

    if (dupes && dupes.length > 0) {
      return new Response(JSON.stringify({ error: 'Signalement similaire déjà envoyé', duplicate: true }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Translate user message to technical description via Lovable AI
    let translatedMessage = raw_message;
    let category = 'bug_ui';

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (LOVABLE_API_KEY) {
      try {
        const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-lite',
            messages: [
              {
                role: 'system',
                content: `Tu es un traducteur technique. L'utilisateur signale un problème sur une app SaaS SEO (crawlers.fr).
Traduis son message en description technique exploitable pour un développeur CTO.
Classe le signalement dans une catégorie: bug_ui, bug_data, bug_function, feature_request, question.
Réponds UNIQUEMENT en JSON: {"translated": "...", "category": "..."}`
              },
              {
                role: 'user',
                content: `Route: ${route || 'inconnue'}\nMessage utilisateur: ${raw_message}\nContexte: ${JSON.stringify(context_data || {})}`
              }
            ],
            tools: [{
              type: 'function',
              function: {
                name: 'classify_report',
                description: 'Classify and translate a bug report',
                parameters: {
                  type: 'object',
                  properties: {
                    translated: { type: 'string', description: 'Technical translation of the user message' },
                    category: { type: 'string', enum: ['bug_ui', 'bug_data', 'bug_function', 'feature_request', 'question'] }
                  },
                  required: ['translated', 'category'],
                  additionalProperties: false
                }
              }
            }],
            tool_choice: { type: 'function', function: { name: 'classify_report' } }
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall) {
            const parsed = JSON.parse(toolCall.function.arguments);
            translatedMessage = parsed.translated || raw_message;
            category = parsed.category || 'bug_ui';
          }
        }
      } catch (e) {
        console.error('AI translation failed, using raw message:', e);
      }
    }

    // Enrich context
    const enrichedContext = {
      ...(context_data || {}),
      plan_type: auth.planType,
      user_email: auth.email,
      reported_at: new Date().toISOString(),
    };

    // Insert report
    const { data: report, error } = await auth.supabase
      .from('user_bug_reports')
      .insert({
        user_id: auth.userId,
        raw_message: raw_message.trim(),
        translated_message: translatedMessage,
        category,
        route: route || null,
        context_data: enrichedContext,
        status: 'open',
      })
      .select('id')
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, id: report.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('submit-bug-report error:', e);
    return new Response(JSON.stringify({ error: e.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
