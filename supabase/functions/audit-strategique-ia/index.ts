const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ToolsData {
  crawlers: any;
  geo: any;
  llm: any;
  pagespeed: any;
}

const SYSTEM_PROMPT = `RÔLE: Tu es un Directeur de Stratégie Digitale et Expert en "Brand Authority" pour les IA. Tu réalises un audit premium pour un client qui cherche à optimiser sa visibilité dans les moteurs de réponse (ChatGPT, Google SGE, Perplexity).

MISSION: Analyse le contenu textuel fourni. Ton but est double :
1. Diagnostiquer comment l'IA perçoit la marque (Positionnement, Cible, Valeurs).
2. Prescrire un plan d'action concret pour corriger les faiblesses et dominer la thématique.

CRITÈRES D'ANALYSE (DIAGNOSTIC):

1. Identité & Perception (Brand DNA):
   - Archétype de marque (Jung)
   - Clarté du propos (0-10)
   - Valeurs détectées
   - Analyse du ton

2. Ciblage (Reverse Persona):
   - Qui est la cible déduite par le vocabulaire ?
   - Quel est le niveau d'expertise requis ?

3. Marché & Prix:
   - Positionnement perçu (Low-cost vs Premium)
   - USP (Unique Selling Proposition) détectée

4. Score GEO (Generative Engine Optimization):
   - Capacité du contenu à servir de "source de vérité" pour une IA

CRITÈRES DE RECOMMANDATION (LE PLAN D'ACTION):
Pour chaque faiblesse identifiée ou opportunité manquée, tu dois fournir une recommandation structurée ainsi :
- L'Action (QUOI) : Une instruction précise et opérationnelle
- L'Objectif Stratégique (POURQUOI) : L'impact business ou sémantique visé

Tu dois également inclure 3 paragraphes d'introduction dans le champ "introduction":
1. PRÉSENTATION (Qui, Où, Quand): Présentation du site analysé, core business, secteur, zone géographique, ancienneté estimée, publics cibles.
2. POINTS FORTS (Quoi + Pourquoi): Un ou deux aspects positifs (technique + sémantique) avec contexte concurrentiel.
3. POINT D'AMÉLIORATION PRIORITAIRE: Une donnée moins bonne, ses conséquences, et pourquoi c'est important.`;

function buildUserPrompt(url: string, domain: string, toolsData: ToolsData): string {
  return `Analyse le domaine "${domain}" (${url}) avec les données suivantes:

DONNÉES CRAWLERS (Accessibilité bots IA):
${JSON.stringify(toolsData.crawlers, null, 2)}

DONNÉES GEO (Score d'optimisation moteurs génératifs):
${JSON.stringify(toolsData.geo, null, 2)}

DONNÉES LLM (Visibilité dans les LLMs):
${JSON.stringify(toolsData.llm, null, 2)}

DONNÉES PAGESPEED (Performance technique):
${JSON.stringify(toolsData.pagespeed, null, 2)}

Produis un rapport stratégique JSON avec la structure suivante:
{
  "introduction": {
    "presentation": "Paragraphe 1: Présentation complète du site (core business, secteur, zone géographique, ancienneté estimée, publics cibles). 4-5 phrases.",
    "strengths": "Paragraphe 2: Un ou deux aspects positifs (un technique + un sémantique/référencement) avec explication du contexte concurrentiel. 4-5 phrases.",
    "improvement": "Paragraphe 3: Une donnée moins bonne, sa conséquence technique/SEO/GEO, et pourquoi c'est important dans le contexte concurrentiel. 4-5 phrases."
  },
  "brand_identity": {
    "archetype": "Archétype de Jung détecté (ex: Le Sage, Le Héros, Le Créateur...)",
    "clarity_score": 0-10,
    "perceived_values": ["valeur 1", "valeur 2", "valeur 3"],
    "tone_analysis": "Analyse du ton éditorial et de la voix de marque"
  },
  "market_positioning": {
    "target_audience": "Description de la cible déduite par le vocabulaire et le niveau d'expertise requis",
    "price_perception": "Low-cost" | "Mid-market" | "Premium",
    "detected_usp": "Proposition de valeur unique détectée (ou 'Non détectée')"
  },
  "geo_score": {
    "score": 0-100,
    "analysis": "Analyse de la capacité du contenu à servir de source de vérité pour les IA"
  },
  "strategic_roadmap": [
    {
      "category": "Identité" | "Contenu" | "Autorité",
      "priority": "Prioritaire" | "Important" | "Opportunité",
      "action_concrete": "L'action précise à effectuer (Le Quoi)",
      "strategic_goal": "La raison business/sémantique (Le Pourquoi)"
    }
  ],
  "llmVisibility": {
    "entityAuthority": "high" | "moderate" | "low",
    "ecosystemPresence": {
      "wikidata": boolean,
      "press": boolean,
      "reddit": boolean,
      "other": ["Source1", "Source2"]
    },
    "recommendations": ["Recommandation 1", "Recommandation 2"]
  },
  "testQueries": [
    {
      "query": "Requête à tester",
      "purpose": "Ce que cette requête teste",
      "targetLLMs": ["ChatGPT", "Claude", "Perplexity"]
    }
  ],
  "executive_summary": "Synthèse de 3 phrases pour le décideur (CEO/CMO).",
  "overallScore": number (0-100, score global de citabilité IA 2026)
}

IMPORTANT: 
- Le champ "introduction" avec ses 3 sous-champs est OBLIGATOIRE et doit contenir des paragraphes narratifs riches et contextualisés
- Génère au moins 5 recommandations dans strategic_roadmap, priorisées par impact
- Génère 8-10 requêtes de test variées adaptées au positionnement détecté
- Le geo_score doit refléter la "citabilité 2026" (capacité à être référencé par les IA)
- Les recommandations doivent être actionnables et priorisées par impact business`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, toolsData } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use empty toolsData if not provided (standalone strategic audit)
    const effectiveToolsData: ToolsData = toolsData || {
      crawlers: { note: 'Données non disponibles - audit stratégique autonome' },
      geo: { note: 'Données non disponibles - audit stratégique autonome' },
      llm: { note: 'Données non disponibles - audit stratégique autonome' },
      pagespeed: { note: 'Données non disponibles - audit stratégique autonome' },
    };

    // Extract domain from URL
    let domain = url;
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      domain = urlObj.hostname.replace('www.', '');
    } catch (e) {
      console.log('Could not parse URL, using as-is:', url);
    }

    console.log('Generating strategic audit for:', domain);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(url, domain, effectiveToolsData) }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits exhausted. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'AI analysis failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in AI response');
      return new Response(
        JSON.stringify({ success: false, error: 'Empty AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse JSON from response (handle markdown code blocks)
    let parsedAnalysis;
    try {
      let jsonContent = content;
      if (content.includes('```json')) {
        jsonContent = content.split('```json')[1].split('```')[0].trim();
      } else if (content.includes('```')) {
        jsonContent = content.split('```')[1].split('```')[0].trim();
      }
      parsedAnalysis = JSON.parse(jsonContent);
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', e);
      console.log('Raw content:', content);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to parse AI analysis' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = {
      success: true,
      data: {
        url,
        domain,
        scannedAt: new Date().toISOString(),
        ...parsedAnalysis,
        toolsData,
      }
    };

    console.log('Strategic audit completed successfully');

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate audit';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
