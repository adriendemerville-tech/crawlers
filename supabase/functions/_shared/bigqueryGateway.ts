/**
 * Shared helper for calling BigQuery via the Lovable Connector Gateway.
 *
 * Auth model: ONE BigQuery connection at workspace level (Crawlers admin).
 * Per-site config (gcp_project_id / dataset_id) lives in `gsc_bigquery_config`.
 *
 * Cost guards:
 *   - `maximumBytesBilled` is REQUIRED on every query
 *   - `dryRun` available to estimate scan size
 *   - Always `useLegacySql: false`
 */

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/bigquery/bigquery/v2';

export const DEFAULT_MAX_BYTES_BILLED = '1073741824'; // 1 GB
export const SAFE_MAX_BYTES_BILLED = '5368709120';     // 5 GB
export const HARD_MAX_BYTES_BILLED = '21474836480';    // 20 GB (admin only)

export interface BigQueryRow {
  f: Array<{ v: string | null | object }>;
}

export interface BigQueryQueryResponse {
  kind: string;
  schema?: { fields: Array<{ name: string; type: string; mode?: string }> };
  jobReference?: { projectId: string; jobId: string };
  totalRows?: string;
  rows?: BigQueryRow[];
  totalBytesProcessed?: string;
  jobComplete?: boolean;
  cacheHit?: boolean;
  errors?: Array<{ message: string; reason?: string }>;
}

export interface NormalizedRow {
  [columnName: string]: string | number | null;
}

export interface RunQueryOptions {
  gcpProjectId: string;
  query: string;
  maxBytesBilled?: string;
  dryRun?: boolean;
  timeoutMs?: number;
}

export interface RunQueryResult {
  rows: NormalizedRow[];
  totalRows: number;
  bytesProcessed: number;
  cacheHit: boolean;
  schema: Array<{ name: string; type: string }>;
  dryRun: boolean;
}

function getRequiredEnv(): { lovableKey: string; bqKey: string } {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableKey) throw new Error('LOVABLE_API_KEY is not configured');
  const bqKey = Deno.env.get('BIGQUERY_API_KEY');
  if (!bqKey) throw new Error('BIGQUERY_API_KEY is not configured (BigQuery connector not linked)');
  return { lovableKey, bqKey };
}

/**
 * Convert raw BigQuery response rows (positional) into named objects.
 */
function normalizeRows(resp: BigQueryQueryResponse): NormalizedRow[] {
  if (!resp.rows || !resp.schema) return [];
  const fields = resp.schema.fields;
  return resp.rows.map((row) => {
    const out: NormalizedRow = {};
    row.f.forEach((cell, idx) => {
      const field = fields[idx];
      if (!field) return;
      const raw = cell?.v;
      if (raw === null || raw === undefined) {
        out[field.name] = null;
        return;
      }
      // Numeric types
      if (['INTEGER', 'INT64', 'FLOAT', 'FLOAT64', 'NUMERIC'].includes(field.type)) {
        const n = Number(raw);
        out[field.name] = Number.isFinite(n) ? n : null;
      } else {
        out[field.name] = raw as string;
      }
    });
    return out;
  });
}

/**
 * Run a synchronous query against BigQuery via the gateway.
 * Always enforces `maximumBytesBilled` and `useLegacySql: false`.
 */
export async function runBigQueryQuery(opts: RunQueryOptions): Promise<RunQueryResult> {
  const { lovableKey, bqKey } = getRequiredEnv();
  const maxBytes = opts.maxBytesBilled || DEFAULT_MAX_BYTES_BILLED;
  const url = `${GATEWAY_URL}/projects/${encodeURIComponent(opts.gcpProjectId)}/queries`;

  const body: Record<string, unknown> = {
    query: opts.query,
    useLegacySql: false,
    maximumBytesBilled: maxBytes,
    timeoutMs: opts.timeoutMs ?? 30_000,
  };
  if (opts.dryRun) body.dryRun = true;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableKey}`,
      'X-Connection-Api-Key': bqKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await resp.text();
  let data: BigQueryQueryResponse & { error?: { message: string } };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`BigQuery gateway returned non-JSON [${resp.status}]: ${text.slice(0, 500)}`);
  }

  if (!resp.ok) {
    const msg = data?.error?.message || data?.errors?.[0]?.message || text.slice(0, 500);
    throw new Error(`BigQuery query failed [${resp.status}]: ${msg}`);
  }

  if (data.errors?.length) {
    throw new Error(`BigQuery returned errors: ${data.errors.map((e) => e.message).join('; ')}`);
  }

  return {
    rows: opts.dryRun ? [] : normalizeRows(data),
    totalRows: Number(data.totalRows ?? 0),
    bytesProcessed: Number(data.totalBytesProcessed ?? 0),
    cacheHit: Boolean(data.cacheHit),
    schema: data.schema?.fields?.map((f) => ({ name: f.name, type: f.type })) ?? [],
    dryRun: Boolean(opts.dryRun),
  };
}

/**
 * Verify credentials + dataset accessibility for a given config.
 * Cheap: hits INFORMATION_SCHEMA.TABLES which is free.
 */
export async function verifyBigQueryConfig(params: {
  gcpProjectId: string;
  datasetId: string;
  tablePrefix: string;
}): Promise<{ ok: boolean; tablesFound: number; sampleTable?: string; error?: string }> {
  try {
    const sql = `
      SELECT table_name
      FROM \`${params.gcpProjectId}.${params.datasetId}.INFORMATION_SCHEMA.TABLES\`
      WHERE table_name LIKE '${params.tablePrefix}%'
      LIMIT 5
    `;
    const result = await runBigQueryQuery({
      gcpProjectId: params.gcpProjectId,
      query: sql,
      maxBytesBilled: '10485760', // 10 MB safety net (INFO_SCHEMA is free anyway)
    });
    return {
      ok: result.totalRows > 0,
      tablesFound: result.totalRows,
      sampleTable: result.rows[0]?.table_name as string | undefined,
    };
  } catch (err) {
    return {
      ok: false,
      tablesFound: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Compute a stable hash for cache lookup.
 */
export async function hashQuery(siteId: string, query: string, kind: string): Promise<string> {
  const data = new TextEncoder().encode(`${siteId}::${kind}::${query.replace(/\s+/g, ' ').trim()}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
