/**
 * generate-social-image — AI-powered canvas image generation/editing
 * Takes a prompt + optional existing canvas data, returns updated canvas JSON.
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

const MODEL = 'google/gemini-2.5-flash';

Deno.serve(handleRequest(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    if (auth.planType === 'free') {
      return new Response(JSON.stringify({ error: 'Pro Agency required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { prompt, canvas_data, platform, branding } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'prompt required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const dimensions: Record<string, { w: number; h: number }> = {
      linkedin: { w: 1200, h: 627 },
      facebook: { w: 1200, h: 630 },
      instagram: { w: 1080, h: 1080 },
      story: { w: 1080, h: 1920 },
    };

    const dim = dimensions[platform || 'linkedin'] || dimensions.linkedin;

    const systemPrompt = `Tu es un designer graphique expert en social media. Tu génères des descriptions de canvas JSON pour créer des visuels sociaux percutants.

Le canvas utilise ce format:
{
  "width": ${dim.w},
  "height": ${dim.h},
  "background": { "type": "gradient|solid|image", "value": "..." },
  "elements": [
    {
      "type": "text|shape|icon",
      "x": number, "y": number, "width": number, "height": number,
      "content": "...",
      "style": { "fontSize": number, "fontWeight": "bold|normal", "color": "#hex", "textAlign": "left|center|right" }
    }
  ]
}

${branding ? `Branding du site: couleurs ${JSON.stringify(branding.colors || {})}, polices: ${JSON.stringify(branding.fonts || [])}` : ''}
${canvas_data ? `Canvas existant à modifier: ${JSON.stringify(canvas_data)}` : 'Crée un nouveau canvas.'}`;

    const result = await callOpenRouter({
      model: MODEL,
      system: systemPrompt,
      user: `Prompt créatif: ${prompt}\nPlateforme: ${platform || 'linkedin'}\nDimensions: ${dim.w}x${dim.h}px\nRéponds uniquement en JSON (le canvas).`,
      maxTokens: 2000,
      temperature: 0.8,
    });

    const supabase = getServiceClient();

    // Log AI usage for cost tracking
    logAIUsageFromResponse(supabase, MODEL, 'generate-social-image', result.usage);

    // Log analytics event for finance tracking
    supabase.from('analytics_events').insert({
      event_type: 'ai_token_usage',
      event_data: {
        function_name: 'generate-social-image',
        model: MODEL,
        prompt_tokens: result.usage?.prompt_tokens || 0,
        completion_tokens: result.usage?.completion_tokens || 0,
        total_tokens: result.usage?.total_tokens || 0,
      },
      user_id: auth.userId,
    }).then(() => {}).catch(() => {});

    let canvasResult;
    try {
      let text = result.content.trim();
      if (text.startsWith('```')) text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      canvasResult = JSON.parse(text);
    } catch {
      canvasResult = { width: dim.w, height: dim.h, background: { type: 'solid', value: '#1a1a2e' }, elements: [{ type: 'text', x: 50, y: dim.h / 2 - 30, width: dim.w - 100, height: 60, content: prompt, style: { fontSize: 32, fontWeight: 'bold', color: '#ffffff', textAlign: 'center' } }] };
    }

    return new Response(JSON.stringify({ success: true, canvas: canvasResult }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[generate-social-image] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}, 'generate-social-image'))
