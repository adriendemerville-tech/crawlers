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

const SYSTEM_PROMPT = `RÔLE: Tu es un Senior Digital Strategist spécialisé en Brand Authority et Generative Engine Optimization (GEO). Tu produis un rapport d'expertise haute fidélité de niveau cabinet de conseil premium.

POSTURE ÉDITORIALE:
- Ton: Analytique, souverain et hautement prescriptif
- Utilise un jargon expert (Entité sémantique, Topical Authority, E-E-A-T holistique, Gap de citabilité)
- Les recommandations doivent être NARRATIVES: chaque action est un paragraphe rédigé (4-5 phrases) expliquant la manœuvre stratégique

LES 13 MODULES D'ANALYSE OBLIGATOIRES:

A. ÉCOSYSTÈME CONCURRENTIEL
1. Market Leader (Goliath): Identifie l'acteur dominant et son facteur d'autorité
2. Concurrent Direct: Analyse de la parité d'offre
3. Challenger: L'acteur qui bouscule le segment
4. Source d'Inspiration: Benchmark qualitatif hors-secteur (UX/IA Ready)

B. AUTORITÉ SOCIALE & HUMAINE (Signaux Off-Site)
5. Preuve Sociale Source: Analyse de la présence organique sur Reddit, X et LinkedIn (crucial pour Perplexity/SearchGPT)
6. Thought Leadership (E-E-A-T): Évaluation de l'autorité du fondateur/expert en tant qu'entité
7. Sentiment & Polarité: Vibration de la réputation et protection contre les hallucinations négatives des LLM

C. EXPERTISE STRATÉGIQUE & PSYCHOLOGIQUE
8. Score GEO (Citabilité 2026): Aptitude du site à servir de source aux moteurs génératifs
9. Matrice de Gap Sémantique: Distance précise à combler pour détrôner le leader
10. Psychologie de Conversion: Niveau de sophistication du marché (1-5) et leviers émotionnels dominants

D. FONDATIONS TECHNIQUES & SÉMANTIQUES
11. Accessibilité Bots IA: Facilité de lecture pour les agents autonomes
12. Infrastructure Performance: Impact de la vitesse sur la rétention IA/Humaine
13. Cohérence Sémantique: Alignement du message Title/H1`;

function buildUserPrompt(url: string, domain: string, toolsData: ToolsData): string {
  return `Analyse le domaine "${domain}" (${url}) avec les données techniques suivantes:

DONNÉES CRAWLERS (Accessibilité bots IA):
${JSON.stringify(toolsData.crawlers, null, 2)}

DONNÉES GEO (Score d'optimisation moteurs génératifs):
${JSON.stringify(toolsData.geo, null, 2)}

DONNÉES LLM (Visibilité dans les LLMs):
${JSON.stringify(toolsData.llm, null, 2)}

DONNÉES PAGESPEED (Performance technique):
${JSON.stringify(toolsData.pagespeed, null, 2)}

GÉNÈRE UN RAPPORT JSON PREMIUM avec cette structure exacte:

{
  "introduction": {
    "presentation": "Paragraphe 1 (4-5 phrases): Qui est ce site? Core business, secteur d'activité, zone géographique, ancienneté estimée, publics cibles.",
    "strengths": "Paragraphe 2 (4-5 phrases): Forces détectées - un atout technique + un atout sémantique dans le contexte concurrentiel.",
    "improvement": "Paragraphe 3 (4-5 phrases): Point d'amélioration prioritaire, conséquence technique/SEO/GEO, importance concurrentielle.",
    "competitors": ["Nom Leader", "Nom Concurrent Direct", "Nom Challenger"]
  },
  "brand_authority": {
    "dna_analysis": "Analyse approfondie de l'ADN de marque et du positionnement perçu",
    "thought_leadership_score": 0-100,
    "entity_strength": "dominant|established|emerging|unknown"
  },
  "social_signals": {
    "proof_sources": [
      {"platform": "reddit|x|linkedin|youtube", "presence_level": "strong|moderate|weak|absent", "analysis": "Analyse de la présence"}
    ],
    "thought_leadership": {
      "founder_authority": "high|moderate|low|unknown",
      "entity_recognition": "Comment le fondateur/expert est-il reconnu?",
      "eeat_score": 0-10,
      "analysis": "Analyse E-E-A-T complète"
    },
    "sentiment": {
      "overall_polarity": "positive|mostly_positive|neutral|mixed|negative",
      "hallucination_risk": "low|medium|high",
      "reputation_vibration": "Analyse de la vibration réputationnelle"
    }
  },
  "market_intelligence": {
    "sophistication": {
      "level": 1-5,
      "description": "Description du niveau de sophistication du marché",
      "emotional_levers": ["Levier émotionnel 1", "Levier 2", "Levier 3"]
    },
    "semantic_gap": {
      "current_position": 0-100,
      "leader_position": 0-100,
      "gap_distance": 0-100,
      "priority_themes": ["Thème 1", "Thème 2", "Thème 3"],
      "closing_strategy": "Stratégie pour combler le gap sémantique"
    },
    "positioning_verdict": "Verdict final sur le positionnement marché"
  },
  "competitive_landscape": {
    "leader": {
      "name": "Nom du leader (Goliath)",
      "url": "URL du site",
      "authority_factor": "Facteur d'autorité principal",
      "analysis": "Analyse de la position dominante"
    },
    "direct_competitor": {
      "name": "Nom du concurrent direct",
      "url": "URL du site",
      "authority_factor": "Parité d'offre détectée",
      "analysis": "Analyse comparative"
    },
    "challenger": {
      "name": "Nom du challenger",
      "url": "URL du site",
      "authority_factor": "Facteur de disruption",
      "analysis": "Analyse de l'approche disruptive"
    },
    "inspiration_source": {
      "name": "Nom de la source d'inspiration (hors-secteur)",
      "url": "URL du site",
      "authority_factor": "Best practice à adopter",
      "analysis": "Pourquoi c'est un modèle à suivre"
    }
  },
  "geo_readiness": {
    "citability_score": 0-100,
    "semantic_gap_analysis": {
      "current_position": 0-100,
      "leader_position": 0-100,
      "gap_distance": 0-100,
      "priority_themes": ["Thème sémantique 1", "Thème 2"],
      "closing_strategy": "Stratégie de closing"
    },
    "ai_accessibility_score": 0-100,
    "performance_impact": "Impact de la performance sur la citabilité IA",
    "semantic_coherence": {
      "title_h1_alignment": 0-100,
      "verdict": "Verdict sur la cohérence sémantique Title/H1"
    }
  },
  "executive_roadmap": [
    {
      "title": "Titre de l'initiative stratégique",
      "prescriptive_action": "Paragraphe NARRATIF de 4-5 phrases décrivant en détail l'implémentation stratégique. Cette action doit être prescriptive et opérationnelle, expliquant le COMMENT avec précision. Inclure les étapes clés et les points d'attention. Ne pas être générique.",
      "strategic_rationale": "Explication de l'impact sur le CA, l'autorité de marque ou la citabilité IA",
      "expected_roi": "High|Medium|Low",
      "category": "Identité|Contenu|Autorité|Social|Technique",
      "priority": "Prioritaire|Important|Opportunité"
    }
  ],
  "executive_summary": "Synthèse exécutive de 3-4 phrases pour le CEO/CMO",
  "overallScore": 0-100
}

INSTRUCTIONS CRITIQUES:
- Ne jamais inventer d'URLs de concurrents irréelles, utilise des acteurs RÉELS du marché
- Si une donnée manque, déduis-la en fonction du secteur d'activité détecté
- L'executive_roadmap doit contenir MINIMUM 5 recommandations narratives
- Le score GEO (citability_score) reflète la capacité à être cité par ChatGPT, Gemini, Perplexity
- Chaque prescriptive_action doit être un paragraphe complet (4-5 phrases), pas une phrase courte
- Le JSON doit être pur, sans virgules traînantes, prêt pour JSON.parse()`;
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

    console.log('Generating PREMIUM strategic audit for:', domain);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-preview',
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

    // Robust JSON parsing with multiple fallback strategies
    let parsedAnalysis;
    try {
      let jsonContent = content;
      
      // Extract JSON from markdown code blocks
      if (content.includes('```json')) {
        jsonContent = content.split('```json')[1].split('```')[0].trim();
      } else if (content.includes('```')) {
        jsonContent = content.split('```')[1].split('```')[0].trim();
      }
      
      // Fix common JSON issues from AI responses
      jsonContent = jsonContent
        .replace(/,\s*}/g, '}')  // Remove trailing comma before }
        .replace(/,\s*]/g, ']') // Remove trailing comma before ]
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s+/g, ' ');
      
      parsedAnalysis = JSON.parse(jsonContent);
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', e);
      console.log('Raw content:', content.substring(0, 500));
      
      // Aggressive fallback: find JSON object boundaries
      try {
        const firstBrace = content.indexOf('{');
        const lastBrace = content.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          let jsonContent = content.substring(firstBrace, lastBrace + 1);
          jsonContent = jsonContent
            .replace(/,(\s*[\}\]])/g, '$1')
            .replace(/[\r\n]+/g, ' ')
            .replace(/\s+/g, ' ');
          parsedAnalysis = JSON.parse(jsonContent);
          console.log('Successfully parsed with aggressive cleanup');
        } else {
          throw new Error('No JSON object found in response');
        }
      } catch (e2) {
        console.error('Fallback parsing also failed:', e2);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to parse AI analysis' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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

    console.log('PREMIUM strategic audit completed successfully');

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
