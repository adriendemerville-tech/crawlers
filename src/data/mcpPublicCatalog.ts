/**
 * Inventaire public des outils MCP, calé sur le code.
 *
 * Serveur opérationnel : supabase/functions/mcp-server (reg() dans index.ts), version 1.2.0.
 * 27 outils : 3 sans clé, 12 Pro Agency, get_audit_job (authentifié, gratuit),
 * 4 Marina, 7 Search Console admin.
 * Serveur OAuth : supabase/functions/mcp, généré depuis src/lib/mcp (serp_ranking inclus).
 */

export const MCP_SERVER_ENDPOINT =
  'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/mcp-server';

export type McpServerAccess = 'free' | 'pro' | 'auth' | 'marina' | 'gsc';

export interface McpServerTool {
  name: string;
  access: McpServerAccess;
  /** Reformulation fidèle de la description passée à reg() dans mcp-server. */
  summaryFr: string;
  summaryEn: string;
}

export const MCP_SERVER_TOOLS: McpServerTool[] = [
  {
    name: 'check_geo_score',
    access: 'free',
    summaryFr: 'Score GEO de 0 à 100. Entrée : domain.',
    summaryEn: 'GEO score from 0 to 100. Input: domain.',
  },
  {
    name: 'check_llm_visibility',
    access: 'free',
    summaryFr: 'Visibilité du domaine sur ChatGPT, Gemini, Perplexity et Claude. Entrée : domain.',
    summaryEn: 'Domain visibility across ChatGPT, Gemini, Perplexity and Claude. Input: domain.',
  },
  {
    name: 'check_ai_crawlers',
    access: 'free',
    summaryFr: 'Analyse des bots IA GPTBot, ClaudeBot et Google-Extended. Entrée : domain.',
    summaryEn: 'AI bot analysis for GPTBot, ClaudeBot and Google-Extended. Input: domain.',
  },
  {
    name: 'expert_seo_audit',
    access: 'pro',
    summaryFr: 'Lance un audit SEO décrit comme 200 points et renvoie un job_id à suivre avec get_audit_job. sync: true force le mode bloquant. Réservé Pro Agency. Entrée : url, lang facultatif (fr, en, es).',
    summaryEn: 'Starts a 200-point SEO audit and returns a job_id to poll with get_audit_job. sync: true forces the blocking call. Pro Agency required. Input: url, optional lang (fr, en, es).',
  },
  {
    name: 'strategic_ai_audit',
    access: 'pro',
    summaryFr: 'Lance un audit stratégique IA (SEO, GEO et concurrence) et renvoie un job_id à suivre avec get_audit_job. sync: true force le mode bloquant. Réservé Pro Agency. Entrée : url, sector et lang facultatifs.',
    summaryEn: 'Starts a strategic AI audit (SEO, GEO and competitive) and returns a job_id to poll with get_audit_job. sync: true forces the blocking call. Pro Agency required. Input: url, optional sector and lang.',
  },
  {
    name: 'get_audit_job',
    access: 'auth',
    summaryFr: 'Statut et résultat d’un audit lancé par expert_seo_audit ou strategic_ai_audit, réservé au compte propriétaire. Authentification requise. Gratuit, hors quota DataForSEO. Entrée : job_id.',
    summaryEn: 'Status and result of an audit started by expert_seo_audit or strategic_ai_audit, limited to the owning account. Authentication required. Free, outside the DataForSEO quota. Input: job_id.',
  },
  {
    name: 'keyword_research',
    access: 'pro',
    summaryFr: 'Idées de mots-clés Google (volume et difficulté Labs de 0 à 100). France et fr par défaut, 5 graines maximum, 15 résultats par défaut et 25 au maximum. Pro Agency, lecture seule, 30 appels par heure.',
    summaryEn: 'Google keyword ideas (volume and Labs difficulty from 0 to 100). France and fr by default, up to 5 seeds, 15 results by default and 25 at most. Pro Agency, read-only, 30 calls per hour.',
  },
  {
    name: 'serp_ranking',
    access: 'pro',
    summaryFr: 'SERP Google organique d’un mot-clé, et position d’un domaine s’il est fourni. France et fr par défaut, profondeur 10 ou 20 (10 par défaut). Pro Agency, lecture seule, 30 appels par heure. Entrée : keyword.',
    summaryEn: 'Live Google organic SERP for a keyword, and a domain’s position when one is given. France and fr by default, depth 10 or 20 (default 10). Pro Agency, read-only, 30 calls per hour. Input: keyword.',
  },
  {
    name: 'backlink_snapshot',
    access: 'pro',
    summaryFr: 'Résumé des backlinks, domaines référents et ancres d’un domaine. 10 lignes par défaut, 20 au maximum pour les référents et pour les ancres. Pro Agency, lecture seule, 30 appels par heure. Entrée : domain.',
    summaryEn: 'Summary of a domain’s backlinks, referring domains and anchors. 10 rows by default, 20 at most for referrers and for anchors. Pro Agency, read-only, 30 calls per hour. Input: domain.',
  },
  {
    name: 'generate_corrective_code',
    access: 'pro',
    summaryFr: 'Génère du JavaScript correctif SEO/GEO. Réservé Pro Agency. Entrée : url, audit_id facultatif.',
    summaryEn: 'Generates JavaScript corrective code for SEO/GEO fixes. Pro Agency required. Input: url, optional audit_id.',
  },
  {
    name: 'dry_run_script',
    access: 'pro',
    summaryFr: 'Teste en sandbox un script correctif (identifiant site_script_rules) sur la page : erreurs JS, CLS, validité JSON-LD. Réservé Pro Agency. Entrée : script_id, target_url facultative.',
    summaryEn: 'Sandbox-tests a corrective script (site_script_rules id) on the live page: JS errors, CLS, JSON-LD validity. Pro Agency required. Input: script_id, optional target_url.',
  },
  {
    name: 'calculate_cocoon_logic',
    access: 'pro',
    summaryFr: 'Cocon sémantique par TF-IDF. Réservé Pro Agency et exige un JWT de session (pas seulement une clé Marina). Entrée : domain et tracked_site_id.',
    summaryEn: 'Semantic cocoon via TF-IDF. Pro Agency required, and a session JWT (a Marina key is not enough). Input: domain and tracked_site_id.',
  },
  {
    name: 'measure_audit_impact',
    access: 'pro',
    summaryFr: 'Impact à T+30, T+60 et T+90 via Search Console et GA4. Réservé Pro Agency et exige un JWT de session. Entrée : domain, audit_id facultatif.',
    summaryEn: 'Impact at T+30, T+60 and T+90 via Search Console and GA4. Pro Agency required, and a session JWT. Input: domain, optional audit_id.',
  },
  {
    name: 'wordpress_sync',
    access: 'pro',
    summaryFr: 'Injecte des correctifs dans WordPress via le pont CMS. Réservé Pro Agency et exige un JWT de session. Entrée : tracked_site_id et script_id.',
    summaryEn: 'Injects fixes into WordPress via the CMS bridge. Pro Agency required, and a session JWT. Input: tracked_site_id and script_id.',
  },
  {
    name: 'fetch_serp_kpis',
    access: 'pro',
    summaryFr: 'KPI SERP hebdomadaires : positions, trafic, visibilité. Réservé Pro Agency. Entrée : domain, tracked_site_id facultatif.',
    summaryEn: 'Weekly SERP KPIs: rankings, traffic, visibility. Pro Agency required. Input: domain, optional tracked_site_id.',
  },
  {
    name: 'calculate_ias',
    access: 'pro',
    summaryFr: "Indice d'alignement stratégique (IAS). Réservé Pro Agency. Entrée : domain ; tracked_site_id est requis avec une clé Marina.",
    summaryEn: 'Strategic Alignment Index (IAS). Pro Agency required. Input: domain; tracked_site_id is required when calling with a Marina key.',
  },
  {
    name: 'marina_create_report',
    access: 'marina',
    summaryFr: 'Lance un rapport Marina SEO et GEO (décrit comme 40 pages et plus). Clé Marina ou JWT. 5 crédits, ou inclus avec Pro Agency actif. Renvoie un job_id à suivre avec marina_get_report.',
    summaryEn: 'Launches a Marina SEO and GEO report (described as 40+ pages). Marina key or JWT. 5 credits, or included with active Pro Agency. Returns a job_id to poll with marina_get_report.',
  },
  {
    name: 'marina_get_report',
    access: 'marina',
    summaryFr: "Statut et résultat d'un job Marina appartenant à l'appelant. Gratuit.",
    summaryEn: 'Status and result of a Marina job owned by the caller. Free.',
  },
  {
    name: 'marina_list_jobs',
    access: 'marina',
    summaryFr: "Liste les jobs Marina de l'appelant, du plus récent au plus ancien. Gratuit.",
    summaryEn: "Lists the caller's Marina jobs, most recent first. Free.",
  },
  {
    name: 'marina_export_pdf',
    access: 'marina',
    summaryFr: 'Exporte un rapport Marina terminé en PDF (URL signée valable 7 jours). Gratuit.',
    summaryEn: 'Exports a completed Marina report as PDF (signed URL valid 7 days). Free.',
  },
  {
    name: 'gsc_list_sites',
    access: 'gsc',
    summaryFr: 'Liste les propriétés Search Console autorisées du compte Google connecté. Admin uniquement. Lecture seule.',
    summaryEn: 'Lists the allowed Search Console properties of the connected Google account. Admin only. Read-only.',
  },
  {
    name: 'gsc_search_analytics',
    access: 'gsc',
    summaryFr: "Clics, impressions, CTR et position d'une propriété autorisée. Admin uniquement. Lecture seule.",
    summaryEn: 'Clicks, impressions, CTR and position for an allowed property. Admin only. Read-only.',
  },
  {
    name: 'gsc_top_queries',
    access: 'gsc',
    summaryFr: 'Top requêtes par clics sur 7, 28 ou 90 jours, avec delta. Admin uniquement. Lecture seule.',
    summaryEn: 'Top queries by clicks over 7, 28 or 90 days, with a delta. Admin only. Read-only.',
  },
  {
    name: 'gsc_top_pages',
    access: 'gsc',
    summaryFr: 'Top pages par clics sur 7, 28 ou 90 jours, avec delta. Admin uniquement. Lecture seule.',
    summaryEn: 'Top pages by clicks over 7, 28 or 90 days, with a delta. Admin only. Read-only.',
  },
  {
    name: 'gsc_position_history',
    access: 'gsc',
    summaryFr: 'Séries quotidiennes de positions lues en base, sans appel Google. Admin uniquement. Lecture seule.',
    summaryEn: 'Daily position series read from the database, with no Google call. Admin only. Read-only.',
  },
  {
    name: 'gsc_url_inspection',
    access: 'gsc',
    summaryFr: "Inspection d'URLs (5 maximum par appel) : verdict, indexation, canoniques, résultats enrichis. Admin uniquement. Lecture seule.",
    summaryEn: 'URL inspection (5 URLs max per call): verdict, indexing, canonicals, rich results. Admin only. Read-only.',
  },
  {
    name: 'gsc_list_sitemaps',
    access: 'gsc',
    summaryFr: "Sitemaps soumis d'une propriété autorisée. Admin uniquement. Lecture seule.",
    summaryEn: 'Submitted sitemaps of an allowed property. Admin only. Read-only.',
  },
];

export const MCP_SERVER_ACCESS_FR: Record<McpServerAccess, string> = {
  free: 'Sans clé',
  pro: 'Pro Agency',
  auth: 'Clé ou JWT, gratuit',
  marina: 'Clé Marina ou JWT',
  gsc: 'Admin, lecture seule',
};

export const MCP_SERVER_ACCESS_EN: Record<McpServerAccess, string> = {
  free: 'No key',
  pro: 'Pro Agency',
  auth: 'Key or JWT, free',
  marina: 'Marina key or JWT',
  gsc: 'Admin, read-only',
};

/** Outils du serveur OAuth `mcp` (src/lib/mcp), y compris serp_ranking. */
export const MCP_OAUTH_TOOLS: { name: string; summaryFr: string; summaryEn: string }[] = [
  {
    name: 'whoami',
    summaryFr: "Identité de l'utilisateur connecté (id, email, client OAuth).",
    summaryEn: 'Identity of the connected user (id, email, OAuth client).',
  },
  {
    name: 'list_my_sites',
    summaryFr: "Sites suivis par l'utilisateur (domaine, dernier audit, score EEAT).",
    summaryEn: "Sites followed by the user (domain, latest audit, EEAT score).",
  },
  {
    name: 'get_site_audit',
    summaryFr: "Dernier audit SEO/GEO d'un site suivi, à partir du domaine.",
    summaryEn: 'Latest SEO/GEO audit of a followed site, from its domain.',
  },
  {
    name: 'get_job',
    summaryFr: "État et résultat d'un job lancé par un outil start_* ou audit_page. Gratuit.",
    summaryEn: 'Status and result of a job started by a start_* tool or audit_page. Free.',
  },
  {
    name: 'get_wallet_balance',
    summaryFr: 'Solde du wallet développeur, consommation MCP du jour et plafond journalier.',
    summaryEn: "Developer wallet balance, today's MCP usage and the daily cap.",
  },
  {
    name: 'list_tools_pricing',
    summaryFr: 'Coût de chaque outil de ce serveur : gratuit, inclus, débordement wallet, ou toujours payant.',
    summaryEn: 'Cost of each tool on this server: free, included, wallet overflow, or always paid.',
  },
  {
    name: 'audit_page',
    summaryFr: "Lance l'audit expert d'une page et renvoie un job_id.",
    summaryEn: 'Starts an expert audit of one page and returns a job_id.',
  },
  {
    name: 'analyze_schema',
    summaryFr: "Analyse la couche machine d'une page (JSON-LD, balisage, métadonnées) et renvoie un job_id.",
    summaryEn: 'Analyses the machine layer of a page (JSON-LD, markup, metadata) and returns a job_id.',
  },
  {
    name: 'check_indexability',
    summaryFr: "Vérifie l'accès des robots à une page (robots, canonique, rendu, coquille JavaScript) et renvoie un job_id.",
    summaryEn: 'Checks robot access to a page (robots, canonical, render, JavaScript shell) and returns a job_id.',
  },
  {
    name: 'analyze_links',
    summaryFr: "Analyse le maillage interne d'un domaine (profondeur, cocons, cannibalisation) et renvoie un job_id.",
    summaryEn: 'Analyses internal linking of a domain (depth, cocoons, cannibalisation) and returns a job_id.',
  },
  {
    name: 'start_site_crawl',
    summaryFr: 'Lance un crawl (parcours en largeur, profondeur 3 maximum) et renvoie un job_id.',
    summaryEn: 'Starts a crawl (breadth-first, depth 3 maximum) and returns a job_id.',
  },
  {
    name: 'start_geo_audit',
    summaryFr: "Lance le score GEO d'une page (lisibilité, passages citables, réponses directes) et renvoie un job_id.",
    summaryEn: 'Starts the GEO score of a page (readability, citable passages, direct answers) and returns a job_id.',
  },
  {
    name: 'start_competitor_matrix',
    summaryFr: 'Compare le domaine à 1 à 3 concurrents et renvoie un job_id.',
    summaryEn: 'Compares the domain with 1 to 3 competitors and returns a job_id.',
  },
  {
    name: 'serp_ranking',
    summaryFr: 'Relève les positions SERP d’un mot-clé auprès de plusieurs fournisseurs. Toujours facturé au wallet. Renvoie un job_id. Entrée : keyword, domain et location facultatifs.',
    summaryEn: 'Collects SERP positions for a keyword from several data providers. Always billed to the wallet. Returns a job_id. Input: keyword, optional domain and location.',
  },
];

export const MCP_SERVER_COUNT_FR =
  '27 outils enregistrés (mcp-server 1.2.0) : 3 sans clé, 12 Pro Agency, get_audit_job authentifié et gratuit, 4 Marina, 7 Search Console réservés aux administrateurs (lecture seule).';

export const MCP_SERVER_COUNT_EN =
  '27 registered tools (mcp-server 1.2.0): 3 with no key, 12 Pro Agency, get_audit_job authenticated and free, 4 Marina, 7 Search Console tools reserved for admins (read-only).';
