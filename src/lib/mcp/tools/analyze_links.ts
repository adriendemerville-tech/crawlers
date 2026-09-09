import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { startJob } from "../jobs";

export default defineTool({
  name: "analyze_links",
  title: "Analyse du maillage interne",
  description:
    "Analyse le maillage interne d'un domaine (profondeur, cocons, cannibalisation) et renvoie un job_id à interroger avec `get_job`.",
  inputSchema: {
    domain: z.string().min(3).describe("Domaine à analyser"),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
  handler: ({ domain }, ctx) => startJob(ctx, "analyze_links", "cocoon", { domain }),
});
