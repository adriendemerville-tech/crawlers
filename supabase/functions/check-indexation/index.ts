import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { resolveGoogleToken } from '../_shared/resolveGoogleToken.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface InspectionResult {
  page_url: string;
  verdict: string;
  coverage_state: string | null;
  indexing_state: string | null;
  crawled_as: string | null;
  last_crawl_time: string | null;
  robots_txt_state: string | null;
  page_fetch_state: string | null;
  rich_results_errors: any;
  referring_urls: string[];
}

async function inspectUrl(
  accessToken: string,
  pageUrl: string,
  siteUrl: string,
): Promise<InspectionResult> {
  const resp = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inspectionUrl: pageUrl,
      siteUrl: siteUrl,
    }),
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`GSC URL Inspection API error (${resp.status}): ${errBody.slice(0, 500)}`);
  }

  const data = await resp.json();
  const result = data.inspectionResult || {};
  const indexStatus = result.indexStatusResult || {};
  const richResults = result.richResultsResult || {};
  const mobileUsability = result.mobileUsabilityResult || {};

  // Extract rich results errors
  let richResultsErrors: any = null;
  if (richResults.detectedItems?.length) {
    const errors: any[] = [];
    for (const item of richResults.detectedItems) {
      if (item.items?.length) {
        for (const issue of item.items) {
          if (issue.issues?.length) {
            errors.push({
              richResultType: item.richResultType,
              issues: issue.issues.map((i: any) => ({
                severity: i.severity,
                message: i.issueMessage,
              })),
            });
          }
        }
      }
    }
    if (errors.length) richResultsErrors = errors;
  }

  return {
    page_url: pageUrl,
    verdict: indexStatus.verdict || 'VERDICT_UNSPECIFIED',
    coverage_state: indexStatus.coverageState || null,
    indexing_state: indexStatus.indexingState || null,
    crawled_as: indexStatus.crawlingUserAgent || null,
    last_crawl_time: indexStatus.lastCrawlTime || null,
    robots_txt_state: indexStatus.robotsTxtState || null,
    page_fetch_state: indexStatus.pageFetchState || null,
    rich_results_errors: richResultsErrors,
    referring_urls: indexStatus.referringUrls || [],
  };
}

async function resolveSiteUrl(accessToken: string, domain: string): Promise<string | null> {
  const bare = domain.replace(/^www\./, '').toLowerCase();
  const resp = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  if (!resp.ok) return null;

  const { siteEntry = [] } = await resp.json();
  const match = siteEntry.find((s: any) => {
    const su = s.siteUrl.toLowerCase();
    if (su === `sc-domain:${bare}`) return true;
    return su.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '') === bare;
  });
  return match?.siteUrl || null;
}

Deno.serve(handleRequest(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Not authenticated' }, 401);

    const supabase = getServiceClient();
    const userClient = getUserClient(authHeader);
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Invalid token' }, 401);

    const body = await req.json();
    const { action, tracked_site_id, urls } = body;

    // Get tracked site info
    const { data: site } = await supabase
      .from('tracked_sites')
      .select('domain, user_id')
      .eq('id', tracked_site_id)
      .eq('user_id', user.id)
      .single();

    if (!site) return json({ error: 'Site not found' }, 404);

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID') || '';
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';

    const resolved = await resolveGoogleToken(supabase, user.id, site.domain, clientId, clientSecret);
    if (!resolved) {
      return json({ error: 'Google not connected. Please connect GSC first.' }, 403);
    }

    const siteUrl = await resolveSiteUrl(resolved.access_token, site.domain);
    if (!siteUrl) {
      return json({ error: 'Site not found in GSC properties' }, 404);
    }

    if (action === 'inspect') {
      // Inspect specific URLs (manual mode)
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return json({ error: 'urls array required' }, 400);
      }
      if (urls.length > 50) {
        return json({ error: 'Max 50 URLs per request' }, 400);
      }

      const results: InspectionResult[] = [];
      const errors: { url: string; error: string }[] = [];

      for (const url of urls) {
        try {
          const result = await inspectUrl(resolved.access_token, url, siteUrl);
          results.push(result);

          // Upsert to DB
          await supabase.from('indexation_checks').upsert({
            tracked_site_id,
            user_id: user.id,
            page_url: url,
            verdict: result.verdict,
            coverage_state: result.coverage_state,
            indexing_state: result.indexing_state,
            crawled_as: result.crawled_as,
            last_crawl_time: result.last_crawl_time,
            robots_txt_state: result.robots_txt_state,
            page_fetch_state: result.page_fetch_state,
            rich_results_errors: result.rich_results_errors,
            referring_urls: result.referring_urls,
            checked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'tracked_site_id,page_url' });
        } catch (e: any) {
          errors.push({ url, error: e.message });
        }
      }

      return json({ success: true, results, errors, siteUrl });
    }

    if (action === 'scan-key-pages') {
      // Auto scan: get important pages from tracked site data
      const baseUrl = `https://${site.domain}`;
      
      // Get pages from sitemap or known routes
      const { data: crawlPages } = await supabase
        .from('crawl_pages')
        .select('url')
        .eq('tracked_site_id', tracked_site_id)
        .order('created_at', { ascending: false })
        .limit(30);

      let pagesToCheck: string[] = [];
      
      if (crawlPages?.length) {
        pagesToCheck = crawlPages.map((p: any) => p.url);
      } else {
        // Fallback: check common important pages
        pagesToCheck = [
          baseUrl,
          `${baseUrl}/`,
        ];
      }

      // Deduplicate
      pagesToCheck = [...new Set(pagesToCheck)].slice(0, 30);

      const results: InspectionResult[] = [];
      const errors: { url: string; error: string }[] = [];

      for (const url of pagesToCheck) {
        try {
          const result = await inspectUrl(resolved.access_token, url, siteUrl);
          results.push(result);

          await supabase.from('indexation_checks').upsert({
            tracked_site_id,
            user_id: user.id,
            page_url: url,
            verdict: result.verdict,
            coverage_state: result.coverage_state,
            indexing_state: result.indexing_state,
            crawled_as: result.crawled_as,
            last_crawl_time: result.last_crawl_time,
            robots_txt_state: result.robots_txt_state,
            page_fetch_state: result.page_fetch_state,
            rich_results_errors: result.rich_results_errors,
            referring_urls: result.referring_urls,
            checked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'tracked_site_id,page_url' });
        } catch (e: any) {
          errors.push({ url, error: e.message });
        }
      }

      return json({
        success: true,
        totalChecked: results.length,
        indexed: results.filter(r => r.verdict === 'PASS').length,
        notIndexed: results.filter(r => r.verdict !== 'PASS').length,
        results,
        errors,
      });
    }

    if (action === 'list') {
      const { data: checks } = await supabase
        .from('indexation_checks')
        .select('*')
        .eq('tracked_site_id', tracked_site_id)
        .eq('user_id', user.id)
        .order('checked_at', { ascending: false });

      return json({ success: true, checks: checks || [] });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e: any) {
    console.error('[check-indexation] Error:', e);
    return json({ error: e.message }, 500);
  }
}, 'check-indexation'))
