import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { startJob } from "../jobs";

export default defineTool({
  name: "start_site_crawl",
  title: "Crawl de site",
  description:
    "Lance un crawl du site (parcours en largeur, profondeur 3 maximum) et renvoie un job_id à interroger avec `get_job`. Opération longue.",
  inputSchema: {
    domain: z.string().min(3).describe("Domaine à crawler (ex: crawlers.fr)"),
    depth: z.number().int().min(1).max(3).optional().describe("Profondeur de crawl"),
    limit: z.number().int().min(1).max(500).optional().describe("Nombre maximum de pages"),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
  handler: ({ domain, depth, limit }, ctx) =>
    startJob(ctx, "start_site_crawl", "site_crawl", {
      domain,
      ...(depth ? { depth } : {}),
      ...(limit ? { limit } : {}),
    }),
});
