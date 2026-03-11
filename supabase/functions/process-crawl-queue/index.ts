import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FIRECRAWL_API = 'https://api.firecrawl.dev/v1';
const MAX_GLOBAL_CONCURRENT = 20; // Rule: max 20 pages at once across ALL users

// ── Score SEO simplifié (sur 200) ──────────────────────────
interface PageAnalysis {
  url: string;
  path: string;
  http_status: number;
  title: string | null;
  meta_description: string | null;
  h1: string | null;
  has_schema_org: boolean;
  has_canonical: boolean;
  has_hreflang: boolean;
  has_og: boolean;
  word_count: number;
  images_total: number;
  images_without_alt: number;
  internal_links: number;
  external_links: number;
  broken_links: string[];
  seo_score: number;
  issues: string[];
}

function computePageScore(page: Omit<PageAnalysis, 'seo_score'>): number {
  let score = 0;
  if (page.title && page.title.length > 0 && page.title.length <= 60) score += 15;
  else if (page.title) score += 8;
  if (page.meta_description && page.meta_description.length >= 50 && page.meta_description.length <= 160) score += 15;
  else if (page.meta_description) score += 8;
  if (page.h1) score += 15;
  if (page.word_count >= 300) score += 15;
  else if (page.word_count >= 100) score += 8;
  if (page.http_status === 200) score += 15;
  if (page.has_canonical) score += 15;
  if (page.has_schema_org) score += 15;
  if (page.has_og) score += 15;
  if (page.images_total === 0 || page.images_without_alt === 0) score += 30;
  else score += Math.max(0, 30 - (page.images_without_alt / page.images_total) * 30);
  if (page.internal_links >= 3) score += 15;
  else if (page.internal_links >= 1) score += 8;
  if (page.external_links >= 1) score += 15;
  else score += 5;
  if (page.has_hreflang) score += 20;
  else score += 5;
  return Math.round(Math.min(200, score));
}

function analyzeHtml(html: string, pageUrl: string, domain: string): Omit<PageAnalysis, 'seo_score'> {
  let path = '/';
  try { path = new URL(pageUrl).pathname; } catch {}

  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;

  const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
    || html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
  const meta_description = metaDescMatch ? metaDescMatch[1].trim() : null;

  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : null;

  const has_schema_org = /application\/ld\+json/i.test(html);
  const has_canonical = /<link[^>]+rel=["']canonical["']/i.test(html);
  const has_hreflang = /<link[^>]+hreflang/i.test(html);
  const has_og = /<meta[^>]+property=["']og:/i.test(html);

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyText = bodyMatch ? bodyMatch[1].replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').trim() : '';
  const word_count = bodyText.split(/\s+/).filter(w => w.length > 0).length;

  const imgMatches = html.match(/<img[^>]*>/gi) || [];
  const images_total = imgMatches.length;
  const images_without_alt = imgMatches.filter(img => !(/alt=["'][^"']+["']/i.test(img))).length;

  const linkMatches = html.match(/<a[^>]+href=["']([^"'#]+)["']/gi) || [];
  let internal_links = 0, external_links = 0;
  for (const link of linkMatches) {
    const hrefMatch = link.match(/href=["']([^"'#]+)["']/i);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];
    if (href.startsWith('/') || href.includes(domain)) internal_links++;
    else if (href.startsWith('http')) external_links++;
  }

  const issues: string[] = [];
  if (!title) issues.push('missing_title');
  else if (title.length > 60) issues.push('title_too_long');
  if (!meta_description) issues.push('missing_meta_description');
  else if (meta_description.length > 160) issues.push('meta_description_too_long');
  if (!h1) issues.push('missing_h1');
  if (word_count < 100) issues.push('thin_content');
  if (!has_schema_org) issues.push('missing_schema_org');
  if (!has_canonical) issues.push('missing_canonical');
  if (!has_og) issues.push('missing_og');
  if (images_without_alt > 0) issues.push(`${images_without_alt}_images_without_alt`);

  return {
    url: pageUrl, path, http_status: 200, title, meta_description, h1,
    has_schema_org, has_canonical, has_hreflang, has_og,
    word_count, images_total, images_without_alt,
    internal_links, external_links, broken_links: [], issues,
  };
}

/**
 * process-crawl-queue — Async worker
 * Called by pg_cron every 30s OR by crawl-site on job creation
 * Picks up pending/processing jobs and processes batches of pages
 * Global concurrency limit: 20 pages at once (all users combined)
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY')!;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Fetch active jobs (pending or processing), ordered by priority then age
    const { data: jobs, error: fetchError } = await supabase
      .from('crawl_jobs')
      .select('*')
      .in('status', ['pending', 'processing'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(10);

    if (fetchError || !jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No jobs to process' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Worker] Found ${jobs.length} active jobs`);

    let globalPagesProcessed = 0;

    for (const job of jobs) {
      if (globalPagesProcessed >= MAX_GLOBAL_CONCURRENT) {
        console.log(`[Worker] Global limit reached (${MAX_GLOBAL_CONCURRENT}), stopping`);
        break;
      }

      const urlsToProcess: string[] = (job.urls_to_process as string[]) || [];
      const alreadyProcessed = job.processed_count || 0;
      const remaining = urlsToProcess.slice(alreadyProcessed);

      if (remaining.length === 0) {
        // All pages processed, move to AI analysis phase
        await finalizeJob(supabase, job, firecrawlKey);
        continue;
      }

      // Calculate how many pages this job can process in this cycle
      const availableSlots = MAX_GLOBAL_CONCURRENT - globalPagesProcessed;
      const batchSize = Math.min(remaining.length, availableSlots, 20);
      const batch = remaining.slice(0, batchSize);

      // Mark job as processing
      if (job.status === 'pending') {
        await supabase.from('crawl_jobs').update({
          status: 'processing',
          started_at: new Date().toISOString(),
        }).eq('id', job.id);

        await supabase.from('site_crawls').update({
          status: 'crawling',
        }).eq('id', job.crawl_id);
      }

      console.log(`[Worker] Job ${job.id}: processing batch of ${batch.length} pages (${alreadyProcessed}/${job.total_count})`);

      // Scrape batch in parallel
      const scrapePromises = batch.map(async (pageUrl: string) => {
        try {
          const res = await fetch(`${FIRECRAWL_API}/scrape`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: pageUrl, formats: ['html'], onlyMainContent: false, waitFor: 3000 }),
          });
          const data = await res.json();
          const html = data?.data?.html || data?.html || '';
          const statusCode = data?.data?.metadata?.statusCode || 200;

          if (!html) return null;

          const analysis = analyzeHtml(html, pageUrl, job.domain);
          analysis.http_status = statusCode;
          const seo_score = computePageScore(analysis);
          return { ...analysis, seo_score } as PageAnalysis;
        } catch (e) {
          console.warn(`[Worker] Scrape error ${pageUrl}:`, e);
          return null;
        }
      });

      const results = await Promise.all(scrapePromises);
      const validResults = results.filter(Boolean) as PageAnalysis[];

      // Save to crawl_pages
      if (validResults.length > 0) {
        const rows = validResults.map(p => ({ crawl_id: job.crawl_id, ...p }));
        await supabase.from('crawl_pages').insert(rows);
      }

      const newProcessedCount = alreadyProcessed + batch.length;
      globalPagesProcessed += batch.length;

      // Update job progress
      await supabase.from('crawl_jobs').update({
        processed_count: newProcessedCount,
      }).eq('id', job.id);

      // Update site_crawls progress (for frontend polling)
      await supabase.from('site_crawls').update({
        crawled_pages: newProcessedCount,
      }).eq('id', job.crawl_id);

      console.log(`[Worker] Job ${job.id}: ${newProcessedCount}/${job.total_count} pages done`);

      // Check if all pages are now processed
      if (newProcessedCount >= job.total_count) {
        await finalizeJob(supabase, { ...job, processed_count: newProcessedCount }, firecrawlKey);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: globalPagesProcessed,
      jobs: jobs.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[Worker] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Worker error',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

/**
 * Finalize a completed job: compute scores + AI summary
 */
async function finalizeJob(supabase: any, job: any, _firecrawlKey: string) {
  console.log(`[Worker] Finalizing job ${job.id}...`);

  await supabase.from('crawl_jobs').update({ status: 'analyzing' }).eq('id', job.id);
  await supabase.from('site_crawls').update({ status: 'analyzing' }).eq('id', job.crawl_id);

  // Load all pages for this crawl
  const { data: allPages } = await supabase
    .from('crawl_pages')
    .select('*')
    .eq('crawl_id', job.crawl_id);

  const pages = allPages || [];
  const avgScore = pages.length > 0
    ? Math.round(pages.reduce((s: number, p: any) => s + (p.seo_score || 0), 0) / pages.length)
    : 0;

  // AI Summary
  let aiSummary = '';
  let aiRecommendations: any[] = [];
  const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');

  if (openrouterKey && pages.length > 0) {
    const issuesSummary: Record<string, number> = {};
    pages.forEach((p: any) => ((p.issues as string[]) || []).forEach(issue => {
      issuesSummary[issue] = (issuesSummary[issue] || 0) + 1;
    }));

    const topIssues = Object.entries(issuesSummary)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([issue, count]) => `${issue}: ${count} pages`);

    const bestPages = [...pages].sort((a: any, b: any) => (b.seo_score || 0) - (a.seo_score || 0)).slice(0, 5);
    const worstPages = [...pages].sort((a: any, b: any) => (a.seo_score || 0) - (b.seo_score || 0)).slice(0, 5);

    const prompt = `Tu es un expert SEO senior. Analyse ce crawl de ${job.domain} (${pages.length} pages, score moyen: ${avgScore}/200).

PROBLÈMES DÉTECTÉS:
${topIssues.join('\n')}

MEILLEURES PAGES:
${bestPages.map((p: any) => `- ${p.path} (${p.seo_score}/200)`).join('\n')}

PIRES PAGES:
${worstPages.map((p: any) => `- ${p.path} (${p.seo_score}/200) — Problèmes: ${(p.issues || []).join(', ')}`).join('\n')}

STATS:
- Pages avec Schema.org: ${pages.filter((p: any) => p.has_schema_org).length}/${pages.length}
- Pages avec canonical: ${pages.filter((p: any) => p.has_canonical).length}/${pages.length}
- Pages avec OG: ${pages.filter((p: any) => p.has_og).length}/${pages.length}
- Contenu fin (<100 mots): ${pages.filter((p: any) => (p.word_count || 0) < 100).length}
- Images sans alt: ${pages.reduce((s: number, p: any) => s + (p.images_without_alt || 0), 0)}

Réponds en JSON STRICT:
{
  "summary": "Synthèse narrative en 3-4 phrases (en français), couvrant les forces et faiblesses du site.",
  "recommendations": [
    {"priority": "critical|high|medium", "title": "Titre court", "description": "Détail actionnable", "affected_pages": 12}
  ]
}
Donne 5-8 recommandations max, classées par impact.`;

    try {
      const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openrouterKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        }),
      });

      const aiData = await aiRes.json();
      const aiContent = aiData.choices?.[0]?.message?.content || '';
      const parsed = JSON.parse(aiContent);
      aiSummary = parsed.summary || '';
      aiRecommendations = parsed.recommendations || [];
    } catch (e) {
      console.warn(`[Worker] AI summary failed:`, e);
      aiSummary = `Crawl terminé: ${pages.length} pages analysées, score moyen ${avgScore}/200.`;
    }
  }

  // Finalize
  await supabase.from('site_crawls').update({
    status: 'completed',
    crawled_pages: pages.length,
    avg_score: avgScore,
    ai_summary: aiSummary,
    ai_recommendations: aiRecommendations,
    completed_at: new Date().toISOString(),
  }).eq('id', job.crawl_id);

  await supabase.from('crawl_jobs').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
  }).eq('id', job.id);

  console.log(`[Worker] ✅ Job ${job.id} finalized: ${pages.length} pages, avg score ${avgScore}/200`);
}
