import { getLLMTranslations, parseLanguage, type Language } from '../_shared/translations.ts';
import { trackTokenUsage, trackPaidApiCall, trackEdgeFunctionError } from '../_shared/tokenTracker.ts';
import { trackAnalyzedUrl } from '../_shared/trackUrl.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { checkIpRate, getClientIp, rateLimitResponse, acquireConcurrency, releaseConcurrency, concurrencyResponse } from '../_shared/ipRateLimiter.ts';
import { checkFairUse, getUserContext } from '../_shared/fairUse.ts';
import { getSiteContext } from '../_shared/getSiteContext.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import {
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
  generateNaturalPrompts,
  buildBrandPatterns,
  detectCitationInText,
  detectSentimentFromText,
  detectRecommendationInText,
  type SiteContext,
  type BrandPatterns,
  type PromptLang,
} from '../_shared/naturalPrompts.ts';

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
  error?: boolean;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ═══════════════════════════════════════════════
// Natural LLM query — no brand mention, post-process
// ═══════════════════════════════════════════════

async function queryLLMNatural(
  apiKey: string,
  model: string,
  domain: string,
  prompts: string[],
  patterns: BrandPatterns,
  lang: Language,
): Promise<LLMResponse> {
  const t = getLLMTranslations(lang);
  const allResponses: string[] = [];
  
  for (const prompt of prompts) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        signal: controller.signal,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://crawlers.lovable.app',
          'X-Title': 'Crawlers.fr - LLM Visibility',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4,
          max_tokens: 600,
        }),
      });
      
      clearTimeout(timeout);
      
      if (!response.ok) {
        console.error(`[check-llm] ${model} HTTP ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      trackTokenUsage('check-llm', model, data.usage, domain);
      trackPaidApiCall('check-llm', 'openrouter', model, domain);
      
      allResponses.push(content);
      
      // If cited on first prompt, no need for second
      if (detectCitationInText(content, patterns)) break;
    } catch (err) {
      console.error(`[check-llm] ${model} error on prompt:`, err);
    }
  }
  
  if (allResponses.length === 0) {
    return {
      cited: false,
      sentiment: 'neutral',
      recommends: false,
      summary: t.unableToRetrieve(domain),
      coreValueMatch: false,
      hallucinations: [],
      error: true,
    };
  }
  
  const fullText = allResponses.join('\n');
  const cited = detectCitationInText(fullText, patterns);
  const sentiment = detectSentimentFromText(fullText, cited);
  const recommends = detectRecommendationInText(fullText, cited);
  
  const summary = cited
    ? `${patterns.exact[0]} ${sentiment === 'positive' || sentiment === 'mostly_positive' ? 'est mentionné positivement' : sentiment === 'negative' ? 'est mentionné négativement' : 'est mentionné'} dans les réponses du LLM.`
    : `${patterns.exact[0]} n'est pas spontanément cité par ce LLM.`;
  
  return { cited, sentiment, recommends, summary, coreValueMatch: cited, hallucinations: [] };
}

// ═══════════════════════════════════════════════
// Legacy custom prompt support
// ═══════════════════════════════════════════════

async function queryLLMWithCustomPrompt(apiKey: string, model: string, prompt: string): Promise<LLMResponse> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      signal: controller.signal,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://crawlers.lovable.app', 'X-Title': 'Crawlers.fr' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 500 }),
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content');
    let jsonStr = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
    const fb = jsonStr.indexOf('{'), lb = jsonStr.lastIndexOf('}');
    if (fb !== -1 && lb > fb) jsonStr = jsonStr.substring(fb, lb + 1);
    return JSON.parse(jsonStr);
  } catch (e) {
    return { cited: false, sentiment: 'neutral', recommends: false, summary: `Custom prompt error: ${e.message}`, coreValueMatch: false };
  }
}

// ═══════════════════════════════════════════════
// Main handler
// ═══════════════════════════════════════════════

Deno.serve(handleRequest(async (req) => {
const clientIp = getClientIp(req);
  const ipCheck = checkIpRate(clientIp, 'check-llm', 10, 60_000);
  if (!ipCheck.allowed) return rateLimitResponse(corsHeaders, ipCheck.retryAfterMs);

  if (!acquireConcurrency('check-llm', 30)) return concurrencyResponse(corsHeaders);

  try {
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
    
    const { url, lang: requestLang, correction, customPrompt, targetProvider, siteContext: externalContext } = await req.json();
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
    const patterns = buildBrandPatterns(domain);
    console.log(`[check-llm] Analyzing: ${domain}, patterns: ${patterns.exact.join(', ')}`);

    // Site context: prefer caller-provided context, fallback to DB lookup
    let siteCtx: SiteContext = {};
    if (externalContext && (externalContext.market_sector || externalContext.products_services)) {
      siteCtx = {
        market_sector: externalContext.market_sector,
        products_services: externalContext.products_services,
        target_audience: externalContext.target_audience,
        commercial_area: externalContext.commercial_area,
        entity_type: externalContext.entity_type,
      };
      console.log(`[check-llm] Using caller-provided site context (sector: ${siteCtx.market_sector})`);
    } else {
      // Fallback: DB lookup
      try {
        const supabase = getServiceClient();
        const ctx = await getSiteContext(supabase, { domain });
        if (ctx) {
          siteCtx = {
            market_sector: ctx.market_sector,
            products_services: ctx.products_services,
            target_audience: ctx.target_audience,
            commercial_area: ctx.commercial_area,
          };
          console.log(`[check-llm] Site context loaded from DB (confidence: ${ctx.identity_confidence || 0})`);
        }
      } catch (e) {
        console.warn('[check-llm] Could not fetch site context:', e);
      }
    }

    // Generate natural prompts via shared module (NO domain/brand mention)
    const promptLang: PromptLang = lang as PromptLang;
    const { prompts: naturalPrompts } = generateNaturalPrompts({
      site: siteCtx,
      lang: ['fr', 'en', 'es'].includes(promptLang) ? promptLang : 'fr',
      maxPrompts: 2,
      domain,
    });
    console.log(`[check-llm] Natural prompts: ${naturalPrompts.map(p => p.slice(0, 60)).join(' | ')}`);

    // Filter providers if targetProvider is specified
    const activeProviders = targetProvider
      ? LLM_PROVIDERS.filter(p => p.id.toLowerCase().includes(targetProvider.toLowerCase()) || p.name.toLowerCase().includes(targetProvider.toLowerCase()) || p.company.toLowerCase().includes(targetProvider.toLowerCase()))
      : LLM_PROVIDERS;
    const providersToQuery = activeProviders.length > 0 ? activeProviders : LLM_PROVIDERS;

    // Query LLMs with staggered delays
    const citationPromises = providersToQuery.map(async (provider, index) => {
      await delay(index * 250);
      console.log(`[check-llm] Querying ${provider.name} (${provider.model})...`);
      
      if (customPrompt) {
        const effectivePrompt = `${customPrompt}\n\nRéponds au format JSON :\n{"cited": boolean, "sentiment": "positive"|"mostly_positive"|"neutral"|"mixed"|"negative", "recommends": boolean, "summary": "string", "coreValueMatch": boolean, "hallucinations": []}`;
        const result = await queryLLMWithCustomPrompt(apiKey, provider.model, effectivePrompt);
        return {
          provider: { id: provider.id, name: provider.name, company: provider.company },
          cited: result.cited, iterationDepth: result.cited ? 1 : 0,
          sentiment: result.sentiment, recommends: result.recommends,
          coreValueMatch: result.coreValueMatch, summary: result.summary,
          hallucinations: result.hallucinations?.length ? result.hallucinations : undefined,
        };
      }
      
      const result = await queryLLMNatural(apiKey, provider.model, domain, naturalPrompts, patterns, lang);
      return {
        provider: { id: provider.id, name: provider.name, company: provider.company },
        cited: result.cited, iterationDepth: result.cited ? 1 : 0,
        sentiment: result.sentiment, recommends: result.recommends,
        coreValueMatch: result.coreValueMatch, summary: result.summary,
        hallucinations: result.hallucinations?.length ? result.hallucinations : undefined,
        ...(result.error ? { error: true } : {}),
      };
    });

    const settled = await Promise.allSettled(citationPromises);
    const citations = settled.map((result, index) => {
      if (result.status === 'fulfilled') return result.value;
      console.warn(`[check-llm] Provider ${providersToQuery[index].name} rejected:`, result.reason);
      return {
        provider: { id: providersToQuery[index].id, name: providersToQuery[index].name, company: providersToQuery[index].company },
        cited: false, iterationDepth: 0, sentiment: 'neutral' as SentimentType,
        recommends: false, coreValueMatch: false, summary: `Unable to query ${providersToQuery[index].name}`,
        error: true,
      };
    });

    // Calculate metrics
    const totalModels = citations.length || 1;
    const validCitations = citations.filter(c => !c.error);
    const citedCount = validCitations.filter(c => c.cited).length;
    const invisibleList = citations.filter(c => c.error || !c.cited).map(c => c.provider);

    const avgIterationDepth = citedCount > 0
      ? validCitations.filter(c => c.cited).reduce((sum, c) => sum + c.iterationDepth, 0) / citedCount
      : 0;

    const sentimentCounts: Record<SentimentType, number> = { positive: 0, mostly_positive: 0, neutral: 0, mixed: 0, negative: 0 };
    validCitations.filter(c => c.cited).forEach(c => {
      if (sentimentCounts[c.sentiment] !== undefined) sentimentCounts[c.sentiment]++;
    });

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

    const citationScore = (citedCount / totalModels) * 40;
    const sentimentScoreMap: Record<SentimentType, number> = { positive: 30, mostly_positive: 22, neutral: 15, mixed: 10, negative: 0 };
    const sentimentScore = sentimentScoreMap[overallSentiment];
    const recommendationScore = overallRecommendation ? 20 : 0;
    const coreValueScore = validCitations.filter(c => c.coreValueMatch).length / totalModels * 10;
    const overallScore = Math.round(citationScore + sentimentScore + recommendationScore + coreValueScore);

    const coreValueSummary = citedCount > 0
      ? `${t.coreValueSummary.basedOn(citedCount)} ${overallSentiment === 'positive' ? t.coreValueSummary.positivePerception : overallSentiment === 'negative' ? t.coreValueSummary.negativePerception : t.coreValueSummary.neutralPerception}`
      : t.coreValueSummary.lowVisibility(domain);

    const result = {
      url: `https://${domain}`,
      domain,
      scannedAt: new Date().toISOString(),
      overallScore,
      citationRate: { cited: citedCount, total: totalModels },
      invisibleList,
      averageIterationDepth: Math.round(avgIterationDepth * 10) / 10,
      overallSentiment,
      overallRecommendation,
      coreValueSummary,
      citations,
    };

    console.log(`[check-llm] ✅ ${domain}: ${overallScore}/100, cited ${citedCount}/${totalModels}`);
    trackAnalyzedUrl(`https://${domain}`).catch(() => {});

    return jsonOk({ success: true, data: result });
  } catch (error) {
    console.error('[check-llm] Error:', error);
    await trackEdgeFunctionError('check-llm', error instanceof Error ? error.message : 'Analysis failed').catch(() => {});
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Analysis failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } finally {
    releaseConcurrency('check-llm');
  }
}));