import { corsHeaders } from '../_shared/cors.ts'
import { trackPaidApiCall } from '../_shared/tokenTracker.ts'
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { ensureSiteContext } from '../_shared/enrichSiteContext.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * check-llm-depth v3 — Natural conversational discoverability analysis
 *
 * Simulates realistic multi-turn conversations with LLMs, using prompts
 * that mimic how a real end-user would ask questions related to the entity's
 * market. Each prompt is ONE sentence max, conversational and natural.
 *
 * Prompt strategy (7 angles, natural conversation flow):
 *  1. Genuine user need (as a real customer would ask)
 *  2. Natural follow-up / precision
 *  3. Comparison / "which one is best?"
 *  4. Practical detail (price, availability, proximity)
 *  5. Personal recommendation request
 *  6. Edge case / specific scenario
 *  7. Final check / "anything else?"
 */

const MAX_ITERATIONS = 7

// ─── Models ──────────────────────────────────────────────────────────────────
type Gateway = 'openrouter' | 'lovable'
interface ModelDef { id: string; name: string; model: string; gateway: Gateway; fallbackGateway?: Gateway }
const MODELS: ModelDef[] = [
  { id: 'chatgpt',    name: 'ChatGPT',    model: 'openai/gpt-4o-mini',         gateway: 'openrouter' },
  { id: 'gemini',     name: 'Gemini',      model: 'google/gemini-2.5-flash',    gateway: 'openrouter', fallbackGateway: 'lovable' },
  { id: 'claude',     name: 'Claude',      model: 'anthropic/claude-3-haiku',   gateway: 'openrouter' },
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
  entity_type?: string        // 'business' | 'media' | 'blog' | 'institutional'
  media_specialties?: string[] // e.g. ['politique', 'économie']
}

// ─── Dynamic prompt sequence builder ─────────────────────────────────────────
// IMPORTANT: Iterations 1-3 MUST match calculate-llm-visibility prompts exactly
// for score coherence between Benchmark and Depth analyses.

function buildPromptSequence(
  serviceDesc: string,
  ctx: SiteContext,
  lang: string,
): string[] {
  const isFr = lang === 'fr'
  const isEs = lang === 'es'
  const isMedia = ctx.entity_type === 'media' || ctx.entity_type === 'blog'

  // ═══ MEDIA/BLOG: keyword-based queries like a user would type in Google ═══
  if (isMedia) {
    return buildMediaPromptSequence(ctx, isFr, isEs)
  }

  // ═══ BUSINESS: natural customer questions ═══
  return buildBusinessPromptSequence(serviceDesc, ctx, isFr, isEs)
}

/**
 * Media/blog prompt sequence: simulates real information-seeking queries.
 * A media doesn't sell anything — it wants to be CITED as a source.
 * Queries are short, natural, like what you'd type in Google or ask an AI.
 */
function buildMediaPromptSequence(
  ctx: SiteContext,
  isFr: boolean,
  isEs: boolean,
): string[] {
  const specialties = ctx.media_specialties || []
  const sector = ctx.market_sector || ''
  const topics = ctx.products_services || '' // For media, this stores "sujets couverts"

  // Pick a specialty or fallback to sector
  const mainTopic = specialties[0] || sector || topics.split(',')[0]?.trim() || ''
  const secondTopic = specialties[1] || (topics.split(',')[1]?.trim()) || ''

  // Iteration 1 — A real user question about current events / the topic
  const p1 = mainTopic
    ? (isFr ? `C'est quoi l'actu ${mainTopic} du moment ?`
      : isEs ? `¿Qué hay de nuevo en ${mainTopic}?`
      : `What's the latest news on ${mainTopic}?`)
    : (isFr ? "C'est quoi les infos du jour ?"
      : isEs ? "¿Cuáles son las noticias del día?"
      : "What's today's news?")

  // Iteration 2 — A more specific factual question
  const p2 = mainTopic
    ? (isFr ? `Tu peux me résumer ce qui s'est passé récemment en ${mainTopic} ?`
      : isEs ? `¿Puedes resumirme lo que ha pasado recientemente en ${mainTopic}?`
      : `Can you summarize what happened recently in ${mainTopic}?`)
    : (isFr ? "Résume-moi l'actualité de cette semaine."
      : isEs ? "Resúmeme las noticias de esta semana."
      : "Summarize this week's news for me.")

  // Iteration 3 — Ask for sources
  const p3 = isFr
    ? "Où est-ce que tu trouves ces infos ? Quelles sont tes sources ?"
    : isEs
    ? "¿Dónde encuentras esa información? ¿Cuáles son tus fuentes?"
    : "Where do you get that info? What are your sources?"

  // Iteration 4 — Second specialty or deeper dive
  const p4 = secondTopic
    ? (isFr ? `Et côté ${secondTopic}, il s'est passé quoi dernièrement ?`
      : isEs ? `¿Y en cuanto a ${secondTopic}, qué ha pasado últimamente?`
      : `And regarding ${secondTopic}, what happened lately?`)
    : (isFr ? "C'est quoi les sites les plus fiables pour s'informer sur ce sujet ?"
      : isEs ? "¿Cuáles son los sitios más confiables para informarse sobre este tema?"
      : "What are the most reliable sites to get info on this topic?")

  // Iteration 5 — Ask for recommended media/sources
  const p5 = isFr
    ? "Tu me conseillerais quels sites ou médias pour suivre ça ?"
    : isEs
    ? "¿Qué sitios o medios me recomendarías para seguir esto?"
    : "Which sites or media would you recommend to follow this?"

  // Iteration 6 — Niche / lesser-known sources
  const p6 = isFr
    ? "Et des médias moins connus mais de qualité, t'en connais ?"
    : isEs
    ? "¿Y medios menos conocidos pero de calidad, conoces alguno?"
    : "Any lesser-known but quality media outlets you know?"

  // Iteration 7 — Final check
  const p7 = isFr
    ? "T'as pas oublié de sources ? Vraiment aucun autre média ?"
    : isEs
    ? "¿No olvidaste fuentes? ¿Ningún otro medio?"
    : "Didn't you forget any sources? No other media at all?"

  return [p1, p2, p3, p4, p5, p6, p7]
}

/**
 * Business prompt sequence: natural customer questions.
 * Each prompt is ONE sentence max, conversational.
 */
function buildBusinessPromptSequence(
  serviceDesc: string,
  ctx: SiteContext,
  isFr: boolean,
  isEs: boolean,
): string[] {
  const products = ctx.products_services || ''
  const area = ctx.commercial_area || ''
  const target = ctx.target_audience || ''

  // Iteration 1 — Genuine user need
  const p1 = buildNaturalFirstPrompt(products, area, target, isFr, isEs)

  // Iteration 2 — Natural follow-up
  const p2 = isFr
    ? "Ok et t'aurais pas d'autres idées ?"
    : isEs ? "Ok, ¿y no tienes otras ideas?" : "Ok, any other ideas?"

  // Iteration 3 — Comparison
  const p3 = isFr
    ? "Lequel tu me recommanderais vraiment si tu devais en choisir un seul ?"
    : isEs ? "¿Cuál me recomendarías de verdad si tuvieras que elegir uno solo?"
    : "Which one would you really recommend if you had to pick just one?"

  // Phase 4 — Practical detail
  const p4 = area
    ? (isFr ? `Et pas loin de ${area}, y'a quoi ?`
      : isEs ? `¿Y cerca de ${area}, qué hay?`
      : `And near ${area}, what's available?`)
    : (isFr ? "C'est quoi le moins cher ?"
      : isEs ? "¿Cuál es el más barato?" : "Which one is the cheapest?")

  // Phase 5 — Personal recommendation
  const p5 = target
    ? (isFr ? `Pour quelqu'un comme moi qui suis ${target}, tu conseillerais quoi ?`
      : isEs ? `Para alguien como yo que soy ${target}, ¿qué aconsejarías?`
      : `For someone like me who is ${target}, what would you recommend?`)
    : (isFr ? "Franchement, toi tu utiliserais lequel ?"
      : isEs ? "Sinceramente, ¿tú cuál usarías?" : "Honestly, which one would you use?")

  // Phase 6 — Outsider
  const p6 = isFr
    ? "Et si je veux un truc vraiment différent, un outsider que personne connaît ?"
    : isEs ? "¿Y si quiero algo realmente diferente, un outsider que nadie conoce?"
    : "What if I want something really different, an outsider nobody knows?"

  // Phase 7 — Final check
  const p7 = isFr
    ? "T'as rien oublié ? Vraiment aucun autre nom ?"
    : isEs ? "¿No te olvidaste de nada? ¿Ningún otro nombre?"
    : "Did you forget anything? No other names at all?"

  return [p1, p2, p3, p4, p5, p6, p7]
}

/**
 * Natural first prompt for BUSINESS entities.
 */
function buildNaturalFirstPrompt(
  products: string,
  area: string,
  target: string,
  isFr: boolean,
  isEs: boolean,
): string {
  if (products) {
    const geoSuffix = area
      ? (isFr ? ` ${area}` : isEs ? ` ${area}` : ` in ${area}`)
      : ''
    return isFr
      ? `Je cherche ${products}${geoSuffix}, t'as des idées ?`
      : isEs ? `Busco ${products}${geoSuffix}, ¿tienes ideas?`
      : `I'm looking for ${products}${geoSuffix}, any ideas?`
  }

  return isFr
    ? "J'ai besoin d'aide, tu peux me recommander quelque chose ?"
    : isEs ? "Necesito ayuda, ¿puedes recomendarme algo?"
    : "I need help, can you recommend something?"
}

// ─── Dual-gateway fetch helper ───────────────────────────────────────────────

interface ApiKeys { openrouter: string; lovable: string }

function buildFetchArgs(
  gateway: Gateway,
  keys: ApiKeys,
  model: string,
  messages: { role: string; content: string }[],
  opts: { temperature?: number; max_tokens?: number } = {},
): [string, RequestInit] {
  if (gateway === 'lovable') {
    return [LOVABLE_AI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keys.lovable}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, ...opts }),
    }]
  }
  return [OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${keys.openrouter}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://crawlers.fr',
      'X-Title': 'Crawlers.fr - LLM Depth',
    },
    body: JSON.stringify({ model, messages, ...opts }),
  }]
}

// ─── Resilient fetch with gateway fallback ──────────────────────────────────

async function resilientFetch(
  gateway: Gateway,
  fallbackGateway: Gateway | undefined,
  keys: ApiKeys,
  model: string,
  messages: { role: string; content: string }[],
  opts: { temperature?: number; max_tokens?: number } = {},
  context?: string,
): Promise<{ response: Response; usedGateway: Gateway; didFallback: boolean }> {
  const [url, init] = buildFetchArgs(gateway, keys, model, messages, opts)
  const response = await fetch(url, init)

  // If primary fails with 402/429 and we have a fallback, try it
  if ((response.status === 402 || response.status === 429) && fallbackGateway && keys[fallbackGateway]) {
    console.warn(`[check-llm-depth] ${gateway} returned ${response.status} for ${model}, falling back to ${fallbackGateway}${context ? ` (${context})` : ''}`)

    // Log fallback event for admin monitoring
    logFallbackEvent(gateway, fallbackGateway, model, response.status, context)

    const [fbUrl, fbInit] = buildFetchArgs(fallbackGateway, keys, model, messages, opts)
    const fbResponse = await fetch(fbUrl, fbInit)
    return { response: fbResponse, usedGateway: fallbackGateway, didFallback: true }
  }

  return { response, usedGateway: gateway, didFallback: false }
}

// ─── Fallback event logger ──────────────────────────────────────────────────

function logFallbackEvent(
  primaryGateway: string,
  fallbackGateway: string,
  model: string,
  statusCode: number,
  context?: string,
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceKey) return

  fetch(`${supabaseUrl}/rest/v1/analytics_events`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({
      event_type: 'api_gateway_fallback',
      target_url: context || model,
      event_data: {
        primary_gateway: primaryGateway,
        fallback_gateway: fallbackGateway,
        model,
        status_code: statusCode,
        function_name: 'check-llm-depth',
      },
    }),
  }).catch(e => console.error('[check-llm-depth] Fallback log error:', e))
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
  keys: ApiKeys,
  gateway: Gateway,
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
    const [url, init] = buildFetchArgs(gateway, keys, model, [{ role: 'user', content: extractPrompt }], { temperature: 0, max_tokens: 400 })
    const resp = await fetch(url, init)

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

interface ConversationTurn {
  iteration: number
  prompt: string
  response_summary: string
}

interface DepthResult {
  llm: string
  model: string
  iterations: number
  found: boolean
  mentioned_as: string | null
  conversation_summary: string
  angles_tested: string[]
  conversation_turns: ConversationTurn[]
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

type StreamCallback = (event: { type: string; model: string; iteration?: number; found?: boolean; mentioned_as?: string | null }) => void

/**
 * Summarize a response to 3 sentences max using a fast LLM
 */
async function summarizeResponse(
  keys: ApiKeys,
  gateway: Gateway,
  model: string,
  responseText: string,
  lang: string,
): Promise<string> {
  if (responseText.length < 200) return responseText

  const prompt = lang === 'fr'
    ? `Résume ce texte en 3 phrases maximum, en conservant les noms de marques/outils mentionnés :\n\n${responseText.slice(0, 2000)}`
    : lang === 'es'
    ? `Resume este texto en 3 frases máximo, conservando los nombres de marcas/herramientas mencionados:\n\n${responseText.slice(0, 2000)}`
    : `Summarize this text in 3 sentences max, keeping brand/tool names mentioned:\n\n${responseText.slice(0, 2000)}`

  try {
    const [url, init] = buildFetchArgs(gateway, keys, model, [
      { role: 'user', content: prompt },
    ], { temperature: 0.2, max_tokens: 300 })
    const resp = await fetch(url, init)
    if (!resp.ok) return responseText.slice(0, 400)
    const data = await resp.json()
    return data.choices?.[0]?.message?.content?.trim() || responseText.slice(0, 400)
  } catch {
    return responseText.slice(0, 400)
  }
}

async function runDepthConversation(
  keys: ApiKeys,
  modelDef: ModelDef,
  brand: string,
  domain: string,
  prompts: string[],
  lang: string,
  onProgress?: StreamCallback,
): Promise<DepthResult> {
  const isFr = lang === 'fr'
  const isEs = lang === 'es'

  const systemPrompt = isFr
    ? `Tu es un assistant utile et honnête. Tu réponds de façon naturelle et conversationnelle. Quand on te demande des recommandations, cite des noms précis.`
    : isEs
    ? `Eres un asistente útil y honesto. Respondes de forma natural y conversacional. Cuando te piden recomendaciones, cita nombres precisos.`
    : `You are a helpful and honest assistant. You answer naturally and conversationally. When asked for recommendations, cite precise names.`

  const messages: { role: string; content: string }[] = [
    { role: 'system', content: systemPrompt },
  ]

  const anglesLabels = isFr
    ? ['Besoin réel', 'Relance', 'Comparaison', 'Détail pratique', 'Reco perso', 'Outsider', 'Vérification']
    : isEs
    ? ['Necesidad real', 'Seguimiento', 'Comparación', 'Detalle práctico', 'Reco personal', 'Outsider', 'Verificación']
    : ['Real need', 'Follow-up', 'Comparison', 'Practical detail', 'Personal reco', 'Outsider', 'Final check']

  const anglesTested: string[] = []
  let lastAssistantContent = ''
  const conversationTurns: ConversationTurn[] = []

  // Track which gateway is active (may change on fallback)
  let activeGateway: Gateway = modelDef.gateway

  for (let i = 0; i < Math.min(prompts.length, MAX_ITERATIONS); i++) {
    messages.push({ role: 'user', content: prompts[i] })
    anglesTested.push(anglesLabels[i] || `Phase ${i + 1}`)

    // Emit progress event
    onProgress?.({ type: 'iteration', model: modelDef.name, iteration: i + 1, found: false })

    try {
      const { response, usedGateway, didFallback } = await resilientFetch(
        activeGateway, modelDef.fallbackGateway, keys, modelDef.model, messages,
        { temperature: 0.7, max_tokens: 1000 },
        `${domain} phase ${i + 1}`,
      )

      // If we fell back, stick with fallback for remaining phases
      if (didFallback) activeGateway = usedGateway

      if (!response.ok) {
        console.error(`[check-llm-depth] API error ${modelDef.name} phase ${i + 1}: ${response.status} (${usedGateway})`)
        continue
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''
      if (content) lastAssistantContent = content

      const provider = usedGateway === 'lovable' ? 'lovable-ai' : 'openrouter'
      trackPaidApiCall('check-llm-depth', provider, modelDef.model, domain)

      messages.push({ role: 'assistant', content })

      // Summarize response to 3 sentences for storage
      const summary = await summarizeResponse(keys, activeGateway, modelDef.model, content, lang)
      conversationTurns.push({
        iteration: i + 1,
        prompt: prompts[i],
        response_summary: summary,
      })

      // Semantic brand detection (uses active gateway)
      const detection = await detectBrandSemantically(
        keys, activeGateway, modelDef.model, content, brand, domain, lang,
      )

      if (detection.found) {
        onProgress?.({ type: 'found', model: modelDef.name, iteration: i + 1, found: true, mentioned_as: detection.mentionedAs || brand })
        return {
          llm: modelDef.name,
          model: modelDef.model,
          iterations: i + 1,
          found: true,
          mentioned_as: detection.mentionedAs || brand,
          conversation_summary: content.slice(0, 400),
          angles_tested: anglesTested,
          conversation_turns: conversationTurns,
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
    conversation_summary: lastAssistantContent.slice(0, 400),
    angles_tested: anglesTested,
    conversation_turns: conversationTurns,
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
    source_function: 'check-llm-depth',
  }))

  const { error } = await supabase.from('llm_test_executions').insert(rows)
  if (error) console.error('[check-llm-depth] Persist error:', error)

  // Store conversation turns for paid subscribers (7-day TTL handled by expires_at default)
  const convRows = results.flatMap(r =>
    r.conversation_turns.map(turn => ({
      tracked_site_id: trackedSiteId,
      user_id: userId,
      llm_name: r.llm,
      iteration: turn.iteration,
      prompt_text: turn.prompt,
      response_summary: turn.response_summary,
    }))
  )

  if (convRows.length > 0) {
    // Clean up old conversations for this site+user first
    await supabase
      .from('llm_depth_conversations')
      .delete()
      .eq('tracked_site_id', trackedSiteId)
      .eq('user_id', userId)

    const { error: convError } = await supabase.from('llm_depth_conversations').insert(convRows)
    if (convError) console.error('[check-llm-depth] Conversation persist error:', convError)
  }
}

// ─── Main handler ────────────────────────────────────────────────────────────

Deno.serve(handleRequest(async (req) => {
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

    const openrouterKey = Deno.env.get('OPENROUTER_API_KEY')
    const lovableKey = Deno.env.get('LOVABLE_API_KEY')
    if (!openrouterKey && !lovableKey) {
      return new Response(JSON.stringify({ error: 'No API keys configured (OpenRouter or Lovable AI)' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const keys: ApiKeys = {
      openrouter: openrouterKey || '',
      lovable: lovableKey || '',
    }

    const brand = extractBrand(domain)

    // ── Auto-enrich site identity card if empty ──
    let ctx: SiteContext = site_context || {}
    if (!ctx.market_sector && !ctx.products_services && tracked_site_id) {
      // Fetch site from DB and enrich via LLM if needed
      const sbEnrich = getServiceClient()
      const { data: siteData } = await sbEnrich
        .from('tracked_sites')
        .select('*')
        .eq('id', tracked_site_id)
        .single()
      if (siteData) {
        const enriched = await ensureSiteContext(siteData)
        ctx = enriched
      }
    }

    // svcDesc is only used as fallback — prompts are now built naturally from ctx
    const svcDesc = service_description || ctx.products_services || ctx.market_sector || ''

    // Build dynamic prompt sequence
    const prompts = buildPromptSequence(svcDesc, ctx, lang)

    console.log(`[check-llm-depth] Starting for "${brand}" (${domain}) — ${MODELS.length} models × ${prompts.length} phases`)

    // ── Check shared domain cache first (24h TTL) ──
    const sb = getServiceClient()

    const { data: cachedDepth } = await sb
      .from('domain_data_cache')
      .select('result_data')
      .eq('domain', domain)
      .eq('data_type', 'llm_depth')
      .is('week_start_date', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (cachedDepth?.result_data) {
      console.log(`[check-llm-depth] ♻️ ${domain} — cache hit`)
      const cached = cachedDepth.result_data as any

      // Still persist to user's tables so their dashboard works
      if (cached.results?.length > 0 && tracked_site_id && user_id) {
        await persistResults(sb, tracked_site_id, user_id, cached.results)
      }

      // Return as SSE stream (single done event) for compatibility
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', data: cached })}\n\n`))
          controller.close()
        },
      })
      return new Response(stream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    // ── Streaming mode ──────────────────────────────────────────────────
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }

        // Progress callback shared by all models
        const onProgress: StreamCallback = (evt) => {
          try { send(evt) } catch { /* stream closed */ }
        }

        // Run all models in parallel with streaming callbacks
        const resultPromises = MODELS.map(m =>
          runDepthConversation(keys, m, brand, domain, prompts, lang, onProgress)
        )
        const results = await Promise.allSettled(resultPromises)

        const successResults: DepthResult[] = results
          .filter((r): r is PromiseFulfilledResult<DepthResult> => r.status === 'fulfilled')
          .map(r => r.value)

        const allEmpty = successResults.every(r => !r.found && !r.conversation_summary)

        const scores = successResults.map(r => r.iterations)
        const avgDepth = scores.length > 0
          ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
          : null

        // Persist to user tables
        if (!allEmpty) {
          await persistResults(sb, tracked_site_id || null, user_id || null, successResults)
        }

        const finalData = {
          brand,
          domain,
          avg_depth: allEmpty ? null : avgDepth,
          results: allEmpty ? [] : successResults,
          prompt_strategy: prompts.length + ' phases',
          measured_at: new Date().toISOString(),
          ...(allEmpty ? { error_code: 'credits_exhausted' } : {}),
        }

        // Write to shared domain cache (2h TTL — Pro Agency+ can refresh unlimited but backend throttles to every 2h)
        if (!allEmpty) {
          await sb.from('domain_data_cache').upsert({
            domain,
            data_type: 'llm_depth',
            week_start_date: null,
            result_data: finalData,
            expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          }, { onConflict: 'domain,data_type,week_start_date' })
        }

        // Send final result
        send({ type: 'done', data: finalData })

        console.log(`[check-llm-depth] ${allEmpty ? '❌ ALL MODELS FAILED' : '✅'} ${domain}: brand="${brand}" avgDepth=${avgDepth}`,
          successResults.map(r => `${r.llm}=${r.iterations}${r.found ? '✓' : '✗'}`).join(', '))

        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
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
