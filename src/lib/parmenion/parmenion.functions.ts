import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  runDiagnostic,
  deriveFixes,
  deriveTopics,
  normalizeUrl,
  type PasseDiagnostic,
} from "./diagnostic.server";

const PARMENION_PRICE_ID = "parmenion_59_eur";
const PARMENION_PRODUCT_ID = "parmenion_pass";
const PARMENION_AMOUNT_CENTS = 5900;
const FREE_DIAGNOSTIC_QUOTA = 3;
const MAX_REVISIONS = 2;

/* ── utilitaires serveur ─────────────────────────────────── */

function clientIp(): string {
  const fwd = getRequestHeader("x-forwarded-for") || "";
  const first = fwd.split(",")[0]?.trim();
  return first || getRequestHeader("cf-connecting-ip") || getRequestHeader("x-real-ip") || "unknown";
}

async function hashIp(ip: string): Promise<string> {
  const pepper = (process.env["SUPABASE_SERVICE_ROLE_KEY"] || "parmenion").slice(0, 24);
  const bytes = new TextEncoder().encode(`parmenion-free:${pepper}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const diagCache = new Map<string, { at: number; diag: PasseDiagnostic }>();
const DIAG_TTL_MS = 30 * 60 * 1000;

async function cachedDiagnostic(url: string): Promise<PasseDiagnostic> {
  const key = url.toLowerCase();
  const hit = diagCache.get(key);
  if (hit && Date.now() - hit.at < DIAG_TTL_MS) return hit.diag;
  const diag = await runDiagnostic(url);
  diagCache.set(key, { at: Date.now(), diag });
  return diag;
}

/* ── Lot 1 — diagnostic gratuit sans compte, quota serveur ─ */

export const runFreePasseDiagnostic = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string }) => input)
  .handler(async ({ data }) => {
    const target = normalizeUrl(String(data?.url ?? ""));
    if (!target) return { error: "invalid_url" as const, message: "Adresse de site invalide." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ipHash = await hashIp(clientIp());

    const { count } = await supabaseAdmin
      .from("passe_free_diagnostics")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash);

    if ((count ?? 0) >= FREE_DIAGNOSTIC_QUOTA) {
      return {
        error: "quota_exhausted" as const,
        message: "Vos analyses gratuites ont été utilisées. Créez un compte pour continuer.",
      };
    }

    const diag = await cachedDiagnostic(target);

    await supabaseAdmin.from("passe_free_diagnostics").insert({
      ip_hash: ipHash,
      normalized_url: target,
      score: diag.score,
    });

    // Sans compte, seuls le score et les intitulés sont renvoyés : le détail
    // n'apparaît qu'après inscription (étape 2 du parcours).
    return {
      url: diag.url,
      host: diag.host,
      score: diag.score,
      unreachable: Boolean(diag.unreachable),
      teaser: diag.findings.map((x) => ({ id: x.id, label: x.label, impact: x.impact })),
      total: diag.findings.length,
    };
  });

/* ── Lot 1 bis / 2 — commande + diagnostic détaillé + correctifs ─ */

export const createParmenionOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ url: z.string().min(3) }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const userId = context.userId;
    if (!userId) return { error: "unauthenticated" as const };

    const target = normalizeUrl(data.url);
    if (!target) return { error: "invalid_url" as const };

    // Reprise : une commande non payée sur la même adresse est réutilisée.
    const { data: existing } = await supabase
      .from("passe_orders")
      .select("id")
      .eq("user_id", userId)
      .eq("normalized_url", target)
      .is("paid_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let orderId = existing?.id as string | undefined;

    if (!orderId) {
      const { data: order, error: orderErr } = await supabase
        .from("passe_orders")
        .insert({ user_id: userId, url: data.url, normalized_url: target, status: "created", step: 3 })
        .select("id")
        .single();
      if (orderErr || !order) {
        console.error("[createParmenionOrder] insert error", orderErr);
        return { error: "insert_failed" as const };
      }
      orderId = order.id;
      await supabase.from("passe_order_events").insert({
        order_id: orderId, user_id: userId, event: "created",
        payload: { url: target, product_id: PARMENION_PRODUCT_ID, amount_cents: PARMENION_AMOUNT_CENTS },
      });
    }

    // Diagnostic détaillé + correctifs figés sur la commande.
    const diag = await cachedDiagnostic(target);
    const fixes = deriveFixes(diag);
    const topics = deriveTopics(diag);

    await supabase
      .from("passe_orders")
      .update({
        diagnostic: diag as unknown as never,
        findings: diag.findings as unknown as never,
        fixes: fixes as unknown as never,
        step: 4,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("user_id", userId);

    // Pass à usage unique, créé une seule fois par commande.
    const { data: pass } = await supabase
      .from("passe_passes")
      .select("pass_token")
      .eq("order_id", orderId)
      .maybeSingle();

    let passToken = pass?.pass_token as string | undefined;
    if (!passToken) {
      passToken = crypto.randomUUID();
      const { error: passErr } = await supabase.from("passe_passes").insert({
        order_id: orderId, user_id: userId, pass_token: passToken,
        amount_cents: PARMENION_AMOUNT_CENTS, status: "pending",
      });
      if (passErr) {
        console.error("[createParmenionOrder] pass insert error", passErr);
        return { error: "insert_failed" as const };
      }
    }

    return {
      orderId,
      passToken,
      priceId: PARMENION_PRICE_ID,
      amountCents: PARMENION_AMOUNT_CENTS,
      diagnostic: diag,
      fixes,
      topics,
    };
  });

/* ── état de commande (reprise à l'étape en cours) ────────── */

export const getPasseOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: order } = await supabase
      .from("passe_orders")
      .select("*")
      .eq("id", data.orderId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!order) return { error: "not_found" as const };

    const [{ data: contents }, { data: events }] = await Promise.all([
      supabase.from("passe_order_contents").select("*").eq("order_id", data.orderId).order("created_at"),
      supabase.from("passe_order_events").select("event, payload, created_at").eq("order_id", data.orderId).order("created_at", { ascending: false }).limit(50),
    ]);

    return { order, contents: contents ?? [], events: events ?? [], paid: Boolean(order.paid_at) };
  });

export const listPasseOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("passe_orders")
      .select("id, url, status, step, paid_at, deployed_at, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return { orders: data ?? [] };
  });

/* ── Lot 3 — les 3 contenus, génération unique puis relecture ─ */

export const generatePasseContents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderId: z.string().uuid(), topics: z.array(z.string()).max(3).optional() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: order } = await supabase
      .from("passe_orders")
      .select("id, normalized_url, diagnostic")
      .eq("id", data.orderId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!order) return { error: "not_found" as const };

    const { data: already } = await supabase
      .from("passe_order_contents")
      .select("*")
      .eq("order_id", data.orderId)
      .order("created_at");
    if ((already ?? []).length >= 3) return { contents: already ?? [] };

    const diag = (order.diagnostic ?? {}) as unknown as PasseDiagnostic;
    const host = diag.host || (order.normalized_url ? new URL(order.normalized_url).hostname : "");
    const topics = (
      data.topics && data.topics.length === 3
        ? data.topics
        : deriveTopics({ ...diag, host, brand: diag.brand || host } as PasseDiagnostic)
    ).slice(0, 3);

    const domain = host;

    const created: Record<string, unknown>[] = [];

    for (const topic of topics) {
      let html = "";
      let title = topic;
      try {
        const { data: res } = await supabase.functions.invoke("editorial-pipeline-run", {
          body: { domain, content_type: "blog_article", user_brief: topic },
        });
        const payload = res as { title?: string; html?: string; content?: string; body?: string } | null;
        title = payload?.title || topic;
        html = payload?.html || payload?.content || payload?.body || "";
      } catch (e) {
        console.error("[generatePasseContents] pipeline error", e);
      }

      const { data: row } = await supabase
        .from("passe_order_contents")
        .insert({
          order_id: data.orderId,
          user_id: userId,
          topic,
          title,
          draft_html: html,
          status: html ? "draft" : "failed",
        })
        .select("*")
        .single();
      if (row) created.push(row);
    }

    await supabase.from("passe_order_events").insert({
      order_id: data.orderId, user_id: userId, event: "contents_generated",
      payload: { topics },
    });
    await supabase.from("passe_orders").update({ step: 5 }).eq("id", data.orderId).eq("user_id", userId);

    return { contents: created };
  });

export const revisePasseContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ contentId: z.string().uuid(), instruction: z.string().min(3).max(2000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: content } = await supabase
      .from("passe_order_contents")
      .select("*")
      .eq("id", data.contentId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!content) return { error: "not_found" as const };
    if (content.status === "approved") return { error: "locked" as const };
    if ((content.revision_count ?? 0) >= MAX_REVISIONS) return { error: "revision_limit" as const };

    // Correction ciblée : on ne régénère pas tout l'article.
    let revised = content.draft_html ?? "";
    try {
      const { data: res } = await supabase.functions.invoke("editorial-pipeline-run", {
        body: {
          domain: "",
          content_type: "blog_article",
          user_brief: `Corrige ce texte selon la demande du client sans le réécrire entièrement. Demande : ${data.instruction}\n\nTexte:\n${(content.draft_html ?? "").slice(0, 20000)}`,
        },
      });
      const payload = res as { html?: string; content?: string; body?: string } | null;
      revised = payload?.html || payload?.content || payload?.body || revised;
    } catch (e) {
      console.error("[revisePasseContent] pipeline error", e);
      return { error: "revision_failed" as const };
    }

    const { data: row } = await supabase
      .from("passe_order_contents")
      .update({
        draft_html: revised,
        client_revision: data.instruction,
        revision_count: (content.revision_count ?? 0) + 1,
        status: "revised",
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.contentId)
      .eq("user_id", userId)
      .select("*")
      .single();

    await supabase.from("passe_order_events").insert({
      order_id: content.order_id, user_id: userId, event: "content_revised",
      payload: { content_id: data.contentId, instruction: data.instruction },
    });

    return { content: row, remaining: MAX_REVISIONS - ((content.revision_count ?? 0) + 1) };
  });

export const approvePasseContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ contentId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("passe_order_contents")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", data.contentId)
      .eq("user_id", userId)
      .select("order_id")
      .single();
    if (!row) return { error: "not_found" as const };

    await supabase.from("passe_order_events").insert({
      order_id: row.order_id, user_id: userId, event: "content_approved",
      payload: { content_id: data.contentId },
    });

    const { data: pending } = await supabase
      .from("passe_order_contents")
      .select("id")
      .eq("order_id", row.order_id)
      .neq("status", "approved");

    const allApproved = (pending ?? []).length === 0;
    if (allApproved) {
      await supabase.from("passe_orders").update({ step: 6 }).eq("id", row.order_id).eq("user_id", userId);
    }
    return { approved: true, allApproved };
  });

/* ── Lot 4 — connexions site + fiche Google Maps ──────────── */

export const getPasseConnections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: cms }, { data: locations }] = await Promise.all([
      supabase
        .from("cms_connections")
        .select("id, platform, site_url, tracked_site_id, status")
        .eq("user_id", userId)
        .eq("status", "active"),
      supabase
        .from("gmb_locations")
        .select("id, place_id, location_name, address, tracked_site_id")
        .eq("user_id", userId)
        .limit(50),
    ]);
    return { cms: cms ?? [], locations: locations ?? [] };
  });

export const linkPasseTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        orderId: z.string().uuid(),
        trackedSiteId: z.string().uuid().optional(),
        gmbLocationId: z.string().max(200).optional(),
        gmbAccountId: z.string().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = { step: 7, updated_at: new Date().toISOString() };
    if (data.trackedSiteId) patch["tracked_site_id"] = data.trackedSiteId;
    if (data.gmbLocationId) patch["gmb_location_id"] = data.gmbLocationId;
    if (data.gmbAccountId) patch["gmb_account_id"] = data.gmbAccountId;

    const { data: row } = await supabase
      .from("passe_orders")
      .update(patch as never)
      .eq("id", data.orderId)
      .eq("user_id", userId)
      .select("id, tracked_site_id, gmb_location_id")
      .single();
    if (!row) return { error: "not_found" as const };

    await supabase.from("passe_order_events").insert({
      order_id: data.orderId, user_id: userId, event: "targets_linked", payload: patch as never,
    });
    return { order: row };
  });

/* ── Lot 6 — déploiement, uniquement après paiement ───────── */

async function assertPaid(orderId: string, userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("passe_orders")
    .select("paid_at, user_id")
    .eq("id", orderId)
    .maybeSingle();
  return Boolean(data && data.user_id === userId && data.paid_at);
}

export const deployPasseOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verrou : le paiement est lu côté serveur, jamais depuis le navigateur.
    if (!(await assertPaid(data.orderId, userId))) {
      return { error: "not_paid" as const, message: "Le paiement n'est pas confirmé." };
    }

    const { data: order } = await supabase
      .from("passe_orders")
      .select("*")
      .eq("id", data.orderId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!order) return { error: "not_found" as const };

    const { data: contents } = await supabase
      .from("passe_order_contents")
      .select("*")
      .eq("order_id", data.orderId)
      .eq("status", "approved");

    const log = async (event: string, payload: Record<string, unknown>) => {
      await supabase.from("passe_order_events").insert({
        order_id: data.orderId, user_id: userId, event, payload: payload as never,
      });
    };

    /* Site — publication réversible, un élément à la fois, rejouable. */
    const published: { id: string; cms_id?: string; url?: string; error?: string }[] = [];
    if (order.tracked_site_id) {
      for (const c of contents ?? []) {
        if (c.cms_id) { published.push({ id: c.id, cms_id: c.cms_id }); continue; }
        try {
          const { data: pushed } = await supabase.functions.invoke("cms-push-draft", {
            body: {
              tracked_site_id: order.tracked_site_id,
              content_type: "post",
              title: c.title ?? c.topic,
              body: c.draft_html ?? "",
            },
          });
          const res = pushed as { success?: boolean; cms_id?: string; url?: string; detail?: string } | null;
          if (res?.success && res.cms_id) {
            await supabase
              .from("passe_order_contents")
              .update({ status: "published", cms_id: String(res.cms_id), published_url: res.url ?? null })
              .eq("id", c.id)
              .eq("user_id", userId);
            published.push({ id: c.id, cms_id: String(res.cms_id), url: res.url });
            await log("site_content_published", { content_id: c.id, cms_id: res.cms_id });
          } else {
            published.push({ id: c.id, error: res?.detail ?? "push_failed" });
            await log("site_content_failed", { content_id: c.id, detail: res?.detail });
          }
        } catch (e) {
          published.push({ id: c.id, error: (e as Error).message });
          await log("site_content_failed", { content_id: c.id, detail: (e as Error).message });
        }
      }
    }

    const siteOk = (contents ?? []).length > 0 && published.every((p) => !p.error);

    /* Fiche Google Maps — un événement journalisé par champ modifié. */
    let gmbStatus = "skipped";
    if (order.tracked_site_id && order.gmb_location_id) {
      const preview = (order.gmb_preview ?? {}) as Record<string, unknown>;
      try {
        const { data: updated } = await supabase.functions.invoke("gmb-actions", {
          body: {
            action: "update-location-info",
            tracked_site_id: order.tracked_site_id,
            fields: preview,
          },
        });
        const res = updated as { success?: boolean; changed?: string[]; error?: string } | null;
        if (res?.success) {
          gmbStatus = "done";
          for (const field of res.changed ?? Object.keys(preview)) {
            await log("gmb_field_updated", { field, value: preview[field] ?? null });
          }
        } else {
          gmbStatus = "failed";
          await log("gmb_update_failed", { detail: res?.error ?? "unknown" });
        }
      } catch (e) {
        gmbStatus = "failed";
        await log("gmb_update_failed", { detail: (e as Error).message });
      }

      if (gmbStatus === "done") {
        try {
          const summary = (contents ?? [])[0]?.title ?? "Nouveauté";
          await supabase.functions.invoke("gmb-actions", {
            body: {
              action: "create-post",
              tracked_site_id: order.tracked_site_id,
              summary: String(summary).slice(0, 1400),
            },
          });
          await log("gmb_post_created", { summary });
        } catch (e) {
          await log("gmb_post_failed", { detail: (e as Error).message });
        }
      }
    }

    const allDone = siteOk && gmbStatus !== "failed";
    await supabase
      .from("passe_orders")
      .update({
        site_deploy_status: siteOk ? "done" : "failed",
        gmb_deploy_status: gmbStatus,
        deployed_at: allDone ? new Date().toISOString() : null,
        status: allDone ? "deployed" : "deploy_partial",
        step: allDone ? 9 : 8,
        report: {
          before: { score: (order.diagnostic as { score?: number } | null)?.score ?? null, findings: order.findings },
          after: { published, gmb: gmbStatus },
          at: new Date().toISOString(),
        } as never,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.orderId)
      .eq("user_id", userId);

    await log(allDone ? "deployed" : "deploy_partial", { published, gmb: gmbStatus });

    return { deployed: allDone, published, gmb: gmbStatus };
  });

/* ── aperçu fiche Google Maps validé avant écriture ───────── */

export const savePasseGmbPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        orderId: z.string().uuid(),
        fields: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("passe_orders")
      .update({ gmb_preview: data.fields as never, updated_at: new Date().toISOString() })
      .eq("id", data.orderId)
      .eq("user_id", userId)
      .select("id")
      .single();
    if (!row) return { error: "not_found" as const };
    await supabase.from("passe_order_events").insert({
      order_id: data.orderId, user_id: userId, event: "gmb_preview_approved", payload: data.fields as never,
    });
    return { saved: true };
  });
