/**
 * parmenion/types.ts — Strict types for Parménion orchestrator.
 * Replaces scattered `any` types throughout the orchestrator.
 */

export const MAX_RISK_NORMAL = 3;
export const MAX_RISK_CONSERVATIVE = 2;

export const PIPELINE_PHASES = ['audit', 'diagnose', 'prescribe', 'execute', 'validate'] as const;
export type PipelinePhase = typeof PIPELINE_PHASES[number];

export const PHASE_FUNCTIONS: Record<PipelinePhase, string[]> = {
  audit: ['audit-expert-seo', 'check-eeat', 'strategic-orchestrator', 'audit-strategique-ia', 'multi-page-crawl'],
  diagnose: ['cocoon-diag-content', 'cocoon-diag-semantic', 'cocoon-diag-structure', 'cocoon-diag-authority'],
  prescribe: ['cocoon-strategist', 'calculate-cocoon-logic', 'generate-corrective-code', 'content-architecture-advisor'],
  execute: ['wpsync', 'iktracker-actions', 'cms-push-draft', 'cms-push-code', 'cms-patch-content', 'cms-push-redirect', 'generate-corrective-code'],
  validate: ['audit-expert-seo', 'cocoon-diag-content', 'check-eeat'],
};

export const TIER_NAMES: Record<number, string> = {
  0: 'Accessibilité critique', 1: 'Performance', 2: 'Crawl mineur',
  3: 'Données structurées GEO', 4: 'On-page mineur (meta)',
  5: 'On-page majeur (contenu)', 6: 'Maillage interne',
  7: 'Cannibalisation', 8: 'Gap par modification',
  9: 'Gap par création', 10: 'Expansion sémantique',
};

export interface ParmenionDecision {
  goal: { type: string; cluster_id?: string; description: string };
  tactic: { initial_scope: any; final_scope: any; scope_reductions: number; estimated_tokens: number; target_url?: string };
  prudence: { impact_level: string; risk_score: number; iterations: number; goal_changed: boolean; reasoning: string };
  action: { type: string; payload: any; functions: string[] };
  summary: string;
}

export interface ScoredWorkbenchItem {
  id: string;
  title: string;
  description?: string;
  finding_category: string;
  severity: string;
  target_url?: string;
  target_selector?: string | null;
  target_operation?: string;
  action_type: string;
  payload?: Record<string, unknown>;
  source_type?: string;
  tier: number;
  base_score?: number;
  severity_bonus?: number;
  aging_bonus?: number;
  gate_malus?: number;
  spiral_score: number;
  created_at?: string;
  lane?: 'tech' | 'content';
  _detected_page_type?: string;
}

export interface SiteInfo {
  site_name?: string | null;
  market_sector?: string | null;
  business_type?: string | null;
  client_targets?: any;
  site_context?: string | null;
  target_audience?: string | null;
  products_services?: string | null;
  commercial_area?: string | null;
  entity_type?: string | null;
  commercial_model?: string | null;
  identity_confidence?: number | null;
  jargon_distance?: number | null;
}

export interface ActionReliability {
  total: number;
  errors: number;
  rate: number;
}

export function getNextPhase(lastPhase: PipelinePhase | undefined): PipelinePhase {
  if (!lastPhase) return 'audit';
  const idx = PIPELINE_PHASES.indexOf(lastPhase);
  if (idx === -1 || idx >= PIPELINE_PHASES.length - 1) return 'audit';
  return PIPELINE_PHASES[idx + 1];
}
