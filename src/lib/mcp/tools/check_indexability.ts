import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { startJob } from "../jobs";

export default defineTool({
  name: "check_indexability",
  title: "Indexabilité d'une page",
  description:
    "Vérifie l'accès des robots à une page (robots, canonique, rendu, coquille JavaScript) et renvoie un job_id à interroger avec `get_job`.",
  inputSchema: {
    url: z.string().url().describe("URL complète de la page"),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
  handler: ({ url }, ctx) => startJob(ctx, "check_indexability", "machine_layer", { url }),
});
