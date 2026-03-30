import { getServiceClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { trackPaidApiCall, trackEdgeFunctionError } from '../_shared/tokenTracker.ts'

/**
 * snapshot-geo-visibility
 * 
 * Captures LLM visibility metrics for a domain at a given measurement phase.
 * Called by measure-audit-impact during T0/T30/T60/T90 cycles,
 * or standalone for on-demand GEO snapshots.
 * 
 * Input: { domain, tracked_site_id, user_id, measurement_phase, audit_impact_snapshot_id? }
 * Uses check-llm internally to query all LLM providers.
 */

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions'

interface ProviderResult {
  provider: string
  provider_id: string
  company: string
  score: number
  cited: boolean
  sentiment: string
  recommends: boolean
  summary: string
}

async function queryLlmVisibility(
  apiKey: string,
  domain: string,
  marketSector: string | null,
): Promise<{ providers: ProviderResult[]; prompts: string[] }> {
  // Lightweight subset of providers for periodic snapshots (cost control)
  const SNAPSHOT_PROVIDERS = [
    { id: 'gpt4o', name: 'GPT-4o', company: 'OpenAI', model: 'openai/gpt-4o' },
    { id: 'claude35', name: 'Claude 3.5 Sonnet', company: 'Anthropic', model: 'anthropic/claude-3.5-sonnet' },
    { id: 'gemini2', name: 'Gemini 2.0 Flash', company: 'Google', model: 'google/gemini-2.0-flash-001' },
    { id: 'perplexity', name: 'Perplexity Sonar', company: 'Perplexity', model: 'perplexity/sonar' },
  ]

  const sectorCtx = marketSector ? ` dans le secteur ${marketSector}` : ''
  const naturalPrompts = [
    `Quels sont les meilleurs outils ou services${sectorCtx} que tu recommanderais en 2026 ?`,
    `Si je cherche une solution professionnelle${sectorCtx}, quelles options existent sur le marché ?`,
  ]

  const brandPatterns = [
    domain.toLowerCase(),
    domain.replace(/\.\w+$/, '').toLowerCase(),
  ]

  const results: ProviderResult[] = []

  const promises = SNAPSHOT_PROVIDERS.map(async (provider, idx) => {
    await new Promise(r => setTimeout(r, idx * 300))
    try {
      const resp = await fetch(OPENROUTER_API, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://crawlers.fr',
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: 'user', content: naturalPrompts[idx % naturalPrompts.length] },
          ],
          max_tokens: 800,
          temperature: 0.7,
        }),
      })

      if (!resp.ok) {
        console.warn(`[snapshot-geo] ${provider.name} HTTP ${resp.status}`)
        return null
      }

      const data = await resp.json()
      const content = data.choices?.[0]?.message?.content || ''
      trackPaidApiCall('snapshot-geo-visibility', 'openrouter', provider.model, domain)

      const contentLower = content.toLowerCase()
      const cited = brandPatterns.some(p => contentLower.includes(p))

      // Simple sentiment detection
      const positiveWords = ['recommande', 'excellent', 'leader', 'performant', 'fiable', 'recommend', 'excellent', 'leading']
      const negativeWords = ['éviter', 'problème', 'limité', 'avoid', 'limited', 'poor']
      const posCount = positiveWords.filter(w => contentLower.includes(w)).length
      const negCount = negativeWords.filter(w => contentLower.includes(w)).length
      const sentiment = cited ? (posCount > negCount ? 'positive' : negCount > posCount ? 'negative' : 'neutral') : 'neutral'
      const recommends = cited && contentLower.includes(brandPatterns[0]) && posCount > 0

      // Score: 0-100
      let score = 0
      if (cited) score += 50
      if (sentiment === 'positive') score += 30
      else if (sentiment === 'neutral' && cited) score += 15
      if (recommends) score += 20

      return {
        provider: provider.name,
        provider_id: provider.id,
        company: provider.company,
        score: Math.min(100, score),
        cited,
        sentiment,
        recommends,
        summary: content.slice(0, 200),
      }
    } catch (e) {
      console.error(`[snapshot-geo] ${provider.name} error:`, e)
      return null
    }
  })

  const settled = await Promise.allSettled(promises)
  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value) results.push(r.value)
  }

  return { providers: results, prompts: naturalPrompts }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = getServiceClient()
    const body = await req.json()
    const { domain, tracked_site_id, user_id, measurement_phase, audit_impact_snapshot_id } = body

    if (!domain || !tracked_site_id || !user_id) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const phase = measurement_phase || 'baseline'
    const apiKey = Deno.env.get('OPENROUTER_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'Missing API key' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get market sector from tracked site
    const { data: site } = await supabase
      .from('tracked_sites')
      .select('market_sector')
      .eq('id', tracked_site_id)
      .single()

    console.log(`[snapshot-geo] Capturing ${phase} for ${domain}...`)

    const { providers, prompts } = await queryLlmVisibility(apiKey, domain, site?.market_sector || null)

    if (providers.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'No providers responded' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const citedCount = providers.filter(p => p.cited).length
    const totalModels = providers.length
    const citationRate = (citedCount / totalModels) * 100
    const overallScore = Math.round(providers.reduce((s, p) => s + p.score, 0) / totalModels)
    const avgSentiment = providers.filter(p => p.cited).length > 0
      ? providers.filter(p => p.cited).reduce((s, p) => s + (p.sentiment === 'positive' ? 1 : p.sentiment === 'negative' ? -1 : 0), 0) / citedCount
      : 0
    const recommendationRate = totalModels > 0
      ? (providers.filter(p => p.recommends).length / totalModels) * 100
      : 0
    const brandMentionCount = citedCount

    // Compute deltas if not baseline
    let deltaOverall = null
    let deltaCitation = null
    let deltaSentiment = null

    if (phase !== 'baseline') {
      const { data: baseline } = await supabase
        .from('geo_visibility_snapshots')
        .select('overall_score, citation_rate, avg_sentiment_score')
        .eq('tracked_site_id', tracked_site_id)
        .eq('measurement_phase', 'baseline')
        .order('measured_at', { ascending: false })
        .limit(1)
        .single()

      if (baseline) {
        deltaOverall = overallScore - (baseline.overall_score || 0)
        deltaCitation = citationRate - (baseline.citation_rate || 0)
        deltaSentiment = avgSentiment - (baseline.avg_sentiment_score || 0)
      }
    }

    // Insert snapshot
    const { error: insertErr } = await supabase
      .from('geo_visibility_snapshots')
      .insert({
        tracked_site_id,
        user_id,
        domain,
        measurement_phase: phase,
        audit_impact_snapshot_id: audit_impact_snapshot_id || null,
        overall_score: overallScore,
        cited_count: citedCount,
        total_models: totalModels,
        citation_rate: Math.round(citationRate * 10) / 10,
        provider_scores: providers,
        avg_sentiment_score: Math.round(avgSentiment * 100) / 100,
        recommendation_rate: Math.round(recommendationRate * 10) / 10,
        brand_mention_count: brandMentionCount,
        prompts_used: prompts,
        market_sector: site?.market_sector || null,
        delta_overall_score: deltaOverall,
        delta_citation_rate: deltaCitation,
        delta_sentiment: deltaSentiment,
      })

    if (insertErr) {
      console.error('[snapshot-geo] Insert error:', insertErr)
      throw insertErr
    }

    console.log(`[snapshot-geo] ✅ ${domain} ${phase}: score=${overallScore}, cited=${citedCount}/${totalModels}`)

    return new Response(JSON.stringify({
      success: true,
      phase,
      overall_score: overallScore,
      citation_rate: Math.round(citationRate * 10) / 10,
      cited_count: citedCount,
      total_models: totalModels,
      delta_overall_score: deltaOverall,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[snapshot-geo] Error:', error)
    await trackEdgeFunctionError('snapshot-geo-visibility', error instanceof Error ? error.message : 'Unknown').catch(() => {})
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
