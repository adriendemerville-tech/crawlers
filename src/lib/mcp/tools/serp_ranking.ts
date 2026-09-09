import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { startJob } from "../jobs";

export default defineTool({
  name: "serp_ranking",
  title: "Positions SERP",
  description:
    "Relève les positions SERP d'un mot-clé auprès de plusieurs fournisseurs de données. Toujours facturé au wallet (donnée tierce payante).",
  inputSchema: {
    keyword: z.string().min(2).describe("Mot-clé à relever"),
    domain: z.string().min(3).optional().describe("Domaine à repérer dans les résultats"),
    location: z.string().optional().describe("Localisation (ex: France)"),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
  handler: ({ keyword, domain, location }, ctx) =>
    startJob(ctx, "serp_ranking", "serp_ranking", {
      keyword,
      ...(domain ? { domain } : {}),
      ...(location ? { location } : {}),
    }),
});
