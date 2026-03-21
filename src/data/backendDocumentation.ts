/**
 * ============================================================
 * DOCUMENTATION TECHNIQUE DU BACKEND
 * ============================================================
 * 
 * CE FICHIER CONTIENT TOUTE LA DOCUMENTATION STRUCTURÉE.
 * 
 * POUR METTRE À JOUR LA DOCUMENTATION :
 * 1. Modifiez le contenu Markdown dans les propriétés `content` ci-dessous.
 * 2. Ajoutez de nouvelles sections en ajoutant un objet au tableau `sections`.
 * 3. Les blocs de code utilisent la syntaxe Markdown standard :
 *    ```typescript
 *    // votre code ici
 *    ```
 * 4. Les tableaux utilisent la syntaxe Markdown standard :
 *    | Colonne 1 | Colonne 2 |
 *    |-----------|-----------|
 *    | Valeur    | Valeur    |
 * 
 * STRUCTURE : Chaque section a un `id`, `title`, `icon` (nom Lucide), et `content` (Markdown).
 * ============================================================
 */

export interface DocSection {
  id: string;
  title: string;
  icon: string; // Lucide icon name
  content: string;
}

export const backendDocSections: DocSection[] = [
  // ───────────────────────────────────────────────
  // SECTION 1 : ARCHITECTURE GLOBALE
  // ───────────────────────────────────────────────
  {
    id: 'architecture',
    title: 'Architecture Globale',
    icon: 'Network',
    content: `
# Architecture Globale

## Vue d'ensemble

Le projet est une plateforme SaaS d'audit SEO / GEO / LLM construite sur une architecture **serverless edge-first** avec agent SAV IA intégré :

\`\`\`
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (React/Vite)                   │
│  SPA avec lazy-loading, React Query, Supabase JS SDK    │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼────────────────────────────────┐
│              SUPABASE EDGE FUNCTIONS (Deno)             │
│  110+ fonctions serverless + 21 modules partagés        │
│  - Audit engines (SEO, GEO, LLM, PageSpeed)             │
│  - Crawl engine (Firecrawl + processing queue)           │
│  - AI pipelines (Gemini, GPT via Lovable AI)             │
│  - CMS bridges (WordPress, Drupal, Shopify, Wix)         │
│  - Google integrations (Ads, GSC, GA4, GTM)              │
│  - Stripe billing, Auth, Analytics                       │
└────────────────────────┬────────────────────────────────┘
                         │ PostgREST / SQL
┌────────────────────────▼────────────────────────────────┐
│              SUPABASE POSTGRESQL                        │
│  55+ tables avec RLS, fonctions PL/pgSQL, triggers    │
│  Schémas : public (app), auth (Supabase), storage       │
└─────────────────────────────────────────────────────────┘
\`\`\`

## Stack Technique

| Couche | Technologie | Rôle |
|--------|-------------|------|
| Frontend | React 18 + Vite + TypeScript | SPA avec SSR-like SEO (Helmet) |
| UI | Tailwind CSS + shadcn/ui + Framer Motion | Design system avec tokens sémantiques |
| State | React Query + Context API | Cache serveur + état global auth/crédits |
| Backend | Supabase Edge Functions (Deno) | 110+ fonctions serverless + 21 modules partagés |
| Database | PostgreSQL 15 (Supabase) | RLS, triggers, fonctions SQL |
| Auth | Supabase Auth | Email/password, magic links |
| Storage | Supabase Storage | Logos agence, PDFs, plugins |
| Payments | Stripe | Abonnements, crédits, webhooks |
| AI | Lovable AI (Gemini/GPT) | Audits stratégiques, génération de contenu |
| Crawling | Spider Cloud API + Firecrawl (fallback) | Map + scrape multi-pages |
| Anti-détection | StealthFetch (custom) | User-Agent rotation, headers, retries |
| SEO Data | DataForSEO API | SERP rankings, backlinks, indexed pages |
| Analytics | Google Analytics 4 + GSC | Trafic, Search Console |

## Flux de données principal

1. **L'utilisateur soumet une URL** → Le frontend appelle une Edge Function
2. **L'Edge Function** effectue le scraping (via StealthFetch/Firecrawl), l'analyse IA, et retourne les résultats
3. **Les résultats sont cachés** dans \`audit_cache\` (TTL configurable) et optionnellement sauvegardés dans \`saved_reports\`
4. **Le système de crédits** (\`use_credit\` RPC) débite l'utilisateur avant chaque opération payante
5. **Les webhooks Stripe** mettent à jour \`profiles.subscription_status\` et créditent les achats

## Patterns architecturaux

- **Cache-first** : Toutes les fonctions d'audit vérifient \`audit_cache\` avant d'exécuter (via \`_shared/auditCache.ts\`)
- **Fire-and-forget workers** : Le crawl multi-pages lance un job puis déclenche le worker de manière asynchrone
- **Token tracking** : Chaque appel API externe est tracké dans \`api_call_logs\` (via \`_shared/tokenTracker.ts\`)
- **SSRF protection** : Toutes les URLs utilisateur sont validées contre les IPs privées (via \`_shared/ssrf.ts\`)
- **Circuit breaker** : Protection contre les cascades de pannes API (via \`_shared/circuitBreaker.ts\`)
- **Fair use** : Rate limiting par utilisateur (via \`_shared/fairUse.ts\` + \`check_fair_use_v2\` RPC)
- **IP rate limiting** : Protection des endpoints publics (via \`_shared/ipRateLimiter.ts\`)
`,
  },

  // ───────────────────────────────────────────────
  // SECTION 2 : BASE DE DONNÉES
  // ───────────────────────────────────────────────
  {
    id: 'database',
    title: 'Base de Données',
    icon: 'Database',
    content: `
# Schéma de Base de Données

## Tables principales

### Utilisateurs & Auth

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| \`profiles\` | Profil utilisateur étendu | \`user_id\`, \`email\`, \`plan_type\`, \`credits_balance\`, \`subscription_status\`, champs marque blanche (agency_*), \`api_key\` |
| \`user_roles\` | Rôles applicatifs (RBAC) | \`user_id\`, \`role\` (enum: admin, moderator, user), \`expires_at\` |
| \`billing_info\` | Informations de facturation | \`user_id\`, \`stripe_customer_id\`, \`vat_number\`, adresse |
| \`credit_transactions\` | Historique des transactions | \`user_id\`, \`amount\`, \`transaction_type\`, \`stripe_session_id\` |
| \`user_activity_log\` | Journal d'activité utilisateur | \`user_id\`, \`last_gmb_action_at\`, \`last_strategic_audit_at\`, \`last_llm_depth_test_at\` |
| \`archived_users\` | Utilisateurs supprimés (archivage) | \`original_user_id\`, \`email\`, \`profile_snapshot\`, \`archive_reason\` |

### Audits & Rapports

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| \`audits\` | Audits payants (code correctif) | \`url\`, \`domain\`, \`dynamic_price\`, \`payment_status\`, \`generated_code\` |
| \`saved_reports\` | Rapports sauvegardés | \`user_id\`, \`url\`, \`report_type\` (enum), \`report_data\` (JSON), \`folder_id\` |
| \`report_folders\` | Organisation en dossiers | \`user_id\`, \`name\`, \`parent_id\`, \`position\` |
| \`audit_cache\` | Cache des résultats d'audit | \`cache_key\`, \`function_name\`, \`result_data\`, \`expires_at\` |
| \`audit_raw_data\` | Données brutes d'audit (pour Architecte) | \`user_id\`, \`url\`, \`domain\`, \`audit_type\`, \`raw_payload\`, \`source_functions\` |
| \`audit_recommendations_registry\` | Registre des recommandations | \`recommendation_id\`, \`title\`, \`priority\`, \`category\`, \`fix_type\`, \`is_resolved\` |
| \`action_plans\` | Plans d'action générés | \`user_id\`, \`url\`, \`audit_type\`, \`tasks\` (JSON), \`is_archived\` |
| \`audit_impact_snapshots\` | Snapshots d'impact T+30/60/90 | \`url\`, \`domain\`, \`audit_scores\`, \`gsc_baseline\`, \`gsc_t30\`...\`gsc_t90\` |

### Crawl Engine

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| \`site_crawls\` | Sessions de crawl | \`user_id\`, \`domain\`, \`status\`, \`total_pages\`, \`credits_used\` |
| \`crawl_jobs\` | Jobs de processing | \`crawl_id\`, \`urls_to_process\` (JSON), \`status\`, \`max_depth\`, \`url_filter\` |
| \`crawl_pages\` | Pages analysées | \`crawl_id\`, \`url\`, \`seo_score\`, \`http_status\`, \`title\`, \`meta_description\`, maillage, images, schema.org |
| \`crawl_index_history\` | Historique d'indexation hebdo | \`domain\`, \`indexed_count\`, \`noindex_count\`, \`sitemap_count\`, \`week_start_date\` |

### Tracking & Analytics

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| \`tracked_sites\` | Sites suivis (monitoring) | \`user_id\`, \`url\`, \`domain\`, \`check_frequency\`, \`market_sector\`, \`client_targets\`, \`jargon_distance\`, \`api_key\` |
| \`user_stats_history\` | Historique KPIs hebdomadaire | \`tracked_site_id\`, \`seo_score\`, \`geo_score\`, \`llm_citation_rate\`, \`raw_data\` (SERP, perf, LLM) |
| \`serp_snapshots\` | Snapshots SERP DataForSEO | \`tracked_site_id\`, \`total_keywords\`, \`avg_position\`, \`top_3/10/50\`, \`sample_keywords\` |
| \`backlink_snapshots\` | Snapshots backlinks hebdo | \`tracked_site_id\`, \`referring_domains\`, \`backlinks_total\`, \`domain_rank\` |
| \`ga4_history_log\` | Historique GA4 hebdomadaire | \`tracked_site_id\`, \`pageviews\`, \`sessions\`, \`bounce_rate\`, \`engagement_rate\` |
| \`analytics_events\` | Événements utilisateur | \`event_type\`, \`url\`, \`session_id\`, \`event_data\` (JSON) |
| \`analyzed_urls\` | Index des URLs analysées | \`url\`, \`domain\`, \`analysis_count\` |

### IA & Prédictions

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| \`predictions\` | Prédictions de trafic | \`audit_id\`, \`baseline_traffic\`, \`predicted_traffic\`, \`predicted_increase_pct\` |
| \`actual_results\` | Résultats réels (validation) | \`prediction_id\`, \`real_traffic_after_90_days\`, \`accuracy_gap\` |
| \`cto_agent_logs\` | Logs de l'Agent CTO | \`function_analyzed\`, \`decision\`, \`confidence_score\`, \`proposed_change\` |
| \`prompt_registry\` | Registre des prompts versionnés | \`function_name\`, \`prompt_text\`, \`version\`, \`is_champion\` |
| \`hallucination_corrections\` | Corrections d'hallucinations | \`url\`, \`original_values\`, \`corrected_values\`, \`discrepancies\` |
| \`llm_depth_conversations\` | Conversations LLM Depth | \`domain\`, \`model\`, \`messages\`, \`expires_at\` |

### Cocoon (Architecture Sémantique)

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| \`semantic_nodes\` | Nœuds du graphe sémantique | \`tracked_site_id\`, \`url\`, \`keywords\`, \`cluster_id\`, \`page_type\`, \`intent\`, \`roi_predictive\` |
| \`cocoon_sessions\` | Sessions de cocon sauvegardées | \`tracked_site_id\`, \`nodes_snapshot\`, \`edges_snapshot\`, \`cluster_summary\` |
| \`cocoon_recommendations\` | Recommandations IA Cocoon | \`tracked_site_id\`, \`recommendation_text\`, \`summary\`, \`is_applied\` |
| \`cocoon_tasks\` | Tâches liées au cocon | \`tracked_site_id\`, \`title\`, \`priority\`, \`status\` |
| \`cocoon_chat_histories\` | Historique chat IA Cocoon | \`tracked_site_id\`, \`messages\`, \`session_hash\` |
| \`cocoon_errors\` | Erreurs détectées par Cocoon | \`domain\`, \`problem_description\`, \`ai_response\`, \`status\` |

### Google My Business (GMB)

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| \`gmb_locations\` | Liaison tracked_site ↔ fiche GMB | \`tracked_site_id\`, \`location_name\`, \`place_id\`, \`address\`, \`phone\`, \`hours\` (JSON) |
| \`gmb_reviews\` | Avis Google récupérés | \`gmb_location_id\`, \`google_review_id\`, \`star_rating\`, \`comment\`, \`reply_comment\`, \`is_flagged\` |
| \`gmb_posts\` | Publications GMB | \`gmb_location_id\`, \`post_type\` (STANDARD/EVENT/OFFER), \`summary\`, \`status\`, \`published_at\` |
| \`gmb_performance\` | Stats hebdomadaires | \`gmb_location_id\`, \`week_start_date\`, \`search_views\`, \`maps_views\`, \`website_clicks\`, \`phone_calls\`, \`avg_rating\` |

### CMS & Intégrations

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| \`cms_connections\` | Connexions CMS (WP, Drupal, Shopify, Webflow, Wix) | \`tracked_site_id\`, \`platform\`, \`auth_method\`, \`status\`, \`capabilities\` |
| \`google_ads_connections\` | Connexions Google Ads OAuth | \`user_id\`, \`tracked_site_id\`, \`customer_id\`, \`access_token\`, \`refresh_token\` |
| \`tool_api_keys\` | Clés API outils tiers (GTmetrix, Rank Math, Link Whisper) | \`user_id\`, \`tool_name\`, \`api_key\`, \`tracked_site_id\` |
| \`site_script_rules\` | Règles d'injection de scripts | \`domain_id\`, \`url_pattern\`, \`payload_type\`, \`payload_data\`, \`version\` |
| \`site_script_rules_history\` | Historique de versionnement | \`rule_id\`, \`version\`, \`payload_data\` |

### Bundle (Marketplace APIs)

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| \`bundle_api_catalog\` | Catalogue des APIs disponibles | \`api_name\`, \`api_url\`, \`seo_segment\`, \`crawlers_feature\`, \`is_active\`, \`display_order\` |
| \`bundle_subscriptions\` | Abonnements utilisateurs | \`user_id\`, \`selected_apis\`, \`api_count\`, \`monthly_price_cents\`, \`status\`, \`display_order\` |

### Agence (Marque Blanche)

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| \`agency_clients\` | Clients de l'agence | \`owner_user_id\`, \`first_name\`, \`last_name\`, \`company\` |
| \`agency_client_sites\` | Association client ↔ site | \`client_id\`, \`tracked_site_id\` |
| \`agency_team_members\` | Membres de l'équipe | \`owner_user_id\`, \`member_user_id\`, \`role\` |
| \`agency_invitations\` | Invitations d'équipe | \`token\`, \`email\`, \`role\`, \`status\`, \`expires_at\` |

### E-commerce & Revenus

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| \`revenue_events\` | Événements de revenus e-commerce | \`tracked_site_id\`, \`amount\`, \`currency\`, \`transaction_date\`, \`source\` |
| \`affiliate_codes\` | Codes affiliés | \`code\`, \`discount_percent\`, \`max_activations\`, \`current_activations\` |

### Emails & Notifications

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| \`email_send_log\` | Journal d'envoi d'emails | \`recipient_email\`, \`template_name\`, \`status\`, \`message_id\` |
| \`email_send_state\` | Configuration de la file d'attente | \`batch_size\`, \`send_delay_ms\`, \`retry_after_until\` |
| \`email_unsubscribe_tokens\` | Tokens de désinscription | \`email\`, \`token\`, \`used_at\` |

## Fonctions SQL importantes

| Fonction | Type | Description |
|----------|------|-------------|
| \`use_credit(p_user_id, p_amount, p_description)\` | RPC | Débite les crédits de manière atomique |
| \`has_role(_user_id, _role)\` | SECURITY DEFINER | Vérifie un rôle sans récursion RLS |
| \`check_fair_use_v2(p_user_id, p_action, p_hourly, p_daily)\` | RPC | Rate limiting par action |
| \`check_rate_limit(p_user_id, p_action, p_max, p_window)\` | RPC | Rate limiting générique |
| \`atomic_credit_update(p_user_id, p_amount)\` | RPC | Mise à jour atomique des crédits |
| \`get_site_revenue(p_site_id, p_start, p_end)\` | RPC | Calcul du CA e-commerce |
| \`get_database_size()\` | RPC | Taille de la base de données |
| \`upsert_user_activity(p_user_id, p_field, p_timestamp)\` | RPC | MAJ journal d'activité |
| \`grant_welcome_credits()\` | Trigger | 25 crédits offerts aux 1000 premiers inscrits |
| \`protect_profile_fields()\` | Trigger | Empêche la modification client de \`credits_balance\`, \`plan_type\`, etc. |
| \`generate_referral_code()\` | Trigger | Génère un code de parrainage unique |

## Row-Level Security (RLS)

Toutes les tables utilisateur ont RLS activé. Patterns :
- **Isolation utilisateur** : \\\`auth.uid() = user_id\\\`
- **Admin bypass** : via \\\`has_role(auth.uid(), 'admin')\\\`
- **Données publiques** : \\\`patience_cards\\\`, \\\`market_trends\\\` (lecture publique)

## Système de rôles (RBAC)

| Rôle DB | Label UI | Droits |
|---------|----------|--------|
| \\\`admin\\\` | **Créateur** | Accès total : lecture, écriture, configuration, gestion des rôles |
| \\\`viewer\\\` | **Viewer** | Dashboard en lecture seule. Tous les onglets (sauf si docs masquées). Actions désactivées front + serveur |
| \\\`viewer_level2\\\` | **Viewer L2** | Comme viewer mais **sans** Docs ni Algos ML |

### Sécurité des rôles

- Rôles stockés dans \\\`user_roles\\\` (table séparée, jamais sur \\\`profiles\\\`)
- Fonction \\\`has_role()\\\` (SECURITY DEFINER) empêche la récursion RLS
- Support d'expiration des rôles via \\\`expires_at\\\` + \\\`cleanup_expired_roles()\\\`
- Les edge functions vérifient \\\`has_role(uid, 'admin')\\\` côté serveur
- Le Créateur peut masquer la documentation pour tous les viewers via toggle
`,
  },

  // ───────────────────────────────────────────────
  // SECTION 3 : API / ENDPOINTS
  // ───────────────────────────────────────────────
  {
    id: 'api',
    title: 'API / Endpoints',
    icon: 'Plug',
    content: `
# API — Edge Functions (109 fonctions)

Toutes les fonctions sont accessibles via \`POST https://<project>.supabase.co/functions/v1/<nom>\`.

## Audit & Analyse

| Endpoint | Auth | Crédits | Description |
|----------|------|---------|-------------|
| \`validate-url\` | ❌ | 0 | Valide et normalise une URL |
| \`check-crawlers\` | ❌ | 0 | Analyse robots.txt et accessibilité bots |
| \`check-geo\` | ❌ | 0 | Audit GEO (Generative Engine Optimization) |
| \`check-llm\` | ❌ | 0 | Visibilité dans les LLMs (ChatGPT, Gemini…) |
| \`check-pagespeed\` | ❌ | 0 | Métriques Core Web Vitals via Google PSI |
| \`expert-audit\` | ✅ | 1 | Audit expert complet (score /200) |
| \`audit-expert-seo\` | ✅ | 2 | Audit SEO technique approfondi |
| \`audit-strategique-ia\` | ✅ | 3 | Audit stratégique IA (Gemini) |
| \`audit-compare\` | ✅ | 4 | Analyse concurrentielle face-à-face |
| \`audit-local-seo\` | ✅ | 1 | Audit SEO local |
| \`audit-matrice\` | ✅ | 2 | Audit matrice décisionnelle |
| \`diagnose-hallucination\` | ✅ | 1 | Diagnostic d'hallucination LLM |
| \`check-llm-depth\` | ✅ | 0 | Profondeur de visibilité LLM multi-itération |

## Crawl Engine

| Endpoint | Auth | Crédits | Description |
|----------|------|---------|-------------|
| \`crawl-site\` | ✅ | 5-30 | Lance un crawl multi-pages |
| \`process-crawl-queue\` | ✅ | 0 | Worker de traitement des jobs |
| \`scan-wp\` | ✅ | 1 | Scan WordPress (plugins, thème, sécu) |

## Génération & IA

| Endpoint | Auth | Crédits | Description |
|----------|------|---------|-------------|
| \`generate-corrective-code\` | ✅ | 2 | Génère le code correctif JS/PHP/Liquid |
| \`get-final-script\` | ✅ | 0 | Récupère le script final validé |
| \`generate-target-queries\` | ✅ | 1 | Génère des requêtes cibles LLM |
| \`generate-more-keywords\` | ✅ | 1 | Extension de mots-clés |
| \`generate-infotainment\` | ✅ | 0 | Contenu de patience (loading) |
| \`generate-blog-from-news\` | ✅ | 0 | Génération d'articles de blog |
| \`generate-prediction\` | ✅ | 0 | Prédiction de trafic |
| \`summarize-report\` | ✅ | 0 | Résumé IA d'un rapport |
| \`cocoon-chat\` | ✅ | 0 | Assistant IA Cocoon (Gemini 3 Flash, streaming SSE) |
| \`extract-pdf-data\` | ✅ | 0 | Extraction de données depuis PDF |
| \`parse-doc-matrix\` | ✅ | 0 | Parsing document matrice |
| \`voice-identity-enrichment\` | ✅ | 0 | Enrichissement carte d'identité par la voix |

## Calculs & Métriques

| Endpoint | Auth | Description |
|----------|------|-------------|
| \`calculate-cocoon-logic\` | ✅ | Calcul du graphe sémantique Cocoon |
| \`calculate-ias\` | ✅ | Indice d'Alignement Stratégique |
| \`calculate-internal-pagerank\` | ✅ | PageRank interne par page |
| \`calculate-llm-visibility\` | ✅ | Score de visibilité LLM |
| \`calculate-llm-volumes\` | ✅ | Volumes LLM estimés |
| \`calculate-sov\` | ✅ | Part de voix (Share of Voice) |
| \`measure-audit-impact\` | ✅ | Mesure d'impact post-audit |
| \`snapshot-audit-impact\` | ✅ | Snapshot T+30/60/90 |
| \`auto-measure-predictions\` | ✅ | Mesure automatique des prédictions |
| \`aggregate-observatory\` | ✅ | Agrégation observatoire sectoriel |

## Utilisateur & Billing

| Endpoint | Auth | Description |
|----------|------|-------------|
| \`ensure-profile\` | ✅ | Crée le profil si inexistant |
| \`auth-actions\` | ✅ | Actions d'authentification groupées |
| \`delete-account\` | ✅ | Suppression de compte (archivage) |
| \`restore-archived-user\` | ✅ | Restauration d'un compte archivé |
| \`create-checkout\` | ✅ | Session Stripe pour achat audit |
| \`create-credit-checkout\` | ✅ | Session Stripe pour achat crédits |
| \`create-subscription-session\` | ✅ | Session Stripe pour abonnement |
| \`create-customer-portal\` | ✅ | Portail client Stripe |
| \`stripe-webhook\` | ❌ | Webhook Stripe (signature vérifiée) |
| \`stripe-actions\` | ✅ | Actions Stripe groupées |
| \`track-payment\` | ✅ | Tracking paiements |
| \`apply-referral\` | ✅ | Applique un code de parrainage |
| \`apply-affiliate\` | ✅ | Applique un code affilié |
| \`apply-retention-offer\` | ✅ | Applique une offre de rétention |
| \`manage-team\` | ✅ | Gestion équipe agence |
| \`check-email-exists\` | ✅ | Vérifie l'existence d'un email |
| \`send-password-reset\` | ✅ | Envoie un lien de réinitialisation |
| \`send-verification-code\` | ✅ | Envoie un code de vérification email |
| \`verify-email-code\` | ✅ | Vérifie un code email |
| \`admin-update-plan\` | ✅ | MAJ plan utilisateur (admin) |
| \`kill-all-viewers\` | ✅ | Révoque tous les viewers (admin) |

## Intégrations Google

| Endpoint | Auth | Description |
|----------|------|-------------|
| \`gsc-auth\` | ✅ | OAuth Google Search Console |
| \`fetch-ga4-data\` | ✅ | Récupère données Google Analytics 4 |
| \`google-ads-connector\` | ✅ | OAuth2 Google Ads + récupération données campagnes |
| \`gtm-actions\` | ✅ | Déploiement automatique widget via Google Tag Manager |
| \`fetch-serp-kpis\` | ✅ | KPIs SERP via DataForSEO |
| \`refresh-serp-all\` | ✅ | CRON hebdo — rafraîchissement SERP de tous les sites |
| \`refresh-llm-visibility-all\` | ✅ | CRON rafraîchissement visibilité LLM |

## CMS & Bridges externes

| Endpoint | Auth | Description |
|----------|------|-------------|
| \`wpsync\` | ✅ | Synchronisation WordPress |
| \`drupal-actions\` | ✅ | Bridge CMS Drupal |
| \`iktracker-actions\` | ✅ | Bridge IKtracker (CRUD pages/articles) |
| \`register-cms-webhook\` | ✅ | Enregistrement webhooks CMS |
| \`webhook-shopify-orders\` | ❌ | Webhook Shopify (commandes) |
| \`webhook-woo-orders\` | ❌ | Webhook WooCommerce (commandes) |

## Outils tiers (Bundle APIs)

| Endpoint | Auth | Description |
|----------|------|-------------|
| \`gtmetrix-actions\` | ✅ | Audits de performance GTmetrix |
| \`rankmath-actions\` | ✅ | Gestion métadonnées SEO Rank Math (WordPress) |
| \`linkwhisper-actions\` | ✅ | Maillage interne Link Whisper (WordPress) |

## Partage & Export

| Endpoint | Auth | Description |
|----------|------|-------------|
| \`share-report\` | ✅ | Crée un lien de partage temporaire |
| \`share-actions\` | ✅ | Actions de partage groupées |
| \`resolve-share\` | ❌ | Résout un lien de partage |
| \`track-share-click\` | ❌ | Compteur de clics partage |
| \`save-audit\` | ✅ | Sauvegarde un audit |
| \`download-plugin\` | ✅ | Télécharge le plugin WordPress |

## Scripts & Déploiement

| Endpoint | Auth | Description |
|----------|------|-------------|
| \`serve-client-script\` | ❌ | Sert le script client (widget.js) |
| \`dry-run-script\` | ✅ | Test à blanc d'un script correctif |
| \`archive-solution\` | ✅ | Archive une solution/correctif |
| \`verify-injection\` | ✅ | Vérifie l'injection d'un script |
| \`process-script-queue\` | ✅ | Worker file d'attente scripts |
| \`watchdog-scripts\` | ✅ | Watchdog CRON des scripts déployés |

## GMB (Google My Business)

| Endpoint | Auth | Description |
|----------|------|-------------|
| \`gmb-actions\` | ✅ | CRUD fiches GMB, avis, posts, stats |

## Divers

| Endpoint | Auth | Description |
|----------|------|-------------|
| \`track-analytics\` | ❌ | Tracking événements analytics |
| \`fetch-news\` | ❌ | Récupère les actualités SEO |
| \`fetch-external-site\` | ✅ | Proxy HTML pour analyse |
| \`fetch-sitemap-tree\` | ✅ | Arborescence du sitemap XML |
| \`agent-cto\` | ✅ | Agent CTO autonome (auto-optimisation prompts) |
| \`agent-seo\` | ✅ | Agent SEO autonome |
| \`supervisor-actions\` | ✅ | Actions superviseur (orchestration agents) |
| \`persist-cocoon-session\` | ✅ | Sauvegarde session Cocoon |
| \`update-market-trends\` | ✅ | MAJ tendances marché |
| \`update-config\` | ✅ | MAJ configuration système |
| \`view-function-source\` | ✅ | Consultation source d'une edge function |
| \`run-backend-tests\` | ✅ | Exécute les tests backend |
| \`health-check\` | ❌ | Vérification santé du système |
| \`check-widget-health\` | ❌ | Vérification santé du widget |
| \`sdk-status\` | ❌ | Statut du SDK widget |
| \`widget-connect\` | ❌ | Connexion du widget externe |
| \`sitemap\` | ❌ | Génération sitemap XML |
| \`rss-feed\` | ❌ | Flux RSS du blog |
| \`verify-turnstile\` | ❌ | Vérification Cloudflare Turnstile |
| \`auth-email-hook\` | ❌ | Hook personnalisé emails auth |
| \`process-email-queue\` | ✅ | Worker file d'attente emails |
`,
  },

  // ───────────────────────────────────────────────
  // SECTION 4 : MOTEUR DE CRAWL
  // ───────────────────────────────────────────────
  {
    id: 'crawl-engine',
    title: 'Moteur de Crawl',
    icon: 'Bug',
    content: `
# Moteur de Crawl

## Architecture du crawl

Le crawl multi-pages fonctionne en **3 phases** :

\`\`\`
Phase 1: MAPPING         Phase 2: QUEUING          Phase 3: PROCESSING
┌─────────────────┐     ┌──────────────────┐     ┌───────────────────┐
│  crawl-site     │     │  crawl_jobs      │     │ process-crawl-    │
│  (Edge Fn)      │────→│  (table DB)      │────→│ queue (Worker)    │
│                 │     │                  │     │                   │
│ • Firecrawl /map│     │ • urls_to_process│     │ • Batch de 5 URLs │
│ • Filtre regex  │     │ • max_depth      │     │ • Firecrawl /scrape│
│ • Débit crédits │     │ • custom_selectors│    │ • Analyse SEO     │
└─────────────────┘     └──────────────────┘     └───────────────────┘
\`\`\`

## Flux détaillé

### 1. Lancement (\`crawl-site\`)

\`\`\`typescript
// Paramètres acceptés
{
  url: string,           // URL de départ (obligatoire)
  userId: string,        // ID utilisateur (obligatoire)
  maxPages: number,      // Max 500, défaut 50
  maxDepth: number,      // Profondeur de crawl, défaut 0 (illimité)
  urlFilter: string,     // Regex pour filtrer les URLs
  customSelectors: []    // Sélecteurs CSS pour extraction custom
}
\`\`\`

- Vérifie les crédits (\`use_credit\` RPC)
- Pro Agency / Admin = crawl illimité (0 crédits)
- Appelle Firecrawl \`/map\` pour découvrir les URLs
- Filtre par regex si \`urlFilter\` fourni
- Crée une entrée \`site_crawls\` + \`crawl_jobs\`
- Déclenche le worker en fire-and-forget

### 2. Tarification

| Pages max | Crédits |
|-----------|---------|
| ≤ 50      | 5       |
| ≤ 100     | 10      |
| ≤ 200     | 15      |
| ≤ 500     | 30      |
| Pro Agency / Admin | 0 (illimité) |

### 3. Worker (\`process-crawl-queue\`)

- Récupère le prochain job \`pending\` ou \`processing\`
- Traite les URLs par **batch de 5** (concurrence contrôlée)
- Pour chaque URL : scrape via Firecrawl → extraction SEO → insert \`crawl_pages\`
- Met à jour le compteur \`processed_count\` en temps réel
- Statut final : \`completed\` ou \`error\`

### 4. Données extraites par page (\`crawl_pages\`)

| Donnée | Type | Description |
|--------|------|-------------|
| \`title\` | string | Balise \`<title>\` |
| \`meta_description\` | string | Meta description |
| \`h1\` | string | Premier H1 |
| \`h2_count\`, \`h3_count\`, \`h4_h6_count\` | number | Compteurs de headings |
| \`word_count\` | number | Nombre de mots |
| \`http_status\` | number | Code HTTP |
| \`internal_links\` | number | Liens internes |
| \`external_links\` | number | Liens externes |
| \`images_total\` | number | Total images |
| \`images_without_alt\` | number | Images sans alt |
| \`has_canonical\`, \`has_schema_org\`, \`has_og\`, \`has_hreflang\`, \`has_noindex\`, \`has_nofollow\` | boolean | Présence de balises |
| \`broken_links\` | JSON | Liste des liens cassés |
| \`seo_score\` | number | Score SEO calculé |
| \`response_time_ms\` | number | Temps de réponse |
| \`schema_org_types\` | JSON | Types schema.org détectés |
| \`schema_org_errors\` | JSON | Erreurs dans les schémas |
| \`anchor_texts\` | JSON | Textes d'ancrage |
| \`crawl_depth\` | number | Profondeur de crawl |
| \`html_size_bytes\` | number | Taille HTML |
| \`content_hash\` | string | Hash du contenu (détection duplicata) |

## Anti-détection (\`stealthFetch\`)

Le module \`_shared/stealthFetch.ts\` est utilisé par toutes les fonctions de scraping :

- **17+ User-Agents** réels (Chrome, Firefox, Safari, mobile)
- **Rotation des headers** : \`Sec-CH-UA\`, \`Accept-Language\`, \`Referer\`
- **Retries exponentiels** avec jitter aléatoire
- **Respect du Retry-After** pour les 429
- **Spoofing Referer** : simule un clic depuis Google/Bing

## Gestion des erreurs

| Erreur | Comportement |
|--------|-------------|
| 403 Forbidden | Retry avec nouveau User-Agent |
| 429 Rate Limit | Attente Retry-After + backoff |
| 500+ Server Error | Max 3 retries |
| Timeout | Skip la page, log l'erreur |
| Regex invalide | Rejet immédiat (400) |
| Crédits insuffisants | Rejet immédiat (402) |
`,
  },

  // ───────────────────────────────────────────────
  // SECTION 5 : VARIABLES D'ENVIRONNEMENT
  // ───────────────────────────────────────────────
  {
    id: 'env-vars',
    title: "Variables d'Environnement",
    icon: 'Key',
    content: `
# Variables d'Environnement

## Variables automatiques (Supabase)

Ces variables sont injectées automatiquement dans chaque Edge Function :

| Variable | Description |
|----------|-------------|
| \`SUPABASE_URL\` | URL du projet Supabase |
| \`SUPABASE_ANON_KEY\` | Clé publique (anon) |
| \`SUPABASE_SERVICE_ROLE_KEY\` | Clé service (admin, côté serveur uniquement) |

## Variables Frontend (\`.env\`)

| Variable | Description |
|----------|-------------|
| \`VITE_SUPABASE_URL\` | URL publique Supabase |
| \`VITE_SUPABASE_PUBLISHABLE_KEY\` | Clé anon publique |
| \`VITE_SUPABASE_PROJECT_ID\` | ID du projet |

## Secrets Backend (Edge Functions)

Ces secrets sont configurés dans Lovable Cloud :

| Secret | Utilisé par | Description |
|--------|-------------|-------------|
| \`STRIPE_SECRET_KEY\` | billing, webhooks | Clé secrète Stripe |
| \`STRIPE_WEBHOOK_SECRET\` | \`stripe-webhook\` | Secret de signature webhook |
| \`FIRECRAWL_API_KEY\` | crawl engine | Clé API Firecrawl (scraping) |
| \`GOOGLE_PAGESPEED_API_KEY\` | \`check-pagespeed\` | Clé API Google PageSpeed Insights |
| \`GOOGLE_GSC_CLIENT_ID\` | \`gsc-auth\` | OAuth Google Search Console |
| \`GOOGLE_GSC_CLIENT_SECRET\` | \`gsc-auth\` | OAuth Google Search Console |
| \`TURNSTILE_SECRET_KEY\` | \`verify-turnstile\` | Secret Cloudflare Turnstile |
| \`DATAFORSEO_LOGIN\` | SERP, backlinks | Login DataForSEO |
| \`DATAFORSEO_PASSWORD\` | SERP, backlinks | Password DataForSEO |
| \`OPENROUTER_API_KEY\` | fallback IA | Clé OpenRouter (backup) |
| \`LOVABLE_API_KEY\` | Lovable AI | Accès aux modèles Gemini/GPT |
| \`IKTRACKER_API_KEY\` | \`iktracker-actions\` | Clé bridge IKtracker |
| \`FLY_RENDERER_URL\` | rendering SPA | URL du renderer Fly.io |
| \`FLY_RENDERER_SECRET\` | rendering SPA | Secret Fly.io |
| \`RENDERING_API_KEY\` | rendu headless | Clé API rendering |

## Sécurité

- ⚠️ **Ne jamais** stocker de secrets dans le code source
- Les \`VITE_*\` sont publiques (exposées au navigateur) — seules les clés anon/publishable
- Les secrets Edge Functions sont injectés par Deno Deploy, jamais dans le bundle client
- Le \`SUPABASE_SERVICE_ROLE_KEY\` bypass toutes les RLS — usage serveur uniquement
`,
  },

  // ───────────────────────────────────────────────
  // SECTION 6 : MODULES PARTAGÉS
  // ───────────────────────────────────────────────
  {
    id: 'shared-modules',
    title: 'Modules Partagés',
    icon: 'Package',
    content: `
# Modules Partagés (_shared/) — 21 modules

Le dossier \`supabase/functions/_shared/\` contient les utilitaires réutilisés par toutes les Edge Functions.

## Liste des modules

### \`cors.ts\`
Headers CORS standard pour les réponses Edge Functions.

### \`supabaseClient.ts\`
Factory pour créer le client Supabase côté serveur (service role).

### \`auth.ts\`
Utilitaires d'authentification : extraction JWT, vérification utilisateur.

### \`stealthFetch.ts\`
Wrapper anti-détection pour les requêtes HTTP sortantes (17+ User-Agents, headers réalistes, retries).

### \`renderPage.ts\`
Moteur de rendu SPA : Fly.io → Browserless → fetch direct (cascade de fallbacks).

### \`auditCache.ts\`
Cache des résultats d'audit (TTL configurable, invalidation automatique).

### \`tokenTracker.ts\`
Tracking des appels API externes payants dans \`api_call_logs\`.

### \`ssrf.ts\`
Protection SSRF : bloque IPs privées, localhost, protocoles non-HTTP.

### \`circuitBreaker.ts\`
Circuit breaker pour les API tierces : protège contre les cascades de pannes.

### \`fairUse.ts\`
Rate limiting par utilisateur et par action (via \`check_fair_use_v2\` RPC).

### \`ipRateLimiter.ts\`
Rate limiting par IP pour les endpoints publics.

### \`safeBodyParser.ts\`
Parsing sécurisé du body JSON avec validation et limites de taille.

### \`enrichSiteContext.ts\`
Enrichissement du contexte d'un site (secteur, cibles, mots-clés) pour les prompts IA.

### \`getSiteContext.ts\`
Récupération du contexte d'un site tracké depuis la base de données.

### \`fetchGA4.ts\`
Utilitaire de récupération des données Google Analytics 4.

### \`resolveGoogleToken.ts\`
Résolution et rafraîchissement des tokens OAuth Google (GSC, GA4, Ads).

### \`saveRawAuditData.ts\`
Persistance des données brutes d'audit dans \`audit_raw_data\`.

### \`silentErrorLogger.ts\`
Logger d'erreurs silencieux (insertion dans \`analytics_events\` sans bloquer le flux).

### \`trackUrl.ts\`
Upsert dans \`analyzed_urls\` (compteur d'analyses).

### \`translations.ts\`
Traductions pour le contenu généré côté serveur (emails, rapports).

### \`email-templates/\`
Templates HTML d'emails transactionnels (bienvenue, vérification, rapports).
`,
  },

  // ───────────────────────────────────────────────
  // SECTION : SERP KPIs (DataForSEO)
  // ───────────────────────────────────────────────
  {
    id: 'serp-kpis',
    title: 'SERP KPIs (DataForSEO)',
    icon: 'BarChart3',
    content: `
# SERP KPIs — DataForSEO

## Vue d'ensemble

Les données SERP permettent de mesurer le positionnement Google d'un domaine : position moyenne, mots-clés classés, ETV (trafic estimé), distribution Top 3/10/50.

## Source de données

| Paramètre | Valeur |
|-----------|--------|
| **API** | DataForSEO Labs — \`ranked_keywords/live\` |
| **Localisation** | France (code 2250) |
| **Langue** | Français (\`fr\`) |
| **Limite** | 1 000 mots-clés (triés par rang ascendant) |
| **Secrets** | \`DATAFORSEO_LOGIN\`, \`DATAFORSEO_PASSWORD\` |

## Affichage côté client (3 composants)

### 1. \`SerpKpiBanner\` — Bandeau KPIs
Affiche les métriques principales : position homepage, total mots-clés, ETV, pages indexées, avec barre de distribution Top 3/10/50.

### 2. \`KeywordCloud\` — Nuage de mots-clés
Badges interactifs en nuage. **Taille** proportionnelle à l'importance stratégique (volume × position). **Couleur** proportionnelle au ranking (vert = top 3, rouge = 50+). Tooltip avec position, volume et URL.

### 3. \`TopKeywordsList\` — Top 20 positionnés
Liste déroulante des 20 mots-clés sur lesquels l'URL rank le mieux. Affiche les 5 premiers avec bouton "voir les suivants". Badge couleur par position.

### 4. \`QuickWinsCard\` — Recommandations Quick Wins
Génère des recommandations automatiques basées sur les mots-clés proches de la page 1 (positions 8-25). Types : optimisation title, meta description, contenu, liens internes, structure Hn. Chaque recommendation peut être ajoutée au plan d'action (\`action_plans\`) en un clic, avec animation de paillettes.

## Stockage des données

Les données SERP sont stockées dans :
1. **\`user_stats_history.raw_data.serpData\`** — JSONB dans la colonne raw_data
2. **\`serp_snapshots\`** — Table dédiée pour l'historique et les fallbacks

## Déclencheurs de synchronisation

| Déclencheur | Mécanisme |
|-------------|-----------|
| **Après audit technique** | Fire-and-forget via \`syncSerpToTrackedSite()\` |
| **Après audit stratégique** | Idem |
| **Rafraîchissement manuel** | Bouton 🔄 dans le bandeau SERP |
| **CRON hebdomadaire** | \`refresh-serp-all\` tous les lundis à 05:00 (UTC+1) |
`,
  },

  // ───────────────────────────────────────────────
  // SECTION : COCOON — ARCHITECTURE SÉMANTIQUE
  // ───────────────────────────────────────────────
  {
    id: 'cocoon',
    title: 'Cocoon — Architecture Sémantique',
    icon: 'Network',
    content: `
# Cocoon — Architecture Sémantique Vivante

## Vue d'ensemble

Le module Cocoon transforme les données de crawl d'un site en une **visualisation organique** du maillage sémantique. Chaque page est un nœud pulsant, chaque lien une connexion neuronale. Réservé aux abonnés **Pro Agency** et aux admins.

**Internationalisation** : Module intégralement traduit en **FR / EN / ES** (page, panneaux, légende dynamique, prompts IA, gate d'accès).

## Table \\\`semantic_nodes\\\`

| Colonne | Type | Description |
|---------|------|-------------|
| \\\`id\\\` | uuid | Identifiant unique du nœud |
| \\\`tracked_site_id\\\` | uuid (FK) | Référence vers \\\`tracked_sites\\\` |
| \\\`url\\\` | text | URL de la page |
| \\\`title\\\` | text | Titre SEO |
| \\\`keywords\\\` | jsonb | Mots-clés extraits (top 10 TF) |
| \\\`cluster_id\\\` | text | Identifiant du cluster |
| \\\`page_type\\\` | text | Type : homepage, blog, produit, catégorie, faq, guide, etc. |
| \\\`intent\\\` | text | Intent : transactional, commercial, informational, navigational |
| \\\`iab_score\\\` | float | Score Anti-Wiki (0-100) |
| \\\`eeat_score\\\` | float | Score E-E-A-T |
| \\\`roi_predictive\\\` | float | ROI annualisé prédictif (€) |
| \\\`similarity_edges\\\` | jsonb | Top 10 nœuds les plus proches |

## Edge Function : \\\`calculate-cocoon-logic\\\`

### Algorithme (100% déterministe, aucun LLM)

1. Charge les pages du dernier crawl (limité à 100 pages)
2. Filtrage : exclut HTTP ≥ 400
3. Enrichissement depuis les données d'audit existantes
4. Extraction de mots-clés TF-based
5. Classification intent + type de page
6. Vectorisation TF-IDF + similarité cosinus
7. Clustering par composantes connexes (BFS sur edges ≥ 0.2)

## Frontend

- **Rendu Canvas D3.js** via \`CocoonForceGraph.tsx\`
- **CocoonNodePanel.tsx** : Panneau latéral détaillé — i18n FR/EN/ES
- **CocoonAIChat** : Chat Gemini 3 Flash avec streaming SSE
- **Mode X-Ray** : Toggle nœuds fantômes
- **Légende dynamique** : N'affiche que les types présents
- **Auto-refresh** : Détecte retour utilisateur après audit/crawl
`,
  },

  // ───────────────────────────────────────────────
  // SECTION : INTÉGRATIONS TIERCES
  // ───────────────────────────────────────────────
  {
    id: 'integrations',
    title: 'Intégrations Tierces',
    icon: 'Cable',
    content: `
# Intégrations Tierces

## Google Ads

| Élément | Détail |
|---------|--------|
| **Edge function** | \`google-ads-connector\` |
| **Table** | \`google_ads_connections\` (\`customer_id\`, \`access_token\`, \`refresh_token\`, \`tracked_site_id\`) |
| **OAuth2** | Scopes : \`https://www.googleapis.com/auth/adwords.readonly\` |
| **Données** | Campagnes, dépenses, impressions, clics, conversions |
| **Activation** | Carte dédiée dans Console → onglets API |

## Google Tag Manager (GTM)

| Élément | Détail |
|---------|--------|
| **Edge function** | \`gtm-actions\` |
| **Scopes** | \`tagmanager.edit.containers\`, \`tagmanager.publish\` |
| **Workflow** | Installation en 1-clic du widget.js via API GTM |
| **Sécurité** | Utilise la clé API spécifique au site (\`tracked_sites.api_key\`) |

## GTmetrix

| Élément | Détail |
|---------|--------|
| **Edge function** | \`gtmetrix-actions\` |
| **API** | REST v2.0 : \`https://gtmetrix.com/api/2.0/tests\` |
| **Auth** | API Key (Basic Auth) stockée dans \`tool_api_keys\` |
| **Données** | Lighthouse scores, Web Vitals (LCP, TBT, CLS), waterfall |

## Rank Math SEO (WordPress)

| Élément | Détail |
|---------|--------|
| **Edge function** | \`rankmath-actions\` |
| **Endpoints** | \`/rankmath/v1/getHead\`, \`/rankmath/v1/getKeywords\` |
| **Auth** | Application Password WordPress via \`tool_api_keys\` |
| **Données** | SEO score, focus keywords, rich snippets config |

## Link Whisper (WordPress)

| Élément | Détail |
|---------|--------|
| **Edge function** | \`linkwhisper-actions\` |
| **Endpoints** | \`/linkwhisper/v1/links\`, \`/linkwhisper/v1/suggestions\` |
| **Auth** | Application Password WordPress via \`tool_api_keys\` |
| **Données** | Internal links, suggestions auto-link, orphan pages |

## Bundle Option (Marketplace)

Le marketplace 'Bundle Option' dans la Console permet de s'abonner à des APIs tierces. Interface avec tri par Segment SEO, Fonction Crawlers et nom d'API. Tarification : 1€ × nombre d'APIs sélectionnées.

## CMS supportés

| CMS | Bridge | Fonctionnalités |
|-----|--------|-----------------|
| WordPress | \`wpsync\` + plugins | Sync bidirectionnelle, Rank Math, Link Whisper |
| Drupal | \`drupal-actions\` | CRUD contenu via JSON:API |
| Shopify | \`webhook-shopify-orders\` | Webhooks commandes, revenus |
| WooCommerce | \`webhook-woo-orders\` | Webhooks commandes, revenus |
| IKtracker | \`iktracker-actions\` | CRUD pages/articles via bridge dédié |
`,
  },

  // ───────────────────────────────────────────────
  // SECTION : INDICATEURS SEO / GEO / SERP / EEAT
  // ───────────────────────────────────────────────
  {
    id: 'indicators',
    title: 'Indicateurs SEO / GEO / SERP / EEAT',
    icon: 'Package',
    content: `
# Indicateurs SEO / GEO / SERP / EEAT

Référentiel de tous les indicateurs calculés par la plateforme, avec leur source et leur mode de construction.

---

## Indicateurs SEO (Audit Technique)

| Indicateur | Construction |
|------------|-------------|
| **Score SEO** | Moyenne pondérée de 6 sous-scores : performance mobile, structure HTML (Hn, meta), sécurité (HTTPS, Safe Browsing), accessibilité bots, densité contenu et maillage. |
| **Perf. Mobile / Desktop** | Score PageSpeed Insights mesurant LCP, FCP, CLS, TTFB et TBT. |
| **Ratio texte/HTML** | Pourcentage de contenu textuel vs code HTML total. |
| **Volume de contenu** | Nombre de mots de texte visible (seuil : 500 mots minimum). |
| **Profil de liens** | Comptage des liens internes et externes. |
| **Images sans alt** | Nombre d'images dont l'attribut 'alt' est absent ou vide. |
| **Détection SPA** | Compare le volume de texte entre HTML brut et rendu Browserless. |

---

## Indicateurs GEO (Generative Engine Optimization)

| Indicateur | Construction |
|------------|-------------|
| **Score GEO** | Score composite (0-100%) évaluant la compatibilité avec les moteurs génératifs. |
| **Bots IA autorisés** | Nombre de crawlers IA autorisés dans robots.txt (sur 6 vérifiés). |
| **JSON-LD / Schema.org** | Détection et validation des données structurées. |
| **Cohérence Title/H1** | Similarité textuelle (seuil : 30% minimum). |
| **llms.txt** | Présence du fichier standard pour guider les LLM. |
| **Citabilité LLM** | Probabilité de citation par un LLM. |
| **Content Gap** | Écart contenu existant vs attendu par les LLM. |

---

## Indicateurs SERP & Concurrence

| Indicateur | Construction |
|------------|-------------|
| **Position SERP** | Position organique via DataForSEO (Google FR). |
| **Volume de recherche** | Volume mensuel via DataForSEO. |
| **Keyword Difficulty (KD)** | Indice de difficulté (0-100). |
| **CPC** | Coût par clic moyen en EUR. |
| **Part de voix (SOV)** | Visibilité SERP calculée par \`calculate-sov\`. |
| **ROI Prédictif** | trafic_estimé × CPC × taux_conversion × 12. |

---

## Indicateurs E-E-A-T

| Indicateur | Construction |
|------------|-------------|
| **Score E-E-A-T** | Score global (0-10) évaluant Expérience, Expertise, Autorité, Fiabilité. |
| **Signaux sociaux** | Détection présence sur Facebook, LinkedIn, Twitter/X. |
| **Autorité sémantique** | Pertinence thématique des 50 meilleurs mots-clés via Gemini Flash Lite. |
| **Sentiment IA** | Perception de la marque par les LLM. |

---

## Indicateurs LLM (Benchmark)

| Indicateur | Construction |
|------------|-------------|
| **Visibilité IA** | Score (0-100) sur ChatGPT, Gemini et Perplexity. |
| **Taux de citation LLM** | Pourcentage de requêtes avec citation explicite. |
| **Volumes LLM estimés** | Trafic potentiel par LLM via \`market_trends\`. |
| **LLM Depth** | Test approfondi en 3 itérations conversationnelles. |

---

## Indicateurs IAS (Indice d'Alignement Stratégique)

| Indicateur | Construction |
|------------|-------------|
| **Score IAS** | Ratio trafic organique générique / total vs ratio cible du secteur. |
| **Risk Score** | Écart entre ratio réel et ratio cible. |
| **Brand Penetration Rate** | Part du trafic de marque dans le trafic organique (via GSC). |

---

## Indicateurs Cocoon

| Indicateur | Construction |
|------------|-------------|
| **Cannibalization Risk** | Détection par similarité TF-IDF entre nœuds. |
| **Internal Links In/Out** | Liens internes entrants/sortants par page. |
| **Page Authority** | PageRank interne via \`calculate-internal-pagerank\`. |

---

## Indicateurs GMB

| Indicateur | Construction |
|------------|-------------|
| **Search/Maps Views** | Vues dans les résultats Google et Maps. |
| **Website Clicks** | Clics vers le site depuis la fiche GMB. |
| **Direction Requests** | Demandes d'itinéraire. |
| **Phone Calls** | Appels téléphoniques. |
| **Avg Rating** | Note moyenne des avis (1-5). |

---

## Empreinte Lexicale (Lexical Footprint)

| Indicateur | Construction |
|------------|-------------|
| **Jargon Distance** | Distance sémantique relative entre contenu et 3 cibles (Primaire, Secondaire, Inexploitée). |
| **Score d'intentionnalité** | Hybride : 30% CTA + 30% SEO + 20% Ton + 20% Structure. |
| **Classification** | Spécialisation assumée (> 0.65), Positionnement ambigu (0.35-0.65), Distance non maîtrisée (< 0.35). |
`,
  },
];

/**
 * Métadonnées de la documentation.
 * Modifiez la version et la date à chaque mise à jour significative.
 */
export const docMetadata = {
  version: '3.0.0',
  lastUpdated: '2026-03-20',
  projectName: 'Crawlers — Plateforme Audit SEO/GEO/LLM + Architecte Génératif + Cocoon + GMB + Bundle + Intégrations',
  totalEdgeFunctions: 109,
  totalSharedModules: 21,
  totalTables: '55+',
  totalLinesOfCode: '157 000+',
  totalMigrations: 186,
  totalPages: 39,
  totalComponents: 275,
};
