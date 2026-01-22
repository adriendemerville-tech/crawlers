const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LighthouseCategory {
  score: number;
  title: string;
}

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

    // PageSpeed Insights API (free, no API key required for basic usage)
    const apiUrl = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
    apiUrl.searchParams.set('url', normalizedUrl);
    apiUrl.searchParams.set('strategy', strategy);
    apiUrl.searchParams.set('category', 'PERFORMANCE');
    apiUrl.searchParams.set('category', 'ACCESSIBILITY');
    apiUrl.searchParams.set('category', 'BEST_PRACTICES');
    apiUrl.searchParams.set('category', 'SEO');

    // Build the URL manually to include multiple categories
    const fullApiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(normalizedUrl)}&strategy=${strategy}&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO`;

    const response = await fetch(fullApiUrl);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('PageSpeed API error:', JSON.stringify(errorData));
      
      // Handle quota exceeded error specifically
      if (response.status === 429 || errorData?.error?.status === 'RESOURCE_EXHAUSTED') {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'quota_exceeded',
            message: 'PageSpeed API daily quota exceeded. Please try again tomorrow or use your own Google API key.'
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: `PageSpeed API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('PageSpeed response received');

    const categories = data.lighthouseResult?.categories || {};
    const audits = data.lighthouseResult?.audits || {};

    const result: PageSpeedResult = {
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

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          url: normalizedUrl,
          strategy,
          scores: result,
          scannedAt: new Date().toISOString(),
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to check PageSpeed';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
