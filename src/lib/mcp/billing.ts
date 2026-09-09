import type { ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./supabase";

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

export const err = (text: string): ToolResult => ({
  content: [{ type: "text", text }],
  isError: true,
});

export const ok = (text: string, structured?: Record<string, unknown>): ToolResult => ({
  content: [{ type: "text", text }],
  ...(structured ? { structuredContent: structured } : {}),
});

export const euros = (micro: number) => `${(micro / 1000).toFixed(3)} €`;

/** Clé d'idempotence stable : un retry d'agent sur les mêmes arguments ne facture qu'une fois. */
export function idempotencyKey(tool: string, input: unknown): string {
  const stable = JSON.stringify(input ?? {}, Object.keys((input as object) ?? {}).sort());
  // Fenêtre de 5 minutes : au-delà, un même appel est considéré comme un nouvel usage.
  const window = Math.floor(Date.now() / 300_000);
  return `${tool}:${window}:${stable}`;
}

type Authorized = { allowed: true; billedSource: string; costMicro: number; key: string };

/**
 * Juge unique de facturation : plafond journalier, quota de plan, puis wallet.
 * Aucun outil MCP ne doit facturer autrement que par cette fonction.
 */
export async function authorize(
  ctx: ToolContext,
  tool: string,
  input: unknown,
): Promise<Authorized | { allowed: false; result: ToolResult }> {
  if (!ctx.isAuthenticated()) {
    return { allowed: false, result: err("Non authentifié.") };
  }
  const key = idempotencyKey(tool, input);
  const supabase = supabaseForUser(ctx);
  const { data, error } = await supabase.rpc("mcp_authorize_call", {
    _user_id: ctx.getUserId()!,
    _tool_name: tool,
    _idempotency_key: key,
    _client_id: ctx.getClientId() ?? null,
    _metadata: {},
  });

  if (error) {
    return { allowed: false, result: err(`Facturation indisponible : ${error.message}`) };
  }
  const verdict = (data ?? {}) as Record<string, any>;
  if (!verdict.allowed) {
    switch (verdict.reason) {
      case "insufficient_balance":
        return {
          allowed: false,
          result: err(
            `Solde insuffisant (coût ${euros(Number(verdict.cost_micro ?? 0))}). Rechargez votre wallet sur /developers/profile?tab=facturation`,
          ),
        };
      case "daily_cap_reached":
        return {
          allowed: false,
          result: err(
            `Plafond journalier atteint (${euros(Number(verdict.daily_cap_micro ?? 0))} par jour). Réessayez demain ou demandez un relèvement.`,
          ),
        };
      case "plan_quota_exhausted":
        return { allowed: false, result: err("Quota du plan épuisé pour cet outil ce mois-ci.") };
      case "tool_disabled":
        return { allowed: false, result: err("Cet outil est temporairement désactivé.") };
      case "unknown_tool":
        return { allowed: false, result: err("Outil inconnu de la grille tarifaire.") };
      default:
        return { allowed: false, result: err(`Appel refusé : ${verdict.reason ?? "inconnu"}`) };
    }
  }
  return {
    allowed: true,
    billedSource: String(verdict.billed_source ?? "free"),
    costMicro: Number(verdict.cost_micro ?? 0),
    key,
  };
}

export function billingNote(billedSource: string, costMicro: number): string {
  if (billedSource === "plan") return "Inclus dans votre plan.";
  if (billedSource === "wallet") return `Débité du wallet : ${euros(costMicro)}.`;
  if (billedSource === "replayed") return "Appel déjà facturé (rejoué).";
  return "Gratuit.";
}
