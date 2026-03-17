import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logSilentError } from "../_shared/silentErrorLogger.ts";
import { getSiteContext } from '../_shared/getSiteContext.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context, analysisMode, language, domain, trackedSiteId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // ── Fetch site identity card ──
    let siteIdentityBlock = '';
    try {
      if (domain || trackedSiteId) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        const ctx = await getSiteContext(supabase, trackedSiteId ? { trackedSiteId } : { domain });
        if (ctx) {
          const parts: string[] = [];
          if (ctx.market_sector) parts.push(`Secteur: ${ctx.market_sector}`);
          if (ctx.products_services) parts.push(`Produits/Services: ${ctx.products_services}`);
          if (ctx.target_audience) parts.push(`Cible: ${ctx.target_audience}`);
          if (ctx.commercial_area) parts.push(`Zone commerciale: ${ctx.commercial_area}`);
          if (parts.length > 0) siteIdentityBlock = `\n\nCarte d'identité du site (fiabilité: ${ctx.identity_confidence || 0}/100) :\n${parts.join('\n')}`;
          console.log(`[cocoon-chat] Site context loaded (confidence: ${ctx.identity_confidence || 0})`);
        }
      }
    } catch (e) {
      console.warn('[cocoon-chat] Could not fetch site context:', e);
    }

    const langInstruction = language === 'en'
      ? 'You MUST reply entirely in English.'
      : language === 'es'
        ? 'Debes responder SIEMPRE en español.'
        : 'Tu DOIS répondre entièrement en français.';

    const basePrompt = `Tu es un expert en SEO sémantique et architecture de contenu, spécialisé dans l'analyse de cocons sémantiques (cocoon / topic clusters).

${langInstruction}
${siteIdentityBlock}

Tu as accès aux données suivantes sur le cocon sémantique de l'utilisateur :
${context || "Aucune donnée de cocon fournie."}

Ton rôle :
- Interpréter les métriques du cocon (ROI prédictif, GEO score, citabilité LLM, E-E-A-T, content gap, cannibalisation)
- Identifier les clusters faibles et proposer des optimisations concrètes
- Suggérer des liens internes manquants ou redondants
- Recommander des pages à créer, fusionner ou supprimer
- Expliquer les relations sémantiques entre les nœuds
- Donner des conseils pour améliorer la visibilité LLM (GEO)

Réponds de façon concise, structurée et actionnable. Utilise des bullets points et du markdown.`;

    const analysisPrompt = analysisMode ? `

IMPORTANT: L'utilisateur a sélectionné plusieurs pages pour une analyse comparative. Tu dois:
1. Décrire la relation contextuelle et sémantique entre ces pages
2. Analyser la hiérarchie et le flux de "juice" (link equity) entre elles
3. Utiliser ce format de couleurs dans ta réponse:
   - 🟢 **Forces** : ce qui fonctionne bien (liens forts, complémentarité sémantique)
   - 🔵 **Faiblesses** : points à améliorer (orphelines, faible autorité)
   - 🔴 **Gaps** : liens manquants, opportunités ratées
   - ✨ **Quick Wins** : actions rapides à fort impact
4. Conclure avec des recommandations concrètes de maillage interne` : '';

    const systemPrompt = basePrompt + analysisPrompt;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("cocoon-chat error:", e);
    await logSilentError("cocoon-chat", "chat-completion", e, { severity: "high", impact: "none" });
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
