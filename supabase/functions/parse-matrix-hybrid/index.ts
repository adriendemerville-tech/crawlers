import { corsHeaders } from '../_shared/cors.ts'
import { assertSafeUrl } from '../_shared/ssrf.ts'
import { fetchAndRenderPage } from '../_shared/renderPage.ts'
import { trackTokenUsage } from '../_shared/tokenTracker.ts'
import { checkIpRate, getClientIp, rateLimitResponse, acquireConcurrency, releaseConcurrency, concurrencyResponse } from '../_shared/ipRateLimiter.ts'
import { detectItemType, type ItemType } from '../_shared/matriceTypeDetector.ts'
import { analyzeHtmlFull } from '../_shared/matriceHtmlAnalysis.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts'
import { writeIdentity } from '../_shared/identityGateway.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
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

    // ── Optional: read identity card if site is tracked ──────────────
    let domain = ''
    try { domain = new URL(normalizedUrl).hostname.replace(/^www\./, '') } catch { domain = normalizedUrl }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    let trackedSite: Record<string, any> | null = null
    try {
      const { data } = await sb
        .from('tracked_sites')
        .select('id, user_id, domain, site_name, market_sector, entity_type, commercial_model, target_audience, products_services, commercial_area, cms_platform, competitors')
        .eq('domain', domain)
        .limit(1)
        .maybeSingle()
      if (data) {
        trackedSite = data
        console.log(`[parse-matrix-hybrid] 📇 Identity card loaded for ${domain} (sector: ${data.market_sector || 'unknown'})`)
      }
    } catch (e) {
      console.warn(`[parse-matrix-hybrid] Could not load identity card:`, e)
    }

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

    // ── Mandatory: write to identity card if site is tracked ─────────
    if (trackedSite) {
      try {
        const identityFields: Record<string, unknown> = {}

        // Detect CMS from HTML signals
        if (htmlData && !trackedSite.cms_platform) {
          const cmsSignals = html.toLowerCase()
          if (cmsSignals.includes('wp-content') || cmsSignals.includes('wordpress')) identityFields.cms_platform = 'wordpress'
          else if (cmsSignals.includes('shopify')) identityFields.cms_platform = 'shopify'
          else if (cmsSignals.includes('wix.com')) identityFields.cms_platform = 'wix'
          else if (cmsSignals.includes('squarespace')) identityFields.cms_platform = 'squarespace'
          else if (cmsSignals.includes('prestashop')) identityFields.cms_platform = 'prestashop'
          else if (cmsSignals.includes('drupal')) identityFields.cms_platform = 'drupal'
          else if (cmsSignals.includes('joomla')) identityFields.cms_platform = 'joomla'
          else if (cmsSignals.includes('webflow')) identityFields.cms_platform = 'webflow'
        }

        // Extract entity_type from structured data if missing
        if (htmlData && !trackedSite.entity_type) {
          const jsonLdMatch = html.match(/"@type"\s*:\s*"([^"]+)"/i)
          if (jsonLdMatch) {
            const schemaType = jsonLdMatch[1].toLowerCase()
            if (schemaType.includes('localbusiness') || schemaType.includes('store')) identityFields.entity_type = 'local_business'
            else if (schemaType.includes('organization')) identityFields.entity_type = 'business'
            else if (schemaType.includes('person')) identityFields.entity_type = 'freelance'
          }
        }

        // Extract site_name from OG/title if missing
        if (htmlData && !trackedSite.site_name) {
          const ogSiteName = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i)
          if (ogSiteName?.[1]) identityFields.site_name = ogSiteName[1].trim()
        }

        if (Object.keys(identityFields).length > 0) {
          const writeResult = await writeIdentity({
            siteId: trackedSite.id,
            fields: identityFields,
            source: 'matrix',
            userId: trackedSite.user_id,
          })
          console.log(`[parse-matrix-hybrid] 📇→ Identity card updated: ${writeResult.applied.join(', ') || 'none'} | pending: ${writeResult.pendingReview.join(', ') || 'none'}`)
        } else {
          console.log(`[parse-matrix-hybrid] 📇 No new identity fields to write for ${domain}`)
        }
      } catch (e) {
        console.warn(`[parse-matrix-hybrid] Identity card write failed (non-blocking):`, e)
      }
    }

    // ── Mandatory: write findings to architect_workbench if site is tracked ──
    if (trackedSite) {
      try {
        const findings = orderedResults.filter(r => r.crawlers_score < r.seuil_moyen)
        if (findings.length > 0) {
          const rows = findings.map(f => {
            // Map axe to workbench finding_category
            const categoryMap: Record<string, string> = {
              'balises': 'meta_tags',
              'structure': 'structured_data',
              'performance': 'speed',
              'securite': 'security',
              'sécurité': 'security',
              'contenu': 'thin_content',
              'content': 'thin_content',
              'accessibilite': 'accessibility',
              'accessibilité': 'accessibility',
              'mobile': 'mobile',
              'linking': 'linking',
              'maillage': 'linking',
              'geo': 'geo_visibility',
              'eeat': 'eeat',
              'seo': 'meta_tags',
            }
            const category = categoryMap[f.axe?.toLowerCase()] || 'technical_fix'
            const severity = f.crawlers_score <= f.seuil_mauvais ? 'critical'
              : f.crawlers_score < f.seuil_moyen ? 'high' : 'medium'

            return {
              domain,
              tracked_site_id: trackedSite.id,
              user_id: trackedSite.user_id,
              source_type: 'audit_tech',
              source_function: 'parse-matrix-hybrid',
              source_record_id: `matrix_${domain}_${f.id}`,
              finding_category: category,
              severity,
              title: `Matrice: ${f.prompt.substring(0, 80)}`,
              description: f.parsed_raw?.justification || `Score ${f.crawlers_score}/100 (seuil: ${f.seuil_moyen})`,
              target_url: normalizedUrl,
              target_operation: 'replace',
              payload: {
                crawlers_score: f.crawlers_score,
                geo_score: f.geo_score,
                parsed_score: f.parsed_score,
                axe: f.axe,
                poids: f.poids,
                seuil_bon: f.seuil_bon,
                seuil_moyen: f.seuil_moyen,
                seuil_mauvais: f.seuil_mauvais,
                raw_data: f.raw_data,
                parsed_raw: f.parsed_raw,
              },
            }
          })

          // Upsert: use source_record_id to avoid duplicates on re-audit
          for (const row of rows) {
            await sb
              .from('architect_workbench')
              .upsert(row, { onConflict: 'source_type,source_record_id' })
          }

          console.log(`[parse-matrix-hybrid] 🏗️ Workbench: ${rows.length} findings written (${findings.filter(f => f.crawlers_score <= f.seuil_mauvais).length} critical)`)
        } else {
          console.log(`[parse-matrix-hybrid] 🏗️ Workbench: all items above threshold, no findings to write`)
        }
      } catch (e) {
        console.warn(`[parse-matrix-hybrid] Workbench write failed (non-blocking):`, e)
      }
    }

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
}))
