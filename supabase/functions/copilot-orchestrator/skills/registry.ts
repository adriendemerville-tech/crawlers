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
  description: "[ADMIN] Recherche un utilisateur par nom/prénom/email et retourne ses sites suivis + statut des connexions CMS, Google (GSC/GA4), Matomo, Canva. Utiliser pour répondre aux questions support du type « X a-t-il pu connecter son CMS pour le site Y ? ». Filtre optionnel par domaine pour cibler un site précis.",
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

      // 4) Pour chaque site : connexions CMS (scope site) + matchs Google par URL.
      const sitesEnriched = await Promise.all((sites ?? []).map(async (s) => {
        const [cmsRes, matomoRes] = await Promise.all([
          ctx.service.from('cms_connections')
            .select('id, platform, auth_method, status, site_url, scopes, capabilities, created_at, updated_at, token_expiry')
            .eq('user_id', p.user_id).eq('tracked_site_id', s.id),
          ctx.service.from('matomo_connections')
            .select('id, matomo_url, site_id, is_active, last_sync_at, sync_error, created_at')
            .eq('user_id', p.user_id).eq('tracked_site_id', s.id),
        ]);

        // Matche les connexions Google qui couvrent ce domaine via gsc_site_urls
        const domainNorm = (s.domain ?? '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
        const googleForSite = userGoogle.filter((g: any) => {
          const urls: string[] = Array.isArray(g.gsc_site_urls) ? g.gsc_site_urls : [];
          return urls.some((u) => String(u).toLowerCase().includes(domainNorm));
        });

        return {
          site_id: s.id,
          domain: s.domain,
          site_name: s.site_name,
          cms_platform_declared: s.cms_platform,
          last_cms_refresh_at: s.last_cms_refresh_at,
          last_audit_at: s.last_audit_at,
          connections: {
            cms: cmsRes.data ?? [],
            cms_count: (cmsRes.data ?? []).length,
            google_for_this_site: googleForSite,
            matomo: matomoRes.data ?? [],
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
    const { data: site } = await ctx.supabase
      .from('tracked_sites')
      .select(field)
      .eq('id', resolved.id)
      .maybeSingle();
    const currentVal = site && (site as Record<string, unknown>)[field] != null
      ? String((site as Record<string, unknown>)[field])
      : null;

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
  // Mémoire persistante & enrichissement carte d'identité (Sprint Q5)
  read_site_memory,
  write_site_memory,
  list_identity_suggestions,
  propose_identity_suggestion,
  // Skills admin (creator_mode only)
  admin_lookup_user,
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
