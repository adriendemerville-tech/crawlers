import { trackAnalyzedUrl } from '../_shared/trackUrl.ts';
import { trackEdgeFunctionError } from '../_shared/tokenTracker.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { checkIpRate, getClientIp, rateLimitResponse, acquireConcurrency, releaseConcurrency, concurrencyResponse } from '../_shared/ipRateLimiter.ts';
import { checkFairUse, getUserContext } from '../_shared/fairUse.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

interface PageSpeedResult {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  fcp: string;
  lcp: string;
  cls: string;
  tbt: string;
  speedIndex: string;
  tti: string;
}

function normalizeUrl(url: string): string {
  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  return normalized;
}

function formatTime(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.round(ms)}ms`;
}

// Map CrUX category to a 0-100 score
function categoryToScore(category: string): number {
  switch (category) {
    case 'FAST': return 95;
    case 'AVERAGE': return 65;
    case 'SLOW': return 30;
    default: return 50;
  }
}

// Derive a performance score from CrUX overall_category
function overallCategoryToPerformance(category: string): number {
  switch (category) {
    case 'FAST': return 92;
    case 'AVERAGE': return 62;
    case 'SLOW': return 28;
    default: return 50;
  }
}

// Extract CrUX field data if available
function extractCruxData(loadingExperience: any): { metrics: PageSpeedResult; available: boolean } | null {
  if (!loadingExperience?.metrics) return null;

  const m = loadingExperience.metrics;

  // Need at least LCP and FCP to consider CrUX valid
  if (!m.LARGEST_CONTENTFUL_PAINT_MS?.percentile && !m.FIRST_CONTENTFUL_PAINT_MS?.percentile) {
    return null;
  }

  const lcp = m.LARGEST_CONTENTFUL_PAINT_MS?.percentile || 0;
  const fcp = m.FIRST_CONTENTFUL_PAINT_MS?.percentile || 0;
  const cls = (m.CUMULATIVE_LAYOUT_SHIFT?.percentile || 0) / 100;
  const inp = m.INTERACTION_TO_NEXT_PAINT?.percentile || 0;
  const ttfb = m.EXPERIMENTAL_TIME_TO_FIRST_BYTE?.percentile || 0;

  const performance = overallCategoryToPerformance(loadingExperience.overall_category || 'AVERAGE');

  return {
    available: true,
    metrics: {
      performance,
      accessibility: 0,
      bestPractices: 0,
      seo: 0,
      fcp: formatTime(fcp),
      lcp: formatTime(lcp),
      cls: cls.toFixed(3),
      tbt: formatTime(inp),
      speedIndex: '',
      tti: formatTime(ttfb),
    }
  };
}

// Fetch PSI for a single strategy and produce final result
async function fetchForStrategy(normalizedUrl: string, strategy: string, apiKey: string): Promise<{
  scores: PageSpeedResult;
  dataSource: 'field' | 'lab';
} | null> {
  const googleApiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(normalizedUrl)}&strategy=${strategy}&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO&key=${apiKey}`;

  // Timeout 120s pour laisser Google analyser les sites lents
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  let response: Response;
  try {
    response = await fetch(googleApiUrl, { signal: controller.signal });
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      console.error(`[PSI:${strategy}] ⏱️ Timeout 120s dépassé pour ${normalizedUrl}`);
      throw new Error('timeout');
    }
    throw err;
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error(`[PSI:${strategy}] API error ${response.status}:`, errorData?.error?.message);
    
    if (response.status === 429 || errorData?.error?.status === 'RESOURCE_EXHAUSTED') {
      throw new Error('quota_exceeded');
    }
    return null;
  }

  const data = await response.json();

  const categories = data.lighthouseResult?.categories || {};
  const audits = data.lighthouseResult?.audits || {};

  const lighthouseResult: PageSpeedResult = {
    performance: Math.round((categories.performance?.score || 0) * 100),
    accessibility: Math.round((categories.accessibility?.score || 0) * 100),
    bestPractices: Math.round((categories['best-practices']?.score || 0) * 100),
    seo: Math.round((categories.seo?.score || 0) * 100),
    fcp: formatTime(audits['first-contentful-paint']?.numericValue || 0),
    lcp: formatTime(audits['largest-contentful-paint']?.numericValue || 0),
    cls: (audits['cumulative-layout-shift']?.numericValue || 0).toFixed(3),
    tbt: formatTime(audits['total-blocking-time']?.numericValue || 0),
    speedIndex: formatTime(audits['speed-index']?.numericValue || 0),
    tti: formatTime(audits['interactive']?.numericValue || 0),
  };

  const crux = extractCruxData(data.loadingExperience);

  let finalResult: PageSpeedResult;
  let dataSource: 'field' | 'lab';

  if (crux?.available) {
    console.log(`[PSI:${strategy}] ✅ CrUX field data available`);
    dataSource = 'field';
    finalResult = {
      performance: lighthouseResult.performance,
      accessibility: lighthouseResult.accessibility,
      bestPractices: lighthouseResult.bestPractices,
      seo: lighthouseResult.seo,
      fcp: crux.metrics.fcp,
      lcp: crux.metrics.lcp,
      cls: crux.metrics.cls,
      tbt: crux.metrics.tbt,
      speedIndex: lighthouseResult.speedIndex,
      tti: crux.metrics.tti,
    };
  } else {
    console.log(`[PSI:${strategy}] ℹ️ No CrUX — using Lighthouse lab data`);
    dataSource = 'lab';
    finalResult = lighthouseResult;
  }

  return { scores: finalResult, dataSource };
}

Deno.serve(handleRequest(async (req) => {
// ── IP Rate Limit ──
  const clientIp = getClientIp(req);
  const ipCheck = checkIpRate(clientIp, 'check-pagespeed', 15, 60_000);
  if (!ipCheck.allowed) return rateLimitResponse(corsHeaders, ipCheck.retryAfterMs);

  if (!acquireConcurrency('check-pagespeed', 30)) return concurrencyResponse(corsHeaders);

  try {
    // ── Fair Use ──
    const userCtx = await getUserContext(req);
    if (userCtx) {
      const fairUse = await checkFairUse(userCtx.userId, 'pagespeed_check', userCtx.planType);
      if (!fairUse.allowed) {
        releaseConcurrency('check-pagespeed');
        return new Response(JSON.stringify({ success: false, error: fairUse.reason }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const { url, strategy = 'mobile', dual = false } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedUrl = normalizeUrl(url);
    const apiKey = Deno.env.get("GOOGLE_PAGESPEED_API_KEY");
    if (!apiKey) {
      console.error("GOOGLE_PAGESPEED_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: 'PageSpeed API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Dual mode: fetch both mobile + desktop in parallel ──
    if (dual) {
      console.log('[PSI] Dual mode — fetching mobile + desktop for:', normalizedUrl);

      const [mobileResult, desktopResult] = await Promise.allSettled([
        fetchForStrategy(normalizedUrl, 'mobile', apiKey),
        fetchForStrategy(normalizedUrl, 'desktop', apiKey),
      ]);

      // Check for quota/timeout errors
      for (const r of [mobileResult, desktopResult]) {
        if (r.status === 'rejected') {
          if (r.reason?.message === 'quota_exceeded') {
            return new Response(
              JSON.stringify({ success: false, error: 'quota_exceeded', message: 'PageSpeed API daily quota exceeded.' }),
              { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          if (r.reason?.message === 'timeout') {
            console.warn(`[PSI:dual] ⏱️ Timeout sur une stratégie pour ${normalizedUrl}`);
          }
        }
      }

      const mobile = mobileResult.status === 'fulfilled' ? mobileResult.value : null;
      const desktop = desktopResult.status === 'fulfilled' ? desktopResult.value : null;

      // Fire-and-forget URL tracking
      trackAnalyzedUrl(normalizedUrl).catch(() => {});

      return new Response(
        JSON.stringify({
          success: true,
          dual: true,
          data: {
            url: normalizedUrl,
            mobile: mobile ? { ...mobile, strategy: 'mobile' } : null,
            desktop: desktop ? { ...desktop, strategy: 'desktop' } : null,
            // Backward compatible: main "scores" = mobile (or desktop fallback)
            scores: mobile?.scores || desktop?.scores || null,
            strategy: 'dual',
            dataSource: mobile?.dataSource || desktop?.dataSource || 'lab',
            scannedAt: new Date().toISOString(),
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Single strategy mode (backward compatible) ──
    console.log('[PSI] Single mode — strategy:', strategy, 'for:', normalizedUrl);

    try {
      const result = await fetchForStrategy(normalizedUrl, strategy, apiKey);

      if (!result) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to get PageSpeed data' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      trackAnalyzedUrl(normalizedUrl).catch(() => {});

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            url: normalizedUrl,
            strategy,
            scores: result.scores,
            dataSource: result.dataSource,
            scannedAt: new Date().toISOString(),
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (err: any) {
      if (err.message === 'quota_exceeded') {
        return new Response(
          JSON.stringify({ success: false, error: 'quota_exceeded', message: 'PageSpeed API daily quota exceeded.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw err;
    }

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to check PageSpeed';
    await trackEdgeFunctionError('check-pagespeed', errorMessage).catch(() => {});
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } finally {
    releaseConcurrency('check-pagespeed');
  }
}));