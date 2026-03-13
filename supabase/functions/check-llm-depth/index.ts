import { corsHeaders } from '../_shared/cors.ts'
import { trackPaidApiCall } from '../_shared/tokenTracker.ts'

/**
 * check-llm-depth
 *
 * Multi-turn conversation with ChatGPT and Gemini via OpenRouter.
 * Simulates a real user searching for a service/product analogous to
 * what the target site offers, counting iterations until the brand is cited.
 * The iteration count = LLM Depth Score (lower is better).
 * Max iterations = 5 (if not cited after 5, score = 5+).
 */

const MAX_ITERATIONS = 5

interface DepthResult {
  llm: string
  model: string
  iterations: number // 1-5 or 6 if never found
  found: boolean
  conversation_summary: string
}

const MODELS = [
  { id: 'chatgpt', name: 'ChatGPT', model: 'openai/gpt-4o' },
  { id: 'gemini', name: 'Gemini', model: 'google/gemini-2.5-flash' },
]

function extractBrand(domain: string): string {
  // Remove TLD and www to get brand name
  return domain
    .replace(/^www\./, '')
    .replace(/\.(com|fr|net|org|io|co|dev|app|ai|tech|eu|be|ch|ca)$/i, '')
    .replace(/[-_]/g, ' ')
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

async function runDepthConversation(
  apiKey: string,
  model: string,
  brand: string,
  domain: string,
  serviceDescription: string,
  lang: string,
): Promise<{ iterations: number; found: boolean; summary: string }> {
  const brandLower = brand.toLowerCase()
  const domainLower = domain.toLowerCase()
  const messages: { role: string; content: string }[] = []

  // Initial system prompt – act as a normal user
  const systemPrompt = lang === 'fr'
    ? `Tu es un utilisateur lambda qui cherche un prestataire ou un produit. Tu ne connais pas encore de marque spécifique. Tu poses des questions naturelles pour trouver la meilleure solution. Réponds de façon conversationnelle. N'invente pas de marques fictives.`
    : `You are a regular user looking for a service provider or product. You don't know any specific brand yet. You ask natural questions to find the best solution. Respond conversationally. Don't invent fictitious brands.`

  // First user message – describe the need without mentioning the brand
  const firstMessage = lang === 'fr'
    ? `Je cherche ${serviceDescription}. Quelles sont les meilleures options disponibles ?`
    : `I'm looking for ${serviceDescription}. What are the best options available?`

  messages.push({ role: 'system', content: systemPrompt })
  messages.push({ role: 'user', content: firstMessage })

  // Follow-up prompts to dig deeper each iteration
  const followUps = lang === 'fr'
    ? [
        `Peux-tu me donner plus de détails sur ces options ? Y a-t-il d'autres acteurs que tu recommandes ?`,
        `Et côté rapport qualité-prix, lequel te semble le plus intéressant ? Des alternatives moins connues ?`,
        `J'aimerais une solution vraiment spécialisée. Quels sont les acteurs de niche dans ce domaine ?`,
        `Merci. Peux-tu me faire un récapitulatif complet de toutes les solutions que tu connais, y compris les plus petites ?`,
      ]
    : [
        `Can you give me more details about these options? Are there other players you recommend?`,
        `In terms of value for money, which one seems most interesting? Any lesser-known alternatives?`,
        `I'd like a really specialized solution. What are the niche players in this space?`,
        `Thanks. Can you give me a complete summary of all the solutions you know, including the smaller ones?`,
      ]

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://crawlers.lovable.app',
          'X-Title': 'Crawlers.fr - LLM Depth Analyzer',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 800,
        }),
      })

      if (!response.ok) {
        console.error(`[check-llm-depth] API error for ${model} iteration ${i + 1}:`, response.status)
        break
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''

      trackPaidApiCall('check-llm-depth', 'openrouter', model, domain)

      // Add assistant response to conversation
      messages.push({ role: 'assistant', content })

      // Check if brand is mentioned
      const contentLower = content.toLowerCase()
      if (contentLower.includes(brandLower) || contentLower.includes(domainLower)) {
        return {
          iterations: i + 1,
          found: true,
          summary: content.slice(0, 300),
        }
      }

      // If not the last iteration, add follow-up question
      if (i < MAX_ITERATIONS - 1) {
        const followUp = followUps[i] || followUps[followUps.length - 1]
        messages.push({ role: 'user', content: followUp })
      }

      // Small delay between iterations
      await delay(400)
    } catch (err) {
      console.error(`[check-llm-depth] Error iteration ${i + 1} for ${model}:`, err)
      break
    }
  }

  return {
    iterations: MAX_ITERATIONS + 1,
    found: false,
    summary: '',
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { domain, service_description, lang = 'fr' } = await req.json()

    if (!domain) {
      return new Response(JSON.stringify({ error: 'Missing domain' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('OPENROUTER_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OpenRouter API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const brand = extractBrand(domain)

    // Build a service description from the domain if not provided
    const svcDesc = service_description ||
      (lang === 'fr'
        ? `un service ou produit similaire à ce que propose ${brand} (site ${domain})`
        : `a service or product similar to what ${brand} offers (site ${domain})`)

    // Run conversations in parallel for both models
    const results: DepthResult[] = []

    const promises = MODELS.map(async (m) => {
      const result = await runDepthConversation(apiKey, m.model, brand, domain, svcDesc, lang)
      results.push({
        llm: m.name,
        model: m.model,
        iterations: result.iterations,
        found: result.found,
        conversation_summary: result.summary,
      })
    })

    await Promise.allSettled(promises)

    // Calculate average depth score
    const scores = results.map(r => r.iterations)
    const avgDepth = scores.length > 0 ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : null

    console.log(`[check-llm-depth] ✅ ${domain}: brand="${brand}" avgDepth=${avgDepth}`, results.map(r => `${r.llm}=${r.iterations}`).join(', '))

    return new Response(JSON.stringify({
      data: {
        brand,
        domain,
        avg_depth: avgDepth,
        results,
        measured_at: new Date().toISOString(),
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[check-llm-depth] Error:', error)
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
