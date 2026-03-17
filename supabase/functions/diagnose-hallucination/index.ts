import { corsHeaders } from '../_shared/cors.ts';
import { trackTokenUsage } from '../_shared/tokenTracker.ts';
import { getSiteContext } from '../_shared/getSiteContext.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

interface DetectedValues {
  sector: string;
  country: string;
  valueProposition: string;
  targetAudience: string;
  businessAge: string;
  businessType: string;
  mainProducts: string;
}

interface DiagnoseRequest {
  domain: string;
  coreValueSummary: string;
  action: 'extract' | 'compare';
  originalValues?: DetectedValues;
  correctedValues?: DetectedValues;
  lang: 'fr' | 'en' | 'es';
}

interface Discrepancy {
  field: string;
  original: string;
  corrected: string;
  impact: 'high' | 'medium' | 'low';
  explanation: string;
}

interface HallucinationRecommendation {
  id: string;
  category: 'metadata' | 'content' | 'schema' | 'authority';
  priority: 'critical' | 'important' | 'optional';
  title: string;
  description: string;
  codeSnippet?: string;
}

interface HallucinationDiagnosis {
  originalValues: DetectedValues;
  correctedValues: DetectedValues;
  discrepancies: Discrepancy[];
  confusionSources: string[];
  recommendations: HallucinationRecommendation[];
  analysisNarrative: string;
}

const translations = {
  fr: {
    extractSystemPrompt: `Tu es un expert en analyse de contenu web. Extrais les informations clés suivantes à partir du résumé d'un site web.

Tu dois retourner un JSON avec ces champs:
- sector: Le secteur d'activité (ex: "E-commerce", "SaaS", "Restauration")
- country: Le pays ou la zone géographique (ex: "France", "Europe")
- valueProposition: La proposition de valeur principale en 1-2 phrases
- targetAudience: L'audience cible (ex: "Particuliers 25-45 ans", "PME")
- businessAge: L'ancienneté estimée (ex: "Startup", "10+ ans")
- businessType: Le type d'entreprise (ex: "TPE", "PME", "Grande entreprise")
- mainProducts: Les produits/services principaux

Réponds UNIQUEMENT en JSON valide, sans markdown.`,

    extractUserPrompt: (domain: string, summary: string) =>
      `Analyse le site "${domain}".

Résumé disponible:
"${summary}"

Extrais les informations structurées en JSON.`,

    compareSystemPrompt: `Tu es un expert en GEO (Generative Engine Optimization) et en analyse de la perception des marques par les LLMs.

Ta mission: Comparer les informations détectées par l'IA avec les informations corrigées par l'utilisateur pour identifier:
1. Les incohérences et leur impact sur la visibilité IA
2. Les sources de confusion qui ont induit l'IA en erreur
3. Des recommandations concrètes pour corriger la perception

Tu dois retourner un JSON structuré avec:
- discrepancies: Array d'objets {field, original, corrected, impact: "high"|"medium"|"low", explanation}
- confusionSources: Array de strings décrivant les causes de confusion
- recommendations: Array d'objets {id, category: "metadata"|"content"|"schema"|"authority", priority: "critical"|"important"|"optional", title, description, codeSnippet?}
- analysisNarrative: Un paragraphe expliquant pourquoi l'IA s'est trompée et ce qu'il faut changer

Critères d'impact:
- high: Erreur sur le cœur de métier, le secteur, ou la proposition de valeur
- medium: Erreur sur la cible, le type d'entreprise, ou la zone géographique
- low: Erreur mineure ou imprécision

Réponds UNIQUEMENT en JSON valide.`,

    compareUserPrompt: (domain: string, original: DetectedValues, corrected: DetectedValues) =>
      `Analyse les écarts pour "${domain}".

VALEURS DÉTECTÉES PAR L'IA:
${JSON.stringify(original, null, 2)}

VALEURS CORRIGÉES PAR L'UTILISATEUR:
${JSON.stringify(corrected, null, 2)}

Compare ces deux versions et génère:
1. La liste des incohérences avec leur impact
2. Les sources de confusion (pourquoi l'IA s'est trompée)
3. Des recommandations techniques pour corriger la perception
4. Une analyse narrative expliquant le problème

Fournis un JSON complet.`
  },
  en: {
    extractSystemPrompt: `You are a web content analysis expert. Extract key information from a website summary.

Return a JSON with these fields:
- sector: Industry sector (e.g., "E-commerce", "SaaS", "Restaurant")
- country: Country or geographic area (e.g., "France", "Europe")
- valueProposition: Main value proposition in 1-2 sentences
- targetAudience: Target audience (e.g., "Adults 25-45", "SMBs")
- businessAge: Estimated age (e.g., "Startup", "10+ years")
- businessType: Business type (e.g., "Small business", "Enterprise")
- mainProducts: Main products/services

Respond ONLY with valid JSON, no markdown.`,

    extractUserPrompt: (domain: string, summary: string) =>
      `Analyze the site "${domain}".

Available summary:
"${summary}"

Extract structured information as JSON.`,

    compareSystemPrompt: `You are a GEO (Generative Engine Optimization) expert analyzing how LLMs perceive brands.

Your mission: Compare AI-detected information with user-corrected information to identify:
1. Discrepancies and their impact on AI visibility
2. Confusion sources that misled the AI
3. Concrete recommendations to correct perception

Return a structured JSON with:
- discrepancies: Array of {field, original, corrected, impact: "high"|"medium"|"low", explanation}
- confusionSources: Array of strings describing confusion causes
- recommendations: Array of {id, category: "metadata"|"content"|"schema"|"authority", priority: "critical"|"important"|"optional", title, description, codeSnippet?}
- analysisNarrative: A paragraph explaining why AI was wrong and what to change

Impact criteria:
- high: Error on core business, sector, or value proposition
- medium: Error on target, business type, or geographic area
- low: Minor error or imprecision

Respond ONLY with valid JSON.`,

    compareUserPrompt: (domain: string, original: DetectedValues, corrected: DetectedValues) =>
      `Analyze discrepancies for "${domain}".

AI-DETECTED VALUES:
${JSON.stringify(original, null, 2)}

USER-CORRECTED VALUES:
${JSON.stringify(corrected, null, 2)}

Compare these versions and generate:
1. List of discrepancies with their impact
2. Confusion sources (why AI was wrong)
3. Technical recommendations to correct perception
4. Narrative analysis explaining the problem

Provide complete JSON.`
  },
  es: {
    extractSystemPrompt: `Eres un experto en análisis de contenido web. Extrae información clave de un resumen de sitio web.

Devuelve un JSON con estos campos:
- sector: Sector de actividad (ej: "E-commerce", "SaaS", "Restauración")
- country: País o zona geográfica (ej: "España", "Europa")
- valueProposition: Propuesta de valor principal en 1-2 frases
- targetAudience: Audiencia objetivo (ej: "Particulares 25-45 años", "PYMES")
- businessAge: Antigüedad estimada (ej: "Startup", "10+ años")
- businessType: Tipo de empresa (ej: "Pequeña empresa", "Gran empresa")
- mainProducts: Productos/servicios principales

Responde ÚNICAMENTE con JSON válido, sin markdown.`,

    extractUserPrompt: (domain: string, summary: string) =>
      `Analiza el sitio "${domain}".

Resumen disponible:
"${summary}"

Extrae la información estructurada en JSON.`,

    compareSystemPrompt: `Eres un experto en GEO (Generative Engine Optimization) analizando cómo los LLMs perciben las marcas.

Tu misión: Comparar información detectada por IA con información corregida por el usuario para identificar:
1. Discrepancias y su impacto en la visibilidad IA
2. Fuentes de confusión que engañaron a la IA
3. Recomendaciones concretas para corregir la percepción

Devuelve un JSON estructurado con:
- discrepancies: Array de {field, original, corrected, impact: "high"|"medium"|"low", explanation}
- confusionSources: Array de strings describiendo causas de confusión
- recommendations: Array de {id, category: "metadata"|"content"|"schema"|"authority", priority: "critical"|"important"|"optional", title, description, codeSnippet?}
- analysisNarrative: Un párrafo explicando por qué la IA se equivocó y qué cambiar

Criterios de impacto:
- high: Error en negocio principal, sector o propuesta de valor
- medium: Error en target, tipo de empresa o zona geográfica
- low: Error menor o imprecisión

Responde ÚNICAMENTE con JSON válido.`,

    compareUserPrompt: (domain: string, original: DetectedValues, corrected: DetectedValues) =>
      `Analiza las discrepancias para "${domain}".

VALORES DETECTADOS POR IA:
${JSON.stringify(original, null, 2)}

VALORES CORREGIDOS POR EL USUARIO:
${JSON.stringify(corrected, null, 2)}

Compara estas versiones y genera:
1. Lista de discrepancias con su impacto
2. Fuentes de confusión (por qué la IA se equivocó)
3. Recomendaciones técnicas para corregir la percepción
4. Análisis narrativo explicando el problema

Proporciona JSON completo.`
  }
};

function sanitizeJsonResponse(content: string): string {
  // Remove markdown code blocks
  let jsonStr = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }
  
  // Find the first { and last }
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
  }
  
  // Remove trailing commas before ] or }
  jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
  
  return jsonStr.trim();
}

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 3000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI gateway error:', response.status, errorText);
    
    if (response.status === 429) {
      throw new Error('RATE_LIMIT');
    }
    if (response.status === 402) {
      throw new Error('CREDITS_EXHAUSTED');
    }
    
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const data = await response.json();
  trackTokenUsage('diagnose-hallucination', 'google/gemini-2.5-flash', data.usage);
  return data.choices?.[0]?.message?.content || '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: DiagnoseRequest = await req.json();
    const { domain, coreValueSummary, action, originalValues, correctedValues, lang = 'fr' } = body;

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

    // ── Fetch site identity card for enrichment ──
    let identityHint = '';
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      const ctx = await getSiteContext(supabase, { domain });
      if (ctx) {
        const parts: string[] = [];
        if (ctx.market_sector) parts.push(`Sector: ${ctx.market_sector}`);
        if (ctx.products_services) parts.push(`Products/Services: ${ctx.products_services}`);
        if (ctx.target_audience) parts.push(`Target: ${ctx.target_audience}`);
        if (ctx.commercial_area) parts.push(`Area: ${ctx.commercial_area}`);
        if (parts.length > 0) identityHint = `\n\nVerified site identity:\n${parts.join('\n')}`;
        console.log(`[diagnose-hallucination] Site context loaded (confidence: ${ctx.identity_confidence || 0})`);
      }
    } catch (e) {
      console.warn('[diagnose-hallucination] Could not fetch site context:', e);
    }

    // === ACTION: EXTRACT ===
    if (action === 'extract') {
      console.log(`[Diagnose] Extracting values for: ${domain}`);

      const content = await callAI(
        t.extractSystemPrompt,
        t.extractUserPrompt(domain, coreValueSummary + identityHint)
      );

      let extractedValues: DetectedValues;
      try {
        const jsonStr = sanitizeJsonResponse(content);
        extractedValues = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('Failed to parse extract response:', content);
        // Return empty values as fallback
        extractedValues = {
          sector: '',
          country: '',
          valueProposition: coreValueSummary?.substring(0, 200) || '',
          targetAudience: '',
          businessAge: '',
          businessType: '',
          mainProducts: '',
        };
      }

      console.log(`[Diagnose] Extracted values for ${domain}`);

      return new Response(
        JSON.stringify({ success: true, extractedValues }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === ACTION: COMPARE ===
    if (action === 'compare') {
      if (!originalValues || !correctedValues) {
        return new Response(
          JSON.stringify({ success: false, error: 'Original and corrected values are required for comparison' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[Diagnose] Comparing values for: ${domain}`);

      const content = await callAI(
        t.compareSystemPrompt,
        t.compareUserPrompt(domain, originalValues, correctedValues)
      );

      let diagnosis: HallucinationDiagnosis;
      try {
        const jsonStr = sanitizeJsonResponse(content);
        const parsed = JSON.parse(jsonStr);
        
        diagnosis = {
          originalValues,
          correctedValues,
          discrepancies: parsed.discrepancies || [],
          confusionSources: parsed.confusionSources || [],
          recommendations: parsed.recommendations || [],
          analysisNarrative: parsed.analysisNarrative || '',
        };
      } catch (parseError) {
        console.error('Failed to parse compare response:', content);
        
        // Generate fallback based on actual differences
        const discrepancies: Discrepancy[] = [];
        const fields: (keyof DetectedValues)[] = ['sector', 'country', 'valueProposition', 'targetAudience', 'businessAge', 'businessType', 'mainProducts'];
        
        for (const field of fields) {
          if (originalValues[field] !== correctedValues[field] && correctedValues[field]) {
            discrepancies.push({
              field,
              original: originalValues[field] || '(non détecté)',
              corrected: correctedValues[field],
              impact: field === 'valueProposition' || field === 'sector' ? 'high' : 'medium',
              explanation: `L'IA avait détecté "${originalValues[field] || 'aucune valeur'}" mais la réalité est "${correctedValues[field]}".`
            });
          }
        }

        diagnosis = {
          originalValues,
          correctedValues,
          discrepancies,
          confusionSources: discrepancies.length > 0 
            ? ['Contenu de page insuffisant', 'Métadonnées imprécises', 'Manque de données structurées']
            : [],
          recommendations: discrepancies.length > 0 
            ? [{
                id: 'add-schema',
                category: 'schema',
                priority: 'critical',
                title: 'Ajouter des données structurées',
                description: 'Injectez du JSON-LD avec les informations correctes pour guider les LLM.',
              }]
            : [],
          analysisNarrative: discrepancies.length > 0
            ? `L'IA a commis ${discrepancies.length} erreur(s) d'interprétation sur votre site. Ces erreurs sont probablement dues à un manque de clarté dans vos métadonnées et l'absence de données structurées explicites.`
            : 'Aucune incohérence majeure détectée entre la perception IA et la réalité.',
        };
      }

      console.log(`[Diagnose] Comparison complete for ${domain}: ${diagnosis.discrepancies.length} discrepancies found`);

      return new Response(
        JSON.stringify({ success: true, diagnosis }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Legacy action (backward compatibility)
    console.log(`[Diagnose] Legacy action for: ${domain}`);
    
    const content = await callAI(
      t.extractSystemPrompt,
      t.extractUserPrompt(domain, coreValueSummary)
    );

    let result;
    try {
      const jsonStr = sanitizeJsonResponse(content);
      result = JSON.parse(jsonStr);
    } catch {
      result = {
        trueValue: `Unable to determine the exact value proposition for ${domain}.`,
        hallucinationAnalysis: 'Analysis parsing failed.',
        confusionSources: ['Insufficient structured data'],
        recommendations: ['Add comprehensive Schema.org markup'],
      };
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error diagnosing hallucination:', err);
    
    if (err.message === 'RATE_LIMIT') {
      return new Response(
        JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (err.message === 'CREDITS_EXHAUSTED') {
      return new Response(
        JSON.stringify({ success: false, error: 'AI credits exhausted. Please add credits.' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Diagnosis failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
