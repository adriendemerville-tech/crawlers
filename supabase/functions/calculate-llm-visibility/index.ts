import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { trackTokenUsage, trackPaidApiCall } from '../_shared/tokenTracker.ts'

/**
 * calculate-llm-visibility
 * 
 * For a tracked site, generates prompts from site identity,
 * queries 4 LLMs with up to 3 iterations each,
 * scores based on iteration depth (100/50/25/0),
 * and stores results in llm_test_executions + llm_visibility_scores.
 */

// ─── Configurable scoring weights ───
const ITERATION_SCORES: Record<number, number> = {
  1: 100,
  2: 50,
  3: 25,
}
const DEFAULT_SCORE = 0

// ─── LLM targets (via OpenRouter) ───
const LLM_TARGETS = [
  { id: 'chatgpt', name: 'ChatGPT', model: 'openai/gpt-4o' },
  { id: 'claude', name: 'Claude', model: 'anthropic/claude-3.5-sonnet' },
  { id: 'gemini', name: 'Gemini', model: 'google/gemini-2.5-flash-preview' },
  { id: 'perplexity', name: 'Perplexity', model: 'perplexity/sonar' },
]

const NUM_PROMPTS = 5

// ─── Prompt generation from site identity ───
// CRITICAL: Prompts must NEVER contain brand name, site name, domain, or company name.
// Including them would bias LLM responses and falsify visibility scores.
// We rely solely on sector/audience/product descriptors for organic discovery.
function generatePrompts(site: any): string[] {
  const sector = site.market_sector || 'numérique'
  const target = site.target_audience || 'les professionnels'
  const products = site.products_services || 'les services en ligne'
  const area = site.commercial_area || ''

  const templates = [
    `Quels sont les meilleurs outils ou services dans le secteur "${sector}" pour ${target} ?`,
    `Recommande-moi une solution pour ${products}${area ? ` dans la zone ${area}` : ''}.`,
    `Quelles sont les entreprises les plus fiables pour ${products} destinés à ${target} ?`,
    `Fais-moi un top 5 des acteurs du marché "${sector}"${area ? ` en ${area}` : ''}.`,
    `Si je cherche ${products} pour ${target}, quelles sont les meilleures options disponibles ?`,
  ]

  return templates.slice(0, NUM_PROMPTS)
}

// ─── Check if brand is mentioned in response ───
function brandFoundInResponse(response: string, site: any): boolean {
  const brand = (site.site_name || '').toLowerCase()
  const domain = (site.domain || '').toLowerCase().replace(/\./g, '[\\.\\s]?')
  const text = response.toLowerCase()
  
  if (brand && brand.length > 2 && text.includes(brand)) return true
  if (domain && new RegExp(domain).test(text)) return true
  return false
}

// ─── Query a single LLM with up to 3 iterations ───
async function queryWithIterations(
  apiKey: string,
  model: string,
  prompt: string,
  site: any,
): Promise<{ iteration_found: number; response_text: string }> {
  const messages: Array<{ role: string; content: string }> = [
    { role: 'user', content: prompt },
  ]

  for (let iteration = 1; iteration <= 3; iteration++) {
    try {
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://crawlers.lovable.app',
          'X-Title': 'Crawlers.fr - LLM Visibility Tracker',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.4,
          max_tokens: 600,
        }),
      })

      if (!resp.ok) {
        console.error(`[llm-visibility] ${model} iteration ${iteration} HTTP ${resp.status}`)
        break
      }

      const data = await resp.json()
      const content = data.choices?.[0]?.message?.content || ''

      trackTokenUsage('calculate-llm-visibility', model, data.usage, site.domain)

      if (brandFoundInResponse(content, site)) {
        return { iteration_found: iteration, response_text: content }
      }

      // Prepare follow-up for next iteration
      messages.push({ role: 'assistant', content })

      // Follow-up prompts must also stay brand-agnostic to avoid bias
      if (iteration === 1) {
        messages.push({ role: 'user', content: "Y a-t-il d'autres alternatives ou options que tu n'as pas mentionnées ?" })
      } else if (iteration === 2) {
        messages.push({ role: 'user', content: "Peux-tu élargir ta liste ? Y a-t-il des acteurs plus petits ou spécialisés que tu aurais oubliés ?" })
      }
    } catch (err) {
      console.error(`[llm-visibility] ${model} iteration ${iteration} error:`, err)
      break
    }
  }

  return { iteration_found: 0, response_text: '' }
}

// ─── Calculate score from iteration results ───
function calculateScore(iterations: number[]): number {
  if (iterations.length === 0) return 0
  const total = iterations.reduce((sum, it) => sum + (ITERATION_SCORES[it] ?? DEFAULT_SCORE), 0)
  return Math.round(total / iterations.length)
}

// ─── Get Monday of current week ───
function getWeekStart(): string {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((day + 6) % 7))
  return monday.toISOString().split('T')[0]
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const openrouterKey = Deno.env.get('OPENROUTER_API_KEY')

  if (!openrouterKey) {
    return new Response(JSON.stringify({ error: 'OPENROUTER_API_KEY not set' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    const { tracked_site_id, user_id } = await req.json()

    if (!tracked_site_id || !user_id) {
      return new Response(JSON.stringify({ error: 'Missing tracked_site_id or user_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch site identity
    const { data: site, error: siteErr } = await supabase
      .from('tracked_sites')
      .select('*')
      .eq('id', tracked_site_id)
      .single()

    if (siteErr || !site) {
      return new Response(JSON.stringify({ error: 'Site not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const prompts = generatePrompts(site)
    const weekStart = getWeekStart()
    const results: Record<string, number[]> = {}

    // For each LLM target
    for (const llm of LLM_TARGETS) {
      results[llm.name] = []

      for (const prompt of prompts) {
        // Small delay between calls to avoid rate limiting
        await delay(300)

        const { iteration_found, response_text } = await queryWithIterations(
          openrouterKey,
          llm.model,
          prompt,
          site,
        )

        trackPaidApiCall('calculate-llm-visibility', 'openrouter', llm.model, site.domain)

        // Store raw execution
        await supabase.from('llm_test_executions').insert({
          tracked_site_id,
          user_id,
          llm_name: llm.name,
          prompt_tested: prompt,
          response_text: response_text.slice(0, 2000), // Truncate for storage
          brand_found: iteration_found > 0,
          iteration_found,
        })

        results[llm.name].push(iteration_found)
      }

      // Calculate and store aggregated score
      const score = calculateScore(results[llm.name])

      await supabase.from('llm_visibility_scores').upsert({
        tracked_site_id,
        user_id,
        llm_name: llm.name,
        score_percentage: score,
        week_start_date: weekStart,
      }, { onConflict: 'tracked_site_id,llm_name,week_start_date' })

      console.log(`[llm-visibility] ${site.domain} × ${llm.name}: ${score}%`)
    }

    // Build response summary
    const scores = Object.entries(results).map(([llm, iterations]) => ({
      llm_name: llm,
      score_percentage: calculateScore(iterations),
      details: iterations.map((it, i) => ({
        prompt: prompts[i],
        iteration_found: it,
        points: ITERATION_SCORES[it] ?? DEFAULT_SCORE,
      })),
    }))

    console.log(`[llm-visibility] ✅ ${site.domain} complete: ${scores.map(s => `${s.llm_name}=${s.score_percentage}%`).join(', ')}`)

    return new Response(JSON.stringify({ data: { scores, week_start_date: weekStart } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[llm-visibility] Error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
