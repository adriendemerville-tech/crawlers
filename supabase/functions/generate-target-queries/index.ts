const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain, coreValueSummary, citations, lang = 'fr' } = await req.json();

    if (!domain) {
      return new Response(
        JSON.stringify({ success: false, error: 'Domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'LOVABLE_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build context from citations
    const citationContext = (citations || [])
      .filter((c: any) => c.cited && c.summary)
      .map((c: any) => `${c.provider?.name}: ${c.summary}`)
      .join('\n');

    const brand = domain.replace(/\.(com|fr|net|org|io|co|app|dev).*$/i, '').replace(/^www\./, '');

    const langInstructions: Record<string, string> = {
      fr: `Réponds UNIQUEMENT en français. Les requêtes doivent être formulées comme un utilisateur français les taperait.`,
      en: `Respond ONLY in English. Queries should be formulated as an English-speaking user would type them.`,
      es: `Responde ÚNICAMENTE en español. Las consultas deben formularse como las escribiría un usuario hispanohablante.`,
    };

    const prompt = `Tu es un expert en GEO (Generative Engine Optimization). 

Analyse ce site web et génère 5 requêtes stratégiques à cibler pour maximiser les recommandations par les LLMs.

**Site cible :** ${domain}
**Marque :** ${brand}
**Synthèse des perceptions LLM :** ${coreValueSummary || 'Non disponible'}
**Détails des citations LLM :**
${citationContext || 'Aucune citation disponible'}

**RÈGLES CRITIQUES :**
1. D'abord, identifie le CORE BUSINESS / produit phare / secteur de marché du site cible
2. Identifie le LEADER DU MARCHÉ dans ce secteur (le concurrent dominant)
3. Génère 5 requêtes qui mesurent le paramètre "recommandation" des LLMs :
   - 4 requêtes doivent interroger LE MARCHÉ sans mentionner la marque "${brand}" (ex: "quel est le meilleur outil pour [secteur]", "meilleure alternative à [leader du marché]", "comparatif [type de produit] [année]")
   - 1 seule requête peut mentionner explicitement "${brand}"
4. Les requêtes doivent être des questions qu'un prospect réel poserait à un LLM
5. Chaque requête doit avoir un "intent" expliquant POURQUOI cette requête est stratégique pour la citabilité

${langInstructions[lang] || langInstructions.fr}

Réponds au format JSON exact suivant, sans texte avant ou après :
{
  "coreBusiness": "description courte du core business détecté",
  "marketLeader": "nom du leader de marché identifié",
  "queries": [
    {
      "query": "la requête à tester",
      "intent": "explication stratégique (1 phrase)",
      "priority": "high" ou "medium",
      "mentionsBrand": false
    }
  ]
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a GEO (Generative Engine Optimization) expert. Always return valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'Payment required' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errText = await response.text();
      console.error('AI gateway error:', response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse JSON from response
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    } else {
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = content.substring(firstBrace, lastBrace + 1);
      }
    }

    // Clean trailing commas
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');

    const parsed = JSON.parse(jsonStr.trim());

    console.log(`Generated ${parsed.queries?.length || 0} target queries for ${domain}. Core: ${parsed.coreBusiness}`);

    return new Response(
      JSON.stringify({ success: true, data: parsed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating target queries:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to generate queries' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
