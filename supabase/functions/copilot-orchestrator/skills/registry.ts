/**
 * skills/registry.ts — Registre central des skills disponibles.
 *
 * Chaque skill est une fonction async (input, ctx) → output.
 * Sprint 1 : 2 skills minimaux pour valider l'architecture.
 * Sprints suivants ajouteront read_*, analyze_*, cms_*.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export interface SkillContext {
  userId: string;
  sessionId: string;
  persona: string;
  supabase: SupabaseClient;
}

export interface SkillResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

export type SkillHandler = (input: Record<string, unknown>, ctx: SkillContext) => Promise<SkillResult>;

// ─── read_audit ──────────────────────────────────────────────
const read_audit: SkillHandler = async (input, ctx) => {
  const auditId = String(input.audit_id ?? '');
  if (!auditId) return { ok: false, error: 'audit_id requis' };

  const { data, error } = await ctx.supabase
    .from('expert_audits')
    .select('id, url, score, created_at, raw_payload')
    .eq('id', auditId)
    .eq('user_id', ctx.userId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Audit introuvable' };
  return { ok: true, data };
};

// ─── navigate_to ─────────────────────────────────────────────
const navigate_to: SkillHandler = async (input) => {
  const path = String(input.path ?? '');
  if (!path.startsWith('/')) return { ok: false, error: 'path doit commencer par /' };
  // L'orchestrateur retourne juste la directive. Le frontend exécute la navigation.
  return { ok: true, data: { action: 'navigate', path } };
};

// ─── Registry ────────────────────────────────────────────────
const SKILLS: Record<string, SkillHandler> = {
  read_audit,
  navigate_to,
};

export function getSkill(name: string): SkillHandler | null {
  return SKILLS[name] ?? null;
}

export function listSkills(): string[] {
  return Object.keys(SKILLS);
}
