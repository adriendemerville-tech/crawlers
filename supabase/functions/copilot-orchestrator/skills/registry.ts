/**
 * skills/registry.ts — Registre central des skills du Copilot.
 *
 * Sprint 2 : registry étendu (lecture + navigation + UI) + définitions JSON Schema
 * pour le tool calling LLM. Toute exécution passe obligatoirement par RLS via
 * `ctx.supabase` (client utilisateur) — jamais service role.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export interface SkillContext {
  userId: string;
  sessionId: string;
  persona: string;
  supabase: SupabaseClient;        // client RLS de l'utilisateur courant
  service: SupabaseClient;          // service role (pour cross-table reads contrôlés)
}

export interface SkillResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

export type SkillHandler = (input: Record<string, unknown>, ctx: SkillContext) => Promise<SkillResult>;

export interface SkillDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: SkillHandler;
}

// ═══════════════════════════════════════════════════════════
// LECTURE
// ═══════════════════════════════════════════════════════════

const read_audit: SkillDefinition = {
  name: 'read_audit',
  description: "Lit un audit expert SEO de l'utilisateur (score, URL, payload résumé).",
  parameters: {
    type: 'object',
    properties: {
      audit_id: { type: 'string', description: "UUID de l'audit" },
    },
    required: ['audit_id'],
  },
  handler: async (input, ctx) => {
    const auditId = String(input.audit_id ?? '');
    if (!auditId) return { ok: false, error: 'audit_id requis' };
    const { data, error } = await ctx.supabase
      .from('expert_audits')
      .select('id, url, score, created_at, raw_payload')
      .eq('id', auditId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: 'Audit introuvable' };
    // Tronquer le raw_payload pour ne pas exploser la fenêtre LLM
    const truncated = { ...data, raw_payload: summarizePayload(data.raw_payload) };
    return { ok: true, data: truncated };
  },
};

const read_site_kpis: SkillDefinition = {
  name: 'read_site_kpis',
  description: "Lit les KPIs courants d'un site suivi (SEO, GEO, trafic, dernière mesure).",
  parameters: {
    type: 'object',
    properties: {
      tracked_site_id: { type: 'string', description: "UUID du site suivi" },
    },
    required: ['tracked_site_id'],
  },
  handler: async (input, ctx) => {
    const siteId = String(input.tracked_site_id ?? '');
    if (!siteId) return { ok: false, error: 'tracked_site_id requis' };
    const { data, error } = await ctx.supabase
      .from('tracked_sites')
      .select('id, domain, seo_score, geo_score, last_audit_at, business_profile')
      .eq('id', siteId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: 'Site introuvable ou non accessible' };
    return { ok: true, data };
  },
};

const read_cocoon_graph: SkillDefinition = {
  name: 'read_cocoon_graph',
  description: "Statistiques résumées du graphe cocoon : nb pages, orphelines, profondeur, cannibalisations.",
  parameters: {
    type: 'object',
    properties: {
      tracked_site_id: { type: 'string' },
    },
    required: ['tracked_site_id'],
  },
  handler: async (input, ctx) => {
    const siteId = String(input.tracked_site_id ?? '');
    const { data, error } = await ctx.supabase
      .from('cocoon_graph_summary')
      .select('total_pages, orphan_pages, max_depth, cannibalizations, last_calculated_at')
      .eq('tracked_site_id', siteId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data ?? { message: 'Pas encore de cocoon calculé' } };
  },
};

const read_documentation: SkillDefinition = {
  name: 'read_documentation',
  description: "Recherche dans la base de connaissance (lexique, guides, FAQ) par mot-clé.",
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Mots-clés à chercher' },
      limit: { type: 'number', default: 5 },
    },
    required: ['query'],
  },
  handler: async (input, ctx) => {
    const query = String(input.query ?? '').trim();
    const limit = Math.min(Number(input.limit ?? 5), 10);
    if (!query) return { ok: false, error: 'query requis' };
    const { data, error } = await ctx.service
      .from('lexique_terms')
      .select('term, definition, category')
      .or(`term.ilike.%${query}%,definition.ilike.%${query}%`)
      .limit(limit);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { results: data ?? [], count: data?.length ?? 0 } };
  },
};

// ═══════════════════════════════════════════════════════════
// NAVIGATION (directives renvoyées au frontend)
// ═══════════════════════════════════════════════════════════

const navigate_to: SkillDefinition = {
  name: 'navigate_to',
  description: "Demande au frontend d'aller sur un chemin de l'app (ex: /app/cocoon).",
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: "Chemin commençant par /" },
      reason: { type: 'string', description: "Pourquoi on y va" },
    },
    required: ['path'],
  },
  handler: async (input) => {
    const path = String(input.path ?? '');
    if (!path.startsWith('/')) return { ok: false, error: 'path doit commencer par /' };
    return { ok: true, data: { action: 'navigate', path, reason: input.reason ?? null } };
  },
};

const open_audit_panel: SkillDefinition = {
  name: 'open_audit_panel',
  description: "Ouvre le panneau d'un audit dans l'UI courante.",
  parameters: {
    type: 'object',
    properties: { audit_id: { type: 'string' } },
    required: ['audit_id'],
  },
  handler: async (input) => ({
    ok: true,
    data: { action: 'open_panel', target: 'audit', audit_id: input.audit_id },
  }),
};

// ═══════════════════════════════════════════════════════════
// ACTIONS NÉCESSITANT APPROBATION (handlers stubs Sprint 2)
// La policy 'approval' empêche l'exécution directe — voir orchestrator.
// ═══════════════════════════════════════════════════════════

const trigger_audit: SkillDefinition = {
  name: 'trigger_audit',
  description: "Lance un audit expert SEO pour une URL donnée (consomme des crédits).",
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string' },
      audit_type: { type: 'string', enum: ['expert', 'eeat', 'strategique'] },
    },
    required: ['url', 'audit_type'],
  },
  handler: async (input) => ({
    ok: true,
    data: { pending_action: 'trigger_audit', input },
  }),
};

const cms_publish_draft: SkillDefinition = {
  name: 'cms_publish_draft',
  description: "Publie un brouillon de page SEO via le bridge CMS approprié.",
  parameters: {
    type: 'object',
    properties: { draft_id: { type: 'string' } },
    required: ['draft_id'],
  },
  handler: async (input) => ({
    ok: true,
    data: { pending_action: 'cms_publish_draft', input },
  }),
};

const cms_patch_content: SkillDefinition = {
  name: 'cms_patch_content',
  description: "Modifie un contenu CMS existant (HTML diff exigé avant exécution).",
  parameters: {
    type: 'object',
    properties: {
      target_url: { type: 'string' },
      patch: { type: 'object' },
    },
    required: ['target_url', 'patch'],
  },
  handler: async (input) => ({
    ok: true,
    data: { pending_action: 'cms_patch_content', input },
  }),
};

// ═══════════════════════════════════════════════════════════
// REGISTRY
// ═══════════════════════════════════════════════════════════

const SKILLS: Record<string, SkillDefinition> = {
  read_audit,
  read_site_kpis,
  read_cocoon_graph,
  read_documentation,
  navigate_to,
  open_audit_panel,
  trigger_audit,
  cms_publish_draft,
  cms_patch_content,
};

export function getSkill(name: string): SkillDefinition | null {
  return SKILLS[name] ?? null;
}

export function listSkills(): string[] {
  return Object.keys(SKILLS);
}

/** Construit le tableau `tools` au format OpenAI/Lovable AI pour les skills autorisés. */
export function buildToolDefinitions(allowedSkillNames: string[]): unknown[] {
  return allowedSkillNames
    .map((name) => SKILLS[name])
    .filter(Boolean)
    .map((s) => ({
      type: 'function',
      function: { name: s.name, description: s.description, parameters: s.parameters },
    }));
}

// ─── Helpers ────────────────────────────────────────────────
function summarizePayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload;
  const p = payload as Record<string, unknown>;
  // Garde score/résumé/recommandations top-level, tronque le reste à des clés.
  const out: Record<string, unknown> = {};
  for (const key of ['score', 'summary', 'recommendations', 'critical_issues', 'metrics']) {
    if (key in p) out[key] = p[key];
  }
  out._other_keys = Object.keys(p).filter((k) => !(k in out));
  return out;
}
