import { corsHeaders } from '../_shared/cors.ts'
import { trackPaidApiCall } from '../_shared/tokenTracker.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * check-llm-depth v2 — Expert-grade conversational discoverability analysis
 *
 * Simulates multi-turn conversations with multiple LLMs, using dynamic
 * prompt sequences adapted to each site's typology (sector, audience,
 * geography, products). Brand detection uses semantic extraction via
 * structured JSON output instead of naive substring matching.
 *
 * Prompt funnel strategy (7 angles, increasingly specific):
 *  1. Generic need (category-level)
 *  2. Use case / profession
 *  3. Features & differentiators
 *  4. Budget & pricing
 *  5. Geographic proximity
 *  6. Niche & emerging players
 *  7. Exhaustive enumeration
 */

const MAX_ITERATIONS = 7

// ─── Models ──────────────────────────────────────────────────────────────────
type Gateway = 'openrouter' | 'lovable'
interface ModelDef { id: string; name: string; model: string; gateway: Gateway }
const MODELS: ModelDef[] = [
  { id: 'chatgpt',    name: 'ChatGPT',    model: 'openai/gpt-4o',              gateway: 'openrouter' },
  { id: 'gemini',     name: 'Gemini',      model: 'google/gemini-2.5-flash',    gateway: 'lovable' },
  { id: 'claude',     name: 'Claude',      model: 'anthropic/claude-sonnet-4',  gateway: 'openrouter' },
  { id: 'perplexity', name: 'Perplexity',  model: 'perplexity/sonar',           gateway: 'openrouter' },
]

const LOVABLE_AI_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

// ─── Site context (from tracked_sites) ───────────────────────────────────────
interface SiteContext {
  market_sector?: string
  products_services?: string
  target_audience?: string
  address?: string
  commercial_area?: string
  company_size?: string
}

// ─── Dynamic prompt sequence builder ─────────────────────────────────────────

function buildPromptSequence(
  serviceDesc: string,
  ctx: SiteContext,
  lang: string,
): string[] {
  const isFr = lang === 'fr'
  const isEs = lang === 'es'

  // Phase 1 — Generic need
  const p1 = isFr
    ? `Je cherche ${serviceDesc}. Quelles sont les meilleures solutions disponibles ? Donne-moi un panorama complet avec les noms exacts des entreprises ou outils.`
    : isEs
    ? `Busco ${serviceDesc}. ¿Cuáles son las mejores soluciones disponibles? Dame un panorama completo con los nombres exactos de empresas o herramientas.`
    : `I'm looking for ${serviceDesc}. What are the best solutions available? Give me a complete overview with exact company or tool names.`

  // Phase 2 — Use case / profession (adapts to target_audience or sector)
  const audience = ctx.target_audience || ctx.market_sector
  const p2 = audience
    ? (isFr
      ? `Plus spécifiquement, pour un profil "${audience}", quels outils ou prestataires sont les plus adaptés ? Cite des noms précis.`
      : isEs
      ? `Más específicamente, para un perfil "${audience}", ¿qué herramientas o proveedores son más adecuados? Cita nombres precisos.`
      : `More specifically, for a "${audience}" profile, which tools or providers are most suitable? Name them precisely.`)
    : (isFr
      ? `Quels profils de clients utilisent ces solutions ? Y a-t-il des outils spécialisés par métier ? Cite des noms.`
      : isEs
      ? `¿Qué perfiles de clientes usan estas soluciones? ¿Hay herramientas especializadas por profesión? Cita nombres.`
      : `What client profiles use these solutions? Are there tools specialized by profession? Name them.`)

  // Phase 3 — Features & differentiators (adapts to products_services)
  const features = ctx.products_services
  const p3 = features
    ? (isFr
      ? `Je cherche particulièrement des fonctionnalités comme : ${features}. Quels acteurs proposent ça ? Compare-les.`
      : isEs
      ? `Busco particularmente funcionalidades como: ${features}. ¿Qué actores ofrecen eso? Compáralos.`
      : `I'm particularly looking for features like: ${features}. Which players offer this? Compare them.`)
    : (isFr
      ? `En termes de fonctionnalités avancées et de différenciation, quels acteurs se démarquent vraiment ? Lesquels sont innovants ?`
      : isEs
      ? `En cuanto a funcionalidades avanzadas y diferenciación, ¿qué actores se destacan realmente? ¿Cuáles son innovadores?`
      : `In terms of advanced features and differentiation, which players truly stand out? Which ones are innovative?`)

  // Phase 4 — Budget & pricing (adapts to company_size)
  const size = ctx.company_size
  const p4 = size
    ? (isFr
      ? `Côté budget, pour une structure de type "${size}", quelles sont les solutions les plus rentables ? Cite les noms et fourchettes de prix.`
      : isEs
      ? `En cuanto al presupuesto, para una estructura tipo "${size}", ¿cuáles son las soluciones más rentables? Cita nombres y rangos de precios.`
      : `Budget-wise, for a "${size}" organization, what are the most cost-effective solutions? Name them with price ranges.`)
    : (isFr
      ? `Quel est le rapport qualité-prix de chacune ? Y a-t-il des alternatives abordables moins connues ? Cite-les.`
      : isEs
      ? `¿Cuál es la relación calidad-precio de cada una? ¿Hay alternativas asequibles menos conocidas? Cítalas.`
      : `What's the value for money of each? Are there lesser-known affordable alternatives? Name them.`)

  // Phase 5 — Geographic (adapts to address/commercial_area)
  const geo = ctx.address || ctx.commercial_area
  const p5 = geo
    ? (isFr
      ? `Existe-t-il des acteurs locaux ou spécialisés dans la zone "${geo}" ? Des prestataires régionaux que tu recommanderais ?`
      : isEs
      ? `¿Existen actores locales o especializados en la zona "${geo}"? ¿Proveedores regionales que recomendarías?`
      : `Are there local players or specialists in the "${geo}" area? Regional providers you'd recommend?`)
    : (isFr
      ? `Y a-t-il des différences régionales ? Des acteurs forts dans certaines villes ou pays spécifiques ? Cite-les.`
      : isEs
      ? `¿Hay diferencias regionales? ¿Actores fuertes en ciudades o países específicos? Cítalos.`
      : `Are there regional differences? Strong players in specific cities or countries? Name them.`)

  // Phase 6 — Niche & emerging
  const p6 = isFr
    ? `Maintenant, creuse vraiment. Quels sont les acteurs de niche, les startups émergentes, les outsiders que même les experts ne connaissent pas forcément ? Liste tous les noms.`
    : isEs
    ? `Ahora, profundiza de verdad. ¿Cuáles son los actores de nicho, startups emergentes, outsiders que ni los expertos conocen? Lista todos los nombres.`
    : `Now dig really deep. What are the niche players, emerging startups, outsiders that even experts might not know? List every name.`

  // Phase 7 — Exhaustive enumeration
  const p7 = isFr
    ? `Dernière question : fais-moi la liste la plus exhaustive possible de TOUTES les marques, outils et entreprises que tu connais dans ce secteur. Même les plus confidentiels, même ceux qui ne sont plus actifs. Je veux absolument tout.`
    : isEs
    ? `Última pregunta: hazme la lista más exhaustiva posible de TODAS las marcas, herramientas y empresas que conoces en este sector. Incluso las más confidenciales. Quiero absolutamente todo.`
    : `Last question: give me the most exhaustive list possible of ALL brands, tools and companies you know in this sector. Even the most obscure ones. I want absolutely everything.`

  return [p1, p2, p3, p4, p5, p6, p7]
}

// ─── Semantic brand extraction ───────────────────────────────────────────────

function extractBrand(domain: string): string {
  return domain
    .replace(/^www\./, '')
    .replace(/\.(com|fr|net|org|io|co|dev|app|ai|tech|eu|be|ch|ca|uk|de|es|it|nl|pt|us|info|biz|pro)$/i, '')
    .replace(/[-_]/g, ' ')
}

/**
 * Semantic brand detection: asks the LLM to list all brands/companies it
 * mentioned, then checks if the target brand appears. This eliminates false
 * positives from substring matching (e.g. "lcp" inside "excepté").
 */
async function detectBrandSemantically(
  apiKey: string,
  model: string,
  assistantResponse: string,
  brand: string,
  domain: string,
  lang: string,
): Promise<{ found: boolean; mentionedAs?: string }> {
  const brandLower = brand.toLowerCase()
  const domainLower = domain.toLowerCase().replace(/^www\./, '')

  // Quick pre-filter: if the domain/brand string doesn't appear at all,
  // skip the expensive semantic check
  const responseLower = assistantResponse.toLowerCase()
  const hasCandidate = responseLower.includes(brandLower) || responseLower.includes(domainLower)
  if (!hasCandidate) return { found: false }

  // For very short brand names (≤3 chars), always do semantic verification
  // For longer names, the substring match is more reliable but we still verify
  const extractPrompt = lang === 'fr'
    ? `Voici un texte. Extrais UNIQUEMENT les noms de marques, entreprises, outils ou produits mentionnés. Réponds en JSON : {"brands": ["nom1", "nom2"]}. Ne génère rien d'autre.\n\nTexte:\n${assistantResponse.slice(0, 2000)}`
    : lang === 'es'
    ? `Aquí hay un texto. Extrae ÚNICAMENTE los nombres de marcas, empresas, herramientas o productos mencionados. Responde en JSON: {"brands": ["nom1", "nom2"]}. No generes nada más.\n\nTexto:\n${assistantResponse.slice(0, 2000)}`
    : `Here is a text. Extract ONLY the names of brands, companies, tools or products mentioned. Respond in JSON: {"brands": ["name1", "name2"]}. Generate nothing else.\n\nText:\n${assistantResponse.slice(0, 2000)}`

  try {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://crawlers.lovable.app',
        'X-Title': 'Crawlers.fr - LLM Depth',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: extractPrompt }],
        temperature: 0,
        max_tokens: 400,
      }),
    })

    if (!resp.ok) return { found: hasCandidate && brand.length > 3 }

    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content || ''

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { found: hasCandidate && brand.length > 3 }

    const parsed = JSON.parse(jsonMatch[0])
    const brands: string[] = parsed.brands || []

    for (const b of brands) {
      const bLower = b.toLowerCase()
      if (
        bLower.includes(brandLower) ||
        brandLower.includes(bLower) ||
        bLower.includes(domainLower) ||
        domainLower.includes(bLower)
      ) {
        return { found: true, mentionedAs: b }
      }
    }

    return { found: false }
  } catch {
    // Fallback: for longer brands, trust substring match
    return { found: hasCandidate && brand.length > 3 }
  }
}

// ─── Core conversation engine ────────────────────────────────────────────────

interface DepthResult {
  llm: string
  model: string
  iterations: number
  found: boolean
  mentioned_as: string | null
  conversation_summary: string
  angles_tested: string[]
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

async function runDepthConversation(
  apiKey: string,
  modelDef: ModelDef,
  brand: string,
  domain: string,
  prompts: string[],
  lang: string,
): Promise<DepthResult> {
  const isFr = lang === 'fr'
  const isEs = lang === 'es'

  const systemPrompt = isFr
    ? `Tu es un consultant indépendant qui aide les entreprises à trouver les meilleurs outils et prestataires. Tu donnes des recommandations honnêtes et exhaustives en citant des noms précis de marques et d'entreprises. Tu ne connais pas à l'avance ce que cherche l'utilisateur.`
    : isEs
    ? `Eres un consultor independiente que ayuda a las empresas a encontrar las mejores herramientas y proveedores. Das recomendaciones honestas y exhaustivas citando nombres precisos de marcas y empresas. No sabes de antemano lo que busca el usuario.`
    : `You are an independent consultant helping businesses find the best tools and providers. You give honest and exhaustive recommendations citing precise brand and company names. You don't know in advance what the user is looking for.`

  const messages: { role: string; content: string }[] = [
    { role: 'system', content: systemPrompt },
  ]

  const anglesLabels = isFr
    ? ['Besoin générique', 'Cas d\'usage', 'Fonctionnalités', 'Budget', 'Géographie', 'Niche', 'Exhaustif']
    : isEs
    ? ['Necesidad genérica', 'Caso de uso', 'Funcionalidades', 'Presupuesto', 'Geografía', 'Nicho', 'Exhaustivo']
    : ['Generic need', 'Use case', 'Features', 'Budget', 'Geography', 'Niche', 'Exhaustive']

  const anglesTested: string[] = []

  for (let i = 0; i < Math.min(prompts.length, MAX_ITERATIONS); i++) {
    messages.push({ role: 'user', content: prompts[i] })
    anglesTested.push(anglesLabels[i] || `Phase ${i + 1}`)

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
          model: modelDef.model,
          messages,
          temperature: 0.7,
          max_tokens: 1000,
        }),
      })

      if (!response.ok) {
        console.error(`[check-llm-depth] API error ${modelDef.name} phase ${i + 1}: ${response.status}`)
        // Don't break — try next iteration
        continue
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''

      trackPaidApiCall('check-llm-depth', 'openrouter', modelDef.model, domain)

      messages.push({ role: 'assistant', content })

      // Semantic brand detection
      const detection = await detectBrandSemantically(
        apiKey, modelDef.model, content, brand, domain, lang,
      )

      if (detection.found) {
        return {
          llm: modelDef.name,
          model: modelDef.model,
          iterations: i + 1,
          found: true,
          mentioned_as: detection.mentionedAs || brand,
          conversation_summary: content.slice(0, 400),
          angles_tested: anglesTested,
        }
      }

      // Rate-limit courtesy
      await delay(500)
    } catch (err) {
      console.error(`[check-llm-depth] Error ${modelDef.name} phase ${i + 1}:`, err)
    }
  }

  return {
    llm: modelDef.name,
    model: modelDef.model,
    iterations: MAX_ITERATIONS + 1,
    found: false,
    mentioned_as: null,
    conversation_summary: '',
    angles_tested: anglesTested,
  }
}

// ─── Persistence ─────────────────────────────────────────────────────────────

async function persistResults(
  supabase: ReturnType<typeof createClient>,
  trackedSiteId: string | null,
  userId: string | null,
  results: DepthResult[],
) {
  if (!trackedSiteId || !userId) return

  const rows = results.map(r => ({
    tracked_site_id: trackedSiteId,
    user_id: userId,
    llm_name: r.llm,
    prompt_tested: r.angles_tested.join(' → '),
    brand_found: r.found,
    iteration_found: r.found ? r.iterations : null,
    response_text: r.conversation_summary.slice(0, 500) || null,
  }))

  const { error } = await supabase.from('llm_test_executions').insert(rows)
  if (error) console.error('[check-llm-depth] Persist error:', error)
}

// ─── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const {
      domain,
      service_description,
      lang = 'fr',
      tracked_site_id,
      user_id,
      site_context,
    } = await req.json()

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
    const ctx: SiteContext = site_context || {}

    // Build service description from context — never mention the brand!
    const svcDesc = service_description ||
      (ctx.market_sector
        ? (lang === 'fr'
          ? `une solution dans le domaine "${ctx.market_sector}"`
          : lang === 'es'
          ? `una solución en el área de "${ctx.market_sector}"`
          : `a solution in the "${ctx.market_sector}" space`)
        : (lang === 'fr'
          ? `un outil ou service professionnel en ligne`
          : lang === 'es'
          ? `una herramienta o servicio profesional en línea`
          : `a professional online tool or service`))

    // Build dynamic prompt sequence
    const prompts = buildPromptSequence(svcDesc, ctx, lang)

    console.log(`[check-llm-depth] Starting for "${brand}" (${domain}) — ${MODELS.length} models × ${prompts.length} phases`)

    // Run all models in parallel
    const resultPromises = MODELS.map(m =>
      runDepthConversation(apiKey, m, brand, domain, prompts, lang)
    )
    const results = await Promise.allSettled(resultPromises)

    const successResults: DepthResult[] = results
      .filter((r): r is PromiseFulfilledResult<DepthResult> => r.status === 'fulfilled')
      .map(r => r.value)

    // Calculate weighted average depth
    const scores = successResults.map(r => r.iterations)
    const avgDepth = scores.length > 0
      ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
      : null

    // Persist to database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)
    await persistResults(supabase, tracked_site_id || null, user_id || null, successResults)

    console.log(`[check-llm-depth] ✅ ${domain}: brand="${brand}" avgDepth=${avgDepth}`,
      successResults.map(r => `${r.llm}=${r.iterations}${r.found ? '✓' : '✗'}`).join(', '))

    return new Response(JSON.stringify({
      data: {
        brand,
        domain,
        avg_depth: avgDepth,
        results: successResults,
        prompt_strategy: prompts.length + ' phases',
        measured_at: new Date().toISOString(),
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[check-llm-depth] Fatal:', error)
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
