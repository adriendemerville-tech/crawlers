import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { startJob } from "../jobs";

export default defineTool({
  name: "start_geo_audit",
  title: "Audit GEO",
  description:
    "Lance le calcul du score GEO d'une page (lisibilité par les moteurs génératifs, passages citables, réponses directes) et renvoie un job_id.",
  inputSchema: {
    url: z.string().url().describe("URL complète de la page à évaluer"),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
  handler: ({ url }, ctx) => startJob(ctx, "start_geo_audit", "geo_score", { url }),
});
