import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { preCrawlForAudit, formatPreCrawlForPrompt } from '../_shared/preCrawlForAudit.ts';

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
    const { url, async: isAsync, _job_id, tracked_site_id } = body;

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

        const result = await runEeatPipeline(supabase, domain, targetUrl, tracked_site_id, _job_id);

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

      const { data: job, error: jobErr } = await supabase.from('async_jobs').insert({
        function_name: 'check-eeat',
        user_id: userId,
        input_payload: { url, tracked_site_id },
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
        body: JSON.stringify({ url, _job_id: job.id, tracked_site_id }),
      }).catch(e => console.error('[check-eeat] Self-invoke error:', e));

      return new Response(JSON.stringify({
        job_id: job.id,
        status: 'pending',
      }), { status: 202, headers: HEADERS });
    }

    // ── Synchronous mode (fallback for simple calls) ──
    const result = await runEeatPipeline(supabase, domain, targetUrl, tracked_site_id, null);
    return new Response(JSON.stringify(result), { headers: HEADERS });

  } catch (e) {
    console.error('[check-eeat]', e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e), score: 0 }), { status: 500, headers: HEADERS });
  }
});

// ══════════════════════════════════════════════════════
// Pipeline principal E-E-A-T multi-pages
// ══════════════════════════════════════════════════════
async function runEeatPipeline(
  supabase: any,
  domain: string,
  targetUrl: string,
  trackedSiteId: string | null,
  jobId: string | null
): Promise<any> {

  // ── Phase 1: Pré-crawl multi-pages (cache ou intermédiaire) ──
  console.log(`[check-eeat] 🕷️ Phase 1: Pre-crawl for ${domain}...`);
  if (jobId) await supabase.from('async_jobs').update({ progress: 10 }).eq('id', jobId);

  const preCrawlResult = await preCrawlForAudit(supabase, domain, trackedSiteId);
  const pagesContext = formatPreCrawlForPrompt(preCrawlResult);
  const pagesCount = preCrawlResult.pages.length;

  console.log(`[check-eeat] 📄 ${pagesCount} pages crawled (source: ${preCrawlResult.source})`);
  if (jobId) await supabase.from('async_jobs').update({ progress: 40 }).eq('id', jobId);

  // ── Phase 2: Aggregate structural signals across all pages ──
  const aggregated = aggregateSignals(preCrawlResult.pages);

  if (jobId) await supabase.from('async_jobs').update({ progress: 50 }).eq('id', jobId);

  // ── Phase 3: LLM analysis with multi-page context ──
  console.log(`[check-eeat] 🤖 Phase 3: LLM analysis...`);
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    return { success: false, error: 'LOVABLE_API_KEY not configured', score: 0 };
  }

  const llmResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{
        role: 'user',
        content: `Tu es un expert E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) selon les Quality Rater Guidelines de Google.

Évalue les signaux E-E-A-T de ce site web à partir de ${pagesCount} pages crawlées.

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

${pagesContext}

═══ INSTRUCTIONS ═══
Analyse TOUS les signaux ci-dessus pour produire une évaluation E-E-A-T complète.
Prends en compte la cohérence entre les pages, la profondeur du contenu, la présence d'auteurs, les preuves d'expertise, et les signaux de confiance.

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
      max_tokens: 1200,
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
      blogSection: aggregated.hasBlogSection,
      testimonials: aggregated.hasTestimonials,
    },
    trustSignals: analysis.trust_signals || [],
    missingSignals: analysis.missing_signals || [],
    issues: analysis.issues || [],
    strengths: analysis.strengths || [],
    recommendations: analysis.recommendations || [],
    crawlInfo: {
      pagesAnalyzed: pagesCount,
      source: preCrawlResult.source,
      crawledAt: preCrawlResult.crawledAt,
      sitemapUrlsFound: preCrawlResult.totalSitemapUrls,
    },
  };
}

// ══════════════════════════════════════════════════════
// Aggregation des signaux sur N pages
// ══════════════════════════════════════════════════════
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
}

function aggregateSignals(pages: any[]): AggregatedSignals {
  if (!pages.length) {
    return {
      pagesWithAuthor: 0, pagesWithSchema: 0, schemaTypes: [], noindexCount: 0,
      totalWords: 0, avgWords: 0, avgInternalLinks: 0, avgExternalLinks: 0,
      hasAboutPage: false, hasContactPage: false, hasLegalPage: false,
      hasTermsPage: false, hasBlogSection: false, hasTestimonials: false, isHttps: true,
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

  for (const page of pages) {
    const urlLower = (page.url || '').toLowerCase();
    const textLower = (page.bodyTextTruncated || '').toLowerCase();
    const titleLower = (page.title || '').toLowerCase();

    // Schema
    if (page.hasSchemaOrg || (page.schemaTypes && page.schemaTypes.length > 0)) {
      pagesWithSchema++;
      for (const t of (page.schemaTypes || [])) allSchemaTypes.add(t);
    }

    // Author detection in body text
    if (/auteur|author|écrit par|written by|rédigé par/i.test(textLower)) {
      pagesWithAuthor++;
    }

    // Indexability
    if (!page.isIndexable) noindexCount++;

    // Words & links
    totalWords += page.wordCount || 0;
    totalInternal += page.internalLinksCount || 0;
    totalExternal += page.externalLinksCount || 0;

    // Detect key pages by URL pattern
    if (/about|a-propos|qui-sommes|equipe|team|notre-histoire/i.test(urlLower)) hasAboutPage = true;
    if (/contact/i.test(urlLower)) hasContactPage = true;
    if (/mentions-legales|legal|imprint|impressum/i.test(urlLower)) hasLegalPage = true;
    if (/cgv|cgu|conditions|terms|privacy|confidentialit/i.test(urlLower)) hasTermsPage = true;
    if (/blog|actualit|news|articles|journal/i.test(urlLower)) hasBlogSection = true;

    // Detect testimonials in content
    if (/témoignage|avis client|testimonial|review|réalisation|portfolio|cas client/i.test(textLower + ' ' + titleLower)) {
      hasTestimonials = true;
    }

    // HTTPS check
    if (page.url && page.url.startsWith('http://')) isHttps = false;
  }

  const n = pages.length;
  return {
    pagesWithAuthor,
    pagesWithSchema,
    schemaTypes: [...allSchemaTypes],
    noindexCount,
    totalWords,
    avgWords: Math.round(totalWords / n),
    avgInternalLinks: Math.round(totalInternal / n),
    avgExternalLinks: Math.round(totalExternal / n),
    hasAboutPage,
    hasContactPage,
    hasLegalPage,
    hasTermsPage,
    hasBlogSection,
    hasTestimonials,
    isHttps,
  };
}
