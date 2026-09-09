import type { ToolContext } from "@lovable.dev/mcp-js";
import { crawlersApi } from "./supabase";
import { err, ok, euros, idempotencyKey, type ToolResult } from "./billing";

/**
 * Lance une feature Crawlers via /v1/jobs au nom de l'utilisateur MCP.
 * La facturation est décidée côté API par le juge unique `mcp_authorize_call`
 * (plan inclus → débordement wallet), jamais ici.
 */
export async function startJob(
  ctx: ToolContext,
  tool: string,
  feature: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  if (!ctx.isAuthenticated()) return err("Non authentifié.");

  const { status, body } = await crawlersApi(ctx, "/v1/jobs", {
    method: "POST",
    body: { feature, input },
    tool,
    idempotencyKey: idempotencyKey(tool, { feature, ...input }),
  });

  if (status === 402) {
    return err(
      `Solde insuffisant. Rechargez votre wallet sur ${body?.topup_url ?? "/developers/profile?tab=facturation"}`,
    );
  }
  if (status === 403) {
    const reason = body?.error ?? "refusé";
    if (reason === "daily_cap_reached") return err("Plafond journalier de dépense MCP atteint.");
    if (reason === "plan_quota_exhausted") return err("Quota du plan épuisé pour cet outil ce mois-ci.");
    return err(`Appel refusé : ${reason}`);
  }
  if (status !== 202) {
    return err(`Échec du lancement (${status}) : ${body?.error ?? "erreur inconnue"}`);
  }

  const costMicro = Number(body?.cost_cents ?? 0) * 10;
  const note =
    body?.billed_source === "plan"
      ? "Inclus dans votre plan."
      : body?.billed_source === "free"
        ? "Gratuit."
        : `Débité du wallet : ${euros(costMicro)}.`;

  return ok(
    `Job ${body.id} lancé (${feature}). ${note} Appelez \`get_job\` avec ce job_id jusqu'au statut \`completed\`.`,
    { job_id: body.id, feature, status: body.status, billed_source: body.billed_source ?? null, cost_micro: costMicro },
  );
}
