import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServiceClient } from '../_shared/supabaseClient.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * extract-architect-fields
 * 
 * Takes a maillage/optimization response from Cocoon assistant,
 * uses Gemini Flash to extract structured fields for Content Architect,
 * and persists them as a draft in cocoon_architect_drafts.
 */
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
    
    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { message_content, domain, tracked_site_id, nodes_context } = await req.json();
    
    if (!message_content || !domain) {
      return new Response(JSON.stringify({ error: "message_content and domain required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Build extraction prompt with nodes context
    const nodesInfo = nodes_context?.length
      ? `\n\nPages du cocon sémantique :\n${nodes_context.slice(0, 30).map((n: any) => `- ${n.url || n.id} (${n.pageType || 'page'}, score: ${n.seoScore || 'N/A'})`).join('\n')}`
      : '';

    const extractionPrompt = `Analyse cette recommandation d'optimisation de maillage interne et extrais les champs structurés pour construire une page de contenu optimisée.

RECOMMANDATION DE L'ASSISTANT COCOON :
"""
${message_content.slice(0, 3000)}
"""
${nodesInfo}

DOMAINE : ${domain}

Extrais un JSON avec ces champs (tous optionnels sauf keyword) :
{
  "url": "URL de la page principale à créer ou optimiser (déduis-la des recommandations)",
  "keyword": "mot-clé principal identifié dans les recommandations",
  "secondary_keywords": ["mots-clés secondaires mentionnés"],
  "page_type": "article|product|faq|landing|category|homepage",
  "content_length": "short|medium|long|pillar",
  "tone": "ton recommandé (professionnel, expert, pédagogique, etc.)",
  "h1_suggestion": "suggestion de H1 basée sur les recommandations",
  "internal_links": ["URLs de pages à lier mentionnées dans les recommandations"],
  "cta_suggestion": "CTA suggéré si applicable",
  "competitor_insights": "résumé des insights concurrentiels mentionnés",
  "priority_actions": ["actions prioritaires extraites des recommandations"],
  "custom_prompt": "instruction de contenu synthétisée à partir des recommandations"
}

Réponds UNIQUEMENT avec le JSON, sans markdown ni explication.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Tu es un extracteur de données structurées. Réponds uniquement en JSON valide." },
          { role: "user", content: extractionPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      console.error("[extract-architect-fields] AI error:", aiResponse.status);
      return new Response(JSON.stringify({ error: "AI extraction failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || '{}';
    
    let draftData: Record<string, any>;
    try {
      draftData = JSON.parse(rawContent);
    } catch {
      console.error("[extract-architect-fields] Failed to parse AI response:", rawContent.slice(0, 200));
      draftData = {};
    }

    // Persist draft — upsert by user + tracked_site_id
    const upsertPayload: any = {
      user_id: user.id,
      domain,
      draft_data: draftData,
      source_message: message_content.slice(0, 5000),
      updated_at: new Date().toISOString(),
    };
    if (tracked_site_id) upsertPayload.tracked_site_id = tracked_site_id;

    // Check existing draft for this user+domain
    const { data: existing } = await supabase
      .from('cocoon_architect_drafts')
      .select('id')
      .eq('user_id', user.id)
      .eq('domain', domain)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('cocoon_architect_drafts')
        .update(upsertPayload)
        .eq('id', existing.id);
    } else {
      await supabase
        .from('cocoon_architect_drafts')
        .insert(upsertPayload);
    }

    console.log(`[extract-architect-fields] Draft saved for ${domain}, fields: ${Object.keys(draftData).length}`);

    return new Response(JSON.stringify({ success: true, draft: draftData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[extract-architect-fields] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
