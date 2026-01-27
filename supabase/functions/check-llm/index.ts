import { getLLMTranslations, parseLanguage, type Language } from '../_shared/translations.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LLMProvider {
  id: string;
  name: string;
  company: string;
  model: string;
}

const LLM_PROVIDERS: LLMProvider[] = [
  { id: 'gpt4', name: 'GPT-4', company: 'OpenAI', model: 'openai/gpt-4-turbo' },
  { id: 'gpt4o', name: 'GPT-4o', company: 'OpenAI', model: 'openai/gpt-4o' },
  { id: 'claude35', name: 'Claude 3.5 Sonnet', company: 'Anthropic', model: 'anthropic/claude-3.5-sonnet' },
  { id: 'claude3opus', name: 'Claude 3 Opus', company: 'Anthropic', model: 'anthropic/claude-3-opus' },
  { id: 'gemini', name: 'Gemini Pro', company: 'Google', model: 'google/gemini-pro-1.5' },
  { id: 'gemini2', name: 'Gemini 2.0', company: 'Google', model: 'google/gemini-2.0-flash-001' },
  { id: 'perplexity', name: 'Perplexity AI', company: 'Perplexity', model: 'perplexity/llama-3.1-sonar-large-128k-online' },
  { id: 'mistral', name: 'Mistral Large', company: 'Mistral AI', model: 'mistralai/mistral-large' },
];

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace('www.', '');
  } catch {
    return url.replace('www.', '');
  }
}

interface LLMResponse {
  cited: boolean;
  sentiment: 'positive' | 'neutral' | 'negative';
  recommends: boolean;
  summary: string;
  coreValueMatch: boolean;
  hallucinations?: string[];
}

// Prompts traduits par langue
const llmPrompts: Record<Language, (domain: string) => string> = {
  fr: (domain) => `Tu analyses le site web/marque "${domain}". Réponds à ces questions au format JSON :

1. Connais-tu ce site web/cette marque ? (cited: true/false)
2. Quel est ton sentiment général sur ce site ? (sentiment: "positive", "neutral", ou "negative")
3. Recommanderais-tu ce site aux utilisateurs recherchant ses services ? (recommends: true/false)
4. Fournis un bref résumé en 1-2 phrases de ce que tu sais sur ce site. (summary: string - RÉPONDS EN FRANÇAIS)
5. Comprends-tu correctement l'objectif principal/la proposition de valeur de ce site ? (coreValueMatch: true/false)
6. Liste les éventuelles inexactitudes ou hallucinations dans tes connaissances sur ce site. (hallucinations: array de strings en français, vide si aucune)

Réponds UNIQUEMENT avec du JSON valide dans ce format exact :
{
  "cited": boolean,
  "sentiment": "positive" | "neutral" | "negative",
  "recommends": boolean,
  "summary": "string en français",
  "coreValueMatch": boolean,
  "hallucinations": ["string"] ou []
}`,
  en: (domain) => `You are analyzing the website/brand "${domain}". Answer these questions in JSON format:

1. Are you aware of this website/brand? (cited: true/false)
2. What is your overall sentiment about this site? (sentiment: "positive", "neutral", or "negative")
3. Would you recommend this site to users looking for its services? (recommends: true/false)
4. Provide a brief 1-2 sentence summary of what you know about this site. (summary: string - RESPOND IN ENGLISH)
5. Do you understand the core purpose/value proposition of this site correctly? (coreValueMatch: true/false)
6. List any potential inaccuracies or hallucinations in your knowledge about this site. (hallucinations: array of strings, empty if none)

Respond ONLY with valid JSON in this exact format:
{
  "cited": boolean,
  "sentiment": "positive" | "neutral" | "negative",
  "recommends": boolean,
  "summary": "string in English",
  "coreValueMatch": boolean,
  "hallucinations": ["string"] or []
}`,
  es: (domain) => `Estás analizando el sitio web/marca "${domain}". Responde a estas preguntas en formato JSON:

1. ¿Conoces este sitio web/marca? (cited: true/false)
2. ¿Cuál es tu sentimiento general sobre este sitio? (sentiment: "positive", "neutral", o "negative")
3. ¿Recomendarías este sitio a usuarios que buscan sus servicios? (recommends: true/false)
4. Proporciona un breve resumen de 1-2 oraciones de lo que sabes sobre este sitio. (summary: string - RESPONDE EN ESPAÑOL)
5. ¿Comprendes correctamente el propósito principal/propuesta de valor de este sitio? (coreValueMatch: true/false)
6. Lista cualquier inexactitud potencial o alucinación en tu conocimiento sobre este sitio. (hallucinations: array de strings en español, vacío si no hay ninguna)

Responde ÚNICAMENTE con JSON válido en este formato exacto:
{
  "cited": boolean,
  "sentiment": "positive" | "neutral" | "negative",
  "recommends": boolean,
  "summary": "string en español",
  "coreValueMatch": boolean,
  "hallucinations": ["string"] o []
}`
};

async function queryLLM(
  apiKey: string,
  model: string,
  domain: string,
  lang: Language
): Promise<LLMResponse> {
  const t = getLLMTranslations(lang);
  const prompt = llmPrompts[lang](domain);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://crawlers.lovable.app',
        'X-Title': 'Crawlers.fr - LLM Visibility Analyzer',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error from ${model}:`, response.status, errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in response');
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonStr.trim());

    return {
      cited: Boolean(parsed.cited),
      sentiment: parsed.sentiment || 'neutral',
      recommends: Boolean(parsed.recommends),
      summary: parsed.summary || `Analysis of ${domain}`,
      coreValueMatch: Boolean(parsed.coreValueMatch),
      hallucinations: Array.isArray(parsed.hallucinations) ? parsed.hallucinations : [],
    };
  } catch (error) {
    console.error(`Failed to query ${model}:`, error);
    // Return a "not cited" response on error
    return {
      cited: false,
      sentiment: 'neutral',
      recommends: false,
      summary: t.unableToRetrieve(domain),
      coreValueMatch: false,
      hallucinations: [],
    };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, lang: requestLang } = await req.json();
    const lang = parseLanguage(requestLang);
    const t = getLLMTranslations(lang);

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'OpenRouter API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const domain = extractDomain(url);
    console.log(`Analyzing LLM visibility for: ${domain}`);

    // Query all LLMs in parallel
    const citationPromises = LLM_PROVIDERS.map(async (provider) => {
      console.log(`Querying ${provider.name} (${provider.model})...`);
      const startTime = Date.now();
      const result = await queryLLM(apiKey, provider.model, domain, lang);
      const iterationDepth = result.cited ? Math.ceil((Date.now() - startTime) / 1000) : 0;

      return {
        provider: {
          id: provider.id,
          name: provider.name,
          company: provider.company,
        },
        cited: result.cited,
        iterationDepth: Math.min(iterationDepth, 5), // Cap at 5
        sentiment: result.sentiment,
        recommends: result.recommends,
        coreValueMatch: result.coreValueMatch,
        summary: result.summary,
        hallucinations: result.hallucinations?.length ? result.hallucinations : undefined,
      };
    });

    const citations = await Promise.all(citationPromises);

    // Calculate metrics
    const citedCount = citations.filter(c => c.cited).length;
    const invisibleList = citations.filter(c => !c.cited).map(c => c.provider);

    const avgIterationDepth = citedCount > 0
      ? citations.filter(c => c.cited).reduce((sum, c) => sum + c.iterationDepth, 0) / citedCount
      : 0;

    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    citations.filter(c => c.cited).forEach(c => sentimentCounts[c.sentiment]++);

    let overallSentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (sentimentCounts.positive > sentimentCounts.negative && sentimentCounts.positive > sentimentCounts.neutral) {
      overallSentiment = 'positive';
    } else if (sentimentCounts.negative > sentimentCounts.positive) {
      overallSentiment = 'negative';
    }

    const overallRecommendation = citations.filter(c => c.recommends).length > citations.length / 2;

    // Calculate overall score
    const citationScore = (citedCount / LLM_PROVIDERS.length) * 40;
    const sentimentScore = overallSentiment === 'positive' ? 30 : overallSentiment === 'neutral' ? 15 : 0;
    const recommendationScore = overallRecommendation ? 20 : 0;
    const coreValueScore = citations.filter(c => c.coreValueMatch).length / LLM_PROVIDERS.length * 10;

    const overallScore = Math.round(citationScore + sentimentScore + recommendationScore + coreValueScore);

    // Generate core value summary with translations
    const citedSummaries = citations.filter(c => c.cited).map(c => c.summary);
    let coreValueSummary: string;
    
    if (citedCount > 0) {
      const perceptionText = overallSentiment === 'positive'
        ? t.coreValueSummary.positivePerception
        : overallSentiment === 'negative'
        ? t.coreValueSummary.negativePerception
        : t.coreValueSummary.neutralPerception;
      
      coreValueSummary = `${t.coreValueSummary.basedOn(citedCount)} ${citedSummaries[0]} ${perceptionText}`;
    } else {
      coreValueSummary = t.coreValueSummary.lowVisibility(domain);
    }

    const result = {
      url: `https://${domain}`,
      domain,
      scannedAt: new Date().toISOString(),
      overallScore,
      citationRate: {
        cited: citedCount,
        total: LLM_PROVIDERS.length,
      },
      invisibleList,
      averageIterationDepth: Math.round(avgIterationDepth * 10) / 10,
      overallSentiment,
      overallRecommendation,
      coreValueSummary,
      citations,
    };

    console.log(`Analysis complete. Score: ${result.overallScore}/100, Citations: ${result.citationRate.cited}/${result.citationRate.total}`);

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error analyzing LLM visibility:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Analysis failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
