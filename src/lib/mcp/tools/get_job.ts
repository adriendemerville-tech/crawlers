import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { crawlersApi } from "../supabase";
import { err, ok } from "../billing";

export default defineTool({
  name: "get_job",
  title: "Statut d'un job",
  description:
    "Récupère l'état et le résultat d'un job Crawlers lancé par un outil `start_*` ou `audit_page`. Gratuit, à appeler en boucle jusqu'à `completed`.",
  inputSchema: {
    job_id: z.string().uuid().describe("Identifiant du job renvoyé au lancement"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ job_id }, ctx) => {
    if (!ctx.isAuthenticated()) return err("Non authentifié.");
    const { status, body } = await crawlersApi(ctx, `/v1/jobs/${job_id}`);
    if (status !== 200) return err(`Job introuvable ou inaccessible (${status}).`);
    return ok(
      `Job ${body.id} · ${body.feature} · ${body.status}` +
        (body.error ? ` · erreur : ${body.error?.message ?? "inconnue"}` : ""),
      body,
    );
  },
});
