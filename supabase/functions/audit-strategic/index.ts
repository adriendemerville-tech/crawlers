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

const SYSTEM_PROMPT = `Tu es l'agent analytique de Crawlers.fr, expert mondial en audit automatisé de haute précision pour l'écosystème IA & Search 2026.

PRÉ-REQUIS: Intègre les derniers critères de GEO (Generative Engine Optimization) et SGE (Search Generative Experience) 2026:
- Citabilité : capacité du contenu à être "aspiré" comme réponse de référence par les IA
- Formats de données structurées privilégiés (JSON-LD, FAQPage, HowTo)
- Impact des Core Web Vitals sur les réponses IA
- Attribution des sources dans les réponses génératives

Tu dois analyser les données fournies et produire un rapport stratégique structuré au format JSON.`;

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
  "brandPerception": {
    "semanticUniverse": "Description de l'univers sémantique et visuel (2-3 phrases)",
    "targetAudience": "B2B" | "B2C" | "Both",
    "marketPosition": "entry-level" | "mid-range" | "premium",
    "valueProposition": "Avantage concurrentiel perçu (1-2 phrases)"
  },
  "visualIdentity": {
    "faviconDetection": {
      "hasSvg": boolean,
      "hasPng48": boolean,
      "hasAppleTouchIcon": boolean,
      "httpStatus": number,
      "permanentUrl": boolean
    },
    "alignedWithPosition": boolean,
    "recommendations": ["Recommandation 1", "Recommandation 2"]
  },
  "seoArchitecture": {
    "isSSR": boolean,
    "crawlBudgetOptimization": "good" | "moderate" | "poor",
    "semanticHierarchy": "strong" | "moderate" | "weak",
    "recommendations": ["Recommandation 1", "Recommandation 2"]
  },
  "geoAnalysis": {
    "citabilityIndex": number (0-100),
    "hasFactualData": boolean,
    "hasComparativeTables": boolean,
    "hasExpertCitations": boolean,
    "contextualStrategy": "Stratégie recommandée selon le positionnement",
    "recommendations": ["Recommandation 1", "Recommandation 2"]
  },
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
  "executiveSummary": "Résumé exécutif de 3-4 phrases synthétisant le diagnostic et les priorités d'action.",
  "overallScore": number (0-100, calculé sur les critères 2026)
}

IMPORTANT: 
- Génère 10 requêtes de test variées et adaptées au positionnement détecté
- Le score global doit refléter la "citabilité 2026" (capacité à être référencé par les IA)
- Les recommandations doivent être actionnables et priorisées`;
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
