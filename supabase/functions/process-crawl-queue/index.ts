/**
 * process-crawl-queue — Async worker (Screaming Frog-level analysis)
 * 
 * Orchestrates crawl jobs: fetches pages, analyzes HTML, detects SPAs,
 * discovers internal links (pass 2), and finalizes with AI summary.
 * 
 * All analysis logic is in _shared/crawlQueue/:
 *   - types.ts: PageAnalysis, CustomSelector
 *   - htmlAnalyzer.ts: analyzeHtml, computePageScore, validateSchemaOrg
 *   - scraperStrategy.ts: scrapePage, probeSPAStatus, renderWithBrowserless
 *   - duplicateDetector.ts: detectDuplicates, computeBFSDepths, computeDepth
 *   - finalizer.ts: finalizeJob (AI summary, keyword universe, voice tone)
 */
import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk } from '../_shared/serveHandler.ts';
import type { PageAnalysis, CustomSelector } from '../_shared/crawlQueue/types.ts';
import { scrapePage, probeSPAStatus } from '../_shared/crawlQueue/scraperStrategy.ts';
import { computeDepth } from '../_shared/crawlQueue/duplicateDetector.ts';
import { finalizeJob } from '../_shared/crawlQueue/finalizer.ts';

const MAX_GLOBAL_CONCURRENT = 20;

Deno.serve(handleRequest(async (req) => {
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY')!;
  const renderingKey = Deno.env.get('RENDERING_API_KEY') || null;
  const supabase = getServiceClient();

  const WATCHDOG_MS = 360_000;
  const startTime = Date.now();
  const isTimeUp = () => Date.now() - startTime > WATCHDOG_MS;

  try {
    const { data: jobs, error: fetchError } = await supabase
      .from('crawl_jobs')
      .select('*')
      .in('status', ['pending', 'processing'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(10);

    if (fetchError || !jobs || jobs.length === 0) {
      return jsonOk({ success: true, message: 'No jobs to process' });
    }

    console.log(`[Worker] Found ${jobs.length} active jobs`);
    let globalPagesProcessed = 0;
    const failedUrlsByJob = new Map<string, Array<{ url: string; reason: string }>>();

    for (const job of jobs) {
      if (globalPagesProcessed >= MAX_GLOBAL_CONCURRENT || isTimeUp()) {
        if (isTimeUp()) console.log(`[Worker] ⏱️ Watchdog triggered after ${Math.round((Date.now() - startTime) / 1000)}s — stopping gracefully`);
        else console.log(`[Worker] Global limit reached (${MAX_GLOBAL_CONCURRENT}), stopping`);
        break;
      }

      const urlsToProcess: string[] = (job.urls_to_process as string[]) || [];
      const customSelectors: CustomSelector[] = (job.custom_selectors as CustomSelector[]) || [];
      const maxDepth: number = job.max_depth || 0;
      const urlFilter: string | null = job.url_filter || null;
      let alreadyProcessed = job.processed_count || 0;

      // ── Checkpoint reconciliation ──
      const { count: persistedPageCount } = await supabase
        .from('crawl_pages')
        .select('id', { count: 'exact', head: true })
        .eq('crawl_id', job.crawl_id);

      const reconciledProcessedCount = Math.max(alreadyProcessed, persistedPageCount || 0);
      if (reconciledProcessedCount !== alreadyProcessed) {
        console.log(`[Worker] Job ${job.id}: checkpoint recovered ${alreadyProcessed} → ${reconciledProcessedCount}`);
        alreadyProcessed = reconciledProcessedCount;
        await supabase.from('crawl_jobs').update({ processed_count: reconciledProcessedCount }).eq('id', job.id);
        await supabase.from('site_crawls').update({ crawled_pages: reconciledProcessedCount }).eq('id', job.crawl_id);
      }

      let remaining = urlsToProcess.slice(alreadyProcessed);

      // Apply URL regex filter
      if (urlFilter) {
        try {
          const regex = new RegExp(urlFilter);
          remaining = remaining.filter(u => regex.test(u));
        } catch {
          console.warn(`[Worker] Invalid URL filter regex: ${urlFilter}`);
        }
      }

      // Apply max depth filter
      if (maxDepth > 0) {
        remaining = remaining.filter(u => computeDepth(u, job.url) <= maxDepth);
      }

      if (remaining.length === 0) {
        await finalizeJob(supabase, { ...job, processed_count: alreadyProcessed }, firecrawlKey, failedUrlsByJob.get(job.id) || []);
        continue;
      }

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
      let probeSize = 0;

      if (alreadyProcessed === 0) {
        const probe = await probeSPAStatus(remaining[0], job.domain, firecrawlKey, renderingKey);
        useBrowserless = probe.isSPA;
        firstPageResult = probe.firstPageResult;
        probeSize = firstPageResult?.html_size_bytes || 0;
        if (firstPageResult) {
          firstPageResult.crawl_depth = computeDepth(remaining[0], job.url);
        }
        if (useBrowserless) {
          console.log(`[Worker] Job ${job.id}: 🌐 SPA mode enabled`);
        }
      } else {
        // Resume probe to calibrate batch size
        try {
          const probeResp = await fetch(remaining[0], { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(10_000) });
          const probeBody = await probeResp.text();
          probeSize = new TextEncoder().encode(probeBody).length;
          console.log(`[Worker] Job ${job.id}: resume probe ${Math.round(probeSize / 1024)}KB on ${remaining[0]}`);
        } catch (_e) {
          console.warn(`[Worker] Job ${job.id}: resume probe failed, using conservative batch`);
          probeSize = 200_000;
        }
      }

      // Save probe result
      if (firstPageResult) {
        const rows = [{ crawl_id: job.crawl_id, ...firstPageResult }];
        await supabase.from('crawl_pages').upsert(rows, { onConflict: 'crawl_id,url', ignoreDuplicates: true });
        alreadyProcessed += 1;
        globalPagesProcessed += 1;
        await supabase.from('crawl_jobs').update({ processed_count: alreadyProcessed }).eq('id', job.id);
        await supabase.from('site_crawls').update({ crawled_pages: alreadyProcessed }).eq('id', job.crawl_id);
        remaining = remaining.slice(1);
        console.log(`[Worker] Job ${job.id}: probe saved, ${alreadyProcessed}/${job.total_count}`);
      }

      // ── Track discovered URLs to avoid re-crawling ──
      const processedUrls = new Set<string>(urlsToProcess.map(u => u.replace(/\/$/, '')));

      // ── INNER LOOP: keep processing pages while time allows ──
      while (remaining.length > 0 && !isTimeUp() && globalPagesProcessed < MAX_GLOBAL_CONCURRENT) {
        // Check if crawl was stopped by user
        const { data: crawlCheck } = await supabase
          .from('site_crawls')
          .select('status')
          .eq('id', job.crawl_id)
          .single();
        if (crawlCheck?.status === 'stopped') {
          console.log(`[Worker] Job ${job.id}: 🛑 Crawl stopped by user — preserving ${alreadyProcessed} cached pages`);
          await supabase.from('crawl_jobs').update({ status: 'cancelled' }).eq('id', job.id);
          break;
        }

        // Dynamic batch sizing based on page weight
        const dynamicMax = probeSize > 150_000 ? 1 : probeSize > 100_000 ? 2 : probeSize > 50_000 ? 3 : 4;
        const availableSlots = MAX_GLOBAL_CONCURRENT - globalPagesProcessed;
        const batchSize = Math.min(remaining.length, availableSlots, dynamicMax);
        const batch = remaining.slice(0, batchSize);

        console.log(`[Worker] Job ${job.id}: batch=${batchSize} (${alreadyProcessed}/${job.total_count})${useBrowserless ? ' [SPA]' : ''}`);

        const scrapePromises = batch.map(pageUrl =>
          scrapePage(pageUrl, job.domain, firecrawlKey, useBrowserless, renderingKey, customSelectors, computeDepth(pageUrl, job.url))
        );

        const settled = await Promise.allSettled(scrapePromises);
        const validResults = settled
          .filter((r): r is PromiseFulfilledResult<PageAnalysis | null> => r.status === 'fulfilled')
          .map(r => r.value)
          .filter(Boolean) as PageAnalysis[];

        // Track failed URLs
        if (!failedUrlsByJob.has(job.id)) failedUrlsByJob.set(job.id, []);
        const jobFailedUrls = failedUrlsByJob.get(job.id)!;
        settled.forEach((r, i) => {
          if (r.status === 'rejected') {
            jobFailedUrls.push({ url: batch[i], reason: r.reason?.message || 'fetch_error' });
          } else if (r.status === 'fulfilled' && r.value === null) {
            jobFailedUrls.push({ url: batch[i], reason: 'empty_content' });
          }
        });

        const failedCount = settled.filter(r => r.status === 'rejected').length;
        if (failedCount > 0) console.warn(`[Worker] ${failedCount} pages failed in batch`);

        if (validResults.length > 0) {
          const rows = validResults.map(p => ({ crawl_id: job.crawl_id, ...p }));
          await supabase.from('crawl_pages').upsert(rows, { onConflict: 'crawl_id,url', ignoreDuplicates: true });
        }

        // ── PASS 2: RECURSIVE LINK DISCOVERY ──
        const PASS2_MAX_EXTRA = 200;
        const initialPageLimit = job.total_count || 50;
        const extendedLimit = initialPageLimit + PASS2_MAX_EXTRA;
        let discoveredNew = 0;
        if (alreadyProcessed + remaining.length < extendedLimit) {
          for (const page of validResults) {
            if (!page.anchor_texts) continue;
            for (const link of page.anchor_texts) {
              if (link.type !== 'internal') continue;
              try {
                const fullUrl = link.href.startsWith('http')
                  ? link.href
                  : `https://${job.domain}${link.href.startsWith('/') ? '' : '/'}${link.href}`;
                const normalized = fullUrl.replace(/\/$/, '');
                const linkDomain = new URL(fullUrl).hostname;
                if (!linkDomain.includes(job.domain.replace(/^www\./, '')) && !job.domain.includes(linkDomain.replace(/^www\./, ''))) continue;
                if (processedUrls.has(normalized)) continue;
                processedUrls.add(normalized);
                remaining.push(fullUrl);
                discoveredNew++;
              } catch {
                // malformed URL, skip
              }
            }
          }
          if (discoveredNew > 0) {
            const maxRemaining = extendedLimit - alreadyProcessed;
            if (remaining.length > maxRemaining) {
              remaining = remaining.slice(0, maxRemaining);
            }
            const newTotal = alreadyProcessed + remaining.length;
            job.total_count = newTotal;
            await supabase.from('crawl_jobs').update({ total_count: newTotal }).eq('id', job.id);
            await supabase.from('site_crawls').update({ total_pages: newTotal }).eq('id', job.crawl_id);
            console.log(`[Worker] Job ${job.id}: 🔗 Discovered ${discoveredNew} new URLs via internal links (total queue: ${remaining.length})`);
          }
        }

        // Reconcile from DB
        const { count: persistedAfterBatch } = await supabase
          .from('crawl_pages')
          .select('id', { count: 'exact', head: true })
          .eq('crawl_id', job.crawl_id);

        const newProcessedCount = Math.max(alreadyProcessed, persistedAfterBatch || 0);
        const pagesInThisCycle = Math.max(0, newProcessedCount - alreadyProcessed);
        globalPagesProcessed += pagesInThisCycle;
        alreadyProcessed = newProcessedCount;

        await supabase.from('crawl_jobs').update({ processed_count: newProcessedCount }).eq('id', job.id);
        await supabase.from('site_crawls').update({ crawled_pages: newProcessedCount }).eq('id', job.crawl_id);

        console.log(`[Worker] Job ${job.id}: ${newProcessedCount}/${job.total_count} pages done`);

        remaining = remaining.slice(batchSize);

        if (validResults.length > 0) {
          probeSize = validResults[validResults.length - 1].html_size_bytes || probeSize;
        }
      }

      if (alreadyProcessed >= job.total_count) {
        await finalizeJob(supabase, { ...job, processed_count: alreadyProcessed }, firecrawlKey, failedUrlsByJob.get(job.id) || []);
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    return jsonOk({
      success: true,
      processed: globalPagesProcessed,
      jobs: jobs.length,
      elapsed_seconds: elapsed,
    });

  } catch (error) {
    console.error('[Worker] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Worker error',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}, 'process-crawl-queue'));
