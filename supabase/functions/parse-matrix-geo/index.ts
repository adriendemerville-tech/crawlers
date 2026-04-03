import { corsHeaders } from '../_shared/cors.ts'
import { trackTokenUsage } from '../_shared/tokenTracker.ts'
import { checkIpRate, getClientIp, rateLimitResponse, acquireConcurrency, releaseConcurrency, concurrencyResponse } from '../_shared/ipRateLimiter.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/* ================================================================== */
/*  GEO Matrice Audit — evaluates GEO/AI-Ready criteria               */
/* ================================================================== */

interface GeoItem {
  id: string; prompt: string; poids: number; axe: string
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

/* ── LLM GEO evaluation ──────────────────────────────────────────── */

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
  } catch (e) {
    if (retryCount < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAYS[retryCount] || 5000))
      return evaluateGeo(prompt, url, llmName, retryCount + 1)
    }
    return { score: 50, raw: { error: e instanceof Error ? e.message : 'Unknown' } }
  }
}

/* ── Main handler ─────────────────────────────────────────────────── */

Deno.serve(handleRequest(async (req) => {
const clientIp = getClientIp(req)
  const ipCheck = checkIpRate(clientIp, 'parse-matrix-geo', 15, 60_000)
  if (!ipCheck.allowed) return rateLimitResponse(corsHeaders, ipCheck.retryAfterMs)
  if (!acquireConcurrency('parse-matrix-geo', 50)) return concurrencyResponse(corsHeaders)

  try {
    const { url, items } = await req.json() as { url: string; items: GeoItem[] }

    if (!url || !items?.length) {
      return new Response(JSON.stringify({ success: false, error: 'url and items[] required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let normalizedUrl = url.trim()
    if (!normalizedUrl.startsWith('http')) normalizedUrl = `https://${normalizedUrl}`

    console.log(`[parse-matrix-geo] Starting GEO audit for ${normalizedUrl} with ${items.length} items`)

    // Process in batches of 3 to avoid rate limiting and timeouts
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

      // Small delay between batches to avoid rate limiting
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
})