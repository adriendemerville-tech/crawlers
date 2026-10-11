/**
 * Passerelle Agentik (catalogue de 2 400+ outils tiers : réseaux sociaux,
 * plateformes chinoises, publicité, personnes & entreprises…).
 * discover / inspect : gratuits, utilisateurs connectés.
 * run / getRun : facturés sur le solde Agentik, réservés Pro Agency ou admin.
 * La clé AGENTIK_API_KEY reste côté serveur.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const API = "https://api.agentik.cc";
const toolId = z.string().regex(/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._\-/]*$/i).max(200);

async function agentik(path: string, init: RequestInit = {}, withKey = true) {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (withKey) {
    const key = process.env["AGENTIK_API_KEY"];
    if (!key) throw new Error("Clé Agentik non configurée");
    headers.set("Authorization", `Bearer ${key}`);
  }
  const res = await fetch(`${API}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[agentik] ${init.method ?? "GET"} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
    throw new Error(`Agentik [${res.status}]: ${text.slice(0, 300)}`);
  }
  try { return JSON.parse(text) as unknown; } catch { return text; }
}

async function assertPaidOrAdmin(supabase: any, userId: string) {
  const [{ data: isAdmin }, { data: profile }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.from("profiles").select("plan_type, subscription_status").eq("user_id", userId).maybeSingle(),
  ]);
  const paid = ["agency_pro", "agency_premium"].includes(profile?.plan_type)
    && ["active", "canceling"].includes(profile?.subscription_status);
  if (!isAdmin && !paid) throw new Error("Réservé au plan Pro Agency");
}

export const agentikDiscover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ query: z.string().trim().min(1).max(300), limit: z.number().int().min(1).max(50).optional() }).parse(d))
  .handler(async ({ data }) =>
    agentik("/v1/discover", { method: "POST", body: JSON.stringify({ query: data.query, limit: data.limit ?? 10 }) }, false) as Promise<any>);

export const agentikInspect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ toolId }).parse(d))
  .handler(async ({ data }) => agentik(`/v1/tools/${data.toolId}`, {}, false) as Promise<any>);

export const agentikRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    toolId,
    input: z.record(z.string(), z.unknown()).default({}),
    idempotencyKey: z.string().min(8).max(128).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPaidOrAdmin(context.supabase, context.userId);
    const idem = data.idempotencyKey ?? crypto.randomUUID();
    const result = await agentik("/v1/run", {
      method: "POST",
      headers: { "Idempotency-Key": idem },
      body: JSON.stringify({ tool_id: data.toolId, input: data.input }),
    });
    return { idempotencyKey: idem, result: result as any };
  });

export const agentikGetRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ runId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPaidOrAdmin(context.supabase, context.userId);
    return agentik(`/v1/runs/${data.runId}`) as Promise<any>;
  });
