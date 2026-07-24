import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listMySitesTool from "./tools/list_my_sites";
import getSiteAuditTool from "./tools/get_site_audit";

// Direct Supabase issuer — required for OAuth discovery to match RFC 8414 §3.3.
// Build from VITE_SUPABASE_PROJECT_ID (inlined by Vite at build time).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "crawlers-mcp",
  title: "Crawlers — Agent Intégrations",
  version: "0.1.0",
  instructions:
    "Serveur MCP officiel de Crawlers.fr. Utilise `whoami` pour vérifier la connexion, `list_my_sites` pour lister les sites suivis de l'utilisateur, et `get_site_audit` pour récupérer le dernier audit SEO/GEO d'un site donné.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listMySitesTool, getSiteAuditTool],
});
