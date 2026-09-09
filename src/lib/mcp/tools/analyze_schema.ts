import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { startJob } from "../jobs";

export default defineTool({
  name: "analyze_schema",
  title: "Analyse des données structurées",
  description:
    "Analyse la couche machine d'une page (JSON-LD, balisage, métadonnées lisibles par les agents) et renvoie un job_id à interroger avec `get_job`.",
  inputSchema: {
    url: z.string().url().describe("URL complète de la page"),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
  handler: ({ url }, ctx) => startJob(ctx, "analyze_schema", "machine_layer", { url }),
});
