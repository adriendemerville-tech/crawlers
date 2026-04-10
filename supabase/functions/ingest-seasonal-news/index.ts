/**
 * ingest-seasonal-news — Fetches real-time sectoral news via Perplexity (OpenRouter)
 * 
 * Modes:
 *   1. "cron" — Daily scan: fetches SEO/GEO news + sector-specific news for tracked sectors
 *   2. "on-demand" — For a specific sector (triggered by Félix press review)
 * 
 * Uses Perplexity via OpenRouter for grounded web search results.
 * Falls back to Lovable AI for trend analysis if OpenRouter unavailable.
 */
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { trackTokenUsage } from '../_shared/logAIUsage.ts'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const LOVABLE_AI_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions'

interface NewsItem {
  headline: string
  summary: string
  source_url?: string
  source_name?: string
  news_type: 'seo' | 'geo' | 'sectorial' | 'trend' | 'weather' | 'regulation'
  relevance_score: number
  keywords: string[]
}

async function fetchSectorNews(sector: string, geo: string, newsTypes: string[]): Promise<NewsItem[]> {
  const orKey = Deno.env.get('OPENROUTER_API_KEY')
  const lovableKey = Deno.env.get('LOVABLE_API_KEY')

  const now = new Date()
  const dateStr = now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  const prompt = `Nous sommes le ${dateStr}. Tu es un analyste de veille sectorielle et SEO.

Pour le secteur "${sector}" en zone "${geo}", identifie les actualités RÉCENTES et PERTINENTES qui pourraient impacter la stratégie SEO/GEO/contenu d'un site web dans ce secteur.

Types de news à chercher : ${newsTypes.join(', ')}

Pour chaque news, donne :
- headline: titre court et percutant (max 100 caractères)
- summary: résumé actionnable en 1-2 phrases (comment ça impacte le SEO/contenu du secteur)
- source_url: URL de la source si disponible
- source_name: nom de la source
- news_type: "seo", "geo", "sectorial", "trend", "weather", ou "regulation"
- relevance_score: 1-100 (impact business pour ce secteur)
- keywords: 2-4 mots-clés de recherche associés que les internautes vont taper

IMPORTANT : 
- Ne génère que des news RÉCENTES (< 7 jours) et VÉRIFIÉES
- Priorise les actualités ayant un impact SEO concret (saisonnalité, pic de recherche, changement algo)
- Si c'est un événement météo/saisonnier, explique comment ça crée une opportunité de contenu

Réponds UNIQUEMENT en JSON valide : { "news": [...] }`

  // Try Perplexity via OpenRouter first (grounded search)
  if (orKey) {
    try {
      const resp = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${orKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://crawlers.lovable.app',
          'X-Title': 'Crawlers.fr',
        },
        body: JSON.stringify({
          model: 'perplexity/sonar',
          messages: [
            { role: 'system', content: 'Tu es un analyste SEO expert en veille sectorielle. Réponds uniquement en JSON valide.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
        signal: AbortSignal.timeout(25000),
      })

      if (resp.ok) {
        const data = await resp.json()
        trackTokenUsage('ingest-seasonal-news', 'perplexity/sonar', data.usage)
        const raw = data.choices?.[0]?.message?.content || ''
        const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const parsed = JSON.parse(jsonStr)
        return (parsed.news || []).filter((n: any) => n.headline && n.news_type)
      }
      console.warn(`[ingest-news] OpenRouter error: ${resp.status}`)
    } catch (e) {
      console.warn('[ingest-news] Perplexity call failed, falling back to Lovable AI:', e)
    }
  }

  // Fallback: Lovable AI (no grounded search, but still useful for trend analysis)
  if (lovableKey) {
    try {
      const resp = await fetch(LOVABLE_AI_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'Tu es un analyste SEO. Réponds uniquement en JSON valide.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.4,
          max_tokens: 2000,
        }),
        signal: AbortSignal.timeout(20000),
      })

      if (resp.ok) {
        const data = await resp.json()
        trackTokenUsage('ingest-seasonal-news', 'google/gemini-2.5-flash', data.usage)
        const raw = data.choices?.[0]?.message?.content || ''
        const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const parsed = JSON.parse(jsonStr)
        return (parsed.news || []).filter((n: any) => n.headline && n.news_type)
      }
    } catch (e) {
      console.error('[ingest-news] Lovable AI fallback failed:', e)
    }
  }

  return []
}

Deno.serve(handleRequest(async (req) => {
  const sb = getServiceClient()
  const body = await req.json().catch(() => ({}))
  const mode = body.mode || 'cron'
  const targetSector = body.sector || null
  const geo = body.geo || 'FR'
  const newsTypes = body.news_types || ['seo', 'geo', 'sectorial', 'trend', 'weather', 'regulation']

  // Clean expired news first
  await sb.from('seasonal_news_cache').delete().lt('expires_at', new Date().toISOString())

  let sectorsToProcess: string[] = []

  if (mode === 'on-demand' && targetSector) {
    sectorsToProcess = [targetSector]
  } else {
    // Always include global SEO/GEO news
    sectorsToProcess = ['all']

    // Add tracked sectors
    const { data: sites } = await sb
      .from('tracked_sites')
      .select('market_sector')
      .not('market_sector', 'is', null)

    const uniqueSectors = [...new Set(
      (sites || []).map((s: any) => s.market_sector?.toLowerCase()?.trim()).filter(Boolean)
    )] as string[]

    // Limit to 3 sectors per cron to control costs
    sectorsToProcess.push(...uniqueSectors.slice(0, 3))
  }

  console.log(`[ingest-news] Processing ${sectorsToProcess.length} sector(s): ${sectorsToProcess.join(', ')}`)

  let totalInserted = 0
  const errors: string[] = []

  for (const sector of sectorsToProcess) {
    try {
      const sectorLabel = sector === 'all' ? 'SEO/GEO général' : sector
      const types = sector === 'all' ? ['seo', 'geo', 'trend'] : newsTypes
      const news = await fetchSectorNews(sectorLabel, geo, types)

      for (const item of news) {
        // Deduplicate by headline similarity
        const { data: existing } = await sb
          .from('seasonal_news_cache')
          .select('id')
          .eq('headline', item.headline)
          .eq('sector', sector)
          .limit(1)

        if (existing && existing.length > 0) continue

        const { error: insertErr } = await sb.from('seasonal_news_cache').insert({
          sector,
          geo_zone: geo,
          headline: item.headline,
          summary: item.summary || '',
          source_url: item.source_url || null,
          source_name: item.source_name || null,
          news_type: item.news_type || 'sectorial',
          relevance_score: item.relevance_score || 50,
          keywords: item.keywords || [],
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })

        if (insertErr) {
          console.warn(`[ingest-news] Insert error:`, insertErr.message)
        } else {
          totalInserted++
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${sector}: ${msg}`)
    }
  }

  // Log analytics
  await sb.from('analytics_events').insert({
    event_type: 'ingest-seasonal-news',
    event_data: {
      mode,
      sectors_processed: sectorsToProcess,
      inserted: totalInserted,
      errors: errors.length,
    },
  }).catch(() => {})

  return jsonOk({
    mode,
    sectors_processed: sectorsToProcess,
    inserted: totalInserted,
    errors: errors.length > 0 ? errors : undefined,
  })
}))
