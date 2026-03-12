/**
 * Shared utility for fetching and rendering web pages.
 * Handles SPA/CSR detection and Browserless JS rendering fallback.
 */
import { trackPaidApiCall } from './tokenTracker.ts';
import { stealthFetch } from './stealthFetch.ts';

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
    (!!spaInfo.framework && isMissingSEOTags(html))
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
  try {
    const renderUrl = `https://production-sfo.browserless.io/content?token=${renderingKey}`;
    const response = await fetch(renderUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        gotoOptions: { waitUntil: 'networkidle2', timeout: 25000 },
        waitForSelector: { selector: 'body', timeout: 5000 },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (response.ok) {
      const renderedHtml = await response.text();
      // Track Browserless API call
      await trackPaidApiCall('renderPage', 'browserless', '/content', url).catch(() => {});
      return renderedHtml;
    } else {
      console.log(`[renderPage] ⚠️ Browserless error: ${response.status}`);
      await logBrowserlessError(response.status, `HTTP ${response.status}`, url);
      return null;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log('[renderPage] ⚠️ Browserless failed:', msg);
    await logBrowserlessError(0, msg, url);
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
  const ua = options?.userAgent || BROWSER_UA;
  const timeout = options?.timeout || 10000;

  // Step 1: Fetch raw HTML
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const response = await fetch(url, {
    signal: controller.signal,
    headers: {
      'User-Agent': ua,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  let html = await response.text();
  let usedRendering = false;

  // Step 2: Analyze content for SPA/CSR detection
  const visibleText = extractVisibleText(html);
  const spaInfo = detectSPAMarkers(html);
  const shouldRender = options?.forceRender || needsJSRendering(html, visibleText);

  if (shouldRender) {
    console.log(`[renderPage] SPA/CSR detected (${visibleText.length} chars text, ${html.length} chars HTML, framework: ${spaInfo.framework || 'unknown'}). Trying JS rendering...`);

    const renderingKey = Deno.env.get('RENDERING_API_KEY');
    if (renderingKey) {
      const rendered = await renderWithBrowserless(url, renderingKey);
      if (rendered) {
        // Compare visible text content, not raw HTML length (rendered HTML strips JS bundles)
        const renderedText = extractVisibleText(rendered);
        const renderedWords = renderedText.split(/\s+/).filter(w => w.length > 2).length;
        const staticWords = visibleText.split(/\s+/).filter(w => w.length > 2).length;
        if (renderedWords > staticWords || rendered.length > html.length) {
          console.log(`[renderPage] ✅ JS rendering success (${renderedWords} words vs ${staticWords} static, ${rendered.length} chars vs ${html.length})`);
          html = rendered;
          usedRendering = true;
        } else {
          console.log(`[renderPage] ⚠️ Rendered HTML not richer (${renderedWords} words vs ${staticWords} static). Keeping original.`);
        }
      }
    } else {
      console.log('[renderPage] ⚠️ RENDERING_API_KEY not configured');
    }
  }

  // Step 3: Re-analyze after potential rendering
  const finalText = extractVisibleText(html);

  return {
    html,
    usedRendering,
    isSPA: spaInfo.isSPA && !usedRendering, // If rendered successfully, treat as normal
    textLength: finalText.length,
    framework: spaInfo.framework,
  };
}
