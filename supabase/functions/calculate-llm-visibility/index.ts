import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { trackTokenUsage, trackPaidApiCall } from '../_shared/tokenTracker.ts'
import { ensureSiteContext } from '../_shared/enrichSiteContext.ts'
import { generateNaturalPrompts, type SiteContext as NaturalSiteContext } from '../_shared/naturalPrompts.ts'
import { buildLlmBenchmarks } from '../_shared/llmBenchmarks.ts'
import { naturalizeBenchmarkQuestions } from '../_shared/benchmarkQuestionWriter.ts'
import { selectQuestionTopics, isToolLikeSite } from '../_shared/questionTopics.ts'
import { resolveIdentityCard } from '../_shared/identityResolver.ts'
import { buildAggregate, computeCoverage } from '../_shared/llmVisibilityScore.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * calculate-llm-visibility v3
 *
 * Parallelized LLM visibility scoring engine.
 * All LLMs are queried in parallel to avoid timeout.
 *
 * Scoring dimensions (per prompt × LLM):
 *   1. Iteration depth    — how quickly the brand surfaces (1st=100, 2nd=50, 3rd=25, absent=0)
 *   2. Position rank      — where in a list the brand appears (top=1.0x … bottom=0.4x)
 *   3. Sentiment signal   — recommended/positive=+20%, neutral=0, negative/warning=-30%
 *   4. Mention richness   — described in detail vs just name-dropped (bonus up to +15%)
 *
 * Final per-LLM score = weighted average across prompts, capped 0–100.
 */

// ─── Scoring config ───
const ITERATION_WEIGHT: Record<number, number> = { 1: 100, 2: 50, 3: 25 }
const ITERATION_DEFAULT = 0

const POSITION_MULTIPLIERS: Record<number, number> = {
  1: 1.0, 2: 0.9, 3: 0.8, 4: 0.7, 5: 0.6,
}
const POSITION_DEFAULT = 0.4

const SENTIMENT_BONUS: Record<string, number> = {
  recommended: 20,
  positive: 15,
  neutral: 0,
  mentioned: -5,
  negative: -30,
}

const MAX_RICHNESS_BONUS = 15

// ─── LLM targets (via OpenRouter) ───
// `models` = [primaire, secours]. Si le primaire échoue techniquement (id retiré
// du catalogue, 404, timeout), on rejoue immédiatement sur le secours afin que
// les 5 modèles affichés dans les rapports soient réellement mesurés.
const LLM_TARGETS = [
  { id: 'chatgpt',    name: 'ChatGPT',    models: ['openai/gpt-5.4', 'openai/gpt-5.4-mini'] },
  { id: 'gemini',     name: 'Gemini',     models: ['google/gemini-3-flash-preview', 'google/gemini-3.5-flash'] },
  { id: 'perplexity', name: 'Perplexity', models: ['perplexity/sonar', 'perplexity/sonar-pro'] },
  { id: 'claude',     name: 'Claude',     models: ['anthropic/claude-3-haiku', 'anthropic/claude-haiku-4.5'] },
  { id: 'mistral',    name: 'Mistral',    models: ['mistralai/mistral-medium-3.1', 'mistralai/mistral-small-3.2-24b-instruct'] },
]

const NUM_PROMPTS = 3 // 3 intentions contrastées (besoin, comparatif, local/audience)

// ═══════════════════════════════════════════════
// BRAND DETECTION
// ═══════════════════════════════════════════════

interface BrandPatterns {
  exact: string[]
  regex: RegExp[]
}

function buildBrandPatterns(site: any): BrandPatterns {
  const exact: string[] = []
  const regex: RegExp[] = []

  const domain = (site.domain || '').trim()
  // Les tracked_sites créés automatiquement par Marina peuvent porter un nom
  // technique « Marina: domaine.tld ». Ce libellé n'est jamais une marque et
  // ne doit pas entrer dans la détection des citations.
  const rawSiteName = (site.site_name || '').trim()
  const siteName = /^marina\s*:/i.test(rawSiteName) ? '' : rawSiteName

  if (siteName && siteName.length > 2) {
    exact.push(siteName.toLowerCase())
    const collapsed = siteName.toLowerCase().replace(/[\s\-_.]+/g, '')
    if (collapsed !== siteName.toLowerCase()) exact.push(collapsed)
  }

  if (domain) {
    const domainLower = domain.toLowerCase()
    exact.push(domainLower)
    const withoutTld = domainLower.split('.')[0]
    if (withoutTld.length > 2) exact.push(withoutTld)
    const escaped = domainLower.replace(/\./g, '[\\s.\\-]?')
    try { regex.push(new RegExp(escaped, 'i')) } catch { /* skip */ }
  }

  return { exact: [...new Set(exact)], regex }
}

function findBrandInText(text: string, patterns: BrandPatterns): boolean {
  const lower = text.toLowerCase()
  for (const e of patterns.exact) {
    const idx = lower.indexOf(e)
    if (idx !== -1) {
      const before = idx > 0 ? lower[idx - 1] : ' '
      const after = idx + e.length < lower.length ? lower[idx + e.length] : ' '
      const isBoundary = (c: string) => /[\s,.:;!?()[\]{}/"'<>—–\-]/.test(c)
      if (isBoundary(before) && isBoundary(after)) return true
      if (idx === 0 || idx + e.length === lower.length) return true
    }
  }
  for (const r of patterns.regex) {
    if (r.test(text)) return true
  }
  return false
}

// ═══════════════════════════════════════════════
// POSITION EXTRACTION
// ═══════════════════════════════════════════════

function extractPositionRank(text: string, patterns: BrandPatterns): number {
  const lines = text.split('\n')
  for (const line of lines) {
    const rankMatch = line.match(/(?:^|\*{0,2})[\s#\-]*(\d{1,2})[.):\s]/)
    if (rankMatch && findBrandInText(line, patterns)) {
      return parseInt(rankMatch[1], 10)
    }
  }
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim())
  for (let i = 0; i < paragraphs.length; i++) {
    if (findBrandInText(paragraphs[i], patterns)) {
      return i + 1
    }
  }
  return 0
}

// ═══════════════════════════════════════════════
// SENTIMENT ANALYSIS
// ═══════════════════════════════════════════════

type SentimentLabel = 'recommended' | 'positive' | 'neutral' | 'mentioned' | 'negative'

function analyzeSentiment(text: string, patterns: BrandPatterns): SentimentLabel {
  const sentences = text.split(/[.!?\n]+/)
  const brandSentences = sentences.filter(s => findBrandInText(s, patterns))
  if (brandSentences.length === 0) return 'mentioned'

  const context = brandSentences.join(' ').toLowerCase()

  const negativePatterns = [
    /\bévite[rz]?\b/, /\bpas recommand/, /\bà éviter\b/, /\bméfie/,
    /\battention à\b/, /\binconvénient/, /\bproblème/, /\brisque/,
    /\bfaible qualité/, /\bdécevant/, /\bne recommande pas/,
    /\bavoid\b/, /\bnot recommend/, /\bpoor quality/, /\bdisappointing/,
  ]
  if (negativePatterns.some(p => p.test(context))) return 'negative'

  const recommendPatterns = [
    /\bje (?:te |vous )?recommande\b/, /\bexcellent(?:e)?\b/,
    /\bmeilleur(?:e)?(?:s)?\b/, /\btop\b/, /\bincontournable\b/,
    /\bparfait(?:e)?\b/, /\bréférence\b/, /\bje conseille\b/,
    /\bi recommend\b/, /\bbest\b/, /\btop pick\b/, /\bhighly recommend/,
    /\bstandout\b/, /\bleading\b/,
  ]
  if (recommendPatterns.some(p => p.test(context))) return 'recommended'

  const positivePatterns = [
    /\bbon(?:ne)?\b/, /\bfiable\b/, /\befficace\b/, /\bintéressant/,
    /\bpopulaire\b/, /\bsolide\b/, /\breconnu/, /\bapprécié/,
    /\bgood\b/, /\breliable\b/, /\beffective\b/, /\bsolid\b/,
    /\bwell.known\b/, /\btrusted\b/,
  ]
  if (positivePatterns.some(p => p.test(context))) return 'positive'

  return 'neutral'
}

// ═══════════════════════════════════════════════
// MENTION RICHNESS
// ═══════════════════════════════════════════════

function measureRichness(text: string, patterns: BrandPatterns): number {
  const sentences = text.split(/[.!?\n]+/)
  const brandSentences = sentences.filter(s => findBrandInText(s, patterns))
  const totalWords = brandSentences.join(' ').split(/\s+/).length

  if (totalWords < 10) return 0
  if (totalWords < 20) return 5
  if (totalWords < 30) return 10
  return MAX_RICHNESS_BONUS
}

// ═══════════════════════════════════════════════
// COMPOSITE SCORE
// ═══════════════════════════════════════════════

interface PromptScore {
  iterationFound: number
  rawIterationScore: number
  positionRank: number
  positionMultiplier: number
  sentiment: SentimentLabel
  sentimentBonus: number
  richnessBonus: number
  compositeScore: number
}

function scorePromptResult(
  iterationFound: number,
  responseText: string,
  patterns: BrandPatterns,
): PromptScore {
  const rawIterationScore = ITERATION_WEIGHT[iterationFound] ?? ITERATION_DEFAULT

  if (iterationFound === 0 || !responseText) {
    return {
      iterationFound: 0, rawIterationScore: 0, positionRank: 0,
      positionMultiplier: 0, sentiment: 'mentioned', sentimentBonus: 0,
      richnessBonus: 0, compositeScore: 0,
    }
  }

  const positionRank = extractPositionRank(responseText, patterns)
  const positionMultiplier = positionRank > 0
    ? (POSITION_MULTIPLIERS[positionRank] ?? POSITION_DEFAULT)
    : 0.5

  const sentiment = analyzeSentiment(responseText, patterns)
  const sentimentBonus = SENTIMENT_BONUS[sentiment] ?? 0
  const richnessBonus = measureRichness(responseText, patterns)

  const base = rawIterationScore * positionMultiplier
  const composite = Math.max(0, Math.min(100, Math.round(base + sentimentBonus + richnessBonus)))

  return {
    iterationFound, rawIterationScore, positionRank, positionMultiplier,
    sentiment, sentimentBonus, richnessBonus, compositeScore: composite,
  }
}

// ═══════════════════════════════════════════════
// PROMPT GENERATION — 3 benchmarks × 3 questions (voir _shared/llmBenchmarks.ts)
// Les relances de conversation restent issues de naturalPrompts.
// ═══════════════════════════════════════════════



function getFollowUpPrompts(site: any): string[] {
  const ctx: NaturalSiteContext = {
    entity_type: site.entity_type,
    media_specialties: site.media_specialties,
    commercial_area: site.commercial_area,
    target_audience: site.target_audience,
    business_model: site.business_model,
    brand_name: site.brand_name,
    site_name: site.site_name,
  }
  const { followUps } = generateNaturalPrompts({ site: ctx, lang: 'fr', maxPrompts: 1, domain: site.domain })
  return followUps
}


async function queryWithIterations(
  apiKey: string,
  model: string,
  prompt: string,
  patterns: BrandPatterns,
  domain: string,
  followUpPrompts: string[] = ["Ok et t'aurais pas d'autres idées ?", "Lequel tu me recommanderais vraiment si tu devais en choisir un seul ?"],
): Promise<{ iteration_found: number; response_text: string; measured: boolean; error?: string }> {
  // P0-1 : un échec technique (HTTP !ok, timeout, exception) ne doit JAMAIS être
  // compté comme « la marque n'est pas citée ». On renvoie measured=false et le
  // modèle est exclu du score au lieu d'être noté 0.
  let failure: string | undefined
  const messages: Array<{ role: string; content: string }> = [
    { role: 'user', content: prompt },
  ]

  for (let iteration = 1; iteration <= 3; iteration++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 12000) // 12s timeout per call

      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://crawlers.fr',
          'X-Title': 'Crawlers.fr - LLM Visibility Tracker',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.4,
          max_tokens: 600,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!resp.ok) {
        console.error(`[llm-vis] ${model} it${iteration} HTTP ${resp.status}`)
        if (iteration === 1) failure = `http_${resp.status}`
        break
      }

      const data = await resp.json()
      const content = data.choices?.[0]?.message?.content || ''

      trackTokenUsage('calculate-llm-visibility', model, data.usage, domain)

      if (findBrandInText(content, patterns)) {
        return { iteration_found: iteration, response_text: content, measured: true }
      }

      messages.push({ role: 'assistant', content })

      if (iteration <= 2) {
        messages.push({ role: 'user', content: followUpPrompts[iteration - 1] })
      }
    } catch (err) {
      console.error(`[llm-vis] ${model} it${iteration} error:`, err)
      if (iteration === 1) failure = err instanceof Error ? (err.name || err.message) : 'unknown_error'
      break
    }
  }

  return { iteration_found: 0, response_text: '', measured: !failure, error: failure }
}

/**
 * Joue le prompt sur le modèle primaire ; si l'appel échoue techniquement
 * (measured=false : id de modèle retiré, 404, timeout), rejoue sur le modèle de
 * secours. Garantit que les 5 familles affichées dans le rapport sont mesurées.
 */
async function queryWithFallback(
  apiKey: string,
  models: string[],
  prompt: string,
  patterns: BrandPatterns,
  domain: string,
  followUpPrompts: string[],
): Promise<{ iteration_found: number; response_text: string; measured: boolean; error?: string; model_used: string }> {
  let last: { iteration_found: number; response_text: string; measured: boolean; error?: string; model_used: string } =
    { iteration_found: 0, response_text: '', measured: false, error: 'no_model', model_used: models[0] }
  for (const model of models) {
    const r = await queryWithIterations(apiKey, model, prompt, patterns, domain, followUpPrompts)
    if (r.measured) return { ...r, model_used: model }
    last = { ...r, model_used: model }
    console.warn(`[llm-vis] ${domain}: ${model} non mesuré (${r.error}) → bascule modèle de secours`)
  }
  return last
}

// ═══════════════════════════════════════════════
// AGGREGATE SCORE
// ═══════════════════════════════════════════════

function aggregateLLMScore(promptScores: PromptScore[]): number {
  if (promptScores.length === 0) return 0
  const totalScore = promptScores.reduce((sum, ps) => sum + ps.compositeScore, 0)
  return Math.round(Math.max(0, Math.min(100, totalScore / promptScores.length)))
}

function getWeekStart(): string {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((day + 6) % 7))
  return monday.toISOString().split('T')[0]
}

// ═══════════════════════════════════════════════
// MAIN HANDLER — Parallelized across LLMs
// ═══════════════════════════════════════════════

Deno.serve(handleRequest(async (req) => {
const openrouterKey = Deno.env.get('OPENROUTER_API_KEY')

  if (!openrouterKey) {
    return jsonError('OPENROUTER_API_KEY not set', 500)
  }

  const supabase = getServiceClient()

  try {
    const { tracked_site_id, user_id, siteContext: externalContext } = await req.json()

    if (!tracked_site_id || !user_id) {
      return jsonError('Missing tracked_site_id or user_id', 400)
    }

    const { data: site, error: siteErr } = await supabase
      .from('tracked_sites')
      .select('*')
      .eq('id', tracked_site_id)
      .single()

    if (siteErr || !site) {
      return jsonError('Site not found', 404)
    }

    // ── Auto-enrich site identity card if context fields are empty ──
    const enrichedContext = await ensureSiteContext(site)

    // ── Garde d'identité : la ligne tracked_sites peut porter une identité
    // inférée depuis le seul NOM DE DOMAINE (identity_source 'llm_auto' /
    // 'llm_verified'). C'est la cause des mesures hors-sujet (un domaine
    // contenant « dicta » testé comme service de transcription) : les questions
    // portent alors sur un marché qui n'est pas celui du site, et la carte
    // erronée est réutilisée d'un audit à l'autre. Quand la source n'est pas
    // ancrée sur du contenu réellement lu, on réinfère AVANT de construire les
    // questions. `resolveIdentityCard` réutilise sans coût une carte manuelle ou
    // déjà ancrée : un seul appel de modèle, seulement quand c'est nécessaire.
    const GROUNDED_IDENTITY = ['user_manual', 'user_voice', 'marina', 'crawl', 'gmb']
    let groundedContext: Record<string, string> = {}
    if (!GROUNDED_IDENTITY.includes(String(site.identity_source || ''))) {
      try {
        const card = await resolveIdentityCard(supabase, {
          domain: String(site.domain || '').replace(/^www\./, ''),
          url: site.url || `https://${site.domain}`,
          userId: site.user_id,
          trackedSiteId: site.id,
        })
        if (card.source !== 'unresolved' && (card.marketSector || card.productsServices)) {
          groundedContext = {
            ...(card.marketSector ? { market_sector: card.marketSector } : {}),
            ...(card.productsServices ? { products_services: card.productsServices } : {}),
            ...(card.targetAudience ? { target_audience: card.targetAudience } : {}),
            ...(card.commercialArea ? { commercial_area: card.commercialArea } : {}),
            ...(card.entityType ? { entity_type: card.entityType } : {}),
          }
          console.log(`[llm-vis] Identité réancrée (source ${card.source}, ${card.pagesUsed.length} page(s) lue(s)) : ${card.marketSector || card.productsServices}`)
        }
      } catch (e) {
        console.warn('[llm-vis] Réancrage identité impossible (non bloquant) :', String((e as Error)?.message || e))
      }
    }

    // Merge: identité réancrée > caller-provided context > enriched context > site data
    const enrichedSite = {
      ...site,
      ...enrichedContext,
      ...(externalContext?.market_sector ? { market_sector: externalContext.market_sector } : {}),
      ...(externalContext?.products_services ? { products_services: externalContext.products_services } : {}),
      ...(externalContext?.target_audience ? { target_audience: externalContext.target_audience } : {}),
      ...(externalContext?.commercial_area ? { commercial_area: externalContext.commercial_area } : {}),
      ...(externalContext?.entity_type ? { entity_type: externalContext.entity_type } : {}),
      ...groundedContext,
    }
    if (externalContext?.market_sector) {
      console.log(`[llm-vis] Using caller-provided context override (sector: ${externalContext.market_sector})`)
    }


    const patterns = buildBrandPatterns(enrichedSite)
    // Étape préalable déterministe : quels besoins concrets faut-il tester ?
    // Priorité aux requêtes réelles du marché (keyword_universe), sinon
    // carte d'identité. Évite les questions hors sol ("un outil pour Travaux…").
    const topicSelection = await selectQuestionTopics(
      supabase,
      enrichedSite.domain || site.domain || '',
      {
        products_services: enrichedSite.products_services,
        market_sector: enrichedSite.market_sector,
        value_proposition: (enrichedSite as any).value_proposition,
        secondary_propositions: (enrichedSite as any).secondary_propositions,
      },
      {
        max: 3,
        brandTerms: [enrichedSite.brand_name, enrichedSite.site_name].filter(Boolean) as string[],
        // Éditeur de logiciel : tester des tâches (« audit seo technique »,
        // « optimisation geo »), pas des types de prestataires qui sont sa cible.
        preferTaskTopics: isToolLikeSite({
          entity_type: enrichedSite.entity_type,
          business_model: enrichedSite.business_model,
        }),
      },
    )
    console.log(`[llm-visibility] question topics (${topicSelection.source}):`, topicSelection.selections?.map((s: any) => `${s.axis}:${s.topic}`) || topicSelection.topics)
    // 3 benchmarks = 3 zones de marché (couverte / mieux classée / non captée).
    // Dans chacun : découverte + comparaison + contexte (local si pertinent).
    let benchmarks = buildLlmBenchmarks(
      {
        market_sector: enrichedSite.market_sector,
        products_services: enrichedSite.products_services,
        target_audience: enrichedSite.target_audience,
        commercial_area: enrichedSite.commercial_area,
        entity_type: enrichedSite.entity_type,
        media_specialties: enrichedSite.media_specialties,
        business_model: enrichedSite.business_model,
        brand_name: enrichedSite.brand_name,
        site_name: enrichedSite.site_name,
        domain: enrichedSite.domain,
      },
      'fr',
      [],
      topicSelection.topics,
      topicSelection.selections || [],
    )

    const weekStart = getWeekStart()

    // ── Check shared domain cache first ──
    const { data: cachedData } = await supabase
      .from('domain_data_cache')
      .select('result_data, created_at')
      .eq('domain', site.domain)
      .eq('data_type', 'llm_visibility')
      .eq('week_start_date', weekStart)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    // Empreinte des questions : si le lexique / la carte d'identité a changé
    // depuis la mise en cache, les questions stockées ne sont plus celles qu'on
    // poserait aujourd'hui — le cache est ignoré (sinon le rapport affiche des
    // questions périmées type « un outil » pour une entreprise de travaux).
    // L'empreinte est calculée sur les questions DÉTERMINISTES (avant la
    // reformulation LLM, non reproductible) : sinon le cache serait invalidé à
    // chaque exécution et chaque audit repaierait les 45 appels modèles.
    const promptsFingerprint = benchmarks
      .flatMap((b) => b.prompts.map((p) => `${b.id}:${p.intent}:${p.text}`))
      .join('||')
    const cachedFingerprint = (cachedData?.result_data as any)?.prompts_fingerprint
    const fingerprintStale = !!cachedData?.result_data && cachedFingerprint !== promptsFingerprint
    const cacheIsComplete = (cachedData?.result_data as any)?.measurement_status !== 'processing'
    if (fingerprintStale) {
      console.log(`[llm-vis] ⟳ ${site.domain} — cache ignoré : questions obsolètes (lexique mis à jour)`)
    }

    if (cachedData?.result_data && !fingerprintStale && cacheIsComplete) {
      console.log(`[llm-vis] ♻️ ${site.domain} — cache hit for week ${weekStart}`)
      const cached = cachedData.result_data as { scores: any[]; week_start_date: string }

      // Copy scores to user's own tables for their dashboard
      for (const s of (cached.scores || [])) {
        // P0-1 : ne jamais recopier un score non mesuré (null) — sinon faux 0
        if (s.score_percentage === null || s.score_percentage === undefined) continue
        await supabase.from('llm_visibility_scores').upsert({
          tracked_site_id,
          user_id,
          llm_name: s.llm_name,
          score_percentage: s.score_percentage,
          week_start_date: weekStart,
        }, { onConflict: 'tracked_site_id,llm_name,week_start_date' })
      }

      return jsonOk({ data: cached })
    }

    // Reformulation naturelle (1 seul appel LLM pour les 9 questions), APRÈS le
    // cache : un cache hit ne doit rien coûter. Le besoin testé, l'axe de marché
    // et l'intention restent déterministes, seule la phrase devient celle d'un
    // vrai prospect. Tout échec ou toute sortie non conforme conserve la
    // formulation déterministe, question par question.
    try {
      const naturalized = await naturalizeBenchmarkQuestions(
        benchmarks,
        {
          market_sector: enrichedSite.market_sector,
          products_services: enrichedSite.products_services,
          target_audience: enrichedSite.target_audience,
          commercial_area: enrichedSite.commercial_area,
          entity_type: enrichedSite.entity_type,
          business_model: enrichedSite.business_model,
          brand_name: enrichedSite.brand_name,
          site_name: enrichedSite.site_name,
          domain: enrichedSite.domain,
        },
        'fr',
      )
      benchmarks = naturalized.benchmarks
    } catch (e) {
      console.warn('[llm-vis] réécriture des questions ignorée:', (e as Error).message)
    }

    const flatPrompts: Array<{ text: string; intent: string; benchmarkId: string }> = []
    for (const b of benchmarks) {
      for (const p of b.prompts) flatPrompts.push({ text: p.text, intent: p.intent, benchmarkId: b.id })
    }
    const prompts = flatPrompts.map((p) => p.text)


    // Persistance AVANT les appels modèles : un fournisseur lent ou une coupure
    // de l'exécution ne doit plus effacer les questions réellement envoyées.
    // Le rapport peut ainsi afficher les 3 benchmarks avec un statut non mesuré,
    // puis la ligne est remplacée par les scores complets en fin de traitement.
    const pendingScores = LLM_TARGETS.map((llm) => ({
      llm_name: llm.name,
      score_percentage: null,
      measurement_status: 'pending',
      measured_prompts: 0,
      total_prompts: prompts.length,
      details: [],
    }))
    const pendingBenchmarks = benchmarks.map((benchmark) => ({
      id: benchmark.id,
      label: benchmark.label,
      description: benchmark.description,
      prompts: benchmark.prompts,
      scores: LLM_TARGETS.map((llm) => ({
        llm_name: llm.name,
        score_percentage: null,
        measurement_status: 'pending',
        measured_prompts: 0,
        total_prompts: benchmark.prompts.length,
        details: [],
      })),
      cited_models: 0,
      measured_models: 0,
      total_models: LLM_TARGETS.length,
      coverage: computeCoverage(0, 0),
      score: null,
    }))
    await supabase.from('domain_data_cache').upsert({
      domain: site.domain,
      data_type: 'llm_visibility',
      week_start_date: weekStart,
      result_data: {
        scores: pendingScores,
        benchmarks: pendingBenchmarks,
        aggregate: buildAggregate([], 1),
        week_start_date: weekStart,
        measured_models: 0,
        total_models: LLM_TARGETS.length,
        measurement_status: 'processing',
        prompts_fingerprint: promptsFingerprint,
      },
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'domain,data_type,week_start_date' })

    console.log(`[llm-vis] 🔍 ${site.domain} — patterns: ${patterns.exact.join(', ')} — ${prompts.length} prompts × ${LLM_TARGETS.length} LLMs (parallel)`)

    // ── Run ALL LLMs in parallel ──
    const llmPromises = LLM_TARGETS.map(async (llm) => {
      // Aligné sur flatPrompts : null = prompt non mesuré (panne modèle),
      // jamais confondu avec « marque non citée ».
      const alignedScores: Array<PromptScore | null> = new Array(prompts.length).fill(null)
      const responseTexts: string[] = new Array(prompts.length).fill('')
      let failedPrompts = 0
      let lastError: string | undefined

      const followUps = getFollowUpPrompts(site)
      // Les neuf benchmarks sont indépendants. Les exécuter en série pouvait
      // monopoliser jusqu'à 9 × 3 × 12 s pour une seule famille et faire couper
      // toute la fonction avant l'écriture du cache final. La conversation reste
      // séquentielle à l'intérieur de chaque question, mais les questions sont
      // lancées ensemble : même nombre d'appels et de tokens, durée bornée par la
      // question la plus lente plutôt que par leur somme.
      const promptResults = await Promise.all(flatPrompts.map(async ({ text: prompt }, i) => {
        const result = await queryWithFallback(
          openrouterKey,
          llm.models,
          prompt,
          patterns,
          site.domain,
          followUps,
        )

        trackPaidApiCall('calculate-llm-visibility', 'openrouter', result.model_used, site.domain)
        return { ...result, prompt, index: i }
      }))

      const executionRows: Array<Record<string, unknown>> = []
      for (const { iteration_found, response_text, measured, error, prompt, index } of promptResults) {
        // P0-1 : un prompt non mesuré (panne modèle) est exclu du score et
        // n'est PAS enregistré comme « marque non trouvée ».
        if (!measured) {
          failedPrompts++
          lastError = error
          console.warn(`[llm-vis] ${site.domain} × ${llm.name}: prompt non mesuré (${error})`)
          continue
        }

        alignedScores[index] = scorePromptResult(iteration_found, response_text, patterns)
        responseTexts[index] = response_text.slice(0, 500)
        executionRows.push({
          tracked_site_id,
          user_id,
          llm_name: llm.name,
          prompt_tested: prompt,
          response_text: response_text.slice(0, 2000),
          brand_found: iteration_found > 0,
          iteration_found,
          source_function: 'calculate-llm-visibility',
        })
      }
      if (executionRows.length > 0) {
        await supabase.from('llm_test_executions').insert(executionRows)
      }

      const promptScores = alignedScores.filter((s): s is PromptScore => s !== null)
      const measuredPrompts = promptScores.length
      const score = measuredPrompts > 0 ? aggregateLLMScore(promptScores) : null

      // Aucun prompt mesuré → on n'écrit AUCUN score (0 serait un faux négatif)
      if (score !== null) {
        await supabase.from('llm_visibility_scores').upsert({
          tracked_site_id,
          user_id,
          llm_name: llm.name,
          score_percentage: score,
          week_start_date: weekStart,
        }, { onConflict: 'tracked_site_id,llm_name,week_start_date' })
      }

      const breakdown = promptScores.map((ps, i) =>
        `P${i + 1}:it${ps.iterationFound}×pos${ps.positionRank}×${ps.sentiment}=${ps.compositeScore}`
      ).join(' | ')
      console.log(`[llm-vis] ${site.domain} × ${llm.name}: ${score === null ? 'NON MESURÉ' : score + '%'} [${breakdown}] (${measuredPrompts}/${prompts.length} mesurés)`)

      // ── Save conversations for the Benchmark LLM modal ──
      const convRows = prompts.map((prompt, i) => ({
        tracked_site_id,
        user_id,
        llm_name: llm.name,
        iteration: i + 1,
        prompt_text: prompt,
        response_summary: (responseTexts[i] || '').slice(0, 2000),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }))
      // Delete old conversations for this LLM, then insert fresh ones
      await supabase
        .from('llm_depth_conversations')
        .delete()
        .eq('tracked_site_id', tracked_site_id)
        .eq('user_id', user_id)
        .eq('llm_name', llm.name)
      await supabase.from('llm_depth_conversations').insert(convRows)

      return {
        llm_name: llm.name,
        score,
        measured_prompts: measuredPrompts,
        total_prompts: prompts.length,
        failed_prompts: failedPrompts,
        measurement_status: measuredPrompts === 0 ? 'unmeasured' : (failedPrompts > 0 ? 'partial' : 'measured'),
        error: measuredPrompts === 0 ? (lastError || 'model_unavailable') : undefined,
        promptDetails: promptScores,
        alignedScores,
        responseTexts,
      }



})

    const llmResults = await Promise.all(llmPromises)

    const sentimentOf = (list: PromptScore[]): string => {
      if (list.length === 0) return 'neutral'
      const pos = list.filter(d => d.sentiment === 'recommended' || d.sentiment === 'positive').length
      const neg = list.filter(d => d.sentiment === 'negative').length
      if (pos > list.length / 2) return 'positive'
      if (neg > list.length / 2) return 'negative'
      return 'neutral'
    }

    const scores = llmResults.map(r => ({
      llm_name: r.llm_name,
      score_percentage: r.score,
      measurement_status: r.measurement_status,
      measured_prompts: r.measured_prompts,
      total_prompts: r.total_prompts,
      measurement_error: r.error,
      response_excerpt: r.responseTexts?.find(t => t)?.slice(0, 300) || '',
      overall_sentiment: sentimentOf(r.promptDetails),
      details: r.alignedScores.flatMap((ps, i) => ps === null ? [] : [{
        prompt: prompts[i],
        intent: flatPrompts[i].intent,
        benchmark_id: flatPrompts[i].benchmarkId,
        iteration_found: ps.iterationFound,
        position_rank: ps.positionRank,
        sentiment: ps.sentiment,
        richness_bonus: ps.richnessBonus,
        composite_score: ps.compositeScore,
        response_excerpt: r.responseTexts?.[i]?.slice(0, 200) || '',
      }]),
    }))

    // ── Trois benchmarks distincts : un score et une carte par intention ──
    const benchmarkResults = benchmarks.map((b) => {
      const idx = flatPrompts.map((p, i) => ({ p, i })).filter(x => x.p.benchmarkId === b.id).map(x => x.i)
      const modelScores = llmResults.map(r => {
        const own = idx.map(i => r.alignedScores[i]).filter((s): s is PromptScore => s !== null)
        const score = own.length > 0 ? aggregateLLMScore(own) : null
        return {
          llm_name: r.llm_name,
          score_percentage: score,
          measurement_status: own.length === 0 ? 'unmeasured' : (own.length < idx.length ? 'partial' : 'measured'),
          measured_prompts: own.length,
          total_prompts: idx.length,
          overall_sentiment: sentimentOf(own),
          details: idx.flatMap(i => {
            const ps = r.alignedScores[i]
            return ps === null ? [] : [{
              prompt: prompts[i],
              intent: flatPrompts[i].intent,
              iteration_found: ps.iterationFound,
              position_rank: ps.positionRank,
              sentiment: ps.sentiment,
              composite_score: ps.compositeScore,
              response_excerpt: r.responseTexts?.[i]?.slice(0, 200) || '',
            }]
          }),
        }
      })
      const measured = modelScores.filter(m => m.score_percentage !== null)

      // ── Couverture brute de l'axe : une interrogation = une question × un
      // modèle. Un « hit » est une apparition de la marque, quelle que soit
      // l'itération. Les prompts non mesurés (panne modèle) sont exclus du
      // dénominateur — jamais comptés comme des zéros.
      let axisHits = 0
      let axisObservations = 0
      for (const r of llmResults) {
        for (const i of idx) {
          const ps = r.alignedScores[i]
          if (ps === null) continue
          axisObservations++
          if (ps.iterationFound > 0) axisHits++
        }
      }

      return {
        id: b.id,
        label: b.label,
        description: b.description,
        prompts: b.prompts,
        scores: modelScores,
        cited_models: measured.filter(m => (m.score_percentage || 0) > 0).length,
        measured_models: measured.length,
        total_models: modelScores.length,
        coverage: computeCoverage(axisHits, axisObservations),
        score: measured.length > 0
          ? Math.round(measured.reduce((s, m) => s + (m.score_percentage || 0), 0) / measured.length)
          : null,
      }
    })

    // ── Agrégat : couverture globale + score de qualité PONDÉRÉ PAR AXE.
    // Une absence sur « meilleure position SERP » pèse deux fois plus qu'une
    // absence sur « potentiel non capté » (potentiel, pas échec).
    const aggregate = buildAggregate(
      benchmarkResults.map(b => ({
        id: b.id,
        label: b.label,
        score: b.score,
        hits: b.coverage.hits,
        observations: b.coverage.observations,
      })),
      1,
    )

    const unmeasured = scores.filter(s => s.measurement_status === 'unmeasured').map(s => s.llm_name)
    console.log(`[llm-vis] ✅ ${site.domain} complete: ${scores.map(s => `${s.llm_name}=${s.score_percentage === null ? 'n/m' : s.score_percentage + '%'}`).join(', ')}${unmeasured.length ? ` — non mesurés: ${unmeasured.join(', ')}` : ''}`)
    console.log(`[llm-vis] benchmarks: ${benchmarkResults.map(b => `${b.id}=${b.score === null ? 'n/m' : b.score + '%'} (${b.cited_models}/${b.measured_models} citent, couverture ${b.coverage.rate ?? 'n/m'}%)`).join(' | ')}`)
    console.log(`[llm-vis] agrégat ${site.domain}: couverture ${aggregate.coverage.hits}/${aggregate.coverage.observations} = ${aggregate.coverage.rate}% [${aggregate.coverage.ci_low}–${aggregate.coverage.ci_high}%] — qualité pondérée ${aggregate.quality_score ?? 'n/m'}/100 (plate ${aggregate.flat_score ?? 'n/m'})`)

    // ── Write to shared domain cache (2h TTL — Pro Agency+ can refresh unlimited but backend throttles to every 2h) ──
    const cachePayload = {
      scores,
      benchmarks: benchmarkResults,
      aggregate,
      week_start_date: weekStart,
      unmeasured_models: unmeasured,
      measured_models: scores.length - unmeasured.length,
      total_models: scores.length,
      measurement_status: 'completed',
      prompts_fingerprint: promptsFingerprint,
    }


    await supabase.from('domain_data_cache').upsert({
      domain: site.domain,
      data_type: 'llm_visibility',
      week_start_date: weekStart,
      result_data: cachePayload,
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'domain,data_type,week_start_date' })

    return jsonOk({ data: cachePayload })
  } catch (error) {
    console.error('[llm-vis] Error:', error)
    return jsonError(error instanceof Error ? error.message : 'Unknown error', 500)
  }
}))