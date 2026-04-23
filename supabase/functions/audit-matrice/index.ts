import { corsHeaders } from '../_shared/cors.ts'
import { assertSafeUrl } from '../_shared/ssrf.ts'
import { fetchAndRenderPage } from '../_shared/renderPage.ts'
import { trackTokenUsage } from '../_shared/tokenTracker.ts'
import { checkIpRate, getClientIp, rateLimitResponse, acquireConcurrency, releaseConcurrency, concurrencyResponse } from '../_shared/ipRateLimiter.ts'
import { detectItemType, type ItemType } from '../_shared/matriceTypeDetector.ts'
import { analyzeHtmlFull, type HtmlData } from '../_shared/matriceHtmlAnalysis.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import {
  type RobotsData, type SitemapData, type PsiData,
  checkRobots, checkSitemap, checkLlmsTxt, fetchPsi,
  computeBaliseScore, computeStructuredDataScore, computePerformanceScore,
  computeSecurityScore, computeCombinedScore,
} from '../_shared/matriceScoring.ts'

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface ItemInput {
  id: string; prompt: string; type?: string; llm_name?: string
  poids: number; axe: string
  seuil_bon: number; seuil_moyen: number; seuil_mauvais: number
}

interface ItemResult {
  id: string; prompt: string; axe: string; poids: number
  detected_type: ItemType
  crawlers_score: number
  parsed_score: number
  raw_data: Record<string, any>
  parsed_raw?: Record<string, any>
  seuil_bon: number; seuil_moyen: number; seuil_mauvais: number
}

/* ================================================================== */
/*  Scoring Guide → composite score engine                             */
/* ================================================================== */

interface ScoringField {
  field: string
  whatToCode: string
  allowedValues: string
  meaning?: string
}

interface CodedField {
  field: string
  value: string
  numericValue: number
}

/**
 * Converts a coded rubric field value into a 0-100 numeric score.
 * Dynamically adapts to any Scoring Guide structure by analyzing allowed values.
 */
function fieldValueToNumeric(field: ScoringField, value: string): number {
  const v = (value || '').trim().toLowerCase()
  const allowed = field.allowedValues || ''

  // Boolean fields (Oui/Non)
  if (/^oui\s*,\s*non$/i.test(allowed) || /^yes\s*,\s*no$/i.test(allowed)) {
    return /^oui|^yes|^true/i.test(v) ? 100 : 0
  }

  // Rank fields (0 = absent, 1, 2, 3, 4, 5, 6+)
  if (/\b0\s*=\s*(absent|absente)/i.test(allowed)) {
    const rank = parseInt(v)
    if (isNaN(rank) || rank === 0) return 0
    // Rank 1 = 100, 2 = 80, 3 = 60, 4 = 40, 5 = 20, 6+ = 10
    return Math.max(10, 100 - (rank - 1) * 20)
  }

  // Percentage range fields (0 %, 1-24 %, 25-49 %, ...)
  if (/\d+\s*%/.test(allowed)) {
    const pctMatch = v.match(/(\d+)/)
    if (pctMatch) {
      const pct = parseInt(pctMatch[1])
      return Math.min(100, pct)
    }
    // Range labels
    if (/100\s*%/.test(v)) return 100
    if (/75-99|75\s*%/.test(v)) return 87
    if (/51-74/.test(v)) return 62
    if (/^50\s*%/.test(v)) return 50
    if (/25-49/.test(v)) return 37
    if (/1-24/.test(v)) return 12
    if (/^0\s*%/.test(v)) return 0
    return 50
  }

  // Count fields (0, 1, 2, 3+)
  if (/^0\s*,\s*1\s*,\s*2/.test(allowed)) {
    const count = parseInt(v)
    if (isNaN(count) || count === 0) return 0
    if (count === 1) return 33
    if (count === 2) return 66
    return 100 // 3+
  }

  // Direction/sentiment fields (Positive, Neutre, Négative, N/A)
  if (/positive.*neutre.*n[ée]gative/i.test(allowed)) {
    if (/positive/i.test(v)) return 100
    if (/neutre/i.test(v)) return 50
    if (/n[ée]gative/i.test(v)) return 0
    return 0 // N/A
  }

  // Accuracy fields (Exacte, Partiellement exacte, Inexacte, ...)
  if (/exacte.*partiellement/i.test(allowed)) {
    if (/^exacte/i.test(v)) return 100
    if (/partiellement/i.test(v)) return 50
    if (/inexacte/i.test(v)) return 0
    return 25 // Impossible à vérifier
  }

  // Source type fields (Propriétaire, Tierce, Mixte, Aucune)
  if (/propri[ée]taire.*tierce/i.test(allowed)) {
    if (/propri[ée]taire/i.test(v)) return 100
    if (/mixte/i.test(v)) return 75
    if (/tierce/i.test(v)) return 50
    return 0 // Aucune
  }

  // Fallback: try to parse as number
  const num = parseFloat(v)
  if (!isNaN(num)) return Math.min(100, Math.max(0, num))

  return 50
}

/**
 * Computes composite score from coded fields.
 * All fields are equally weighted unless the rubric specifies otherwise.
 */
function computeCompositeScore(codedFields: CodedField[], rubric: ScoringField[]): number {
  if (!codedFields.length) return 50

  // Filter out non-scoring meta fields (e.g. Priority_Prompt which is a filter, not a score)
  const scoringFields = codedFields.filter(f => {
    const def = rubric.find(r => r.field === f.field)
    // Skip fields that are binary filters rather than quality indicators
    if (def && /filtr|permet de filtrer/i.test(def.meaning || '')) return false
    return true
  })

  if (!scoringFields.length) return 50

  const total = scoringFields.reduce((sum, f) => sum + f.numericValue, 0)
  return Math.round(total / scoringFields.length)
}

/* ================================================================== */
/*  LLM prompt evaluation                                              */
/* ================================================================== */

async function evaluateWithLlm(prompt: string, url: string, htmlSummary: string, _llmName: string, scoringRubric?: ScoringField[], retryCount = 0): Promise<{ score: number; raw: Record<string, any> }> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  if (!LOVABLE_API_KEY) return { score: 50, raw: { error: 'No API key', note: 'LLM evaluation unavailable' } }

  // ── GPT-5 for parsing/scoring (high precision), regardless of item llm_name ──
  const PARSING_MODEL = 'openai/gpt-5'

  const MAX_RETRIES = 2
  const RETRY_DELAYS = [2000, 5000]
  const useStructuredScoring = scoringRubric && scoringRubric.length > 0

  try {
    let systemPrompt: string
    let expectedFormat: string

    if (useStructuredScoring) {
      // ── DYNAMIC STRUCTURED SCORING ──
      const fieldDefs = scoringRubric.map((f, i) =>
        `${i + 1}. "${f.field}": ${f.whatToCode}\n   Valeurs autorisées: ${f.allowedValues}`
      ).join('\n')

      const fieldKeys = scoringRubric.map(f => `"${f.field}"`).join(', ')
      expectedFormat = `{${scoringRubric.map(f => `"${f.field}": "<value>"`).join(', ')}}`

      systemPrompt = `Tu es un évaluateur expert. On te donne un prompt envoyé à un moteur IA (LLM) et la réponse obtenue (ou le contexte HTML si disponible).

Tu dois CODER chaque champ d'évaluation ci-dessous en utilisant UNIQUEMENT les valeurs autorisées.

CHAMPS À CODER:
${fieldDefs}

RÈGLES STRICTES:
- Utilise UNIQUEMENT les valeurs listées dans "Valeurs autorisées" pour chaque champ
- Si tu ne peux pas déterminer une valeur, utilise la valeur la plus conservative
- Ne donne PAS de score numérique global — code chaque champ individuellement
- Analyse le PROMPT et le CONTENU pour déterminer chaque valeur

Réponds UNIQUEMENT avec un JSON contenant les clés: ${fieldKeys}`
    } else {
      systemPrompt = `Tu es un expert SEO. On te donne une URL et un extrait du contenu HTML. Tu dois évaluer un critère SEO spécifique et retourner un score de 0 à 100.

Réponds UNIQUEMENT avec un JSON: {"score": <number>, "justification": "<string courte>"}`
      expectedFormat = '{"score": <number>, "justification": "<string>"}'
    }

    const userPrompt = `URL: ${url}

${htmlSummary ? `EXTRAIT HTML (contenu principal):\n${htmlSummary}\n\n` : ''}CRITÈRE / PROMPT À ÉVALUER:
${prompt}

Réponds avec le JSON (${expectedFormat}):`

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: PARSING_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(45000),
    })

    if (!resp.ok) {
      const status = resp.status
      await resp.text()

      if ((status === 429 || status >= 500) && retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retryCount] || 5000
        console.log(`[audit-matrice] LLM ${status}, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
        await new Promise(r => setTimeout(r, delay))
        return evaluateWithLlm(prompt, url, htmlSummary, llmName, scoringRubric, retryCount + 1)
      }

      if (status === 402) return { score: 50, raw: { error: 'Payment required', status: 402 } }
      return { score: 50, raw: { error: `API error ${status}`, retries: retryCount } }
    }

    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content || ''
    trackTokenUsage('audit-matrice', PARSING_MODEL, data.usage, url)

    let jsonContent = content
    if (content.includes('```json')) jsonContent = content.split('```json')[1].split('```')[0].trim()
    else if (content.includes('```')) jsonContent = content.split('```')[1].split('```')[0].trim()

    try {
      const parsed = JSON.parse(jsonContent)

      if (useStructuredScoring) {
        // ── DYNAMIC COMPOSITE SCORE ──
        const codedFields: CodedField[] = scoringRubric.map(fieldDef => {
          const rawValue = String(parsed[fieldDef.field] || '')
          return {
            field: fieldDef.field,
            value: rawValue,
            numericValue: fieldValueToNumeric(fieldDef, rawValue),
          }
        })

        const compositeScore = computeCompositeScore(codedFields, scoringRubric)

        return {
          score: compositeScore,
          raw: {
            scoring_method: 'structured_rubric',
            coded_fields: codedFields,
            composite_score: compositeScore,
            llm_raw_response: parsed,
            model: llmName,
            rubric_fields_count: scoringRubric.length,
          },
        }
      } else {
        // ── CLASSIC 0-100 ──
        const score = Math.min(100, Math.max(0, Math.round(Number(parsed.score) || 50)))
        return { score, raw: { scoring_method: 'classic_0_100', llm_response: parsed, model: llmName } }
      }
    } catch {
      // JSON parse failed — fallback to number extraction
      const numMatch = content.match(/(\d{1,3})/)
      if (numMatch) return { score: Math.min(100, parseInt(numMatch[1])), raw: { scoring_method: 'fallback_regex', llm_raw: content.substring(0, 200), model: llmName } }
      return { score: 50, raw: { scoring_method: 'fallback_default', llm_raw: content.substring(0, 200), parse_error: true } }
    }
  } catch (e) {
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAYS[retryCount] || 5000
      console.log(`[audit-matrice] LLM error "${e instanceof Error ? e.message : 'unknown'}", retrying in ${delay}ms`)
      await new Promise(r => setTimeout(r, delay))
      return evaluateWithLlm(prompt, url, htmlSummary, llmName, scoringRubric, retryCount + 1)
    }
    return { score: 50, raw: { error: e instanceof Error ? e.message : 'Unknown error', retries: retryCount } }
  }
}

/* ================================================================== */
/*  Main handler                                                       */
/* ================================================================== */

Deno.serve(handleRequest(async (req) => {
const clientIp = getClientIp(req)
  const ipCheck = checkIpRate(clientIp, 'audit-matrice', 20, 60_000)
  if (!ipCheck.allowed) return rateLimitResponse(corsHeaders, ipCheck.retryAfterMs)

  if (!acquireConcurrency('audit-matrice', 100)) return concurrencyResponse(corsHeaders)

  try {
    const body = await req.json() as { url: string; items: ItemInput[]; scoring_rubric?: any[]; stream?: boolean }
    const { url, items, scoring_rubric } = body
    const wantsStream = body.stream === true || /text\/event-stream/i.test(req.headers.get('accept') || '')
    if (scoring_rubric?.length) console.log(`[audit-matrice] Scoring rubric loaded: ${scoring_rubric.length} fields`)

    if (!url || !items || items.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'url and items[] required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let normalizedUrl = url.trim()
    if (!normalizedUrl.startsWith('http')) normalizedUrl = `https://${normalizedUrl}`
    assertSafeUrl(normalizedUrl)

    console.log(`[audit-matrice] Starting for ${normalizedUrl} with ${items.length} items`)

    const detectedTypes = items.map(item => ({
      ...item,
      _type: (item.type as ItemType) || detectItemType(item.prompt, item.llm_name),
    }))

    const needsHtml = detectedTypes.some(i => ['balise', 'structured_data', 'metric_combinee', 'prompt'].includes(i._type))
    const needsRobots = detectedTypes.some(i => ['structured_data', 'metric_combinee'].includes(i._type))
    const needsSitemap = detectedTypes.some(i => ['structured_data', 'metric_combinee'].includes(i._type))
    const needsLlmsTxt = detectedTypes.some(i => i._type === 'structured_data' && /llms/i.test(i.prompt))
    const needsPsi = detectedTypes.some(i => ['performance', 'metric_combinee'].includes(i._type))

    const [htmlResult, robotsData, sitemapData, llmsTxtData, psiData] = await Promise.all([
      needsHtml ? fetchAndRenderPage(normalizedUrl, { timeout: 15000 }).catch(e => {
        console.error('[audit-matrice] HTML fetch error:', e)
        return null
      }) : null,
      needsRobots ? checkRobots(normalizedUrl) : { exists: false, permissive: false, content: '', allowsGPTBot: true, allowsClaudeBot: true, allowsPerplexityBot: true } as RobotsData,
      needsSitemap ? checkSitemap(normalizedUrl) : { exists: false, urlCount: 0, containsMainUrl: false } as SitemapData,
      needsLlmsTxt ? checkLlmsTxt(normalizedUrl) : { exists: false, content: '' },
      needsPsi ? fetchPsi(normalizedUrl) : { performance: null, seo: null, lcp: null, fcp: null, cls: null, tbt: null } as PsiData,
    ])

    let html = htmlResult?.html || ''

    // SPA fallback
    const visibleText = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (needsHtml && visibleText.length < 200) {
      console.log(`[audit-matrice] HTML too short (${visibleText.length} chars), trying Firecrawl fallback`)
      try {
        const fcKey = Deno.env.get('FIRECRAWL_API_KEY')
        if (fcKey) {
          const fcResp = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${fcKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: normalizedUrl, formats: ['html'], waitFor: 3000 }),
            signal: AbortSignal.timeout(20000),
          })
          if (fcResp.ok) {
            const fcData = await fcResp.json()
            const fcHtml = fcData?.data?.html || fcData?.html || ''
            if (fcHtml.length > html.length) {
              html = fcHtml
              console.log(`[audit-matrice] Firecrawl fallback success: ${fcHtml.length} chars`)
            }
          } else { await fcResp.text() }
        }
      } catch (e) { console.error('[audit-matrice] Firecrawl fallback error:', e) }
    }

    const htmlData = html ? analyzeHtmlFull(html, normalizedUrl) : null

    // Build smart HTML summary for LLM
    const buildHtmlSummary = (rawHtml: string): string => {
      if (!rawHtml) return ''
      const headMatch = rawHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
      const headContent = headMatch ? headMatch[1]
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<link[^>]*stylesheet[^>]*>/gi, '')
        .trim().substring(0, 1500) : ''
      const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i)
      const bodyHtml = bodyMatch ? bodyMatch[1] : rawHtml
      const cleanBody = bodyHtml
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '[NAV]')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '[FOOTER]')
        .substring(0, 6500)
      return `<head>${headContent}</head>\n<body>${cleanBody}</body>`
    }

    const htmlSummary = buildHtmlSummary(html)

    // Build per-item tasks. Each task resolves to an ItemResult.
    type ItemTask = { item: typeof detectedTypes[number]; run: () => Promise<ItemResult> }
    const tasks: ItemTask[] = detectedTypes.map((item) => {
      const llmEval = () => evaluateWithLlm(
        item.prompt, normalizedUrl, htmlSummary,
        item.llm_name || 'google/gemini-2.5-flash',
        scoring_rubric
      )

      if (item._type === 'prompt') {
        return {
          item,
          run: async () => {
            const { score, raw } = await llmEval()
            return {
              id: item.id, prompt: item.prompt, axe: item.axe, poids: item.poids,
              detected_type: 'prompt', crawlers_score: score, parsed_score: score,
              raw_data: raw, parsed_raw: raw,
              seuil_bon: item.seuil_bon, seuil_moyen: item.seuil_moyen, seuil_mauvais: item.seuil_mauvais,
            }
          },
        }
      }

      if (!htmlData) {
        return {
          item,
          run: async () => {
            const { score: pScore, raw: pRaw } = await llmEval()
            return {
              id: item.id, prompt: item.prompt, axe: item.axe, poids: item.poids,
              detected_type: item._type, crawlers_score: 0, parsed_score: pScore,
              raw_data: { error: 'HTML fetch failed' }, parsed_raw: pRaw,
              seuil_bon: item.seuil_bon, seuil_moyen: item.seuil_moyen, seuil_mauvais: item.seuil_mauvais,
            }
          },
        }
      }

      let engineScore: number
      let engineRaw: Record<string, any>
      switch (item._type) {
        case 'balise':
          ({ score: engineScore, raw: engineRaw } = computeBaliseScore(item.prompt, htmlData)); break
        case 'structured_data':
          ({ score: engineScore, raw: engineRaw } = computeStructuredDataScore(item.prompt, htmlData, robotsData, sitemapData, llmsTxtData)); break
        case 'performance':
          ({ score: engineScore, raw: engineRaw } = computePerformanceScore(item.prompt, psiData)); break
        case 'security':
          ({ score: engineScore, raw: engineRaw } = computeSecurityScore(item.prompt, htmlData)); break
        case 'metric_combinee':
        default:
          ({ score: engineScore, raw: engineRaw } = computeCombinedScore(item.prompt, htmlData, robotsData, sitemapData, psiData)); break
      }

      return {
        item,
        run: async () => {
          const { score: pScore, raw: pRaw } = await llmEval()
          return {
            id: item.id, prompt: item.prompt, axe: item.axe, poids: item.poids,
            detected_type: item._type, crawlers_score: engineScore, parsed_score: pScore,
            raw_data: engineRaw, parsed_raw: pRaw,
            seuil_bon: item.seuil_bon, seuil_moyen: item.seuil_moyen, seuil_mauvais: item.seuil_mauvais,
          }
        },
      }
    })

    /* ============= STREAMING (SSE) MODE ============= */
    if (wantsStream) {
      const stream = new ReadableStream({
        async start(controller) {
          const enc = new TextEncoder()
          const send = (event: string, data: unknown) => {
            try {
              controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
            } catch { /* client disconnected */ }
          }

          // Init
          send('start', {
            url: normalizedUrl,
            total: tasks.length,
            items: tasks.map(t => ({ id: t.item.id, prompt: t.item.prompt, axe: t.item.axe, detected_type: t.item._type })),
          })

          // Mark all as running (LLM calls started in parallel below)
          tasks.forEach(t => send('item.update', { id: t.item.id, status: 'running' }))

          const collected: ItemResult[] = []
          const runners = tasks.map(async (t) => {
            try {
              const res = await t.run()
              collected.push(res)
              send('item.update', {
                id: t.item.id,
                status: 'done',
                result: res,
              })
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Unknown error'
              send('item.update', { id: t.item.id, status: 'error', error: message })
            }
          })

          await Promise.all(runners)

          // Final ordered results + global score
          const orderedResults = items.map(item => collected.find(r => r.id === item.id)!).filter(Boolean)
          const totalWeight = orderedResults.reduce((s, r) => s + r.poids, 0)
          const globalScore = totalWeight > 0
            ? Math.round(orderedResults.reduce((s, r) => s + r.crawlers_score * r.poids, 0) / totalWeight)
            : 0

          send('complete', {
            success: true,
            url: normalizedUrl,
            global_score: globalScore,
            total_items: orderedResults.length,
            results: orderedResults,
          })

          console.log(`[audit-matrice][SSE] Complete. Global score: ${globalScore}/100 (${orderedResults.length} items)`)
          releaseConcurrency('audit-matrice')
          controller.close()
        },
        cancel() {
          // Client disconnected — release concurrency slot
          console.log('[audit-matrice][SSE] Client disconnected, releasing concurrency')
          releaseConcurrency('audit-matrice')
        },
      })

      return new Response(stream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      })
    }

    /* ============= CLASSIC JSON MODE ============= */
    const collected = await Promise.all(tasks.map(t => t.run()))
    const orderedResults = items.map(item => collected.find(r => r.id === item.id)!)
    const totalWeight = orderedResults.reduce((s, r) => s + r.poids, 0)
    const globalScore = totalWeight > 0
      ? Math.round(orderedResults.reduce((s, r) => s + r.crawlers_score * r.poids, 0) / totalWeight)
      : 0

    console.log(`[audit-matrice] Complete. Global score: ${globalScore}/100 (${orderedResults.length} items)`)

    return jsonOk({
      success: true,
      url: normalizedUrl,
      global_score: globalScore,
      total_items: orderedResults.length,
      results: orderedResults,
    })

  } catch (e) {
    console.error('[audit-matrice] Error:', e)
    return new Response(JSON.stringify({
      success: false,
      error: e instanceof Error ? e.message : 'Unknown error',
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } finally {
    // Note: in SSE mode, releaseConcurrency is called from the stream lifecycle (close/cancel).
    // In JSON mode (or on early throw), release here.
    if (!(req.headers.get('x-matrice-stream-released') === '1')) {
      try { releaseConcurrency('audit-matrice') } catch { /* idempotent */ }
    }
  }
}));