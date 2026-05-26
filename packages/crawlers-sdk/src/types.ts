/**
 * The 18 features exposed by the Crawlers API.
 * Each costs 0.10 € per job (debited from your wallet).
 */
export type CrawlersFeature =
  | 'geo_score'
  | 'eeat'
  | 'pagespeed'
  | 'audit_expert'
  | 'semantic_audit'
  | 'serp_ranking'
  | 'serp_scan'
  | 'audit_matrix'
  | 'competitors'
  | 'llm_visibility'
  | 'site_crawl'
  | 'fan_out_detection'
  | 'backlink_audit'
  | 'keyword_universe'
  | 'content_brief'
  | 'cocoon_map'
  | 'bot_traffic'
  | 'ai_citations';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'canceled';

export interface JobCreateInput {
  feature: CrawlersFeature;
  url?: string;
  domain?: string;
  keyword?: string;
  /** Free-form options forwarded to the feature handler. */
  options?: Record<string, unknown>;
  /** Optional webhook URL — overrides account default. */
  webhook_url?: string;
}

export interface Job<T = unknown> {
  id: string;
  feature: CrawlersFeature;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  cost_cents: number;
  input: JobCreateInput;
  result: T | null;
  error: { code: string; message: string } | null;
}

export interface WalletBalance {
  balance_cents: number;
  currency: 'EUR';
  estimated_jobs_remaining: number;
  updated_at: string;
}

export interface ClientOptions {
  /** Your Crawlers API key — starts with `crw_live_`. */
  apiKey: string;
  /** Override the base URL. Defaults to `https://api.crawlers.fr`. */
  baseUrl?: string;
  /** Per-request timeout in ms. Defaults to 30 000. */
  timeoutMs?: number;
  /** Custom fetch (e.g. for testing). Defaults to `globalThis.fetch`. */
  fetch?: typeof fetch;
}

export interface WaitOptions {
  /** Poll interval in ms. Defaults to 2000. */
  intervalMs?: number;
  /** Hard timeout in ms. Defaults to 5 minutes. */
  timeoutMs?: number;
  /** Called on every poll with the latest job snapshot. */
  onProgress?: (job: Job) => void;
}
