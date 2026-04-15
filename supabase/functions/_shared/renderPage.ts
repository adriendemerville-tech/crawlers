/**
 * Shared utility for fetching and rendering web pages.
 * Handles SPA/CSR detection and Browserless JS rendering fallback.
 */
import { trackPaidApiCall } from './tokenTracker.ts';
import { stealthFetch } from './stealthFetch.ts';
import { withBrowserlessSlot } from './browserlessSemaphore.ts';

export interface RenderResult {
  html: string;
  usedRendering: boolean;
  isSPA: boolean;
  textLength: number;
  framework?: string;
}

/**
 * Extracts visible text from HTML (strips scripts, styles, noscript, tags).
 */
function extractVisibleText(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : html;
  return bodyContent
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detects SPA framework markers in HTML.
 */
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

/**
 * Checks if key SEO tags are missing from raw HTML (they may be hydrated client-side).
 */
function isMissingSEOTags(html: string): boolean {
  const hasCanonical = /<link[^>]+rel=["']canonical["'][^>]*>/i.test(html);
  const hasMetaDesc = /<meta[^>]+name=["']description["'][^>]+content=["'][^"']+["']/i.test(html);
  const hasJsonLd = /<script[^>]+type=["']application\/ld\+json["'][^>]*>/i.test(html);
  // Trigger if canonical OR JSON-LD is missing (commonly hydrated client-side on Nuxt/Next)
  return !hasCanonical || !hasJsonLd;
}

/**
 * Determines if the page needs JS rendering based on content analysis.
 */
function needsJSRendering(html: string, visibleText: string): boolean {
  const htmlToTextRatio = visibleText.length / html.length;
  const spaInfo = detectSPAMarkers(html);

  // Count actual words (not just chars) — more reliable for content detection
  const wordCount = visibleText.split(/\s+/).filter(w => w.length > 2).length;

  // Count real content signals: H1 tags, <img> tags, <a> links
  const h1Count = (html.match(/<h1[^>]*>[\s\S]*?<\/h1>/gi) || []).length;
  const imgCount = (html.match(/<img\b[^>]*>/gi) || []).length;
  const linkCount = (html.match(/<a\b[^>]*href/gi) || []).length;
  const contentSignals = h1Count + imgCount + linkCount;

  return (
    // Very little text despite large HTML
    (visibleText.length < 200 && html.length > 1000) ||
    // SPA marker detected with low word count (even if SEO meta tags inflate char count)
    (spaInfo.isSPA && wordCount < 100) ||
    // SPA marker with low text
    (spaInfo.isSPA && visibleText.length < 500) ||
    // Less than 2% text ratio (JS-heavy pages)
    (html.length > 5000 && htmlToTextRatio < 0.02) ||
    // Framework detected (Nuxt, Next, etc.) but key SEO tags missing from raw HTML
    (!!spaInfo.framework && isMissingSEOTags(html)) ||
    // Large HTML but suspiciously few content signals (WAF/bot-protected page)
    (html.length > 10000 && wordCount < 200 && contentSignals < 10) ||
    // Framework detected but almost no images or links (degraded/shell response)
    (!!spaInfo.framework && imgCount < 3 && linkCount < 5 && wordCount < 300)
  );
}

/**
 * Attempts to render a page using Browserless.io.
 * Returns rendered HTML or null on failure.
 */
async function logBrowserlessError(statusCode: number, errorMessage: string, url: string): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) return;

    await fetch(`${supabaseUrl}/rest/v1/analytics_events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        event_type: 'browserless_error',
        target_url: url,
        event_data: { status_code: statusCode, error: errorMessage },
      }),
    });
  } catch (_) {
    // Silent — don't break the main flow for logging
  }
}

async function renderWithBrowserless(url: string, renderingKey: string): Promise<string | null> {
  return await withBrowserlessSlot(async () => {
    try {
      const renderUrl = `https://production-sfo.browserless.io/content?token=${renderingKey}`;
      const response = await fetch(renderUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          gotoOptions: { waitUntil: 'networkidle2', timeout: 30000 },
          waitForSelector: { selector: 'h1, main, [role="main"], #content, .content, article', timeout: 10000 },
          waitForTimeout: 3000,
        }),
        signal: AbortSignal.timeout(45000),
      });

      if (response.ok) {
        const renderedHtml = await response.text();
        await trackPaidApiCall('renderPage', 'browserless', '/content', url).catch(() => {});
        return renderedHtml;
      } else {
        console.log(`[renderPage] ⚠️ Browserless error: ${response.status}`);
        await logBrowserlessError(response.status, `HTTP ${response.status}`, url);
        if (response.status === 429 || response.status >= 500) {
          return await renderWithFlyPlaywright(url);
        }
        return null;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log('[renderPage] ⚠️ Browserless failed:', msg);
      await logBrowserlessError(0, msg, url);
      return await renderWithFlyPlaywright(url);
    }
  }, `renderPage:${url}`) ?? await renderWithFlyPlaywright(url);
}

/**
 * Fallback renderer using self-hosted Playwright on Fly.io.
 */
async function renderWithFlyPlaywright(url: string): Promise<string | null> {
  const flyUrl = Deno.env.get('FLY_RENDERER_URL');
  const flySecret = Deno.env.get('FLY_RENDERER_SECRET');
  if (!flyUrl) {
    console.log('[renderPage] ⚠️ FLY_RENDERER_URL not configured');
    return null;
  }

  try {
    console.log(`[renderPage] 🔄 Falling back to Fly.io Playwright for ${url}`);
    const response = await fetch(`${flyUrl}/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(flySecret ? { 'x-secret': flySecret } : {}),
      },
      body: JSON.stringify({ url, timeout: 30000, waitFor: 3000 }),
      signal: AbortSignal.timeout(45000),
    });

    if (response.ok) {
      const html = await response.text();
      console.log(`[renderPage] ✅ Fly.io Playwright success (${html.length} chars)`);
      await trackPaidApiCall('renderPage', 'fly-playwright', '/render', url).catch(() => {});
      return html;
    } else {
      console.log(`[renderPage] ⚠️ Fly.io error: ${response.status}`);
      return null;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log('[renderPage] ⚠️ Fly.io Playwright failed:', msg);
    return null;
  }
}

/**
 * Self-render fallback for crawlers.fr (our own SPA).
 * Uses fetch-external-site edge function which has Spider/Browserless/Fly cascade.
 */
async function renderSelfFallback(url: string): Promise<string | null> {
  // Only activate for crawlers.fr / crawlers.lovable.app
  const hostname = (() => { try { return new URL(url).hostname; } catch { return ''; } })();
  const isSelf = hostname === 'crawlers.fr' || hostname === 'www.crawlers.fr' || hostname.endsWith('.lovable.app');
  if (!isSelf) return null;

  console.log(`[renderPage] 🔄 Self-render fallback for ${url}`);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return null;

  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/fetch-external-site`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, render_js: true }),
      signal: AbortSignal.timeout(30000),
    });

    if (resp.ok) {
      const data = await resp.json();
      const html = data.html || data.content || null;
      if (html && html.length > 500) {
        console.log(`[renderPage] ✅ Self-render fallback success (${html.length} chars)`);
        return html;
      }
    }
    console.log(`[renderPage] ⚠️ Self-render fallback: no usable HTML`);
    return null;
  } catch (err) {
    console.log(`[renderPage] ⚠️ Self-render fallback failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Fetches a page with automatic SPA/CSR detection and JS rendering fallback.
 * 
 * @param url - The URL to fetch
 * @param options - Optional configuration
 * @returns RenderResult with the (possibly rendered) HTML
 */
export async function fetchAndRenderPage(
  url: string,
  options?: {
    userAgent?: string;
    timeout?: number;
    forceRender?: boolean;
  }
): Promise<RenderResult> {
  const timeout = options?.timeout || 10000;
  const pathname = (() => {
    try {
      return new URL(url).pathname.replace(/\/$/, '') || '/';
    } catch {
      return '/';
    }
  })();

  const extractTagText = (markup: string, tag: 'title' | 'h1'): string | null => {
    const match = markup.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return match?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null;
  };

  const extractCanonical = (markup: string): string | null => {
    const match = markup.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
      || markup.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
    return match?.[1]?.trim() || null;
  };

  const countJsonLdBlocks = (markup: string): number => (markup.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>/gi) || []).length;

  const hasMainContainer = (markup: string): boolean => /<(main|article)[\s>]/i.test(markup);

  const hasMeaningfulSeoUpgrade = (sourceHtml: string, renderedHtml: string): boolean => {
    const sourceTitle = extractTagText(sourceHtml, 'title');
    const renderedTitle = extractTagText(renderedHtml, 'title');
    const sourceH1 = extractTagText(sourceHtml, 'h1');
    const renderedH1 = extractTagText(renderedHtml, 'h1');
    const sourceCanonical = extractCanonical(sourceHtml);
    const renderedCanonical = extractCanonical(renderedHtml);
    const sourceJsonLd = countJsonLdBlocks(sourceHtml);
    const renderedJsonLd = countJsonLdBlocks(renderedHtml);

    return (
      (!sourceH1 && !!renderedH1) ||
      (!sourceTitle && !!renderedTitle) ||
      (!!renderedH1 && renderedH1 !== sourceH1) ||
      (!!renderedTitle && renderedTitle !== sourceTitle) ||
      (!sourceCanonical && !!renderedCanonical) ||
      (renderedJsonLd > sourceJsonLd) ||
      (!hasMainContainer(sourceHtml) && hasMainContainer(renderedHtml))
    );
  };

  // Step 1: Fetch raw HTML with stealth headers
  const { response } = await stealthFetch(url, {
    timeout,
    maxRetries: 2,
    headers: options?.userAgent ? { 'User-Agent': options.userAgent } : {},
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  let html = await response.text();
  let usedRendering = false;

  // Step 2: Analyze content for SPA/CSR detection
  const visibleText = extractVisibleText(html);
  const spaInfo = detectSPAMarkers(html);
  const shellLikeInternalSpaRoute = spaInfo.isSPA && pathname !== '/' && (
    visibleText.length < 1200 ||
    !/<h1[\s>]/i.test(html) ||
    !hasMainContainer(html) ||
    isMissingSEOTags(html)
  );
  const shouldRender = options?.forceRender || needsJSRendering(html, visibleText) || shellLikeInternalSpaRoute;

  if (shouldRender) {
    console.log(`[renderPage] SPA/CSR detected (${visibleText.length} chars text, ${html.length} chars HTML, framework: ${spaInfo.framework || 'unknown'}). Trying JS rendering...`);

    let rendered: string | null = null;
    const renderingKey = Deno.env.get('RENDERING_API_KEY');

    // Tier 1: Browserless (includes Fly.io fallback internally)
    if (renderingKey) {
      rendered = await renderWithBrowserless(url, renderingKey);
    } else {
      console.log('[renderPage] ⚠️ RENDERING_API_KEY not configured');
    }

    // Tier 2: Self-render fallback for crawlers.fr if Browserless/Fly failed
    if (!rendered) {
      rendered = await renderSelfFallback(url);
    }

    if (rendered) {
      const renderedText = extractVisibleText(rendered);
      const renderedWords = renderedText.split(/\s+/).filter(w => w.length > 2).length;
      const staticWords = visibleText.split(/\s+/).filter(w => w.length > 2).length;
      const seoUpgraded = hasMeaningfulSeoUpgrade(html, rendered);

      if (renderedWords > staticWords || rendered.length > html.length || seoUpgraded) {
        console.log(`[renderPage] ✅ JS rendering success (${renderedWords} words vs ${staticWords} static, SEO upgrade: ${seoUpgraded ? 'yes' : 'no'})`);
        html = rendered;
        usedRendering = true;
      } else {
        console.log(`[renderPage] ⚠️ Rendered HTML not materially better (${renderedWords} words vs ${staticWords} static). Keeping original.`);
      }
    }
  }

  // Step 3: Re-analyze after potential rendering
  const finalText = extractVisibleText(html);

  return {
    html,
    usedRendering,
    isSPA: spaInfo.isSPA && !usedRendering,
    textLength: finalText.length,
    framework: spaInfo.framework,
  };
}
