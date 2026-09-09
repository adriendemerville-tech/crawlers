import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { startJob } from "../jobs";

export default defineTool({
  name: "audit_page",
  title: "Audit d'une page",
  description:
    "Lance l'audit expert d'une page (technique, sémantique, E-E-A-T) et renvoie un job_id à interroger avec `get_job`. Inclus dans le plan jusqu'au quota mensuel, puis facturé au wallet.",
  inputSchema: {
    url: z.string().url().describe("URL complète de la page à auditer"),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
  handler: ({ url }, ctx) => startJob(ctx, "audit_page", "audit_expert", { url }),
});
