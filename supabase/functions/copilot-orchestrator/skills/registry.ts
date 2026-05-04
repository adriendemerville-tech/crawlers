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
export async function safeServiceCall(
  ctx: SkillContext,
  trackedSiteId: string | null | undefined,
  handler: (service: SkillContext['service'], site: { id: string; user_id: string; domain: string }) => Promise<SkillResult>,
): Promise<SkillResult> {
  if (!trackedSiteId || typeof trackedSiteId !== 'string') {
    return { ok: false, error: 'tracked_site_id requis pour les opérations service-role' };
  }

  // Vérification UNIQUE et CENTRALE de propriété
  const { data: site, error } = await ctx.service
    .from('tracked_sites')
    .select('id, user_id, domain')
    .eq('id', trackedSiteId)
    .maybeSingle();

  if (error) return { ok: false, error: `Vérif site : ${error.message}` };
  if (!site) return { ok: false, error: 'Site introuvable' };
  if (site.user_id !== ctx.userId) {
    // Audit log : tentative d'accès cross-tenant (best effort, ne bloque pas la réponse)
    try {
      await ctx.service.from('copilot_actions').insert({
        session_id: ctx.sessionId, user_id: ctx.userId, persona: ctx.persona,
        skill: '_security_violation', input: { attempted_site_id: trackedSiteId },
        status: 'rejected',
        error_message: `Tentative d'accès au site ${trackedSiteId} appartenant à un autre utilisateur`,
      });
    } catch {
      // ignore — audit log best-effort
    }
    return { ok: false, error: 'Site non accessible (propriété refusée)' };
  }

  return await handler(ctx.service, site as { id: string; user_id: string; domain: string });
}

// ═══════════════════════════════════════════════════════════
// resolveTrackedSite — accepte soit un UUID, soit un domaine,
// et renvoie le tracked_site appartenant à l'utilisateur courant.
// Tolère "dictadevi.io", "https://www.dictadevi.io/", etc.
// Retourne null si rien trouvé (le handler décide du message d'erreur).
// ═══════════════════════════════════════════════════════════
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveTrackedSite(
  ctx: SkillContext,
  identifier: string | null | undefined,
): Promise<{ id: string; domain: string } | null> {
  const raw = String(identifier ?? '').trim();
  if (!raw) return null;

  // 1) UUID direct → on tente via le client RLS de l'utilisateur
  if (UUID_RE.test(raw)) {
    const { data } = await ctx.supabase
      .from('tracked_sites')
      .select('id, domain')
      .eq('id', raw)
      .maybeSingle();
    if (data) return { id: data.id as string, domain: data.domain as string };
    return null;
  }

  // 2) Sinon, on traite comme un domaine et on normalise
  const domain = raw
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
  if (!domain) return null;

  // Match exact d'abord, puis ilike en fallback. Toujours via RLS user.
  const { data: exact } = await ctx.supabase
    .from('tracked_sites')
    .select('id, domain')
    .eq('domain', domain)
    .limit(1)
    .maybeSingle();
  if (exact) return { id: exact.id as string, domain: exact.domain as string };

  const { data: like } = await ctx.supabase
    .from('tracked_sites')
    .select('id, domain')
    .ilike('domain', `%${domain}%`)
    .limit(1)
    .maybeSingle();
  if (like) return { id: like.id as string, domain: like.domain as string };

  return null;
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
  description: "Lit les KPIs courants d'un site suivi (SEO, GEO, trafic, dernière mesure). Accepte un UUID OU un domaine (ex: 'dictadevi.io', 'https://www.example.com').",
  parameters: {
    type: 'object',
    properties: {
      tracked_site_id: { type: 'string', description: "UUID du site suivi OU domaine (ex: 'dictadevi.io')" },
    },
    required: ['tracked_site_id'],
  },
  handler: async (input, ctx) => {
    const raw = String(input.tracked_site_id ?? '');
    if (!raw) return { ok: false, error: 'tracked_site_id requis (UUID ou domaine)' };

    const resolved = await resolveTrackedSite(ctx, raw);
    if (!resolved) {
      return { ok: false, error: `Aucun site suivi ne correspond à "${raw}". Vérifiez l'UUID ou le domaine, ou assurez-vous que ce site est bien dans 'Mes Sites'.` };
    }

    // Colonnes réelles de tracked_sites (pas de seo_score/geo_score directement).
    const { data: site, error } = await ctx.supabase
      .from('tracked_sites')
      .select('id, domain, site_name, brand_name, last_audit_at, eeat_score, business_type, market_sector, primary_language, target_countries')
      .eq('id', resolved.id)
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
  description: "Statistiques résumées du graphe cocoon : nb pages, orphelines, profondeur, cannibalisations. Accepte un UUID OU un domaine.",
  parameters: {
    type: 'object',
    properties: {
      tracked_site_id: { type: 'string', description: "UUID du site OU domaine (ex: 'dictadevi.io')" },
    },
    required: ['tracked_site_id'],
  },
  handler: async (input, ctx) => {
    const raw = String(input.tracked_site_id ?? '');
    if (!raw) return { ok: false, error: 'tracked_site_id requis (UUID ou domaine)' };

    const resolved = await resolveTrackedSite(ctx, raw);
    if (!resolved) {
      return { ok: false, error: `Aucun site suivi ne correspond à "${raw}".` };
    }

    // Source réelle : cocoon_diagnostic_results (dernier diagnostic).
    const { data, error } = await ctx.supabase
      .from('cocoon_diagnostic_results')
      .select('id, diagnostic_type, scores, findings, source_function, created_at')
      .eq('tracked_site_id', resolved.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: true, data: { message: 'Pas encore de cocoon calculé', site: resolved } };
    // Tronque findings si trop volumineux.
    const findings = data.findings && typeof data.findings === 'object'
      ? Object.fromEntries(Object.entries(data.findings as Record<string, unknown>).slice(0, 8))
      : data.findings;
    return { ok: true, data: { ...data, findings } };
  },
};

const read_documentation: SkillDefinition = {
  name: 'read_documentation',
  description: "Recherche dans la base des recommandations d'audit (titres + descriptions) par mot-clé. Filtre optionnel par tracked_site_id pour rester dans le périmètre d'un site.",
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Mots-clés à chercher' },
      limit: { type: 'number', default: 5 },
      tracked_site_id: { type: 'string', description: 'UUID du site (optionnel) — restreint la recherche à ce site' },
    },
    required: ['query'],
  },
  handler: async (input, ctx) => {
    const query = String(input.query ?? '').trim();
    const limit = Math.min(Math.max(Number(input.limit ?? 5), 1), 10);
    const trackedSiteId = input.tracked_site_id ? String(input.tracked_site_id).trim() : null;
    if (!query) return { ok: false, error: 'query requis' };

    const safe = query.replace(/[^\p{L}\p{N}\s\-]/gu, ' ').trim().slice(0, 80);
    if (!safe) return { ok: false, error: 'query invalide après nettoyage' };
    const pattern = `%${safe}%`;

    // P2 #14 — si tracked_site_id fourni, on valide la propriété puis on filtre.
    // Sans ce check, RLS protège déjà mais on évite de retourner des recos d'un autre site du user.
    if (trackedSiteId) {
      const { data: site } = await ctx.service
        .from('tracked_sites')
        .select('id, user_id, domain')
        .eq('id', trackedSiteId)
        .maybeSingle();
      if (!site || site.user_id !== ctx.userId) {
        return { ok: false, error: 'Site introuvable ou non accessible' };
      }
      const { data, error } = await ctx.supabase
        .from('audit_recommendations_registry')
        .select('id, title, description, category, priority, audit_type, fix_type, is_resolved, created_at')
        .eq('domain', site.domain)
        .or(`title.ilike.${pattern},description.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) return { ok: false, error: error.message };
      return { ok: true, data: { results: data ?? [], count: data?.length ?? 0, query: safe, scoped_to: site.domain } };
    }

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
      tracked_site_id: { type: 'string', description: 'UUID du site suivi propriétaire du brouillon (requis pour validation de cohérence)' },
    },
    required: ['draft_id', 'tracked_site_id'],
  },
  handler: async (input, ctx) => {
    const draftId = String(input.draft_id ?? '').trim();
    const draftType = String(input.draft_type ?? 'landing');
    const trackedSiteId = String(input.tracked_site_id ?? '').trim();
    if (!draftId) return { ok: false, error: 'draft_id requis' };

    // P0 #3 — safeServiceCall valide d'abord la propriété du tracked_site,
    // puis on valide la COHÉRENCE draft↔site (pas juste l'appartenance user).
    return await safeServiceCall(ctx, trackedSiteId, async (service, site) => {
      // ── Cas blog_articles : CMS interne crawlers.fr ─────────────────
      // La table n'a ni user_id ni domain → réservée aux admins (auteur unique).
      if (draftType === 'blog') {
        const { data: isAdmin } = await service.rpc('has_role', {
          _user_id: ctx.userId, _role: 'admin',
        });
        if (isAdmin !== true) {
          return { ok: false, error: 'Publication blog réservée aux administrateurs (CMS interne).' };
        }
        const { data: article, error: readErr } = await service
          .from('blog_articles')
          .select('id, status, title, slug')
          .eq('id', draftId)
          .maybeSingle();
        if (readErr) return { ok: false, error: `Lecture blog_articles : ${readErr.message}` };
        if (!article) return { ok: false, error: 'Article introuvable' };
        if (article.status === 'published') {
          return { ok: true, data: { already_published: true, ...article } };
        }
        const { data: updated, error: updErr } = await service
          .from('blog_articles')
          .update({ status: 'published', published_at: new Date().toISOString() })
          .eq('id', draftId)
          .select('id, status, title, slug')
          .maybeSingle();
        if (updErr) return { ok: false, error: `Publication blog : ${updErr.message}` };
        return { ok: true, data: { table: 'blog_articles', ...updated } };
      }

      // ── Cas seo_page_drafts : multi-tenant ──────────────────────────
      // Vérification stricte : draft.user_id = ctx.userId ET draft.domain = site.domain.
      // Le 2nd check empêche un user de publier un draft du domaine A sur la fiche
      // du site B (même propriétaire, sites différents) → cohérence garantie.
      const { data: existing, error: readErr } = await service
        .from('seo_page_drafts')
        .select('id, status, title, slug, user_id, domain')
        .eq('id', draftId)
        .maybeSingle();
      if (readErr) return { ok: false, error: `Lecture seo_page_drafts : ${readErr.message}` };
      if (!existing) return { ok: false, error: 'Brouillon introuvable' };
      if (existing.user_id !== ctx.userId) {
        return { ok: false, error: 'Brouillon non accessible (propriété refusée)' };
      }
      // Normalisation lowercase pour comparer www.x.com et x.com de manière souple
      const draftDomain = (existing.domain ?? '').toLowerCase().replace(/^www\./, '');
      const siteDomain = (site.domain ?? '').toLowerCase().replace(/^www\./, '');
      if (!draftDomain || draftDomain !== siteDomain) {
        return {
          ok: false,
          error: `Incohérence draft↔site : le brouillon vise le domaine "${existing.domain}" mais le site fourni est "${site.domain}". Refus de publication.`,
        };
      }
      if (existing.status === 'published') {
        return { ok: true, data: { already_published: true, ...existing } };
      }

      const { data: updated, error: updErr } = await service
        .from('seo_page_drafts')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', draftId)
        .select('id, status, title, slug, domain')
        .maybeSingle();
      if (updErr) return { ok: false, error: `Publication seo_page_drafts : ${updErr.message}` };
      return { ok: true, data: { table: 'seo_page_drafts', ...updated } };
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
// SKILLS ADMIN — réservées au mode créateur (/creator: /createur: /admin:)
// Le registry les expose, mais les personas Félix/Stratège ne les listent
// pas dans skillPolicies → 'forbidden' par défaut. Elles ne deviennent
// disponibles qu'en mode créateur (orchestrator élargit allowedSkills).
// Chaque handler revérifie has_role(admin) côté serveur (defense in depth).
// ═══════════════════════════════════════════════════════════

const admin_lookup_user: SkillDefinition = {
  name: 'admin_lookup_user',
  description: "[ADMIN] Recherche un utilisateur par nom/prénom/email et retourne ses sites suivis + statut COMPLET des connexions : CMS user (UI), CMS miroir Parménion (admin-pushed via parmenion_targets), Google (GSC/GA4/GMB), Matomo, Canva, IKtracker. Distingue clairement cms_user (connexion explicite par l'utilisateur) de cms_parmenion_mirror (clé API ajoutée par admin dans Parménion → injection autopilote). Si parmenion_active=true sur un site, le pont autopilote pousse du contenu même sans connexion user. Filtre optionnel par domaine.",
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: "Nom, prénom ou email (fragment, recherche ILIKE)" },
      domain: { type: 'string', description: "Domaine du site à filtrer (ex: 'sphaeragloballtd.com'), optionnel" },
    },
    required: ['query'],
  },
  handler: async (input, ctx) => {
    const query = String(input.query ?? '').trim();
    const domainFilter = input.domain ? String(input.domain).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '') : null;
    if (!query || query.length < 2) return { ok: false, error: 'query requis (min 2 caractères)' };

    // Defense in depth : même si exposé uniquement en creator_mode, on revérifie le rôle.
    const { data: isAdmin } = await ctx.service.rpc('has_role', { _user_id: ctx.userId, _role: 'admin' });
    if (isAdmin !== true) {
      return { ok: false, error: 'Skill admin réservée aux administrateurs.' };
    }

    const safe = query.replace(/[^\p{L}\p{N}\s\-@.]/gu, ' ').trim().slice(0, 80);
    if (!safe) return { ok: false, error: 'query invalide après nettoyage' };
    const pattern = `%${safe}%`;

    // 1) Trouver les profils correspondants
    const { data: profiles, error: pErr } = await ctx.service
      .from('profiles')
      .select('user_id, first_name, last_name, email, plan_type, subscription_status, created_at')
      .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(10);
    if (pErr) return { ok: false, error: `Lecture profiles : ${pErr.message}` };
    if (!profiles || profiles.length === 0) {
      return { ok: true, data: { matches: [], message: `Aucun utilisateur trouvé pour "${safe}"` } };
    }

    const matches = await Promise.all(profiles.map(async (p) => {
      // 2) Sites suivis
      let sitesQuery = ctx.service
        .from('tracked_sites')
        .select('id, domain, site_name, brand_name, cms_platform, created_at, last_audit_at, last_cms_refresh_at')
        .eq('user_id', p.user_id);
      if (domainFilter) sitesQuery = sitesQuery.ilike('domain', `%${domainFilter}%`);
      const { data: sites } = await sitesQuery.order('created_at', { ascending: false }).limit(20);

      // 3) Connexions Google et Canva : scope USER (pas site).
      const [googleRes, canvaRes] = await Promise.all([
        ctx.service.from('google_connections')
          .select('id, google_email, gsc_site_urls, ga4_property_id, gmb_account_id, gmb_location_id, scopes, token_expiry, created_at, updated_at')
          .eq('user_id', p.user_id),
        ctx.service.from('canva_connections')
          .select('id, status, scopes, display_name, canva_user_id, canva_team_id, token_expires_at, created_at, updated_at')
          .eq('user_id', p.user_id),
      ]);
      const userGoogle = googleRes.data ?? [];
      const userCanva = canvaRes.data ?? [];

      // 4) Pour chaque site : connexions CMS + matchs Google par URL + targets Parménion (admin-pushed).
      const sitesEnriched = await Promise.all((sites ?? []).map(async (s) => {
        const domainNorm = (s.domain ?? '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');

        const [cmsRes, matomoRes, parmenionRes, iktrackerRes] = await Promise.all([
          ctx.service.from('cms_connections')
            .select('id, platform, auth_method, status, site_url, scopes, capabilities, created_at, updated_at, token_expiry, managed_by')
            .eq('user_id', p.user_id).eq('tracked_site_id', s.id),
          ctx.service.from('matomo_connections')
            .select('id, matomo_url, site_id, is_active, last_sync_at, sync_error, created_at')
            .eq('user_id', p.user_id).eq('tracked_site_id', s.id),
          // Parménion : scope DOMAINE (pas user) — admin-pushed, indépendant de la propriété user
          ctx.service.from('parmenion_targets')
            .select('id, domain, label, platform, event_type, is_active, api_key_name, created_at, updated_at')
            .ilike('domain', domainNorm),
          // IKtracker : connexions admin-pushed pour le pont IK
          ctx.service.from('iktracker_connections')
            .select('id, domain, is_active, created_at, updated_at')
            .ilike('domain', domainNorm)
            .then((r: any) => r, () => ({ data: [] })), // table peut ne pas exister
        ]);

        const googleForSite = userGoogle.filter((g: any) => {
          const urls: string[] = Array.isArray(g.gsc_site_urls) ? g.gsc_site_urls : [];
          return urls.some((u) => String(u).toLowerCase().includes(domainNorm));
        });

        // Sépare connexions user vs miroirs Parménion pour transparence
        const cmsAll = cmsRes.data ?? [];
        const cmsUser = cmsAll.filter((c: any) => (c.managed_by ?? 'user') === 'user');
        const cmsParmenionMirror = cmsAll.filter((c: any) => c.managed_by === 'parmenion');
        const parmenionTargets = (parmenionRes.data ?? []).map((t: any) => ({
          id: t.id, domain: t.domain, label: t.label, platform: t.platform,
          event_type: t.event_type, is_active: t.is_active,
          has_api_key: !!t.api_key_name && t.api_key_name.trim() !== '',
          api_key_preview: t.api_key_name ? `${t.api_key_name.slice(0, 6)}…${t.api_key_name.slice(-4)}` : null,
          created_at: t.created_at, updated_at: t.updated_at,
        }));

        return {
          site_id: s.id,
          domain: s.domain,
          site_name: s.site_name,
          cms_platform_declared: s.cms_platform,
          last_cms_refresh_at: s.last_cms_refresh_at,
          last_audit_at: s.last_audit_at,
          connections: {
            cms_user: cmsUser,                      // connexions CMS explicitement créées par le user
            cms_parmenion_mirror: cmsParmenionMirror, // miroirs créés via Parménion (admin)
            cms_count_total: cmsAll.length,
            cms_count_user: cmsUser.length,
            cms_count_parmenion: cmsParmenionMirror.length,
            google_for_this_site: googleForSite,
            matomo: matomoRes.data ?? [],
            // Pont autopilote (admin) — distinct des CMS standards
            parmenion_targets: parmenionTargets,
            parmenion_active: parmenionTargets.some((t: any) => t.is_active && t.has_api_key),
            iktracker_connections: (iktrackerRes as any)?.data ?? [],
          },
        };
      }));

      return {
        user_id: p.user_id,
        first_name: p.first_name,
        last_name: p.last_name,
        email: p.email,
        plan_type: p.plan_type,
        subscription_status: p.subscription_status,
        signup_date: p.created_at,
        sites_count: (sites ?? []).length,
        sites: sitesEnriched,
        // Connexions au niveau user (pas par site)
        user_level_connections: {
          google_total: userGoogle.length,
          google_accounts: userGoogle.map((g: any) => ({
            id: g.id, email: g.google_email, gsc_sites: g.gsc_site_urls ?? [],
            has_ga4: !!g.ga4_property_id, has_gmb: !!g.gmb_account_id,
            scopes: g.scopes ?? [], token_expiry: g.token_expiry,
          })),
          canva_total: userCanva.length,
          canva: userCanva,
        },
      };
    }));

    return {
      ok: true,
      data: {
        query: safe,
        domain_filter: domainFilter,
        matches_count: matches.length,
        matches,
      },
    };
  },
};

// ═══════════════════════════════════════════════════════════
// SKILLS ADMIN — gestion des sites trackés / plan / clé API
// Toutes : creator_mode requis + revérif has_role(admin) defense in depth.
// Pattern identique à admin_lookup_user.
// ═══════════════════════════════════════════════════════════

/** Normalise un domaine : strip protocol, www, trailing slash, lowercase. */
function normalizeDomain(raw: string): string {
  return String(raw ?? '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

/** Résout un user_id à partir d'un email (recherche stricte profiles.email). */
async function resolveUserIdByEmail(
  service: SkillContext['service'],
  email: string,
): Promise<{ user_id: string; first_name: string | null; last_name: string | null; email: string } | null> {
  const cleaned = email.trim().toLowerCase();
  if (!cleaned || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) return null;
  const { data } = await service
    .from('profiles')
    .select('user_id, first_name, last_name, email')
    .ilike('email', cleaned)
    .maybeSingle();
  if (!data) return null;
  return {
    user_id: data.user_id as string,
    first_name: (data.first_name as string | null) ?? null,
    last_name: (data.last_name as string | null) ?? null,
    email: (data.email as string) ?? cleaned,
  };
}

const admin_track_site: SkillDefinition = {
  name: 'admin_track_site',
  description:
    "[ADMIN] Ajoute manuellement un site à la liste des sites suivis (tracked_sites) d'un utilisateur identifié par son email. Idempotent (ON CONFLICT DO NOTHING sur user_id+domain).",
  parameters: {
    type: 'object',
    properties: {
      email: { type: 'string', description: "Email du compte utilisateur cible" },
      domain: { type: 'string', description: "Domaine à ajouter (ex: 'sphaeragloballtd.com'), sans https:// ni www" },
      site_name: { type: 'string', description: "Nom d'affichage du site (optionnel, défaut = domain)" },
    },
    required: ['email', 'domain'],
  },
  handler: async (input, ctx) => {
    const { data: isAdmin } = await ctx.service.rpc('has_role', { _user_id: ctx.userId, _role: 'admin' });
    if (isAdmin !== true) return { ok: false, error: 'Skill admin réservée aux administrateurs.' };

    const email = String(input.email ?? '').trim();
    const domain = normalizeDomain(String(input.domain ?? ''));
    const siteName = input.site_name ? String(input.site_name).trim().slice(0, 120) : domain;

    if (!email) return { ok: false, error: 'email requis' };
    if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
      return { ok: false, error: `Domaine invalide après normalisation: "${domain}"` };
    }

    const target = await resolveUserIdByEmail(ctx.service, email);
    if (!target) return { ok: false, error: `Aucun compte trouvé pour ${email}` };

    // Vérifie si déjà présent (pour rapport clair)
    const { data: existing } = await ctx.service
      .from('tracked_sites')
      .select('id, domain, site_name, created_at')
      .eq('user_id', target.user_id)
      .eq('domain', domain)
      .maybeSingle();

    if (existing) {
      return {
        ok: true,
        data: {
          already_existed: true,
          tracked_site_id: existing.id,
          domain: existing.domain,
          site_name: existing.site_name,
          target_user: { user_id: target.user_id, email: target.email, name: `${target.first_name ?? ''} ${target.last_name ?? ''}`.trim() },
          message: `${domain} était déjà suivi par ${email} (depuis ${existing.created_at}).`,
        },
      };
    }

    const { data: created, error } = await ctx.service
      .from('tracked_sites')
      .insert({
        user_id: target.user_id,
        domain,
        site_name: siteName,
        last_audit_at: new Date().toISOString(),
      })
      .select('id, domain, site_name, created_at')
      .single();

    if (error) return { ok: false, error: `Insertion tracked_sites : ${error.message}` };

    return {
      ok: true,
      data: {
        already_existed: false,
        tracked_site_id: created.id,
        domain: created.domain,
        site_name: created.site_name,
        target_user: { user_id: target.user_id, email: target.email, name: `${target.first_name ?? ''} ${target.last_name ?? ''}`.trim() },
        message: `✓ ${domain} ajouté aux sites suivis de ${email}.`,
      },
    };
  },
};

const admin_untrack_site: SkillDefinition = {
  name: 'admin_untrack_site',
  description:
    "[ADMIN] Retire un site de la liste des sites suivis d'un utilisateur (DELETE tracked_sites). Action destructive — l'historique des stats reste mais le suivi s'arrête.",
  parameters: {
    type: 'object',
    properties: {
      email: { type: 'string', description: "Email du compte utilisateur cible" },
      domain: { type: 'string', description: "Domaine à retirer" },
    },
    required: ['email', 'domain'],
  },
  handler: async (input, ctx) => {
    const { data: isAdmin } = await ctx.service.rpc('has_role', { _user_id: ctx.userId, _role: 'admin' });
    if (isAdmin !== true) return { ok: false, error: 'Skill admin réservée aux administrateurs.' };

    const email = String(input.email ?? '').trim();
    const domain = normalizeDomain(String(input.domain ?? ''));
    if (!email) return { ok: false, error: 'email requis' };
    if (!domain) return { ok: false, error: 'domain requis' };

    const target = await resolveUserIdByEmail(ctx.service, email);
    if (!target) return { ok: false, error: `Aucun compte trouvé pour ${email}` };

    const { data: deleted, error } = await ctx.service
      .from('tracked_sites')
      .delete()
      .eq('user_id', target.user_id)
      .eq('domain', domain)
      .select('id, domain');

    if (error) return { ok: false, error: `Suppression tracked_sites : ${error.message}` };
    if (!deleted || deleted.length === 0) {
      return { ok: false, error: `Aucun site "${domain}" trouvé pour ${email}.` };
    }

    return {
      ok: true,
      data: {
        deleted_count: deleted.length,
        target_user: { user_id: target.user_id, email: target.email },
        deleted_sites: deleted,
        message: `✓ ${domain} retiré du suivi pour ${email}.`,
      },
    };
  },
};

const admin_list_user_sites: SkillDefinition = {
  name: 'admin_list_user_sites',
  description:
    "[ADMIN] Liste tous les sites suivis d'un utilisateur (par email). Retourne id, domain, site_name, plateforme CMS déclarée, dates d'audit/refresh.",
  parameters: {
    type: 'object',
    properties: {
      email: { type: 'string', description: "Email du compte utilisateur cible" },
    },
    required: ['email'],
  },
  handler: async (input, ctx) => {
    const { data: isAdmin } = await ctx.service.rpc('has_role', { _user_id: ctx.userId, _role: 'admin' });
    if (isAdmin !== true) return { ok: false, error: 'Skill admin réservée aux administrateurs.' };

    const email = String(input.email ?? '').trim();
    if (!email) return { ok: false, error: 'email requis' };

    const target = await resolveUserIdByEmail(ctx.service, email);
    if (!target) return { ok: false, error: `Aucun compte trouvé pour ${email}` };

    const { data: sites, error } = await ctx.service
      .from('tracked_sites')
      .select('id, domain, site_name, brand_name, cms_platform, business_type, market_sector, created_at, last_audit_at, last_cms_refresh_at')
      .eq('user_id', target.user_id)
      .order('created_at', { ascending: false });

    if (error) return { ok: false, error: `Lecture tracked_sites : ${error.message}` };

    return {
      ok: true,
      data: {
        target_user: { user_id: target.user_id, email: target.email, name: `${target.first_name ?? ''} ${target.last_name ?? ''}`.trim() },
        sites_count: sites?.length ?? 0,
        sites: sites ?? [],
      },
    };
  },
};

const admin_reset_api_key: SkillDefinition = {
  name: 'admin_reset_api_key',
  description:
    "[ADMIN] Régénère la clé API (api_key UUID) du profil d'un utilisateur. ATTENTION : invalide la clé actuelle utilisée par le plugin WordPress et le widget GTM — le user devra la re-déployer.",
  parameters: {
    type: 'object',
    properties: {
      email: { type: 'string', description: "Email du compte utilisateur cible" },
    },
    required: ['email'],
  },
  handler: async (input, ctx) => {
    const { data: isAdmin } = await ctx.service.rpc('has_role', { _user_id: ctx.userId, _role: 'admin' });
    if (isAdmin !== true) return { ok: false, error: 'Skill admin réservée aux administrateurs.' };

    const email = String(input.email ?? '').trim();
    if (!email) return { ok: false, error: 'email requis' };

    const target = await resolveUserIdByEmail(ctx.service, email);
    if (!target) return { ok: false, error: `Aucun compte trouvé pour ${email}` };

    // Génère un nouvel UUID via gen_random_uuid() en base.
    const newKey = crypto.randomUUID();
    const { data: updated, error } = await ctx.service
      .from('profiles')
      .update({ api_key: newKey })
      .eq('user_id', target.user_id)
      .select('user_id, api_key')
      .single();

    if (error) return { ok: false, error: `Régénération api_key : ${error.message}` };

    // On masque la clé dans la réponse (8 premiers chars seulement) — la clé entière reste en base.
    const masked = String(updated.api_key).slice(0, 8) + '••••••••';
    return {
      ok: true,
      data: {
        target_user: { user_id: target.user_id, email: target.email },
        api_key_preview: masked,
        message: `✓ Clé API régénérée pour ${email} (préfixe ${masked}). Le user doit re-déployer le plugin WordPress / widget GTM.`,
      },
    };
  },
};

const VALID_PLAN_TYPES = ['free', 'starter', 'agency_pro', 'agency_premium'] as const;

const admin_grant_pro: SkillDefinition = {
  name: 'admin_grant_pro',
  description:
    "[ADMIN] Force un plan d'abonnement sur le profil d'un utilisateur (plan_type + subscription_status). Utilisé pour offrir un accès Pro Agency / Agency+ temporaire (test, support, partenariat).",
  parameters: {
    type: 'object',
    properties: {
      email: { type: 'string', description: "Email du compte utilisateur cible" },
      plan_type: {
        type: 'string',
        enum: [...VALID_PLAN_TYPES],
        description: "Plan à appliquer (free, starter, agency_pro, agency_premium)",
      },
      subscription_status: {
        type: 'string',
        enum: ['active', 'trialing', 'canceled'],
        default: 'active',
        description: "Statut Stripe-like (défaut: active)",
      },
    },
    required: ['email', 'plan_type'],
  },
  handler: async (input, ctx) => {
    const { data: isAdmin } = await ctx.service.rpc('has_role', { _user_id: ctx.userId, _role: 'admin' });
    if (isAdmin !== true) return { ok: false, error: 'Skill admin réservée aux administrateurs.' };

    const email = String(input.email ?? '').trim();
    const planType = String(input.plan_type ?? '').trim();
    const subStatus = String(input.subscription_status ?? 'active').trim();

    if (!email) return { ok: false, error: 'email requis' };
    if (!VALID_PLAN_TYPES.includes(planType as typeof VALID_PLAN_TYPES[number])) {
      return { ok: false, error: `plan_type invalide. Valides: ${VALID_PLAN_TYPES.join(', ')}` };
    }

    const target = await resolveUserIdByEmail(ctx.service, email);
    if (!target) return { ok: false, error: `Aucun compte trouvé pour ${email}` };

    // Snapshot avant pour audit
    const { data: before } = await ctx.service
      .from('profiles')
      .select('plan_type, subscription_status')
      .eq('user_id', target.user_id)
      .maybeSingle();

    const { data: updated, error } = await ctx.service
      .from('profiles')
      .update({ plan_type: planType, subscription_status: subStatus })
      .eq('user_id', target.user_id)
      .select('user_id, plan_type, subscription_status')
      .single();

    if (error) return { ok: false, error: `MAJ profile : ${error.message}` };

    return {
      ok: true,
      data: {
        target_user: { user_id: target.user_id, email: target.email },
        before: before ?? null,
        after: { plan_type: updated.plan_type, subscription_status: updated.subscription_status },
        message: `✓ ${email} passé de ${before?.plan_type ?? '—'}/${before?.subscription_status ?? '—'} → ${updated.plan_type}/${updated.subscription_status}.`,
      },
    };
  },
};

// ═══════════════════════════════════════════════════════════
// MÉMOIRE PERSISTANTE — site_memory
// Permet à Félix de capitaliser sur les conversations en stockant
// des insights par site (preference, insight, objective, context, identity).
// ═══════════════════════════════════════════════════════════

const VALID_MEMORY_CATEGORIES = ['preference', 'insight', 'objective', 'context', 'identity', 'general'] as const;

const read_site_memory: SkillDefinition = {
  name: 'read_site_memory',
  description:
    "Lit la mémoire persistante d'un site (préférences user, insights précédents, objectifs déclarés). À appeler en début de conversation pour rappeler le contexte du site. Accepte un UUID OU un domaine.",
  parameters: {
    type: 'object',
    properties: {
      tracked_site_id: { type: 'string', description: "UUID du site OU domaine (ex: 'dictadevi.io')" },
      category: {
        type: 'string',
        enum: [...VALID_MEMORY_CATEGORIES],
        description: 'Filtre optionnel par catégorie (preference, insight, objective, context, identity, general).',
      },
      limit: { type: 'number', default: 20 },
    },
    required: ['tracked_site_id'],
  },
  handler: async (input, ctx) => {
    const raw = String(input.tracked_site_id ?? '');
    if (!raw) return { ok: false, error: 'tracked_site_id requis (UUID ou domaine)' };
    const resolved = await resolveTrackedSite(ctx, raw);
    if (!resolved) return { ok: false, error: `Aucun site suivi ne correspond à "${raw}".` };

    const category = input.category ? String(input.category) : null;
    const limit = Math.min(Math.max(Number(input.limit ?? 20), 1), 50);

    let q = ctx.supabase
      .from('site_memory')
      .select('memory_key, memory_value, category, source, confidence, created_at, updated_at')
      .eq('tracked_site_id', resolved.id)
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (category) q = q.eq('category', category);

    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: {
        site: resolved,
        memories: data ?? [],
        count: data?.length ?? 0,
      },
    };
  },
};

const write_site_memory: SkillDefinition = {
  name: 'write_site_memory',
  description:
    "Enregistre un insight structuré sur un site dans la mémoire persistante. À utiliser quand l'utilisateur partage une préférence (langue, ton), un objectif (priorité business), un insight (problème récurrent), un contexte (saisonnalité, événement), ou une donnée d'identité. Upsert sur (tracked_site_id, memory_key).",
  parameters: {
    type: 'object',
    properties: {
      tracked_site_id: { type: 'string', description: 'UUID du site OU domaine' },
      memory_key: {
        type: 'string',
        description: "Clé courte snake_case (ex: 'preferred_tone', 'q4_objective', 'recurring_issue').",
      },
      memory_value: { type: 'string', description: "Valeur en français, max 500 caractères." },
      category: {
        type: 'string',
        enum: [...VALID_MEMORY_CATEGORIES],
        description: 'Catégorie de la mémoire.',
      },
      confidence: {
        type: 'number',
        description: 'Confiance 0-1 (par défaut 0.7 si déduit, 1.0 si déclaré explicitement).',
      },
    },
    required: ['tracked_site_id', 'memory_key', 'memory_value', 'category'],
  },
  handler: async (input, ctx) => {
    const raw = String(input.tracked_site_id ?? '');
    const memKey = String(input.memory_key ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 80);
    const memVal = String(input.memory_value ?? '').trim().slice(0, 500);
    const category = String(input.category ?? 'general');
    const confidence = Math.min(Math.max(Number(input.confidence ?? 0.7), 0), 1);
    if (!raw || !memKey || !memVal) {
      return { ok: false, error: 'tracked_site_id, memory_key et memory_value requis' };
    }
    if (!VALID_MEMORY_CATEGORIES.includes(category as typeof VALID_MEMORY_CATEGORIES[number])) {
      return { ok: false, error: `category invalide. Valeurs: ${VALID_MEMORY_CATEGORIES.join(', ')}` };
    }

    const resolved = await resolveTrackedSite(ctx, raw);
    if (!resolved) return { ok: false, error: `Aucun site suivi ne correspond à "${raw}".` };

    // Upsert RLS-safe via le client utilisateur (RLS exige user_id = auth.uid()).
    const { data, error } = await ctx.supabase
      .from('site_memory')
      .upsert(
        {
          tracked_site_id: resolved.id,
          user_id: ctx.userId,
          memory_key: memKey,
          memory_value: memVal,
          category,
          source: ctx.persona, // 'felix' ou 'strategist'
          confidence,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tracked_site_id,memory_key' },
      )
      .select('memory_key, category, confidence, updated_at')
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { saved: data, site_domain: resolved.domain } };
  },
};

// ═══════════════════════════════════════════════════════════
// CARTE D'IDENTITÉ — propositions d'enrichissement
// Félix ne modifie JAMAIS directement tracked_sites.
// Il propose des suggestions dans identity_card_suggestions
// que l'utilisateur valide depuis Mes Sites → Identité.
// ═══════════════════════════════════════════════════════════

// Champs de tracked_sites que Félix peut suggérer.
// Volontairement restreint — pas de subscription, pas de api_key, pas de user_id.
const ALLOWED_IDENTITY_FIELDS = new Set([
  'site_name',
  'brand_name',
  'business_type',
  'market_sector',
  'target_audience',
  'products_services',
  'commercial_area',
  'address',
  'company_size',
  'founding_year',
  'short_term_goal',
  'mid_term_goal',
  'main_serp_competitor',
  'primary_language',
  'commercial_model',
  'entity_type',
  'target_segment',
  'primary_use_case',
  'location_detail',
  'gmb_city',
  'is_local_business',
  'is_seasonal',
]);

const list_identity_suggestions: SkillDefinition = {
  name: 'list_identity_suggestions',
  description:
    "Liste les propositions d'enrichissement de la carte d'identité d'un site (en attente, validées, refusées). Utile pour vérifier ce qui a déjà été proposé avant d'en ajouter une nouvelle.",
  parameters: {
    type: 'object',
    properties: {
      tracked_site_id: { type: 'string', description: 'UUID du site OU domaine' },
      status: {
        type: 'string',
        enum: ['pending', 'accepted', 'rejected', 'all'],
        default: 'pending',
      },
      limit: { type: 'number', default: 20 },
    },
    required: ['tracked_site_id'],
  },
  handler: async (input, ctx) => {
    const raw = String(input.tracked_site_id ?? '');
    if (!raw) return { ok: false, error: 'tracked_site_id requis' };
    const resolved = await resolveTrackedSite(ctx, raw);
    if (!resolved) return { ok: false, error: `Aucun site suivi ne correspond à "${raw}".` };

    const status = String(input.status ?? 'pending');
    const limit = Math.min(Math.max(Number(input.limit ?? 20), 1), 50);

    let q = ctx.supabase
      .from('identity_card_suggestions')
      .select('id, field_name, current_value, suggested_value, source, reason, status, created_at, reviewed_at')
      .eq('tracked_site_id', resolved.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (status !== 'all') q = q.eq('status', status);

    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { site: resolved, suggestions: data ?? [], count: data?.length ?? 0 } };
  },
};

const propose_identity_suggestion: SkillDefinition = {
  name: 'propose_identity_suggestion',
  description:
    "Propose une mise à jour d'un champ de la carte d'identité d'un site. La proposition est mise en attente — l'utilisateur la valide depuis 'Mes Sites → Identité'. Félix ne modifie JAMAIS tracked_sites directement. À utiliser quand l'utilisateur déclare ou laisse deviner une info manquante (ex: 'on est une SARL fondée en 2018', 'on cible les TPE BtoB').",
  parameters: {
    type: 'object',
    properties: {
      tracked_site_id: { type: 'string', description: 'UUID du site OU domaine' },
      field_name: {
        type: 'string',
        description: `Nom du champ à enrichir. Valeurs autorisées : ${[...ALLOWED_IDENTITY_FIELDS].join(', ')}.`,
      },
      suggested_value: { type: 'string', description: 'Nouvelle valeur proposée, max 500 caractères.' },
      reason: { type: 'string', description: "Justification courte (d'où vient l'info, pourquoi ce changement)." },
    },
    required: ['tracked_site_id', 'field_name', 'suggested_value'],
  },
  handler: async (input, ctx) => {
    const raw = String(input.tracked_site_id ?? '');
    const field = String(input.field_name ?? '').trim().toLowerCase();
    const suggested = String(input.suggested_value ?? '').trim().slice(0, 500);
    const reason = input.reason ? String(input.reason).slice(0, 300) : null;

    if (!raw || !field || !suggested) {
      return { ok: false, error: 'tracked_site_id, field_name et suggested_value requis' };
    }
    if (!ALLOWED_IDENTITY_FIELDS.has(field)) {
      return { ok: false, error: `Champ "${field}" non autorisé. Champs valides : ${[...ALLOWED_IDENTITY_FIELDS].join(', ')}` };
    }

    const resolved = await resolveTrackedSite(ctx, raw);
    if (!resolved) return { ok: false, error: `Aucun site suivi ne correspond à "${raw}".` };

    // Lire la valeur courante depuis tracked_sites pour current_value
    const { data: siteRow } = await ctx.supabase
      .from('tracked_sites')
      .select(field)
      .eq('id', resolved.id)
      .maybeSingle();
    const siteRec = (siteRow ?? null) as unknown as Record<string, unknown> | null;
    const currentVal = siteRec && siteRec[field] != null ? String(siteRec[field]) : null;

    // Pas de doublon : si une suggestion pending existe déjà pour ce champ avec la même valeur, on no-op.
    const { data: existing } = await ctx.supabase
      .from('identity_card_suggestions')
      .select('id, suggested_value')
      .eq('tracked_site_id', resolved.id)
      .eq('field_name', field)
      .eq('status', 'pending')
      .maybeSingle();
    if (existing && existing.suggested_value === suggested) {
      return { ok: true, data: { duplicate: true, suggestion_id: existing.id, message: 'Suggestion identique déjà en attente.' } };
    }

    const { data, error } = await ctx.supabase
      .from('identity_card_suggestions')
      .insert({
        tracked_site_id: resolved.id,
        user_id: ctx.userId,
        field_name: field,
        current_value: currentVal,
        suggested_value: suggested,
        source: ctx.persona,
        reason,
        status: 'pending',
      })
      .select('id, field_name, suggested_value, status, created_at')
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: {
        suggestion: data,
        site_domain: resolved.domain,
        next_step: "L'utilisateur peut valider depuis Mes Sites → Identité.",
      },
    };
  },
};

// ═══════════════════════════════════════════════════════════
// LIVE SEARCH — recherche temps réel SERP & Google Places
// Sprint Q5 Bloc 2 — porté depuis sav-agent legacy.
// Quotas (généreux):
//   • free            : 3 recherches / session
//   • agency_premium  : 5 recherches / session
//   • agency_pro      : 20 recherches / jour (pas de plafond session)
// Compteurs persistés dans copilot_sessions.context.live_search_count (session)
// et comptés depuis analytics_events (event_type='copilot_live_search') pour le quota jour.
// ═══════════════════════════════════════════════════════════

interface LiveSearchQuota {
  allowed: boolean;
  used: number;
  limit: number;
  scope: 'session' | 'daily';
  reason?: string;
}

async function checkLiveSearchQuota(ctx: SkillContext): Promise<LiveSearchQuota> {
  // Plan utilisateur
  const { data: prof } = await ctx.service
    .from('profiles')
    .select('plan_type, subscription_status')
    .eq('user_id', ctx.userId)
    .maybeSingle();
  const plan = (prof?.plan_type as string) ?? 'free';
  const isProActive = plan === 'agency_pro' &&
    (prof?.subscription_status === 'active' || prof?.subscription_status === 'canceling');

  if (isProActive) {
    // Quota jour: 20
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await ctx.service
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', ctx.userId)
      .eq('event_type', 'copilot_live_search')
      .gte('created_at', since);
    const used = count ?? 0;
    return {
      allowed: used < 20,
      used,
      limit: 20,
      scope: 'daily',
      reason: used >= 20 ? 'Quota Pro Agency atteint (20 recherches / 24h).' : undefined,
    };
  }

  // Free / agency_premium → quota par session
  const limit = plan === 'agency_premium' ? 5 : 3;
  const { data: sess } = await ctx.service
    .from('copilot_sessions')
    .select('context')
    .eq('id', ctx.sessionId)
    .maybeSingle();
  const sessionCtx = (sess?.context as Record<string, unknown> | null) ?? {};
  const used = Number(sessionCtx.live_search_count ?? 0);
  return {
    allowed: used < limit,
    used,
    limit,
    scope: 'session',
    reason: used >= limit
      ? `Quota ${plan} atteint (${limit} recherches / conversation). Passez en Pro Agency pour 20/jour, ou ouvrez une nouvelle conversation.`
      : undefined,
  };
}

async function bumpSessionCounter(ctx: SkillContext): Promise<void> {
  const { data: sess } = await ctx.service
    .from('copilot_sessions')
    .select('context')
    .eq('id', ctx.sessionId)
    .maybeSingle();
  const sessionCtx = (sess?.context as Record<string, unknown> | null) ?? {};
  const next = { ...sessionCtx, live_search_count: Number(sessionCtx.live_search_count ?? 0) + 1 };
  await ctx.service
    .from('copilot_sessions')
    .update({ context: next })
    .eq('id', ctx.sessionId);
}

async function runDataForSEO(query: string, location: string, language: string): Promise<unknown[] | null> {
  const login = Deno.env.get('DATAFORSEO_LOGIN');
  const pass = Deno.env.get('DATAFORSEO_PASSWORD');
  if (!login || !pass) return null;
  try {
    const resp = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(`${login}:${pass}`),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ keyword: query, language_name: language, location_name: location, depth: 10 }]),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const items = data?.tasks?.[0]?.result?.[0]?.items ?? [];
    return items
      .filter((i: { type?: string }) => i.type === 'organic')
      .slice(0, 10)
      .map((i: { rank_absolute?: number; title?: string; url?: string; description?: string }) => ({
        position: i.rank_absolute,
        title: i.title,
        url: i.url,
        description: i.description?.slice(0, 160),
      }));
  } catch (e) {
    console.error('[copilot live_search] DataForSEO error:', (e as Error).message);
    return null;
  }
}

async function runSerpAPI(query: string, hl: string, gl: string): Promise<unknown[] | null> {
  const key = Deno.env.get('SERPAPI_KEY');
  if (!key) return null;
  try {
    const url = `https://serpapi.com/search.json?api_key=${key}&engine=google&q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&num=10`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    return (data.organic_results ?? []).slice(0, 10).map((r: { position?: number; title?: string; link?: string; snippet?: string }) => ({
      position: r.position,
      title: r.title,
      url: r.link,
      description: r.snippet?.slice(0, 160),
    }));
  } catch (e) {
    console.error('[copilot live_search] SerpAPI error:', (e as Error).message);
    return null;
  }
}

async function runGooglePlaces(query: string, language: string): Promise<unknown[] | null> {
  const key = Deno.env.get('GOOGLE_PLACES_API_KEY');
  if (!key) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&language=${language}&key=${key}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    return (data.results ?? []).slice(0, 5).map((r: {
      name?: string; formatted_address?: string; rating?: number; user_ratings_total?: number;
      types?: string[]; opening_hours?: { open_now?: boolean };
    }) => ({
      name: r.name,
      address: r.formatted_address,
      rating: r.rating,
      reviews_count: r.user_ratings_total,
      types: r.types?.slice(0, 3),
      open_now: r.opening_hours?.open_now,
    }));
  } catch (e) {
    console.error('[copilot live_search] Google Places error:', (e as Error).message);
    return null;
  }
}

const live_search: SkillDefinition = {
  name: 'live_search',
  description:
    "Recherche en temps réel sur Google (SERP organique via DataForSEO + fallback SerpAPI) ou Google Places (avis, fiches locales, horaires). À utiliser quand l'utilisateur demande explicitement des infos fraîches : positions Google, classement, fiche établissement, avis, etc. Quota: free=3/conv, agency_premium=5/conv, agency_pro=20/jour.",
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Requête à exécuter (mots-clés ou nom de lieu).' },
      mode: {
        type: 'string',
        enum: ['serp', 'places', 'auto'],
        default: 'auto',
        description: "'serp' = positions Google organiques, 'places' = fiche/avis Google, 'auto' = détection sur la requête.",
      },
      language: { type: 'string', default: 'French', description: 'Langue (DataForSEO format: French, English, ...).' },
      country_code: { type: 'string', default: 'fr', description: 'Code pays ISO 2 lettres (fr, us, gb, ...).' },
    },
    required: ['query'],
  },
  handler: async (input, ctx) => {
    const query = String(input.query ?? '').trim().slice(0, 200);
    if (!query) return { ok: false, error: 'query requis' };

    const reqMode = String(input.mode ?? 'auto');
    const language = String(input.language ?? 'French');
    const cc = String(input.country_code ?? 'fr').toLowerCase().slice(0, 2);
    const location = cc === 'fr' ? 'France' : cc === 'us' ? 'United States' : cc === 'gb' ? 'United Kingdom' : 'France';
    const hl = language.toLowerCase().startsWith('fr') ? 'fr' : 'en';

    // Détection auto du mode
    let mode = reqMode;
    if (mode === 'auto') {
      const lower = query.toLowerCase();
      const placesHints = /(avis|fiche|google maps|adresse|horaires|ouvert|restaurant|magasin|boutique|près de|proche)/;
      mode = placesHints.test(lower) ? 'places' : 'serp';
    }

    // Quota
    const quota = await checkLiveSearchQuota(ctx);
    if (!quota.allowed) {
      return {
        ok: false,
        error: quota.reason ?? 'Quota recherche en direct atteint.',
        data: { quota_used: quota.used, quota_limit: quota.limit, quota_scope: quota.scope },
      };
    }

    let results: unknown[] | null = null;
    let source = '';
    if (mode === 'places') {
      results = await runGooglePlaces(query, hl);
      source = 'Google Places';
    } else {
      results = await runDataForSEO(query, location, language);
      source = 'Google SERP (DataForSEO)';
      if (!results || results.length === 0) {
        results = await runSerpAPI(query, hl, cc);
        source = 'Google SERP (SerpAPI fallback)';
      }
    }

    if (!results || results.length === 0) {
      return { ok: false, error: `Aucun résultat ${source} pour "${query}".` };
    }

    // Bump compteur session (free / premium uniquement) + log analytics (toujours)
    if (quota.scope === 'session') {
      await bumpSessionCounter(ctx);
    }
    try {
      await ctx.service.from('analytics_events').insert({
        user_id: ctx.userId,
        event_type: 'copilot_live_search',
        event_data: {
          source, query, mode, results_count: results.length,
          persona: ctx.persona, session_id: ctx.sessionId,
          quota_scope: quota.scope, quota_used_after: quota.used + 1, quota_limit: quota.limit,
        },
      });
    } catch (e) {
      console.warn('[copilot live_search] analytics insert failed:', (e as Error).message);
    }

    return {
      ok: true,
      data: {
        source,
        mode,
        query,
        results,
        count: results.length,
        quota: { used: quota.used + 1, limit: quota.limit, scope: quota.scope },
      },
    };
  },
};

// ═══════════════════════════════════════════════════════════
// ESCALADE TÉLÉPHONE — Sprint Q5 Bloc 3
// Skill `approval` qui enregistre un numéro de rappel + expiration 48h
// dans une sav_conversation "shadow" liée à la session copilot.
// La policy 'approval' force le LLM à demander confirmation avant d'envoyer.
// Les ops admin (SAV Dashboard legacy) consomment toujours sav_conversations.
// ═══════════════════════════════════════════════════════════

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '');
  if (!digits) return null;
  // Accepte +33XXXXXXXXX, 0XXXXXXXXX, ou international ≥ 8 digits
  if (/^\+\d{8,15}$/.test(digits)) return digits;
  if (/^0\d{9}$/.test(digits)) return digits;
  if (/^\d{8,15}$/.test(digits)) return digits;
  return null;
}

const escalate_to_phone: SkillDefinition = {
  name: 'escalate_to_phone',
  description:
    "Enregistre une demande de rappel téléphonique humain. À utiliser UNIQUEMENT quand l'utilisateur a déjà demandé 2-3 fois la même chose sans résolution, ou explicitement réclamé un humain. Nécessite l'approbation de l'utilisateur (le numéro est enregistré, expire dans 48h).",
  parameters: {
    type: 'object',
    properties: {
      phone: { type: 'string', description: "Numéro de téléphone fourni par l'utilisateur (FR ou international, ex: '+33612345678', '0612345678')." },
      reason: { type: 'string', description: 'Résumé court du blocage (max 300 chars).' },
      expires_in_hours: { type: 'number', default: 48, description: "Durée de validité du rappel (défaut 48h, max 168h)." },
    },
    required: ['phone', 'reason'],
  },
  handler: async (input, ctx) => {
    const phone = normalizePhone(String(input.phone ?? ''));
    if (!phone) return { ok: false, error: 'phone invalide. Format attendu: +33612345678 ou 0612345678.' };

    const reason = String(input.reason ?? '').trim().slice(0, 300);
    if (!reason) return { ok: false, error: 'reason requis (résumé du blocage)' };

    const hours = Math.min(Math.max(Number(input.expires_in_hours ?? 48), 1), 168);
    const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();

    // 1) Récup / création de la sav_conversation "shadow" liée à cette session copilot
    const { data: sess } = await ctx.service
      .from('copilot_sessions')
      .select('context, persona')
      .eq('id', ctx.sessionId)
      .maybeSingle();
    const sessionCtx = (sess?.context as Record<string, unknown> | null) ?? {};
    let savConvId = sessionCtx.sav_conversation_id as string | undefined;

    if (!savConvId) {
      const { data: prof } = await ctx.service
        .from('profiles')
        .select('email')
        .eq('user_id', ctx.userId)
        .maybeSingle();
      const { data: created, error: cErr } = await ctx.service
        .from('sav_conversations')
        .insert({
          user_id: ctx.userId,
          user_email: prof?.email ?? null,
          messages: [],
          message_count: 0,
          assistant_type: ctx.persona,
          escalated: true,
          phone_callback: phone,
          phone_callback_expires_at: expiresAt,
          metadata: { copilot_session_id: ctx.sessionId, escalation_reason: reason, source: 'copilot' },
        })
        .select('id')
        .single();
      if (cErr || !created) return { ok: false, error: `Création conversation SAV : ${cErr?.message ?? 'inconnue'}` };
      savConvId = created.id;

      // Persiste la liaison dans le context de la session pour les futurs scorings
      await ctx.service
        .from('copilot_sessions')
        .update({ context: { ...sessionCtx, sav_conversation_id: savConvId } })
        .eq('id', ctx.sessionId);
    } else {
      // Mise à jour : nouveau numéro / nouvelle expiration
      const { error: uErr } = await ctx.service
        .from('sav_conversations')
        .update({
          escalated: true,
          phone_callback: phone,
          phone_callback_expires_at: expiresAt,
          metadata: { copilot_session_id: ctx.sessionId, escalation_reason: reason, source: 'copilot' },
        })
        .eq('id', savConvId)
        .eq('user_id', ctx.userId);
      if (uErr) return { ok: false, error: `MAJ conversation SAV : ${uErr.message}` };
    }

    // Log analytics
    try {
      await ctx.service.from('analytics_events').insert({
        user_id: ctx.userId,
        event_type: 'copilot_phone_escalation',
        event_data: {
          persona: ctx.persona,
          session_id: ctx.sessionId,
          sav_conversation_id: savConvId,
          phone_masked: phone.slice(0, 4) + '****' + phone.slice(-2),
          reason,
          expires_at: expiresAt,
        },
      });
    } catch (e) {
      console.warn('[copilot escalate_to_phone] analytics insert failed:', (e as Error).message);
    }

    return {
      ok: true,
      data: {
        sav_conversation_id: savConvId,
        phone_masked: phone.slice(0, 4) + '****' + phone.slice(-2),
        expires_at: expiresAt,
        message: `Demande de rappel enregistrée. Un membre de l'équipe te rappellera sous ${hours}h au numéro fourni.`,
      },
    };
  },
};

// ═══════════════════════════════════════════════════════════
// COCOON STRATÈGE — wrappers vers les edge functions existantes
// (récupère la puissance de l'ancien Stratège dans le Copilot unifié)
// ═══════════════════════════════════════════════════════════

const analyze_cocoon: SkillDefinition = {
  name: 'analyze_cocoon',
  description: "Lance un diagnostic stratégique complet du cocoon sémantique d'un site (4 axes parallèles : content, semantic, structure, authority) et renvoie les findings priorisés. Pas de modification du site.",
  parameters: {
    type: 'object',
    properties: {
      tracked_site_id: { type: 'string', description: 'UUID du site suivi' },
      domain: { type: 'string', description: 'Domaine du site (ex: example.com)' },
      force_refresh: { type: 'boolean', default: false },
    },
    required: ['tracked_site_id', 'domain'],
  },
  handler: async (input, ctx) => {
    const trackedSiteId = String(input.tracked_site_id ?? '').trim();
    const domain = String(input.domain ?? '').trim();
    if (!trackedSiteId || !domain) return { ok: false, error: 'tracked_site_id et domain requis' };
    try {
      const { data, error } = await ctx.supabase.functions.invoke('cocoon-strategist', {
        body: {
          tracked_site_id: trackedSiteId,
          domain,
          force_refresh: !!input.force_refresh,
          lang: 'fr',
          // Diagnostic seul → pas de boost prio création contenu
          content_priority_mode: false,
        },
      });
      if (error) return { ok: false, error: `cocoon-strategist : ${error.message}` };
      const d = (data ?? {}) as Record<string, unknown>;
      return {
        ok: true,
        data: {
          findings: (d.findings as unknown[])?.slice(0, 10) ?? [],
          tasks_count: Array.isArray(d.tasks) ? (d.tasks as unknown[]).length : 0,
          axes: d.axes ?? null,
          summary: d.summary ?? null,
        },
      };
    } catch (e) {
      return { ok: false, error: `Echec analyze_cocoon : ${(e as Error).message}` };
    }
  },
};

const plan_editorial: SkillDefinition = {
  name: 'plan_editorial',
  description: "Génère un plan de tâches éditoriales déterministe (jusqu'à 8 tâches typées : create_content, rewrite_then_link, fix_cannibalization, add_internal_link, restructure_tree…) à partir du diagnostic Cocoon. Persiste les tâches en base, prêtes à être ouvertes dans le Plan de tâches.",
  parameters: {
    type: 'object',
    properties: {
      tracked_site_id: { type: 'string' },
      domain: { type: 'string' },
      task_budget: { type: 'number', default: 8, description: 'Nombre max de tâches (1-12)' },
      content_priority_mode: { type: 'boolean', default: true, description: 'Boost x1.8 sur tâches de création contenu' },
    },
    required: ['tracked_site_id', 'domain'],
  },
  handler: async (input, ctx) => {
    const trackedSiteId = String(input.tracked_site_id ?? '').trim();
    const domain = String(input.domain ?? '').trim();
    if (!trackedSiteId || !domain) return { ok: false, error: 'tracked_site_id et domain requis' };
    const budget = Math.min(12, Math.max(1, Number(input.task_budget ?? 8)));
    try {
      const { data, error } = await ctx.supabase.functions.invoke('cocoon-strategist', {
        body: {
          tracked_site_id: trackedSiteId,
          domain,
          lang: 'fr',
          task_budget: budget,
          content_priority_mode: input.content_priority_mode !== false,
        },
      });
      if (error) return { ok: false, error: `cocoon-strategist : ${error.message}` };
      const d = (data ?? {}) as Record<string, unknown>;
      const tasks = (d.tasks as Array<Record<string, unknown>>) ?? [];
      return {
        ok: true,
        data: {
          tasks_count: tasks.length,
          editorial_count: tasks.filter(t => t.execution_mode === 'content_architect').length,
          code_count: tasks.filter(t => t.execution_mode === 'code_architect').length,
          ops_count: tasks.filter(t => t.execution_mode === 'operational_queue').length,
          top_tasks: tasks.slice(0, 5).map(t => ({
            title: t.title ?? t.action_type,
            action_type: t.action_type,
            execution_mode: t.execution_mode,
            target_url: t.target_url,
            priority: t.priority,
          })),
          // Directive UI : ouvre le Plan de tâches sur ce site
          ui_action: { action: 'navigate', path: `/app/cocoon?tab=plan&site=${trackedSiteId}` },
        },
      };
    } catch (e) {
      return { ok: false, error: `Echec plan_editorial : ${(e as Error).message}` };
    }
  },
};

const deploy_cocoon_plan: SkillDefinition = {
  name: 'deploy_cocoon_plan',
  description: "Déploie un lot de liens internes recommandés sur le site (injection 3 tiers : wrap direct → context sentence → phrase-pont IA). Action destructive : nécessite approbation utilisateur. Mode 'preview' possible pour simuler sans écrire.",
  parameters: {
    type: 'object',
    properties: {
      tracked_site_id: { type: 'string' },
      recommendations: {
        type: 'array',
        description: "Liste de recommandations { source_url, target_url, anchor_text, context_sentence? }",
        items: { type: 'object' },
      },
      mode: { type: 'string', enum: ['preview', 'deploy'], default: 'deploy' },
    },
    required: ['tracked_site_id', 'recommendations'],
  },
  handler: async (input, ctx) => {
    const trackedSiteId = String(input.tracked_site_id ?? '').trim();
    const recos = Array.isArray(input.recommendations) ? input.recommendations : [];
    const mode = input.mode === 'preview' ? 'preview' : 'deploy';
    if (!trackedSiteId) return { ok: false, error: 'tracked_site_id requis' };
    if (recos.length === 0) return { ok: false, error: 'recommendations[] non vide requis' };
    if (recos.length > 50) return { ok: false, error: 'Maximum 50 recommandations par lot' };
    try {
      const { data, error } = await ctx.supabase.functions.invoke('cocoon-deploy-links', {
        body: { tracked_site_id: trackedSiteId, recommendations: recos, mode },
      });
      if (error) return { ok: false, error: `cocoon-deploy-links : ${error.message}` };
      const d = (data ?? {}) as Record<string, unknown>;
      return {
        ok: true,
        data: {
          mode,
          deployed: d.deployed ?? null,
          failed: d.failed ?? null,
          preview: d.preview ?? null,
          ui_action: { action: 'navigate', path: `/app/cocoon?tab=maillage&site=${trackedSiteId}` },
        },
      };
    } catch (e) {
      return { ok: false, error: `Echec deploy_cocoon_plan : ${(e as Error).message}` };
    }
  },
};

// ═══════════════════════════════════════════════════════════
// audit_internal_mesh — Rapport synthétique maillage interne
// (orphelines + dead-ends + hubs faibles + intentions)
// ═══════════════════════════════════════════════════════════
const audit_internal_mesh: SkillDefinition = {
  name: 'audit_internal_mesh',
  description: "Audit synthétique du maillage interne d'un site : orphelines, dead-ends, hubs sous-maillés, distribution Know/Do/Buy/Navigate/Unknown. Renvoie un rapport markdown lisible + métriques agrégées. Aucune modification du site.",
  parameters: {
    type: 'object',
    properties: {
      tracked_site_id: { type: 'string', description: 'UUID du site suivi' },
      domain: { type: 'string', description: 'Domaine du site (fallback si tracked_site_id absent)' },
    },
    required: [],
  },
  handler: async (input, ctx) => {
    const trackedSiteId = String(input.tracked_site_id ?? '').trim();
    const domain = String(input.domain ?? '').trim().replace(/^www\./, '');
    if (!trackedSiteId && !domain) return { ok: false, error: 'tracked_site_id ou domain requis' };

    // 1. Find latest completed crawl
    let crawlQuery = ctx.supabase.from('site_crawls').select('id, domain, intent_distribution, completed_at').eq('status', 'completed').order('created_at', { ascending: false }).limit(1);
    if (domain) crawlQuery = crawlQuery.or(`domain.eq.${domain},domain.eq.www.${domain}`);
    const { data: crawls } = await crawlQuery;
    const crawl = crawls?.[0];
    if (!crawl) return { ok: false, error: 'Aucun crawl terminé pour ce site. Lance un audit d’abord.' };

    // 2. Pull pages
    const { data: pages } = await ctx.supabase
      .from('crawl_pages')
      .select('url, path, title, h1, internal_links, external_links, anchor_texts, page_intent, intent_confidence, seo_score, crawl_depth, is_indexable')
      .eq('crawl_id', crawl.id);
    const list = (pages ?? []) as any[];
    if (list.length === 0) return { ok: false, error: 'Crawl vide' };

    // 3. Compute inbound link count → orphans + dead-ends
    const norm = (u: string) => { try { return new URL(u).pathname.replace(/\/$/, '') || '/'; } catch { return u; } };
    const inbound = new Map<string, number>();
    for (const p of list) inbound.set(norm(p.url), 0);
    for (const p of list) {
      for (const link of (p.anchor_texts || [])) {
        if (link.type === 'internal') {
          const target = norm(link.href.startsWith('/') ? `https://x${link.href}` : link.href);
          if (inbound.has(target)) inbound.set(target, (inbound.get(target) || 0) + 1);
        }
      }
    }
    const orphans = list.filter(p => (inbound.get(norm(p.url)) || 0) === 0 && norm(p.url) !== '/');
    const deadEnds = list.filter(p => (p.internal_links || 0) === 0 && p.is_indexable);
    const weakHubs = list.filter(p => (p.crawl_depth ?? 99) <= 1 && (p.internal_links || 0) < 5);

    // 4. Intent agg (use stored or recompute summary)
    const dist = (crawl as any).intent_distribution || (() => {
      const acc: Record<string, number> = { know: 0, do: 0, buy: 0, navigate: 0, unknown: 0 };
      for (const p of list) acc[p.page_intent || 'unknown'] = (acc[p.page_intent || 'unknown'] || 0) + 1;
      return { total: list.length, by_intent: acc };
    })();

    // 5. Build markdown report
    const fmt = (n: number) => String(n).padStart(3, ' ');
    const md = [
      `## Audit maillage interne — ${crawl.domain}`,
      `_Crawl : ${new Date(crawl.completed_at).toLocaleDateString('fr-FR')} • ${list.length} pages_`,
      '',
      `### Distribution d'intentions`,
      `- **Know** (informationnel) : ${dist.by_intent?.know ?? 0}`,
      `- **Do** (action) : ${dist.by_intent?.do ?? 0}`,
      `- **Buy** (transactionnel) : ${dist.by_intent?.buy ?? 0}`,
      `- **Navigate** (navigation) : ${dist.by_intent?.navigate ?? 0}`,
      `- **Unknown** (signal < 0,7) : ${dist.by_intent?.unknown ?? 0}`,
      '',
      `### Anomalies détectées`,
      `- Pages **orphelines** (zéro lien entrant) : **${orphans.length}**`,
      `- Pages **dead-end** (zéro lien sortant interne) : **${deadEnds.length}**`,
      `- **Hubs faibles** (depth ≤ 1, < 5 liens sortants) : **${weakHubs.length}**`,
      '',
    ];
    if (orphans.length > 0) {
      md.push(`#### Top 10 orphelines`);
      for (const p of orphans.slice(0, 10)) md.push(`- ${p.url}`);
      md.push('');
    }
    if (deadEnds.length > 0) {
      md.push(`#### Top 5 dead-ends`);
      for (const p of deadEnds.slice(0, 5)) md.push(`- ${p.url}`);
      md.push('');
    }
    if (weakHubs.length > 0) {
      md.push(`#### Hubs à renforcer`);
      for (const p of weakHubs.slice(0, 5)) md.push(`- ${p.url} _(${p.internal_links} liens)_`);
    }

    return {
      ok: true,
      data: {
        crawl_id: crawl.id,
        total_pages: list.length,
        intent_distribution: dist,
        orphans_count: orphans.length,
        dead_ends_count: deadEnds.length,
        weak_hubs_count: weakHubs.length,
        report_markdown: md.join('\n'),
        ui_action: trackedSiteId ? { action: 'navigate', path: `/app/cocoon?tab=plan&site=${trackedSiteId}` } : undefined,
      },
    };
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
  // Stratège Cocoon — analyse, plan, déploiement (récupération post-refacto)
  analyze_cocoon,
  plan_editorial,
  deploy_cocoon_plan,
  audit_internal_mesh,
  // Mémoire persistante & enrichissement carte d'identité (Sprint Q5)
  read_site_memory,
  write_site_memory,
  list_identity_suggestions,
  propose_identity_suggestion,
  // Live Search (Sprint Q5 Bloc 2)
  live_search,
  // Escalade téléphone (Sprint Q5 Bloc 3)
  escalate_to_phone,
  // Skills admin (creator_mode only)
  admin_lookup_user,
  admin_track_site,
  admin_untrack_site,
  admin_list_user_sites,
  admin_reset_api_key,
  admin_grant_pro,
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
