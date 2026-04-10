import { corsHeaders } from '../_shared/cors.ts'
import { trackTokenUsage } from '../_shared/tokenTracker.ts'
import { checkIpRate, getClientIp, rateLimitResponse, acquireConcurrency, releaseConcurrency, concurrencyResponse } from '../_shared/ipRateLimiter.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/* ================================================================== */
/*  GEO Matrice Audit — standard mode + benchmark mode                 */
/* ================================================================== */

interface GeoItem {
  id: string; prompt: string; poids: number; axe: string
  seuil_bon: number; seuil_moyen: number; seuil_mauvais: number
  llm_name?: string
}

interface BenchmarkItem {
  id: string; prompt: string; theme: string; engine: string
  poids: number; axe: string
  seuil_bon: number; seuil_moyen: number; seuil_mauvais: number
  llm_name?: string
}

interface GeoResult {
  id: string; prompt: string; axe: string; poids: number
  detected_type: string
  crawlers_score: number
  parsed_score: number
  raw_data: Record<string, any>
  parsed_raw?: Record<string, any>
  seuil_bon: number; seuil_moyen: number; seuil_mauvais: number
}

interface BenchmarkResult extends GeoResult {
  theme: string; engine: string
  citation_found: boolean
  citation_rank: number | null
  citation_context: string
}

/* ── Engine-specific system prompts ──────────────────────────────── */

const ENGINE_PROMPTS: Record<string, string> = {
  chatgpt: `Tu simules ChatGPT. Réponds à la question de l'utilisateur comme le ferait ChatGPT. Sois factuel, cite des sources si pertinent.`,
  gemini: `Tu simules Google Gemini. Réponds comme Gemini le ferait : synthétique, avec des données vérifiables.`,
  perplexity: `Tu simules Perplexity AI. Réponds avec des citations de sources, des liens, une synthèse structurée.`,
  copilot: `Tu simules Microsoft Copilot. Réponds de manière concise et pratique, avec des suggestions actionnables.`,
};

function getEngineSystemPrompt(engine: string): string {
  const lower = engine.toLowerCase();
  for (const [key, prompt] of Object.entries(ENGINE_PROMPTS)) {
    if (lower.includes(key)) return prompt;
  }
  return `Tu es un moteur de recherche IA. Réponds de manière factuelle et structurée.`;
}

/* ── LLM GEO evaluation (standard mode) ─────────────────────────── */

async function evaluateGeo(
  prompt: string, url: string, llmName: string, retryCount = 0
): Promise<{ score: number; raw: Record<string, any> }> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  if (!LOVABLE_API_KEY) return { score: 50, raw: { error: 'No API key' } }

  const MAX_RETRIES = 2
  const RETRY_DELAYS = [2000, 5000]

  try {
    const systemPrompt = `Tu es un expert en GEO (Generative Engine Optimization) et en visibilité IA.
On te donne une URL de site web et un critère GEO à évaluer.

Tu dois évaluer ce critère en vérifiant la CITABILITÉ du site par les moteurs IA (ChatGPT, Gemini, Perplexity, Copilot).

Critères d'évaluation GEO :
- Le site est-il mentionné par les moteurs IA pour ce type de requête ?
- Le contenu est-il structuré pour être cité (FAQ, données structurées, E-E-A-T) ?
- Le site a-t-il des signaux de confiance (HTTPS, vitesse, structured data) ?
- Le contenu est-il suffisamment unique et autoritaire pour être recommandé ?

Réponds UNIQUEMENT avec un JSON: {"score": <0-100>, "justification": "<string courte>", "signals": {"mentioned": <bool>, "structured": <bool>, "authoritative": <bool>}}`

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: llmName || 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `URL: ${url}\n\nCRITÈRE GEO À ÉVALUER:\n${prompt}\n\nScore de 0 à 100:` },
        ],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!resp.ok) {
      const status = resp.status
      await resp.text()
      if ((status === 429 || status >= 500) && retryCount < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS[retryCount] || 5000))
        return evaluateGeo(prompt, url, llmName, retryCount + 1)
      }
      return { score: 50, raw: { error: `API error ${status}` } }
    }

    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content || ''
    trackTokenUsage('parse-matrix-geo', llmName || 'google/gemini-2.5-flash', data.usage, url)

    return parseScoreResponse(content)
  } catch (e) {
    if (retryCount < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAYS[retryCount] || 5000))
      return evaluateGeo(prompt, url, llmName, retryCount + 1)
    }
    return { score: 50, raw: { error: e instanceof Error ? e.message : 'Unknown' } }
  }
}

/* ── Benchmark evaluation: send full prompt as-is to engine ──────── */

async function evaluateBenchmark(
  prompt: string, brandUrl: string, engine: string, llmName: string, retryCount = 0
): Promise<{ score: number; raw: Record<string, any>; citation_found: boolean; citation_rank: number | null; citation_context: string }> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  if (!LOVABLE_API_KEY) return { score: 0, raw: { error: 'No API key' }, citation_found: false, citation_rank: null, citation_context: '' }

  const MAX_RETRIES = 2
  const RETRY_DELAYS = [2000, 5000]

  try {
    // Step 1: Send the full prompt to the simulated engine
    const enginePrompt = getEngineSystemPrompt(engine);
    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: llmName || 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: enginePrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!resp.ok) {
      const status = resp.status
      await resp.text()
      if ((status === 429 || status >= 500) && retryCount < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS[retryCount] || 5000))
        return evaluateBenchmark(prompt, brandUrl, engine, llmName, retryCount + 1)
      }
      return { score: 0, raw: { error: `API error ${status}` }, citation_found: false, citation_rank: null, citation_context: '' }
    }

    const data = await resp.json()
    const engineResponse = data.choices?.[0]?.message?.content || ''
    trackTokenUsage('parse-matrix-geo', llmName || 'google/gemini-2.5-flash', data.usage, brandUrl)

    // Step 2: Analyze the response for citation and rank
    const scoringResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: `Tu analyses la réponse d'un moteur IA pour vérifier si une marque/site est cité.
Réponds UNIQUEMENT en JSON: {"cited": <bool>, "rank": <number|null>, "context": "<phrase où la marque apparaît>"}
- cited: true si la marque/URL est mentionnée (même partiellement, par nom de domaine ou nom de marque)
- rank: position dans la liste de recommandations (1 = premier cité, 2 = deuxième, etc. null si absent)
- context: la phrase exacte de citation (vide si non cité)` },
          { role: 'user', content: `URL/Marque à chercher: ${brandUrl}\n\nRéponse du moteur IA (${engine}):\n${engineResponse.substring(0, 3000)}` },
        ],
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!scoringResp.ok) {
      await scoringResp.text()
      return {
        score: 0,
        raw: { engine_response: engineResponse.substring(0, 500), scoring_error: true },
        citation_found: false,
        citation_rank: null,
        citation_context: '',
      }
    }

    const scoringData = await scoringResp.json()
    const scoringContent = scoringData.choices?.[0]?.message?.content || ''
    trackTokenUsage('parse-matrix-geo', 'google/gemini-2.5-flash-lite', scoringData.usage, brandUrl)

    // Parse the citation analysis (not a score)
    let citationParsed: any = {}
    try {
      let jsonStr = scoringContent
      if (jsonStr.includes('```json')) jsonStr = jsonStr.split('```json')[1].split('```')[0].trim()
      else if (jsonStr.includes('```')) jsonStr = jsonStr.split('```')[1].split('```')[0].trim()
      citationParsed = JSON.parse(jsonStr)
    } catch {
      citationParsed = { cited: false, rank: null, context: '' }
    }

    const cited = citationParsed.cited ?? false
    const rank = cited ? (citationParsed.rank ?? null) : null

    // For benchmark: score IS the rank (1=best). 0 means not cited.
    // This is NOT a 0-100 score — it's a ranking position.
    const benchmarkScore = cited ? (rank ?? 99) : 0

    return {
      score: benchmarkScore,
      raw: {
        engine_response_preview: engineResponse.substring(0, 300),
        scoring: citationParsed,
        engine,
      },
      citation_found: cited,
      citation_rank: rank,
      citation_context: citationParsed.context ?? '',
    }
  } catch (e) {
    if (retryCount < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAYS[retryCount] || 5000))
      return evaluateBenchmark(prompt, brandUrl, engine, llmName, retryCount + 1)
    }
    return { score: 0, raw: { error: e instanceof Error ? e.message : 'Unknown' }, citation_found: false, citation_rank: null, citation_context: '' }
  }
}

/* ── Parse score from LLM response ───────────────────────────────── */

function parseScoreResponse(content: string): { score: number; raw: Record<string, any> } {
  let jsonContent = content
  if (content.includes('```json')) jsonContent = content.split('```json')[1].split('```')[0].trim()
  else if (content.includes('```')) jsonContent = content.split('```')[1].split('```')[0].trim()

  try {
    const parsed = JSON.parse(jsonContent)
    return { score: Math.min(100, Math.max(0, Math.round(Number(parsed.score) || 50))), raw: parsed }
  } catch {
    const numMatch = content.match(/(\d{1,3})/)
    if (numMatch) return { score: Math.min(100, parseInt(numMatch[1])), raw: { llm_raw: content.substring(0, 200) } }
    return { score: 50, raw: { llm_raw: content.substring(0, 200), parse_error: true } }
  }
}

/* ── Main handler ─────────────────────────────────────────────────── */

Deno.serve(handleRequest(async (req) => {
  const clientIp = getClientIp(req)
  const ipCheck = checkIpRate(clientIp, 'parse-matrix-geo', 15, 60_000)
  if (!ipCheck.allowed) return rateLimitResponse(corsHeaders, ipCheck.retryAfterMs)
  if (!acquireConcurrency('parse-matrix-geo', 50)) return concurrencyResponse(corsHeaders)

  try {
    const body = await req.json()
    const { url, items, benchmark_items, mode } = body as {
      url: string;
      items?: GeoItem[];
      benchmark_items?: BenchmarkItem[];
      mode?: 'standard' | 'benchmark';
    }

    if (!url) {
      return jsonError('url required', 400)
    }

    let normalizedUrl = url.trim()
    if (!normalizedUrl.startsWith('http')) normalizedUrl = `https://${normalizedUrl}`

    // ── BENCHMARK MODE ──────────────────────────────────────────────
    if (mode === 'benchmark' && benchmark_items?.length) {
      console.log(`[parse-matrix-geo] BENCHMARK mode for ${normalizedUrl} with ${benchmark_items.length} items`)

      const BATCH_SIZE = 2 // Lower batch size for benchmark (2 LLM calls per item)
      const results: BenchmarkResult[] = []

      for (let i = 0; i < benchmark_items.length; i += BATCH_SIZE) {
        const batch = benchmark_items.slice(i, i + BATCH_SIZE)
        console.log(`[parse-matrix-geo] Benchmark batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(benchmark_items.length / BATCH_SIZE)}`)

        const batchResults = await Promise.all(
          batch.map(async (item): Promise<BenchmarkResult> => {
            const { score, raw, citation_found, citation_rank, citation_context } = await evaluateBenchmark(
              item.prompt, normalizedUrl, item.engine, item.llm_name || 'google/gemini-2.5-flash'
            )
            return {
              id: item.id, prompt: item.prompt, axe: item.axe, poids: item.poids,
              theme: item.theme, engine: item.engine,
              detected_type: 'geo_benchmark',
              crawlers_score: score, parsed_score: score,
              raw_data: raw, parsed_raw: raw,
              citation_found, citation_rank, citation_context,
              seuil_bon: item.seuil_bon, seuil_moyen: item.seuil_moyen, seuil_mauvais: item.seuil_mauvais,
            }
          })
        )
        results.push(...batchResults)

        if (i + BATCH_SIZE < benchmark_items.length) await new Promise(r => setTimeout(r, 1000))
      }

      // Build heatmap data: theme × engine (aggregate multiple items per cell)
      const themes = [...new Set(results.map(r => r.theme))]
      const engines = [...new Set(results.map(r => r.engine))]
      const heatmap: Record<string, Record<string, { score: number; cited: boolean; rank: number | null; count: number; cited_count: number }>> = {}

      for (const theme of themes) {
        heatmap[theme] = {}
        for (const engine of engines) {
          const matches = results.filter(r => r.theme === theme && r.engine === engine)
          if (matches.length === 0) {
            heatmap[theme][engine] = { score: -1, cited: false, rank: null, count: 0, cited_count: 0 }
          } else {
            const citedCount = matches.filter(m => m.citation_found).length
            const bestRank = matches.filter(m => m.citation_rank !== null).sort((a, b) => (a.citation_rank ?? 99) - (b.citation_rank ?? 99))[0]?.citation_rank ?? null
            // For benchmark heatmap: score = best rank (lower is better), 0 = not cited
            heatmap[theme][engine] = { score: bestRank ?? 0, cited: citedCount > 0, rank: bestRank, count: matches.length, cited_count: citedCount }
          }
        }
      }

      const citationRate = results.length > 0
        ? Math.round(results.filter(r => r.citation_found).length / results.length * 100)
        : 0

      // Global score for benchmark: average best rank among cited items
      const citedResults = results.filter(r => r.citation_found && r.citation_rank != null)
      const avgRank = citedResults.length > 0
        ? +(citedResults.reduce((s, r) => s + (r.citation_rank ?? 0), 0) / citedResults.length).toFixed(1)
        : 0

      console.log(`[parse-matrix-geo] Benchmark complete. Avg rank: ${avgRank}, Citation rate: ${citationRate}%`)

      return jsonOk({
        success: true, url: normalizedUrl, mode: 'benchmark',
        global_score: avgRank, citation_rate: citationRate,
        avg_rank: avgRank,
        total_items: results.length, audit_type: 'geo_benchmark',
        themes, engines, heatmap, results,
      })
    }

    // ── STANDARD MODE ───────────────────────────────────────────────
    if (!items?.length) {
      return jsonError('items[] required for standard mode', 400)
    }

    console.log(`[parse-matrix-geo] Starting GEO audit for ${normalizedUrl} with ${items.length} items`)

    const BATCH_SIZE = 3
    const results: GeoResult[] = []

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE)
      console.log(`[parse-matrix-geo] Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(items.length / BATCH_SIZE)} (${batch.length} items)`)

      const batchResults = await Promise.all(
        batch.map(async (item): Promise<GeoResult> => {
          const { score, raw } = await evaluateGeo(
            item.prompt, normalizedUrl, item.llm_name || 'google/gemini-2.5-flash'
          )
          return {
            id: item.id, prompt: item.prompt, axe: item.axe, poids: item.poids,
            detected_type: 'geo', crawlers_score: score, parsed_score: score,
            raw_data: raw, parsed_raw: raw,
            seuil_bon: item.seuil_bon, seuil_moyen: item.seuil_moyen, seuil_mauvais: item.seuil_mauvais,
          }
        })
      )
      results.push(...batchResults)

      if (i + BATCH_SIZE < items.length) await new Promise(r => setTimeout(r, 500))
    }

    const orderedResults = items.map(item => results.find(r => r.id === item.id)!)
    const totalWeight = orderedResults.reduce((s, r) => s + r.poids, 0)
    const globalScore = totalWeight > 0
      ? Math.round(orderedResults.reduce((s, r) => s + r.crawlers_score * r.poids, 0) / totalWeight)
      : 0

    console.log(`[parse-matrix-geo] Complete. Global GEO score: ${globalScore}/100`)

    return jsonOk({
      success: true, url: normalizedUrl, global_score: globalScore,
      total_items: orderedResults.length, audit_type: 'geo', results: orderedResults,
    })

  } catch (e) {
    console.error('[parse-matrix-geo] Error:', e)
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } finally {
    releaseConcurrency('parse-matrix-geo')
  }
}))
