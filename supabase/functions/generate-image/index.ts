import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { generateImage, getAvailableProviders, type ImageStyle } from '../_shared/imageGeneration.ts';
import { trackTokenUsage } from '../_shared/tokenTracker.ts';

/**
 * generate-image
 * 
 * Routing:
 *   style=photo       → Imagen 3 (Gemini, photo-réaliste)
 *   style=artistic    → FLUX (Black Forest Labs, illustration)
 *   style=typography  → Ideogram (texte, logo, typo)
 * 
 * Body:
 *   { prompt, style, width?, height?, aspectRatio?, negativePrompt?, provider? }
 * 
 * Returns:
 *   { success, provider, dataUri, mimeType, metadata? }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
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

    // Parse request
    const body = await req.json();
    const { prompt, style, width, height, aspectRatio, negativePrompt, provider } = body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
      return new Response(JSON.stringify({ error: "prompt required (min 3 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validStyles: ImageStyle[] = ['photo', 'artistic', 'typography'];
    if (!style || !validStyles.includes(style)) {
      return new Response(JSON.stringify({ 
        error: `style must be one of: ${validStyles.join(', ')}`,
        available_providers: getAvailableProviders(),
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fair use check (10/day)
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

    // Generate
    const result = await generateImage({
      prompt: prompt.trim(),
      style,
      provider,
      width: width || undefined,
      height: height || undefined,
      aspectRatio: aspectRatio || undefined,
      negativePrompt: negativePrompt || undefined,
    });

    // Track usage
    await trackTokenUsage('generate-image', result.provider, {
      prompt_tokens: prompt.length,
      completion_tokens: Math.round(result.imageBase64.length / 1024),
      total_tokens: prompt.length + Math.round(result.imageBase64.length / 1024),
    });

    return new Response(JSON.stringify({
      success: true,
      provider: result.provider,
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
