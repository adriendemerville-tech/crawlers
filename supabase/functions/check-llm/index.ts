import { getLLMTranslations, parseLanguage, type Language } from '../_shared/translations.ts';
import { trackTokenUsage, trackPaidApiCall, trackEdgeFunctionError } from '../_shared/tokenTracker.ts';
import { trackAnalyzedUrl } from '../_shared/trackUrl.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { checkIpRate, getClientIp, rateLimitResponse, acquireConcurrency, releaseConcurrency, concurrencyResponse } from '../_shared/ipRateLimiter.ts';
import { checkFairUse, getUserContext } from '../_shared/fairUse.ts';
import { getSiteContext, extractDomain as extractDomainHelper } from '../_shared/getSiteContext.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';

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
  { id: 'claude3opus', name: 'Claude 3.7 Sonnet', company: 'Anthropic', model: 'anthropic/claude-3.7-sonnet' },
  { id: 'gemini', name: 'Gemini 2.5 Pro', company: 'Google', model: 'google/gemini-2.5-pro-preview' },
  { id: 'gemini2', name: 'Gemini 2.0 Flash', company: 'Google', model: 'google/gemini-2.0-flash-001' },
  { id: 'perplexity', name: 'Perplexity Sonar', company: 'Perplexity', model: 'perplexity/sonar' },
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

type SentimentType = 'positive' | 'mostly_positive' | 'neutral' | 'mixed' | 'negative';

interface LLMResponse {
  cited: boolean;
  sentiment: SentimentType;
  recommends: boolean;
  summary: string;
  coreValueMatch: boolean;
  hallucinations?: string[];
}

// Helper function for delay between API calls
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Prompts traduits par langue avec 5 niveaux de sentiment (descriptions améliorées)
const llmPrompts: Record<Language, (domain: string, siteContext?: string) => string> = {
  fr: (domain, siteContext) => `Tu analyses le site web/marque "${domain}".${siteContext ? `\n\nContexte vérifié sur ce site :\n${siteContext}` : ''}\nRéponds à ces questions au format JSON :

1. Connais-tu ce site web/cette marque ? (cited: true/false)
2. Quel est ton sentiment général sur ce site ? Choisis EXACTEMENT l'une de ces 5 valeurs :
   - "positive" : Excellent, recommandé sans aucune réserve, très bonne réputation
   - "mostly_positive" : Bon service/produit mais avec quelques critiques mineures ou petits défauts
   - "neutral" : Pas d'opinion particulière, manque d'informations pour juger
   - "mixed" : Avis très partagés, polémiques, controverses (ex: bon produit mais mauvais support client)
   - "negative" : Mauvais, problèmes significatifs détectés, mauvaise réputation
   (sentiment: "positive" | "mostly_positive" | "neutral" | "mixed" | "negative")
3. Recommanderais-tu ce site aux utilisateurs recherchant ses services ? (recommends: true/false)
4. Fournis un bref résumé en 1-2 phrases de ce que tu sais sur ce site. (summary: string - RÉPONDS EN FRANÇAIS)
5. Comprends-tu correctement l'objectif principal/la proposition de valeur de ce site ? (coreValueMatch: true/false)
6. Liste les éventuelles inexactitudes ou hallucinations dans tes connaissances sur ce site. (hallucinations: array de strings en français, vide si aucune)

IMPORTANT : Réponds UNIQUEMENT avec du JSON valide, sans texte avant ou après. Format exact :
{
  "cited": boolean,
  "sentiment": "positive" | "mostly_positive" | "neutral" | "mixed" | "negative",
  "recommends": boolean,
  "summary": "string en français",
  "coreValueMatch": boolean,
  "hallucinations": ["string"] ou []
}`,
  en: (domain, siteContext) => `You are analyzing the website/brand "${domain}".${siteContext ? `\n\nVerified context about this site:\n${siteContext}` : ''}\nAnswer these questions in JSON format:

1. Are you aware of this website/brand? (cited: true/false)
2. What is your overall sentiment about this site? Choose EXACTLY one of these 5 values:
   - "positive": Excellent, recommended without any reservation, very good reputation
   - "mostly_positive": Good service/product but with some minor criticisms or small flaws
   - "neutral": No particular opinion, lack of information to judge
   - "mixed": Very divided opinions, controversies, polarizing (e.g., good product but bad customer support)
   - "negative": Bad, significant problems detected, poor reputation
   (sentiment: "positive" | "mostly_positive" | "neutral" | "mixed" | "negative")
3. Would you recommend this site to users looking for its services? (recommends: true/false)
4. Provide a brief 1-2 sentence summary of what you know about this site. (summary: string - RESPOND IN ENGLISH)
5. Do you understand the core purpose/value proposition of this site correctly? (coreValueMatch: true/false)
6. List any potential inaccuracies or hallucinations in your knowledge about this site. (hallucinations: array of strings, empty if none)

IMPORTANT: Respond ONLY with valid JSON, no text before or after. Exact format:
{
  "cited": boolean,
  "sentiment": "positive" | "mostly_positive" | "neutral" | "mixed" | "negative",
  "recommends": boolean,
  "summary": "string in English",
  "coreValueMatch": boolean,
  "hallucinations": ["string"] or []
}`,
  es: (domain, siteContext) => `Estás analizando el sitio web/marca "${domain}".${siteContext ? `\n\nContexto verificado sobre este sitio:\n${siteContext}` : ''}\nResponde a estas preguntas en formato JSON:

1. ¿Conoces este sitio web/marca? (cited: true/false)
2. ¿Cuál es tu sentimiento general sobre este sitio? Elige EXACTAMENTE uno de estos 5 valores:
   - "positive": Excelente, recomendado sin ninguna reserva, muy buena reputación
   - "mostly_positive": Buen servicio/producto pero con algunas críticas menores o pequeños defectos
   - "neutral": Sin opinión particular, falta de información para juzgar
   - "mixed": Opiniones muy divididas, controversias, polarizante (ej: buen producto pero mal soporte)
   - "negative": Malo, problemas significativos detectados, mala reputación
   (sentiment: "positive" | "mostly_positive" | "neutral" | "mixed" | "negative")
3. ¿Recomendarías este sitio a usuarios que buscan sus servicios? (recommends: true/false)
4. Proporciona un breve resumen de 1-2 oraciones de lo que sabes sobre este sitio. (summary: string - RESPONDE EN ESPAÑOL)
5. ¿Comprendes correctamente el propósito principal/propuesta de valor de este sitio? (coreValueMatch: true/false)
6. Lista cualquier inexactitud potencial o alucinación en tu conocimiento sobre este sitio. (hallucinations: array de strings en español, vacío si no hay ninguna)

IMPORTANTE: Responde ÚNICAMENTE con JSON válido, sin texto antes o después. Formato exacto:
{
  "cited": boolean,
  "sentiment": "positive" | "mostly_positive" | "neutral" | "mixed" | "negative",
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
  lang: Language,
  correctionContext: string = '',
  siteContextStr: string = ''
): Promise<LLMResponse> {
  const t = getLLMTranslations(lang);
  const prompt = llmPrompts[lang](domain, siteContextStr) + correctionContext;

  try {
    // Individual 8s timeout per LLM to prevent one slow provider from blocking all
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      signal: controller.signal,
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

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error from ${model}:`, response.status, errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    // Track token usage
    trackTokenUsage('check-llm', model, data.usage, domain);
    trackPaidApiCall('check-llm', 'openrouter', model, domain);

    if (!content) {
      throw new Error('No content in response');
    }

    // Parse JSON from response (handle markdown code blocks and extra text)
    let jsonStr = content.trim();
    // Strip markdown fences aggressively
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
    // Fallback: extract JSON by finding first { and last }
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(jsonStr.trim());

    // Validate sentiment is one of the 5 valid values (with strict validation)
    const validSentiments: SentimentType[] = ['positive', 'mostly_positive', 'neutral', 'mixed', 'negative'];
    const rawSentiment = String(parsed.sentiment || '').toLowerCase().trim();
    const sentiment: SentimentType = validSentiments.includes(rawSentiment as SentimentType) 
      ? (rawSentiment as SentimentType)
      : 'neutral';

    return {
      cited: Boolean(parsed.cited),
      sentiment,
      recommends: Boolean(parsed.recommends),
      summary: parsed.summary || `Analysis of ${domain}`,
      coreValueMatch: Boolean(parsed.coreValueMatch),
      hallucinations: Array.isArray(parsed.hallucinations) ? parsed.hallucinations : [],
    };
  } catch (error) {
    console.error(`Failed to query ${model}:`, error);
    // Return an error response — will be treated as neutral (not counted in score)
    return {
      cited: false,
      sentiment: 'neutral' as SentimentType,
      recommends: false,
      summary: t.unableToRetrieve(domain),
      coreValueMatch: false,
      hallucinations: [],
      error: true,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ── IP Rate Limit ──
  const clientIp = getClientIp(req);
  const ipCheck = checkIpRate(clientIp, 'check-llm', 10, 60_000);
  if (!ipCheck.allowed) return rateLimitResponse(corsHeaders, ipCheck.retryAfterMs);

  if (!acquireConcurrency('check-llm', 30)) return concurrencyResponse(corsHeaders);

  try {
    // ── Fair Use ──
    const userCtx = await getUserContext(req);
    if (userCtx) {
      const fairUse = await checkFairUse(userCtx.userId, 'llm_check', userCtx.planType);
      if (!fairUse.allowed) {
        releaseConcurrency('check-llm');
        return new Response(JSON.stringify({ success: false, error: fairUse.reason }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    const { url, lang: requestLang, correction } = await req.json();
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
    const correctionContext = correction ? `\n\nIMPORTANT CORRECTION FROM THE SITE OWNER: "${correction}". Take this into account in your analysis.` : '';
    console.log(`Analyzing LLM visibility for: ${domain}${correction ? ' (with user correction)' : ''}`);

    // ── Fetch site identity card (enriches if needed) ──
    let siteContextStr = '';
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      const ctx = await getSiteContext(supabase, { domain });
      if (ctx) {
        const parts: string[] = [];
        if (ctx.market_sector) parts.push(`Secteur: ${ctx.market_sector}`);
        if (ctx.products_services) parts.push(`Produits/Services: ${ctx.products_services}`);
        if (ctx.target_audience) parts.push(`Cible: ${ctx.target_audience}`);
        if (ctx.commercial_area) parts.push(`Zone: ${ctx.commercial_area}`);
        if (parts.length > 0) siteContextStr = parts.join('\n');
        console.log(`[check-llm] Site context loaded (confidence: ${ctx.identity_confidence || 0})`);
      }
    } catch (e) {
      console.warn('[check-llm] Could not fetch site context:', e);
    }

    // Query all LLMs with staggered delays to avoid 429 rate limiting
    const citationPromises = LLM_PROVIDERS.map(async (provider, index) => {
      // Stagger requests by 250ms each to avoid overwhelming OpenRouter
      await delay(index * 250);
      console.log(`Querying ${provider.name} (${provider.model})...`);
      const startTime = Date.now();
      const result = await queryLLM(apiKey, provider.model, domain, lang, correctionContext, siteContextStr);
      const iterationDepth = result.cited ? Math.ceil((Date.now() - startTime) / 1000) : 0;

      return {
        provider: {
          id: provider.id,
          name: provider.name,
          company: provider.company,
        },
        cited: result.cited,
        iterationDepth: Math.min(iterationDepth, 5),
        sentiment: result.sentiment,
        recommends: result.recommends,
        coreValueMatch: result.coreValueMatch,
        summary: result.summary,
        hallucinations: result.hallucinations?.length ? result.hallucinations : undefined,
        ...(result.error ? { error: true } : {}),
      };
    });

    // Use Promise.allSettled to prevent one failed provider from crashing all
    const settled = await Promise.allSettled(citationPromises);
    const citations = settled.map((result, index) => {
      if (result.status === 'fulfilled') return result.value;
      console.warn(`[check-llm] Provider ${LLM_PROVIDERS[index].name} rejected:`, result.reason);
      return {
        provider: { id: LLM_PROVIDERS[index].id, name: LLM_PROVIDERS[index].name, company: LLM_PROVIDERS[index].company },
        cited: false, iterationDepth: 0, sentiment: 'neutral' as SentimentType,
        recommends: false, coreValueMatch: false, summary: `Unable to query ${LLM_PROVIDERS[index].name}`,
        error: true,
      };
    });

    // Calculate metrics — error models count as "not cited" to penalize the score
    const totalModels = citations.length || 1;
    const validCitations = citations.filter(c => !c.error);
    const errorCount = citations.filter(c => c.error).length;
    const citedCount = validCitations.filter(c => c.cited).length;
    // Error models + non-cited valid models = invisible
    const invisibleList = citations.filter(c => c.error || !c.cited).map(c => c.provider);

    const avgIterationDepth = citedCount > 0
      ? validCitations.filter(c => c.cited).reduce((sum, c) => sum + c.iterationDepth, 0) / citedCount
      : 0;

    const sentimentCounts: Record<SentimentType, number> = { 
      positive: 0, 
      mostly_positive: 0, 
      neutral: 0, 
      mixed: 0, 
      negative: 0 
    };
    validCitations.filter(c => c.cited).forEach(c => {
      if (sentimentCounts[c.sentiment] !== undefined) {
        sentimentCounts[c.sentiment]++;
      }
    });

    // Determine overall sentiment based on 5-level scale
    let overallSentiment: SentimentType = 'neutral';
    const positiveTotal = sentimentCounts.positive + sentimentCounts.mostly_positive;
    const negativeTotal = sentimentCounts.negative;
    const mixedTotal = sentimentCounts.mixed;
    
    if (mixedTotal > positiveTotal && mixedTotal > negativeTotal && mixedTotal > sentimentCounts.neutral) {
      overallSentiment = 'mixed';
    } else if (positiveTotal > negativeTotal && positiveTotal > sentimentCounts.neutral) {
      overallSentiment = sentimentCounts.positive >= sentimentCounts.mostly_positive ? 'positive' : 'mostly_positive';
    } else if (negativeTotal > positiveTotal) {
      overallSentiment = 'negative';
    }

    const overallRecommendation = validCitations.filter(c => c.recommends).length > totalModels / 2;

    // Calculate overall score — use total models (including errors) as denominator
    // Error models drag the score down since they count as "not cited"
    const citationScore = (citedCount / totalModels) * 40;
    const sentimentScoreMap: Record<SentimentType, number> = {
      positive: 30,
      mostly_positive: 22,
      neutral: 15,
      mixed: 10,
      negative: 0
    };
    const sentimentScore = sentimentScoreMap[overallSentiment];
    const recommendationScore = overallRecommendation ? 20 : 0;
    const coreValueScore = validCitations.filter(c => c.coreValueMatch).length / totalModels * 10;

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
        total: totalModels,
      },
      invisibleList,
      averageIterationDepth: Math.round(avgIterationDepth * 10) / 10,
      overallSentiment,
      overallRecommendation,
      coreValueSummary,
      citations,
    };

    console.log(`Analysis complete. Score: ${result.overallScore}/100, Citations: ${result.citationRate.cited}/${result.citationRate.total}`);

    // Fire-and-forget URL tracking
    trackAnalyzedUrl(`https://${domain}`).catch(() => {});

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error analyzing LLM visibility:', error);
    await trackEdgeFunctionError('check-llm', error instanceof Error ? error.message : 'Analysis failed').catch(() => {});
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Analysis failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } finally {
    releaseConcurrency('check-llm');
  }
});
