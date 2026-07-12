import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY = 'https://connector-gateway.lovable.dev/google_search_console';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY') ?? '';
const GSC_KEY = Deno.env.get('GOOGLE_SEARCH_CONSOLE_API_KEY') ?? '';

function authHeaders() {
  return {
    'Authorization': `Bearer ${LOVABLE_API_KEY}`,
    'X-Connection-Api-Key': GSC_KEY,
    'Content-Type': 'application/json',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const result: any = { env: { has_lovable_key: !!LOVABLE_API_KEY, has_gsc_key: !!GSC_KEY } };

  try {
    // 1. List sites (validates OAuth + scopes)
    const sitesRes = await fetch(`${GATEWAY}/webmasters/v3/sites`, { headers: authHeaders() });
    const sitesBody = await sitesRes.json();
    result.sites = { status: sitesRes.status, body: sitesBody };

    const crawlersSite = sitesBody?.siteEntry?.find((s: any) =>
      s.siteUrl === 'sc-domain:crawlers.fr' || s.siteUrl === 'https://crawlers.fr/'
    );
    result.crawlers_found = !!crawlersSite;
    result.crawlers_permission = crawlersSite?.permissionLevel ?? null;

    if (!crawlersSite) {
      return new Response(JSON.stringify(result, null, 2), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. searchAnalytics query — last 7d, top 5 queries
    const end = new Date().toISOString().slice(0, 10);
    const startD = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
    const encoded = encodeURIComponent(crawlersSite.siteUrl);
    const saRes = await fetch(`${GATEWAY}/webmasters/v3/sites/${encoded}/searchAnalytics/query`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        startDate: startD, endDate: end,
        dimensions: ['query'], rowLimit: 5,
      }),
    });
    const saBody = await saRes.json();
    result.search_analytics = {
      status: saRes.status,
      rows_returned: saBody?.rows?.length ?? 0,
      top_queries: (saBody?.rows ?? []).map((r: any) => ({
        query: r.keys?.[0], clicks: r.clicks, impressions: r.impressions, position: r.position,
      })),
      error: saBody?.error ?? null,
    };

    return new Response(JSON.stringify(result, null, 2), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify(result, null, 2), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
