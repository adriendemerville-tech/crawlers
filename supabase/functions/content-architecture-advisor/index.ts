import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getSiteContext, extractDomain } from '../_shared/getSiteContext.ts'
import { cacheKey, getCached, setCache } from '../_shared/auditCache.ts'
import { checkFairUse, checkMonthlyFairUse } from '../_shared/fairUse.ts'
import { trackTokenUsage, trackPaidApiCall } from '../_shared/tokenTracker.ts'
import { buildContentBrief, briefToPromptBlock, type PageType as BriefPageType } from '../_shared/contentBrief.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { analyzeHtmlFull, type HtmlData } from '../_shared/matriceHtmlAnalysis.ts';
import { extractInjectionPoints, injectionPointsToPrompt, type InjectionPoints } from '../_shared/injectionPoints.ts';
import { runEditorialPipeline, type ContentType } from '../_shared/editorialPipeline.ts';
import { buildCacheKey, getUserCache, getCrawlersRecommendation, saveCache, payloadToMarkdown } from '../_shared/contentArchitectCache.ts';

// Map content-architect page_type → editorial pipeline content_type
const PAGE_TYPE_TO_CONTENT_TYPE: Record<string, ContentType> = {
  homepage: 'landing_page',
  product: 'landing_page',
  article: 'blog_article',
  faq: 'faq',
  landing: 'landing_page',
  category: 'seo_page',
};

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

interface StrategicObjective {
  type: 'content_gap' | 'eeat_improvement' | 'new_keyword' | 'internal_linking' | 'silo_rebalance' | 'cannibalization_fix' | 'topical_authority' | 'geo_visibility'
  description: string
  priority: 'high' | 'medium' | 'low'
  related_urls?: string[]
  related_keywords?: string[]
}

interface AdvisorInput {
  url: string
  keyword: string
  page_type: typeof PAGE_TYPES[number]
  tracked_site_id?: string
  language_code?: string
  location_code?: number
  // Multi-objective strategic context
  strategic_objectives?: StrategicObjective[]
  target_internal_links?: { url: string; anchor_text?: string; reason?: string }[]
  cannibalization_data?: { keyword: string; competing_urls: string[]; severity: string }[]
  silo_context?: { cluster_name: string; existing_pages: string[]; gap_description?: string }
  target_audience_segment?: 'primary' | 'secondary' | 'untapped' | 'all'
}

// ── Heavy processing logic (extracted for waitUntil) ──
async function processAdvisorRequest(req: Request, isWaitUntilMode: boolean): Promise<Response> {
// ── ASYNC JOB POLLING (GET ?job_id=xxx) ──
  const reqUrl = new URL(req.url)
  const pollJobId = reqUrl.searchParams.get('job_id')
  if (pollJobId && req.method === 'GET') {
    const sb = getServiceClient()
    const { data: job } = await sb.from('async_jobs').select('status, result_data, error_message, progress').eq('id', pollJobId).single()
    if (!job) return jsonError('Job not found', 404)
    if (job.status === 'completed') return jsonOk({ success: true, data: job.result_data, status: 'completed' })
    if (job.status === 'failed') return jsonError(job.error_message || 'Job failed', 500)
    return jsonOk({ status: job.status, progress: job.progress || 0 })
  }

  const startTime = Date.now()

  let _jobId: string | undefined
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonError('Unauthorized', 401)
    }

    // Service role bypass for internal calls (autopilot-engine, etc.)
    const token = authHeader.replace('Bearer ', '')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const isServiceRole = !!(serviceRoleKey && token === serviceRoleKey)

    let user: { id: string; email?: string } | null = null
    if (isServiceRole) {
      // For service role calls (from autopilot-engine), use user_id from body if provided
      // This is needed because async_jobs.user_id is uuid NOT NULL
      const bodyForUserId = await req.clone().json().catch(() => ({}))
      const serviceUserId = bodyForUserId.user_id || bodyForUserId._service_user_id
      if (serviceUserId && serviceUserId !== 'service-role') {
        user = { id: serviceUserId, email: 'system@crawlers.fr' }
      } else {
        // Fallback: look up any admin user to use as owner
        const sb = getServiceClient()
        const { data: adminProfile } = await sb.from('profiles').select('id').eq('is_admin', true).limit(1).maybeSingle()
        user = { id: adminProfile?.id || '00000000-0000-0000-0000-000000000000', email: 'system@crawlers.fr' }
      }
    } else {
      const userClient = getUserClient(authHeader)
      const { data: { user: authUser }, error: userError } = await userClient.auth.getUser()
      if (userError || !authUser) {
        return jsonError('Invalid token', 401)
      }
      user = authUser
    }

    const body: AdvisorInput & { async?: boolean; _job_id?: string } = await req.json()
    const { url, keyword, page_type, tracked_site_id, language_code = 'fr', location_code = 2250, strategic_objectives, target_internal_links, cannibalization_data, silo_context, target_audience_segment = 'primary' } = body

    if (!url || !keyword || !page_type) {
      return jsonError('Missing url, keyword, or page_type', 400)
    }

    if (!PAGE_TYPES.includes(page_type)) {
      return new Response(JSON.stringify({ error: `Invalid page_type. Must be one of: ${PAGE_TYPES.join(', ')}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── EDITORIAL PIPELINE SHORT-CIRCUIT ──
    // Opt-in via use_editorial_pipeline=true: route through the shared 4-stage pipeline
    // (Briefing → Strategist → Writer → Tonalizer) instead of the legacy single-LLM path.
    const usePipeline = (body as { use_editorial_pipeline?: boolean }).use_editorial_pipeline === true;
    if (usePipeline) {
      try {
        const sb = getServiceClient();
        const domain = extractDomain(url);
        const ct = PAGE_TYPE_TO_CONTENT_TYPE[page_type] ?? 'seo_page';
        const pipelineResult = await runEditorialPipeline(sb, {
          user_id: user.id,
          domain,
          tracked_site_id,
          content_type: ct,
          target_url: url,
          user_brief: keyword,
          override_models: (body as { override_models?: Record<string, string> }).override_models,
        });
        console.log(`[content-advisor] Editorial pipeline OK in ${pipelineResult.total_latency_ms}ms`);
        return jsonOk({
          success: true,
          source: 'editorial_pipeline',
          pipeline_run_id: pipelineResult.pipeline_run_id,
          briefing: pipelineResult.briefing,
          strategy: pipelineResult.strategy,
          draft: pipelineResult.draft,
          final: pipelineResult.final,
          metrics: {
            total_latency_ms: pipelineResult.total_latency_ms,
            total_cost_usd: pipelineResult.total_cost_usd,
          },
        });
      } catch (pipelineErr) {
        console.error('[content-advisor] Editorial pipeline failed, falling back to legacy:', pipelineErr);
      }
    }

    // ── ASYNC MODE: Enqueue and respond 202, then process via waitUntil ──
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const jobId = body._job_id
    _jobId = jobId
    const jobSb = jobId ? getServiceClient() : null

    if (body.async === true && !jobId) {
      // Create async job
      const sb = getServiceClient()
      const { data: job, error: jobError } = await sb
        .from('async_jobs')
        .insert({
          user_id: user.id,
          function_name: 'content-architecture-advisor',
          status: 'pending',
          input_payload: { url, keyword, page_type, tracked_site_id, language_code, location_code, strategic_objectives, target_internal_links, cannibalization_data, silo_context, target_audience_segment },
        })
        .select('id')
        .single()

      if (jobError || !job) {
        return jsonError('Failed to create async job', 500)
      }

      // Fire-and-forget: self-invoke with _job_id
      const syncBody = { ...body, async: false, _job_id: job.id }
      fetch(`${SUPABASE_URL}/functions/v1/content-architecture-advisor`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(syncBody),
      }).catch(err => console.error('[content-advisor] Async self-invoke failed:', err))

      console.log(`[content-advisor] Async job created: ${job.id} for ${keyword}@${extractDomain(url)}`)
      return new Response(JSON.stringify({ job_id: job.id, status: 'pending' }), {
        status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // If processing a job, mark as processing
    if (jobSb && jobId) {
      await jobSb.from('async_jobs').update({ status: 'processing', started_at: new Date().toISOString(), progress: 5 }).eq('id', jobId)
    }

    // Fair use check (hourly/daily) — skip for service role
    if (!isServiceRole) {
      const fairUse = await checkFairUse(user.id, 'strategic_audit' as any)
      if (!fairUse.allowed) {
        return jsonError('Rate limit exceeded', 429)
      }
    }

    // Monthly content creation fair use (Pro Agency: 100/mo, Pro Agency+: 150/mo)
    const serviceClientForPlan = getServiceClient()

    // ── Service role bypass: Parménion (autopilot) never pays credits ──
    let creditsDeducted = false
    const CONTENT_CREDIT_COST = 5

    if (!isServiceRole) {
      const { data: userProfile } = await serviceClientForPlan
        .from('profiles')
        .select('plan_type, subscription_status, credits_balance')
        .eq('user_id', user.id)
        .single()

      const isActiveSubscriber = (
        (userProfile?.plan_type === 'agency_pro' || userProfile?.plan_type === 'agency_premium') &&
        (userProfile?.subscription_status === 'active' || userProfile?.subscription_status === 'canceling')
      )

      const planType = userProfile?.plan_type === 'agency_premium' && isActiveSubscriber
        ? 'agency_premium'
        : userProfile?.plan_type === 'agency_pro' && isActiveSubscriber
          ? 'agency_pro' : 'free'

      const monthlyFairUse = await checkMonthlyFairUse(user.id, 'content_creation', planType)

      const deductCredits = async (): Promise<{ success: boolean; new_balance?: number; error?: string }> => {
        const currentBalance = userProfile?.credits_balance ?? 0
        if (currentBalance < CONTENT_CREDIT_COST) {
          return { success: false, error: 'insufficient_credits' }
        }
        const { data, error } = await serviceClientForPlan.rpc('atomic_credit_update', {
          p_user_id: user!.id,
          p_amount: -CONTENT_CREDIT_COST,
        })
        if (error || !(data as any)?.success) {
          return { success: false, error: (data as any)?.error || error?.message || 'unknown' }
        }
        await serviceClientForPlan.from('credit_transactions').insert({
          user_id: user!.id,
          amount: -CONTENT_CREDIT_COST,
          transaction_type: 'usage',
          description: `Content Architect: ${keyword} (${page_type})`,
        })
        return { success: true, new_balance: (data as any).new_balance }
      }

      if (!monthlyFairUse.allowed) {
        if (isActiveSubscriber) {
          return jsonError('Monthly content creation limit reached', 429)
        }
        const result = await deductCredits()
        if (!result.success) {
          return jsonError('Crédits insuffisants', 402)
        }
        creditsDeducted = true
        console.log(`[content-advisor] Deducted ${CONTENT_CREDIT_COST} credits from ${user.id} (balance: ${result.new_balance})`)
      } else if (!isActiveSubscriber) {
        const result = await deductCredits()
        if (!result.success) {
          return jsonError('Crédits insuffisants', 402)
        }
        creditsDeducted = true
        console.log(`[content-advisor] Deducted ${CONTENT_CREDIT_COST} credits from ${user.id} (balance: ${result.new_balance})`)
      }
    } else {
      console.log(`[content-advisor] Service role call — skipping credit check (Parménion/autopilot)`)
    }

    const domain = extractDomain(url)
    const serviceClient = getServiceClient()

    // ── Cache check (legacy short-TTL) ──
    const ck = cacheKey('content-architecture-advisor', { domain, keyword, page_type, location_code })
    const forceRegenerate = (body as { force_regenerate?: boolean }).force_regenerate === true
    if (!forceRegenerate) {
      const cached = await getCached(ck)
      if (cached) {
        console.log(`[content-advisor] Legacy cache hit for ${domain}/${keyword}`)
        return jsonOk({ data: cached, cached: true })
      }
    }

    // ── Persistent .md cache (per-user, 30d TTL) ──
    const contentLengthForKey = (body as { content_length?: string }).content_length
    const persistentKey = await buildCacheKey({
      domain, keyword,
      page_type,
      length: contentLengthForKey,
      lang: language_code,
      secondary_keywords: (body as { keywords?: string[] }).keywords,
    })
    if (!forceRegenerate && !isServiceRole) {
      const own = await getUserCache(serviceClient, user.id, persistentKey)
      if (own) {
        console.log(`[content-advisor] Persistent .md cache HIT (self) for ${keyword}`)
        return jsonOk({
          data: own.payload,
          cached: true,
          cache_source: 'self',
          cache_age_days: Math.floor((Date.now() - new Date(own.created_at).getTime()) / 86400000),
          markdown: own.markdown,
        })
      }
    }


    // ── Step 1: Site Identity + CMS Detection + Content Template ──
    if (jobSb && jobId) await jobSb.from('async_jobs').update({ progress: 10 }).eq('id', jobId)
    console.log(`[content-advisor] Step 1: Fetching site context + CMS + prompt template for ${domain}`)
    const siteContext = tracked_site_id
      ? await getSiteContext(serviceClient, { trackedSiteId: tracked_site_id, userId: user.id })
      : await getSiteContext(serviceClient, { domain, userId: user.id })

    // Detect CMS connection for implementation routing
    let cmsConnection: { platform: string; hasWriteAccess: boolean; capabilities: any } | null = null
    const resolvedSiteId = tracked_site_id || (siteContext as any)?.id
    if (resolvedSiteId) {
      const { data: conn } = await serviceClient
        .from('cms_connections')
        .select('platform, status, auth_method, capabilities')
        .eq('tracked_site_id', resolvedSiteId)
        .eq('status', 'active')
        .maybeSingle()
      if (conn) {
        const caps = (conn.capabilities as Record<string, any>) || {}
        cmsConnection = {
          platform: conn.platform,
          hasWriteAccess: caps.write_content === true || caps.write_meta === true || conn.auth_method === 'oauth2' || conn.auth_method === 'api_key',
          capabilities: caps,
        }
        console.log(`[content-advisor] CMS detected: ${conn.platform} (write: ${cmsConnection.hasWriteAccess})`)
      }
    }

    // ── Step 1b: Scan target page HTML (existing content analysis) ──
    let existingPageHtml: HtmlData | null = null
    let existingPageHtmlRaw = ''
    try {
      console.log(`[content-advisor] Step 1b: Fetching target page HTML for ${url}`)
      const htmlResp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Crawlers-ContentArchitect/1.0)' },
        signal: AbortSignal.timeout(12000),
        redirect: 'follow',
      })
      if (htmlResp.ok) {
        existingPageHtmlRaw = await htmlResp.text()
        existingPageHtml = analyzeHtmlFull(existingPageHtmlRaw, url)
        console.log(`[content-advisor] ✅ HTML scan: title="${existingPageHtml.titleContent}" h1=${existingPageHtml.h1Count} h2=${existingPageHtml.h2Count} words=${existingPageHtml.wordCount} schema=${existingPageHtml.schemaTypes.join(',')} images=${existingPageHtml.imagesTotal}`)
      } else {
        console.log(`[content-advisor] ⚠️ HTML fetch failed: HTTP ${htmlResp.status} — page may not exist yet`)
      }
    } catch (e) {
      console.log(`[content-advisor] ⚠️ HTML scan skipped: ${e instanceof Error ? e.message : String(e)}`)
    }

    // ── Load SEO/GEO prompt template for this page type ──
    const templatePageType = page_type === 'homepage' || page_type === 'category' ? 'landing'
      : page_type === 'faq' ? 'article'
      : page_type as string
    let contentTemplate: any = null
    {
      const { data: tpl } = await serviceClient
        .from('content_prompt_templates')
        .select('*')
        .eq('page_type', templatePageType)
        .eq('is_active', true)
        .maybeSingle()
      if (tpl) {
        contentTemplate = tpl
        console.log(`[content-advisor] Loaded prompt template: ${tpl.label} (${tpl.page_type})`)
      } else {
        console.log(`[content-advisor] No template found for page_type=${templatePageType}, using defaults`)
      }
    }

    // ── Step 2: Check workbench for cached keyword/SERP data before calling DataForSEO ──
    if (jobSb && jobId) await jobSb.from('async_jobs').update({ progress: 20 }).eq('id', jobId)
    console.log(`[content-advisor] Step 2: Checking workbench for keyword data, then DataForSEO fallback`)
    
    let keywordData: any = null
    let serpData: any = null
    let workbenchKeywords: any[] = []
    let workbenchQuickWins: any[] = []
    let workbenchContentGaps: any[] = []
    let workbenchMissingTerms: any[] = []
    let workbenchMissingPages: any[] = []
    let skippedDataForSEO = false

    // First, check if workbench has keyword_data items for this domain (populated by strategic audit)
    const { data: wbKeywordItems } = await serviceClient
      .from('architect_workbench')
      .select('finding_category, payload, title, description, severity')
      .eq('domain', domain)
      .in('finding_category', ['keyword_data', 'quick_win', 'content_gap', 'missing_terms', 'serp_analysis', 'missing_page', 'content_upgrade', 'competitive_gap'])
      .order('created_at', { ascending: false })
      .limit(40)

    if (wbKeywordItems && wbKeywordItems.length > 0) {
      // We have strategic audit data in workbench — reconstruct keyword/SERP context
      workbenchKeywords = wbKeywordItems.filter((i: any) => i.finding_category === 'keyword_data')
      workbenchQuickWins = wbKeywordItems.filter((i: any) => i.finding_category === 'quick_win')
      workbenchContentGaps = wbKeywordItems.filter((i: any) => i.finding_category === 'content_gap')
      workbenchMissingTerms = wbKeywordItems.filter((i: any) => i.finding_category === 'missing_terms')
      workbenchMissingPages = wbKeywordItems.filter((i: any) => i.finding_category === 'missing_page')

      if (workbenchKeywords.length >= 3) {
        // Reconstruct keywordData from workbench (avoid DataForSEO call)
        const seedKw = workbenchKeywords.find((k: any) => k.payload?.keyword?.toLowerCase() === keyword.toLowerCase())
        keywordData = {
          seed: {
            keyword,
            search_volume: seedKw?.payload?.volume || 0,
          },
          related: workbenchKeywords.slice(0, 20).map((k: any) => ({
            keyword: k.payload?.keyword || k.title?.replace('Mot-clé: ', ''),
            volume: k.payload?.volume || 0,
            cpc: 0,
            competition: k.payload?.difficulty > 70 ? 'high' : k.payload?.difficulty > 40 ? 'medium' : 'low',
          })),
          source: 'workbench_cache',
        }
        skippedDataForSEO = true
        console.log(`[content-advisor] ✅ Workbench has ${workbenchKeywords.length} keywords — SKIPPING DataForSEO API call (saved 2 credits)`)
      }
    }

    // Fallback: call DataForSEO only if workbench didn't have keyword data
    if (!skippedDataForSEO) {
      console.log(`[content-advisor] No workbench keyword cache — calling DataForSEO`)
      const dfLogin = Deno.env.get('DATAFORSEO_LOGIN')
      const dfPassword = Deno.env.get('DATAFORSEO_PASSWORD')
      const dfAuth = dfLogin && dfPassword ? 'Basic ' + btoa(`${dfLogin}:${dfPassword}`) : null

      if (dfAuth) {
        const [kwResp, serpResp] = await Promise.allSettled([
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
            source: 'dataforseo_live',
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
    }

    // ── Step 3: Competitor scraping via Firecrawl (top 3 SERP) ──
    if (jobSb && jobId) await jobSb.from('async_jobs').update({ progress: 35 }).eq('id', jobId)
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

    // ── Step 4: Existing audit data + Strategic audit SERP + GEO score + LLM visibility + Backlinks + Workbench ──
    if (jobSb && jobId) await jobSb.from('async_jobs').update({ progress: 50 }).eq('id', jobId)
    console.log(`[content-advisor] Step 4: Fetching existing audit/strategic/GEO/LLM/backlink/workbench data`)
    let existingAuditData: any = null
    let strategicAuditSerpData: any = null
    let cocoonData: any = null
    let geoScoreData: any = null
    let llmVisibilityData: any = null
    let backlinkData: any = null
    let workbenchItems: any[] = []

    const [auditRes, strategicAuditRes, cocoonRes, geoRes, llmRes, backlinkRes, workbenchRes, serpKeywordsRes] = await Promise.allSettled([
      serviceClient.from('audit_raw_data').select('raw_payload, audit_type')
        .eq('user_id', user.id).eq('domain', domain)
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      serviceClient.from('audit_raw_data').select('raw_payload')
        .eq('domain', domain)
        .in('audit_type', ['strategic', 'strategic_parallel'])
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      tracked_site_id
        ? serviceClient.from('cocoon_sessions').select('cluster_summary, nodes_count, intent_distribution, internal_links_density')
            .eq('tracked_site_id', tracked_site_id)
            .order('created_at', { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
      serviceClient.from('domain_data_cache').select('result_data')
        .eq('domain', domain).eq('data_type', 'geo_score')
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      serviceClient.from('domain_data_cache').select('result_data')
        .eq('domain', domain).eq('data_type', 'llm_visibility')
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      tracked_site_id
        ? serviceClient.from('backlink_snapshots').select('referring_domains, backlinks_total, domain_rank, anchor_distribution')
            .eq('tracked_site_id', tracked_site_id)
            .order('measured_at', { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
      // Fetch workbench items assigned to content architect
      serviceClient.from('architect_workbench').select('*')
        .eq('domain', domain)
        .in('action_type', ['content', 'both'])
        .eq('consumed_by_content', false)
        .eq('status', 'pending')
        .order('severity', { ascending: true })
        .limit(12),
      // Fetch keyword cloud from SERP snapshots (reference universe)
      tracked_site_id
        ? serviceClient.from('serp_snapshots').select('sample_keywords')
            .eq('tracked_site_id', tracked_site_id)
            .order('measured_at', { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    if (auditRes.status === 'fulfilled' && auditRes.value?.data) {
      existingAuditData = { type: auditRes.value.data.audit_type, payload: auditRes.value.data.raw_payload }
    }
    // Extract strategic audit SERP recommendations
    if (strategicAuditRes.status === 'fulfilled' && (strategicAuditRes.value as any)?.data?.raw_payload) {
      const sp = (strategicAuditRes.value as any).data.raw_payload
      const kp = sp?.keyword_positioning
      const pc = sp?.priority_content
      if (kp || pc) {
        strategicAuditSerpData = {
          content_gaps: kp?.content_gaps || [],
          missing_terms: kp?.missing_terms || [],
          main_keywords: (kp?.main_keywords || []).slice(0, 10),
          quick_wins: kp?.quick_wins || [],
          opportunities: kp?.opportunities || [],
          competitive_gaps: kp?.competitive_gaps || [],
          serp_recommendations: kp?.serp_recommendations || [],
          missing_pages: pc?.missing_pages || [],
          content_upgrades: pc?.content_upgrades || [],
        }
        console.log(`[content-advisor] Loaded strategic audit: ${strategicAuditSerpData.content_gaps.length} gaps, ${strategicAuditSerpData.missing_terms.length} missing terms, ${strategicAuditSerpData.main_keywords.length} keywords`)
      }
    }
    if (cocoonRes.status === 'fulfilled' && (cocoonRes.value as any)?.data) {
      cocoonData = (cocoonRes.value as any).data
    }
    if (geoRes.status === 'fulfilled' && (geoRes.value as any)?.data) {
      geoScoreData = (geoRes.value as any).data.result_data
    }
    if (llmRes.status === 'fulfilled' && (llmRes.value as any)?.data) {
      llmVisibilityData = (llmRes.value as any).data.result_data
    }
    if (backlinkRes.status === 'fulfilled' && (backlinkRes.value as any)?.data) {
      backlinkData = (backlinkRes.value as any).data
    }
    if (workbenchRes.status === 'fulfilled' && (workbenchRes.value as any)?.data) {
      workbenchItems = (workbenchRes.value as any).data || []
      if (workbenchItems.length > 0) {
        console.log(`[content-advisor] Workbench: ${workbenchItems.length} content items found for ${domain}`)
      }
    }
    // Extract keyword cloud as reference universe
    let keywordCloudBlock = ''
    if (serpKeywordsRes.status === 'fulfilled' && (serpKeywordsRes.value as any)?.data?.sample_keywords) {
      const kwList = ((serpKeywordsRes.value as any).data.sample_keywords as any[])
        .filter((k: any) => k?.keyword)
        .map((k: any) => `- "${k.keyword}" (pos: ${k.position || '?'}, vol: ${k.volume || '?'})`)
      if (kwList.length > 0) {
        keywordCloudBlock = `
── UNIVERS MOTS-CLÉS (${kwList.length} termes) ──
${kwList.slice(0, 20).join('\n')}
RÈGLE : Le contenu doit s'inscrire dans cet univers sémantique.
`
        console.log(`[content-advisor] ☁️ Keyword cloud injected: ${kwList.length} keywords`)
      }
    }

    if (jobSb && jobId) await jobSb.from('async_jobs').update({ progress: 65 }).eq('id', jobId)
    console.log(`[content-advisor] Step 5: LLM synthesis`)
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) {
      return jsonError('AI service not configured', 500)
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
      company_size: (siteContext as any).company_size,
      gmb_presence: (siteContext as any).gmb_presence,
      gmb_city: (siteContext as any).gmb_city,
      entity_type: (siteContext as any).entity_type,
      target_audience: (siteContext as any).target_audience,
    } : null

    // Derive contextual flags for conditional criteria activation
    const hasGMB = siteIdentity?.gmb_presence === true
    const geoScore = typeof geoScoreData?.score === 'number' ? geoScoreData.score : null
    const isLLMVisible = llmVisibilityData?.is_visible === true || (llmVisibilityData?.mention_count > 0)
    const serpPosition = serpData?.top_organic?.findIndex((r: any) => r.domain?.includes(domain)) ?? -1
    const isInSERP = serpPosition >= 0 && serpPosition < 10
    const hasBacklinks = backlinkData?.referring_domains > 0
    const domainRank = backlinkData?.domain_rank || null

    const systemPrompt = `Tu es un expert SEO/GEO et architecte de contenu. Tu analyses des données de SERP, de concurrents, de score GEO, de visibilité LLM et d'audits pour recommander la structure de contenu optimale.

RÈGLE ABSOLUE — GARDE-FOU DE COHÉRENCE :
1. **Continuité tonale** : La page recommandée DOIT rester cohérente avec le ton, le design et le vocabulaire des autres pages du même domaine.
2. **Prudence sectorielle** : Si le secteur est conservateur (juridique, médical, institutionnel, finance, assurance, services publics, ONG), pondère à la baisse les structures novatrices. Privilégie la lisibilité et la confiance.
3. **Lisibilité > originalité** : Un contenu lu et compris par sa cible vaut mieux qu'une page au taux de rebond énorme.
4. **Score d'innovation** : Pour chaque recommandation, évalue si elle est "conservatrice", "modérée" ou "disruptive". Si disruptive, BAISSE le confidence_score et ajoute un avertissement.
5. **Non-marchand** : Pour les services publics, associations, ONG, fédérations — ton sobre, institutionnel, factuel. Aucun CTA agressif.

── 5 CRITÈRES GEO (à appliquer individuellement ou cumulativement selon le contexte) ──

Chaque critère s'active conditionnellement. Applique-les SI ET SEULEMENT SI le contexte le justifie :

**CRITÈRE 1 — Répondre clairement aux questions clés**
→ ACTIF SI : type de page = article/faq/landing OU featured_snippet possible OU people_also_ask détectés dans la SERP
→ ACTION : Sous-titres H2 sous forme de questions. Réponse directe dès les premières lignes (pattern "question → réponse en 1-2 phrases → développement"). Paragraphes courts (3-4 lignes max).
→ POIDS RENFORCÉ SI : GEO score < 50 ou visibilité LLM absente (le site doit maximiser sa citabilité)

**CRITÈRE 2 — Structurer pour la compréhension**
→ ACTIF SI : word_count cible > 800 OU page technique OU jargon_distance > 4
→ ACTION : H2/H3 clairs et descriptifs. Listes à puces. Tableaux comparatifs si pertinent. Définitions simples pour les termes techniques.
→ POIDS RENFORCÉ SI : cible B2C grand public, étudiant, ou audience locale

**CRITÈRE 3 — Ajouter des passages "citables"**
→ ACTIF SI : GEO score < 70 OU visibilité LLM absente OU pas de featured snippet pour ce mot-clé
→ ACTION : Définitions précises (1-2 phrases). Étapes numérotées. Mini-résumé (TL;DR) en haut de page. Checklist actionnable.
→ POIDS RENFORCÉ SI : entité non reconnue par les LLMs, faible notoriété (domain_rank < 30), pas de backlinks

**CRITÈRE 4 — Multiplier les signaux d'expertise et de légitimité (E-E-A-T)**
→ ACTIF SI : secteur YMYL (santé, finance, juridique) OU business_type B2B OU cible = expert/décideur
→ ACTION : Inclure données chiffrées, exemples concrets, citations d'experts, expérience terrain. Recommander un auteur identifié.
→ POIDS RENFORCÉ SI : pas de GMB associée (signal de confiance manquant), faible domain_rank, secteur à forte concurrence

**CRITÈRE 5 — Enrichir la sémantique**
→ TOUJOURS ACTIF (mais poids variable)
→ ACTION : Utiliser des synonymes et variantes. Couvrir un sujet avec précision en explicitant les concepts évoqués. Intégrer les questions dérivées (People Also Ask).
→ POIDS RENFORCÉ SI : forte concurrence SERP (>5 résultats organiques pertinents), keyword density basse chez les concurrents, cible = expert technique

**CRITÈRE 6 — FAQ structurée avec balisage schema.org (FAQPage)**
→ ACTIF SI : type de page = article/landing/faq OU page_type != homepage
→ ACTION : Ajouter une section FAQ en fin de contenu avec 3-6 questions RÉELLES que les utilisateurs posent (pas des questions décoratives/auto-promotionnelles). Chaque réponse doit être complète (2-4 phrases minimum). Inclure le schéma FAQPage dans json_ld_schemas.
→ POIDS RENFORCÉ SI : GEO score < 60, pas de FAQ existante, featured snippet possible
→ INTERDIT : Questions vagues type "Pourquoi nous choisir ?" ou "Quel est notre avantage ?". Uniquement des questions que de vrais utilisateurs posent sur le sujet.

**CRITÈRE 7 — Auto-citations de la marque dans le contenu**
→ TOUJOURS ACTIF pour les pages non-homepage
→ ACTION : Intégrer 2-3 formulations d'auto-citation naturelles dans le corps du contenu, de type :
  - "Chez [Marque], notre approche consiste à..."
  - "L'équipe [Marque] recommande..."
  - "Selon l'analyse [Marque]..."
  Ces formulations sont reprises par les LLM lorsqu'ils citent une source. Elles renforcent la brand entity recognition.
→ POIDS RENFORCÉ SI : faible notoriété (domain_rank < 30), visibilité LLM absente, pas de mentions de marque existantes
→ RÈGLE : La marque = le nom du site/entreprise issu de l'Identity Card. Les auto-citations doivent être NATURELLES, pas forcées. Elles doivent apporter de la valeur informationnelle.

**CRITÈRE 8 — Résumé éditorial dans les 150 premiers mots**
→ ACTIF SI : type de page != homepage (actif pour landing, article, product, faq, category)
→ ACTION : L'introduction (champ "introduction") DOIT résumer en 100-150 mots le contenu ET l'angle éditorial de la page. Ce résumé sert de "TL;DR contextuel" que les LLM extraient comme snippet. Il doit contenir le mot-clé principal, le nom de la marque, et la proposition de valeur de la page.
→ POIDS RENFORCÉ SI : contenu long (>1500 mots), sujet technique complexe

Pour chaque critère, indique dans ta réponse s'il a été activé et pourquoi, dans un nouveau champ "geo_criteria_applied".

Réponds UNIQUEMENT en JSON valide avec cette structure exacte:
{
  "content_structure": {
    "recommended_h1": "Le H1 optimal",
    "hn_hierarchy": [{"level":"h2","text":"...","purpose":"..."},{"level":"h3","text":"...","parent_h2":"..."}],
    "word_count_range": {"min":number,"max":number,"ideal":number},
    "sections": [{"title":"...","purpose":"...","body_text":"Contenu rédigé complet de la section (paragraphes, listes, etc.)","word_count":number,"priority":"high|medium|low"}],
    "tldr_summary": "Mini-résumé en 2-3 phrases (si critère 3 actif)",
    "media_recommendations": [{"type":"image|video|infographic|table","description":"...","alt_text":"...","placement":"after_h2_1|hero|inline"}],
    "introduction": "Chapô introductif de 100-150 mots résumant le contenu et l'angle (CRITÈRE 8). Doit contenir le mot-clé principal et le nom de la marque."
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
    "anchor_strategy": [{"anchor_text":"...","target_url":"https://...","target_intent":"...","placement_section":"Nom de la section"}],
    "cluster_opportunities": ["..."],
    "silo_reinforcement": "Comment ce contenu renforce le silo"
  },
  "strategic_objectives_addressed": [
    {"objective_type":"content_gap|eeat_improvement|new_keyword|internal_linking|silo_rebalance|cannibalization_fix|topical_authority|geo_visibility","addressed":true,"how":"Explication concrète","sections_involved":["Section 1","Section 3"]}
  ],
  "geo_criteria_applied": [
    {"criterion": 1, "name": "Questions clés", "activated": true/false, "reason": "...", "weight": "standard|reinforced"},
    {"criterion": 2, "name": "Structure compréhension", "activated": true/false, "reason": "...", "weight": "standard|reinforced"},
    {"criterion": 3, "name": "Passages citables", "activated": true/false, "reason": "...", "weight": "standard|reinforced"},
    {"criterion": 4, "name": "Signaux E-E-A-T", "activated": true/false, "reason": "...", "weight": "standard|reinforced"},
    {"criterion": 5, "name": "Enrichissement sémantique", "activated": true, "reason": "...", "weight": "standard|reinforced"},
    {"criterion": 6, "name": "FAQ structurée schema.org", "activated": true/false, "reason": "...", "weight": "standard|reinforced"},
    {"criterion": 7, "name": "Auto-citations marque", "activated": true/false, "reason": "...", "weight": "standard|reinforced"},
    {"criterion": 8, "name": "Résumé 150 mots intro", "activated": true/false, "reason": "...", "weight": "standard|reinforced"}
  ],
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

    // ── BUILD CONTENT BRIEF (deterministic, pre-LLM) ──
    // Load Voice DNA if available
    let voiceDna: any = null;
    if (resolvedSiteId) {
      try {
        const { data: siteData } = await serviceClient.from('tracked_sites').select('voice_dna').eq('id', resolvedSiteId).single();
        voiceDna = siteData?.voice_dna || null;
      } catch {}
    }

    const contentBrief = await buildContentBrief({
      page_type: page_type as BriefPageType,
      keyword,
      target_url: url,
      domain,
      tracked_site_id: resolvedSiteId || '',
      title: '',
      finding_category: '',
      sector: siteIdentity?.sector || '',
      jargon_distance: jargonDist,
      language: language_code,
      secondary_keywords: workbenchKeywords.map((k: any) => k.payload?.keyword || k.title).filter(Boolean).slice(0, 10),
      voice_dna: voiceDna,
      business_model: (siteIdentity as any)?.business_model || null,
      supabase: serviceClient,
    })
    const briefBlock = briefToPromptBlock(contentBrief)
    const brief = contentBrief // alias used downstream
    console.log(`[content-advisor] ContentBrief built: ${contentBrief.page_type}, tone=${contentBrief.tone}, angle=${contentBrief.angle}, h2=${contentBrief.h2_count.min}-${contentBrief.h2_count.max}, links=${contentBrief.internal_links.length}, voice_dna=${!!voiceDna}`)

    // ── Parse client_targets for audience context ──
    let audienceBlock = ''
    if (siteIdentity?.targets) {
      try {
        const ct = typeof siteIdentity.targets === 'string' ? JSON.parse(siteIdentity.targets) : siteIdentity.targets
        const describeSegment = (arr: any[]): string => {
          if (!arr?.[0]) return ''
          const item = arr[0]
          const market = item.market || ''
          const sub = Object.values(item).find((v: any) => typeof v === 'object' && v !== null && !Array.isArray(v) && ('csp' in v || 'segment' in v || 'role' in v)) as any
          let desc = market
          if (sub) {
            if (sub.csp) desc += ` — ${sub.csp}`
            if (sub.segment) desc += ` — ${sub.segment}`
            if (sub.age_range) desc += ` (${sub.age_range})`
          }
          if (item.intent) desc += ` | Intent: ${item.intent}`
          return desc
        }
        const primary = describeSegment(ct.primary)
        const secondary = describeSegment(ct.secondary)
        const untapped = describeSegment(ct.untapped)

        if (target_audience_segment === 'primary' && primary) {
          audienceBlock = `\n⛔ CONTEXTE SECTORIEL OBLIGATOIRE:\nLe site traite de : ${siteIdentity?.sector || siteIdentity?.target_audience || 'inconnu'}.\nSa cible prioritaire est : ${primary}.\n${secondary ? `Sa cible secondaire est : ${secondary}.` : ''}\nNe JAMAIS produire de contenu hors-sujet. Chaque section DOIT traiter du secteur ci-dessus.\n`
        } else if (target_audience_segment === 'secondary' && secondary) {
          audienceBlock = `\n⛔ CONTEXTE SECTORIEL OBLIGATOIRE:\nLe site traite de : ${siteIdentity?.sector || 'inconnu'}.\nCe contenu cible SPÉCIFIQUEMENT la cible secondaire : ${secondary}.\n${primary ? `La cible prioritaire est : ${primary} (contexte global).` : ''}\nNe JAMAIS produire de contenu hors-sujet.\n`
        } else if (target_audience_segment === 'untapped' && untapped) {
          audienceBlock = `\n⛔ CONTEXTE SECTORIEL OBLIGATOIRE:\nLe site traite de : ${siteIdentity?.sector || 'inconnu'}.\nCe contenu cible une OPPORTUNITÉ non exploitée : ${untapped}.\nLe contenu doit ouvrir ce nouveau segment tout en restant cohérent avec le métier du site.\nNe JAMAIS produire de contenu hors-sujet.\n`
        } else {
          audienceBlock = `\n⛔ CONTEXTE SECTORIEL OBLIGATOIRE:\nLe site traite de : ${siteIdentity?.sector || 'inconnu'}.\n${primary ? `Cible prioritaire : ${primary}.` : ''}\n${secondary ? `Cible secondaire : ${secondary}.` : ''}\nNe JAMAIS produire de contenu hors-sujet.\n`
        }
      } catch (e) {
        console.warn('[content-advisor] Failed to parse client_targets:', e)
        audienceBlock = siteIdentity?.sector ? `\n⛔ Le site traite de : ${siteIdentity.sector}. Ne JAMAIS produire de contenu hors-sujet.\n` : ''
      }
    } else if (siteIdentity?.sector || siteIdentity?.target_audience) {
      audienceBlock = `\n⛔ CONTEXTE SECTORIEL OBLIGATOIRE:\nLe site traite de : ${siteIdentity?.sector || 'inconnu'}.\n${siteIdentity?.target_audience ? `Audience : ${siteIdentity.target_audience}.` : ''}\nNe JAMAIS produire de contenu hors-sujet.\n`
    }

    const userPrompt = `Analyse et recommande l'architecture de contenu optimale pour:

**Page cible:** ${url}
**Mot-clé principal:** ${keyword}  
**Type de page:** ${page_type}
**Langue:** ${language_code}
${audienceBlock}
${briefBlock}

${strategic_objectives?.length ? `
── OBJECTIFS STRATÉGIQUES MULTIPLES ──
Ce contenu doit servir SIMULTANÉMENT les objectifs suivants. Chaque objectif doit se refléter dans la structure, les liens et le contenu produit.

${strategic_objectives.map((o, i) => `${i + 1}. [${o.type.toUpperCase()}] (Priorité: ${o.priority}) ${o.description}${o.related_urls?.length ? `\n   URLs liées: ${o.related_urls.join(', ')}` : ''}${o.related_keywords?.length ? `\n   Mots-clés associés: ${o.related_keywords.join(', ')}` : ''}`).join('\n\n')}

RÈGLE: Chaque objectif doit être adressé concrètement dans le contenu. Un contenu qui ne sert qu'un seul objectif est un échec.
` : ''}

${target_internal_links?.length ? `
── LIENS INTERNES OBLIGATOIRES ──
Les URLs suivantes DOIVENT être liées depuis ce contenu avec des ancres contextuelles naturelles :
${target_internal_links.map(l => `- ${l.url}${l.anchor_text ? ` (ancre suggérée: "${l.anchor_text}")` : ''}${l.reason ? ` — Raison: ${l.reason}` : ''}`).join('\n')}

RÈGLE: Intègre ces liens dans le corps du texte de manière naturelle, pas dans une liste de liens en bas de page.
` : ''}

${cannibalization_data?.length ? `
── DONNÉES DE CANNIBALISATION ──
Les problèmes de cannibalisation suivants doivent être pris en compte dans l'architecture de ce contenu :
${cannibalization_data.map(c => `- Mot-clé "${c.keyword}" : cannibalisé par ${c.competing_urls.join(', ')} (sévérité: ${c.severity})`).join('\n')}

RÈGLE: Le contenu doit DIFFÉRENCIER clairement son angle éditorial de ces pages concurrentes internes. Utilise un intent différent, un angle complémentaire, et lie vers ces pages au lieu de les concurrencer.
` : ''}

${silo_context ? `
── CONTEXTE DU SILO ──
Cluster: ${silo_context.cluster_name}
Pages existantes dans ce silo: ${silo_context.existing_pages.join(', ')}
${silo_context.gap_description ? `Gap identifié: ${silo_context.gap_description}` : ''}

RÈGLE: Le contenu doit renforcer ce silo thématique. Il doit lier vers les pages existantes du silo ET être conçu pour recevoir des liens depuis ces pages.
` : ''}

${keywordCloudBlock}

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

${strategicAuditSerpData ? `
── RECOMMANDATIONS SERP DE L'AUDIT STRATÉGIQUE IA ──
⚠️ CRITIQUE : Ces données proviennent de l'audit stratégique du site. Le contenu généré DOIT s'inscrire dans cet univers sémantique. Tout contenu hors-sujet est interdit.

**Mots-clés principaux du site (identifiés par l'audit):**
${strategicAuditSerpData.main_keywords.map((k: any) => `- "${k.keyword}" (vol: ${k.volume || '?'}, diff: ${k.difficulty || '?'}, position: ${k.current_rank || '?'})`).join('\n')}

**Termes manquants à intégrer prioritairement:**
${strategicAuditSerpData.missing_terms.map((t: any) => `- "${t.term}" (importance: ${t.importance || '?'}, placement suggéré: ${t.suggested_placement || '?'})`).join('\n') || 'Aucun'}

**Gaps de contenu identifiés (pages à créer):**
${strategicAuditSerpData.content_gaps.map((g: any) => `- "${g.keyword || g.title}" (priorité: ${g.priority || '?'}, action: ${g.action || '?'})`).join('\n') || 'Aucun'}

**Pages manquantes recommandées:**
${strategicAuditSerpData.missing_pages.map((p: any) => `- "${p.title}" → ${p.rationale} (impact: ${p.expected_impact || '?'})`).join('\n') || 'Aucune'}

**Quick Wins (positions 11-20):**
${strategicAuditSerpData.quick_wins.map((q: any) => `- "${q.keyword}" (position: ${q.current_rank || '?'}, action: ${q.action || '?'})`).join('\n') || 'Aucun'}

**Opportunités:**
${(strategicAuditSerpData.opportunities || []).join('\n- ') || 'Aucune'}

**Écarts concurrentiels:**
${(strategicAuditSerpData.competitive_gaps || []).join('\n- ') || 'Aucun'}

RÈGLE : Le mot-clé principal "${keyword}" DOIT être cohérent avec l'univers sémantique ci-dessus. Le contenu doit couvrir les termes manquants et les gaps identifiés quand c'est pertinent.
` : ''}

${workbenchItems.length > 0 ? `
── DIAGNOSTICS CONSOLIDÉS (Workbench Partagé) ──
Les diagnostics suivants ont été identifiés par les différents modules d'analyse et sont assignés au Content Architect :
${workbenchItems.slice(0, 8).map((item: any, i: number) => `${i + 1}. [${(item.severity || 'medium').toUpperCase()}] ${item.title}${item.target_url ? ` (${item.target_url})` : ''}
   ${item.description ? item.description.substring(0, 120) : ''}`).join('\n')}

RÈGLE : Intègre ces findings dans ta recommandation.
` : ''}

${workbenchQuickWins.length > 0 ? `
── QUICK WINS (Workbench — positions 11-20, améliorations faciles) ──
${workbenchQuickWins.map((qw: any) => `- ${qw.title} ${qw.payload?.current_rank ? `(position: ${qw.payload.current_rank})` : ''} → ${qw.description || ''}`).join('\n')}
RÈGLE : Si le mot-clé cible correspond à un Quick Win, PRIORITISE l'optimisation pour ce mot-clé.
` : ''}

${workbenchMissingTerms.length > 0 ? `
── TERMES MANQUANTS (Workbench — gaps sémantiques identifiés) ──
${workbenchMissingTerms.map((mt: any) => `- "${mt.payload?.term || mt.title}" (importance: ${mt.severity}) — ${mt.description || ''}`).join('\n')}
RÈGLE : Intègre ces termes naturellement dans le contenu recommandé. Chaque terme critique DOIT apparaître.
` : ''}

${workbenchMissingPages.length > 0 ? `
── PAGES MANQUANTES (Workbench — contenus suggérés par l'audit stratégique) ──
${workbenchMissingPages.map((mp: any) => `- "${mp.payload?.title || mp.title}" — ${mp.description || ''} (impact: ${mp.severity})`).join('\n')}
Si la page cible correspond à l'une de ces suggestions, utilise les données comme base pour l'architecture.
` : ''}

${workbenchContentGaps.length > 0 ? `
── GAPS DE CONTENU (Workbench — thématiques non couvertes) ──
${workbenchContentGaps.map((cg: any) => `- "${cg.payload?.keyword || cg.title}" — ${cg.description || ''}`).join('\n')}
` : ''}

**Données Cocoon (maillage):**
${cocoonData ? JSON.stringify(cocoonData, null, 2) : 'Pas de données de maillage'}

**Score GEO actuel:**
${geoScore !== null ? `${geoScore}/100` : 'Non mesuré'}

**Visibilité LLM (ChatGPT, Perplexity, etc.):**
${llmVisibilityData ? JSON.stringify(llmVisibilityData, null, 2) : 'Non mesurée'}

**Backlinks & Autorité:**
${backlinkData ? `Referring domains: ${backlinkData.referring_domains || 0}, Total backlinks: ${backlinkData.backlinks_total || 0}, Domain rank: ${backlinkData.domain_rank || 'N/A'}` : 'Non mesuré'}

${existingPageHtml ? `
── SCAN HTML DE LA PAGE CIBLE (état actuel) ──
⚠️ CRITIQUE : La page cible EXISTE DÉJÀ. Le contenu recommandé doit ENRICHIR/AMÉLIORER l'existant, pas le remplacer aveuglément.

**Structure actuelle:**
- Title: "${existingPageHtml.titleContent}" (${existingPageHtml.titleLength} chars)
- Meta description: "${existingPageHtml.metaDescContent}" (${existingPageHtml.metaDescLength} chars)
- H1: ${existingPageHtml.h1Count > 0 ? existingPageHtml.h1Contents.map(h => `"${h}"`).join(', ') : 'ABSENT ⚠️'}
- H2: ${existingPageHtml.h2Count} | H3: ${existingPageHtml.h3Count}
- Nombre de mots: ${existingPageHtml.wordCount}

**Médias & Liens:**
- Images: ${existingPageHtml.imagesTotal} (${existingPageHtml.imagesMissingAlt} sans alt ⚠️)
- Liens internes: ${existingPageHtml.internalLinksCount} | Liens externes: ${existingPageHtml.externalLinksCount}

**Schema.org existant:** ${existingPageHtml.hasSchemaOrg ? existingPageHtml.schemaTypes.join(', ') : 'AUCUN ⚠️'}
**Canonical:** ${existingPageHtml.hasCanonical ? existingPageHtml.canonicalUrl : 'ABSENT ⚠️'}
**Open Graph:** ${existingPageHtml.hasOg ? existingPageHtml.ogTags.join(', ') : 'ABSENT'}
**FAQ existante:** ${existingPageHtml.hasFAQSection ? (existingPageHtml.hasFAQWithSchema ? 'Oui avec schema FAQPage ✅' : 'Oui SANS schema ⚠️') : 'Non'}
**TL;DR/Résumé existant:** ${existingPageHtml.hasTLDR ? 'Oui' : 'Non'}
**Auteur bio:** ${existingPageHtml.hasAuthorBio ? 'Oui' : 'Non ⚠️'}
**Données chiffrées:** ${existingPageHtml.statisticCount} statistiques, ${existingPageHtml.percentageCount} pourcentages (densité: ${existingPageHtml.dataDensityScore}/100)
**Fraîcheur:** ${existingPageHtml.contentAgeDays !== null ? `${existingPageHtml.contentAgeDays} jours (${existingPageHtml.mostRecentDate})` : 'Inconnue'}
**Liens sociaux:** ${existingPageHtml.hasSocialLinks ? 'Oui' : 'Non'} | LinkedIn: ${existingPageHtml.hasLinkedInLinks ? 'Oui' : 'Non'}

RÈGLES BASÉES SUR LE SCAN :
1. Si un H1 existe, le recommended_h1 doit l'AMÉLIORER (pas le changer radicalement sauf si objectivement mauvais)
2. Si la meta description existe, propose une amélioration, pas un remplacement total
3. Si des Schema.org existent, les compléter, pas les remplacer
4. Si la FAQ existe sans schema, AJOUTER le schema FAQPage
5. Les sections recommandées doivent combler les LACUNES identifiées, pas dupliquer l'existant
6. Si le word_count est déjà suffisant, concentre-toi sur la qualité et la structure
` : `
── SCAN HTML DE LA PAGE CIBLE ──
La page n'existe pas encore ou n'est pas accessible. Les recommandations partent de zéro.
`}

**GMB associée:** ${hasGMB ? `Oui (${siteIdentity?.gmb_city || 'ville inconnue'})` : 'Non'}
**Position SERP actuelle:** ${isInSERP ? `Position ${serpPosition + 1}` : 'Hors top 10 ou inconnu'}

⚠️ CONTRAINTES DE COHÉRENCE :
- Secteur ${isConservativeSector ? 'CONSERVATEUR — privilégie la sobriété et la crédibilité' : 'standard'}
- Organisation ${isNonProfit ? 'NON MARCHANDE — ton institutionnel, pas de CTA commercial agressif' : 'marchande ou indéterminée'}
- Distance jargon: ${jargonDist !== null ? `${jargonDist}/10 — ${jargonDist > 6 ? 'VULGARISE au maximum, la cible ne maîtrise pas le jargon' : jargonDist > 3 ? 'Équilibre technique/accessible' : 'Public expert, le jargon est attendu'}` : 'inconnue'}
- Business type: ${siteIdentity?.business_type || 'inconnu'}, Model: ${siteIdentity?.commercial_model || 'inconnu'}
- Cible: ${siteIdentity?.targets || 'inconnue'}
- Taille entreprise: ${siteIdentity?.company_size || 'inconnue'}
- Entity type: ${siteIdentity?.entity_type || 'inconnu'}
- Date du jour: ${new Date().toISOString().slice(0, 10)}
- Fraîcheur éditoriale: si une date, année, millésime, échéance, barème, version ou mise à jour est mentionné(e), il/elle doit être exact(e) et cohérent(e) partout dans la sortie.
- Cohérence temporelle obligatoire pour: recommended_h1, hn_hierarchy (H2/H3), introduction, sections.body_text, tldr_summary, FAQ, tableaux, résumés, meta_title, meta_description et json_ld_schemas.
- N'ajoute PAS de date si elle n'apporte rien.
- N'utilise PAS automatiquement le mot "Guide" dans le H1 ou les sections ; choisis la forme éditoriale la plus juste selon l'intention réelle.
- **TYPOGRAPHIE FR — CASSE PHRASTIQUE STRICTE** : tous les titres générés (recommended_h1, hn_hierarchy H2/H3, sections.title, meta_title, og_tags.title, FAQ questions, tldr_summary) DOIVENT être en casse phrastique française : majuscule UNIQUEMENT sur le premier mot et les noms propres (marques, lieux, personnes, sigles). Le "Title Case" anglo-saxon (majuscule à chaque mot) est INTERDIT en français — il dégrade le CTR, brouille la reconnaissance d'entités nommées (NER) par les LLMs et envoie un signal de faible qualité (E-E-A-T). Exemple correct : "Comment optimiser le budget crawl d'un site e-commerce". Exemple INTERDIT : "Comment Optimiser Le Budget Crawl D'un Site E-Commerce". Cette règle ne s'applique PAS si la langue cible est l'anglais.

⚠️ ACTIVATION DES 5 CRITÈRES GEO :
Active chaque critère selon les signaux disponibles. Voici l'état des signaux :
- Featured snippet possible: ${serpData?.featured_snippet ? 'OUI' : 'NON'}
- People Also Ask détectés: ${serpData?.people_also_ask?.length > 0 ? `OUI (${serpData.people_also_ask.length})` : 'NON'}
- Score GEO: ${geoScore !== null ? `${geoScore}/100 ${geoScore < 50 ? '— FAIBLE, renforcer citabilité' : geoScore < 70 ? '— MOYEN' : '— BON'}` : 'inconnu'}
- Visible par les LLMs: ${isLLMVisible ? 'OUI' : 'NON — priorité haute sur passages citables'}
- GMB: ${hasGMB ? 'OUI' : 'NON — signal de confiance manquant'}
- Domain rank: ${domainRank !== null ? `${domainRank} ${domainRank < 30 ? '— FAIBLE, renforcer E-E-A-T' : ''}` : 'inconnu'}
- Backlinks: ${hasBacklinks ? `${backlinkData?.referring_domains} domaines référents` : 'AUCUN — renforcer légitimité'}
- Concurrence SERP: ${serpData?.items_count > 5 ? 'FORTE' : 'MODÉRÉE'}

IMPORTANT : Le contenu recommandé NE DOIT PAS être en rupture de ton/style avec le reste du site. Reste dans la continuité de ce qui existe déjà. Si tu proposes quelque chose de très différent, SIGNALE-LE dans coherence_check.warnings et BAISSE le confidence_score.

Le ratio sémantique doit refléter la distance jargon: jargon_distance 1-3 → contenu technique, 7-10 → très vulgarisé.
Les schemas JSON-LD doivent être adaptés au type de page: ${page_type}.

${contentTemplate ? `
═══ TEMPLATE SEO/GEO SPÉCIALISÉ: ${contentTemplate.label.toUpperCase()} ═══

${contentTemplate.system_prompt}

STRUCTURE DE RÉFÉRENCE:
${contentTemplate.structure_template}

RÈGLES SEO OBLIGATOIRES:
${contentTemplate.seo_rules}

RÈGLES GEO (OPTIMISATION IA GÉNÉRATIVE) OBLIGATOIRES:
${contentTemplate.geo_rules}

DIRECTIVES DE TON:
${contentTemplate.tone_guidelines}

EXEMPLES DE RÉFÉRENCE:
${JSON.stringify(contentTemplate.examples, null, 2)}

FRAÎCHEUR & DÉNOMINATION:
- N'utilise PAS automatiquement "Guide" dans le recommended_h1, les H2/H3, les FAQ, les tableaux, les résumés ou les sections.
- Choisis l'intitulé éditorial le plus juste selon l'intention: barème, comparatif, procédure, actualité, FAQ, décryptage, mise à jour, analyse, checklist, etc.
- Si une date est pertinente, elle doit être exacte et cohérente PARTOUT dans la sortie.
- Si la date n'apporte rien, n'en ajoute pas artificiellement.

⚠️ Le contenu des sections (body_text) DOIT suivre ces règles. Un contenu qui ne respecte pas les règles GEO (passages citables, réponse directe, FAQ) sera considéré comme non conforme.
═══ FIN TEMPLATE ═══
` : ''}`;

    // ── Intelligent model routing based on content complexity ──
    const complexityScore = (() => {
      let score = 0;
      // Length signals
      if (brief.target_length.ideal > 3000) score += 3;
      else if (brief.target_length.ideal > 1500) score += 1;
      // Structure depth
      if (brief.h2_count.max > 8) score += 2;
      else if (brief.h2_count.max > 5) score += 1;
      if (brief.h3_per_h2.max > 3) score += 1;
      // E-E-A-T & GEO demands
      if (brief.eeat_signals.length > 3) score += 2;
      if (brief.citable_passages_count > 5) score += 1;
      // Rich content features
      if (brief.include_faq && brief.faq_count > 5) score += 1;
      if (brief.include_table) score += 1;
      if (brief.include_key_takeaways) score += 1;
      // Internal linking complexity
      if (brief.internal_links.length > 5) score += 1;
      // Template presence (rich SEO/GEO rules)
      if (contentTemplate) score += 2;
      // Strategic objectives
      if (strategic_objectives && strategic_objectives.length > 2) score += 2;
      // Cannibalization context
      if (cannibalization_data && cannibalization_data.length > 0) score += 1;
      return score;
    })();

    // Route: ≤4 → flash (simple), 5-8 → flash-preview (standard), ≥9 → pro (complex)
    const modelTiers: string[] = complexityScore >= 9
      ? ['google/gemini-2.5-pro', 'google/gemini-2.5-flash']
      : complexityScore >= 5
        ? ['google/gemini-3-flash-preview', 'google/gemini-2.5-flash']
        : ['google/gemini-2.5-flash'];

    const LLM_TIMEOUT_MS = 150000; // 150s (was 120s)

    async function callLLMWithRetry(): Promise<Response> {
      for (let attempt = 0; attempt < modelTiers.length; attempt++) {
        const model = modelTiers[attempt];
        const isRetry = attempt > 0;
        if (isRetry) {
          console.log(`[content-advisor] ⚡ Retry with faster model: ${model} (attempt ${attempt + 1})`);
        }
        console.log(`[content-advisor] 🧠 Complexity score: ${complexityScore} → Model: ${model} (brief: ${brief.target_length.ideal} words, ${brief.h2_count.max} H2, ${brief.eeat_signals.length} E-E-A-T signals, template: ${!!contentTemplate})`);
        try {
          const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
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
                          sections: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, purpose: { type: 'string' }, body_text: { type: 'string', description: 'Full written content for this section (paragraphs, lists, etc.)' }, word_count: { type: 'number' }, priority: { type: 'string' } }, required: ['title', 'body_text', 'word_count'] } },
                          tldr_summary: { type: 'string' },
                          media_recommendations: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, description: { type: 'string' }, alt_text: { type: 'string' }, placement: { type: 'string' } } } },
                          introduction: { type: 'string', description: 'Introductory paragraph (chapô) of 2-4 sentences' },
                        },
                        required: ['recommended_h1', 'hn_hierarchy', 'word_count_range', 'sections', 'introduction'],
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
                          anchor_strategy: { type: 'array', items: { type: 'object', properties: { anchor_text: { type: 'string' }, target_url: { type: 'string', description: 'Concrete URL to link to' }, target_intent: { type: 'string' }, placement_section: { type: 'string', description: 'Which section this link should appear in' } }, required: ['anchor_text', 'target_url', 'target_intent'] } },
                          cluster_opportunities: { type: 'array', items: { type: 'string' } },
                          silo_reinforcement: { type: 'string', description: 'How this content strengthens the silo structure' },
                        },
                      },
                      strategic_objectives_addressed: {
                        type: 'array',
                        description: 'How each strategic objective is concretely addressed in the content',
                        items: { type: 'object', properties: { objective_type: { type: 'string' }, addressed: { type: 'boolean' }, how: { type: 'string' }, sections_involved: { type: 'array', items: { type: 'string' } } }, required: ['objective_type', 'addressed', 'how'] },
                      },
                      coherence_check: {
                        type: 'object',
                        properties: {
                          innovation_level: { type: 'string', enum: ['conservative', 'moderate', 'disruptive'] },
                          sector_fit: { type: 'string', enum: ['high', 'medium', 'low'] },
                          tone_continuity: { type: 'string', enum: ['aligned', 'slight_shift', 'breaking'] },
                          bounce_risk: { type: 'string', enum: ['low', 'medium', 'high'] },
                          warnings: { type: 'array', items: { type: 'string' } },
                        },
                        required: ['innovation_level', 'sector_fit', 'tone_continuity', 'bounce_risk'],
                      },
                      geo_criteria_applied: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            criterion: { type: 'number' },
                            name: { type: 'string' },
                            activated: { type: 'boolean' },
                            reason: { type: 'string' },
                            weight: { type: 'string', enum: ['standard', 'reinforced'] },
                          },
                          required: ['criterion', 'name', 'activated', 'reason', 'weight'],
                        },
                      },
                      confidence_score: { type: 'number' },
                      rationale: { type: 'string' },
                    },
                    required: ['content_structure', 'keyword_strategy', 'metadata_enrichment', 'coherence_check', 'geo_criteria_applied', 'confidence_score', 'rationale'],
                  },
                },
              }],
              tool_choice: { type: 'function', function: { name: 'content_architecture_recommendation' } },
            }),
            signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
          });
          // If we got a response (even error), return it — only retry on timeout
          return resp;
        } catch (err) {
          const isTimeout = err instanceof DOMException && err.name === 'AbortError';
          const isLastAttempt = attempt === modelTiers.length - 1;
          if (isTimeout && !isLastAttempt) {
            console.warn(`[content-advisor] ⏱️ Model ${model} timed out after ${LLM_TIMEOUT_MS / 1000}s, falling back...`);
            continue;
          }
          throw err; // Re-throw if not timeout or last attempt
        }
      }
      throw new Error('All model tiers exhausted');
    }

    const aiResponse = await callLLMWithRetry();

    if (!aiResponse.ok) {
      const errText = await aiResponse.text()
      console.error('[content-advisor] AI error:', aiResponse.status, errText)

      if (aiResponse.status === 429) {
        return jsonError('AI rate limited, please try again later', 429)
      }
      if (aiResponse.status === 402) {
        return jsonError('AI credits exhausted', 402)
      }

      return jsonError('AI synthesis failed', 500)
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
      return jsonError('Failed to generate recommendation', 500)
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

    // ── Determine implementation mode ──
    // Content Architect handles: H1, H2, <p>, tables, FAQ, visible content
    // Code Architect handles: JSON-LD, meta tags, OG tags, structured data
    let implementationMode: 'api_direct' | 'script_injection' | 'brief_only' = 'brief_only'
    let implementationDetails: any = null

    if (cmsConnection?.hasWriteAccess) {
      implementationMode = 'api_direct'
      implementationDetails = {
        platform: cmsConnection.platform,
        capabilities: cmsConnection.capabilities,
        note: `Content Architect peut modifier directement le contenu visible (H1, H2, paragraphes, FAQ, tableaux) via l'API ${cmsConnection.platform}. Les métadonnées et JSON-LD sont gérés par Code Architect.`,
      }
    } else if (resolvedSiteId) {
      // Check if GTM/injection is available
      const { data: rules } = await serviceClient
        .from('site_script_rules')
        .select('id')
        .eq('domain_id', resolvedSiteId)
        .limit(1)
      if (rules && rules.length > 0) {
        implementationMode = 'script_injection'
        implementationDetails = { note: 'Pas de CMS API — injection JS pour le contenu visible. Code Architect gère les métadonnées.' }
      }
    }

    // ── Enrich with source metadata ──
    const result = {
      ...recommendation,
      implementation: {
        mode: implementationMode,
        cms_platform: cmsConnection?.platform || null,
        cms_write_access: cmsConnection?.hasWriteAccess || false,
        content_scope: 'visible_content',
        metadata_scope: 'code_architect',
        details: implementationDetails,
      },
      _meta: {
        domain,
        keyword,
        page_type,
        sources_used: {
          site_identity: !!siteContext,
          dataforseo_keywords: !!keywordData,
          dataforseo_serp: !!serpData,
          dataforseo_skipped: skippedDataForSEO,
          workbench_keywords: workbenchKeywords.length,
          workbench_quick_wins: workbenchQuickWins.length,
          workbench_content_gaps: workbenchContentGaps.length,
          competitor_scraping: competitorInsights.length,
          existing_audit: !!existingAuditData,
          cocoon_data: !!cocoonData,
          geo_score: geoScore !== null,
          llm_visibility: !!llmVisibilityData,
          backlinks: !!backlinkData,
          gmb: hasGMB,
        },
        context_signals: {
          geo_score: geoScore,
          llm_visible: isLLMVisible,
          serp_position: isInSERP ? serpPosition + 1 : null,
          domain_rank: domainRank,
          has_gmb: hasGMB,
          has_backlinks: hasBacklinks,
          referring_domains: backlinkData?.referring_domains || 0,
        },
        guardrails: {
          conservative_sector: isConservativeSector,
          nonprofit: isNonProfit,
          jargon_distance: jargonDist,
          warnings_count: guardrailWarnings.length,
        },
        workbench_items_used: workbenchItems.length,
        generated_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
      },
    }

    // ── Mark workbench items as consumed by content architect ──
    if (workbenchItems.length > 0) {
      try {
        const itemIds = workbenchItems.map((i: any) => i.id)
        await serviceClient
          .from('architect_workbench')
          .update({ consumed_by_content: true, consumed_at: new Date().toISOString(), status: 'in_progress' })
          .in('id', itemIds)
        console.log(`[content-advisor] Marked ${itemIds.length} workbench items as consumed`)
      } catch (e) {
        console.warn('[content-advisor] Failed to mark workbench items:', e)
      }
    }

    // ── LOG GENERATION for performance correlation training ──
    try {
      await serviceClient.from('content_generation_logs').insert({
        user_id: user.id,
        tracked_site_id: resolvedSiteId || '',
        domain,
        market_sector: siteIdentity?.sector || null,
        page_type,
        target_url: url,
        keyword,
        brief_tone: contentBrief.tone,
        brief_angle: contentBrief.angle,
        brief_length_target: contentBrief.target_length,
        brief_h2_count: contentBrief.h2_count.max,
        brief_h3_count: contentBrief.h3_count.max,
        brief_cta_count: contentBrief.cta.length,
        brief_internal_links_count: contentBrief.internal_links.length,
        brief_schema_types: contentBrief.schema_types,
        brief_eeat_signals: contentBrief.eeat_signals,
        brief_geo_passages: contentBrief.geo_citable_passages,
        source: 'content_architect',
      });
      console.log(`[content-advisor] Generation logged for correlation training`);
    } catch (e) {
      console.warn('[content-advisor] Failed to log generation:', e);
    }

    // ── Cache for 12h ──
    try {
      await setCache(ck, 'content-architecture-advisor', result, 12)
    } catch (e) {
      console.warn('[content-advisor] Cache write failed:', e)
    }

    console.log(`[content-advisor] Done in ${Date.now() - startTime}ms`)

    // ── ASYNC JOB: Save result if running as background job ──
    if (jobSb && jobId) {
      await jobSb.from('async_jobs').update({
        status: 'completed',
        result_data: result,
        progress: 100,
        completed_at: new Date().toISOString(),
      }).eq('id', jobId)
      console.log(`[content-advisor] Async job ${jobId} completed`)
    }

    // Enrich result with page scan metadata
    if (existingPageHtml) {
      const injectionPts = existingPageHtmlRaw ? extractInjectionPoints(existingPageHtmlRaw, url) : null
      result.existing_page_scan = {
        has_existing_content: true,
        title: existingPageHtml.titleContent,
        h1: existingPageHtml.h1Contents,
        h2_count: existingPageHtml.h2Count,
        word_count: existingPageHtml.wordCount,
        has_schema: existingPageHtml.hasSchemaOrg,
        schema_types: existingPageHtml.schemaTypes,
        has_faq: existingPageHtml.hasFAQSection,
        has_faq_schema: existingPageHtml.hasFAQWithSchema,
        images_total: existingPageHtml.imagesTotal,
        images_missing_alt: existingPageHtml.imagesMissingAlt,
        internal_links: existingPageHtml.internalLinksCount,
        content_age_days: existingPageHtml.contentAgeDays,
        injection_points: injectionPts,
      }
    } else {
      result.existing_page_scan = { has_existing_content: false, injection_points: null }
    }

    // ── Persist .md cache + fetch cross-user "Recommandation Crawlers" ──
    let crawlersRecommendation: { markdown: string; created_at: string } | null = null
    try {
      const generatedMd = payloadToMarkdown(result, {
        domain, keyword, page_type,
        length: contentLengthForKey,
        lang: language_code,
        secondary_keywords: (body as { keywords?: string[] }).keywords,
      })
      if (!isServiceRole) {
        await saveCache(serviceClient, {
          userId: user.id,
          cacheKey: persistentKey,
          domain, keyword, page_type,
          length: contentLengthForKey,
          lang: language_code,
          markdown: generatedMd,
          payload: result,
          is_shareable: true,
        })
        // Recommandation Crawlers (anonymisée) — autre user, même intention
        const userClientForReco = getUserClient(authHeader)
        const reco = await getCrawlersRecommendation(userClientForReco, persistentKey)
        if (reco) {
          crawlersRecommendation = { markdown: reco.markdown, created_at: reco.created_at }
        }
      }
      result._markdown = generatedMd
    } catch (e) {
      console.error('[content-advisor] Cache persist error:', e)
    }

    return jsonOk({ data: result, crawlers_recommendation: crawlersRecommendation })


  } catch (error) {
    console.error('[content-advisor] Error:', error)

    // ── ASYNC JOB: Mark as failed ──
    if (_jobId) {
      try {
        const sb = getServiceClient()
        await sb.from('async_jobs').update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString(),
        }).eq('id', _jobId)
      } catch (_) { /* ignore */ }
    }

    return jsonError(error instanceof Error ? error.message : 'Unknown error', 500)
  }
}

// ── Deno.serve with waitUntil for background jobs ──
Deno.serve(handleRequest(async (req) => {
  // Check if this is a background job (self-invoked with _job_id)
  const clonedReq = req.clone()
  let isBackgroundJob = false
  try {
    if (req.method === 'POST') {
      const peekBody = await clonedReq.json()
      isBackgroundJob = !!peekBody._job_id
    }
  } catch {}

  if (isBackgroundJob) {
    // Use waitUntil to process in background — return 200 immediately
    // The actual result is written to async_jobs table
    const promise = processAdvisorRequest(req, true).catch(err => {
      console.error('[content-advisor] waitUntil error:', err)
    })
    // @ts-ignore - EdgeRuntime.waitUntil is available in Supabase Edge Functions
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(promise)
    } else {
      // Fallback: just fire and forget
      promise.catch(() => {})
    }
    return new Response(JSON.stringify({ status: 'processing' }), {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    })
  }

  // Normal synchronous request
  return processAdvisorRequest(req, false)
}))