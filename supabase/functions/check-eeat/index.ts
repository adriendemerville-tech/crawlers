import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { preCrawlForAudit, formatPreCrawlForPrompt } from '../_shared/preCrawlForAudit.ts';
import { resolveGoogleToken } from '../_shared/resolveGoogleToken.ts';

const HEADERS = { ...corsHeaders, 'Content-Type': 'application/json' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // ── Polling mode ──
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const jobId = url.searchParams.get('job_id');
    if (!jobId) return new Response(JSON.stringify({ error: 'job_id required' }), { status: 400, headers: HEADERS });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data: job } = await supabase
      .from('async_jobs')
      .select('status, progress, result_data, error_message')
      .eq('id', jobId)
      .maybeSingle();

    if (!job) return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers: HEADERS });

    return new Response(JSON.stringify({
      status: job.status,
      progress: job.progress,
      result: job.status === 'completed' ? job.result_data : null,
      error: job.error_message,
    }), { headers: HEADERS });
  }

  try {
    const body = await req.json();
    const { url, async: isAsync, _job_id, tracked_site_id, forceCrawl, _user_id } = body;

    if (!url) return new Response(JSON.stringify({ error: 'URL required' }), { status: 400, headers: HEADERS });

    const targetUrl = url.startsWith('http') ? url : `https://${url}`;
    const domain = new URL(targetUrl).hostname
      .replace(/^www\./, '')
      .toLowerCase();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── Self-invocation (background worker) ──
    if (_job_id) {
      console.log(`[check-eeat] 🔧 Worker started for job ${_job_id}`);
      try {
        await supabase.from('async_jobs').update({ status: 'processing', started_at: new Date().toISOString(), progress: 5 }).eq('id', _job_id);

        // Resolve userId from the job record for GA4 access
        const { data: jobRecord } = await supabase.from('async_jobs').select('user_id').eq('id', _job_id).maybeSingle();
        const workerUserId = _user_id || jobRecord?.user_id || null;

        const result = await runEeatPipeline(supabase, domain, targetUrl, tracked_site_id, jobId, !!forceCrawl, workerUserId);

        await supabase.from('async_jobs').update({
          status: 'completed',
          progress: 100,
          result_data: result,
          completed_at: new Date().toISOString(),
        }).eq('id', _job_id);

        console.log(`[check-eeat] ✅ Job ${_job_id} completed — score: ${result.score}`);
      } catch (e) {
        console.error(`[check-eeat] ❌ Job ${_job_id} failed:`, e);
        await supabase.from('async_jobs').update({
          status: 'failed',
          error_message: e instanceof Error ? e.message : String(e),
          completed_at: new Date().toISOString(),
        }).eq('id', _job_id);
      }
      return new Response(JSON.stringify({ ok: true }), { headers: HEADERS });
    }

    // ── Async mode: create job + fire-and-forget ──
    if (isAsync) {
      // Get user from auth header
      const authHeader = req.headers.get('authorization') || '';
      const token = authHeader.replace('Bearer ', '');
      let userId = 'anonymous';
      if (token) {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) userId = user.id;
      }

      // ── Fair use check ──
      if (userId !== 'anonymous') {
        const fairUseResult = await checkEeatFairUse(supabase, userId);
        if (!fairUseResult.allowed) {
          return new Response(JSON.stringify({
            error: 'Fair use limit reached',
            reason: fairUseResult.reason,
            monthly_count: fairUseResult.monthly_count,
            monthly_limit: fairUseResult.monthly_limit,
            resets_at: fairUseResult.resets_at,
          }), { status: 429, headers: HEADERS });
        }
      }

      const { data: job, error: jobErr } = await supabase.from('async_jobs').insert({
        function_name: 'check-eeat',
        user_id: userId,
        input_payload: { url, tracked_site_id, forceCrawl },
        status: 'pending',
        progress: 0,
      }).select('id').single();

      if (jobErr || !job) {
        return new Response(JSON.stringify({ error: 'Failed to create job' }), { status: 500, headers: HEADERS });
      }

      // Self-invoke (fire-and-forget)
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      fetch(`${supabaseUrl}/functions/v1/check-eeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ url, _job_id: job.id, tracked_site_id, forceCrawl, _user_id: userId }),
      }).catch(e => console.error('[check-eeat] Self-invoke error:', e));

      return new Response(JSON.stringify({
        job_id: job.id,
        status: 'pending',
      }), { status: 202, headers: HEADERS });
    }

    // ── Synchronous mode (fallback for simple calls) ──
    const result = await runEeatPipeline(supabase, domain, targetUrl, tracked_site_id, null, !!forceCrawl, null);
    return new Response(JSON.stringify(result), { headers: HEADERS });

  } catch (e) {
    console.error('[check-eeat]', e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e), score: 0 }), { status: 500, headers: HEADERS });
  }
});

// ══════════════════════════════════════════════════════
// Fair use check for E-E-A-T audits
// ══════════════════════════════════════════════════════
async function checkEeatFairUse(supabase: any, userId: string) {
  // Check if admin
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();
  
  if (roleData) return { allowed: true, is_admin: true };

  // Get user plan
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan_type')
    .eq('user_id', userId)
    .maybeSingle();

  const planType = profile?.plan_type || 'free';
  
  // Determine limit based on plan
  let monthlyLimit: number;
  if (planType === 'agency_pro_plus') {
    monthlyLimit = 20;
  } else if (planType === 'agency_pro') {
    monthlyLimit = 15;
  } else {
    monthlyLimit = 3; // Free tier: very limited
  }

  // Use check_monthly_fair_use DB function
  const { data: fairUse } = await supabase.rpc('check_monthly_fair_use', {
    p_user_id: userId,
    p_action: 'eeat_audit',
    p_monthly_limit: monthlyLimit,
  });

  return fairUse || { allowed: true };
}

// ══════════════════════════════════════════════════════
// Pipeline principal E-E-A-T multi-pages enrichi
// ══════════════════════════════════════════════════════
async function runEeatPipeline(
  supabase: any,
  domain: string,
  targetUrl: string,
  trackedSiteId: string | null,
  jobId: string | null,
  forceCrawl: boolean = false,
  userId: string | null = null
): Promise<any> {

  // ── Phase 0: Auto-correct domain if DNS fails ──
  const correctedDomain = await autoCorrectDomain(domain);
  if (correctedDomain !== domain) {
    console.log(`[check-eeat] 🔧 Domain auto-corrected: ${domain} → ${correctedDomain}`);
  }
  const effectiveDomain = correctedDomain;

  // ── Phase 1: Pré-crawl multi-pages ──
  console.log(`[check-eeat] 🕷️ Phase 1: Pre-crawl for ${effectiveDomain}...`);
  if (jobId) await supabase.from('async_jobs').update({ progress: 10 }).eq('id', jobId);

  let preCrawlResult = await preCrawlForAudit(supabase, effectiveDomain, trackedSiteId, null, { skipCache: !!forceCrawl });
  
  // If no pages crawled, try with www. prefix as fallback
  if (preCrawlResult.pages.length === 0) {
    console.log(`[check-eeat] ⚠️ 0 pages crawled for ${effectiveDomain}, retrying with www.${effectiveDomain}...`);
    preCrawlResult = await preCrawlForAudit(supabase, `www.${effectiveDomain}`, trackedSiteId, null, { skipCache: !!forceCrawl });
  }

  const pagesContext = formatPreCrawlForPrompt(preCrawlResult);
  const pagesCount = preCrawlResult.pages.length;

  // If still 0 pages, return a clear error instead of a misleading 0-score report
  if (pagesCount === 0) {
    console.error(`[check-eeat] ❌ No pages could be crawled for ${effectiveDomain}`);
    return {
      success: false,
      error: `Impossible de crawler le domaine "${domain}". Vérifiez que le domaine est correct et accessible.`,
      score: 0,
      crawlInfo: { pagesAnalyzed: 0, source: 'intermediate', crawledAt: new Date().toISOString() },
    };
  }

  console.log(`[check-eeat] 📄 ${pagesCount} pages crawled (source: ${preCrawlResult.source})`);
  if (jobId) await supabase.from('async_jobs').update({ progress: 30 }).eq('id', jobId);

  // ── Phase 2: Aggregate structural signals ──
  const aggregated = aggregateSignals(preCrawlResult.pages, preCrawlResult.sitemapUrls);

  if (jobId) await supabase.from('async_jobs').update({ progress: 35 }).eq('id', jobId);

  // ── Phase 2.5: Fetch backlinks data from DataForSEO ──
  console.log(`[check-eeat] 🔗 Phase 2.5: Fetching backlinks for ${domain}...`);
  const backlinkData = await fetchBacklinkData(domain);
  if (jobId) await supabase.from('async_jobs').update({ progress: 45 }).eq('id', jobId);

  // ── Phase 2.6: Fetch GBP data if connected ──
  console.log(`[check-eeat] 📍 Phase 2.6: Checking GBP connection...`);
  const gbpData = await fetchGbpData(supabase, domain, trackedSiteId);
  if (jobId) await supabase.from('async_jobs').update({ progress: 50 }).eq('id', jobId);

  // ── Phase 3: LLM analysis with enriched context ──
  console.log(`[check-eeat] 🤖 Phase 3: LLM analysis...`);
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    return { success: false, error: 'LOVABLE_API_KEY not configured', score: 0 };
  }

  // Build enriched prompt sections
  const backlinkSection = backlinkData.available ? `
═══ DONNÉES BACKLINKS RÉELLES (DataForSEO) ═══
- Domaines référents: ${backlinkData.referringDomains}
- Backlinks totaux: ${backlinkData.backlinksTotal}
- Domain Rank: ${backlinkData.domainRank}/100
- IPs référentes: ${backlinkData.referringIps}
- Sous-réseaux référents: ${backlinkData.referringSubnets}
- Top ancres: ${backlinkData.anchorDistribution?.map((a: any) => `"${a.anchor}" (${a.backlinks} liens)`).join(', ') || 'N/A'}
IMPORTANT: Utilise ces données RÉELLES pour scorer l'Authoritativeness. Ne devine pas, base-toi sur ces chiffres.` : `
═══ BACKLINKS ═══
Données backlinks non disponibles. Score l'Authoritativeness uniquement sur les signaux structurels du crawl.`;

  const gbpSection = gbpData.available ? `
═══ DONNÉES GOOGLE BUSINESS PROFILE (réelles) ═══
- Note moyenne: ${gbpData.avgRating}/5 (${gbpData.totalReviews} avis)
- Catégorie GBP: ${gbpData.category || 'Non spécifiée'}
- Nom de l'établissement: ${gbpData.locationName || 'N/A'}
${gbpData.recentReviews?.length ? `- Derniers avis: ${gbpData.recentReviews.map((r: any) => `★${r.rating} "${r.comment?.substring(0, 80)}..."`).join(' | ')}` : ''}
IMPORTANT: Utilise ces avis RÉELS pour scorer Experience et Trustworthiness.` : '';

  const llmResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{
        role: 'user',
        content: `Tu es un expert E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) selon les Quality Rater Guidelines de Google.

Évalue les signaux E-E-A-T de ce site web à partir de ${pagesCount} pages crawlées${backlinkData.available ? ', de données backlinks réelles' : ''}${gbpData.available ? ' et de données Google Business Profile réelles' : ''}.

Domaine: ${domain}
URL analysée: ${targetUrl}
Nombre de pages crawlées: ${pagesCount} (source: ${preCrawlResult.source === 'cache' ? 'crawl complet récent' : 'crawl intermédiaire'})

═══ SIGNAUX STRUCTURELS AGRÉGÉS ═══
- Pages avec auteur identifié: ${aggregated.pagesWithAuthor}/${pagesCount}
- Pages avec Schema.org: ${aggregated.pagesWithSchema}/${pagesCount} (types: ${aggregated.schemaTypes.join(', ') || 'aucun'})
- Pages avec balise noindex: ${aggregated.noindexCount}
- Mots total (toutes pages): ${aggregated.totalWords}
- Mots moyens par page: ${aggregated.avgWords}
- Liens internes moyens par page: ${aggregated.avgInternalLinks}
- Liens externes moyens par page: ${aggregated.avgExternalLinks}
- Page À propos détectée: ${aggregated.hasAboutPage ? 'Oui' : 'Non'}
- Page Contact détectée: ${aggregated.hasContactPage ? 'Oui' : 'Non'}
- Mentions légales détectées: ${aggregated.hasLegalPage ? 'Oui' : 'Non'}
- Page CGV/CGU détectée: ${aggregated.hasTermsPage ? 'Oui' : 'Non'}
- Blog/actualités détecté: ${aggregated.hasBlogSection ? 'Oui' : 'Non'}
- Témoignages/avis détectés: ${aggregated.hasTestimonials ? 'Oui' : 'Non'}
- HTTPS: ${aggregated.isHttps ? 'Oui' : 'Non'}
- URLs totales dans le sitemap: ${preCrawlResult.totalSitemapUrls}

═══ RICHESSE SCHEMA.ORG ═══
- Blocs JSON-LD détectés: ${aggregated.schemaRichness.totalBlocks}
- Types uniques: ${aggregated.schemaRichness.uniqueTypes.join(', ') || 'aucun'}
- Utilise @graph: ${aggregated.schemaRichness.hasGraph ? 'Oui' : 'Non'}
- Champs totaux: ${aggregated.schemaRichness.totalFields}
- Profondeur max: ${aggregated.schemaRichness.maxDepth}
- sameAs (liens sociaux/identité): ${aggregated.schemaRichness.hasSameAs ? 'Oui' : 'Non'}
- Auteur dans JSON-LD: ${aggregated.schemaRichness.hasAuthorInJsonLd ? 'Oui' : 'Non'}
- Entités détectées:
  • Organization: ${aggregated.schemaRichness.entities.hasOrganization ? '✓' : '✗'}
  • LocalBusiness: ${aggregated.schemaRichness.entities.hasLocalBusiness ? '✓' : '✗'}
  • Person: ${aggregated.schemaRichness.entities.hasPerson ? '✓' : '✗'}
  • WebSite: ${aggregated.schemaRichness.entities.hasWebSite ? '✓' : '✗'}
  • Article/BlogPosting: ${aggregated.schemaRichness.entities.hasArticle ? '✓' : '✗'}
  • FAQPage: ${aggregated.schemaRichness.entities.hasFAQPage ? '✓' : '✗'}
  • Product: ${aggregated.schemaRichness.entities.hasProduct ? '✓' : '✗'}
  • BreadcrumbList: ${aggregated.schemaRichness.entities.hasBreadcrumb ? '✓' : '✗'}
  • Review: ${aggregated.schemaRichness.entities.hasReview ? '✓' : '✗'}

IMPORTANT: Les détections de pages (À propos, Contact, Mentions légales, CGV/CGU, Blog, Témoignages) sont basées sur l'analyse combinée des ${pagesCount} pages crawlées ET des ${preCrawlResult.totalSitemapUrls} URLs du sitemap. Si un signal est marqué "Oui", la page EXISTE — ne le signale PAS comme manquant.
IMPORTANT: Si des entités Schema.org sont marquées ✓, elles EXISTENT — valorise-les dans le score. Si sameAs ou auteur JSON-LD sont présents, c'est un signal E-E-A-T fort.
${backlinkSection}
${gbpSection}

${pagesContext}

═══ INSTRUCTIONS ═══
Analyse TOUS les signaux ci-dessus pour produire une évaluation E-E-A-T complète.
Prends en compte la cohérence entre les pages, la profondeur du contenu, la présence d'auteurs, les preuves d'expertise, et les signaux de confiance.
IMPORTANT: Analyse aussi le CONTENU des pages crawlées, pas seulement les patterns d'URL. Si l'info "À propos" ou "Auteur" est dans le corps de texte plutôt que dans une page dédiée, elle doit quand même être comptabilisée.

Réponds UNIQUEMENT en JSON valide :
{
  "experience": <0-100>,
  "expertise": <0-100>,
  "authoritativeness": <0-100>,
  "trustworthiness": <0-100>,
  "overall": <0-100>,
  "author_identified": <boolean>,
  "sources_cited": <boolean>,
  "expertise_demonstrated": <boolean>,
  "trust_signals": ["signal1", "signal2", ...],
  "missing_signals": ["missing1", "missing2", ...],
  "issues": ["issue1", ...],
  "strengths": ["strength1", ...],
  "recommendations": ["reco1", "reco2", ...]
}`,
      }],
      temperature: 0.2,
      max_tokens: 1500,
    }),
  });

  if (jobId) await supabase.from('async_jobs').update({ progress: 80 }).eq('id', jobId);

  if (!llmResp.ok) {
    const status = llmResp.status;
    await llmResp.text();
    if (status === 429) return { success: false, error: 'Rate limit exceeded', score: 0 };
    if (status === 402) return { success: false, error: 'Credits exhausted', score: 0 };
    return { success: false, error: 'LLM error', score: 0 };
  }

  const llmData = await llmResp.json();
  const content = llmData.choices?.[0]?.message?.content || '';

  let analysis: any = {};
  try {
    let jsonStr = content.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
    const first = jsonStr.indexOf('{');
    const last = jsonStr.lastIndexOf('}');
    if (first !== -1 && last > first) jsonStr = jsonStr.substring(first, last + 1);
    analysis = JSON.parse(jsonStr);
  } catch {
    analysis = {
      overall: 40, experience: 40, expertise: 40, authoritativeness: 40, trustworthiness: 40,
      issues: ['Unable to parse E-E-A-T analysis'],
    };
  }

  if (jobId) await supabase.from('async_jobs').update({ progress: 95 }).eq('id', jobId);

  return {
    success: true,
    score: analysis.overall ?? 40,
    experience: analysis.experience,
    expertise: analysis.expertise,
    authoritativeness: analysis.authoritativeness,
    trustworthiness: analysis.trustworthiness,
    signals: {
      authorIdentified: analysis.author_identified ?? aggregated.pagesWithAuthor > 0,
      sourcesCited: analysis.sources_cited ?? false,
      expertiseDemonstrated: analysis.expertise_demonstrated ?? false,
      aboutPage: aggregated.hasAboutPage,
      contactInfo: aggregated.hasContactPage,
      legalNotice: aggregated.hasLegalPage,
      schemaOrg: aggregated.pagesWithSchema > 0,
      schemaRichness: aggregated.schemaRichness,
      blogSection: aggregated.hasBlogSection,
      testimonials: aggregated.hasTestimonials,
    },
    trustSignals: analysis.trust_signals || [],
    missingSignals: analysis.missing_signals || [],
    issues: analysis.issues || [],
    strengths: analysis.strengths || [],
    recommendations: analysis.recommendations || [],
    // Backlink data enrichment
    backlinkData: backlinkData.available ? {
      referringDomains: backlinkData.referringDomains,
      backlinksTotal: backlinkData.backlinksTotal,
      domainRank: backlinkData.domainRank,
      referringIps: backlinkData.referringIps,
      referringSubnets: backlinkData.referringSubnets,
      anchorDistribution: backlinkData.anchorDistribution,
      referringPages: backlinkData.referringPages,
    } : null,
    // GBP data enrichment
    gbpData: gbpData.available ? {
      avgRating: gbpData.avgRating,
      totalReviews: gbpData.totalReviews,
      category: gbpData.category,
      locationName: gbpData.locationName,
    } : null,
    crawlInfo: {
      pagesAnalyzed: pagesCount,
      source: preCrawlResult.source,
      crawledAt: preCrawlResult.crawledAt,
      sitemapUrlsFound: preCrawlResult.totalSitemapUrls,
      crawledUrls: preCrawlResult.pages.map((p: any) => p.url).filter(Boolean),
    },
    dataSources: [
      'crawl_html',
      'llm_semantic',
      ...(backlinkData.available ? ['dataforseo_backlinks'] : []),
      ...(gbpData.available ? ['google_business_profile'] : []),
    ],
  };
}

// ══════════════════════════════════════════════════════
// Fetch real backlink data from DataForSEO
// ══════════════════════════════════════════════════════
async function fetchBacklinkData(domain: string): Promise<any> {
  const login = Deno.env.get('DATAFORSEO_LOGIN');
  const password = Deno.env.get('DATAFORSEO_PASSWORD');
  if (!login || !password) {
    console.log('[check-eeat] ⚠️ DataForSEO credentials not configured, skipping backlinks');
    return { available: false, reason: 'credentials_missing' };
  }

  try {
    const auth = btoa(`${login}:${password}`);

    // Fetch summary
    const summaryResp = await fetch('https://api.dataforseo.com/v3/backlinks/summary/live', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([{ target: domain, internal_list_limit: 0, backlinks_filters: ['dofollow', '=', 'true'] }]),
    });

    const summaryData = await summaryResp.json();
    const result = summaryData?.tasks?.[0]?.result?.[0];

    if (!result) {
      return { available: false, reason: 'no_data' };
    }

    // Fetch anchors
    let anchorDistribution: any[] = [];
    try {
      const anchorResp = await fetch('https://api.dataforseo.com/v3/backlinks/anchors/live', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([{ target: domain, limit: 10, order_by: ['backlinks,desc'] }]),
      });
      const anchorData = await anchorResp.json();
      anchorDistribution = (anchorData?.tasks?.[0]?.result?.[0]?.items || []).map((a: any) => ({
        anchor: a.anchor,
        backlinks: a.backlinks,
        domains: a.referring_domains,
      }));
    } catch { /* non-critical */ }

    // Fetch top referring pages (individual backlink URLs)
    let referringPages: any[] = [];
    try {
      const blResp = await fetch('https://api.dataforseo.com/v3/backlinks/backlinks/live', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          target: domain,
          limit: 20,
          order_by: ['rank,desc'],
          filters: ['dofollow', '=', 'true'],
        }]),
      });
      const blData = await blResp.json();
      referringPages = (blData?.tasks?.[0]?.result?.[0]?.items || []).map((b: any) => ({
        sourceUrl: b.url_from || '',
        targetUrl: b.url_to || '',
        anchor: b.anchor || '',
        rank: b.rank || 0,
        dofollow: b.dofollow ?? true,
        firstSeen: b.first_seen || null,
      }));
      console.log(`[check-eeat] 🔗 Fetched ${referringPages.length} individual backlinks`);
    } catch (e) {
      console.warn('[check-eeat] Backlink list fetch error:', e);
    }

    console.log(`[check-eeat] 🔗 Backlinks: ${result.referring_domains || 0} referring domains, rank ${result.rank || 0}`);

    return {
      available: true,
      referringDomains: result.referring_domains || 0,
      backlinksTotal: result.backlinks || 0,
      domainRank: result.rank || 0,
      referringIps: result.referring_ips || 0,
      referringSubnets: result.referring_subnets || 0,
      anchorDistribution,
      referringPages,
    };
  } catch (e) {
    console.error('[check-eeat] Backlink fetch error:', e);
    return { available: false, reason: 'fetch_error' };
  }
}

// ══════════════════════════════════════════════════════
// Fetch GBP data if user has connected Google Business
// ══════════════════════════════════════════════════════
async function fetchGbpData(supabase: any, domain: string, trackedSiteId: string | null): Promise<any> {
  if (!trackedSiteId) {
    return { available: false, reason: 'no_tracked_site' };
  }

  try {
    // Find the tracked site's google connection with GBP scope
    const { data: site } = await supabase
      .from('tracked_sites')
      .select('user_id, google_connection_id')
      .eq('id', trackedSiteId)
      .maybeSingle();

    if (!site?.google_connection_id) {
      return { available: false, reason: 'no_google_connection' };
    }

    // Find GBP-specific connection (prefixed with "gbp:")
    const { data: gbpConn } = await supabase
      .from('google_connections')
      .select('access_token, refresh_token, token_expiry, gmb_account_id, gmb_location_id, google_email')
      .eq('user_id', site.user_id)
      .like('google_email', 'gbp:%')
      .maybeSingle();

    if (!gbpConn || !gbpConn.gmb_account_id || !gbpConn.gmb_location_id) {
      return { available: false, reason: 'gbp_not_connected' };
    }

    // Check token freshness & refresh if needed
    let accessToken = gbpConn.access_token;
    if (gbpConn.token_expiry && new Date(gbpConn.token_expiry) < new Date()) {
      const refreshed = await refreshGbpToken(supabase, gbpConn, site.user_id);
      if (refreshed) accessToken = refreshed;
      else return { available: false, reason: 'token_refresh_failed' };
    }

    // Fetch reviews
    const accountId = gbpConn.gmb_account_id;
    const locationId = gbpConn.gmb_location_id;
    
    const reviewsResp = await fetch(
      `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews?pageSize=10`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!reviewsResp.ok) {
      console.warn(`[check-eeat] GBP reviews fetch failed: ${reviewsResp.status}`);
      return { available: false, reason: 'api_error' };
    }

    const reviewsData = await reviewsResp.json();
    const reviews = reviewsData.reviews || [];
    const totalReviews = reviewsData.totalReviewCount || reviews.length;
    const avgRating = reviewsData.averageRating || (reviews.length > 0 
      ? reviews.reduce((s: number, r: any) => s + (ratingToNumber(r.starRating) || 0), 0) / reviews.length 
      : 0);

    // Fetch location details for category
    const locResp = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${accountId}/locations/${locationId}?readMask=title,categories`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    let category = '';
    let locationName = '';
    if (locResp.ok) {
      const locData = await locResp.json();
      locationName = locData.title || '';
      category = locData.categories?.primaryCategory?.displayName || '';
    }

    console.log(`[check-eeat] 📍 GBP: ${avgRating}★ (${totalReviews} avis), category: ${category}`);

    return {
      available: true,
      avgRating: Math.round(avgRating * 10) / 10,
      totalReviews,
      category,
      locationName,
      recentReviews: reviews.slice(0, 5).map((r: any) => ({
        rating: ratingToNumber(r.starRating),
        comment: r.comment || '',
      })),
    };
  } catch (e) {
    console.error('[check-eeat] GBP fetch error:', e);
    return { available: false, reason: 'error' };
  }
}

function ratingToNumber(starRating: string): number {
  const map: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  return map[starRating] || 0;
}

async function refreshGbpToken(supabase: any, conn: any, userId: string): Promise<string | null> {
  if (!conn.refresh_token) return null;
  const clientId = Deno.env.get('GOOGLE_GSC_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_GSC_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;

  try {
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: conn.refresh_token,
        grant_type: 'refresh_token',
      }),
    });
    if (!resp.ok) return null;
    const tokens = await resp.json();
    const newExpiry = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

    await supabase.from('google_connections').update({
      access_token: tokens.access_token,
      token_expiry: newExpiry,
    }).eq('user_id', userId).like('google_email', 'gbp:%');

    return tokens.access_token;
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════
// Aggregation des signaux sur N pages
// ══════════════════════════════════════════════════════
interface SchemaRichness {
  totalBlocks: number;
  uniqueTypes: string[];
  hasGraph: boolean;
  totalFields: number;
  maxDepth: number;
  hasSameAs: boolean;
  hasAuthorInJsonLd: boolean;
  entities: {
    hasOrganization: boolean;
    hasLocalBusiness: boolean;
    hasPerson: boolean;
    hasWebSite: boolean;
    hasArticle: boolean;
    hasFAQPage: boolean;
    hasProduct: boolean;
    hasBreadcrumb: boolean;
    hasReview: boolean;
  };
}

interface AggregatedSignals {
  pagesWithAuthor: number;
  pagesWithSchema: number;
  schemaTypes: string[];
  noindexCount: number;
  totalWords: number;
  avgWords: number;
  avgInternalLinks: number;
  avgExternalLinks: number;
  hasAboutPage: boolean;
  hasContactPage: boolean;
  hasLegalPage: boolean;
  hasTermsPage: boolean;
  hasBlogSection: boolean;
  hasTestimonials: boolean;
  isHttps: boolean;
  schemaRichness: SchemaRichness;
}

function aggregateSignals(pages: any[], sitemapUrls: string[] = []): AggregatedSignals {
  const schemaRichness: SchemaRichness = {
    totalBlocks: 0, uniqueTypes: [], hasGraph: false,
    totalFields: 0, maxDepth: 0, hasSameAs: false, hasAuthorInJsonLd: false,
    entities: {
      hasOrganization: false, hasLocalBusiness: false, hasPerson: false,
      hasWebSite: false, hasArticle: false, hasFAQPage: false,
      hasProduct: false, hasBreadcrumb: false, hasReview: false,
    },
  };

  if (!pages.length && !sitemapUrls.length) {
    return {
      pagesWithAuthor: 0, pagesWithSchema: 0, schemaTypes: [], noindexCount: 0,
      totalWords: 0, avgWords: 0, avgInternalLinks: 0, avgExternalLinks: 0,
      hasAboutPage: false, hasContactPage: false, hasLegalPage: false,
      hasTermsPage: false, hasBlogSection: false, hasTestimonials: false, isHttps: true,
      schemaRichness,
    };
  }

  const allSchemaTypes = new Set<string>();
  let pagesWithAuthor = 0;
  let pagesWithSchema = 0;
  let noindexCount = 0;
  let totalWords = 0;
  let totalInternal = 0;
  let totalExternal = 0;
  let hasAboutPage = false;
  let hasContactPage = false;
  let hasLegalPage = false;
  let hasTermsPage = false;
  let hasBlogSection = false;
  let hasTestimonials = false;
  let isHttps = true;

  // ── 1. Scan crawled pages (content + URL + schema richness) ──
  for (const page of pages) {
    const urlLower = (page.url || '').toLowerCase();
    const textLower = (page.bodyTextTruncated || '').toLowerCase();
    const titleLower = (page.title || '').toLowerCase();

    if (page.hasSchemaOrg || (page.schemaTypes && page.schemaTypes.length > 0)) {
      pagesWithSchema++;
      for (const t of (page.schemaTypes || [])) {
        allSchemaTypes.add(t);
        const tl = t.toLowerCase();
        if (tl.includes('organization')) schemaRichness.entities.hasOrganization = true;
        if (tl.includes('localbusiness')) schemaRichness.entities.hasLocalBusiness = true;
        if (tl.includes('person')) schemaRichness.entities.hasPerson = true;
        if (tl.includes('website')) schemaRichness.entities.hasWebSite = true;
        if (tl.includes('article') || tl.includes('blogposting') || tl.includes('newsarticle')) schemaRichness.entities.hasArticle = true;
        if (tl.includes('faqpage')) schemaRichness.entities.hasFAQPage = true;
        if (tl.includes('product')) schemaRichness.entities.hasProduct = true;
        if (tl.includes('breadcrumb')) schemaRichness.entities.hasBreadcrumb = true;
        if (tl.includes('review')) schemaRichness.entities.hasReview = true;
      }
    }

    // Aggregate schema richness from crawled page metadata
    if (page.schemaCount) schemaRichness.totalBlocks += page.schemaCount;
    if (page.schemaHasGraph) schemaRichness.hasGraph = true;
    if (page.schemaFieldCount) schemaRichness.totalFields += page.schemaFieldCount;
    if (page.schemaDepth && page.schemaDepth > schemaRichness.maxDepth) schemaRichness.maxDepth = page.schemaDepth;
    if (page.hasSameAs) schemaRichness.hasSameAs = true;
    if (page.hasAuthorInJsonLd) schemaRichness.hasAuthorInJsonLd = true;

    // Author detection
    if (/auteur|author|écrit par|written by|rédigé par/i.test(textLower)) {
      pagesWithAuthor++;
    }
    if ((page.schemaTypes || []).some((t: string) => /person/i.test(t))) {
      pagesWithAuthor++;
    }

    if (!page.isIndexable) noindexCount++;

    totalWords += page.wordCount || 0;
    totalInternal += page.internalLinksCount || 0;
    totalExternal += page.externalLinksCount || 0;

    if (/about|a-propos|qui-sommes|equipe|team|notre-histoire/i.test(urlLower)) hasAboutPage = true;
    if (/contact/i.test(urlLower)) hasContactPage = true;
    if (/mentions-legales|legal|imprint|impressum/i.test(urlLower)) hasLegalPage = true;
    if (/cgv|cgu|conditions|terms|privacy|confidentialit/i.test(urlLower)) hasTermsPage = true;
    if (/blog|actualit|news|articles|journal/i.test(urlLower)) hasBlogSection = true;

    // Also detect trust pages from links found in crawled page HTML (footer links)
    const rawHtml = (page.bodyTextTruncated || '').toLowerCase() + ' ' + textLower;
    if (/href=["'][^"']*contact/i.test(rawHtml) || /page contact|nous contacter|contactez/i.test(rawHtml)) hasContactPage = true;
    if (/href=["'][^"']*mentions-legales/i.test(rawHtml) || /mentions légales/i.test(rawHtml)) hasLegalPage = true;
    if (/href=["'][^"']*(?:cgv|cgu|conditions)/i.test(rawHtml) || /conditions .{0,20}(?:utilisation|vente|générales)/i.test(rawHtml)) hasTermsPage = true;

    if (/témoignage|avis client|testimonial|review|réalisation|portfolio|cas client/i.test(textLower + ' ' + titleLower)) {
      hasTestimonials = true;
    }

    if (page.url && page.url.startsWith('http://')) isHttps = false;
  }

  // ── 2. Scan ALL sitemap URLs for trust page patterns (even non-crawled) ──
  for (const sitemapUrl of sitemapUrls) {
    const urlLower = sitemapUrl.toLowerCase();
    if (/about|a-propos|qui-sommes|equipe|team|notre-histoire/i.test(urlLower)) hasAboutPage = true;
    if (/contact/i.test(urlLower)) hasContactPage = true;
    if (/mentions-legales|legal|imprint|impressum/i.test(urlLower)) hasLegalPage = true;
    if (/cgv|cgu|conditions|terms|privacy|confidentialit|rgpd|gdpr/i.test(urlLower)) hasTermsPage = true;
    if (/blog|actualit|news|articles|journal/i.test(urlLower)) hasBlogSection = true;
    if (/auteur|author/i.test(urlLower)) hasAboutPage = true;
    if (/temoignage|testimonial|avis|portfolio|references|realisations/i.test(urlLower)) hasTestimonials = true;
  }

  schemaRichness.uniqueTypes = [...allSchemaTypes];

  const n = Math.max(pages.length, 1);
  return {
    pagesWithAuthor, pagesWithSchema, schemaTypes: [...allSchemaTypes], noindexCount,
    totalWords, avgWords: Math.round(totalWords / n),
    avgInternalLinks: Math.round(totalInternal / n),
    avgExternalLinks: Math.round(totalExternal / n),
    hasAboutPage, hasContactPage, hasLegalPage, hasTermsPage,
    hasBlogSection, hasTestimonials, isHttps,
    schemaRichness,
  };
}

// ══════════════════════════════════════════════════════
// Auto-correct domain: test DNS variants silently
// ══════════════════════════════════════════════════════
async function autoCorrectDomain(domain: string): Promise<string> {
  // Quick check: does the original domain resolve?
  if (await domainResolves(domain)) return domain;

  console.log(`[check-eeat] 🔍 Domain "${domain}" doesn't resolve, trying variants...`);

  // Generate variants to try
  const variants = generateDomainVariants(domain);

  for (const variant of variants) {
    if (variant === domain) continue;
    if (await domainResolves(variant)) {
      console.log(`[check-eeat] ✅ Found working variant: ${variant}`);
      return variant;
    }
  }

  // None resolved — return original (will fail gracefully later)
  return domain;
}

async function domainResolves(domain: string): Promise<boolean> {
  try {
    const resp = await fetch(`https://${domain}/`, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
    });
    return resp.status < 500;
  } catch {
    // Also try http
    try {
      const resp = await fetch(`http://${domain}/`, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      });
      return resp.status < 500;
    } catch {
      return false;
    }
  }
}

function generateDomainVariants(domain: string): string[] {
  const variants = new Set<string>();
  const parts = domain.split('.');
  if (parts.length < 2) return [domain];

  const name = parts.slice(0, -1).join('.');
  const tld = parts[parts.length - 1];

  // 1. Remove trailing 's' (iktrackers → iktracker)
  if (name.endsWith('s')) {
    variants.add(`${name.slice(0, -1)}.${tld}`);
  }

  // 2. Add trailing 's'
  variants.add(`${name}s.${tld}`);

  // 3. TLD swaps (.fr ↔ .com, .net, .org)
  const tlds = ['fr', 'com', 'net', 'org', 'io'];
  for (const t of tlds) {
    if (t !== tld) {
      variants.add(`${name}.${t}`);
      // Also without trailing 's'
      if (name.endsWith('s')) variants.add(`${name.slice(0, -1)}.${t}`);
    }
  }

  // 4. Hyphen variants (my-site ↔ mysite)
  if (name.includes('-')) {
    variants.add(`${name.replace(/-/g, '')}.${tld}`);
  } else if (name.length > 6) {
    // Try adding common split points (not very reliable, so limited)
  }

  // 5. www. prefix
  variants.add(`www.${domain}`);
  if (name.endsWith('s')) variants.add(`www.${name.slice(0, -1)}.${tld}`);

  return [...variants];
}
