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
/*  LLM prompt evaluation                                              */
/* ================================================================== */

async function evaluateWithLlm(prompt: string, url: string, htmlSummary: string, llmName: string, retryCount = 0): Promise<{ score: number; raw: Record<string, any> }> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  if (!LOVABLE_API_KEY) return { score: 50, raw: { error: 'No API key', note: 'LLM evaluation unavailable' } }

  const MAX_RETRIES = 2
  const RETRY_DELAYS = [2000, 5000]

  try {
    const systemPrompt = `Tu es un expert SEO. On te donne une URL et un extrait du contenu HTML. Tu dois évaluer un critère SEO spécifique et retourner un score de 0 à 100.

Réponds UNIQUEMENT avec un JSON: {"score": <number>, "justification": "<string courte>"}`

    const userPrompt = `URL: ${url}

EXTRAIT HTML (contenu principal):
${htmlSummary}

CRITÈRE À ÉVALUER:
${prompt}

Score de 0 à 100 pour ce critère:`

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
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!resp.ok) {
      const status = resp.status
      await resp.text()

      if ((status === 429 || status >= 500) && retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retryCount] || 5000
        console.log(`[audit-matrice] LLM ${status}, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
        await new Promise(r => setTimeout(r, delay))
        return evaluateWithLlm(prompt, url, htmlSummary, llmName, retryCount + 1)
      }

      if (status === 402) return { score: 50, raw: { error: 'Payment required', status: 402 } }
      return { score: 50, raw: { error: `API error ${status}`, retries: retryCount } }
    }

    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content || ''
    trackTokenUsage('audit-matrice', llmName || 'google/gemini-2.5-flash', data.usage, url)

    let jsonContent = content
    if (content.includes('```json')) jsonContent = content.split('```json')[1].split('```')[0].trim()
    else if (content.includes('```')) jsonContent = content.split('```')[1].split('```')[0].trim()

    try {
      const parsed = JSON.parse(jsonContent)
      const score = Math.min(100, Math.max(0, Math.round(Number(parsed.score) || 50)))
      return { score, raw: { llm_response: parsed, model: llmName } }
    } catch {
      const numMatch = content.match(/(\d{1,3})/)
      if (numMatch) return { score: Math.min(100, parseInt(numMatch[1])), raw: { llm_raw: content.substring(0, 200), model: llmName } }
      return { score: 50, raw: { llm_raw: content.substring(0, 200), parse_error: true } }
    }
  } catch (e) {
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAYS[retryCount] || 5000
      console.log(`[audit-matrice] LLM error "${e instanceof Error ? e.message : 'unknown'}", retrying in ${delay}ms`)
      await new Promise(r => setTimeout(r, delay))
      return evaluateWithLlm(prompt, url, htmlSummary, llmName, retryCount + 1)
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
    const { url, items } = await req.json() as { url: string; items: ItemInput[] }

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
    const llmPromises: Promise<void>[] = []
    const results: ItemResult[] = []

    for (const item of detectedTypes) {
      const llmPromise = evaluateWithLlm(
        item.prompt, normalizedUrl, htmlSummary,
        item.llm_name || 'google/gemini-2.5-flash'
      )

      if (item._type === 'prompt') {
        llmPromises.push((async () => {
          const { score, raw } = await llmPromise
          results.push({
            id: item.id, prompt: item.prompt, axe: item.axe, poids: item.poids,
            detected_type: 'prompt', crawlers_score: score, parsed_score: score,
            raw_data: raw, parsed_raw: raw,
            seuil_bon: item.seuil_bon, seuil_moyen: item.seuil_moyen, seuil_mauvais: item.seuil_mauvais,
          })
        })())
        continue
      }

      if (!htmlData) {
        llmPromises.push((async () => {
          const { score: pScore, raw: pRaw } = await llmPromise
          results.push({
            id: item.id, prompt: item.prompt, axe: item.axe, poids: item.poids,
            detected_type: item._type, crawlers_score: 0, parsed_score: pScore,
            raw_data: { error: 'HTML fetch failed' }, parsed_raw: pRaw,
            seuil_bon: item.seuil_bon, seuil_moyen: item.seuil_moyen, seuil_mauvais: item.seuil_mauvais,
          })
        })())
        continue
      }

      let score: number
      let raw: Record<string, any>

      switch (item._type) {
        case 'balise':
          ({ score, raw } = computeBaliseScore(item.prompt, htmlData))
          break
        case 'structured_data':
          ({ score, raw } = computeStructuredDataScore(item.prompt, htmlData, robotsData, sitemapData, llmsTxtData))
          break
        case 'performance':
          ({ score, raw } = computePerformanceScore(item.prompt, psiData))
          break
        case 'security':
          ({ score, raw } = computeSecurityScore(item.prompt, htmlData))
          break
        case 'metric_combinee':
        default:
          ({ score, raw } = computeCombinedScore(item.prompt, htmlData, robotsData, sitemapData, psiData))
          break
      }

      const engineScore = score
      const engineRaw = raw

      llmPromises.push((async () => {
        const { score: pScore, raw: pRaw } = await llmPromise
        results.push({
          id: item.id, prompt: item.prompt, axe: item.axe, poids: item.poids,
          detected_type: item._type, crawlers_score: engineScore, parsed_score: pScore,
          raw_data: engineRaw, parsed_raw: pRaw,
          seuil_bon: item.seuil_bon, seuil_moyen: item.seuil_moyen, seuil_mauvais: item.seuil_mauvais,
        })
      })())
    }

    if (llmPromises.length > 0) {
      await Promise.all(llmPromises)
    }

    const orderedResults = items.map(item => results.find(r => r.id === item.id)!)
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
    releaseConcurrency('audit-matrice')
  }
})