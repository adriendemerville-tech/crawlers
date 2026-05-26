/**
 * Catalogue exhaustif des features Crawlers API (cf. /v1/features).
 * Chaque job coûte 0,10 € débité du wallet.
 */
export type CrawlersFeature =
  | 'audit_expert'
  | 'machine_layer'
  | 'eeat'
  | 'site_crawl'
  | 'pagespeed'
  | 'audit_matrix'
  | 'semantic_audit'
  | 'cocoon'
  | 'content_architect'
  | 'autopilot_status'
  | 'conversion_optimizer'
  | 'social_hub'
  | 'geo_score'
  | 'llm_visibility'
  | 'ai_bots_analysis'
  | 'observatory'
  | 'serp_ranking'
  | 'competitors';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface FeatureDescriptor {
  id: CrawlersFeature;
  status: 'stable' | 'preview' | 'soon';
  desc: string;
  input: Record<string, string>;
}

export interface JobCreateInput {
  feature: CrawlersFeature;
  /** Payload spécifique à la feature (url, domain, keyword, …). */
  input: Record<string, unknown>;
}

export interface JobCreated {
  id: string;
  feature: CrawlersFeature;
  status: JobStatus;
  created_at: string;
  cost_cents: number;
  poll_url: string;
}

export interface Job<T = unknown> {
  id: string;
  feature: CrawlersFeature;
  status: JobStatus;
  input: Record<string, unknown>;
  result: T | null;
  error: { message: string } | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface WalletBalance {
  balance_cents: number;
  currency: 'EUR';
  estimated_jobs_remaining: number;
  updated_at: string;
}

export interface ClientOptions {
  /** Clé API — préfixe `crw_live_`. */
  apiKey: string;
  /** Base URL Crawlers API. Défaut : `https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/crawlers-api`. */
  baseUrl?: string;
  /** Timeout par requête en ms (défaut 30 000). */
  timeoutMs?: number;
  /** Fetch custom (test). */
  fetch?: typeof fetch;
}

export interface WaitOptions {
  intervalMs?: number;
  timeoutMs?: number;
  onProgress?: (job: Job) => void;
}
