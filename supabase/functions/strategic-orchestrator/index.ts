/**
 * strategic-orchestrator — Central dispatcher for the strategic audit pipeline.
 * 
 * Orchestrates 4 micro-functions in parallel, then calls strategic-synthesis.
 * Falls back to the monolithic audit-strategique-ia on failure.
 * 
 * Supports both sync and async (job queue) modes.
 */
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { checkIpRate, getClientIp, rateLimitResponse, acquireConcurrency, releaseConcurrency, concurrencyResponse } from '../_shared/ipRateLimiter.ts'
import { checkFairUse, getUserContext } from '../_shared/fairUse.ts'
import { trackEdgeFunctionError } from '../_shared/tokenTracker.ts'

const GLOBAL_DEADLINE = 500_000; // 8m20s

async function invokeFunction(name: string, body: any, timeoutMs = 60000): Promise<any> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const resp = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`${name} failed (${resp.status}): ${txt.substring(0, 200)}`);
  }
  return resp.json();
}

async function invokeFallback(req: Request, body: any): Promise<Response> {
  console.log('🔄 [orchestrator] Falling back to audit-strategique-ia...');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') || `Bearer ${serviceKey}`;
  const resp = await fetch(`${supabaseUrl}/functions/v1/audit-strategique-ia`, {
    method: 'POST',
    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, async: false }),
    signal: AbortSignal.timeout(GLOBAL_DEADLINE),
  });
  const data = await resp.json();
  return new Response(JSON.stringify(data), { status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  const startTime = Date.now();
  let jobId: string | null = null;
  let jobSb: any = null;

  try {
    // ── Rate limiting ──
    const clientIp = getClientIp(req);
    const ipCheck = checkIpRate(clientIp, 'strategic-orchestrator', 5, 60);
    if (!ipCheck.allowed) return rateLimitResponse(ipCheck);
    const concurrency = acquireConcurrency('strategic-orchestrator');
    if (!concurrency.allowed) return concurrencyResponse();

    const body = await req.json();
    const { url, toolsData, hallucinationCorrections, competitorCorrections, cachedContext, lang } = body;
    const isAsync = body.async !== false;

    // ── Check if admin has enabled Flash mode for strategic GEO ──
    let modelOverride: string | null = body._modelOverride || null;
    if (!modelOverride) {
      try {
        const sb = getServiceClient();
        const { data: cfg } = await sb.from('system_config').select('value').eq('key', 'strategic_geo_flash_mode').single();
        if (cfg?.value === true) modelOverride = 'google/gemini-2.5-flash';
      } catch { /* ignore, default to pro */ }
    }

    if (!url) return json({ error: 'URL requise' }, 400);

    // ── Fair use check ──
    const authHeader = req.headers.get('Authorization') || '';
    if (authHeader) {
      const userCtx = await getUserContext(authHeader);
      if (userCtx) {
        const fairUse = await checkFairUse(userCtx.userId, 'strategic_audit', userCtx.planType);
        if (!fairUse.allowed) return json({ error: 'Limite d\'utilisation atteinte', fair_use: fairUse }, 429);
      }
    }

    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    const domain = new URL(normalizedUrl).hostname;

    // ── ASYNC MODE: Create job and fire-and-forget ──
    if (isAsync && authHeader) {
      const sb = getServiceClient();
      const userSb = getUserClient(authHeader);
      const { data: { user } } = await userSb.auth.getUser();
      if (!user) return json({ error: 'Authentication required for async mode' }, 401);

      const { data: job, error: jobError } = await sb.from('async_jobs').insert({
        user_id: user.id, function_name: 'strategic-orchestrator', status: 'pending',
        input_payload: { url, toolsData, hallucinationCorrections, competitorCorrections, cachedContext, lang },
      }).select('id').single();
      if (jobError || !job) return json({ error: 'Failed to create job' }, 500);

      // Fire-and-forget: self-invoke synchronously with job_id
      const syncBody = { ...body, async: false, _job_id: job.id };
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      fetch(`${supabaseUrl}/functions/v1/strategic-orchestrator`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(syncBody),
      }).catch(err => console.error('[orchestrator] Async self-invoke failed:', err));

      return json({ job_id: job.id, status: 'pending' }, 202);
    }

    // ── JOB TRACKING ──
    jobId = body._job_id;
    jobSb = jobId ? getServiceClient() : null;
    if (jobSb && jobId) await jobSb.from('async_jobs').update({ status: 'processing', started_at: new Date().toISOString(), progress: 5 }).eq('id', jobId);

    // ── If cachedContext provided, skip to synthesis directly ──
    if (cachedContext) {
      console.log('⚡ [orchestrator] Using cached context — skipping data collection');
      if (jobSb && jobId) await jobSb.from('async_jobs').update({ progress: 75 }).eq('id', jobId);

      const synthResult = await invokeFunction('strategic-synthesis', {
        url: normalizedUrl, domain,
        crawlData: { pageContentContext: cachedContext.pageContentContext, brandSignals: cachedContext.brandSignals, eeatSignals: cachedContext.eeatSignals, ctaSeoSignals: cachedContext.ctaSeoSignals || {}, businessContext: {} },
        marketData: { marketData: cachedContext.marketData, rankingOverview: cachedContext.rankingOverview },
        competitorsData: { competitors: null, founderInfo: cachedContext.founderInfo, gmbData: cachedContext.gmbData, facebookPageInfo: cachedContext.facebookPageInfo },
        llmData: cachedContext.llmData,
        toolsData, lang, hallucinationCorrections, competitorCorrections,
        modelOverride,
      }, 200_000);

      if (jobSb && jobId) await jobSb.from('async_jobs').update({ status: 'completed', result_data: synthResult.data || synthResult, progress: 100, completed_at: new Date().toISOString() }).eq('id', jobId);
      return json(synthResult);
    }

    // ═══ WAVE 1: Parallel data collection (crawl + market + competitors + llm) ═══
    console.log('🚀 [orchestrator] Wave 1: parallel data collection...');
    if (jobSb && jobId) await jobSb.from('async_jobs').update({ progress: 10 }).eq('id', jobId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    let crawlResult: any = null;
    let marketResult: any = null;
    let competitorsResult: any = null;
    let llmResult: any = null;

    const [crawlResp, marketResp, competitorsResp, llmResp] = await Promise.allSettled([
      invokeFunction('strategic-crawl', { url: normalizedUrl }, 30_000),
      // market needs crawl data, but we start it in parallel and pass minimal data
      // It will use its own metadata extraction if needed
      invokeFunction('strategic-market', { url: normalizedUrl, domain, pageContentContext: '' }, 120_000),
      invokeFunction('strategic-competitors', { url: normalizedUrl, domain, isContentMode: false }, 60_000),
      // check-llm (existing function)
      (async () => {
        if (toolsData?.llm && !toolsData.llm.note) return { success: true, data: toolsData.llm };
        const r = await fetch(`${supabaseUrl}/functions/v1/check-llm`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: normalizedUrl, lang: 'fr' }),
          signal: AbortSignal.timeout(45_000),
        });
        if (!r.ok) { await r.text(); return null; }
        const d = await r.json();
        return d.success && d.data ? d.data : null;
      })(),
    ]);

    // Process results
    if (crawlResp.status === 'fulfilled' && crawlResp.value?.success) {
      crawlResult = crawlResp.value.data;
      console.log(`✅ [orchestrator] Crawl done (${crawlResult.duration_ms}ms)`);
    } else {
      console.warn('⚠️ [orchestrator] Crawl failed:', crawlResp.status === 'rejected' ? crawlResp.reason : 'no data');
    }

    if (marketResp.status === 'fulfilled' && marketResp.value?.success) {
      marketResult = marketResp.value.data;
      console.log(`✅ [orchestrator] Market done (${marketResult.duration_ms}ms)`);
    } else {
      console.warn('⚠️ [orchestrator] Market failed');
    }

    if (competitorsResp.status === 'fulfilled' && competitorsResp.value?.success) {
      competitorsResult = competitorsResp.value.data;
      console.log(`✅ [orchestrator] Competitors done (${competitorsResult.duration_ms}ms)`);
    } else {
      console.warn('⚠️ [orchestrator] Competitors failed');
    }

    if (llmResp.status === 'fulfilled' && llmResp.value) {
      llmResult = llmResp.value;
      console.log(`✅ [orchestrator] LLM check done`);
    }

    // ── If ALL data collection failed, fallback to monolith ──
    if (!crawlResult && !marketResult && !competitorsResult) {
      console.warn('⚠️ [orchestrator] All data collection failed — falling back');
      const fallbackResp = await invokeFallback(req, body);
      const fallbackData = await fallbackResp.json();
      if (jobSb && jobId) await jobSb.from('async_jobs').update({ status: 'completed', result_data: fallbackData.data || fallbackData, progress: 100, completed_at: new Date().toISOString() }).eq('id', jobId);
      return json(fallbackData);
    }

    if (jobSb && jobId) await jobSb.from('async_jobs').update({ progress: 60 }).eq('id', jobId);

    // ── If market needs crawl data for better seeds, re-invoke with context ──
    if (crawlResult && marketResp.status === 'fulfilled' && (!marketResult?.marketData || marketResult.marketData?.top_keywords?.length < 3)) {
      console.log('🔄 [orchestrator] Re-invoking market with crawl context...');
      try {
        const retryMarket = await invokeFunction('strategic-market', {
          url: normalizedUrl, domain,
          businessContext: crawlResult.businessContext,
          pageContentContext: crawlResult.pageContentContext,
        }, 120_000);
        if (retryMarket?.success) marketResult = retryMarket.data;
      } catch (e) { console.warn('⚠️ Market retry failed:', e); }
    }

    // ═══ WAVE 2: LLM Synthesis ═══
    console.log('🤖 [orchestrator] Wave 2: LLM synthesis...');
    if (jobSb && jobId) await jobSb.from('async_jobs').update({ progress: 70 }).eq('id', jobId);

    let synthResult: any = null;
    try {
      synthResult = await invokeFunction('strategic-synthesis', {
        url: normalizedUrl, domain,
        crawlData: crawlResult || { pageContentContext: '', brandSignals: [], eeatSignals: {}, ctaSeoSignals: {}, businessContext: {} },
        marketData: marketResult || { marketData: null, rankingOverview: null },
        competitorsData: competitorsResult || { competitors: null, founderInfo: null, gmbData: null, facebookPageInfo: null },
        llmData: llmResult,
        toolsData, lang, hallucinationCorrections, competitorCorrections,
        modelOverride,
      }, 200_000);
    } catch (synthError) {
      console.error('❌ [orchestrator] Synthesis failed:', synthError);
      // Fallback to monolith
      console.log('🔄 [orchestrator] Synthesis failed — falling back to monolith');
      const fallbackResp = await invokeFallback(req, body);
      const fallbackData = await fallbackResp.json();
      if (jobSb && jobId) await jobSb.from('async_jobs').update({ status: 'completed', result_data: fallbackData.data || fallbackData, progress: 100, completed_at: new Date().toISOString() }).eq('id', jobId);
      return json(fallbackData);
    }

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ [orchestrator] AUDIT TERMINÉ en ${totalDuration}s (pipeline micro-fonctions)`);

    // ── Save result to job if async ──
    if (jobSb && jobId) {
      await jobSb.from('async_jobs').update({
        status: 'completed',
        result_data: synthResult.data || synthResult,
        progress: 100,
        completed_at: new Date().toISOString(),
      }).eq('id', jobId);
    }

    return json(synthResult);

  } catch (error) {
    console.error('❌ [orchestrator] Fatal:', error);
    await trackEdgeFunctionError('strategic-orchestrator', error instanceof Error ? error.message : 'Fatal').catch(() => {});

    if (jobSb && jobId) {
      await jobSb.from('async_jobs').update({ status: 'failed', error_message: error instanceof Error ? error.message : 'Unknown', completed_at: new Date().toISOString() }).eq('id', jobId).catch(() => {});
    }

    return json({
      success: true,
      data: {
        url: '', domain: '', scannedAt: new Date().toISOString(), overallScore: 0,
        introduction: { presentation: 'Une erreur est survenue. Veuillez relancer.', strengths: '', improvement: '', competitors: [] },
        executive_roadmap: [], executive_summary: 'Analyse interrompue.',
        _error: error instanceof Error ? error.message : 'Unknown',
      },
    });
  } finally {
    releaseConcurrency('strategic-orchestrator');
  }
});
