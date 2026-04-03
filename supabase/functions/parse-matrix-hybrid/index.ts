import { corsHeaders } from '../_shared/cors.ts'
import { assertSafeUrl } from '../_shared/ssrf.ts'
import { fetchAndRenderPage } from '../_shared/renderPage.ts'
import { trackTokenUsage } from '../_shared/tokenTracker.ts'
import { checkIpRate, getClientIp, rateLimitResponse, acquireConcurrency, releaseConcurrency, concurrencyResponse } from '../_shared/ipRateLimiter.ts'
import { detectItemType, type ItemType } from '../_shared/matriceTypeDetector.ts'
import { analyzeHtmlFull } from '../_shared/matriceHtmlAnalysis.ts'
import {
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
  type RobotsData, type SitemapData, type PsiData,
  checkRobots, checkSitemap, checkLlmsTxt, fetchPsi,
  computeBaliseScore, computeStructuredDataScore, computePerformanceScore,
  computeSecurityScore, computeCombinedScore,
} from '../_shared/matriceScoring.ts'

/* ================================================================== */
/*  Hybrid Matrice Audit — SEO engine + GEO LLM combined              */
/* ================================================================== */

interface HybridItem {
  id: string; prompt: string; type?: string; llm_name?: string
  poids: number; axe: string
  seuil_bon: number; seuil_moyen: number; seuil_mauvais: number
}

interface HybridResult {
  id: string; prompt: string; axe: string; poids: number
  detected_type: string
  crawlers_score: number
  parsed_score: number
  geo_score: number
  raw_data: Record<string, any>
  parsed_raw?: Record<string, any>
  seuil_bon: number; seuil_moyen: number; seuil_mauvais: number
}

/* ── LLM evaluation (dual: SEO + GEO) ────────────────────────────── */

async function evaluateHybrid(
  prompt: string, url: string, htmlSummary: string, llmName: string, retryCount = 0
): Promise<{ seoScore: number; geoScore: number; raw: Record<string, any> }> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  if (!LOVABLE_API_KEY) return { seoScore: 50, geoScore: 50, raw: { error: 'No API key' } }

  try {
    const systemPrompt = `Tu es un expert SEO et GEO (Generative Engine Optimization).
On te donne une URL, un extrait HTML et un critère à évaluer.

Tu dois fournir DEUX scores :
1. seo_score : conformité technique SEO classique (balises, structure, performance)
2. geo_score : citabilité par les moteurs IA (structuration pour ChatGPT/Gemini/Perplexity)

Réponds UNIQUEMENT avec un JSON:
{"seo_score": <0-100>, "geo_score": <0-100>, "justification": "<string courte>"}`

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
          { role: 'user', content: `URL: ${url}\n\nEXTRAIT HTML:\n${htmlSummary.substring(0, 4000)}\n\nCRITÈRE:\n${prompt}` },
        ],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!resp.ok) {
      const status = resp.status
      await resp.text()
      if ((status === 429 || status >= 500) && retryCount < 2) {
        await new Promise(r => setTimeout(r, retryCount === 0 ? 2000 : 5000))
        return evaluateHybrid(prompt, url, htmlSummary, llmName, retryCount + 1)
      }
      return { seoScore: 50, geoScore: 50, raw: { error: `API error ${status}` } }
    }

    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content || ''
    trackTokenUsage('parse-matrix-hybrid', llmName || 'google/gemini-2.5-flash', data.usage, url)

    let jsonContent = content
    if (content.includes('```json')) jsonContent = content.split('```json')[1].split('```')[0].trim()
    else if (content.includes('```')) jsonContent = content.split('```')[1].split('```')[0].trim()

    try {
      const parsed = JSON.parse(jsonContent)
      return {
        seoScore: Math.min(100, Math.max(0, Math.round(Number(parsed.seo_score) || 50))),
        geoScore: Math.min(100, Math.max(0, Math.round(Number(parsed.geo_score) || 50))),
        raw: parsed,
      }
    } catch {
      return { seoScore: 50, geoScore: 50, raw: { llm_raw: content.substring(0, 200), parse_error: true } }
    }
  } catch (e) {
    if (retryCount < 2) {
      await new Promise(r => setTimeout(r, 3000))
      return evaluateHybrid(prompt, url, htmlSummary, llmName, retryCount + 1)
    }
    return { seoScore: 50, geoScore: 50, raw: { error: e instanceof Error ? e.message : 'Unknown' } }
  }
}

/* ── HTML summary builder ─────────────────────────────────────────── */

function buildHtmlSummary(rawHtml: string): string {
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

/* ── Main handler ─────────────────────────────────────────────────── */

Deno.serve(handleRequest(async (req) => {
const clientIp = getClientIp(req)
  const ipCheck = checkIpRate(clientIp, 'parse-matrix-hybrid', 15, 60_000)
  if (!ipCheck.allowed) return rateLimitResponse(corsHeaders, ipCheck.retryAfterMs)
  if (!acquireConcurrency('parse-matrix-hybrid', 50)) return concurrencyResponse(corsHeaders)

  try {
    const { url, items } = await req.json() as { url: string; items: HybridItem[] }

    if (!url || !items?.length) {
      return new Response(JSON.stringify({ success: false, error: 'url and items[] required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let normalizedUrl = url.trim()
    if (!normalizedUrl.startsWith('http')) normalizedUrl = `https://${normalizedUrl}`
    assertSafeUrl(normalizedUrl)

    console.log(`[parse-matrix-hybrid] Starting for ${normalizedUrl} with ${items.length} items`)

    // Fetch HTML + external data
    const [htmlResult, robotsData, sitemapData, psiData] = await Promise.all([
      fetchAndRenderPage(normalizedUrl, { timeout: 15000 }).catch(() => null),
      checkRobots(normalizedUrl),
      checkSitemap(normalizedUrl),
      fetchPsi(normalizedUrl),
    ])

    const html = htmlResult?.html || ''
    const htmlData = html ? analyzeHtmlFull(html, normalizedUrl) : null
    const htmlSummary = buildHtmlSummary(html)

    const results: HybridResult[] = []
    const promises: Promise<void>[] = []

    for (const item of items) {
      const itemType = (item.type as ItemType) || detectItemType(item.prompt, item.llm_name)

      // Engine score (SEO)
      let engineScore = 0
      let engineRaw: Record<string, any> = {}
      if (htmlData) {
        switch (itemType) {
          case 'balise': ({ score: engineScore, raw: engineRaw } = computeBaliseScore(item.prompt, htmlData)); break
          case 'structured_data': ({ score: engineScore, raw: engineRaw } = computeStructuredDataScore(item.prompt, htmlData, robotsData, sitemapData, { exists: false, content: '' })); break
          case 'performance': ({ score: engineScore, raw: engineRaw } = computePerformanceScore(item.prompt, psiData)); break
          case 'security': ({ score: engineScore, raw: engineRaw } = computeSecurityScore(item.prompt, htmlData)); break
          default: ({ score: engineScore, raw: engineRaw } = computeCombinedScore(item.prompt, htmlData, robotsData, sitemapData, psiData)); break
        }
      }

      const seoEngineScore = engineScore

      // LLM hybrid evaluation
      promises.push((async () => {
        const { seoScore, geoScore, raw } = await evaluateHybrid(
          item.prompt, normalizedUrl, htmlSummary, item.llm_name || 'google/gemini-2.5-flash'
        )
        // Blend: engine SEO score (60%) + LLM SEO (40%) for crawlers_score
        const blendedSeo = htmlData ? Math.round(seoEngineScore * 0.6 + seoScore * 0.4) : seoScore
        results.push({
          id: item.id, prompt: item.prompt, axe: item.axe, poids: item.poids,
          detected_type: 'hybrid',
          crawlers_score: blendedSeo,
          parsed_score: seoScore,
          geo_score: geoScore,
          raw_data: { ...engineRaw, seo_engine: seoEngineScore },
          parsed_raw: raw,
          seuil_bon: item.seuil_bon, seuil_moyen: item.seuil_moyen, seuil_mauvais: item.seuil_mauvais,
        })
      })())
    }

    await Promise.all(promises)

    const orderedResults = items.map(item => results.find(r => r.id === item.id)!)
    const totalWeight = orderedResults.reduce((s, r) => s + r.poids, 0)
    const globalScore = totalWeight > 0
      ? Math.round(orderedResults.reduce((s, r) => s + r.crawlers_score * r.poids, 0) / totalWeight)
      : 0
    const globalGeoScore = totalWeight > 0
      ? Math.round(orderedResults.reduce((s, r) => s + r.geo_score * r.poids, 0) / totalWeight)
      : 0

    console.log(`[parse-matrix-hybrid] Complete. SEO: ${globalScore}/100, GEO: ${globalGeoScore}/100`)

    return jsonOk({
      success: true, url: normalizedUrl,
      global_score: globalScore, global_geo_score: globalGeoScore,
      total_items: orderedResults.length, audit_type: 'hybrid', results: orderedResults,
    })

  } catch (e) {
    console.error('[parse-matrix-hybrid] Error:', e)
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } finally {
    releaseConcurrency('parse-matrix-hybrid')
  }
})