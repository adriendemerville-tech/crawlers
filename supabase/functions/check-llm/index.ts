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
  error?: boolean;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ═══════════════════════════════════════════════
// Brand pattern detection (post-processing, no bias)
// ═══════════════════════════════════════════════

interface BrandPatterns {
  exact: string[];
  domain: string;
}

function buildBrandPatterns(domain: string): BrandPatterns {
  const cleanDomain = domain.replace(/^www\./, '');
  const domainBase = cleanDomain.split('.')[0].toLowerCase();
  // Build brand name from domain: "gkg-consulting" → "gkg consulting"
  const brandWords = domainBase.split(/[-_]/).join(' ');
  
  const patterns: string[] = [domainBase];
  if (brandWords !== domainBase) patterns.push(brandWords);
  // Add full domain
  patterns.push(cleanDomain.toLowerCase());
  // Add without hyphens: "gkgconsulting"
  const noSep = domainBase.replace(/[-_]/g, '');
  if (noSep !== domainBase) patterns.push(noSep);
  
  return { exact: [...new Set(patterns)], domain: cleanDomain };
}

function detectCitation(text: string, patterns: BrandPatterns): boolean {
  const lower = text.toLowerCase();
  return patterns.exact.some(p => lower.includes(p));
}

function detectSentimentFromText(text: string, cited: boolean): SentimentType {
  if (!cited) return 'neutral';
  const lower = text.toLowerCase();
  
  const strongPositive = ['excellent', 'leader', 'meilleur', 'best', 'top', 'référence', 'confiance', 'reconnu', 'incontournable', 'outstanding', 'highly recommended', 'premier'];
  const mildPositive = ['bon', 'good', 'recommand', 'fiable', 'sérieux', 'professionnel', 'reliable', 'solid', 'decent', 'expert', 'spécialis'];
  const negative = ['problème', 'éviter', 'avoid', 'mauvais', 'bad', 'issue', 'poor', 'méfiance', 'critique', 'controversy', 'scandal'];
  const mixed = ['mais', 'cependant', 'toutefois', 'however', 'although', 'mixed', 'partagé', 'divisé'];
  
  let posScore = 0, negScore = 0, mixScore = 0;
  for (const s of strongPositive) { if (lower.includes(s)) posScore += 2; }
  for (const s of mildPositive) { if (lower.includes(s)) posScore += 1; }
  for (const s of negative) { if (lower.includes(s)) negScore += 2; }
  for (const s of mixed) { if (lower.includes(s)) mixScore += 1; }
  
  if (negScore > posScore && negScore > mixScore) return 'negative';
  if (mixScore > 2 || (posScore > 0 && negScore > 0)) return 'mixed';
  if (posScore >= 4) return 'positive';
  if (posScore >= 1) return 'mostly_positive';
  return 'neutral';
}

function detectRecommendation(text: string, cited: boolean): boolean {
  if (!cited) return false;
  const lower = text.toLowerCase();
  const recoSignals = ['recommand', 'recommend', 'je conseille', 'i suggest', 'je suggère', 'vous pouvez', 'n\'hésitez pas', 'bonne option', 'good option', 'worth', 'go with'];
  return recoSignals.some(s => lower.includes(s));
}

// ═══════════════════════════════════════════════
// Natural prompt generation (NO brand/domain mention)
// ═══════════════════════════════════════════════

interface SiteContext {
  market_sector?: string;
  products_services?: string;
  target_audience?: string;
  commercial_area?: string;
}

function generateNaturalPrompts(ctx: SiteContext, lang: Language): string[] {
  const sector = ctx.market_sector || '';
  const products = ctx.products_services || '';
  const target = ctx.target_audience || '';
  const area = ctx.commercial_area || '';
  
  const prompts: string[] = [];
  
  if (lang === 'fr') {
    if (products) {
      prompts.push(area
        ? `Je cherche ${products} ${area}, tu connais des bons prestataires ?`
        : `Je cherche ${products}, tu peux me recommander quelqu'un ?`
      );
      prompts.push(`C'est quoi le mieux pour ${products} en ce moment ?`);
    }
    if (sector) {
      prompts.push(`J'ai besoin d'un coup de main en ${sector}, tu connais des bons ?`);
      if (target) {
        prompts.push(`Je suis ${target} et j'ai besoin de ${sector}, tu recommandes quoi ?`);
      }
    }
    if (prompts.length === 0) {
      prompts.push(`Je cherche un bon prestataire pour mon projet, tu as des recommandations ?`);
      prompts.push(`Quels sont les meilleurs dans ce domaine en ce moment ?`);
    }
  } else if (lang === 'en') {
    if (products) {
      prompts.push(area
        ? `I'm looking for ${products} in ${area}, any good recommendations?`
        : `I need ${products}, who would you recommend?`
      );
      prompts.push(`What's the best option for ${products} right now?`);
    }
    if (sector) {
      prompts.push(`I need help with ${sector}, do you know any good providers?`);
      if (target) {
        prompts.push(`As a ${target}, I need ${sector}, what would you suggest?`);
      }
    }
    if (prompts.length === 0) {
      prompts.push(`I'm looking for a good service provider for my project, any recommendations?`);
      prompts.push(`Who are the best in this field right now?`);
    }
  } else {
    // es
    if (products) {
      prompts.push(area
        ? `Busco ${products} en ${area}, ¿conoces buenos proveedores?`
        : `Necesito ${products}, ¿a quién me recomiendas?`
      );
      prompts.push(`¿Cuál es la mejor opción para ${products} ahora mismo?`);
    }
    if (sector) {
      prompts.push(`Necesito ayuda con ${sector}, ¿conoces buenos proveedores?`);
    }
    if (prompts.length === 0) {
      prompts.push(`Busco un buen proveedor para mi proyecto, ¿alguna recomendación?`);
    }
  }
  
  return [...new Set(prompts)].slice(0, 2);
}

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
      if (detectCitation(content, patterns)) break;
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
  
  // Post-process: analyze all responses for brand mentions
  const fullText = allResponses.join('\n');
  const cited = detectCitation(fullText, patterns);
  const sentiment = detectSentimentFromText(fullText, cited);
  const recommends = detectRecommendation(fullText, cited);
  
  // Extract a summary from the response
  const summaryText = allResponses[0].slice(0, 300);
  const summary = cited
    ? `${patterns.exact[0]} ${sentiment === 'positive' || sentiment === 'mostly_positive' ? 'est mentionné positivement' : sentiment === 'negative' ? 'est mentionné négativement' : 'est mentionné'} dans les réponses du LLM.`
    : `${patterns.exact[0]} n'est pas spontanément cité par ce LLM.`;
  
  return {
    cited,
    sentiment,
    recommends,
    summary,
    coreValueMatch: cited,
    hallucinations: [],
  };
}

// ═══════════════════════════════════════════════
// Legacy custom prompt support (audit-matrice, etc.)
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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
    
    const { url, lang: requestLang, correction, customPrompt, targetProvider } = await req.json();
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

    // Fetch site context for natural prompts
    let siteCtx: SiteContext = {};
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
        console.log(`[check-llm] Site context loaded (confidence: ${ctx.identity_confidence || 0})`);
      }
    } catch (e) {
      console.warn('[check-llm] Could not fetch site context:', e);
    }

    // Generate natural prompts (NO domain/brand mention)
    const naturalPrompts = generateNaturalPrompts(siteCtx, lang);
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
      
      // Custom prompt path (legacy: audit-matrice, etc.)
      if (customPrompt) {
        const effectivePrompt = `${customPrompt}\n\nRéponds au format JSON :\n{"cited": boolean, "sentiment": "positive"|"mostly_positive"|"neutral"|"mixed"|"negative", "recommends": boolean, "summary": "string", "coreValueMatch": boolean, "hallucinations": []}`;
        const result = await queryLLMWithCustomPrompt(apiKey, provider.model, effectivePrompt);
        return {
          provider: { id: provider.id, name: provider.name, company: provider.company },
          cited: result.cited,
          iterationDepth: result.cited ? 1 : 0,
          sentiment: result.sentiment,
          recommends: result.recommends,
          coreValueMatch: result.coreValueMatch,
          summary: result.summary,
          hallucinations: result.hallucinations?.length ? result.hallucinations : undefined,
        };
      }
      
      // Natural prompt path (default)
      const result = await queryLLMNatural(apiKey, provider.model, domain, naturalPrompts, patterns, lang);
      
      return {
        provider: { id: provider.id, name: provider.name, company: provider.company },
        cited: result.cited,
        iterationDepth: result.cited ? 1 : 0,
        sentiment: result.sentiment,
        recommends: result.recommends,
        coreValueMatch: result.coreValueMatch,
        summary: result.summary,
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

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
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
});
