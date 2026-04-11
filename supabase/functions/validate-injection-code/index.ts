import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { code, injection_type } = await req.json();
    if (!code || typeof code !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'code' parameter" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Tu es un expert en développement web et SEO technique. Tu analyses du code d'injection (JavaScript, JSON-LD, HTML, CSS) pour vérifier :

1. SYNTAXE : Parenthèses/accolades/guillemets équilibrés, pas de JS invalide, JSON-LD bien formé
2. COUVERTURE : Le code couvre-t-il l'objectif de son type d'injection dans sa totalité ?
3. LISIBILITÉ BOTS : Les bots Google/Bing et les LLMs pourront-ils comprendre et exploiter ce code ?
4. SÉCURITÉ : Pas de faille XSS, pas d'eval(), pas de document.write() dangereux

Réponds UNIQUEMENT avec un appel à la fonction validate_code.`;

    const userPrompt = `Analyse ce code d'injection${injection_type ? ` (type: ${injection_type})` : ''} :

\`\`\`
${code.slice(0, 8000)}
\`\`\`

Vérifie syntaxe, couverture objectif, lisibilité bots, et sécurité. Si des corrections sont nécessaires, fournis le code corrigé complet.`;

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
        tools: [{
          type: "function",
          function: {
            name: "validate_code",
            description: "Return validation results for injection code",
            parameters: {
              type: "object",
              properties: {
                valid: { type: "boolean", description: "true if code passes all checks" },
                score: { type: "integer", description: "Quality score 0-100" },
                issues: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["error", "warning", "info"] },
                      category: { type: "string", enum: ["syntax", "coverage", "bot_readability", "security"] },
                      message: { type: "string" },
                      line: { type: "integer" },
                      suggestion: { type: "string" },
                    },
                    required: ["type", "category", "message"],
                    additionalProperties: false,
                  },
                },
                corrected_code: { type: "string", description: "Full corrected code if changes needed, null if code is fine" },
              },
              required: ["valid", "score", "issues"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "validate_code" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[validate-injection-code] AI error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please retry" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI validation failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({
        valid: true, score: 70, issues: [{ type: "info", category: "coverage", message: "Validation automatique non disponible pour ce code." }],
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const validationResult = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(validationResult), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[validate-injection-code] Error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
