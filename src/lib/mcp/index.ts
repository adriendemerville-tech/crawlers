import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listMySitesTool from "./tools/list_my_sites";
import getSiteAuditTool from "./tools/get_site_audit";
import getJobTool from "./tools/get_job";
import getWalletBalanceTool from "./tools/get_wallet_balance";
import listToolsPricingTool from "./tools/list_tools_pricing";
import auditPageTool from "./tools/audit_page";
import analyzeSchemaTool from "./tools/analyze_schema";
import checkIndexabilityTool from "./tools/check_indexability";
import analyzeLinksTool from "./tools/analyze_links";
import startSiteCrawlTool from "./tools/start_site_crawl";
import startGeoAuditTool from "./tools/start_geo_audit";
import startCompetitorMatrixTool from "./tools/start_competitor_matrix";
import serpRankingTool from "./tools/serp_ranking";

// Direct Supabase issuer — required for OAuth discovery to match RFC 8414 §3.3.
// Build from VITE_SUPABASE_PROJECT_ID (inlined by Vite at build time).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "crawlers-mcp",
  title: "Crawlers — Agent Intégrations",
  version: "0.2.0",
  instructions: [
    "Serveur MCP officiel de Crawlers.fr — moteur de vérification SEO/GEO appelable par un agent.",
    "Boucle recommandée : audit → problèmes → correction du code → nouvel audit.",
    "Outils gratuits : whoami, list_my_sites, get_site_audit, get_job, get_wallet_balance, list_tools_pricing.",
    "Les outils d'analyse lancent un job asynchrone : ils renvoient un job_id, puis get_job livre le résultat.",
    "Facturation hybride : selon l'outil, l'appel est inclus dans le plan de l'utilisateur, débité en micro-crédits du wallet en cas de dépassement, ou toujours payant (donnée tierce). list_tools_pricing donne la grille et get_wallet_balance le solde et le plafond journalier.",
  ].join(" "),
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    whoamiTool,
    listMySitesTool,
    getSiteAuditTool,
    getJobTool,
    getWalletBalanceTool,
    listToolsPricingTool,
    auditPageTool,
    analyzeSchemaTool,
    checkIndexabilityTool,
    analyzeLinksTool,
    startSiteCrawlTool,
    startGeoAuditTool,
    startCompetitorMatrixTool,
    serpRankingTool,
  ],
});
