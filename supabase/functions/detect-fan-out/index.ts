import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FanOutAxis {
  axis: string;
  sub_query: string;
  source: "llm_simulation" | "citation_reverse";
  confidence: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { domain, query, trackedSiteId, userId, identityCard } = await req.json();
    if (!domain || !query || !trackedSiteId || !userId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!openrouterKey) {
      return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Method A: LLM Simulation ──
    const simulationPrompt = `Tu es un moteur RAG (Retrieval-Augmented Generation) comme Perplexity ou ChatGPT Search.
L'utilisateur pose cette question : "${query}"
Le site analysé est : ${domain}
${identityCard ? `Contexte du site : ${JSON.stringify(identityCard).slice(0, 500)}` : ''}

Décompose cette requête en exactement 5 sous-requêtes de recherche web que tu lancerais en parallèle pour couvrir le sujet.
Pour chaque sous-requête, indique :
- L'axe sémantique couvert (ex: "définition", "comparaison", "prix", "avis", "alternatives")
- La sous-requête exacte

Réponds UNIQUEMENT en JSON valide :
{"axes": [{"axis": "string", "sub_query": "string"}]}`;

    const simResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openrouterKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: simulationPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });

    let simulatedAxes: FanOutAxis[] = [];
    if (simResponse.ok) {
      const simData = await simResponse.json();
      const content = simData.choices?.[0]?.message?.content || "{}";
      try {
        const parsed = JSON.parse(content);
        simulatedAxes = (parsed.axes || []).map((a: any) => ({
          axis: a.axis,
          sub_query: a.sub_query,
          source: "llm_simulation" as const,
          confidence: 0.65,
        }));
      } catch { /* ignore parse error */ }
    }

    // ── Method B: Citation Reverse Engineering via Perplexity (sonar) ──
    let citationAxes: FanOutAxis[] = [];
    try {
      const perpResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openrouterKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "perplexity/sonar",
          messages: [{ role: "user", content: query }],
          temperature: 0.1,
        }),
      });

      if (perpResponse.ok) {
        const perpData = await perpResponse.json();
        const citations = perpData.citations || [];

        if (citations.length > 0) {
          // Ask LLM to extract semantic axes from the cited URLs
          const extractPrompt = `Voici les URLs citées par un moteur RAG pour la requête "${query}" :
${citations.slice(0, 10).map((u: string, i: number) => `${i + 1}. ${u}`).join('\n')}

Déduis les 5 axes sémantiques couverts par ces sources.
Réponds UNIQUEMENT en JSON : {"axes": [{"axis": "string", "sub_query": "string"}]}`;

          const extractResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${openrouterKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [{ role: "user", content: extractPrompt }],
              response_format: { type: "json_object" },
              temperature: 0.2,
            }),
          });

          if (extractResponse.ok) {
            const extractData = await extractResponse.json();
            const content = extractData.choices?.[0]?.message?.content || "{}";
            try {
              const parsed = JSON.parse(content);
              citationAxes = (parsed.axes || []).map((a: any) => ({
                axis: a.axis,
                sub_query: a.sub_query,
                source: "citation_reverse" as const,
                confidence: 0.85,
              }));
            } catch { /* ignore */ }
          }
        }
      }
    } catch (err) {
      console.warn("[detect-fan-out] Perplexity citation failed:", err);
    }

    // ── Merge & Deduplicate axes ──
    const allAxes = [...citationAxes, ...simulatedAxes];
    const seenAxes = new Set<string>();
    const mergedAxes: FanOutAxis[] = [];
    for (const axis of allAxes) {
      const normalized = axis.axis.toLowerCase().trim();
      if (!seenAxes.has(normalized)) {
        seenAxes.add(normalized);
        mergedAxes.push(axis);
      }
    }

    // ── Persist to keyword_universe ──
    // First, upsert the parent query
    const { data: parentRow } = await supabase
      .from("keyword_universe")
      .upsert({
        domain,
        keyword: query,
        sources: ["fan_out"],
        user_id: userId,
        tracked_site_id: trackedSiteId,
        source_details: { fan_out_parent: true, axes_count: mergedAxes.length },
        updated_at: new Date().toISOString(),
      }, { onConflict: "domain,keyword,user_id" })
      .select("id")
      .single();

    const parentId = parentRow?.id;

    // Insert sub-queries
    if (parentId && mergedAxes.length > 0) {
      const subRows = mergedAxes.map((a) => ({
        domain,
        keyword: a.sub_query,
        sources: ["fan_out"],
        user_id: userId,
        tracked_site_id: trackedSiteId,
        parent_query_id: parentId,
        source_details: {
          fan_out_axis: a.axis,
          fan_out_source: a.source,
          fan_out_confidence: a.confidence,
        },
        updated_at: new Date().toISOString(),
      }));

      await supabase.from("keyword_universe").upsert(subRows, { onConflict: "domain,keyword,user_id" });
    }

    return new Response(JSON.stringify({
      query,
      axes: mergedAxes,
      parent_id: parentId,
      citation_count: citationAxes.length,
      simulation_count: simulatedAxes.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[detect-fan-out] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
