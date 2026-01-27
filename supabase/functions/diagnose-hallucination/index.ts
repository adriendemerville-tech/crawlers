import { corsHeaders } from '../_shared/cors.ts';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

interface DiagnoseRequest {
  domain: string;
  coreValueSummary: string;
  hallucinations: string[];
  lang: 'fr' | 'en' | 'es';
}

const translations = {
  fr: {
    systemPrompt: `Tu es un expert en SEO, GEO (Generative Engine Optimization) et en analyse de la perception des marques par les LLMs.
    
Ta mission est d'analyser pourquoi les LLMs ont des hallucinations ou une mauvaise compréhension d'un site/marque, et de proposer des solutions concrètes.

Tu dois retourner un JSON structuré avec:
1. "trueValue": La vraie proposition de valeur du site (en te basant sur le domaine et ce qu'on peut en déduire)
2. "hallucinationAnalysis": Analyse détaillée de chaque hallucination détectée
3. "confusionSources": Les sources potentielles de confusion pour les LLMs (noms similaires, manque de données structurées, faible présence web, etc.)
4. "recommendations": Actions concrètes pour corriger les hallucinations et améliorer la perception

Réponds UNIQUEMENT en JSON valide.`,
    userPrompt: (domain: string, summary: string, hallucinations: string[]) => 
      `Analyse le site "${domain}".

Résumé actuel perçu par les LLMs: "${summary}"

Hallucinations détectées:
${hallucinations.length > 0 ? hallucinations.map(h => `- ${h}`).join('\n') : '- Aucune hallucination explicite, mais la perception peut être incorrecte'}

Fournis une analyse complète en JSON avec: trueValue, hallucinationAnalysis, confusionSources (array), recommendations (array).`
  },
  en: {
    systemPrompt: `You are an expert in SEO, GEO (Generative Engine Optimization) and LLM brand perception analysis.

Your mission is to analyze why LLMs have hallucinations or misunderstanding about a website/brand, and propose concrete solutions.

You must return a structured JSON with:
1. "trueValue": The true value proposition of the site (based on the domain and what can be inferred)
2. "hallucinationAnalysis": Detailed analysis of each detected hallucination
3. "confusionSources": Potential sources of confusion for LLMs (similar names, lack of structured data, weak web presence, etc.)
4. "recommendations": Concrete actions to correct hallucinations and improve perception

Respond ONLY with valid JSON.`,
    userPrompt: (domain: string, summary: string, hallucinations: string[]) =>
      `Analyze the site "${domain}".

Current summary perceived by LLMs: "${summary}"

Detected hallucinations:
${hallucinations.length > 0 ? hallucinations.map(h => `- ${h}`).join('\n') : '- No explicit hallucinations, but perception may be incorrect'}

Provide a complete analysis in JSON with: trueValue, hallucinationAnalysis, confusionSources (array), recommendations (array).`
  },
  es: {
    systemPrompt: `Eres un experto en SEO, GEO (Generative Engine Optimization) y análisis de percepción de marca por LLMs.

Tu misión es analizar por qué los LLMs tienen alucinaciones o malentendidos sobre un sitio/marca, y proponer soluciones concretas.

Debes devolver un JSON estructurado con:
1. "trueValue": La verdadera propuesta de valor del sitio (basándote en el dominio y lo que se puede inferir)
2. "hallucinationAnalysis": Análisis detallado de cada alucinación detectada
3. "confusionSources": Fuentes potenciales de confusión para los LLMs (nombres similares, falta de datos estructurados, débil presencia web, etc.)
4. "recommendations": Acciones concretas para corregir las alucinaciones y mejorar la percepción

Responde ÚNICAMENTE con JSON válido.`,
    userPrompt: (domain: string, summary: string, hallucinations: string[]) =>
      `Analiza el sitio "${domain}".

Resumen actual percibido por los LLMs: "${summary}"

Alucinaciones detectadas:
${hallucinations.length > 0 ? hallucinations.map(h => `- ${h}`).join('\n') : '- Sin alucinaciones explícitas, pero la percepción puede ser incorrecta'}

Proporciona un análisis completo en JSON con: trueValue, hallucinationAnalysis, confusionSources (array), recommendations (array).`
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain, coreValueSummary, hallucinations, lang = 'fr' }: DiagnoseRequest = await req.json();

    if (!domain) {
      return new Response(
        JSON.stringify({ success: false, error: 'Domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const t = translations[lang] || translations.fr;

    console.log(`Diagnosing hallucinations for: ${domain}`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: t.systemPrompt },
          { role: 'user', content: t.userPrompt(domain, coreValueSummary, hallucinations || []) }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
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
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    let diagnosis;
    try {
      diagnosis = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      // Return a structured fallback
      diagnosis = {
        trueValue: `Unable to determine the exact value proposition for ${domain}. Manual verification recommended.`,
        hallucinationAnalysis: 'AI response parsing failed.',
        confusionSources: ['Insufficient structured data', 'Limited web presence'],
        recommendations: [
          'Add comprehensive Schema.org markup',
          'Improve meta descriptions and title tags',
          'Create authoritative backlinks from trusted sources',
          'Ensure consistent brand messaging across all platforms'
        ]
      };
    }

    console.log(`Diagnosis complete for ${domain}`);

    return new Response(
      JSON.stringify({ success: true, data: diagnosis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error diagnosing hallucination:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Diagnosis failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
