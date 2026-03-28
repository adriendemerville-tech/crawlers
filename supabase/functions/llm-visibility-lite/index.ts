import { corsHeaders } from '../_shared/cors.ts'
import { trackTokenUsage, trackPaidApiCall } from '../_shared/tokenTracker.ts'
import { saveRawAuditData } from '../_shared/saveRawAuditData.ts'

/**
 * llm-visibility-lite — Lead magnet version
 * 2 natural prompts × 6 LLMs in parallel. No tracked_site needed.
 * Prompts do NOT mention the brand/domain — citation is detected in post-processing.
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

// ═══════════════════════════════════════════════
// Brand pattern detection (post-processing)
// ═══════════════════════════════════════════════

function extractBrandFromDomain(domain: string): string {
  const parts = domain.replace(/^www\./, '').split('.')
  const name = parts[0]
  return name
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function buildPatterns(brand: string, domain: string): string[] {
  const patterns: string[] = [brand.toLowerCase()]
  const domainBase = domain.replace(/^www\./, '').split('.')[0].toLowerCase()
  if (domainBase !== brand.toLowerCase()) patterns.push(domainBase)
  patterns.push(domain.replace(/^www\./, '').toLowerCase())
  // Without separators: "gkg-consulting" → "gkgconsulting"
  const noSep = domainBase.replace(/[-_]/g, '')
  if (noSep !== domainBase) patterns.push(noSep)
  return [...new Set(patterns)]
}

function detectSentiment(text: string): 'positive' | 'neutral' | 'negative' {
  const lower = text.toLowerCase()
  const positiveSignals = ['recommand', 'excellent', 'leader', 'meilleur', 'best', 'top', 'référence', 'confiance', 'reconnu', 'expert', 'spécialis', 'recommend', 'reliable', 'trusted']
  const negativeSignals = ['problème', 'attention', 'éviter', 'avoid', 'issue', 'mauvais', 'méfiance', 'critique', 'poor', 'bad']

  let posCount = 0, negCount = 0
  for (const s of positiveSignals) { if (lower.includes(s)) posCount++ }
  for (const s of negativeSignals) { if (lower.includes(s)) negCount++ }

  if (posCount > negCount) return 'positive'
  if (negCount > posCount) return 'negative'
  return 'neutral'
}

// ═══════════════════════════════════════════════
// Natural prompt generation — NO brand/domain mention
// ═══════════════════════════════════════════════

function inferSectorFromDomain(domain: string): string {
  const base = domain.replace(/^www\./, '').split('.')[0].toLowerCase()
  // Try to infer something useful from domain name
  const hints: Record<string, string> = {
    consult: 'conseil et consulting',
    avocat: 'droit et services juridiques',
    immo: 'immobilier',
    auto: 'automobile',
    tech: 'technologie',
    design: 'design et création',
    market: 'marketing',
    compta: 'comptabilité',
    archi: 'architecture',
    forma: 'formation',
    sante: 'santé',
    health: 'healthcare',
    finance: 'finance',
    assur: 'assurance',
    travel: 'voyage',
    food: 'restauration',
    shop: 'e-commerce',
    photo: 'photographie',
    dev: 'développement web',
    sport: 'sport et fitness',
  }
  for (const [key, sector] of Object.entries(hints)) {
    if (base.includes(key)) return sector
  }
  return ''
}

function generateNaturalPrompts(domain: string): string[] {
  const sector = inferSectorFromDomain(domain)
  
  if (sector) {
    return [
      `Je cherche un bon prestataire en ${sector}, tu connais des noms ? Tu me recommanderais qui ?`,
      `C'est quoi les meilleurs acteurs en ${sector} en ce moment ?`,
    ]
  }
  
  // Fallback: use domain structure to build a generic but contextual query
  const brand = extractBrandFromDomain(domain)
  const isConsulting = brand.toLowerCase().includes('consult')
  const isAgency = brand.toLowerCase().includes('agenc') || brand.toLowerCase().includes('studio')
  
  if (isConsulting) {
    return [
      `Je cherche un bon cabinet de conseil, tu as des recommandations ?`,
      `Quels sont les consultants les plus reconnus dans leur domaine ?`,
    ]
  }
  if (isAgency) {
    return [
      `Je cherche une bonne agence pour mon projet, tu recommandes qui ?`,
      `Quelles sont les meilleures agences du moment ?`,
    ]
  }
  
  return [
    `Je cherche un bon prestataire pour mon projet professionnel, tu as des idées ?`,
    `Tu connais des entreprises fiables et reconnues dans leur domaine ?`,
  ]
}

// ═══════════════════════════════════════════════
// Main handler
// ═══════════════════════════════════════════════

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

    let domain: string
    try {
      domain = new URL(url).hostname.replace(/^www\./, '')
    } catch {
      domain = url.replace(/https?:\/\//, '').replace(/\/.*/, '').replace(/^www\./, '')
    }

    const brand = extractBrandFromDomain(domain)
    const patterns = buildPatterns(brand, domain)
    
    // Natural prompts — NO brand/domain mention
    const prompts = generateNaturalPrompts(domain)
    console.log(`[llm-lite] ${domain} — patterns: ${patterns.join(', ')} — prompts: ${prompts.map(p => p.slice(0, 50)).join(' | ')}`)

    // Query all 6 LLMs in parallel, each gets both prompts
    const results = await Promise.all(
      LLM_TARGETS.map(async (llm) => {
        try {
          const allResponses: string[] = []
          
          for (const prompt of prompts) {
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
                max_tokens: 500,
              }),
              signal: controller.signal,
            })

            clearTimeout(timeout)

            if (!resp.ok) {
              console.error(`[llm-lite] ${llm.name} HTTP ${resp.status}`)
              continue
            }

            const data = await resp.json()
            const content = data.choices?.[0]?.message?.content || ''

            trackTokenUsage('llm-visibility-lite', llm.model, data.usage, domain)
            trackPaidApiCall('llm-visibility-lite', 'openrouter', llm.model, domain)
            
            allResponses.push(content)
            
            // If cited on first prompt, skip second
            const lower = content.toLowerCase()
            if (patterns.some(p => lower.includes(p))) break
          }
          
          if (allResponses.length === 0) {
            return { llm_name: llm.name, cited: false, sentiment: 'neutral' as const, error: true }
          }
          
          const fullText = allResponses.join('\n')
          const lower = fullText.toLowerCase()
          const cited = patterns.some(p => lower.includes(p))
          const sentiment = cited ? detectSentiment(fullText) : 'neutral' as const

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
