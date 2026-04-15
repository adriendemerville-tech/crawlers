/**
 * Scraper Strategy — multi-source page fetching with SPA detection.
 * Cascade: renderPage → Spider.cloud → Firecrawl, with optional Browserless for SPAs.
 */
import type { PageAnalysis, CustomSelector } from './types.ts';
import { analyzeHtml, computePageScore } from './htmlAnalyzer.ts';
import { trackPaidApiCall } from '../tokenTracker.ts';
import { withBrowserlessSlot } from '../browserlessSemaphore.ts';

const FIRECRAWL_API = 'https://api.firecrawl.dev/v1';
const SPIDER_API = 'https://api.spider.cloud';

// ── Browserless rendering ──────────────────────────────────
export async function renderWithBrowserless(url: string, renderingKey: string): Promise<{ html: string | null; responseTime: number }> {
  const start = Date.now();
  const result = await withBrowserlessSlot(async () => {
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
      const responseTime = Date.now() - start;

      if (response.ok) {
        const html = await response.text();
        await trackPaidApiCall('process-crawl-queue', 'browserless', '/content', url).catch(() => {});
        return { html, responseTime };
      }
      console.warn(`[Worker] Browserless error ${response.status} for ${url}`);
      return { html: null, responseTime };
    } catch (e) {
      console.warn(`[Worker] Browserless failed for ${url}:`, e instanceof Error ? e.message : e);
      return { html: null, responseTime: Date.now() - start };
    }
  }, `crawl:${url}`);

  return result ?? { html: null, responseTime: Date.now() - start };
}

// ── Scrape a single page ───────────────────────────────────
export async function scrapePage(
  pageUrl: string,
  domain: string,
  firecrawlKey: string,
  useBrowserless: boolean,
  renderingKey: string | null,
  customSelectors: CustomSelector[] = [],
  depth: number = 0,
): Promise<PageAnalysis | null> {
  try {
    let html = '';
    let statusCode = 200;
    let responseTime: number | null = null;
    let redirectUrl: string | null = null;

    try {
      const { fetchAndRenderPage } = await import('../renderPage.ts');
      const renderResult = await fetchAndRenderPage(pageUrl, {
        timeout: 10000,
        forceRender: useBrowserless,
      });

      if (renderResult.html.length > 500) {
        html = renderResult.html;
        console.log(
          `[Worker] ${renderResult.usedRendering ? 'rendered' : 'fetched'} ${pageUrl} (${renderResult.html.length} chars${renderResult.framework ? `, ${renderResult.framework}` : ''})`
        );
      }
    } catch (renderErr) {
      console.warn(`[Worker] fetchAndRenderPage failed for ${pageUrl}:`, renderErr);
    }

    // ── Spider.cloud PRIMARY → Firecrawl FALLBACK ──
    if (!html || html.length < 500) {
      const spiderKey = Deno.env.get('SPIDER_API_KEY');
      let spiderOk = false;

      if (spiderKey) {
        try {
          console.log(`[Worker] HTML insufficient for ${pageUrl}, trying Spider.cloud...`);
          const fetchStart2 = Date.now();
          const spiderRes = await fetch(`${SPIDER_API}/crawl`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${spiderKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: pageUrl, limit: 1, return_format: 'raw', request: 'http' }),
          });
          responseTime = Date.now() - fetchStart2;
          if (spiderRes.ok) {
            const spiderData = await spiderRes.json();
            const page = Array.isArray(spiderData) ? spiderData[0] : spiderData;
            const spiderHtml = page?.content || '';
            if (spiderHtml.length > 500) {
              html = spiderHtml;
              statusCode = page?.status || 200;
              spiderOk = true;
              console.log(`[Worker] ✅ Spider.cloud OK for ${pageUrl} (${html.length} chars)`);
              await trackPaidApiCall('process-crawl-queue', 'spider', '/crawl', pageUrl).catch(() => {});
            }
          }
        } catch (e) {
          console.warn(`[Worker] Spider.cloud failed for ${pageUrl}:`, e);
        }
      }

      if (!spiderOk) {
        console.log(`[Worker] Falling back to Firecrawl for ${pageUrl}...`);
        const fetchStart3 = Date.now();
        const res = await fetch(`${FIRECRAWL_API}/scrape`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: pageUrl, formats: ['rawHtml'], onlyMainContent: false, waitFor: 3000 }),
        });
        responseTime = Date.now() - fetchStart3;
        const data = await res.json();
        html = data?.data?.rawHtml || data?.rawHtml || data?.data?.html || data?.html || '';
        statusCode = data?.data?.metadata?.statusCode || 200;

        const sourceUrl = data?.data?.metadata?.sourceURL;
        if (sourceUrl && sourceUrl !== pageUrl) {
          redirectUrl = sourceUrl;
        }

        await trackPaidApiCall('process-crawl-queue', 'firecrawl', '/scrape', pageUrl).catch(() => {});
      }
    }

    if (!html) return null;

    const analysis = analyzeHtml(html, pageUrl, domain, responseTime, customSelectors, depth);
    analysis.http_status = statusCode;
    if (redirectUrl) analysis.redirect_url = redirectUrl;
    const seo_score = computePageScore(analysis);
    return { ...analysis, seo_score } as PageAnalysis;
  } catch (e) {
    console.warn(`[Worker] Scrape error ${pageUrl}:`, e);
    return null;
  }
}

// ── SPA probe ──────────────────────────────────────────────
export async function probeSPAStatus(
  firstUrl: string,
  domain: string,
  firecrawlKey: string,
  renderingKey: string | null,
): Promise<{ isSPA: boolean; firstPageResult: PageAnalysis | null }> {
  const result = await scrapePage(firstUrl, domain, firecrawlKey, false, null);
  if (!result) return { isSPA: false, firstPageResult: null };

  const isThinContent = result.word_count < 50;

  const isShellLikeTitle = !isThinContent && result.title && (
    (() => {
      try {
        const path = new URL(firstUrl).pathname;
        if (path !== '/' && path !== '') {
          const pathWords = path.replace(/[^a-zA-ZÀ-ÿ]/g, ' ').trim().toLowerCase().split(/\s+/).filter(w => w.length > 3);
          const titleLower = (result.title || '').toLowerCase();
          if (pathWords.length > 0 && !pathWords.some(w => titleLower.includes(w))) {
            return true;
          }
        }
      } catch {}
      return false;
    })()
  );

  const needsJSRender = isThinContent || isShellLikeTitle;
  if (!needsJSRender) return { isSPA: false, firstPageResult: result };

  if (!renderingKey) {
    const reason = isThinContent ? `thin content (${result.word_count} words)` : `shell-like title detected`;
    console.log(`[Worker] ${reason} on ${firstUrl} but no RENDERING_API_KEY`);
    const firecrawlResult = await scrapePage(firstUrl, domain, firecrawlKey, false, null);
    if (firecrawlResult && firecrawlResult.title !== result.title) {
      console.log(`[Worker] ✅ SPA confirmed via Firecrawl: title changed from "${result.title}" to "${firecrawlResult.title}"`);
      return { isSPA: true, firstPageResult: firecrawlResult };
    }
    return { isSPA: false, firstPageResult: result };
  }

  const reason = isThinContent ? `thin content (${result.word_count} words)` : `shell-like title "${result.title?.slice(0, 50)}"`;
  console.log(`[Worker] 🔍 ${reason} on ${firstUrl} — probing with Browserless...`);
  const renderedResult = await scrapePage(firstUrl, domain, firecrawlKey, true, renderingKey);

  if (renderedResult) {
    const titleChanged = renderedResult.title && renderedResult.title !== result.title;
    const contentGrew = renderedResult.word_count > result.word_count * 2 && renderedResult.word_count > 50;

    if (titleChanged || contentGrew) {
      console.log(`[Worker] ✅ SPA confirmed: title "${result.title?.slice(0, 40)}" → "${renderedResult.title?.slice(0, 40)}", words ${result.word_count} → ${renderedResult.word_count}`);
      return { isSPA: true, firstPageResult: renderedResult };
    }
  }

  console.log(`[Worker] ❌ Not a SPA (Browserless: ${renderedResult?.word_count || 0} words, title: ${renderedResult?.title?.slice(0, 40) || 'null'})`);
  return { isSPA: false, firstPageResult: result };
}
