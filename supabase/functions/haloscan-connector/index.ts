import { corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { trackPaidApiCall } from '../_shared/tokenTracker.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * haloscan-connector: Interface with HaloScan SEO API
 * Base URL: https://api.haloscan.com/api
 * Auth: header haloscan-api-key
 * 
 * Actions:
 * - test_connection: Validate API key via user_credit
 * - keywords_overview: Full keyword data (volume, CPC, SERP, trends)
 * - keywords_questions: Question-based queries for a keyword
 * - keywords_related: Related keywords
 * - keywords_similar: Similar keywords
 * - keywords_bulk: Bulk keyword metrics
 * - domains_overview: Domain SEO summary (visibility, traffic, keywords)
 * - domains_positions: Keyword positions for a domain
 * - domains_top_pages: Top pages by traffic
 * - domains_competitors: Domain competitors
 * - domains_visibility_trends: Visibility over time
 * - domains_expired: Expired domains discovery
 */

const HALOSCAN_BASE = 'https://api.haloscan.com/api';

interface HaloScanRequestOptions {
  endpoint: string;
  apiKey: string;
  body?: Record<string, unknown>;
  method?: 'GET' | 'POST';
}

async function callHaloScan({ endpoint, apiKey, body, method = 'POST' }: HaloScanRequestOptions): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'haloscan-api-key': apiKey,
      },
      signal: controller.signal,
    };

    if (method === 'POST' && body) {
      options.body = JSON.stringify(body);
    }

    const resp = await fetch(`${HALOSCAN_BASE}/${endpoint}`, options);
    clearTimeout(timeout);

    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`HaloScan ${resp.status}: ${errorText}`);
    }

    return await resp.json();
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

// ── Action handlers ──

async function handleTestConnection(apiKey: string) {
  const data = await callHaloScan({ endpoint: 'user_credit', apiKey, method: 'GET' });
  return { success: true, credits: data };
}

async function handleKeywordsOverview(apiKey: string, params: any) {
  const { keyword, country_code = 'FR', requested_data } = params;
  if (!keyword) throw new Error('Missing keyword');

  const body: Record<string, unknown> = {
    keyword,
    country_code,
  };
  if (requested_data) body.requested_data = requested_data;

  const data = await callHaloScan({ endpoint: 'keywords_overview', apiKey, body });
  trackPaidApiCall('haloscan-connector', 'haloscan', 'keywords_overview');
  return data;
}

async function handleKeywordsQuestions(apiKey: string, params: any) {
  const { keyword, country_code = 'FR', lines = 50 } = params;
  if (!keyword) throw new Error('Missing keyword');

  const data = await callHaloScan({
    endpoint: 'keywords_questions',
    apiKey,
    body: { keyword, country_code, lines },
  });
  trackPaidApiCall('haloscan-connector', 'haloscan', 'keywords_questions');
  return data;
}

async function handleKeywordsRelated(apiKey: string, params: any) {
  const { keyword, country_code = 'FR', lines = 50 } = params;
  if (!keyword) throw new Error('Missing keyword');

  const data = await callHaloScan({
    endpoint: 'keywords_related',
    apiKey,
    body: { keyword, country_code, lines },
  });
  trackPaidApiCall('haloscan-connector', 'haloscan', 'keywords_related');
  return data;
}

async function handleKeywordsSimilar(apiKey: string, params: any) {
  const { keyword, country_code = 'FR', lines = 50 } = params;
  if (!keyword) throw new Error('Missing keyword');

  const data = await callHaloScan({
    endpoint: 'keywords_similar',
    apiKey,
    body: { keyword, country_code, lines },
  });
  trackPaidApiCall('haloscan-connector', 'haloscan', 'keywords_similar');
  return data;
}

async function handleKeywordsBulk(apiKey: string, params: any) {
  const { keywords, country_code = 'FR' } = params;
  if (!keywords || !Array.isArray(keywords)) throw new Error('Missing keywords array');

  const data = await callHaloScan({
    endpoint: 'keywords_bulk',
    apiKey,
    body: { keywords, country_code },
  });
  trackPaidApiCall('haloscan-connector', 'haloscan', 'keywords_bulk');
  return data;
}

async function handleDomainsOverview(apiKey: string, params: any) {
  const { input, mode = 'root', country_code = 'FR', requested_data } = params;
  if (!input) throw new Error('Missing input (domain)');

  const body: Record<string, unknown> = {
    input,
    mode,
    country_code,
  };
  if (requested_data) body.requested_data = requested_data;

  const data = await callHaloScan({ endpoint: 'domains_overview', apiKey, body });
  trackPaidApiCall('haloscan-connector', 'haloscan', 'domains_overview');
  return data;
}

async function handleDomainsPositions(apiKey: string, params: any) {
  const { input, mode = 'root', country_code = 'FR', lines = 100, offset = 0, sort_field, sort_order } = params;
  if (!input) throw new Error('Missing input (domain)');

  const body: Record<string, unknown> = { input, mode, country_code, lines, offset };
  if (sort_field) body.sort_field = sort_field;
  if (sort_order) body.sort_order = sort_order;

  const data = await callHaloScan({ endpoint: 'domains_positions', apiKey, body });
  trackPaidApiCall('haloscan-connector', 'haloscan', 'domains_positions');
  return data;
}

async function handleDomainsTopPages(apiKey: string, params: any) {
  const { input, mode = 'root', country_code = 'FR', lines = 50 } = params;
  if (!input) throw new Error('Missing input (domain)');

  const data = await callHaloScan({
    endpoint: 'domains_top_pages',
    apiKey,
    body: { input, mode, country_code, lines },
  });
  trackPaidApiCall('haloscan-connector', 'haloscan', 'domains_top_pages');
  return data;
}

async function handleDomainsCompetitors(apiKey: string, params: any) {
  const { input, mode = 'root', country_code = 'FR' } = params;
  if (!input) throw new Error('Missing input (domain)');

  const data = await callHaloScan({
    endpoint: 'domains_competitors',
    apiKey,
    body: { input, mode, country_code },
  });
  trackPaidApiCall('haloscan-connector', 'haloscan', 'domains_competitors');
  return data;
}

async function handleDomainsVisibilityTrends(apiKey: string, params: any) {
  const { input, mode = 'root', country_code = 'FR' } = params;
  if (!input) throw new Error('Missing input (domain)');

  const data = await callHaloScan({
    endpoint: 'domains_visibility_trends',
    apiKey,
    body: { input, mode, country_code },
  });
  trackPaidApiCall('haloscan-connector', 'haloscan', 'domains_visibility_trends');
  return data;
}

async function handleDomainsExpired(apiKey: string, params: any) {
  const { keyword, country_code = 'FR', lines = 50 } = params;

  const body: Record<string, unknown> = { country_code, lines };
  if (keyword) body.keyword = keyword;

  const data = await callHaloScan({ endpoint: 'domains_expired', apiKey, body });
  trackPaidApiCall('haloscan-connector', 'haloscan', 'domains_expired');
  return data;
}

// ── Main handler ──

Deno.serve(handleRequest(async (req) => {
try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return jsonError('Unauthorized', 401);
    }

    const { action, ...params } = await req.json();

    // API key: global secret or per-user (future: haloscan_connections table)
    const apiKey = Deno.env.get('HALOSCAN_API_KEY');
    if (!apiKey) {
      return jsonError('HaloScan API key not configured', 500);
    }

    let result: any;

    switch (action) {
      case 'test_connection':
        result = await handleTestConnection(apiKey);
        break;
      case 'keywords_overview':
        result = await handleKeywordsOverview(apiKey, params);
        break;
      case 'keywords_questions':
        result = await handleKeywordsQuestions(apiKey, params);
        break;
      case 'keywords_related':
        result = await handleKeywordsRelated(apiKey, params);
        break;
      case 'keywords_similar':
        result = await handleKeywordsSimilar(apiKey, params);
        break;
      case 'keywords_bulk':
        result = await handleKeywordsBulk(apiKey, params);
        break;
      case 'domains_overview':
        result = await handleDomainsOverview(apiKey, params);
        break;
      case 'domains_positions':
        result = await handleDomainsPositions(apiKey, params);
        break;
      case 'domains_top_pages':
        result = await handleDomainsTopPages(apiKey, params);
        break;
      case 'domains_competitors':
        result = await handleDomainsCompetitors(apiKey, params);
        break;
      case 'domains_visibility_trends':
        result = await handleDomainsVisibilityTrends(apiKey, params);
        break;
      case 'domains_expired':
        result = await handleDomainsExpired(apiKey, params);
        break;
      default:
        return new Response(JSON.stringify({
          error: `Unknown action: ${action}`,
          available_actions: [
            'test_connection',
            'keywords_overview', 'keywords_questions', 'keywords_related', 'keywords_similar', 'keywords_bulk',
            'domains_overview', 'domains_positions', 'domains_top_pages', 'domains_competitors',
            'domains_visibility_trends', 'domains_expired',
          ],
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    console.log(`[haloscan-connector] ✅ ${action} completed for user ${auth.id}`);

    return jsonOk({ data: result });

  } catch (error) {
    console.error('[haloscan-connector] Error:', error);
    return jsonError(error instanceof Error ? error.message : 'Unknown error', 500);
  }
}));