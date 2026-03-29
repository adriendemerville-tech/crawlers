import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { callLovableAIJson } from '../_shared/lovableAI.ts';

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

    const { message_content, domain, tracked_site_id, nodes_context, language } = await req.json();
    const lang = (language === 'en' || language === 'es') ? language : 'fr';
    
    if (!message_content || !domain) {
      return new Response(JSON.stringify({ error: "message_content and domain required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Build extraction prompt with nodes context
    const nodesLabel = { fr: 'Pages du cocon sémantique', en: 'Semantic cocoon pages', es: 'Páginas del capullo semántico' }[lang];
    const nodesInfo = nodes_context?.length
      ? `\n\n${nodesLabel} :\n${nodes_context.slice(0, 30).map((n: any) => `- ${n.url || n.id} (${n.pageType || 'page'}, score: ${n.seoScore || 'N/A'})`).join('\n')}`
      : '';

    const promptsByLang: Record<string, { intro: string; fieldDescs: Record<string, string>; outro: string }> = {
      fr: {
        intro: `Analyse cette recommandation d'optimisation de maillage interne et extrais les champs structurés pour construire une page de contenu optimisée.`,
        fieldDescs: {
          url: "URL de la page principale à créer ou optimiser",
          keyword: "mot-clé principal identifié",
          secondary_keywords: "mots-clés secondaires mentionnés",
          page_type: "type de page",
          content_length: "longueur de contenu recommandée",
          tone: "ton recommandé (professionnel, expert, pédagogique, etc.)",
          h1_suggestion: "suggestion de H1",
          internal_links: "URLs de pages à lier",
          cta_suggestion: "CTA suggéré",
          competitor_insights: "résumé des insights concurrentiels",
          priority_actions: "actions prioritaires",
          custom_prompt: "instruction de contenu synthétisée",
        },
        outro: "Réponds UNIQUEMENT avec le JSON, sans markdown ni explication. Rédige TOUS les textes en français.",
      },
      en: {
        intro: `Analyze this internal linking optimization recommendation and extract structured fields to build an optimized content page.`,
        fieldDescs: {
          url: "Main page URL to create or optimize",
          keyword: "Main keyword identified",
          secondary_keywords: "Secondary keywords mentioned",
          page_type: "Page type",
          content_length: "Recommended content length",
          tone: "Recommended tone (professional, expert, educational, etc.)",
          h1_suggestion: "H1 suggestion",
          internal_links: "Page URLs to link to",
          cta_suggestion: "Suggested CTA",
          competitor_insights: "Summary of competitive insights",
          priority_actions: "Priority actions",
          custom_prompt: "Synthesized content instruction",
        },
        outro: "Respond ONLY with the JSON, no markdown or explanation. Write ALL text in English.",
      },
      es: {
        intro: `Analiza esta recomendación de optimización de enlazado interno y extrae los campos estructurados para construir una página de contenido optimizada.`,
        fieldDescs: {
          url: "URL de la página principal a crear u optimizar",
          keyword: "Palabra clave principal identificada",
          secondary_keywords: "Palabras clave secundarias mencionadas",
          page_type: "Tipo de página",
          content_length: "Longitud de contenido recomendada",
          tone: "Tono recomendado (profesional, experto, pedagógico, etc.)",
          h1_suggestion: "Sugerencia de H1",
          internal_links: "URLs de páginas a enlazar",
          cta_suggestion: "CTA sugerido",
          competitor_insights: "Resumen de insights competitivos",
          priority_actions: "Acciones prioritarias",
          custom_prompt: "Instrucción de contenido sintetizada",
        },
        outro: "Responde ÚNICAMENTE con el JSON, sin markdown ni explicación. Redacta TODOS los textos en español.",
      },
    };

    const p = promptsByLang[lang];
    const extractionPrompt = `${p.intro}

RECOMMENDATION:
"""
${message_content.slice(0, 3000)}
"""
${nodesInfo}

DOMAIN: ${domain}

Extract a JSON with these fields (all optional except keyword):
{
  "url": "${p.fieldDescs.url}",
  "keyword": "${p.fieldDescs.keyword}",
  "secondary_keywords": ["${p.fieldDescs.secondary_keywords}"],
  "page_type": "article|product|faq|landing|category|homepage",
  "content_length": "short|medium|long|pillar",
  "tone": "${p.fieldDescs.tone}",
  "h1_suggestion": "${p.fieldDescs.h1_suggestion}",
  "internal_links": ["${p.fieldDescs.internal_links}"],
  "cta_suggestion": "${p.fieldDescs.cta_suggestion}",
  "competitor_insights": "${p.fieldDescs.competitor_insights}",
  "priority_actions": ["${p.fieldDescs.priority_actions}"],
  "custom_prompt": "${p.fieldDescs.custom_prompt}"
}

${p.outro}`;

    let draftData: Record<string, any>;
    try {
      draftData = await callLovableAIJson<Record<string, any>>({
        system: lang === 'en' ? "You are a structured data extractor. Respond only in valid JSON. All text must be in English." : lang === 'es' ? "Eres un extractor de datos estructurados. Responde solo en JSON válido. Todo el texto debe estar en español." : "Tu es un extracteur de données structurées. Réponds uniquement en JSON valide. Tout le texte doit être en français.",
        user: extractionPrompt,
        model: 'google/gemini-2.5-flash-lite',
      });
    } catch (e) {
      console.error("[extract-architect-fields] Failed to parse AI response:", e);
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
