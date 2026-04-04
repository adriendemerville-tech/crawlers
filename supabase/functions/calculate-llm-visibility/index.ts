import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { trackTokenUsage, trackPaidApiCall } from '../_shared/tokenTracker.ts'
import { ensureSiteContext } from '../_shared/enrichSiteContext.ts'
import { generateNaturalPrompts, type SiteContext as NaturalSiteContext } from '../_shared/naturalPrompts.ts'
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
const LLM_TARGETS = [
  { id: 'chatgpt',    name: 'ChatGPT',    model: 'openai/gpt-4o-mini' },
  { id: 'gemini',     name: 'Gemini',      model: 'google/gemini-2.5-flash' },
  { id: 'perplexity', name: 'Perplexity',  model: 'perplexity/sonar' },
  { id: 'claude',     name: 'Claude',      model: 'anthropic/claude-3-haiku' },
  { id: 'mistral',    name: 'Mistral',     model: 'mistralai/mistral-small-latest' },
]

const NUM_PROMPTS = 3 // reduced from 5 to fit within timeout

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

  const siteName = (site.site_name || '').trim()
  const domain = (site.domain || '').trim()

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
// PROMPT GENERATION — delegated to shared module
// ═══════════════════════════════════════════════

function generatePrompts(site: any): string[] {
  const ctx: NaturalSiteContext = {
    market_sector: site.market_sector,
    products_services: site.products_services,
    target_audience: site.target_audience,
    commercial_area: site.commercial_area,
    entity_type: site.entity_type,
    media_specialties: site.media_specialties,
  }
  const { prompts } = generateNaturalPrompts({ site: ctx, lang: 'fr', maxPrompts: NUM_PROMPTS, domain: site.domain })
  return prompts
}

function getFollowUpPrompts(site: any): string[] {
  const ctx: NaturalSiteContext = {
    entity_type: site.entity_type,
    media_specialties: site.media_specialties,
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
): Promise<{ iteration_found: number; response_text: string }> {
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
          'HTTP-Referer': 'https://crawlers.lovable.app',
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
        break
      }

      const data = await resp.json()
      const content = data.choices?.[0]?.message?.content || ''

      trackTokenUsage('calculate-llm-visibility', model, data.usage, domain)

      if (findBrandInText(content, patterns)) {
        return { iteration_found: iteration, response_text: content }
      }

      messages.push({ role: 'assistant', content })

      if (iteration <= 2) {
        messages.push({ role: 'user', content: followUpPrompts[iteration - 1] })
      }
    } catch (err) {
      console.error(`[llm-vis] ${model} it${iteration} error:`, err)
      break
    }
  }

  return { iteration_found: 0, response_text: '' }
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

    // Merge: caller-provided context > enriched context > site data (fallback chain)
    const enrichedSite = {
      ...site,
      ...enrichedContext,
      ...(externalContext?.market_sector ? { market_sector: externalContext.market_sector } : {}),
      ...(externalContext?.products_services ? { products_services: externalContext.products_services } : {}),
      ...(externalContext?.target_audience ? { target_audience: externalContext.target_audience } : {}),
      ...(externalContext?.commercial_area ? { commercial_area: externalContext.commercial_area } : {}),
      ...(externalContext?.entity_type ? { entity_type: externalContext.entity_type } : {}),
    }
    if (externalContext?.market_sector) {
      console.log(`[llm-vis] Using caller-provided context override (sector: ${externalContext.market_sector})`)
    }

    const patterns = buildBrandPatterns(enrichedSite)
    const prompts = generatePrompts(enrichedSite)
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

    if (cachedData?.result_data) {
      console.log(`[llm-vis] ♻️ ${site.domain} — cache hit for week ${weekStart}`)
      const cached = cachedData.result_data as { scores: any[]; week_start_date: string }

      // Copy scores to user's own tables for their dashboard
      for (const s of (cached.scores || [])) {
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

    console.log(`[llm-vis] 🔍 ${site.domain} — patterns: ${patterns.exact.join(', ')} — ${prompts.length} prompts × ${LLM_TARGETS.length} LLMs (parallel)`)

    // ── Run ALL LLMs in parallel ──
    const llmPromises = LLM_TARGETS.map(async (llm) => {
      const promptScores: PromptScore[] = []
      const responseTexts: string[] = []

      const followUps = getFollowUpPrompts(site)
      for (const prompt of prompts) {
        const { iteration_found, response_text } = await queryWithIterations(
          openrouterKey,
          llm.model,
          prompt,
          patterns,
          site.domain,
          followUps,
        )

        trackPaidApiCall('calculate-llm-visibility', 'openrouter', llm.model, site.domain)

        const ps = scorePromptResult(iteration_found, response_text, patterns)
        promptScores.push(ps)
        responseTexts.push(response_text.slice(0, 500))

        // Store raw execution
        await supabase.from('llm_test_executions').insert({
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

      const score = aggregateLLMScore(promptScores)

      await supabase.from('llm_visibility_scores').upsert({
        tracked_site_id,
        user_id,
        llm_name: llm.name,
        score_percentage: score,
        week_start_date: weekStart,
      }, { onConflict: 'tracked_site_id,llm_name,week_start_date' })

      const breakdown = promptScores.map((ps, i) =>
        `P${i + 1}:it${ps.iterationFound}×pos${ps.positionRank}×${ps.sentiment}=${ps.compositeScore}`
      ).join(' | ')
      console.log(`[llm-vis] ${site.domain} × ${llm.name}: ${score}% [${breakdown}]`)

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

      return { llm_name: llm.name, score, promptDetails: promptScores, responseTexts }
}))

    const llmResults = await Promise.all(llmPromises)

    const scores = llmResults.map(r => ({
      llm_name: r.llm_name,
      score_percentage: r.score,
      response_excerpt: r.responseTexts?.[0]?.slice(0, 300) || '',
      overall_sentiment: r.promptDetails.length > 0
        ? (r.promptDetails.filter(d => d.sentiment === 'recommended' || d.sentiment === 'positive').length > r.promptDetails.length / 2 ? 'positive' : r.promptDetails.filter(d => d.sentiment === 'negative').length > r.promptDetails.length / 2 ? 'negative' : 'neutral')
        : 'neutral',
      details: r.promptDetails.map((ps, i) => ({
        prompt: prompts[i],
        iteration_found: ps.iterationFound,
        position_rank: ps.positionRank,
        sentiment: ps.sentiment,
        richness_bonus: ps.richnessBonus,
        composite_score: ps.compositeScore,
        response_excerpt: r.responseTexts?.[i]?.slice(0, 200) || '',
      })),
    }))

    console.log(`[llm-vis] ✅ ${site.domain} complete: ${scores.map(s => `${s.llm_name}=${s.score_percentage}%`).join(', ')}`)

    // ── Write to shared domain cache (2h TTL — Pro Agency+ can refresh unlimited but backend throttles to every 2h) ──
    const cachePayload = { scores, week_start_date: weekStart }
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
})