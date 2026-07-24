import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

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
  name: "get_site_audit",
  title: "Dernier audit d'un site",
  description: "Renvoie le dernier audit SEO/GEO d'un site suivi par l'utilisateur, à partir de son domaine.",
  inputSchema: {
    domain: z.string().min(3).describe("Nom de domaine du site (ex: crawlers.fr)"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ domain }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Non authentifié" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const normalized = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
    const { data: site, error: siteErr } = await supabase
      .from("tracked_sites")
      .select("id, domain, brand_name, eeat_score, last_audit_at")
      .ilike("domain", `%${normalized}%`)
      .maybeSingle();
    if (siteErr || !site) {
      return { content: [{ type: "text", text: `Aucun site trouvé pour "${domain}".` }], isError: true };
    }
    const { data: audit } = await supabase
      .from("audits")
      .select("id, created_at, score, geo_score, results")
      .eq("tracked_site_id", site.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const payload = { site, latest_audit: audit ?? null };
    return {
      content: [
        {
          type: "text",
          text: audit
            ? `Site ${site.domain} · SEO ${(audit as any).score ?? "—"} · GEO ${(audit as any).geo_score ?? "—"} · audit du ${audit.created_at}.`
            : `Site ${site.domain} suivi mais aucun audit disponible.`,
        },
      ],
      structuredContent: payload,
    };
  },
});
