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

// Fetch a single PSI category with its own timeout
async function fetchSingleCategory(
  normalizedUrl: string,
  strategy: string,
  category: string,
  apiKey: string,
  timeoutMs = 90_000,
): Promise<any | null> {
  const googleApiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(normalizedUrl)}&strategy=${strategy}&category=${category}&key=${apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(googleApiUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn(`[PSI:${strategy}:${category}] API error ${response.status}:`, errorData?.error?.message);
      if (response.status === 429 || errorData?.error?.status === 'RESOURCE_EXHAUSTED') {
        throw new Error('quota_exceeded');
      }
      return null;
    }
    return await response.json();
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      console.warn(`[PSI:${strategy}:${category}] ⏱️ Timeout ${timeoutMs}ms dépassé pour ${normalizedUrl}`);
      return null; // On ne throw pas — les autres catégories continuent
    }
    if (err.message === 'quota_exceeded') throw err;
    console.warn(`[PSI:${strategy}:${category}] Fetch error:`, err.message);
    return null;
  }
}

// Fetch PSI for a single strategy — 4 appels indépendants par catégorie
async function fetchForStrategy(normalizedUrl: string, strategy: string, apiKey: string): Promise<{
  scores: PageSpeedResult;
  dataSource: 'field' | 'lab';
  partial: boolean;
} | null> {
  const categories = ['PERFORMANCE', 'ACCESSIBILITY', 'BEST_PRACTICES', 'SEO'] as const;

  // Lancer les 4 catégories en parallèle, chacune avec son propre timeout de 90s
  const results = await Promise.allSettled(
    categories.map(cat => fetchSingleCategory(normalizedUrl, strategy, cat, apiKey, 90_000))
  );

  // Collecter les résultats réussis
  const categoryData: Record<string, any> = {};
  let quotaExceeded = false;

  for (let i = 0; i < categories.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled' && r.value) {
      categoryData[categories[i]] = r.value;
    } else if (r.status === 'rejected' && r.reason?.message === 'quota_exceeded') {
      quotaExceeded = true;
    }
  }

  if (quotaExceeded && Object.keys(categoryData).length === 0) {
    throw new Error('quota_exceeded');
  }

  // Si aucune catégorie n'a répondu, échec total
  if (Object.keys(categoryData).length === 0) {
    console.error(`[PSI:${strategy}] ❌ Aucune catégorie n'a répondu pour ${normalizedUrl}`);
    return null;
  }

  const partial = Object.keys(categoryData).length < 4;
  if (partial) {
    const missing = categories.filter(c => !categoryData[c]);
    console.warn(`[PSI:${strategy}] ⚠️ Résultat partiel — catégories manquantes: ${missing.join(', ')}`);
  }

  // Extraire les scores de chaque catégorie
  const perfData = categoryData['PERFORMANCE'];
  const a11yData = categoryData['ACCESSIBILITY'];
  const bpData = categoryData['BEST_PRACTICES'];
  const seoData = categoryData['SEO'];

  const perfCats = perfData?.lighthouseResult?.categories || {};
  const perfAudits = perfData?.lighthouseResult?.audits || {};

  const lighthouseResult: PageSpeedResult = {
    performance: Math.round((perfCats.performance?.score || 0) * 100),
    accessibility: Math.round((a11yData?.lighthouseResult?.categories?.accessibility?.score || 0) * 100),
    bestPractices: Math.round((bpData?.lighthouseResult?.categories?.['best-practices']?.score || 0) * 100),
    seo: Math.round((seoData?.lighthouseResult?.categories?.seo?.score || 0) * 100),
    fcp: formatTime(perfAudits['first-contentful-paint']?.numericValue || 0),
    lcp: formatTime(perfAudits['largest-contentful-paint']?.numericValue || 0),
    cls: (perfAudits['cumulative-layout-shift']?.numericValue || 0).toFixed(3),
    tbt: formatTime(perfAudits['total-blocking-time']?.numericValue || 0),
    speedIndex: formatTime(perfAudits['speed-index']?.numericValue || 0),
    tti: formatTime(perfAudits['interactive']?.numericValue || 0),
  };

  // CrUX field data (disponible dans n'importe quelle réponse de catégorie)
  const anyData = perfData || a11yData || bpData || seoData;
  const crux = extractCruxData(anyData?.loadingExperience);

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

  return { scores: finalResult, dataSource, partial };
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
      if (err.message === 'timeout') {
        return new Response(
          JSON.stringify({ success: false, error: 'timeout', message: 'Le site est trop lent pour être analysé (timeout 120s).' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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