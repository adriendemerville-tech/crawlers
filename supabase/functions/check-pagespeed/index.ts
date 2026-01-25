import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

serve(async (req) => {
  // Gestion du protocole CORS
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

    // Clé API directe
    const apiKey = "AIzaSyALHaypJWTqbt8K1klhQkYeLPRBjaOs2hc";

    // Construction de l'URL pour Google PageSpeed Insights
    const googleApiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(normalizedUrl)}&strategy=${strategy}&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO&key=${apiKey}`;

    console.log('Calling Google PageSpeed API...');
    const response = await fetch(googleApiUrl);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('PageSpeed API error:', JSON.stringify(errorData));
      
      // Gestion du dépassement de quota
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
