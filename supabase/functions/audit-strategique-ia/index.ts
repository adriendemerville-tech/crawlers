/**
 * audit-strategique-ia — Orchestrator
 * All domain logic lives in _shared/strategicAudit/*. This file handles
 * HTTP routing, async jobs, parallelisation, LLM calls, and post-processing.
 */
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { trackTokenUsage, trackEdgeFunctionError } from '../_shared/tokenTracker.ts';
import { trackAnalyzedUrl } from '../_shared/trackUrl.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { checkIpRate, getClientIp, rateLimitResponse, acquireConcurrency, releaseConcurrency, concurrencyResponse } from '../_shared/ipRateLimiter.ts';
import { saveRawAuditData } from '../_shared/saveRawAuditData.ts';
import { getSiteContext } from '../_shared/getSiteContext.ts';
import { writeIdentity } from '../_shared/identityGateway.ts';
import { SYSTEM_PROMPT_A, SYSTEM_PROMPT_B, SYSTEM_PROMPT_C, buildUserPromptA, buildUserPromptB, buildUserPromptC, mergeParallelResults, parseLLMJson } from '../_shared/strategicSplitPrompts.ts';
import { computeFactualCitationScores } from '../_shared/citationScorer.ts';
import { preCrawlForAudit, formatPreCrawlForPrompt, type PreCrawlResult } from '../_shared/preCrawlForAudit.ts';
import { handleRequest } from '../_shared/serveHandler.ts';

// ── Shared strategic audit modules ──
import type { ToolsData, EEATSignals, MarketData, RankingOverview, BrandSignal, FounderInfo, FacebookPageInfo, GMBData, CtaSeoSignals, PageType } from '../_shared/strategicAudit/types.ts';
import { DEFAULT_EEAT_SIGNALS, DEFAULT_FOUNDER_INFO, DEFAULT_FACEBOOK_PAGE_INFO, DEFAULT_CTA_SEO_SIGNALS } from '../_shared/strategicAudit/types.ts';
import { resolveBrandName, humanizeBrandName, sanitizeBrandNameInResponse } from '../_shared/strategicAudit/brandDetection.ts';
import { detectBusinessContext, KNOWN_LOCATIONS } from '../_shared/strategicAudit/businessContext.ts';
import { fetchMarketData, fetchRankedKeywords } from '../_shared/strategicAudit/dataForSeo.ts';
import { detectGoogleMyBusiness, searchFounderProfile, searchFacebookPage, findLocalCompetitor } from '../_shared/strategicAudit/socialDiscovery.ts';
import { extractPageMetadata } from '../_shared/strategicAudit/pageAnalyzer.ts';
import { buildUserPrompt, getSystemPromptForPageType } from '../_shared/strategicAudit/prompts.ts';
import { saveStrategicRecommendationsToRegistry, saveToCache, buildFallbackResult, feedKeywordUniverse, persistIdentityData } from '../_shared/strategicAudit/registrySaver.ts';

// ==================== HELPERS ====================

async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch (e) { console.warn(`⚠️ [${label}] failed:`, e instanceof Error ? e.message : e); return null; }
}

function withDeadline<T>(promise: Promise<T>, deadlineMs: number, label: string): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => { console.warn(`⏰ [${label}] hit deadline (${deadlineMs}ms)`); resolve(null); }, deadlineMs))]);
}

// ==================== MAIN HANDLER ====================

Deno.serve(handleRequest(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const clientIp = getClientIp(req);
  const ipCheck = checkIpRate(clientIp, 'audit-strategique-ia', 10, 60_000);
  if (!ipCheck.allowed) return rateLimitResponse(corsHeaders, ipCheck.retryAfterMs);
  if (!acquireConcurrency('audit-strategique-ia', 25)) return concurrencyResponse(corsHeaders);

  const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  // ═══ ASYNC JOB POLLING ═══
  const reqUrl = new URL(req.url);
  const pollJobId = reqUrl.searchParams.get('job_id');
  if (pollJobId && req.method === 'GET') {
    const sb = getServiceClient();
    const { data: job } = await sb.from('async_jobs').select('status, result_data, error_message, progress').eq('id', pollJobId).single();
    if (!job) return json({ error: 'Job not found' }, 404);
    if (job.status === 'completed') return json({ success: true, data: job.result_data, status: 'completed' });
    if (job.status === 'failed') return json({ success: false, error: job.error_message, status: 'failed' });
    return json({ status: job.status, progress: job.progress });
  }

  const GLOBAL_DEADLINE = 510_000;
  const startTime = Date.now();
  const isOverDeadline = () => Date.now() - startTime > GLOBAL_DEADLINE;

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  let jobId: string | undefined;
  let jobSb: ReturnType<typeof getServiceClient> | null = null;

  try {
    const body = await req.json();
    const { url, toolsData, hallucinationCorrections, competitorCorrections, cachedContext, lang } = body;
    const asyncMode = body.async === true;
    const outputLang = lang || 'fr';
    const langLabel = outputLang === 'fr' ? 'français' : outputLang === 'es' ? 'espagnol' : 'anglais';

    if (!url) return json({ success: false, error: 'URL is required' }, 400);
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return json({ success: false, error: 'AI service not configured' }, 500);

    // ═══ ASYNC MODE ═══
    if (asyncMode) {
      if (!supabaseUrl || !serviceKey) return json({ error: 'Backend service not configured' }, 500);
      const sb = getServiceClient();
      const authHeader = req.headers.get('Authorization') || '';
      const userSb = getUserClient(authHeader);
      const { data: { user } } = await userSb.auth.getUser();
      if (!user?.id) return json({ error: 'Authentication required for async mode' }, 401);

      const { data: job, error: jobError } = await sb.from('async_jobs').insert({ user_id: user.id, function_name: 'audit-strategique-ia', status: 'pending', input_payload: { url, toolsData, hallucinationCorrections, competitorCorrections, cachedContext, lang } }).select('id').single();
      if (jobError || !job) return json({ error: 'Failed to create job' }, 500);

      fetch(`${supabaseUrl}/functions/v1/audit-strategique-ia`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, async: false, _job_id: job.id }),
      }).catch(err => console.error('[audit-strategique-ia] Async self-invoke failed:', err));

      return json({ job_id: job.id, status: 'pending' }, 202);
    }

    // ═══ JOB TRACKING ═══
    jobId = body._job_id;
    jobSb = jobId ? getServiceClient() : null;
    if (jobSb && jobId) await jobSb.from('async_jobs').update({ status: 'processing', started_at: new Date().toISOString(), progress: 5 }).eq('id', jobId);

    const effectiveToolsData: ToolsData = toolsData || { crawlers: { note: 'Non disponible' }, geo: { note: 'Non disponible' }, llm: { note: 'Non disponible' }, pagespeed: { note: 'Non disponible' } };

    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    const parsedUrl = new URL(normalizedUrl);
    const domain = parsedUrl.hostname;
    const domainWithoutWww = domain.replace(/^www\./, '');
    const domainSlug = domainWithoutWww.split('.')[0];

    // ═══ PAGE TYPE DETECTION ═══
    const urlPath = parsedUrl.pathname.toLowerCase();
    const pathSegments = urlPath.replace(/^\/|\/$/g, '').split('/').filter(Boolean);
    let pageType: PageType = 'homepage';
    const editorialPattern = /\/(blog|article|articles|post|posts|news|actualite|actualites|guide|guides|tutoriel|tutorial|ressources|resources|wiki|learn|knowledge|faq)\b/;
    const productPattern = /\/(product|produit|produits|products|shop|boutique|store|catalogue|catalog|item|pricing|tarif|tarifs|offre|offres|service|services|solution|solutions)\b/;
    if (editorialPattern.test(urlPath) && pathSegments.length >= 2) pageType = 'editorial';
    else if (productPattern.test(urlPath) && pathSegments.length >= 1) pageType = 'product';
    else if (pathSegments.length >= 3) pageType = 'deep';
    else if (pathSegments.length >= 1 && urlPath !== '/') { const last = pathSegments[pathSegments.length - 1]; if (last.length > 60 || last.split('-').length > 6) pageType = 'deep'; }
    const isContentMode = pageType !== 'homepage';
    if (isContentMode) console.log(`📝 PAGE TYPE: "${pageType}" detected for path: ${parsedUrl.pathname}`);

    // ═══ DATA COLLECTION ═══
    const useCache = !!cachedContext;
    let pageContentContext: string;
    let brandSignals: BrandSignal[];
    let eeatSignals: EEATSignals;
    let marketData: MarketData | null;
    let rankingOverview: RankingOverview | null;
    let founderInfo: FounderInfo;
    let localCompetitorData: { name: string; url: string; rank: number; score?: number } | null = null;
    let localCompetitorsAll: { name: string; url: string; rank: number; score?: number }[] = [];
    let gmbData: GMBData | null = null;
    let facebookPageInfo: FacebookPageInfo = { ...DEFAULT_FACEBOOK_PAGE_INFO };
    let ctaSeoSignalsForJargon: CtaSeoSignals = { ...DEFAULT_CTA_SEO_SIGNALS, ctaTypes: [], seoTermsInBalises: [], jargonTermsInBalises: [] };
    let preCrawlResult: PreCrawlResult | null = null;
    let siteIdentityCtx: Record<string, unknown> | null = null;
    let trackedSiteIdForCrawl: string | null = null;
    let businessModelDetectionRef: { model: string | null; confidence: number; needs_llm_fallback: boolean } | null = null;

    if (useCache) {
      console.log('⚡ SMART CACHE: Using cached context — skipping all data collection');
      pageContentContext = cachedContext.pageContentContext || '';
      brandSignals = cachedContext.brandSignals || [];
      eeatSignals = cachedContext.eeatSignals || { ...DEFAULT_EEAT_SIGNALS, linkedInUrls: [], detectedSocialUrls: [] };
      marketData = cachedContext.marketData || null;
      rankingOverview = cachedContext.rankingOverview || null;
      founderInfo = cachedContext.founderInfo || { ...DEFAULT_FOUNDER_INFO };
      gmbData = cachedContext.gmbData || null;
      facebookPageInfo = cachedContext.facebookPageInfo || { ...DEFAULT_FACEBOOK_PAGE_INFO };
      if (cachedContext.llmData) effectiveToolsData.llm = cachedContext.llmData;
      preCrawlResult = cachedContext.preCrawlData || null;
    } else {
      // ── Resolve tracked_site_id for pre-crawl ──
      let userIdForCrawl: string | null = null;
      try {
        const authHeader = req.headers.get('Authorization') || '';
        if (authHeader) {
          const userSb = getUserClient(authHeader);
          const { data: { user: authUser } } = await userSb.auth.getUser();
          if (authUser?.id) {
            userIdForCrawl = authUser.id;
            const { data: site } = await getServiceClient().from('tracked_sites').select('id').ilike('domain', `%${domainWithoutWww}%`).eq('user_id', authUser.id).limit(1).maybeSingle();
            if (site) trackedSiteIdForCrawl = site.id;
          }
        }
      } catch (e) { console.warn('[audit-strategique-ia] Could not resolve tracked_site:', e); }

      // ── WAVE 1: Metadata + Ranked Keywords + Pre-Crawl ──
      console.log('📊 WAVE 1: Metadata + Ranked Keywords + Pre-Crawl (parallel)...');
      const [metadataResult, rkOverviewResult, preCrawlRes] = await Promise.all([
        safe('metadata', () => extractPageMetadata(url)),
        safe('ranked_keywords', () => {
          const tld = domain.split('.').pop() || 'com';
          const tldMap: Record<string, string> = { 'fr': 'france', 'be': 'belgium', 'ch': 'switzerland', 'ca': 'canada', 'de': 'germany', 'es': 'spain', 'it': 'italy', 'uk': 'united kingdom', 'com': 'france', 'ai': 'france', 'io': 'france', 'dev': 'france', 'app': 'france' };
          const locInfo = KNOWN_LOCATIONS[tldMap[tld] || 'france'] || KNOWN_LOCATIONS['france'];
          return fetchRankedKeywords(domain, locInfo.code, locInfo.lang);
        }),
        safe('pre_crawl', () => preCrawlForAudit(getServiceClient(), domainWithoutWww, trackedSiteIdForCrawl, userIdForCrawl)),
      ]);
      preCrawlResult = preCrawlRes as PreCrawlResult | null;
      const preCrawlContext = preCrawlResult ? formatPreCrawlForPrompt(preCrawlResult) : '';
      if (preCrawlContext) console.log(`🕷️ Pre-crawl context: ${preCrawlResult!.pages.length} pages (${preCrawlResult!.source})`);

      pageContentContext = metadataResult?.context || '';
      brandSignals = metadataResult?.brandSignals || [];
      eeatSignals = metadataResult?.eeatSignals || { ...DEFAULT_EEAT_SIGNALS, linkedInUrls: [], detectedSocialUrls: [] };
      ctaSeoSignalsForJargon = metadataResult?.ctaSeoSignals || ctaSeoSignalsForJargon;
      rankingOverview = rkOverviewResult;
      if (preCrawlContext) pageContentContext += '\n' + preCrawlContext;

      // ── Business model heuristic → injected as context for LLM confirmation/override ──
      const bmDetection = (metadataResult as any)?.businessModelDetection;
      if (bmDetection) businessModelDetectionRef = { model: bmDetection.model, confidence: bmDetection.confidence, needs_llm_fallback: bmDetection.needs_llm_fallback };
      if (bmDetection) {
        if (bmDetection.model && !bmDetection.needs_llm_fallback) {
          pageContentContext += `\nMODÈLE D'ACTIVITÉ DÉTECTÉ (heuristique HTML, confiance ${bmDetection.confidence}): ${bmDetection.model}. Confirme ou corrige dans business_model.`;
        } else {
          const top3 = (bmDetection.candidates || []).slice(0, 3).map((c: any) => `${c.model}(${c.score})`).join(', ');
          pageContentContext += `\nMODÈLE D'ACTIVITÉ INCERTAIN (heuristique HTML faible, confiance ${bmDetection.confidence}). Top candidats: ${top3}. Choisis impérativement la valeur la plus juste dans business_model.`;
        }
      }

      const context = detectBusinessContext(domain, pageContentContext);

      // ── Site identity card ──
      try {
        siteIdentityCtx = await getSiteContext(getServiceClient(), { domain: domainWithoutWww });
        if (siteIdentityCtx) console.log(`📇 Carte d'identité chargée (confiance: ${siteIdentityCtx.identity_confidence || 0})`);
      } catch (e) { console.warn(`⚠️ Carte d'identité non disponible:`, e); }

      // ── Keyword cloud from SERP snapshots ──
      let existingKeywords: string[] = [];
      try {
        const domainClean = domainWithoutWww.replace(/^www\./, '').toLowerCase();
        const { data: serpSnapshot } = await getServiceClient().from('serp_snapshots').select('sample_keywords').ilike('domain', `%${domainClean}%`).order('measured_at', { ascending: false }).limit(1).maybeSingle();
        if (serpSnapshot?.sample_keywords && Array.isArray(serpSnapshot.sample_keywords)) {
          existingKeywords = serpSnapshot.sample_keywords.filter((k: any) => k?.keyword).map((k: any) => k.keyword as string);
          if (existingKeywords.length > 0) console.log(`☁️ Keyword cloud loaded: ${existingKeywords.length} keywords`);
        }
      } catch (e) { console.warn('⚠️ Could not fetch keyword cloud:', e); }

      // ── WAVE 2: Market + LLM + Competitor + Founder + GMB + Facebook ──
      console.log(`\n📊 WAVE 2: Market data + LLM check${isContentMode ? '' : ' + Competitor + Founder'} (parallel)...`);
      const needsLlmCheck = !toolsData?.llm || toolsData.llm.note;
      const [mktDataResult, llmCheckResult, localCompResult, founderResult, gmbResult, fbResult] = await Promise.allSettled([
        withDeadline(fetchMarketData(domain, context, pageContentContext, url, existingKeywords), 120_000, 'market_data'),
        needsLlmCheck && supabaseUrl && supabaseAnonKey
          ? withDeadline((async () => { const r = await fetch(`${supabaseUrl}/functions/v1/check-llm`, { method: 'POST', headers: { 'Authorization': `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ url, lang: 'fr' }), signal: AbortSignal.timeout(40000) }); if (!r.ok) { await r.text(); return null; } const d = await r.json(); return d.success && d.data ? d.data : null; })(), 45_000, 'check_llm') : Promise.resolve(null),
        !isContentMode && context.locationCode ? withDeadline(findLocalCompetitor(domain, context.sector, context.locationCode, pageContentContext, context.languageCode, context.seDomain, siteIdentityCtx), 20_000, 'local_competitor') : Promise.resolve(null),
        !isContentMode ? withDeadline(searchFounderProfile(domain, context.location), 15_000, 'founder') : Promise.resolve(null),
        !isContentMode && context.locationCode ? withDeadline(detectGoogleMyBusiness(domain, context.brandName, context.locationCode, context.languageCode), 12_000, 'gmb') : Promise.resolve(null),
        !isContentMode && context.locationCode ? withDeadline(searchFacebookPage(context.brandName, context.sector, context.locationCode, context.languageCode), 10_000, 'facebook_page') : Promise.resolve(null),
      ]);

      marketData = mktDataResult.status === 'fulfilled' ? mktDataResult.value : null;
      if (llmCheckResult.status === 'fulfilled' && llmCheckResult.value) { effectiveToolsData.llm = llmCheckResult.value; console.log(`✅ LLM: score ${llmCheckResult.value.overallScore}/100`); }
      if (localCompResult.status === 'fulfilled' && localCompResult.value) { const cr = localCompResult.value; localCompetitorsAll = Array.isArray(cr) ? cr : [cr]; localCompetitorData = localCompetitorsAll[0] || null; }
      founderInfo = (founderResult.status === 'fulfilled' && founderResult.value) ? founderResult.value : { ...DEFAULT_FOUNDER_INFO };
      if (gmbResult.status === 'fulfilled' && gmbResult.value) gmbData = gmbResult.value;
      if (fbResult.status === 'fulfilled' && fbResult.value) facebookPageInfo = fbResult.value;
      console.log(`⏱️ Data collection done in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    }

    // ═══ BRAND RESOLUTION ═══
    const { name: resolvedEntityName, confidence: brandConfidence } = resolveBrandName(brandSignals, domain, url);
    const isConfidentBrand = brandConfidence >= 0.95;
    const humanBrandName = isConfidentBrand ? resolvedEntityName : humanizeBrandName(domainSlug);
    console.log(`🎯 Entité: "${resolvedEntityName}" (${(brandConfidence * 100).toFixed(0)}%)`);

    const cachedContextOut = { pageContentContext, brandSignals, eeatSignals, marketData, rankingOverview, founderInfo, llmData: effectiveToolsData.llm, gmbData, facebookPageInfo, preCrawlData: preCrawlResult || null };

    // ═══ CHECK DEADLINE ═══
    const remainingBeforeLLM = GLOBAL_DEADLINE - (Date.now() - startTime);
    if (remainingBeforeLLM < 90_000) {
      console.warn(`⏰ Only ${(remainingBeforeLLM / 1000).toFixed(0)}s remaining — returning fallback`);
      const fallback = buildFallbackResult(url, domain, marketData, rankingOverview, effectiveToolsData.llm, cachedContextOut);
      saveToCache(domain, url, fallback).catch(() => {});
      return json(fallback);
    }

    // ═══ LLM ANALYSIS ═══
    console.log(`\n🤖 ÉTAPE 2: Analyse LLM (${((Date.now() - startTime) / 1000).toFixed(1)}s elapsed)...`);

    let userPrompt = buildUserPrompt(url, domain, effectiveToolsData, marketData, pageContentContext, eeatSignals, founderInfo, rankingOverview, isContentMode, facebookPageInfo);
    userPrompt = `🌐 LANGUE DE RÉDACTION: ${langLabel}. Rédige TOUS les textes en ${langLabel}. Les mots-clés SEO restent dans la langue naturelle du site.\n` + userPrompt;

    const pageTypeLabels: Record<PageType, string> = { editorial: '📝 MODE ÉDITORIAL', product: '🛒 MODE PRODUIT', deep: '📄 MODE PAGE PROFONDE', homepage: '🏷️' };
    if (isContentMode) userPrompt = `${pageTypeLabels[pageType]}: Analyse de la page "${resolvedEntityName}" (type: ${pageType})\n` + userPrompt;
    else userPrompt = `🏷️ NOM DE L'ENTITÉ ANALYSÉE: "${resolvedEntityName}"\n` + userPrompt;

    // Inject identity card
    if (siteIdentityCtx) {
      const idParts: string[] = [];
      const fields: Record<string, string> = { market_sector: 'Secteur', entity_type: 'Type', commercial_model: 'Modèle', products_services: 'Produits/Services', target_audience: 'Cible', commercial_area: 'Zone', company_size: 'Taille', business_type: 'Activité', competitors: 'Concurrents connus', brand_name: 'Marque', gmb_presence: 'GMB', gmb_city: 'Ville GMB' };
      for (const [k, label] of Object.entries(fields)) { if ((siteIdentityCtx as any)[k]) idParts.push(`${label}: ${(siteIdentityCtx as any)[k]}`); }
      if ((siteIdentityCtx as any).is_local_business) idParts.push('Business local: oui');
      if (idParts.length > 0) userPrompt = `📇 CARTE D'IDENTITÉ DU SITE (confiance: ${siteIdentityCtx.identity_confidence || 0}):\n${idParts.join('\n')}\n⚠️ VÉRIFICATION: Compare ces données avec le contenu de la page. Signale toute incohérence.\n` + userPrompt;
    }

    if (!isContentMode && localCompetitorsAll.length > 0) {
      const compLines = localCompetitorsAll.map((c, i) => `  ${i + 1}. "${c.name}" URL:${c.url || 'N/A'} Position:${c.rank || 'N/A'} Score:${c.score || 0}`).join('\n');
      userPrompt = `🏙️ CONCURRENTS IDENTIFIÉS:\n${compLines}\nUtilise le #1 comme direct_competitor.\n` + userPrompt;
    }

    if (hallucinationCorrections) {
      const corrections = Object.entries(hallucinationCorrections).filter(([_, v]) => v).map(([k, v]) => `${k}="${v}"`).join(', ');
      if (corrections) userPrompt = `⚠️ CORRECTIONS UTILISATEUR (priorité absolue): ${corrections}\n` + userPrompt;
    }

    if (competitorCorrections) {
      const cc = competitorCorrections;
      const parts: string[] = [];
      const competitorNames: string[] = [];
      if (cc.leader?.name) { parts.push(`Leader:"${cc.leader.name}"${cc.leader.url ? `(${cc.leader.url})` : ''}`); competitorNames.push(cc.leader.name); }
      if (cc.direct_competitor?.name) { parts.push(`Concurrent:"${cc.direct_competitor.name}"${cc.direct_competitor.url ? `(${cc.direct_competitor.url})` : ''}`); competitorNames.push(cc.direct_competitor.name); }
      if (cc.challenger?.name) { parts.push(`Challenger:"${cc.challenger.name}"`); competitorNames.push(cc.challenger.name); }
      if (parts.length > 0) userPrompt = `🏢 CONCURRENTS CORRIGÉS: ${parts.join(', ')}\n` + userPrompt;

      if (competitorNames.length > 0 && trackedSiteIdForCrawl) {
        writeIdentity({ siteId: trackedSiteIdForCrawl, fields: { competitors: competitorNames }, source: 'user_manual', forceOverwrite: true })
          .then(r => console.log(`✅ Competitors persisted: [${competitorNames.join(', ')}] (applied: ${r.applied})`))
          .catch(e => console.warn('⚠️ Failed to persist competitors:', e));
      }
    }

    // ── LLM Call ──
    const remainingMs = Math.max(60_000, GLOBAL_DEADLINE - (Date.now() - startTime) - 15_000);
    let parsedAnalysis: any = null;
    const useParallelMode = !isContentMode;

    async function callLLMWithModel(model: string, timeoutMs: number, systemPrompt: string, userPromptText: string, label: string = ''): Promise<string | null> {
      console.log(`🤖 [${label}] Calling ${model} (timeout: ${Math.round(timeoutMs / 1000)}s)...`);
      try {
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST', headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPromptText }], temperature: 0.3, max_tokens: 8192 }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) { const et = await response.text(); console.error(`❌ [${label}] ${model} error:`, response.status, et.substring(0, 200)); return null; }
        const aiResponse = await response.json();
        trackTokenUsage(`audit-strategique-ia${label ? `-${label}` : ''}`, model, aiResponse.usage, url);
        return aiResponse.choices?.[0]?.message?.content || null;
      } catch (e) { console.warn(`⚠️ [${label}] ${model} failed: ${e instanceof Error ? e.message : e}`); return null; }
    }

    async function callWithFallback(systemPrompt: string, userPromptText: string, label: string, timeoutMs: number): Promise<any | null> {
      const primaryModel = body._modelOverride || 'google/gemini-2.5-flash';
      const model = label === 'A-identity' ? (body._modelOverride || 'google/gemini-2.5-pro') : primaryModel;
      const callTimeout = Math.min(timeoutMs, label === 'A-identity' ? 120_000 : 90_000);
      let raw = await callLLMWithModel(model, callTimeout, systemPrompt, userPromptText, label);
      if (!raw && model !== 'google/gemini-2.5-flash') { console.log(`🔄 ${label}: Retrying with Flash...`); raw = await callLLMWithModel('google/gemini-2.5-flash', Math.min(60_000, timeoutMs - 5000), systemPrompt, userPromptText, label); }
      if (!raw) return null;
      const parsed = parseLLMJson(raw);
      if (!parsed) console.warn(`⚠️ ${label}: JSON parse failed`);
      return parsed;
    }

    if (useParallelMode) {
      console.log('🚀 Parallel mode: 3 focused LLM calls...');
      const factualCitation = computeFactualCitationScores({ rankingOverview, crawlData: effectiveToolsData, backlinkData: null, gmbData: gmbData ? { completeness_score: gmbData.rating ? 70 : 30, rating: gmbData.rating, total_reviews: gmbData.totalReviews } : null });
      const parallelTimeout = Math.min(remainingMs, 150_000);
      const [resultA, resultB, resultC] = await Promise.all([
        callWithFallback(SYSTEM_PROMPT_A, buildUserPromptA(url, domain, userPrompt), 'A-identity', parallelTimeout),
        callWithFallback(SYSTEM_PROMPT_B, buildUserPromptB(url, domain, userPrompt), 'B-market', parallelTimeout),
        callWithFallback(SYSTEM_PROMPT_C, buildUserPromptC(url, domain, userPrompt, factualCitation.factual_summary), 'C-geo', parallelTimeout),
      ]);
      const successCount = [resultA, resultB, resultC].filter(Boolean).length;
      console.log(`✅ Parallel results: ${successCount}/3 (A:${!!resultA} B:${!!resultB} C:${!!resultC})`);
      if (successCount === 0) {
        const fallback = buildFallbackResult(url, domain, marketData, rankingOverview, effectiveToolsData.llm, cachedContextOut);
        saveToCache(domain, url, fallback).catch(() => {});
        if (jobSb && jobId) await jobSb.from('async_jobs').update({ status: 'completed', result_data: fallback.data, progress: 100, completed_at: new Date().toISOString() }).eq('id', jobId);
        return json(fallback);
      }
      parsedAnalysis = mergeParallelResults(resultA, resultB, resultC);
      console.log(`✅ Merged in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    } else {
      const factualCitationMono = computeFactualCitationScores({ rankingOverview, crawlData: effectiveToolsData, backlinkData: null, gmbData: gmbData ? { completeness_score: gmbData.rating ? 70 : 30, rating: gmbData.rating, total_reviews: gmbData.totalReviews } : null });
      userPrompt = userPrompt + '\n' + factualCitationMono.factual_summary;
      const systemPromptForPage = getSystemPromptForPageType(pageType);
      const primaryModel = body._modelOverride || 'google/gemini-2.5-pro';
      let llmResult = await callLLMWithModel(primaryModel, Math.min(remainingMs, 150_000), systemPromptForPage, userPrompt, 'monolithic');
      if (!llmResult && primaryModel !== 'google/gemini-2.5-flash') {
        const flashTimeout = Math.max(60_000, GLOBAL_DEADLINE - (Date.now() - startTime) - 10_000);
        llmResult = await callLLMWithModel('google/gemini-2.5-flash', Math.min(flashTimeout, 120_000), systemPromptForPage, userPrompt, 'monolithic-flash');
      }
      if (!llmResult) { const fb = buildFallbackResult(url, domain, marketData, rankingOverview, effectiveToolsData.llm, cachedContextOut); saveToCache(domain, url, fb).catch(() => {}); return json(fb); }
      parsedAnalysis = parseLLMJson(llmResult);
    }

    if (!parsedAnalysis) { const fb = buildFallbackResult(url, domain, marketData, rankingOverview, effectiveToolsData.llm, cachedContextOut); saveToCache(domain, url, fb).catch(() => {}); return json(fb); }

    // ═══ POST-PROCESSING ═══
    parsedAnalysis = sanitizeBrandNameInResponse(parsedAnalysis, domainSlug, humanBrandName);

    // Validate competitive actors
    const cleanTargetDomain = domain.replace(/^www\./, '').toLowerCase();
    const brandNameLower = resolvedEntityName.toLowerCase().replace(/\..*$/, '');
    const domainSlugLower = domainSlug.toLowerCase();

    function isSelfReference(actor: any): boolean {
      if (!actor) return false;
      const actorDomain = (() => { try { return new URL(actor.url || '').hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } })();
      const actorNameLower = (actor.name || '').toLowerCase().replace(/\s+/g, '');
      const actorUrlNorm = (actor.url || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');
      const targetUrlNorm = normalizedUrl.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');
      return (actorUrlNorm && actorUrlNorm === targetUrlNorm) ||
        (actorDomain && (actorDomain === cleanTargetDomain || actorDomain.includes(cleanTargetDomain) || cleanTargetDomain.includes(actorDomain))) ||
        (actorNameLower && (actorNameLower === brandNameLower || actorNameLower === domainSlugLower || actorNameLower.includes(domainSlugLower) || domainSlugLower.includes(actorNameLower)));
    }

    if (parsedAnalysis.competitive_landscape) {
      const roles = ['leader', 'direct_competitor', 'challenger', 'inspiration_source'] as const;
      for (const role of roles) {
        const actor = parsedAnalysis.competitive_landscape[role];
        if (isSelfReference(actor)) {
          console.log(`⚠️ Self-reference in ${role}: "${actor?.name}" — replacing`);
          if (role === 'direct_competitor' && localCompetitorData) {
            parsedAnalysis.competitive_landscape[role] = { name: localCompetitorData.name, url: localCompetitorData.url, authority_factor: actor?.authority_factor || 'Concurrent SERP local', analysis: `Concurrent identifié via les résultats de recherche locaux, positionné #${localCompetitorData.rank}.` };
          } else { parsedAnalysis.competitive_landscape[role].name = 'Non identifié'; parsedAnalysis.competitive_landscape[role].url = null; parsedAnalysis.competitive_landscape[role].analysis = 'Auto-référence détectée et supprimée.'; }
        }
      }

      if (!isOverDeadline()) {
        await Promise.all(roles.map(async (role) => {
          const actor = parsedAnalysis.competitive_landscape[role];
          if (!actor?.url) return;
          let href = actor.url.trim().replace(/^\/+/, '');
          if (!href.startsWith('http')) href = `https://${href}`;
          try {
            new URL(href);
            const res = await fetch(href, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }, redirect: 'follow', signal: AbortSignal.timeout(4000) });
            const resolvedDomain = (() => { try { return new URL(res.url || href).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } })();
            if (resolvedDomain && (resolvedDomain === cleanTargetDomain || resolvedDomain.includes(cleanTargetDomain) || cleanTargetDomain.includes(resolvedDomain))) {
              actor.name = 'Non identifié'; actor.url = null; actor.analysis = 'Auto-référence détectée après redirection et supprimée.';
            } else if (res.ok || res.status === 403) { actor.url = res.url || href; } else { actor.url = null; }
          } catch { actor.url = null; }
        }));
      }
    }

    // Remove self from introduction.competitors[]
    if (parsedAnalysis.introduction?.competitors && Array.isArray(parsedAnalysis.introduction.competitors)) {
      parsedAnalysis.introduction.competitors = parsedAnalysis.introduction.competitors.filter((c: string) => {
        const cLower = c.toLowerCase().replace(/\s+/g, '');
        return !(cLower === cleanTargetDomain || cLower === brandNameLower || cLower === domainSlugLower || cLower.includes(domainSlugLower) || domainSlugLower.includes(cLower));
      });
    }

    // Validate social URLs
    if (parsedAnalysis.social_signals?.proof_sources && Array.isArray(parsedAnalysis.social_signals.proof_sources)) {
      const detectedUrlsSet = new Set((eeatSignals.detectedSocialUrls || []).map((u: string) => u.toLowerCase().replace(/\/$/, '')));
      if (founderInfo?.profileUrl) detectedUrlsSet.add(founderInfo.profileUrl.toLowerCase().replace(/\/$/, ''));
      if (facebookPageInfo?.pageUrl) detectedUrlsSet.add(facebookPageInfo.pageUrl.toLowerCase().replace(/\/$/, ''));
      for (const source of parsedAnalysis.social_signals.proof_sources) {
        if (source.profile_url) {
          const normalized = source.profile_url.toLowerCase().replace(/\/$/, '');
          const isValid = [...detectedUrlsSet].some(d => normalized.includes(d) || d.includes(normalized) || normalized.split('/').slice(-1)[0] === d.split('/').slice(-1)[0]);
          if (!isValid) { console.log(`⚠️ Removing hallucinated social URL: ${source.profile_url}`); source.profile_url = null; }
        }
      }
    }

    // Flag geo mismatch
    if (founderInfo?.geoMismatch && parsedAnalysis.social_signals) {
      parsedAnalysis.social_signals.founder_geo_mismatch = true;
      parsedAnalysis.social_signals.founder_geo_country = founderInfo.detectedCountry;
      if (parsedAnalysis.social_signals.proof_sources) parsedAnalysis.social_signals.proof_sources = parsedAnalysis.social_signals.proof_sources.filter((s: any) => s.platform !== 'linkedin' || s.presence_level === 'absent');
      if (parsedAnalysis.social_signals.thought_leadership) parsedAnalysis.social_signals.thought_leadership.founder_authority = 'unknown';
    }

    // Supplement main_keywords
    if (parsedAnalysis.keyword_positioning?.main_keywords) {
      const mainKw = parsedAnalysis.keyword_positioning.main_keywords;
      if (mainKw.length < 5 && marketData?.top_keywords) {
        const existingLower = new Set(mainKw.map((kw: any) => (kw.keyword || '').toLowerCase()));
        for (const mkw of marketData.top_keywords) {
          if (mainKw.length >= 5) break;
          if (!existingLower.has(mkw.keyword.toLowerCase())) { existingLower.add(mkw.keyword.toLowerCase()); mainKw.push({ keyword: mkw.keyword, volume: mkw.volume, difficulty: mkw.difficulty, current_rank: mkw.current_rank || 'Non classé' }); }
        }
      }
    }

    // Force-compute quotability & summary_resilience
    {
      const rawText = (pageContentContext || '').replace(/Titre="[^"]*"/g, '').replace(/H1="[^"]*"/g, '').replace(/Desc="[^"]*"/g, '');
      const sentences = rawText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 40 && s.length < 300);
      const quotableMarkers = [/\d+\s*%/i, /\d+\s*(fois|x|million|milliard)/i, /permet|offre|garantit|assure|réduit|augmente|améliore/i, /premier|unique|seul|leader|innovant|révolutionne/i, /grâce à|en seulement|jusqu'à|plus de|moins de/i, /enables|provides|reduces|increases|improves|delivers/i];
      const scoredSentences = sentences.map(s => { let score = 0; for (const m of quotableMarkers) if (m.test(s)) score++; if (!/^(il|elle|ils|elles|ce|cette|ces|it|they|this|these)\b/i.test(s)) score++; return { text: s, score }; }).sort((a, b) => b.score - a.score);
      const topQuotes = scoredSentences.slice(0, 3).filter(q => q.score > 0).map(q => q.text);
      const llmQuotes = parsedAnalysis.quotability?.quotes || [];
      const allQuotes = [...new Set([...llmQuotes, ...topQuotes])].slice(0, 3);
      parsedAnalysis.quotability = { score: Math.min(100, allQuotes.length * 33), quotes: allQuotes };

      const h1Match = (pageContentContext || '').match(/H1="([^"]+)"/);
      const titleMatch = (pageContentContext || '').match(/Titre="([^"]+)"/);
      const originalH1 = h1Match?.[1] || titleMatch?.[1] || 'Non détecté';
      const paragraphs = rawText.split(/\n+/).filter(p => p.trim().length > 50);
      const firstParagraph = paragraphs[0] || '';
      const h1Terms = originalH1.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const contentLower = (firstParagraph + ' ' + rawText.slice(0, 1000)).toLowerCase();
      const matchedTerms = h1Terms.filter(t => contentLower.includes(t));
      const resilienceScore = h1Terms.length > 0 ? Math.round((matchedTerms.length / h1Terms.length) * 100) : 0;
      const llmSummary = parsedAnalysis.summary_resilience?.llmSummary;
      const autoSummary = firstParagraph.slice(0, 80).replace(/[.!?,;:]+$/, '').trim() || 'Non disponible';
      parsedAnalysis.summary_resilience = { score: parsedAnalysis.summary_resilience?.score || resilienceScore, originalH1, llmSummary: llmSummary || autoSummary };
    }

    // ═══ CHUNKABILITY & FAN-OUT (content pages only) ═══
    if (isContentMode && pageContentContext) {
      const rawText = (pageContentContext || '').replace(/Titre="[^"]*"/g, '').replace(/H1="[^"]*"/g, '').replace(/Desc="[^"]*"/g, '');
      const paragraphs = rawText.split(/\n+/).filter(p => p.trim().length > 30);
      const avgLen = paragraphs.length > 0 ? Math.round(paragraphs.reduce((s, p) => s + p.split(/\s+/).length, 0) / paragraphs.length) : 0;
      const hasToc = /sommaire|table.?des.?mati[eè]res|table.?of.?contents|<nav[^>]*id="?toc/i.test(pageContentContext);
      const h2Count = (pageContentContext.match(/H2="/g) || []).length;
      const h3Count = (pageContentContext.match(/H3="/g) || []).length;
      const hasClearSections = h2Count >= 2 || (h2Count >= 1 && h3Count >= 2);
      let chunkScore = 0;
      if (paragraphs.length >= 5) chunkScore += 25; else if (paragraphs.length >= 3) chunkScore += 15;
      if (avgLen >= 30 && avgLen <= 150) chunkScore += 25; else if (avgLen >= 15) chunkScore += 15;
      if (hasToc) chunkScore += 20;
      if (hasClearSections) chunkScore += 20;
      if (h2Count >= 3) chunkScore += 10; else if (h2Count >= 2) chunkScore += 5;
      chunkScore = Math.min(100, chunkScore);
      const chunkExplanation = chunkScore >= 70
        ? 'Ce contenu est bien structuré pour être découpé et cité par les moteurs IA (RAG). Les sections sont claires et les paragraphes de taille adaptée.'
        : chunkScore >= 40
        ? 'La structure du contenu est partiellement adaptée au découpage IA. Ajoutez un sommaire et des sous-titres plus réguliers pour améliorer la chunkabilité.'
        : 'Ce contenu manque de structure pour les moteurs RAG. Ajoutez des H2/H3, un sommaire, et découpez les longs blocs de texte en paragraphes de 50-100 mots.';
      parsedAnalysis.chunkability_score = { score: chunkScore, paragraphs: paragraphs.length, avg_paragraph_length: avgLen, has_toc: hasToc, has_clear_sections: hasClearSections, explanation: chunkExplanation };

      // Fan-out score: cross-reference DataForSEO keywords with page content
      const contentLower = rawText.toLowerCase();
      const allKeywords: { keyword: string; volume: number; covered: boolean }[] = [];
      const seen = new Set<string>();
      const addKw = (kw: string, vol: number) => {
        const norm = kw.toLowerCase().trim();
        if (norm.length < 3 || seen.has(norm)) return;
        seen.add(norm);
        const terms = norm.split(/\s+/).filter(w => w.length > 2);
        const covered = terms.length > 0 && terms.filter(t => contentLower.includes(t)).length >= Math.ceil(terms.length * 0.6);
        allKeywords.push({ keyword: kw, volume: vol, covered });
      };
      // Pull from marketData (top_keywords from DataForSEO)
      if (marketData?.top_keywords) for (const k of marketData.top_keywords) addKw(k.keyword, k.volume);
      // Pull from rankingOverview (already ranked keywords)
      if (rankingOverview?.top_keywords) for (const k of rankingOverview.top_keywords) addKw(k.keyword, k.volume);
      // Sort by volume descending, keep top 15 as "potential axes"
      allKeywords.sort((a, b) => b.volume - a.volume);
      const axes = allKeywords.slice(0, 15);
      const coveredAxes = axes.filter(a => a.covered).length;
      const totalAxes = axes.length;
      const missingAxes = axes.filter(a => !a.covered).slice(0, 5);
      const fanOutPct = totalAxes > 0 ? (coveredAxes / totalAxes) * 100 : 50;
      const fanOutScore = Math.min(100, Math.round(fanOutPct));
      const recommendations = missingAxes.map(a => ({ keyword: a.keyword, volume: a.volume }));
      const fanOutExplanation = fanOutScore >= 70
        ? `Cette page couvre ${coveredAxes}/${totalAxes} requêtes associées identifiées par DataForSEO. Les moteurs RAG trouveront suffisamment de matière pour citer cette page sur plusieurs angles.`
        : fanOutScore >= 40
        ? `Couverture partielle : ${coveredAxes}/${totalAxes} axes couverts. ${missingAxes.length} requêtes à fort volume ne sont pas traitées dans le contenu. Ajoutez des sections dédiées pour capter ces sous-requêtes RAG.`
        : `Couverture faible : seulement ${coveredAxes}/${totalAxes} axes couverts. Cette page ne répond qu'à un angle limité. Les moteurs IA décomposeront la requête en sous-questions et iront chercher les réponses chez vos concurrents.`;
      parsedAnalysis.fan_out_score = { score: fanOutScore, detected_axes: totalAxes, covered_axes: coveredAxes, total_potential_axes: totalAxes, explanation: fanOutExplanation, recommendations, missing_keywords: missingAxes.map(a => a.keyword) };
    }

    if (!parsedAnalysis.lexical_footprint) parsedAnalysis.lexical_footprint = { jargonRatio: 50, concreteRatio: 50 };
    if (!parsedAnalysis.expertise_sentiment) parsedAnalysis.expertise_sentiment = { rating: 1, justification: 'Non évalué' };
    if (!parsedAnalysis.red_teaming) parsedAnalysis.red_teaming = { objections: [] };

    // ═══ JARGON DISTANCE ═══
    let jargonDistance: any = null;
    if (parsedAnalysis.client_targets && pageContentContext && !isOverDeadline()) {
      try {
        console.log('🔤 Computing jargon distance...');
        const ct = parsedAnalysis.client_targets;
        const jargonPrompt = `Tu es un expert en linguistique appliquée au marketing. Analyse la DISTANCE SÉMANTIQUE entre le vocabulaire utilisé par ce contenu et le niveau de compréhension de chaque cible.

CONTENU ANALYSÉ:
${pageContentContext}
${(parsedAnalysis.lexical_footprint?.jargonRatio != null) ? `Ratio jargon brut détecté: ${parsedAnalysis.lexical_footprint.jargonRatio}%` : ''}

CIBLE PRIMAIRE: ${ct.primary?.[0] ? JSON.stringify(ct.primary[0]) : 'Non détecté'}
CIBLE SECONDAIRE: ${ct.secondary?.[0] ? JSON.stringify(ct.secondary[0]) : 'Non détecté'}
CIBLE POTENTIELLE: ${ct.untapped?.[0] ? JSON.stringify(ct.untapped[0]) : 'Non détecté'}

RÈGLE CRITIQUE: Le "jargon" est RELATIF. Un terme technique n'est du jargon QUE s'il dépasse le niveau de compréhension de la cible.

Pour chaque cible, évalue:
- distance: score 0-100
- qualifier: "Adapté" (<25) | "Accessible" (25-45) | "Spécialisé" (45-65) | "Très distant" (65-85) | "Opaque" (>85)
- terms_causing_distance: 3-5 termes
- confidence: 0-1

Évalue aussi: tone_consistency (0-1) et tone_assertive_ratio (0-1).

Réponds en JSON STRICT:
{"primary":{"distance":0,"qualifier":"...","terms_causing_distance":["..."],"confidence":0.0},"secondary":{...},"untapped":{...},"tone_consistency":0.0,"tone_assertive_ratio":0.0}`;

        const jargonResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST', headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages: [{ role: 'user', content: jargonPrompt }], temperature: 0.3 }),
        });

        if (jargonResp.ok) {
          const jargonResult = await jargonResp.json();
          const jargonText = jargonResult.choices?.[0]?.message?.content || '';
          const jargonJson = jargonText.replace(/```json\s*/g, '').replace(/```/g, '').trim();
          try {
            const jp = JSON.parse(jargonJson);
            const cta = ctaSeoSignalsForJargon;
            const ctaScore = Math.min(1, (cta.ctaAggressive ? 0.6 : 0) + (cta.ctaCount >= 3 ? 0.2 : cta.ctaCount >= 1 ? 0.1 : 0) + (cta.ctaTypes.filter(t => t !== 'generic').length >= 2 ? 0.2 : 0));
            const primaryTerms = jp.primary?.terms_causing_distance || [];
            const balisesJoined = (cta.seoTermsInBalises || []).join(' ');
            const termsInBalises = primaryTerms.filter((t: string) => balisesJoined.includes(t.toLowerCase())).length;
            const seoAlignment = primaryTerms.length > 0 ? Math.min(1, termsInBalises / Math.max(1, primaryTerms.length)) : 0.5;
            const toneAssertive = jp.tone_assertive_ratio ?? 0.5;
            const toneConsistency = jp.tone_consistency ?? 0.5;
            const intentionalityScore = (ctaScore * 0.30) + (seoAlignment * 0.30) + (toneAssertive * 0.20) + (toneConsistency * 0.20);
            const intentionalityLabel = intentionalityScore > 0.65 ? 'Spécialisation assumée' : intentionalityScore > 0.35 ? 'Positionnement ambigu' : 'Distance non maîtrisée';

            jargonDistance = { primary: jp.primary, secondary: jp.secondary, untapped: jp.untapped, intentionality: { score: Math.round(intentionalityScore * 100) / 100, label: intentionalityLabel, components: { cta_aggressiveness: Math.round(ctaScore * 100) / 100, seo_pattern_alignment: Math.round(seoAlignment * 100) / 100, tone_assertiveness: Math.round(toneAssertive * 100) / 100, structural_consistency: Math.round(toneConsistency * 100) / 100 } } };
            parsedAnalysis.lexical_footprint = { ...parsedAnalysis.lexical_footprint, jargon_distance: jargonDistance };
            console.log(`✅ Jargon distance: primary=${jp.primary?.distance}, intentionality=${intentionalityScore.toFixed(2)} (${intentionalityLabel})`);
          } catch (parseErr) { console.warn('⚠️ Jargon distance JSON parse failed:', parseErr); }
        }
      } catch (e) { console.warn('⚠️ Jargon distance computation failed:', e); }
    }

    // ═══ BUILD FINAL RESULT ═══
    const result = { success: true, data: { url, domain, scannedAt: new Date().toISOString(), isContentMode, pageType, ...parsedAnalysis, raw_market_data: marketData, ranking_overview: rankingOverview, google_my_business: gmbData, toolsData: null, llm_visibility_raw: effectiveToolsData.llm, _cachedContext: cachedContextOut } };
    console.log(`✅ AUDIT TERMINÉ (${((Date.now() - startTime) / 1000).toFixed(1)}s)`);

    // ═══ SAVE & RETURN (fire-and-forget) ═══
    saveToCache(domain, url, result).catch(() => {});

    const authHeader = req.headers.get('Authorization') || '';
    if (authHeader) {
      saveStrategicRecommendationsToRegistry(authHeader, domain, url, parsedAnalysis).catch(err => console.error('Registre:', err));
      feedKeywordUniverse(authHeader, domain, parsedAnalysis).catch(() => {});
      try {
        const sb2 = getUserClient(authHeader);
        const { data: { user: rawUser } } = await sb2.auth.getUser();
        if (rawUser) saveRawAuditData({ userId: rawUser.id, url, domain, auditType: 'strategic', rawPayload: result.data, sourceFunctions: ['audit-strategique-ia'] }).catch(() => {});
      } catch {}

      // ═══ WORKBENCH: Chunkability & Fan-Out findings ═══
      try {
        const sb3 = getUserClient(authHeader);
        const { data: { user: wbUser } } = await sb3.auth.getUser();
        if (wbUser && isContentMode) {
          const { data: siteRow } = await getServiceClient().from('tracked_sites').select('id').eq('user_id', wbUser.id).ilike('domain', `%${domain.replace(/^www\./, '')}%`).limit(1).maybeSingle();
          const trackedId = siteRow?.id || null;
          const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
          const wbItems: any[] = [];

          // Chunkability finding
          if (parsedAnalysis.chunkability_score && parsedAnalysis.chunkability_score.score < 50) {
            const cs = parsedAnalysis.chunkability_score;
            wbItems.push({
              tracked_site_id: trackedId, user_id: wbUser.id, domain: cleanDomain,
              title: `Chunkability faible (${cs.score}/100) — contenu mal découpé pour les IA`,
              description: cs.explanation,
              finding_category: 'structure_rag', source_type: 'audit' as const,
              source_function: 'audit-strategique-ia', source_record_id: `chunk_${cleanDomain}_${url.replace(/[^a-z0-9]/gi, '_').slice(0, 60)}`,
              severity: cs.score < 30 ? 'danger' : 'warning', status: 'pending' as const,
              target_url: url,
              payload: { auto_generated: true, chunkability_score: cs.score, paragraphs: cs.paragraphs, avg_length: cs.avg_paragraph_length, has_toc: cs.has_toc, has_sections: cs.has_clear_sections },
            });
          }

          // Fan-out missing keywords → one finding per keyword
          if (parsedAnalysis.fan_out_score?.recommendations?.length > 0) {
            for (const rec of parsedAnalysis.fan_out_score.recommendations.slice(0, 5)) {
              const kwSlug = rec.keyword.replace(/[^a-z0-9]/gi, '_').slice(0, 40);
              wbItems.push({
                tracked_site_id: trackedId, user_id: wbUser.id, domain: cleanDomain,
                title: `Fan-out manquant : "${rec.keyword}" (${rec.volume.toLocaleString()} vol/mois)`,
                description: `Cette requête à fort volume n'est pas couverte dans le contenu de la page. Ajoutez une section H2 dédiée pour capter ce sous-angle RAG.`,
                finding_category: 'content_gap_fanout', source_type: 'audit' as const,
                source_function: 'audit-strategique-ia', source_record_id: `fanout_${kwSlug}_${cleanDomain}`,
                severity: rec.volume >= 1000 ? 'danger' : 'warning', status: 'pending' as const,
                target_url: url,
                payload: { auto_generated: true, keyword: rec.keyword, volume: rec.volume, fan_out_score: parsedAnalysis.fan_out_score.score },
              });
            }
          }

          if (wbItems.length > 0) {
            const { error: wbErr } = await getServiceClient().from('architect_workbench').upsert(wbItems, { onConflict: 'source_type,source_record_id', ignoreDuplicates: true });
            if (wbErr) console.warn('⚠️ Workbench upsert error:', wbErr.message);
            else console.log(`✅ Workbench: ${wbItems.length} findings (chunkability + fan-out)`);
          }
        }
      } catch (wbErr) { console.warn('⚠️ Workbench persistence failed:', wbErr); }
    }
    trackAnalyzedUrl(url).catch(() => {});
    persistIdentityData(domain, parsedAnalysis, jargonDistance, businessModelDetectionRef).catch(() => {});

    if (jobSb && jobId) await jobSb.from('async_jobs').update({ status: 'completed', result_data: result.data, progress: 100, completed_at: new Date().toISOString() }).eq('id', jobId);
    return json(result);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    await trackEdgeFunctionError('audit-strategique-ia', error instanceof Error ? error.message : 'Fatal error').catch(() => {});
    if (jobSb && jobId) await jobSb.from('async_jobs').update({ status: 'failed', error_message: error instanceof Error ? error.message : 'Unknown error', completed_at: new Date().toISOString() }).eq('id', jobId).catch(() => {});
    return json({ success: true, data: { url: '', domain: '', scannedAt: new Date().toISOString(), overallScore: 0, introduction: { presentation: 'Une erreur inattendue est survenue. Veuillez relancer l\'analyse.', strengths: '', improvement: '', competitors: [] }, executive_roadmap: [], executive_summary: 'Analyse interrompue. Veuillez réessayer.', _error: error instanceof Error ? error.message : 'Unknown error' } });
  } finally {
    releaseConcurrency('audit-strategique-ia');
  }
}, 'audit-strategique-ia'));
