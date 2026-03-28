import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { generateImage, getAvailableProviders, IMAGE_STYLES, type ImageStyle } from '../_shared/imageGeneration.ts';
import { trackTokenUsage } from '../_shared/tokenTracker.ts';

const VALID_STYLES = IMAGE_STYLES.map(s => s.key);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getServiceClient();
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { prompt, style, width, height, aspectRatio, negativePrompt, provider, referenceImageUrl, referenceMode } = body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
      return new Response(JSON.stringify({ error: "prompt required (min 3 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!style || !VALID_STYLES.includes(style)) {
      return new Response(JSON.stringify({ 
        error: `style must be one of: ${VALID_STYLES.join(', ')}`,
        available_providers: getAvailableProviders(),
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: fairUse } = await supabase.rpc('check_fair_use_v2', {
      p_user_id: user.id,
      p_action: 'generate_image',
      p_hourly_limit: 5,
      p_daily_limit: 10,
    });

    if (fairUse && !fairUse.allowed) {
      return new Response(JSON.stringify({ 
        error: "Rate limit exceeded",
        ...fairUse,
      }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await generateImage({
      prompt: prompt.trim(),
      style: style as ImageStyle,
      provider,
      width: width || undefined,
      height: height || undefined,
      aspectRatio: aspectRatio || undefined,
      negativePrompt: negativePrompt || undefined,
      referenceImageUrl: referenceImageUrl || undefined,
      referenceMode: referenceMode || undefined,
    });

    await trackTokenUsage('generate-image', result.provider, {
      prompt_tokens: prompt.length,
      completion_tokens: Math.round(result.imageBase64.length / 1024),
      total_tokens: prompt.length + Math.round(result.imageBase64.length / 1024),
    });

    return new Response(JSON.stringify({
      success: true,
      provider: result.provider,
      style: result.style,
      dataUri: result.dataUri,
      mimeType: result.mimeType,
      metadata: result.metadata || null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[generate-image] Error:", e);
    const status = e instanceof Error && e.message.includes('not configured') ? 503 : 500;
    return new Response(JSON.stringify({ 
      error: e instanceof Error ? e.message : "Unknown error",
    }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});