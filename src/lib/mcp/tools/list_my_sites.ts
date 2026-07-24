import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "list_my_sites",
  title: "Lister mes sites",
  description: "Liste les sites Crawlers suivis par l'utilisateur connecté (domaine, dernier audit, score EEAT).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Non authentifié" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("tracked_sites")
      .select("id, domain, brand_name, market_sector, eeat_score, last_audit_at, business_model")
      .order("last_audit_at", { ascending: false, nullsFirst: false })
      .limit(50);
    if (error) {
      return { content: [{ type: "text", text: `Erreur: ${error.message}` }], isError: true };
    }
    const rows = data ?? [];
    const summary = rows.length
      ? rows.map((r: any) => `- ${r.domain} · EEAT ${r.eeat_score ?? "—"} · ${r.last_audit_at ?? "jamais audité"}`).join("\n")
      : "Aucun site suivi.";
    return {
      content: [{ type: "text", text: summary }],
      structuredContent: { sites: rows },
    };
  },
});
