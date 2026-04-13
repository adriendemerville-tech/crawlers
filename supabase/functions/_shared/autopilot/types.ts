/**
 * autopilot/types.ts — Shared types and constants for autopilot-engine modules.
 */

export const COOLDOWN_HOURS = 2;
export const CYCLE_DEADLINE_MS = 8.5 * 60 * 1000; // 8.5 min watchdog
export const MAX_CMS_ACTIONS_PER_CYCLE = 10;

export type AnalyticsPayload = Record<string, unknown>;

export type ErrorSeverity = 'ignorable' | 'degraded' | 'critical';

export interface ExecutionError {
  phase: string;
  function: string;
  severity: ErrorSeverity;
  message: string;
  retryable: boolean;
  detail?: unknown;
}

export type CycleStatus = 'completed' | 'degraded' | 'partial' | 'failed';

export type IktrackerPushInput = {
  trackedSiteId: string;
  userId: string;
  domain: string;
  cycleNumber: number;
  pipelinePhase: string;
  finalStatus: string;
  executionSuccess: boolean;
  message: string;
  targetUrl?: string | null;
  functions?: string[];
  details?: Record<string, unknown>;
};

export type RoutedActions = {
  content: Array<Record<string, unknown>>;
  code: Array<Record<string, unknown>>;
  all: Array<Record<string, unknown>>;
};

/** Site info fetched from tracked_sites */
export interface SiteInfo {
  domain: string;
  site_name: string | null;
  market_sector: string | null;
  products_services: string | null;
  target_audience: string | null;
  entity_type: string | null;
  commercial_model: string | null;
}

/** Autopilot config row */
export interface AutopilotConfig {
  id: string;
  tracked_site_id: string;
  user_id: string;
  implementation_mode: string | null;
  max_pages_per_cycle: number | null;
  cooldown_hours: number | null;
  auto_pause_threshold: number | null;
  last_cycle_at: string | null;
  total_cycles_run: number | null;
  status: string | null;
  force_content_cycle: boolean | null;
  content_budget_pct: number | null;
  force_iktracker_article: boolean | null;
}

export function computeCycleStatus(errors: ExecutionError[]): CycleStatus {
  if (errors.some(e => e.severity === 'critical')) return 'failed';
  if (errors.some(e => e.severity === 'degraded')) return 'degraded';
  return 'completed';
}

export function classifyFuncError(funcName: string, isOnlyFailure: boolean): ErrorSeverity {
  if (['generate-image', 'cms-push-code'].includes(funcName)) return 'ignorable';
  if (['iktracker-actions', 'cms-push-draft', 'cms-patch-content'].includes(funcName) && isOnlyFailure) return 'critical';
  return 'degraded';
}
