import { trackAnalyzedUrl } from '../_shared/trackUrl.ts';
import { trackEdgeFunctionError } from '../_shared/tokenTracker.ts';
import { corsHeaders } from '../_shared/cors.ts';

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
  const cls = (m.CUMULATIVE_LAYOUT_SHIFT?.percentile || 0) / 100; // CrUX returns CLS * 100
  const inp = m.INTERACTION_TO_NEXT_PAINT?.percentile || 0;
  const ttfb = m.EXPERIMENTAL_TIME_TO_FIRST_BYTE?.percentile || 0;

  // Derive performance from overall_category
  const performance = overallCategoryToPerformance(loadingExperience.overall_category || 'AVERAGE');

  return {
    available: true,
    metrics: {
      performance,
      // CrUX doesn't have these — we'll fill from Lighthouse
      accessibility: 0,
      bestPractices: 0,
      seo: 0,
      fcp: formatTime(fcp),
      lcp: formatTime(lcp),
      cls: cls.toFixed(3),
      tbt: formatTime(inp), // INP replaces TBT in field data (closest real-user equivalent)
      speedIndex: '', // Not available in CrUX
      tti: formatTime(ttfb), // Use TTFB as closest field equivalent
    }
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, strategy = 'mobile' } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedUrl = normalizeUrl(url);
    console.log('Checking PageSpeed for:', normalizedUrl, 'Strategy:', strategy);

    const apiKey = Deno.env.get("GOOGLE_PAGESPEED_API_KEY");
    if (!apiKey) {
      console.error("GOOGLE_PAGESPEED_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: 'PageSpeed API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const googleApiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(normalizedUrl)}&strategy=${strategy}&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO&key=${apiKey}`;

    console.log('Calling Google PageSpeed API...');
    const response = await fetch(googleApiUrl);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('PageSpeed API error:', JSON.stringify(errorData));
      
      if (response.status === 429 || errorData?.error?.status === 'RESOURCE_EXHAUSTED') {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'quota_exceeded',
            message: 'PageSpeed API daily quota exceeded. Please try again tomorrow.'
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: errorData?.error?.message || `PageSpeed API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('PageSpeed response received successfully');

    // ── Extract Lighthouse lab data (always available) ──
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

    // ── Extract CrUX field data (may not exist for low-traffic sites) ──
    const crux = extractCruxData(data.loadingExperience);
    
    let finalResult: PageSpeedResult;
    let dataSource: 'field' | 'lab';

    if (crux?.available) {
      console.log('✅ CrUX field data available — prioritizing real-user metrics');
      dataSource = 'field';
      finalResult = {
        // Always use Lighthouse performance score (granular 0-100, varies by strategy)
        // CrUX overall_category only gives 3 buckets (FAST/AVERAGE/SLOW) — too coarse
        performance: lighthouseResult.performance,
        // Category scores only exist in Lighthouse
        accessibility: lighthouseResult.accessibility,
        bestPractices: lighthouseResult.bestPractices,
        seo: lighthouseResult.seo,
        // Core Web Vitals from CrUX (real users)
        fcp: crux.metrics.fcp,
        lcp: crux.metrics.lcp,
        cls: crux.metrics.cls,
        // INP from CrUX (replaces TBT for field data)
        tbt: crux.metrics.tbt,
        // Speed Index not in CrUX — fall back to Lighthouse
        speedIndex: lighthouseResult.speedIndex,
        // TTFB from CrUX
        tti: crux.metrics.tti,
      };
    } else {
      console.log('ℹ️ No CrUX field data — using Lighthouse lab data');
      dataSource = 'lab';
      finalResult = lighthouseResult;
    }

    // Fire-and-forget URL tracking
    trackAnalyzedUrl(normalizedUrl).catch(() => {});

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          url: normalizedUrl,
          strategy,
          scores: finalResult,
          dataSource,
          scannedAt: new Date().toISOString(),
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to check PageSpeed';
    await trackEdgeFunctionError('check-pagespeed', errorMessage).catch(() => {});
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
