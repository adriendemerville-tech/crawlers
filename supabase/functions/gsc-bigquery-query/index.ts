/**
 * Edge Function: gsc-bigquery-query
 *
 * Phase 1 GSC BigQuery — generic pass-through query runner.
 *
 * Architecture:
 *   - ONE BigQuery connection at workspace level (Crawlers admin via Lovable connector)
 *   - Per-site config in `gsc_bigquery_config` (gcp_project_id, dataset_id)
 *   - Pre-defined query templates (kind) — clients NEVER pass raw SQL
 *   - Short-lived cache (6h) in `gsc_bigquery_cache`
 *
 * Modes:
 *   POST { action: 'verify', site_id }            → verify connectivity to client dataset
 *   POST { action: 'query', site_id, kind, params } → run a templated query (cached)
 *   POST { action: 'list_kinds' }                  → list available query templates
 *
 * Security:
 *   - JWT required, ownership check on site_id
 *   - NO raw SQL accepted from client
 *   - Every query enforces maximumBytesBilled
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  runBigQueryQuery,
  verifyBigQueryConfig,
  hashQuery,
  DEFAULT_MAX_BYTES_BILLED,
  SAFE_MAX_BYTES_BILLED,
} from '../_shared/bigqueryGateway.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CACHE_TTL_HOURS = 6;

// ─── Query templates ───
// All queries are partition-aware (data_date) and parameterized through string
// interpolation of validated params only. Clients NEVER pass raw SQL.
type QueryKind =
  | 'top_queries_30d'
  | 'top_queries_90d'
  | 'queries_by_url'
  | 'cannibalization_candidates'
  | 'longtail_opportunities'
  | 'ctr_gap_quickwins';

interface QueryParams {
  url?: string;        // exact page URL match
  url_prefix?: string; // page URL starts with
  query?: string;      // exact query match
  min_impressions?: number;
  limit?: number;
  days?: number;       // override window (capped)
}

const VALID_KINDS: QueryKind[] = [
  'top_queries_30d',
  'top_queries_90d',
  'queries_by_url',
  'cannibalization_candidates',
  'longtail_opportunities',
  'ctr_gap_quickwins',
];

function escapeStringForSQL(s: string): string {
  // BigQuery standard SQL: escape backslash and single quote
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function clampInt(n: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function buildQuery(
  kind: QueryKind,
  table: string,
  params: QueryParams,
): { sql: string; maxBytes: string } {
  const days = clampInt(params.days, 1, 365, kind === 'top_queries_90d' ? 90 : 30);
  const limit = clampInt(params.limit, 1, 5000, 500);
  const minImp = clampInt(params.min_impressions, 0, 10_000_000, 10);

  const dateFilter = `data_date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)`;

  switch (kind) {
    case 'top_queries_30d':
    case 'top_queries_90d': {
      return {
        sql: `
          SELECT
            query,
            SUM(impressions) AS impressions,
            SUM(clicks) AS clicks,
            SAFE_DIVIDE(SUM(clicks), SUM(impressions)) AS ctr,
            SAFE_DIVIDE(SUM(sum_position), SUM(impressions)) AS avg_position
          FROM \`${table}\`
          WHERE ${dateFilter}
          GROUP BY query
          HAVING impressions >= ${minImp}
          ORDER BY impressions DESC
          LIMIT ${limit}
        `,
        maxBytes: SAFE_MAX_BYTES_BILLED,
      };
    }

    case 'queries_by_url': {
      const url = params.url ? escapeStringForSQL(params.url) : null;
      const urlPrefix = params.url_prefix ? escapeStringForSQL(params.url_prefix) : null;
      if (!url && !urlPrefix) throw new Error('queries_by_url requires url or url_prefix');
      const urlClause = url
        ? `AND url = '${url}'`
        : `AND STARTS_WITH(url, '${urlPrefix}')`;
      return {
        sql: `
          SELECT
            query,
            url,
            SUM(impressions) AS impressions,
            SUM(clicks) AS clicks,
            SAFE_DIVIDE(SUM(clicks), SUM(impressions)) AS ctr,
            SAFE_DIVIDE(SUM(sum_position), SUM(impressions)) AS avg_position
          FROM \`${table}\`
          WHERE ${dateFilter}
            ${urlClause}
          GROUP BY query, url
          HAVING impressions >= ${minImp}
          ORDER BY impressions DESC
          LIMIT ${limit}
        `,
        maxBytes: SAFE_MAX_BYTES_BILLED,
      };
    }

    case 'cannibalization_candidates': {
      // Queries ranked by 2+ URLs in the window — the killer use case
      return {
        sql: `
          WITH per_query_url AS (
            SELECT
              query,
              url,
              SUM(impressions) AS impressions,
              SUM(clicks) AS clicks,
              SAFE_DIVIDE(SUM(sum_position), SUM(impressions)) AS avg_position
            FROM \`${table}\`
            WHERE ${dateFilter}
            GROUP BY query, url
            HAVING impressions >= ${minImp}
          ),
          ranked AS (
            SELECT
              query,
              url,
              impressions,
              clicks,
              avg_position,
              COUNT(*) OVER (PARTITION BY query) AS url_count,
              ROW_NUMBER() OVER (PARTITION BY query ORDER BY impressions DESC) AS rn
            FROM per_query_url
          )
          SELECT query, url, impressions, clicks, avg_position, url_count
          FROM ranked
          WHERE url_count >= 2
          ORDER BY url_count DESC, query, rn
          LIMIT ${limit}
        `,
        maxBytes: SAFE_MAX_BYTES_BILLED,
      };
    }

    case 'longtail_opportunities': {
      // Long queries (>= 4 words) with impressions but bad position — ranking near top of page 2
      return {
        sql: `
          SELECT
            query,
            SUM(impressions) AS impressions,
            SUM(clicks) AS clicks,
            SAFE_DIVIDE(SUM(sum_position), SUM(impressions)) AS avg_position,
            ARRAY_LENGTH(SPLIT(query, ' ')) AS word_count
          FROM \`${table}\`
          WHERE ${dateFilter}
          GROUP BY query
          HAVING impressions >= ${minImp}
            AND word_count >= 4
            AND SAFE_DIVIDE(SUM(sum_position), SUM(impressions)) BETWEEN 8 AND 25
          ORDER BY impressions DESC
          LIMIT ${limit}
        `,
        maxBytes: SAFE_MAX_BYTES_BILLED,
      };
    }

    case 'ctr_gap_quickwins': {
      // Pages with high impressions but poor CTR for their position — title/meta optimization targets
      return {
        sql: `
          SELECT
            url,
            query,
            SUM(impressions) AS impressions,
            SUM(clicks) AS clicks,
            SAFE_DIVIDE(SUM(clicks), SUM(impressions)) AS ctr,
            SAFE_DIVIDE(SUM(sum_position), SUM(impressions)) AS avg_position
          FROM \`${table}\`
          WHERE ${dateFilter}
          GROUP BY url, query
          HAVING impressions >= ${Math.max(minImp, 50)}
            AND SAFE_DIVIDE(SUM(sum_position), SUM(impressions)) <= 10
            AND SAFE_DIVIDE(SUM(clicks), SUM(impressions)) < 0.05
          ORDER BY impressions DESC
          LIMIT ${limit}
        `,
        maxBytes: SAFE_MAX_BYTES_BILLED,
      };
    }
  }
}

async function getCached(supabase: ReturnType<typeof createClient>, siteId: string, queryHash: string) {
  const { data } = await supabase
    .from('gsc_bigquery_cache')
    .select('*')
    .eq('site_id', siteId)
    .eq('query_hash', queryHash)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  return data;
}

async function setCached(
  supabase: ReturnType<typeof createClient>,
  siteId: string,
  queryHash: string,
  kind: string,
  payload: unknown,
  bytesProcessed: number,
  rowsReturned: number,
) {
  const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
  await supabase.from('gsc_bigquery_cache').upsert({
    site_id: siteId,
    query_hash: queryHash,
    query_kind: kind,
    result_payload: payload,
    bytes_processed: bytesProcessed,
    rows_returned: rowsReturned,
    expires_at: expiresAt,
  }, { onConflict: 'site_id,query_hash' });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === 'list_kinds') {
      return new Response(JSON.stringify({ kinds: VALID_KINDS }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const siteId = body.site_id;
    if (!siteId || typeof siteId !== 'string') {
      return new Response(JSON.stringify({ error: 'site_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Ownership check via user-scoped client (RLS enforced)
    const { data: site, error: siteErr } = await userClient
      .from('tracked_sites')
      .select('id, user_id, domain')
      .eq('id', siteId)
      .maybeSingle();
    if (siteErr || !site) {
      return new Response(JSON.stringify({ error: 'Site not found or access denied' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY);

    // Fetch BQ config for the site
    const { data: config } = await serviceClient
      .from('gsc_bigquery_config')
      .select('*')
      .eq('site_id', siteId)
      .eq('enabled', true)
      .maybeSingle();

    if (!config) {
      return new Response(JSON.stringify({
        error: 'No BigQuery configuration for this site',
        hint: 'Configure your GSC BigQuery export dataset in site settings.',
      }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── action: verify ───
    if (action === 'verify') {
      const result = await verifyBigQueryConfig({
        gcpProjectId: config.gcp_project_id,
        datasetId: config.dataset_id,
        tablePrefix: config.table_prefix,
      });
      await serviceClient
        .from('gsc_bigquery_config')
        .update({
          last_verified_at: new Date().toISOString(),
          last_verification_status: result.ok ? 'ok' : 'error',
          last_verification_error: result.error ?? null,
        })
        .eq('id', config.id);
      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── action: query ───
    if (action === 'query') {
      const kind = body.kind as QueryKind;
      if (!VALID_KINDS.includes(kind)) {
        return new Response(JSON.stringify({ error: `Invalid kind. Use one of: ${VALID_KINDS.join(', ')}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const params: QueryParams = body.params || {};
      const table = `${config.gcp_project_id}.${config.dataset_id}.${config.table_prefix}_${escapeStringForSQL(site.domain.replace(/[^a-z0-9]/gi, '_'))}`;
      // Note: GSC export uses one table per property — clients name them differently.
      // For Phase 1 we use `searchdata_site_impression` (the canonical site-level table) directly.
      const canonicalTable = `${config.gcp_project_id}.${config.dataset_id}.${config.table_prefix}`;

      let built;
      try {
        built = buildQuery(kind, canonicalTable, params);
      } catch (err) {
        return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const queryHash = await hashQuery(siteId, built.sql, kind);

      // Try cache first
      const cached = await getCached(serviceClient, siteId, queryHash);
      if (cached) {
        return new Response(JSON.stringify({
          rows: cached.result_payload,
          cache: 'hit',
          bytes_processed: cached.bytes_processed,
          rows_returned: cached.rows_returned,
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Run query
      const result = await runBigQueryQuery({
        gcpProjectId: config.gcp_project_id,
        query: built.sql,
        maxBytesBilled: built.maxBytes,
      });

      // Cache
      await setCached(serviceClient, siteId, queryHash, kind, result.rows, result.bytesProcessed, result.totalRows);

      return new Response(JSON.stringify({
        rows: result.rows,
        cache: 'miss',
        bytes_processed: result.bytesProcessed,
        rows_returned: result.totalRows,
        cache_hit_bq: result.cacheHit,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gsc-bigquery-query] error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
