import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { startJob } from "../jobs";

export default defineTool({
  name: "start_competitor_matrix",
  title: "Matrice de concurrence",
  description:
    "Compare votre domaine à 1 à 3 concurrents (SEO, GEO, écart SERP) et renvoie un job_id à interroger avec `get_job`.",
  inputSchema: {
    domain: z.string().min(3).describe("Votre domaine"),
    competitors: z.array(z.string().min(3)).min(1).max(3).describe("Domaines concurrents"),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
  handler: ({ domain, competitors }, ctx) =>
    startJob(ctx, "start_competitor_matrix", "competitors", { domain, competitors }),
});
