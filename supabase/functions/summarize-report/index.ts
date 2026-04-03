import { trackTokenUsage } from "../_shared/tokenTracker.ts";
import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

Deno.serve(handleRequest(async (req) => {
try {
    const { texts, language } = await req.json();

    // texts is a Record<string, string> of key -> long text
    if (!texts || typeof texts !== "object" || Object.keys(texts).length === 0) {
      return new Response(JSON.stringify({ error: "No texts provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const lang = language === "es" ? "espagnol" : language === "en" ? "anglais" : "français";

    // Build a prompt that asks to summarize each text field
    const entries = Object.entries(texts).filter(([, v]) => typeof v === "string" && v.length > 80);
    
    if (entries.length === 0) {
      // Nothing to summarize
      return new Response(JSON.stringify({ summaries: texts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const textsBlock = entries
      .map(([key, value]) => `### ${key}\n${value}`)
      .join("\n\n");

    const systemPrompt = `Tu es un rédacteur expert en SEO et marketing digital. Tu résumes des sections de rapport d'audit stratégique pour un format PDF téléchargeable qui doit tenir en 6 pages MAXIMUM (environ 3000 mots au total pour l'ensemble des sections).

Règles :
- Résume chaque section de façon agressive : divise la longueur par 3 minimum
- Les sections longues (>500 caractères) doivent être réduites à 2-3 phrases percutantes maximum
- Conserve UNIQUEMENT les données chiffrées clés, les noms propres et les 1-2 recommandations les plus importantes
- Supprime les listes à puces longues : garde maximum 3 points par liste
- Garde un ton professionnel mais direct et concis
- Rédige en ${lang}
- Retourne UNIQUEMENT un objet JSON avec les mêmes clés que l'entrée et les textes résumés comme valeurs
- Ne mets pas de bloc markdown, juste le JSON brut`;

    const userPrompt = `Résume chacune de ces sections de rapport pour qu'elles tiennent dans un PDF de 6 pages maximum. Sois très concis, va à l'essentiel :\n\n${textsBlock}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
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
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      // Fallback: return original texts
      return new Response(JSON.stringify({ summaries: texts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Track token usage for admin dashboard
    const usage = data.usage;
    trackTokenUsage("summarize-report", "google/gemini-2.5-flash", usage).catch(() => {});

    // Parse JSON from response, handling potential markdown wrapping
    let summaries: Record<string, string>;
    try {
      const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      summaries = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI summary response:", content);
      // Fallback: return original texts
      return new Response(JSON.stringify({ summaries: texts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Merge: keep original for keys not returned by AI
    const merged = { ...texts };
    for (const [key, value] of Object.entries(summaries)) {
      if (typeof value === "string" && value.length > 10) {
        merged[key] = value;
      }
    }

    return new Response(JSON.stringify({ summaries: merged }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("summarize-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));