import { corsHeaders } from '../_shared/cors.ts'
import { callOpenRouter } from '../_shared/openRouterAI.ts'
import { trackTokenUsage, trackPaidApiCall } from '../_shared/tokenTracker.ts'
import { saveRawAuditData } from '../_shared/saveRawAuditData.ts'
import {
  generateNaturalPrompts,
  buildBrandPatterns,
  detectCitationInText,
  detectSentimentFromText,
} from '../_shared/naturalPrompts.ts'

/**
 * llm-visibility-lite — Lead magnet version
 * 2 natural prompts × 6 LLMs in parallel. No tracked_site needed.
 * Prompts NEVER mention the brand/domain — citation detected in post-processing.
 */

const LLM_TARGETS = [
  { id: 'chatgpt',    name: 'ChatGPT',    model: 'openai/gpt-4o-mini' },
  { id: 'gemini',     name: 'Gemini',      model: 'google/gemini-2.5-flash' },
  { id: 'perplexity', name: 'Perplexity',  model: 'perplexity/sonar' },
  { id: 'claude',     name: 'Claude',      model: 'anthropic/claude-3-haiku' },
  { id: 'mistral',    name: 'Mistral',     model: 'mistralai/mistral-small-latest' },
  { id: 'llama',      name: 'Meta Llama',  model: 'meta-llama/llama-3.1-8b-instruct' },
]

function extractBrandFromDomain(domain: string): string {
  const parts = domain.replace(/^www\./, '').split('.')
  const name = parts[0]
  return name
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { url, siteContext: externalContext } = await req.json()
    if (!url) {
      return new Response(JSON.stringify({ error: 'URL required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!Deno.env.get('OPENROUTER_API_KEY')) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let domain: string
    try {
      domain = new URL(url).hostname.replace(/^www\./, '')
    } catch {
      domain = url.replace(/https?:\/\//, '').replace(/\/.*/, '').replace(/^www\./, '')
    }

    const brand = extractBrandFromDomain(domain)
    const patterns = buildBrandPatterns(domain)
    
    // Natural prompts: prefer caller-provided context, fallback to domain inference
    const siteCtx = externalContext?.market_sector ? externalContext : undefined
    const { prompts } = generateNaturalPrompts({ site: siteCtx, domain, lang: 'fr', maxPrompts: 2 })
    if (siteCtx) console.log(`[llm-lite] Using caller-provided context (sector: ${siteCtx.market_sector})`)
    console.log(`[llm-lite] ${domain} — patterns: ${patterns.exact.join(', ')} — prompts: ${prompts.map(p => p.slice(0, 50)).join(' | ')}`)

    const results = await Promise.all(
      LLM_TARGETS.map(async (llm) => {
        try {
          const allResponses: string[] = []
          
          for (const prompt of prompts) {
            try {
              const resp = await callOpenRouter({
                model: llm.model,
                user: prompt,
                temperature: 0.4,
                maxTokens: 500,
                signal: AbortSignal.timeout(15000),
                title: 'Crawlers.fr - LLM Visibility Lite',
              });

              const content = resp.content;
              trackTokenUsage('llm-visibility-lite', llm.model, resp.usage, domain)
              trackPaidApiCall('llm-visibility-lite', 'openrouter', llm.model, domain)
              
              allResponses.push(content)
              
              if (detectCitationInText(content, patterns)) break
            } catch (promptErr) {
              console.error(`[llm-lite] ${llm.name} error on prompt:`, promptErr)
              continue
            }
          }
          
          if (allResponses.length === 0) {
            return { llm_name: llm.name, cited: false, sentiment: 'neutral' as const, error: true }
          }
          
          const fullText = allResponses.join('\n')
          const cited = detectCitationInText(fullText, patterns)
          const sentiment5 = detectSentimentFromText(fullText, cited)
          // Simplify to 3-level for lite
          const sentiment = sentiment5 === 'positive' || sentiment5 === 'mostly_positive' ? 'positive' as const
            : sentiment5 === 'negative' ? 'negative' as const
            : 'neutral' as const

          return {
            llm_name: llm.name,
            cited,
            sentiment,
            excerpt: allResponses[0].slice(0, 200),
            error: false,
          }
        } catch (err) {
          console.error(`[llm-lite] ${llm.name} error:`, err)
          return { llm_name: llm.name, cited: false, sentiment: 'neutral' as const, error: true }
        }
      })
    )

    const citedCount = results.filter(r => r.cited).length
    console.log(`[llm-lite] ✅ ${domain} (${brand}): ${citedCount}/${results.length} cited`)

    saveRawAuditData({
      url,
      domain,
      auditType: 'lead_magnet_llm',
      rawPayload: { brand, results, citedCount, totalLlms: results.length },
      sourceFunctions: ['llm-visibility-lite'],
    }).catch(() => {})

    return new Response(JSON.stringify({
      success: true,
      data: { brand, domain, results, citedCount, totalLlms: results.length },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[llm-lite] Error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
