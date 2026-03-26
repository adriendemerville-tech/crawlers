import { corsHeaders } from '../_shared/cors.ts'
import { trackTokenUsage, trackPaidApiCall } from '../_shared/tokenTracker.ts'

/**
 * llm-visibility-lite — Lead magnet version
 * 1 prompt × 6 LLMs in parallel. No tracked_site needed.
 * Returns cited (bool) + sentiment per LLM.
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
  // "gkg-consulting.fr" → "GKG Consulting"
  const parts = domain.replace(/^www\./, '').split('.')
  const name = parts[0]
  return name
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function buildPatterns(brand: string, domain: string): string[] {
  const patterns: string[] = [brand.toLowerCase()]
  // Add domain without TLD
  const domainBase = domain.replace(/^www\./, '').split('.')[0].toLowerCase()
  if (domainBase !== brand.toLowerCase()) patterns.push(domainBase)
  // Add full domain
  patterns.push(domain.replace(/^www\./, '').toLowerCase())
  return [...new Set(patterns)]
}

function detectSentiment(text: string, patterns: string[]): 'positive' | 'neutral' | 'negative' {
  const lower = text.toLowerCase()
  const positiveSignals = ['recommand', 'excellent', 'leader', 'meilleur', 'best', 'top', 'référence', 'confiance', 'reconnu', 'expert', 'spécialis']
  const negativeSignals = ['problème', 'attention', 'éviter', 'avoid', 'issue', 'mauvais', 'méfiance', 'critique']

  let posCount = 0, negCount = 0
  for (const s of positiveSignals) { if (lower.includes(s)) posCount++ }
  for (const s of negativeSignals) { if (lower.includes(s)) negCount++ }

  if (posCount > negCount) return 'positive'
  if (negCount > posCount) return 'negative'
  return 'neutral'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()
    if (!url) {
      return new Response(JSON.stringify({ error: 'URL required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const openrouterKey = Deno.env.get('OPENROUTER_API_KEY')
    if (!openrouterKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Extract domain and brand
    let domain: string
    try {
      domain = new URL(url).hostname.replace(/^www\./, '')
    } catch {
      domain = url.replace(/https?:\/\//, '').replace(/\/.*/, '').replace(/^www\./, '')
    }

    const brand = extractBrandFromDomain(domain)
    const patterns = buildPatterns(brand, domain)

    // Single generic prompt
    const prompt = `Je cherche un bon prestataire ou service pour ce que propose ${brand} (${domain}). Tu connais ? Tu recommanderais quoi ?`

    // Query all 6 LLMs in parallel
    const results = await Promise.all(
      LLM_TARGETS.map(async (llm) => {
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 15000)

          const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openrouterKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://crawlers.lovable.app',
              'X-Title': 'Crawlers.fr - LLM Visibility Lite',
            },
            body: JSON.stringify({
              model: llm.model,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.4,
              max_tokens: 400,
            }),
            signal: controller.signal,
          })

          clearTimeout(timeout)

          if (!resp.ok) {
            console.error(`[llm-lite] ${llm.name} HTTP ${resp.status}`)
            return { llm_name: llm.name, cited: false, sentiment: 'neutral' as const, error: true }
          }

          const data = await resp.json()
          const content = data.choices?.[0]?.message?.content || ''

          trackTokenUsage('llm-visibility-lite', llm.model, data.usage, domain)
          trackPaidApiCall('llm-visibility-lite', 'openrouter', llm.model, domain)

          const lower = content.toLowerCase()
          const cited = patterns.some(p => lower.includes(p))
          const sentiment = cited ? detectSentiment(content, patterns) : 'neutral' as const

          return {
            llm_name: llm.name,
            cited,
            sentiment,
            excerpt: content.slice(0, 200),
            error: false,
          }
        } catch (err) {
          console.error(`[llm-lite] ${llm.name} error:`, err)
          return { llm_name: llm.name, cited: false, sentiment: 'neutral' as const, error: true }
        }
      })
    )

    const citedCount = results.filter(r => r.cited).length

    console.log(`[llm-lite] ${domain} (${brand}): ${citedCount}/${results.length} cited`)

    return new Response(JSON.stringify({
      success: true,
      data: {
        brand,
        domain,
        results,
        citedCount,
        totalLlms: results.length,
      },
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
