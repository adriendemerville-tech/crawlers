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
// safeServiceCall — wrapper qui IMPOSE la vérification d'appartenance
// avant tout appel utilisant le service role (qui bypass RLS).
//
// Tout handler d'écriture qui veut utiliser ctx.service DOIT passer par ici.
// Le handler reçoit en 2e argument le client service uniquement après que
// l'appartenance du tracked_site_id a été validée côté serveur.
//
// Si tracked_site_id est manquant, invalide, ou n'appartient pas à userId,
// le wrapper renvoie une erreur AVANT d'invoquer le handler.
// Cela rend impossible un oubli de check dans un nouveau handler.
// ═══════════════════════════════════════════════════════════
export async function safeServiceCall<T = unknown>(
  ctx: SkillContext,
  trackedSiteId: string | null | undefined,
  handler: (service: SkillContext['service'], site: { id: string; user_id: string; domain: string }) => Promise<SkillResult & { data?: T }>,
): Promise<SkillResult & { data?: T }> {
  if (!trackedSiteId || typeof trackedSiteId !== 'string') {
    return { ok: false, error: 'tracked_site_id requis pour les opérations service-role' };
  }

  // Vérification UNIQUE et CENTRALE de propriété via la fonction SECURITY DEFINER.
  // On utilise ctx.service ici car owns_tracked_site() lit auth.uid() côté Postgres
  // — mais comme on est en edge function on doit la requêter manuellement.
  const { data: site, error } = await ctx.service
    .from('tracked_sites')
    .select('id, user_id, domain')
    .eq('id', trackedSiteId)
    .maybeSingle();

  if (error) return { ok: false, error: `Vérif site : ${error.message}` };
  if (!site) return { ok: false, error: 'Site introuvable' };
  if (site.user_id !== ctx.userId) {
    // Audit log : tentative d'accès cross-tenant
    await ctx.service.from('copilot_actions').insert({
      session_id: ctx.sessionId, user_id: ctx.userId, persona: ctx.persona,
      skill: '_security_violation', input: { attempted_site_id: trackedSiteId },
      status: 'rejected',
      error_message: `Tentative d'accès au site ${trackedSiteId} appartenant à un autre utilisateur`,
    }).then(() => {}).catch(() => {});
    return { ok: false, error: 'Site non accessible (propriété refusée)' };
  }

  return await handler(ctx.service, site as { id: string; user_id: string; domain: string });
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
    // Table réelle : `audits` (cf. save-audit/index.ts).
    const { data, error } = await ctx.supabase
      .from('audits')
      .select('id, url, domain, sector, payment_status, fixes_count, dynamic_price, audit_data, created_at')
      .eq('id', auditId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: 'Audit introuvable' };
    // Tronquer audit_data pour ne pas exploser la fenêtre LLM.
    const truncated = { ...data, audit_data: summarizePayload(data.audit_data) };
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
    // Colonnes réelles de tracked_sites (pas de seo_score/geo_score directement).
    const { data: site, error } = await ctx.supabase
      .from('tracked_sites')
      .select('id, domain, site_name, brand_name, last_audit_at, eeat_score, business_type, market_sector, primary_language, target_countries')
      .eq('id', siteId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!site) return { ok: false, error: 'Site introuvable ou non accessible' };

    // Récupérer le dernier audit lié au domaine pour exposer un score.
    const { data: lastAudit } = await ctx.supabase
      .from('audits')
      .select('id, url, fixes_count, dynamic_price, payment_status, created_at')
      .eq('domain', site.domain)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return { ok: true, data: { ...site, last_audit: lastAudit ?? null } };
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
    if (!siteId) return { ok: false, error: 'tracked_site_id requis' };
    // Source réelle : cocoon_diagnostic_results (dernier diagnostic).
    const { data, error } = await ctx.supabase
      .from('cocoon_diagnostic_results')
      .select('id, diagnostic_type, scores, findings, source_function, created_at')
      .eq('tracked_site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: true, data: { message: 'Pas encore de cocoon calculé' } };
    // Tronque findings si trop volumineux.
    const findings = data.findings && typeof data.findings === 'object'
      ? Object.fromEntries(Object.entries(data.findings as Record<string, unknown>).slice(0, 8))
      : data.findings;
    return { ok: true, data: { ...data, findings } };
  },
};

const read_documentation: SkillDefinition = {
  name: 'read_documentation',
  description: "Recherche dans la base des recommandations d'audit (titres + descriptions) par mot-clé. Retourne les recommandations les plus pertinentes pour l'utilisateur courant.",
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
    const limit = Math.min(Math.max(Number(input.limit ?? 5), 1), 10);
    if (!query) return { ok: false, error: 'query requis' };

    // Sanitize : PostgREST `.or()` interprète virgules / parenthèses / guillemets.
    // On retire tout caractère non alphanumérique/espace/tiret puis on tronque.
    const safe = query.replace(/[^\p{L}\p{N}\s\-]/gu, ' ').trim().slice(0, 80);
    if (!safe) return { ok: false, error: 'query invalide après nettoyage' };
    const pattern = `%${safe}%`;

    // Source : audit_recommendations_registry — filtré par RLS sur l'utilisateur courant.
    const { data, error } = await ctx.supabase
      .from('audit_recommendations_registry')
      .select('id, title, description, category, priority, audit_type, fix_type, is_resolved, created_at')
      .or(`title.ilike.${pattern},description.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { results: data ?? [], count: data?.length ?? 0, query: safe } };
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
// ACTIONS NÉCESSITANT APPROBATION — handlers réels Sprint 4
// La policy 'approval' empêche l'exécution directe à la 1re itération
// (l'orchestrator pause + log status=awaiting_approval). Quand l'utilisateur
// valide, l'orchestrator rappelle ces handlers via handleApproval().
// ═══════════════════════════════════════════════════════════

const AUDIT_FN_BY_TYPE: Record<string, string> = {
  expert: 'expert-audit',
  eeat: 'audit-expert-seo',          // l'audit E-E-A-T est porté par audit-expert-seo
  strategique: 'audit-strategique-ia',
};

const trigger_audit: SkillDefinition = {
  name: 'trigger_audit',
  description: "Lance un audit SEO réel pour une URL donnée (consomme des crédits). Types: expert (technique), eeat (E-E-A-T), strategique (GEO+IA).",
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL absolue à auditer (https://...)' },
      audit_type: { type: 'string', enum: ['expert', 'eeat', 'strategique'], default: 'expert' },
    },
    required: ['url'],
  },
  handler: async (input, ctx) => {
    const url = String(input.url ?? '').trim();
    const auditType = String(input.audit_type ?? 'expert');
    if (!url || !/^https?:\/\//.test(url)) {
      return { ok: false, error: 'url absolue (http/https) requise' };
    }
    const fnName = AUDIT_FN_BY_TYPE[auditType] ?? AUDIT_FN_BY_TYPE.expert;
    try {
      // Invocation via le client utilisateur → respecte RLS, fair-use et quotas du compte.
      const { data, error } = await ctx.supabase.functions.invoke(fnName, {
        body: { url, source: 'copilot', persona: ctx.persona },
      });
      if (error) return { ok: false, error: `Edge function ${fnName} : ${error.message}` };
      const summary = summarizeAuditResponse(data);
      return { ok: true, data: { audit_type: auditType, function: fnName, ...summary } };
    } catch (e) {
      return { ok: false, error: `Echec invocation ${fnName} : ${(e as Error).message}` };
    }
  },
};

const cms_publish_draft: SkillDefinition = {
  name: 'cms_publish_draft',
  description: "Publie un brouillon SEO existant (table seo_page_drafts ou blog_articles) en passant le statut à 'published'.",
  parameters: {
    type: 'object',
    properties: {
      draft_id: { type: 'string', description: 'UUID du brouillon' },
      draft_type: { type: 'string', enum: ['landing', 'blog'], default: 'landing' },
      tracked_site_id: { type: 'string', description: 'UUID du site suivi propriétaire du brouillon (requis pour validation)' },
    },
    required: ['draft_id', 'tracked_site_id'],
  },
  handler: async (input, ctx) => {
    const draftId = String(input.draft_id ?? '').trim();
    const draftType = String(input.draft_type ?? 'landing');
    const trackedSiteId = String(input.tracked_site_id ?? '').trim();
    if (!draftId) return { ok: false, error: 'draft_id requis' };

    // Toute opération service-role passe par safeServiceCall
    return await safeServiceCall(ctx, trackedSiteId, async (service) => {
      const table = draftType === 'blog' ? 'blog_articles' : 'seo_page_drafts';

      // Vérification supplémentaire : le brouillon appartient bien au user
      const { data: existing, error: readErr } = await service
        .from(table)
        .select('id, status, title, slug, user_id')
        .eq('id', draftId)
        .maybeSingle();
      if (readErr) return { ok: false, error: `Lecture ${table} : ${readErr.message}` };
      if (!existing) return { ok: false, error: 'Brouillon introuvable' };
      if ((existing as { user_id?: string }).user_id !== ctx.userId) {
        return { ok: false, error: 'Brouillon non accessible (propriété refusée)' };
      }
      if (existing.status === 'published') {
        return { ok: true, data: { already_published: true, ...existing } };
      }

      const { data: updated, error: updErr } = await service
        .from(table)
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', draftId)
        .select('id, status, title, slug')
        .maybeSingle();
      if (updErr) return { ok: false, error: `Publication ${table} : ${updErr.message}` };
      return { ok: true, data: { table, ...updated } };
    });
  },
};

const cms_patch_content: SkillDefinition = {
  name: 'cms_patch_content',
  description: "Applique des modifications granulaires (h1/h2/meta/faq/body/image…) sur une page existante d'un site connecté via cms-patch-content.",
  parameters: {
    type: 'object',
    properties: {
      tracked_site_id: { type: 'string', description: 'UUID du site suivi' },
      target_url: { type: 'string', description: 'URL absolue de la page à patcher' },
      cms_post_id: { type: 'string', description: 'ID interne du CMS si connu (optionnel)' },
      patches: {
        type: 'array',
        description: 'Liste de patches { zone, action, value, selector?, old_value? }',
        items: {
          type: 'object',
          properties: {
            zone: { type: 'string', enum: ['h1','h2','h3','meta_title','meta_description','faq','body_section','image','alt_text','author','excerpt','slug','tags','schema_org','canonical','robots_meta','og_title','og_description','og_image'] },
            action: { type: 'string', enum: ['replace','append','prepend','remove'] },
            selector: { type: 'string' },
            value: {},
            old_value: { type: 'string' },
          },
          required: ['zone', 'action', 'value'],
        },
        minItems: 1,
        maxItems: 20,
      },
    },
    required: ['tracked_site_id', 'target_url', 'patches'],
  },
  handler: async (input, ctx) => {
    const trackedSiteId = String(input.tracked_site_id ?? '').trim();
    const targetUrl = String(input.target_url ?? '').trim();
    const patches = Array.isArray(input.patches) ? input.patches : [];
    if (!targetUrl || !/^https?:\/\//.test(targetUrl)) return { ok: false, error: 'target_url absolue requise' };
    if (patches.length === 0) return { ok: false, error: 'au moins 1 patch requis' };
    if (patches.length > 20) return { ok: false, error: 'max 20 patches par appel' };

    // Vérif d'appartenance centralisée AVANT toute invocation
    return await safeServiceCall(ctx, trackedSiteId, async (_service, _site) => {
      try {
        // Invocation via le client utilisateur — la fonction cms-patch-content
        // re-vérifie également la propriété côté serveur (defense in depth)
        const { data, error } = await ctx.supabase.functions.invoke('cms-patch-content', {
          body: {
            tracked_site_id: trackedSiteId,
            target_url: targetUrl,
            cms_post_id: input.cms_post_id ?? undefined,
            patches,
          },
        });
        if (error) return { ok: false, error: `cms-patch-content : ${error.message}` };
        return { ok: true, data };
      } catch (e) {
        return { ok: false, error: `Echec cms-patch-content : ${(e as Error).message}` };
      }
    });
  },
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

/** Résume une réponse d'audit (expert-audit / audit-strategique-ia / audit-expert-seo). */
function summarizeAuditResponse(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') return { raw: data };
  const d = data as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of ['audit_id', 'id', 'score', 'global_score', 'url', 'status', 'recommendations_count', 'critical_count']) {
    if (k in d) out[k] = d[k];
  }
  if (Array.isArray((d as { recommendations?: unknown[] }).recommendations)) {
    out.recommendations_count = (d as { recommendations: unknown[] }).recommendations.length;
  }
  out._available_keys = Object.keys(d).slice(0, 30);
  return out;
}
