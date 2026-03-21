import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getSiteContext, extractDomain } from '../_shared/getSiteContext.ts'
import { cacheKey, getCached, setCache } from '../_shared/auditCache.ts'
import { checkFairUse } from '../_shared/fairUse.ts'
import { trackTokenUsage, trackPaidApiCall } from '../_shared/tokenTracker.ts'

/**
 * content-architecture-advisor
 *
 * Recommends optimal content structure, keyword strategy, semantic ratio,
 * and metadata enrichment based on:
 * 1. Site identity (tracked_sites)
 * 2. DataForSEO keyword data + SERP analysis
 * 3. Competitor TF-IDF via Firecrawl
 * 4. Existing audit data (audit_raw_data, cocoon_sessions)
 * 5. LLM synthesis (Gemini Flash)
 *
 * Input: { url, keyword, page_type, tracked_site_id? }
 * page_type: 'homepage' | 'product' | 'article' | 'faq' | 'landing' | 'category'
 */

const PAGE_TYPES = ['homepage', 'product', 'article', 'faq', 'landing', 'category'] as const

interface AdvisorInput {
  url: string
  keyword: string
  page_type: typeof PAGE_TYPES[number]
  tracked_site_id?: string
  language_code?: string
  location_code?: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = getUserClient(authHeader)
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body: AdvisorInput = await req.json()
    const { url, keyword, page_type, tracked_site_id, language_code = 'fr', location_code = 2250 } = body

    if (!url || !keyword || !page_type) {
      return new Response(JSON.stringify({ error: 'Missing url, keyword, or page_type' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!PAGE_TYPES.includes(page_type)) {
      return new Response(JSON.stringify({ error: `Invalid page_type. Must be one of: ${PAGE_TYPES.join(', ')}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fair use check
    const fairUse = await checkFairUse(user.id, 'strategic_audit' as any)
    if (!fairUse.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded', details: fairUse }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const domain = extractDomain(url)
    const serviceClient = getServiceClient()

    // ── Cache check ──
    const ck = cacheKey('content-architecture-advisor', { domain, keyword, page_type, location_code })
    const cached = await getCached(ck)
    if (cached) {
      console.log(`[content-advisor] Cache hit for ${domain}/${keyword}`)
      return new Response(JSON.stringify({ data: cached, cached: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Step 1: Site Identity ──
    console.log(`[content-advisor] Step 1: Fetching site context for ${domain}`)
    const siteContext = tracked_site_id
      ? await getSiteContext(serviceClient, { trackedSiteId: tracked_site_id, userId: user.id })
      : await getSiteContext(serviceClient, { domain, userId: user.id })

    // ── Step 2: DataForSEO Keywords (parallel) ──
    console.log(`[content-advisor] Step 2: DataForSEO keywords + SERP`)
    const dfLogin = Deno.env.get('DATAFORSEO_LOGIN')
    const dfPassword = Deno.env.get('DATAFORSEO_PASSWORD')
    const dfAuth = dfLogin && dfPassword ? 'Basic ' + btoa(`${dfLogin}:${dfPassword}`) : null

    let keywordData: any = null
    let serpData: any = null

    if (dfAuth) {
      const [kwResp, serpResp] = await Promise.allSettled([
        // Keywords data
        fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live', {
          method: 'POST',
          headers: { 'Authorization': dfAuth, 'Content-Type': 'application/json' },
          body: JSON.stringify([{
            keyword, language_code, location_code,
            limit: 30,
            include_seed_keyword: true,
          }]),
          signal: AbortSignal.timeout(15000),
        }),
        // SERP analysis
        fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
          method: 'POST',
          headers: { 'Authorization': dfAuth, 'Content-Type': 'application/json' },
          body: JSON.stringify([{
            keyword, language_code, location_code,
            depth: 10,
          }]),
          signal: AbortSignal.timeout(15000),
        }),
      ])

      if (kwResp.status === 'fulfilled' && kwResp.value.ok) {
        const json = await kwResp.value.json()
        const items = json?.tasks?.[0]?.result?.[0]?.items || []
        keywordData = {
          seed: { keyword, search_volume: json?.tasks?.[0]?.result?.[0]?.seed_keyword_data?.keyword_info?.search_volume || 0 },
          related: items.slice(0, 20).map((i: any) => ({
            keyword: i.keyword_data?.keyword,
            volume: i.keyword_data?.keyword_info?.search_volume || 0,
            cpc: i.keyword_data?.keyword_info?.cpc || 0,
            competition: i.keyword_data?.keyword_info?.competition_level || 'unknown',
          })),
        }
        trackPaidApiCall('dataforseo', 'related_keywords', user.id)
      }

      if (serpResp.status === 'fulfilled' && serpResp.value.ok) {
        const json = await serpResp.value.json()
        const items = json?.tasks?.[0]?.result?.[0]?.items || []
        serpData = {
          type: json?.tasks?.[0]?.result?.[0]?.type || 'organic',
          items_count: json?.tasks?.[0]?.result?.[0]?.items_count || 0,
          featured_snippet: items.some((i: any) => i.type === 'featured_snippet'),
          people_also_ask: items.filter((i: any) => i.type === 'people_also_ask').flatMap((i: any) => i.items?.map((q: any) => q.title) || []),
          top_organic: items.filter((i: any) => i.type === 'organic').slice(0, 5).map((i: any) => ({
            title: i.title,
            url: i.url,
            description: i.description,
            domain: i.domain,
          })),
        }
        trackPaidApiCall('dataforseo', 'serp_organic', user.id)
      }
    }

    // ── Step 3: Competitor scraping via Firecrawl (top 3 SERP) ──
    console.log(`[content-advisor] Step 3: Competitor scraping`)
    let competitorInsights: any[] = []
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY')

    if (firecrawlKey && serpData?.top_organic?.length) {
      const topUrls = serpData.top_organic.slice(0, 3).map((r: any) => r.url)
      const scrapeResults = await Promise.allSettled(
        topUrls.map((u: string) =>
          fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: u, formats: ['markdown'], onlyMainContent: true }),
            signal: AbortSignal.timeout(20000),
          })
        )
      )

      for (const [idx, result] of scrapeResults.entries()) {
        if (result.status === 'fulfilled' && result.value.ok) {
          try {
            const json = await result.value.json()
            const md = json?.data?.markdown || json?.markdown || ''
            // Simple word frequency analysis
            const words = md.toLowerCase().replace(/[^a-zà-ÿ\s-]/g, '').split(/\s+/).filter((w: string) => w.length > 3)
            const freq: Record<string, number> = {}
            for (const w of words) { freq[w] = (freq[w] || 0) + 1 }
            const topTerms = Object.entries(freq).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 30)
            competitorInsights.push({
              url: topUrls[idx],
              word_count: words.length,
              top_terms: topTerms.map(([term, count]) => ({ term, count })),
            })
          } catch { /* skip */ }
        }
      }
    }

    // ── Step 4: Existing audit data ──
    console.log(`[content-advisor] Step 4: Fetching existing audit data`)
    let existingAuditData: any = null
    let cocoonData: any = null

    const [auditRes, cocoonRes] = await Promise.allSettled([
      serviceClient.from('audit_raw_data').select('raw_payload, audit_type')
        .eq('user_id', user.id).eq('domain', domain)
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      tracked_site_id
        ? serviceClient.from('cocoon_sessions').select('cluster_summary, nodes_count, intent_distribution, internal_links_density')
            .eq('tracked_site_id', tracked_site_id)
            .order('created_at', { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    if (auditRes.status === 'fulfilled' && auditRes.value?.data) {
      existingAuditData = { type: auditRes.value.data.audit_type, payload: auditRes.value.data.raw_payload }
    }
    if (cocoonRes.status === 'fulfilled' && (cocoonRes.value as any)?.data) {
      cocoonData = (cocoonRes.value as any).data
    }

    // ── Step 5: LLM Synthesis ──
    console.log(`[content-advisor] Step 5: LLM synthesis`)
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const siteIdentity = siteContext ? {
      name: siteContext.site_name || siteContext.brand_name,
      sector: siteContext.market_sector,
      targets: siteContext.client_targets,
      business_type: siteContext.business_type,
      commercial_model: (siteContext as any).commercial_model,
      nonprofit_type: (siteContext as any).nonprofit_type,
      jargon_distance: siteContext.jargon_distance,
      language: siteContext.primary_language,
      competitors: siteContext.competitors,
    } : null

    const systemPrompt = `Tu es un expert SEO et architecte de contenu. Tu analyses des données de SERP, de concurrents et d'audits pour recommander la structure de contenu optimale.

RÈGLE ABSOLUE — GARDE-FOU DE COHÉRENCE :
1. **Continuité tonale** : La page recommandée DOIT rester cohérente avec le ton, le design et le vocabulaire des autres pages du même domaine. Ne recommande jamais un style éditorial radicalement différent du site existant.
2. **Prudence sectorielle** : Si le secteur est conservateur (juridique, médical, institutionnel, finance, assurance, services publics, ONG), pondère à la baisse les structures novatrices (FAQ interactive, tone of voice disruptif, etc.). Privilégie la lisibilité et la confiance.
3. **Lisibilité > originalité** : Un contenu lu et compris par sa cible vaut mieux qu'une page au taux de rebond énorme. Si la cible a un jargon_distance élevé (>6), simplifie au maximum. Si la cible est B2C grand public, évite le jargon technique même si les concurrents l'utilisent.
4. **Score d'innovation** : Pour chaque recommandation, évalue si elle est "conservatrice" (proche des pratiques du secteur), "modérée" (légère évolution) ou "disruptive" (très différente). Si disruptive, BAISSE le confidence_score de 15-25 points et ajoute un avertissement explicite dans le rationale.
5. **Non-marchand** : Pour les services publics, associations, ONG, fédérations — le ton doit rester sobre, institutionnel, factuel. Aucun CTA agressif, aucun wording commercial.

Réponds UNIQUEMENT en JSON valide avec cette structure exacte:
{
  "content_structure": {
    "recommended_h1": "Le H1 optimal",
    "hn_hierarchy": [{"level":"h2","text":"...","purpose":"..."},{"level":"h3","text":"...","parent_h2":"..."}],
    "word_count_range": {"min":number,"max":number,"ideal":number},
    "sections": [{"title":"...","purpose":"...","word_count":number,"priority":"high|medium|low"}]
  },
  "keyword_strategy": {
    "primary_keyword": {"keyword":"...","target_density_percent":number},
    "secondary_keywords": [{"keyword":"...","target_density_percent":number,"placement":"..."}],
    "lsi_terms": [{"term":"...","context":"..."}],
    "semantic_ratio": {"technical_jargon_percent":number,"accessible_language_percent":number,"explanation":"..."}
  },
  "metadata_enrichment": {
    "meta_title": "...(max 60 chars)",
    "meta_description": "...(max 155 chars)",
    "json_ld_schemas": [{"type":"...","properties":{"...":"..."},"priority":"high|medium"}],
    "og_tags": {"title":"...","description":"...","type":"..."},
    "structured_data_notes": "..."
  },
  "internal_linking": {
    "recommended_internal_links": number,
    "anchor_strategy": [{"anchor_text":"...","target_intent":"..."}],
    "cluster_opportunities": ["..."]
  },
  "coherence_check": {
    "innovation_level": "conservative|moderate|disruptive",
    "sector_fit": "high|medium|low",
    "tone_continuity": "aligned|slight_shift|breaking",
    "bounce_risk": "low|medium|high",
    "warnings": ["...si applicable"]
  },
  "confidence_score": number,
  "rationale": "Explication courte de la stratégie recommandée"
}`

    // Determine sector conservatism for the prompt
    const conservativeSectors = ['juridique', 'médical', 'santé', 'finance', 'assurance', 'banque', 'institutionnel', 'service public', 'administration', 'éducation', 'pharmacie']
    const sectorStr = (siteIdentity?.sector || '').toLowerCase()
    const isConservativeSector = conservativeSectors.some(s => sectorStr.includes(s))
    const isNonProfit = ['service_public', 'association', 'ong', 'organisation_internationale', 'federation_sportive', 'syndicat'].includes(siteIdentity?.nonprofit_type || '')
    const jargonDist = typeof siteIdentity?.jargon_distance === 'number' ? siteIdentity.jargon_distance : null

    const userPrompt = `Analyse et recommande l'architecture de contenu optimale pour:

**Page cible:** ${url}
**Mot-clé principal:** ${keyword}  
**Type de page:** ${page_type}
**Langue:** ${language_code}

**Identité du site:**
${siteIdentity ? JSON.stringify(siteIdentity, null, 2) : 'Non disponible — recommandations génériques'}

**Données mots-clés DataForSEO:**
${keywordData ? JSON.stringify(keywordData, null, 2) : 'Non disponibles'}

**Analyse SERP (top 5):**
${serpData ? JSON.stringify(serpData, null, 2) : 'Non disponible'}

**TF-IDF concurrents (top termes des 3 premiers résultats):**
${competitorInsights.length > 0 ? JSON.stringify(competitorInsights, null, 2) : 'Non disponible'}

**Données audit existant:**
${existingAuditData ? `Type: ${existingAuditData.type}` : 'Aucun audit récent'}

**Données Cocoon (maillage):**
${cocoonData ? JSON.stringify(cocoonData, null, 2) : 'Pas de données de maillage'}

⚠️ CONTRAINTES DE COHÉRENCE :
- Secteur ${isConservativeSector ? 'CONSERVATEUR — privilégie la sobriété et la crédibilité' : 'standard'}
- Organisation ${isNonProfit ? 'NON MARCHANDE — ton institutionnel, pas de CTA commercial agressif' : 'marchande ou indéterminée'}
- Distance jargon: ${jargonDist !== null ? `${jargonDist}/10 — ${jargonDist > 6 ? 'VULGARISE au maximum, la cible ne maîtrise pas le jargon' : jargonDist > 3 ? 'Équilibre technique/accessible' : 'Public expert, le jargon est attendu'}` : 'inconnue'}
- Business type: ${siteIdentity?.business_type || 'inconnu'}, Model: ${siteIdentity?.commercial_model || 'inconnu'}
- Cible: ${siteIdentity?.targets || 'inconnue'}

IMPORTANT : Le contenu recommandé NE DOIT PAS être en rupture de ton/style avec le reste du site. Reste dans la continuité de ce qui existe déjà. Si tu proposes quelque chose de très différent, SIGNALE-LE dans coherence_check.warnings et BAISSE le confidence_score.

Le ratio sémantique doit refléter la distance jargon: jargon_distance 1-3 → contenu technique, 7-10 → très vulgarisé.
Les schemas JSON-LD doivent être adaptés au type de page: ${page_type}.`

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'content_architecture_recommendation',
            description: 'Returns the optimal content architecture recommendation',
            parameters: {
              type: 'object',
              properties: {
                content_structure: {
                  type: 'object',
                  properties: {
                    recommended_h1: { type: 'string' },
                    hn_hierarchy: { type: 'array', items: { type: 'object' } },
                    word_count_range: { type: 'object', properties: { min: { type: 'number' }, max: { type: 'number' }, ideal: { type: 'number' } } },
                    sections: { type: 'array', items: { type: 'object' } },
                  },
                  required: ['recommended_h1', 'hn_hierarchy', 'word_count_range', 'sections'],
                },
                keyword_strategy: {
                  type: 'object',
                  properties: {
                    primary_keyword: { type: 'object' },
                    secondary_keywords: { type: 'array', items: { type: 'object' } },
                    lsi_terms: { type: 'array', items: { type: 'object' } },
                    semantic_ratio: { type: 'object' },
                  },
                  required: ['primary_keyword', 'secondary_keywords', 'lsi_terms', 'semantic_ratio'],
                },
                metadata_enrichment: {
                  type: 'object',
                  properties: {
                    meta_title: { type: 'string' },
                    meta_description: { type: 'string' },
                    json_ld_schemas: { type: 'array', items: { type: 'object' } },
                    og_tags: { type: 'object' },
                    structured_data_notes: { type: 'string' },
                  },
                  required: ['meta_title', 'meta_description', 'json_ld_schemas'],
                },
                internal_linking: {
                  type: 'object',
                  properties: {
                    recommended_internal_links: { type: 'number' },
                    anchor_strategy: { type: 'array', items: { type: 'object' } },
                    cluster_opportunities: { type: 'array', items: { type: 'string' } },
                  },
                },
                confidence_score: { type: 'number' },
                rationale: { type: 'string' },
              },
              required: ['content_structure', 'keyword_strategy', 'metadata_enrichment', 'confidence_score', 'rationale'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'content_architecture_recommendation' } },
      }),
      signal: AbortSignal.timeout(60000),
    })

    if (!aiResponse.ok) {
      const errText = await aiResponse.text()
      console.error('[content-advisor] AI error:', aiResponse.status, errText)

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'AI rate limited, please try again later' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ error: 'AI synthesis failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const aiJson = await aiResponse.json()
    let recommendation: any = null

    // Extract from tool call
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0]
    if (toolCall?.function?.arguments) {
      try {
        recommendation = typeof toolCall.function.arguments === 'string'
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments
      } catch (e) {
        console.error('[content-advisor] Failed to parse tool call:', e)
      }
    }

    // Fallback: parse from content
    if (!recommendation) {
      const content = aiJson?.choices?.[0]?.message?.content || ''
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) recommendation = JSON.parse(jsonMatch[0])
      } catch { /* ignore */ }
    }

    if (!recommendation) {
      return new Response(JSON.stringify({ error: 'Failed to generate recommendation' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    trackTokenUsage('content-architecture-advisor', aiJson?.usage?.total_tokens || 0, user.id)

    // ── POST-PROCESSING GUARDRAIL: Coherence enforcement ──
    // Even if the LLM ignores our prompt constraints, we enforce them here
    const coherence = recommendation.coherence_check || {}
    let adjustedConfidence = recommendation.confidence_score || 70
    const guardrailWarnings: string[] = [...(coherence.warnings || [])]

    // Penalty: disruptive innovation in conservative sector
    if (isConservativeSector && coherence.innovation_level === 'disruptive') {
      adjustedConfidence = Math.max(20, adjustedConfidence - 25)
      guardrailWarnings.push('⚠️ Secteur conservateur : recommandation très innovante, à valider manuellement avant implémentation.')
    } else if (coherence.innovation_level === 'disruptive') {
      adjustedConfidence = Math.max(30, adjustedConfidence - 15)
      guardrailWarnings.push('⚠️ Structure de contenu très différente des standards du secteur — risque de taux de rebond élevé.')
    }

    // Penalty: tone break
    if (coherence.tone_continuity === 'breaking') {
      adjustedConfidence = Math.max(25, adjustedConfidence - 20)
      guardrailWarnings.push('⚠️ Rupture de ton détectée avec le reste du site — le contenu risque de paraître incohérent pour les visiteurs réguliers.')
    }

    // Penalty: high bounce risk
    if (coherence.bounce_risk === 'high') {
      adjustedConfidence = Math.max(25, adjustedConfidence - 15)
      guardrailWarnings.push('⚠️ Risque de rebond élevé : le contenu est potentiellement trop dense ou trop technique pour la cible.')
    }

    // Nonprofit override: strip aggressive CTAs from sections
    if (isNonProfit) {
      const sections = recommendation.content_structure?.sections || []
      for (const section of sections) {
        if (typeof section.title === 'string') {
          const aggressiveCTA = /achetez|commandez|profitez|offre exclusive|promo/i
          if (aggressiveCTA.test(section.title)) {
            section.title = section.title.replace(aggressiveCTA, '').trim()
            guardrailWarnings.push(`Section "${section.title}" : CTA commercial retiré (organisation non marchande).`)
          }
        }
      }
    }

    // Jargon distance override: cap technical jargon %
    if (jargonDist !== null && jargonDist > 6) {
      const sr = recommendation.keyword_strategy?.semantic_ratio
      if (sr && sr.technical_jargon_percent > 25) {
        guardrailWarnings.push(`Jargon technique ramené de ${sr.technical_jargon_percent}% à 25% max (cible non-experte, jargon_distance=${jargonDist}).`)
        sr.technical_jargon_percent = 25
        sr.accessible_language_percent = 75
      }
    }

    // Apply guardrail results
    recommendation.confidence_score = Math.round(adjustedConfidence)
    recommendation.coherence_check = {
      ...coherence,
      guardrail_applied: true,
      warnings: guardrailWarnings,
    }

    // ── Enrich with source metadata ──
    const result = {
      ...recommendation,
      _meta: {
        domain,
        keyword,
        page_type,
        sources_used: {
          site_identity: !!siteContext,
          dataforseo_keywords: !!keywordData,
          dataforseo_serp: !!serpData,
          competitor_scraping: competitorInsights.length,
          existing_audit: !!existingAuditData,
          cocoon_data: !!cocoonData,
        },
        guardrails: {
          conservative_sector: isConservativeSector,
          nonprofit: isNonProfit,
          jargon_distance: jargonDist,
          warnings_count: guardrailWarnings.length,
        },
        generated_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
      },
    }

    // ── Cache for 12h ──
    try {
      await setCache(ck, 'content-architecture-advisor', result, 12)
    } catch (e) {
      console.warn('[content-advisor] Cache write failed:', e)
    }

    console.log(`[content-advisor] Done in ${Date.now() - startTime}ms`)

    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[content-advisor] Error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
