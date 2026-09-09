import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";
import { err, ok, euros } from "../billing";

export default defineTool({
  name: "list_tools_pricing",
  title: "Grille tarifaire MCP",
  description:
    "Liste le coût de chaque outil MCP : gratuit, inclus dans le plan, débordement facturé au wallet, ou exclusivement payant.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return err("Non authentifié.");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("mcp_tool_pricing")
      .select("tool_name, class, cost_micro, min_plan, monthly_included, label, enabled")
      .eq("enabled", true)
      .order("cost_micro", { ascending: true });
    if (error) return err(`Erreur: ${error.message}`);

    const rows = data ?? [];
    const summary = rows
      .map((r: any) =>
        `- ${r.tool_name} · ${r.class} · ${r.cost_micro === 0 ? "gratuit" : euros(r.cost_micro)}` +
        (r.monthly_included ? ` · ${r.monthly_included}/mois inclus à partir de ${r.min_plan}` : ""),
      )
      .join("\n");

    return ok(summary || "Aucun outil facturé.", { tools: rows, unit: "micro-crédit = 0,001 €" });
  },
});
