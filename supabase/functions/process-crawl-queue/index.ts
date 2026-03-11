import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { trackPaidApiCall } from '../_shared/tokenTracker.ts';

const FIRECRAWL_API = 'https://api.firecrawl.dev/v1';
const MAX_GLOBAL_CONCURRENT = 20;

// ── SPA Detection ──────────────────────────────────────────
function detectSPAMarkers(html: string): { isSPA: boolean; framework?: string } {
  const hasSPAMarker =
    /<div\s+id=["'](app|root|__next|__nuxt)["'][^>]*>/i.test(html) ||
    /data-reactroot/i.test(html) ||
    /<app-root/i.test(html);

  let framework: string | undefined;
  if (/__NEXT_DATA__/i.test(html)) framework = 'Next.js';
  else if (/__NUXT__/i.test(html)) framework = 'Nuxt';
  else if (/data-reactroot|__REACT|ReactDOM/i.test(html)) framework = 'React';
  else if (/__VUE__|Vue\.createApp/i.test(html)) framework = 'Vue';
  else if (/ng-version|<app-root/i.test(html)) framework = 'Angular';

  return { isSPA: hasSPAMarker || !!framework, framework };
}

// ── Browserless rendering ──────────────────────────────────
async function renderWithBrowserless(url: string, renderingKey: string): Promise<string | null> {
  try {
    const response = await fetch(`https://production-sfo.browserless.io/content?token=${renderingKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        gotoOptions: { waitUntil: 'networkidle2', timeout: 20000 },
        waitForSelector: { selector: 'body', timeout: 5000 },
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (response.ok) {
      const html = await response.text();
      await trackPaidApiCall('process-crawl-queue', 'browserless', '/content', url).catch(() => {});
      return html;
    }
    console.warn(`[Worker] Browserless error ${response.status} for ${url}`);
    return null;
  } catch (e) {
    console.warn(`[Worker] Browserless failed for ${url}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

// ── Score SEO (sur 200) ────────────────────────────────────
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

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || null : null;

  const metaDescPatterns = [
    /<meta\s[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([\s\S]*?)["'][^>]*\/?>/i,
    /<meta\s[^>]*content\s*=\s*["']([\s\S]*?)["'][^>]*name\s*=\s*["']description["'][^>]*\/?>/i,
  ];
  let meta_description: string | null = null;
  for (const pattern of metaDescPatterns) {
    const m = html.match(pattern);
    if (m) { meta_description = m[1].replace(/\s+/g, ' ').trim(); break; }
  }

  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || null : null;

  const has_schema_org = /application\/ld\+json/i.test(html) || /itemtype\s*=\s*["']https?:\/\/schema\.org/i.test(html);
  const has_canonical = /<link[^>]+rel\s*=\s*["']canonical["']/i.test(html);
  const has_hreflang = /<link[^>]+hreflang/i.test(html);
  const has_og = /<meta[^>]+property\s*=\s*["']og:/i.test(html);

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  let bodyText = '';
  if (bodyMatch) {
    bodyText = bodyMatch[1]
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const word_count = bodyText.split(/\s+/).filter(w => w.length > 1).length;

  const imgMatches = html.match(/<img[^>]*>/gi) || [];
  const images_total = imgMatches.length;
  const images_without_alt = imgMatches.filter(img => {
    if (!/alt\s*=/i.test(img)) return true;
    const altVal = img.match(/alt\s*=\s*["']([\s\S]*?)["']/i);
    return !altVal || altVal[1].trim().length === 0;
  }).length;

  const linkMatches = html.match(/<a\s[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*/gi) || [];
  let internal_links = 0, external_links = 0;
  for (const link of linkMatches) {
    const hrefMatch = link.match(/href\s*=\s*["']([^"'#]+)["']/i);
    if (!hrefMatch) continue;
    const href = hrefMatch[1].trim();
    if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue;
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

// ── Scrape a single page (Firecrawl or Browserless) ────────
async function scrapePage(
  pageUrl: string,
  domain: string,
  firecrawlKey: string,
  useBrowserless: boolean,
  renderingKey: string | null,
): Promise<PageAnalysis | null> {
  try {
    let html = '';
    let statusCode = 200;

    if (useBrowserless && renderingKey) {
      // Browserless mode for SPA sites
      const rendered = await renderWithBrowserless(pageUrl, renderingKey);
      if (!rendered) return null;
      html = rendered;
    } else {
      // Firecrawl mode (default)
      const res = await fetch(`${FIRECRAWL_API}/scrape`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: pageUrl, formats: ['rawHtml'], onlyMainContent: false, waitFor: 3000 }),
      });
      const data = await res.json();
      html = data?.data?.rawHtml || data?.rawHtml || data?.data?.html || data?.html || '';
      statusCode = data?.data?.metadata?.statusCode || 200;
      if (!html) return null;
    }

    const analysis = analyzeHtml(html, pageUrl, domain);
    analysis.http_status = statusCode;
    const seo_score = computePageScore(analysis);
    return { ...analysis, seo_score } as PageAnalysis;
  } catch (e) {
    console.warn(`[Worker] Scrape error ${pageUrl}:`, e);
    return null;
  }
}

// ── SPA probe: test first page to decide rendering strategy ─
async function probeSPAStatus(
  firstUrl: string,
  domain: string,
  firecrawlKey: string,
  renderingKey: string | null,
): Promise<{ isSPA: boolean; firstPageResult: PageAnalysis | null }> {
  // Scrape first page with Firecrawl
  const result = await scrapePage(firstUrl, domain, firecrawlKey, false, null);

  if (!result) return { isSPA: false, firstPageResult: null };

  // Check SPA indicators: very low word count or missing all key tags
  const isThinContent = result.word_count < 50;
  
  if (!isThinContent) {
    return { isSPA: false, firstPageResult: result };
  }

  // Thin content detected — try Browserless to confirm SPA
  if (!renderingKey) {
    console.log(`[Worker] Thin content on ${firstUrl} (${result.word_count} words) but no RENDERING_API_KEY`);
    return { isSPA: false, firstPageResult: result };
  }

  console.log(`[Worker] 🔍 Thin content detected on ${firstUrl} (${result.word_count} words) — probing with Browserless...`);
  const renderedResult = await scrapePage(firstUrl, domain, firecrawlKey, true, renderingKey);

  if (renderedResult && renderedResult.word_count > result.word_count * 2 && renderedResult.word_count > 50) {
    console.log(`[Worker] ✅ SPA confirmed: ${result.word_count} → ${renderedResult.word_count} words after JS rendering`);
    return { isSPA: true, firstPageResult: renderedResult };
  }

  console.log(`[Worker] ❌ Not a SPA (Browserless: ${renderedResult?.word_count || 0} words)`);
  return { isSPA: false, firstPageResult: result };
}

/**
 * process-crawl-queue — Async worker
 * With intelligent SPA fallback: probes first page, switches to Browserless if SPA detected.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY')!;
  const renderingKey = Deno.env.get('RENDERING_API_KEY') || null;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
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
        await finalizeJob(supabase, job, firecrawlKey);
        continue;
      }

      // Mark job as processing
      if (job.status === 'pending') {
        await supabase.from('crawl_jobs').update({
          status: 'processing',
          started_at: new Date().toISOString(),
        }).eq('id', job.id);

        await supabase.from('site_crawls').update({ status: 'crawling' }).eq('id', job.crawl_id);
      }

      // ── SPA Probe on first batch ──
      let useBrowserless = false;
      let firstPageResult: PageAnalysis | null = null;

      if (alreadyProcessed === 0) {
        // First batch: probe the first URL to detect SPA
        const probe = await probeSPAStatus(remaining[0], job.domain, firecrawlKey, renderingKey);
        useBrowserless = probe.isSPA;
        firstPageResult = probe.firstPageResult;

        if (useBrowserless) {
          console.log(`[Worker] Job ${job.id}: 🌐 SPA mode enabled — using Browserless for all pages`);
        }
      }

      const availableSlots = MAX_GLOBAL_CONCURRENT - globalPagesProcessed;
      // If first page was already probed, skip it in the batch
      const batchStart = (alreadyProcessed === 0 && firstPageResult) ? 1 : 0;
      const batchSize = Math.min(remaining.length - batchStart, availableSlots - (firstPageResult ? 1 : 0), 20);
      const batch = remaining.slice(batchStart, batchStart + batchSize);

      console.log(`[Worker] Job ${job.id}: processing ${firstPageResult ? '1+' : ''}${batch.length} pages (${alreadyProcessed}/${job.total_count})${useBrowserless ? ' [SPA mode]' : ''}`);

      // Scrape batch in parallel
      const scrapePromises = batch.map(pageUrl =>
        scrapePage(pageUrl, job.domain, firecrawlKey, useBrowserless, renderingKey)
      );

      const results = await Promise.all(scrapePromises);
      const validResults = results.filter(Boolean) as PageAnalysis[];

      // Include first page result if it was probed
      if (firstPageResult) {
        validResults.unshift(firstPageResult);
      }

      // Save to crawl_pages
      if (validResults.length > 0) {
        const rows = validResults.map(p => ({ crawl_id: job.crawl_id, ...p }));
        await supabase.from('crawl_pages').insert(rows);
      }

      const pagesInThisCycle = (firstPageResult ? 1 : 0) + batch.length;
      const newProcessedCount = alreadyProcessed + pagesInThisCycle;
      globalPagesProcessed += pagesInThisCycle;

      await supabase.from('crawl_jobs').update({ processed_count: newProcessedCount }).eq('id', job.id);
      await supabase.from('site_crawls').update({ crawled_pages: newProcessedCount }).eq('id', job.crawl_id);

      console.log(`[Worker] Job ${job.id}: ${newProcessedCount}/${job.total_count} pages done`);

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

  const { data: allPages } = await supabase
    .from('crawl_pages')
    .select('*')
    .eq('crawl_id', job.crawl_id);

  const pages = allPages || [];
  const avgScore = pages.length > 0
    ? Math.round(pages.reduce((s: number, p: any) => s + (p.seo_score || 0), 0) / pages.length)
    : 0;

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
