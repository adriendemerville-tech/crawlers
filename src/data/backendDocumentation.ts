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

Le projet est une plateforme SaaS d'audit SEO / GEO / LLM construite sur une architecture **serverless edge-first** avec assistant Félix (SAV IA), Content Architecture Advisor (+ génération d'images IA multi-moteurs), générateur Scribe, Stratège Cocoon, diagnostics avancés, détection d'anomalies, autopilote Parménion (cycles complets), pipeline Marina (3 phases chaînées), Quiz SEO Félix, Benchmark SERP multi-providers (lead magnet), serveur MCP et API N8N :

\`\`\`
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (React/Vite)                   │
│  SPA avec lazy-loading, React Query, Supabase JS SDK    │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼────────────────────────────────┐
│              SUPABASE EDGE FUNCTIONS (Deno)             │
│  190+ fonctions serverless + 37 modules partagés        │
│  - Audit engines (SEO, GEO, LLM, PageSpeed)             │
│  - Crawl engine (Spider Cloud + Firecrawl fallback)      │
│  - AI pipelines (Gemini, GPT via Lovable AI)             │
│  - Image generation (Imagen 3, FLUX, Ideogram routing)   │
│  - Cocoon diagnostics (5 axes) + Stratège                │
│  - Content Architect + CMS publish + crédits             │
│  - CMS bridges (WordPress, Drupal, Shopify, Wix, Odoo)   │
│  - Google integrations (Ads, GSC, GA4, GTM, GMB)         │
│  - Anomaly detection + Drop Detector + notification      │
│  - Server log analysis (Matomo, GoAccess, Plausible)      │
│  - Quiz SEO Félix (hebdo, notifications, sync)           │
│  - Stripe billing, Auth, Analytics                       │
└────────────────────────┬────────────────────────────────┘
                         │ PostgREST / SQL
┌────────────────────────▼────────────────────────────────┐
│              SUPABASE POSTGRESQL                        │
│  149+ tables avec RLS, fonctions PL/pgSQL, triggers     │
│  Schémas : public (app), auth (Supabase), storage       │
└─────────────────────────────────────────────────────────┘
\`\`\`

## Stack Technique

| Couche | Technologie | Rôle |
|--------|-------------|------|
| Frontend | React 18 + Vite + TypeScript | SPA avec SSR-like SEO (Helmet) |
| UI | Tailwind CSS + shadcn/ui + Framer Motion | Design system avec tokens sémantiques |
| State | React Query + Context API | Cache serveur + état global auth/crédits |
| Backend | Supabase Edge Functions (Deno) | 190+ fonctions serverless + 37 modules partagés |
| Database | PostgreSQL 15 (Supabase) | RLS, triggers, fonctions SQL |
| Auth | Supabase Auth | Email/password, magic links |
| Storage | Supabase Storage | Logos agence, PDFs, plugins |
| Payments | Stripe | Abonnements, crédits, webhooks |
| AI | Lovable AI (Gemini/GPT) | Audits stratégiques, génération de contenu, Stratège |
| Crawling | Spider Cloud API + Firecrawl (fallback) | Map + scrape multi-pages |
| Anti-détection | StealthFetch (custom) | User-Agent rotation, headers, retries |
| SEO Data | DataForSEO API | SERP rankings, backlinks, indexed pages |
| Analytics | Google Analytics 4 + GSC + GMB + Ads | Trafic, Search Console, fiches, campagnes |

## Flux de données principal

1. **L'utilisateur soumet une URL** → Le frontend appelle une Edge Function
2. **L'Edge Function** effectue le scraping (via StealthFetch/Firecrawl), l'analyse IA, et retourne les résultats
3. **Les résultats sont cachés** dans \`audit_cache\` (TTL configurable) et optionnellement sauvegardés dans \`saved_reports\`
4. **Le système de crédits** (\`use_credit\` RPC) débite l'utilisateur avant chaque opération payante
5. **Les webhooks Stripe** mettent à jour \`profiles.subscription_status\` et créditent les achats

## Patterns architecturaux

- **Client singleton** : Toutes les Edge Functions utilisent \`getServiceClient()\` / \`getUserClient()\` du module \`_shared/supabaseClient.ts\` (refactorisé mars 2026)
- **Cache-first** : Toutes les fonctions d'audit vérifient \`audit_cache\` avant d'exécuter (via \`_shared/auditCache.ts\`)
- **Fire-and-forget workers** : Le crawl multi-pages lance un job puis déclenche le worker de manière asynchrone
- **Token tracking** : Chaque appel API externe est tracké dans \`api_call_logs\` (via \`_shared/tokenTracker.ts\`)
- **SSRF protection** : Toutes les URLs utilisateur sont validées contre les IPs privées (via \`_shared/ssrf.ts\`)
- **Circuit breaker** : Protection contre les cascades de pannes API (via \`_shared/circuitBreaker.ts\`)
- **Fair use** : Rate limiting par utilisateur (via \`_shared/fairUse.ts\` + \`check_fair_use_v2\` RPC)
- **IP rate limiting** : Protection des endpoints publics (via \`_shared/ipRateLimiter.ts\`)
- **Shared audit utils** : Logique PageSpeed, Safe Browsing et robots.txt centralisée dans \`_shared/auditUtils.ts\`
- **Fix templates** : Templates de code correctif SEO centralisés dans \`_shared/fixTemplates.ts\`
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
| \`architect_workbench\` | Tâches prescrites (remplace action_plans) | \`user_id\`, \`domain\`, \`title\`, \`severity\`, \`finding_category\`, \`source_type\`, \`status\`, \`spiral_score\` |
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
| \`tracked_sites\` | Sites suivis (monitoring) | \`user_id\`, \`url\`, \`domain\`, \`check_frequency\`, \`market_sector\`, \`client_targets\`, \`jargon_distance\`, \`api_key\`, \`is_commercial_service\`, \`nonprofit_type\`, \`entity_type\` |
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

### Content Engine & Corrélations

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| \`content_prompt_presets\` | Prompts custom par user/site/type | \`user_id\`, \`tracked_site_id\`, \`page_type\`, \`name\`, \`preset_data\` (ton, angle, longueur, CTA…), \`is_default\` |
| \`content_prompt_templates\` | Templates SEO/GEO système par type de page | \`page_type\`, \`template_data\`, \`is_active\` |
| \`content_generation_logs\` | Log chaque génération (features du brief, pas le texte) | \`user_id\`, \`tracked_site_id\`, \`page_type\`, \`market_sector\`, \`brief_tone\`, \`brief_angle\`, \`brief_length_target\`, \`brief_h2_count\`, \`brief_cta_count\`, \`source\` (content_architect/parmenion), \`measurement_phase\`, deltas GSC/GEO/LLM à T+30/T+90 |
| \`content_performance_correlations\` | Agrégats anonymes cross-utilisateurs | \`page_type\`, \`market_sector\`, \`tone\`, \`angle\`, \`avg_gsc_clicks_delta\`, \`avg_geo_score_delta\`, \`avg_llm_visibility_delta\`, \`sample_count\`, \`confidence_grade\` (A/B/C/F), \`week_start\` |
| \`sav_quality_scores\` | Scoring précision agent SAV | \`conversation_id\`, \`precision_score\`, \`route_match\`, \`repeated_intent_count\`, \`escalated_to_phone\` |

### Signalement & Recettage

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| \`user_bug_reports\` | Signalements utilisateurs (bugs, feature requests) | \`user_id\`, \`raw_message\`, \`translated_message\`, \`route\`, \`context_data\`, \`category\`, \`status\`, \`cto_response\`, \`notified_user\` |

### Détection de Chute (Drop Detector)

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| \`drop_diagnostics\` | Diagnostics de chute détectés | \`tracked_site_id\`, \`domain\`, \`drop_score\`, \`drop_probability\`, \`verdict\`, \`verdict_details\`, \`diagnosis_type\` (reactive/predictive) |
| \`drop_detector_config\` | Configuration globale du détecteur | \`is_enabled\`, \`drop_threshold\`, \`prediction_threshold\`, \`run_frequency\`, \`cost_credits\` |
| \`drop_detector_logs\` | Registre des exécutions | \`sites_scanned\`, \`alerts_generated\`, \`diagnostics_created\`, \`duration_ms\`, \`errors\` |

### Cocoon (Architecture Sémantique)

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| \`semantic_nodes\` | Nœuds du graphe sémantique | \`tracked_site_id\`, \`url\`, \`keywords\`, \`cluster_id\`, \`page_type\`, \`intent\`, \`roi_predictive\` |
| \`cocoon_sessions\` | Sessions de cocon sauvegardées | \`tracked_site_id\`, \`nodes_snapshot\`, \`edges_snapshot\`, \`cluster_summary\` |
| \`cocoon_recommendations\` | Recommandations IA Cocoon | \`tracked_site_id\`, \`recommendation_text\`, \`summary\`, \`is_applied\` |
| \`cocoon_tasks\` | Tâches liées au cocon | \`tracked_site_id\`, \`title\`, \`priority\`, \`status\` |
| \`cocoon_chat_histories\` | Historique chat IA Cocoon | \`tracked_site_id\`, \`messages\`, \`session_hash\` |
| \`cocoon_errors\` | Erreurs détectées par Cocoon | \`domain\`, \`problem_description\`, \`ai_response\`, \`status\` |
| \`cocoon_auto_links\` | Liens auto-générés par l'IA | \`tracked_site_id\`, \`source_url\`, \`target_url\`, \`anchor_text\`, \`confidence\`, \`is_deployed\`, \`is_active\` |
| \`cocoon_linking_exclusions\` | Exclusions granulaires de maillage | \`tracked_site_id\`, \`page_url\`, \`exclude_as_source\`, \`exclude_as_target\`, \`exclude_all\` |

### Google My Business (GMB)

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| \`gmb_locations\` | Liaison tracked_site ↔ fiche GMB | \`tracked_site_id\`, \`location_name\`, \`place_id\`, \`address\`, \`phone\`, \`hours\` (JSON) |
| \`gmb_reviews\` | Avis Google récupérés | \`gmb_location_id\`, \`google_review_id\`, \`star_rating\`, \`comment\`, \`reply_comment\`, \`is_flagged\` |
| \`gmb_posts\` | Publications GMB | \`gmb_location_id\`, \`post_type\` (STANDARD/EVENT/OFFER), \`summary\`, \`status\`, \`published_at\` |
| \`gmb_performance\` | Stats hebdomadaires | \`gmb_location_id\`, \`week_start_date\`, \`search_views\`, \`maps_views\`, \`website_clicks\`, \`phone_calls\`, \`avg_rating\` |
| \`gmb_tracked_keywords\` | Mots-clés locaux suivis (Suggestions KW) | \`tracked_site_id\`, \`keyword\`, \`source\`, \`search_volume\`, \`current_position\`, \`last_checked_at\` |
| \`gmb_local_competitors\` | Concurrents Google Maps via Google Places API | \`gmb_location_id\`, \`competitor_name\`, \`competitor_place_id\`, \`maps_position\`, \`position_change\`, \`avg_rating\`, \`total_reviews\`, \`snapshot_week\` |

### CMS & Intégrations

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| \`cms_connections\` | Connexions CMS (WP, Drupal, Shopify, Webflow, Wix) | \`tracked_site_id\`, \`platform\`, \`auth_method\`, \`status\`, \`capabilities\` |
| \`google_ads_connections\` | Connexions Google Ads OAuth | \`user_id\`, \`tracked_site_id\`, \`customer_id\`, \`access_token\`, \`refresh_token\` |
| \`google_connections\` | Connexions Google OAuth (GSC, GA4, GBP) | \`user_id\`, \`google_email\`, \`access_token\`, \`refresh_token\`, \`scopes\`. Les connexions GBP sont identifiées par un préfixe \`gbp:\` sur \`google_email\` pour les séparer des connexions GSC/GA4. |
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
| \`affiliate_codes\` | Codes affiliés (vérifiés au signup) | \`code\`, \`discount_percent\`, \`max_activations\`, \`current_activations\`, \`assigned_to_user_id\` |

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
| \`grant_welcome_credits()\` | Trigger | | \`grant_welcome_credits()\` | Trigger | 20 crédits offerts aux 1000 premiers inscrits | |
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
# API — Edge Functions (190+ fonctions)

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
| \`audit-strategique-ia\` | ✅ | 3 | Audit stratégique IA monolithique (Gemini Pro → Flash fallback) |
| \`strategic-orchestrator\` | ✅ | 3 | Orchestrateur modulaire audit GEO (pipeline 5 étapes) |
| \`strategic-crawl\` | ✅ | 0 | Micro-fn : extraction métadonnées + signaux E-E-A-T |
| \`strategic-market\` | ✅ | 0 | Micro-fn : mots-clés et volumes (DataForSEO) |
| \`strategic-competitors\` | ✅ | 0 | Micro-fn : analyse SERP et GMB concurrents |
| \`strategic-synthesis\` | ✅ | 0 | Micro-fn : synthèse finale LLM (Gemini Pro → Flash fallback) |
| \`audit-compare\` | ✅ | 4 | Analyse concurrentielle face-à-face |
| \`audit-local-seo\` | ✅ | 1 | Audit SEO local |
| \`audit-matrice\` | ✅ | 2 | Audit matrice décisionnelle (streaming SSE temps réel — un événement \`voxel\` par critère + \`done\`/\`error\`) |
| \`diagnose-hallucination\` | ✅ | 1 | Diagnostic d'hallucination LLM |
| \`check-llm-depth\` | ✅ | 0 | Profondeur de visibilité LLM multi-itération |

### Architecture Modulaire — Strategic Orchestrator

L'audit stratégique GEO utilise un **pipeline modulaire en 5 étapes** piloté par \`strategic-orchestrator\` :

\`\`\`
strategic-orchestrator
├── strategic-crawl        (métadonnées + E-E-A-T)     ─┐
├── strategic-market       (mots-clés, DataForSEO)      ├─ Parallèle (< 90s)
├── strategic-competitors  (SERP + GMB concurrents)     ─┤
├── check-llm              (visibilité IA)              ─┘
└── strategic-synthesis    (Gemini Pro → Flash fallback)  ← Séquentiel
\`\`\`

- **Cache intelligent** : \`audit_cache\` avec TTL 24h sur les étapes de collecte
- **Fallback LLM** : Si Gemini Pro dépasse 2m30, bascule automatique sur Gemini Flash
- **Fallback pipeline** : Si le pipeline modulaire échoue, bascule sur \`audit-strategique-ia\` (monolithique)
- \`audit-strategique-ia\` intègre aussi le fallback Pro→Flash (ajouté mars 2025)

### Tests d'intégration backend (CI)

12 tests couvrant 4 piliers :
1. **Sécurité** : SSRF, Turnstile, ensure-profile, auth middleware unifié (\`_shared/auth.ts\`)
2. **Facturation** : Calcul prix dynamique, create-checkout
3. **Audit** : validate-url, robots.txt parser, cache déterministe, LLM fallback Pro→Flash
4. **Tracking** : Résilience token tracker, headers CORS

Exécution : Admin → Console → Tests CI → "Lancer les tests"
Historique : stocké dans \`analytics_events\` (\`event_type: ci_test_run\`)

## Crawl Engine

| Endpoint | Auth | Crédits | Description |
|----------|------|---------|-------------|
| \`crawl-site\` | ✅ | 5-30 | Lance un crawl multi-pages |
| \`process-crawl-queue\` | ✅ | 0 | Worker de traitement des jobs |
| \`scan-wp\` | ✅ | 1 | Scan WordPress (plugins, thème, sécu) |

## Cocoon — Diagnostics & Stratège

| Endpoint | Auth | Crédits | Description |
|----------|------|---------|-------------|
| \`calculate-cocoon-logic\` | ✅ | 0 | Calcul du graphe sémantique Cocoon |
| \`cocoon-chat\` | ✅ | 0 | Assistant IA Cocoon (Gemini 3 Flash, streaming SSE) |
| \`cocoon-diag-authority\` | ✅ | 0 | Diagnostic autorité (PageRank, backlinks, E-E-A-T) |
| \`cocoon-diag-content\` | ✅ | 0 | Diagnostic contenu (thin, duplicate, gaps) |
| \`cocoon-diag-semantic\` | ✅ | 0 | Diagnostic sémantique (clusters, cannibalization) |
| \`cocoon-diag-structure\` | ✅ | 0 | Diagnostic structure (Hn, profondeur, orphans) |
| \`cocoon-strategist\` | ✅ | 0 | Stratège : recommandations URL, mémoire, axes dev, quality scoring déterministe |
| \`cocoon-auto-linking\` | ✅ | 0 | Auto-Maillage IA : pré-scan + scoring qualité page + sélection d'ancres contextuelles par IA (Gemini Flash) |
| \`cocoon-deploy-links\` | ✅ | 0 | Déploiement maillage interne vers CMS |
| \`calculate-internal-pagerank\` | ✅ | 0 | PageRank interne par page |
| \`persist-cocoon-session\` | ✅ | 0 | Sauvegarde session Cocoon |

## Génération & IA

| Endpoint | Auth | Crédits | Description |
|----------|------|---------|-------------|
| \`generate-corrective-code\` | ✅ | 2 | Génère le code correctif JS/PHP/Liquid |
| \`get-final-script\` | ✅ | 0 | Récupère le script final validé |
| \`generate-target-queries\` | ✅ | 1 | Génère des requêtes cibles LLM |
| \`generate-more-keywords\` | ✅ | 1 | Extension de mots-clés |
| \`generate-infotainment\` | ✅ | 0 | Contenu de patience (loading) |
| \`generate-blog-from-news\` | ✅ | 0 | Génération d'articles v2 (Perplexity, maillage auto, traductions EN/ES) |
| \`generate-prediction\` | ✅ | 0 | Prédiction de trafic |
| \`generate-image\` | ✅ | 0 | Génération d'images IA multi-moteurs (Imagen 3, FLUX, Ideogram) |
| \`summarize-report\` | ✅ | 0 | Résumé IA d'un rapport |
| \`content-architecture-advisor\` | ✅ | 5* | Recommandations architecture de contenu (5 critères GEO) — *5 crédits pour non-abonnés, inclus pour Pro Agency/Pro Agency+ |
| \`extract-architect-fields\` | ✅ | 0 | Extraction champs pour Content Architect |
| \`cms-publish-draft\` | ✅ | 0 | Publication brouillon vers CMS (WP pages+posts, Drupal pages+articles, Shopify pages+articles, Odoo, PrestaShop, IKtracker, **crawlers_internal**) |
| \`cms-push-draft\` | ✅ | 0 | Push brouillon CMS (v2, multi-format) |
| \`cms-push-code\` | ✅ | 0 | Push code correctif vers CMS |
| \`cms-push-redirect\` | ✅ | 0 | Push redirections vers CMS |
| \`cms-patch-content\` | ✅ | 0 | Patch contenu existant sur CMS (inclut handler **crawlers_internal** : écriture directe dans \\\`blog_articles\\\` et \\\`seo_page_drafts\\\`) |
| \`extract-pdf-data\` | ✅ | 0 | Extraction de données depuis PDF |
| \`parse-doc-matrix\` | ✅ | 0 | Parsing document matrice |
| \`parse-matrix-geo\` | ✅ | 0 | Parsing matrice GEO |
| \`parse-matrix-hybrid\` | ✅ | 0 | Parsing matrice hybride |
| \`voice-identity-enrichment\` | ✅ | 0 | Enrichissement carte d'identité par la voix |
| \`process-script-queue\` | ✅ | 0 | File d'attente FIFO multi-pages pour Scribe |

## Calculs & Métriques

| Endpoint | Auth | Description |
|----------|------|-------------|
| \`calculate-ias\` | ✅ | Indice d'Alignement Stratégique |
| \`calculate-llm-visibility\` | ✅ | Score de visibilité LLM |
| \`calculate-llm-volumes\` | ✅ | Volumes LLM estimés |
| \`calculate-sov\` | ✅ | Part de voix (Share of Voice) |
| \`measure-audit-impact\` | ✅ | Mesure d'impact post-audit |
| \`snapshot-audit-impact\` | ✅ | Snapshot T+30/60/90 |
| \`auto-measure-predictions\` | ✅ | Mesure automatique des prédictions |
| \`aggregate-observatory\` | ✅ | Agrégation observatoire sectoriel |
| \`detect-anomalies\` | ✅ | Détection anomalies statistiques (z-score) + notifications |
| \`drop-detector\` | ✅ | Détection de chute de trafic (réactive + prédictive) + alertes |

## Utilisateur & Billing

| Endpoint | Auth | Description |
|----------|------|-------------|
| \`ensure-profile\` | ✅ | Crée le profil si inexistant |
| \`auth-actions\` | ✅ | Actions d'authentification groupées |
| \`delete-account\` | ✅ | Suppression de compte (archivage) |
| \`restore-archived-user\` | ✅ | Restauration d'un compte archivé |
| \`create-checkout\` | ✅ | Session Stripe pour achat audit |
| \`create-credit-checkout\` | ✅ | Session Stripe pour achat crédits |
| \`create-subscription-session\` | ✅ | Session Stripe pour abonnement (mensuel ou annuel via param \`billing\`) |
| \`create-customer-portal\` | ✅ | Portail client Stripe |
| \`stripe-webhook\` | ❌ | Webhook Stripe (signature vérifiée) |
| \`stripe-actions\` | ✅ | Actions Stripe groupées (subscription, subscription_premium, checkout, credit-checkout, portal, retention — supporte \`billing: 'annual'\` pour les abonnements) |
| \`track-payment\` | ✅ | Tracking paiements |
| \`apply-referral\` | ✅ | Applique un code de parrainage |
| \`apply-affiliate\` | ✅ | Applique un code affilié |
| \`apply-retention-offer\` | ✅ | Applique une offre de rétention |
| \`manage-team\` | ✅ | Gestion équipe agence |
| \`send-password-reset\` | ✅ | Envoie un lien de réinitialisation |
| \`send-verification-code\` | ✅ | Envoie un code de vérification email |
| \`verify-email-code\` | ✅ | Vérifie un code email |
| \`admin-update-plan\` | ✅ | MAJ plan utilisateur (admin) |
| \`kill-all-viewers\` | ✅ | Révoque tous les viewers (admin) |
| \`submit-bug-report\` | ✅ | Soumission de signalement utilisateur |
| \`admin-backend-query\` | ✅ | Requête backend admin (mode créateur) |

## Intégrations Google

| Endpoint | Auth | Description |
|----------|------|-------------|
| \`gsc-auth\` | ✅ | OAuth Google unifié (GSC, GA4, GMB, GTM, Ads — 7 scopes) |
| \`fetch-ga4-data\` | ✅ | Récupère données Google Analytics 4 |
| \`google-ads-connector\` | ✅ | OAuth2 Google Ads + données campagnes |
| \`gtm-actions\` | ✅ | Déploiement automatique widget via Google Tag Manager |
| \`gmb-actions\` | ✅ | Google Business Profile : performance, reviews, location (API réelle + fallback simulé). Recherche prioritaire d'une connexion GBP dédiée (\`gbp:\` prefix) avant fallback sur les connexions Google génériques. |
| \`gbp-auth\` | ✅ | OAuth2 dédié Google Business Profile (scope \`business.manage\`). Séparé de \`gsc-auth\` pour éviter les conflits de scopes. Actions : \`login\`, callback, \`disconnect\`, \`status\`. |
| \`gmb-places-autocomplete\` | ✅ | Recherche de concurrents GMB via Google Places API (autocomplete + détails) |
| \`gmb-local-competitors\` | ✅ | Analyse concurrents locaux Google Maps |
| \`gmb-optimization\` | ✅ | Optimisation automatique fiche GMB. Actions : \`score-profile\` (score rapide), \`audit-full\` (audit 100 pts détaillé avec 5 catégories : Identité, Contact, Médias, Enrichissement, Engagement — top 5 correctifs priorisés avec gain estimé) |
| \`gmb-review-reply\` | ✅ | Génération automatique de réponses aux avis Google via LLM (Gemini Flash Lite). Actions : \`generate-reply\` (réponse unitaire), \`generate-batch\` (lot jusqu'à 20 avis). Analyse du sentiment, priorité (high/medium/low), ton configurable (professionnel/amical/chaleureux/formel), trilingue FR/EN/ES. |
| \`fetch-serp-kpis\` | ✅ | KPIs SERP via DataForSEO |
| \`serp-benchmark\` | ❌/✅ | Benchmark SERP multi-providers (DataForSEO + SerpApi + Serper.dev + Bright Data optionnel). Croisement des positions, pénalité single-hit (+20), classement moyen. Accessible sans auth (lead magnet /app/ranking-serp) |
| \`dataforseo-balance\` | ✅ | Solde du compte DataForSEO |
| \`refresh-serp-all\` | ✅ | CRON hebdo — rafraîchissement SERP |
| \`refresh-llm-visibility-all\` | ✅ | CRON rafraîchissement visibilité LLM |
| \`llm-visibility-lite\` | ❌ | Visibilité LLM allégée (sans auth) |

## CMS & Bridges externes

| Endpoint | Auth | Description |
|----------|------|-------------|
| \`wpsync\` | ✅ | Synchronisation WordPress |
| \`drupal-actions\` | ✅ | Bridge CMS Drupal (JSON:API) |
| \`iktracker-actions\` | ✅ | Bridge IKtracker (CRUD pages/articles) |
| \`register-cms-webhook\` | ✅ | Enregistrement webhooks CMS |
| \`webhook-shopify-orders\` | ❌ | Webhook Shopify (commandes) |
| \`webhook-woo-orders\` | ❌ | Webhook WooCommerce (commandes) |

## Outils tiers (Bundle APIs)

| Endpoint | Auth | Description |
|----------|------|-------------|
| \`gtmetrix-actions\` | ✅ | Audits de performance GTmetrix |
| \`rankmath-actions\` | ✅ | Gestion métadonnées SEO Rank Math |
| \`linkwhisper-actions\` | ✅ | Maillage interne Link Whisper |
| \`serpapi-actions\` | ✅ | Recherche Google via SerpAPI |

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
| \`watchdog-scripts\` | ✅ | Watchdog CRON des scripts déployés |

## Divers

| Endpoint | Auth | Description |
|----------|------|-------------|
| \`track-analytics\` | ❌ | Tracking événements analytics |
| \`fetch-news\` | ❌ | Récupère les actualités SEO |
| \`fetch-external-site\` | ✅ | Proxy HTML pour analyse |
| \`fetch-sitemap-tree\` | ✅ | Arborescence du sitemap XML |
| \`agent-cto\` | ✅ | Agent CTO autonome (auto-optimisation, monitoring diagnostics + stratège) |
| \`agent-seo\` | ✅ | Agent SEO v2 (scoring 7 axes, persistance recommandations) |
| \`sav-agent\` | ✅ | Assistant Félix (Gemini, alertes proactives, scoring précision, mémoire de site) |
| \`supervisor-actions\` | ✅ | Actions superviseur (orchestration agents) |
| \`update-market-trends\` | ✅ | MAJ tendances marché |
| \`update-config\` | ✅ | MAJ configuration système |
| \`view-function-source\` | ✅ | Consultation source d'une edge function |
| \`run-backend-tests\` | ✅ | Exécute 12 tests CI backend (sécurité, facturation, audit, tracking) |
| \`health-check\` | ❌ | Vérification santé du système |
| \`check-widget-health\` | ❌ | Vérification santé du widget |
| \`sdk-status\` | ❌ | Statut du SDK widget |
| \`widget-connect\` | ❌ | Connexion du widget externe |
| \`sitemap\` | ❌ | Génération sitemap XML |
| \`rss-feed\` | ❌ | Flux RSS du blog |
| \`verify-turnstile\` | ❌ | Vérification Cloudflare Turnstile |
| \`auth-email-hook\` | ❌ | Hook personnalisé emails auth |
| \`process-email-queue\` | ✅ | Worker file d'attente emails |
| \`session-heartbeat\` | ✅ | Heartbeat de session active |
| \`fly-health-check\` | ❌ | Health check renderer Fly.io |
| \`fly-keepalive\` | ❌ | Keep-alive renderer Fly.io |
| \`browserless-metrics\` | ✅ | Métriques d'utilisation Browserless |

## Quiz Félix

| Endpoint | Auth | Description |
|----------|------|-------------|
| \`felix-seo-quiz\` | ✅ | Génération de quiz SEO hebdomadaire par Félix |
| \`felix-weekly-quiz-notif\` | ✅ | Notification hebdomadaire quiz Félix |
| \`normalize-quiz-options\` | ✅ | Normalisation des options de quiz |
| \`sync-quiz-crawlers\` | ✅ | Synchronisation quiz avec données crawl |

## Pipeline & Automation

| Endpoint | Auth | Description |
|----------|------|-------------|
| \`marina\` | ✅ | Pipeline de rapports automatisés (3 phases chaînées : audit → crawl → synthèse) |
| \`autopilot-engine\` | ✅ | Moteur d'autopilote SEO — cycles complets 5 phases (cron quotidien 3h UTC) |
| \`parmenion-orchestrator\` | ✅ | Intelligence décisionnelle Parménion (Gemini Flash/Pro) |
| \`parmenion-feedback\` | ✅ | Boucle rétroaction T+30 Parménion |
| \`mcp-server\` | ❌/✅ | Serveur MCP (Model Context Protocol) — 2 tiers d'accès |
| \`api-balances\` | ✅ | Soldes API en temps réel (SerpAPI, OpenRouter, Firecrawl) |
| \`seasonality-detector\` | ✅ | Détection de saisonnalité (tendances cycliques) |
| \`content-perf-aggregator\` | ✅ | CRON hebdo — agrégation anonyme corrélations prompt→performance (T+30/T+90) |
| \`content-freshness\` | ✅ | Détection de contenu obsolète |
| \`content-pruning\` | ✅ | Analyse de contenu à élaguer |
| \`firehose-actions\` | ✅ | Actions du firehose d'événements |
| \`link-intersection\` | ✅ | Intersection de backlinks concurrents |
| \`broken-link-building\` | ✅ | Opportunités de link building sur liens cassés |
| \`brand-mentions\` | ✅ | Détection de mentions de marque non liées |
| \`backlink-scanner\` | ✅ | Scan backlinks approfondi |
| \`check-backlinks\` | ✅ | Vérification backlinks rapide |
| \`url-structure-analyzer\` | ✅ | Analyse de structure d'URLs |
| \`submit-sitemap\` | ✅ | Soumission sitemap aux moteurs de recherche |
| \`haloscan-connector\` | ✅ | Connecteur Haloscan |

## E-commerce

| Endpoint | Auth | Description |
|----------|------|-------------|
| \`webhook-shopify-orders\` | ❌ | Webhook Shopify (commandes) |
| \`webhook-woo-orders\` | ❌ | Webhook WooCommerce (commandes) |
| \`prestashop-connector\` | ✅ | Bridge PrestaShop |
| \`odoo-connector\` | ✅ | Bridge Odoo ERP |
| \`matomo-connector\` | ✅ | Bridge analytics Matomo |
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
| \`FIRECRAWL_API_KEY\` | crawl engine (fallback) | Clé API Firecrawl (scraping fallback) |
| \`SPIDER_API_KEY\` | crawl engine (primary) | Clé API Spider Cloud (scraping principal) |
| \`GOOGLE_PAGESPEED_API_KEY\` | \`check-pagespeed\` | Clé API Google PageSpeed Insights |
| \`GOOGLE_GSC_CLIENT_ID\` | \`gsc-auth\` | OAuth Google Search Console |
| \`GOOGLE_GSC_CLIENT_SECRET\` | \`gsc-auth\` | OAuth Google Search Console |
| \`TURNSTILE_SECRET_KEY\` | \`verify-turnstile\` | Secret Cloudflare Turnstile |
| \`DATAFORSEO_LOGIN\` | SERP, backlinks | Login DataForSEO |
| \`DATAFORSEO_PASSWORD\` | SERP, backlinks | Password DataForSEO |
| \`OPENROUTER_API_KEY\` | fallback IA | Clé OpenRouter (backup) |
| \`LOVABLE_API_KEY\` | Lovable AI | Accès aux modèles Gemini/GPT |
| \`IKTRACKER_API_KEY\` | \`iktracker-actions\` | Clé bridge IKtracker |
| \`GOOGLE_PLACES_API_KEY\` | \`gmb-places-autocomplete\` | Clé Google Places API (autocomplete concurrents GMB) |
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
# Modules Partagés (_shared/) — 37 modules

Le dossier \`supabase/functions/_shared/\` contient les utilitaires réutilisés par toutes les Edge Functions. Depuis mars 2026, **toutes les fonctions** utilisent les singletons de ce dossier au lieu de créer leurs propres clients.

## Liste des modules

### \`cors.ts\`
Headers CORS standard pour les réponses Edge Functions.

### \`supabaseClient.ts\`
**Singletons Supabase** : \`getServiceClient()\` (bypass RLS), \`getAnonClient()\` (RLS), \`getUserClient(authHeader)\` (scoped user). Réutilise les connexions pour la performance.

### \`auth.ts\`
Utilitaires d'authentification : extraction JWT, vérification utilisateur.

### \`stealthFetch.ts\`
Wrapper anti-détection pour les requêtes HTTP sortantes (17+ User-Agents, headers réalistes, retries).

### \`renderPage.ts\`
Moteur de rendu SPA : Fly.io → Browserless → fetch direct (cascade de fallbacks).

### \`auditCache.ts\`
Cache des résultats d'audit (TTL configurable, invalidation automatique).

### \`auditUtils.ts\` *(nouveau)*
Logique mutualisée PageSpeed Insights, Google Safe Browsing, robots.txt et normalisation URL. Extraite de \`expert-audit\` et \`audit-expert-seo\`.

### \`fixTemplates.ts\` *(nouveau)*
~1120 lignes de templates de code correctif SEO (meta, Hn, schema.org, lazy-load, etc.). Extraits de \`generate-corrective-code\`.

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

### \`getDomainContext.ts\`
Contexte de domaine pour les diagnostics et le stratège.

### \`fetchGA4.ts\`
Utilitaire de récupération des données Google Analytics 4.

### \`resolveGoogleToken.ts\`
Résolution multi-comptes et rafraîchissement des tokens OAuth Google (GSC, GA4, GMB, GTM, Ads).

### \`saveRawAuditData.ts\`
Persistance des données brutes d'audit dans \`audit_raw_data\`.

### \`silentErrorLogger.ts\`
Logger d'erreurs silencieux (insertion dans \`analytics_events\` sans bloquer le flux).

### \`trackUrl.ts\`
Upsert dans \`analyzed_urls\` (compteur d'analyses).

### \`translations.ts\`
Traductions pour le contenu généré côté serveur (emails, rapports).

### \`agentPersonas.ts\` *(nouveau v7)*
Personas centralisés des agents Félix et Stratège Cocoon : ton, longueur max, formulations interdites, pattern d'intentionnalité (métrique → impact → action), adaptation par niveau d'autonomie.

### \`siteMemory.ts\`
Mémoire persistante par site tracké : stocke et restitue les faits saillants (secteur, identité, résultats d'audit) pour enrichir le contexte LLM.

### \`ownershipCheck.ts\`
Vérification de propriété du domaine avant injection de code ou modification CMS.

### \`apiBillingAlert.ts\`
Alertes proactives de facturation API (SerpAPI, OpenRouter, Firecrawl) quand les crédits approchent de zéro.

### \`founderGmb.ts\`
Utilitaires GMB spécifiques au fondateur (accès multi-fiches).

### \`strategicPrompts.ts\` + \`strategicSplitPrompts.ts\`
Prompts LLM pour l'audit stratégique (monolithique et pipeline modulaire).

### \`dataForSeoStrategic.ts\`
Utilitaires DataForSEO pour les fonctions stratégiques (SERP, volumes, KD).

### \`matriceHtmlAnalysis.ts\` + \`matriceScoring.ts\` + \`matriceTypeDetector.ts\` + \`matriceSseClient.ts\`
Pipeline d'analyse HTML, scoring et détection de type pour la **Matrice d'audit (Sprints 1-7)** :
- **Streaming SSE** (\`matriceSseClient.ts\`) : client EventSource côté \`MatricePrompt.tsx\` qui consomme les événements \`voxel\` (un par critère évalué), \`done\` et \`error\` émis par \`audit-matrice\`. Permet le rendu progressif du cube 3D et de la table pivot pendant l'audit.
- **Visualisations** (\`MatriceCube3D\`, \`MatricePivotView\`, \`MatriceVoxelDetail\`) : cube 3D Three.js (axes : critère × moteur LLM × variant prompt), table pivot triable et drill-down voxel détaillant le verdict + extrait de réponse + tactique correctrice.
- **Persistance & historique (Sprint 7)** : chaque audit est persisté dans \`matrix_audits\` (snapshot JSONB self-contained = résultats + pivot). Bandeau "Reprendre l'audit interrompu (X/Y critères)" en haut de \`MatricePrompt\` quand \`sessionStorage.rapport_matrice_results_partial\` est présent. Vue \`/matrice/historique\` accessible depuis la top bar : liste, comparaison delta scores entre 2 audits, rejeu d'un audit archivé.

### \`pageMetadata.ts\`
Extraction et normalisation des métadonnées de page (title, meta, OG, etc.).

### \`textUtils.ts\`
Utilitaires de manipulation de texte (troncature, nettoyage HTML, extraction).

### \`browserlessConfig.ts\`
Configuration du rendu headless (Browserless/Fly.io).

### \`contentBrief.ts\` *(nouveau)*
Calcul déterministe du **ContentBrief** avant appel LLM : longueur cible, ton, nombre de H2/H3, angle éditorial, CTA, liens internes. Utilisé par Content Architect et Parménion.

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
Génère des recommandations automatiques basées sur les mots-clés proches de la page 1 (positions 8-25). Types : optimisation title, meta description, contenu, liens internes, structure Hn. Chaque recommendation peut être ajoutée au workbench (\`architect_workbench\`) en un clic, avec animation de paillettes.

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
  - **Bouton Auto-Maillage IA** : Déclenche \`cocoon-auto-linking\` pour la page sélectionnée. Affiche les suggestions avec badge Pré-scan (vert) ou IA (violet) et score de confiance.
  - **Toggles d'exclusion** : 3 interrupteurs par page (pas de liens sortants / pas de liens entrants / exclure totalement). Persistés dans \`cocoon_linking_exclusions\`.
- **CocoonAIChat** : Chat Gemini 3 Flash avec streaming SSE
- **Mode X-Ray** : Toggle nœuds fantômes
- **Légende dynamique** : N'affiche que les types présents
- **Auto-refresh** : Détecte retour utilisateur après audit/crawl

## Auto-Maillage IA (\`cocoon-auto-linking\`)

### Algorithme

1. **Vérification des exclusions** : vérifie si la page source est exclue du maillage sortant
2. **Récupération du contenu** : charge le \`body_text_truncated\` de la page source depuis le dernier crawl
3. **Sélection des cibles** : top 30 pages indexables triées par \`seo_score\`, filtrage des exclusions
4. **Scoring qualité déterministe** : chaque page candidate est scorée par \`computeCrawlPageQuality()\` (module partagé \`_shared/crawlPageQuality.ts\`) — score composite 0-100 sur 6 axes (word_count, meta, headings, links_in, links_out, seo_score) avec pondération adaptée au \`BusinessProfile\` du site. Les pages sont re-classées par ce score (top 20 retenus)
5. **Pré-scan intelligent** : recherche les titres/H1 des pages cibles dans le texte source (économie 20-40% d'appels IA)
6. **Sélection d'ancres IA** (Gemini Flash via tool calling) : pour les pages non matchées, l'IA identifie le meilleur texte d'ancrage existant dans le contenu source (2-6 mots, contextuel)
7. **Persistance** : les suggestions sont stockées dans \`cocoon_auto_links\` avec \`is_deployed = false\` pour reversibilité

### Tables

| Table | Usage |
|-------|-------|
| \`cocoon_auto_links\` | Liens IA générés (source, target, anchor, confidence, deployed) |
| \`cocoon_linking_exclusions\` | Préférences d'exclusion par page (source, target, all) |
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
| **Fair Use LLM** | Pro Agency+ : rafraîchissements illimités côté front, cache serveur de 2h pour optimiser les coûts API. |

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

  // ───────────────────────────────────────────────
  // SECTION : AGENTS AUTONOMES
  // ───────────────────────────────────────────────
  {
    id: 'agents',
    title: 'Agents Autonomes',
    icon: 'Package',
    content: `
# Agents Autonomes

## Agent SEO v2

L'Agent SEO autonome analyse et optimise le contenu des pages du site de manière automatisée.

### Architecture

- **Edge Function** : \`agent-seo\`
- **Modèle** : Gemini 2.5 Flash via Lovable AI
- **Anti-détection** : Utilise \`stealthFetch\` au lieu de fetch basique
- **Contexte enrichi** : Injecte le contexte du site (secteur, audience, zone commerciale) via \`getSiteContext\`

### Scoring 7 axes

| Axe | Poids | Description |
|-----|-------|-------------|
| Profondeur de contenu | 20% | Longueur, richesse sémantique |
| Structure Hn | 15% | Hiérarchie H1-H6, sauts de niveaux |
| Mots-clés | 15% | Densité, placement, variantes |
| Maillage interne | 15% | Détection ancres toxiques, densité liens |
| Métadonnées | 15% | Title, description, JSON-LD |
| E-E-A-T | 10% | Signaux d'autorité, expertise |
| Densité contenu | 10% | Ratio texte/HTML |

### Persistance

Les recommandations sont automatiquement persistées dans \`audit_recommendations_registry\` avec :
- \`recommendation_id\` unique
- \`priority\` (critical, high, medium, low)
- \`category\` et \`fix_type\`
- \`is_resolved\` pour le suivi

### Modes de fonctionnement

| Mode | Cible | Modification max |
|------|-------|-----------------|
| **Carte blanche** | Articles blog | 100% réécriture autorisée |
| **Prudent** | Landing pages | Max 10% de modification |
| **Interdit** | Home, Console, Audits | Aucune modification |

---

## Agent Blog v2 (generate-blog-from-news)

### Recherche intelligente

1. **Perplexity Sonar** : Récupère les dernières actualités et stats vérifiées
2. **DataForSEO** : Identifie les mots-clés trending pour le sujet

### Maillage interne automatique

Système de keyword-mapping vers 10 pages internes clés :
- /audit-expert, /cocoon, /matrice, /console, etc.
- Liens contextuels insérés automatiquement dans le contenu

### Quality Guardrails

Scoring post-génération sur 100 points :
- E-E-A-T, longueur, densité de données, liens
- **Seuil minimal : 30/100** — en dessous, régénération automatique

### Traductions

Pipeline automatique EN/ES via Gemini 2.5 Flash Lite après génération FR.

---

## Agent SAV IA — "Félix"

### Architecture

- **Modèle** : Gemini 2.5 Flash via Lovable AI
- **Nom** : "Félix" — assistant SAV principal (icône robot violet #7C3AED)
- **Limite** : 600 caractères max par défaut (3000 en mode narratif Parménion)
- **Ton** : Collègue sympa expert SEO/GEO, vouvoiement par défaut (tutoiement si l'utilisateur tutoie)
- **Détection langue** : FR/EN/ES dès le premier message
- **Personnalisation** : Utilise le prénom (table \\\`profiles\\\`), adaptation par niveau d'autonomie

### Sources de données

| Source | Description |
|--------|-------------|
| Documentation SAV | /aide — base de connaissance publique |
| Taxonomie frontend | Routes, onglets, positions des composants |
| Données utilisateur | \\\`tracked_sites\\\`, \\\`crawl_pages\\\`, \\\`cocoon_sessions\\\`, audits |

### Fonctionnalités avancées

- **Voice input** : Bouton micro — Web Speech API (FR/EN/ES) avec vocabulaire phonétique STT
- **Pièces jointes** : Bouton + — rapports ou scripts du compte pour explication
- **Suggestions opérationnelles** : Rappels de scans, suggestions Cocoon, mémoire de site persistante
- **Alertes proactives** : Alerte crédits bas (<3), alerte crawl proche du plafond (>80%), suggestion upgrade Pro Agency / Pro Agency+
- **Signalement de bugs** : Détection NLP → bouton signaler → message pré-traduit pour le CTO → \\\`user_bug_reports\\\`
- **Notification résolution** : Badge sur le bouton assistant quand un signalement est résolu par le CTO
- **Mémoire de site** : Injecte les faits saillants des 3 sites les plus actifs via \\\`siteMemory.ts\\\`
- **Modules partagés** : Accès en lecture aux résultats de \\\`computeCrawlPageQuality()\\\` et \\\`computeSeoScoreV2()\\\` pour contextualiser les explications (scores déterministes des pages et du site)
- **Animation d'invitation** : Ping-pong 20s après l'arrivée sur la home

### Mode Créateur (admin uniquement)

Pour les administrateurs ayant le statut **créateur** (\\\`is_creator = true\\\` dans \\\`profiles\\\`) :
- Accès complet aux données backend (tables, edge functions, logs)
- Interrogation croisée multi-tables avec explication
- Consultation du code source des edge functions via \\\`view-function-source\\\`
- **Interdit** : modification de la logique backend (lecture seule)

### Scoring de précision (\\\`sav_quality_scores\\\`)

- **precision_score** (0-100), **route_match**, **repeated_intent_count**, **escalated_to_phone**
- Dashboard : Admin → Intelligence → Supervisor

### Protocole d'escalade

- 3 itérations max → rappel téléphonique (06/07)
- Email de contact : contact@crawlers.fr
- Purge auto 48h via \\\`cleanup_expired_phone_callbacks()\\\`

### Sécurité

- Ne mentionne jamais les technologies internes (sauf mode créateur)
- Explique, ne produit pas

---

## Diagnostics Cocoon (5 fonctions spécialisées)

| Fonction | Axe d'analyse | Données croisées |
|----------|--------------|------------------|
| \\\`cocoon-diag-authority\\\` | Autorité & E-E-A-T | PageRank interne, backlinks, signaux sociaux |
| \\\`cocoon-diag-content\\\` | Qualité contenu | Thin content, duplicata, content gaps, word count |
| \\\`cocoon-diag-semantic\\\` | Sémantique & clusters | Cannibalization, intent distribution, TF-IDF |
| \\\`cocoon-diag-structure\\\` | Structure technique | Profondeur Hn, pages orphelines, maillage |
| \\\`cocoon-diag-subdomains\\\` | Sous-domaines | Détection et analyse des sous-domaines du site |

- **Table** : \\\`cocoon_diagnostic_results\\\` (type, scores, findings, metadata)
- **Accès** : Utilisateurs avec site tracké
- **Monitoré par** : Agent CTO

---

## Stratège Cocoon (\\\`cocoon-strategist\\\`)

- **Rôle** : Recommandations stratégiques par URL, avec mémoire persistante
- **Table mémoire** : \\\`strategist_recommendations\\\` (user_id, url, tracked_site_id, recommandations, résultats)
- **Croisement** : GSC (CTR, positions) + GA4 (conversions, pages vues) pour évaluer l'impact
- **Scoring qualité déterministe** (v3.3) : Appelle \\\`computeCrawlPageQuality()\\\` sur les URLs affectées pour booster la priorité des tâches. Pages faibles (score ≤ 30) → boost x1.4, pages fortes (score > 70) → réduction x0.9. Adapté au \\\`BusinessProfile\\\` du site (local, ecommerce, SaaS, editorial)
- **3 axes de développement** : Proposés à l'utilisateur, sélection unique → définit l'objectif
- **Placement mot-clé** : Arbitrage intelligent dans le title et la première phrase selon les bonnes pratiques SEO
- **Monitoré par** : Agent CTO

---

## Content Architecture Advisor

- **Edge Function** : \\\`content-architecture-advisor\\\`
- **Accès** : Tous les utilisateurs avec site tracké. Masqué en démo
- **Monitoré par** : Agent CTO
- **5 critères GEO conditionnels** : Questions clés, Structure, Passages citables, E-E-A-T, Enrichissement sémantique
- **Garde-fous** : pénalités innovation, cap jargon 25%, filtrage CTAs, continuité tonale
- **Indexabilité** : Les contenus générés incluent systématiquement \\\`<meta name="robots" content="index, follow">\\\` et \\\`isAccessibleForFree: true\\\` dans le schema.org
- **Publication CMS** : Via \\\`cms-publish-draft\\\` — supporte **articles ET pages statiques** pour WordPress (\\\`/wp/v2/pages\\\`), Drupal (\\\`node--page\\\`), Shopify (\\\`/pages.json\\\`), Odoo, PrestaShop, IKtracker, **crawlers_internal** (écriture directe dans \\\`blog_articles\\\` / \\\`seo_page_drafts\\\`). Paramètre \\\`content_type: "page" | "post"\\\`
- **CMS Interne crawlers.fr** : Plateforme \\\`crawlers_internal\\\` dans l'enum \\\`cms_platform\\\`. Connexion \\\`cms_connections\\\` avec \\\`auth_method = 'internal'\\\`. Handler dédié dans \\\`cms-patch-content\\\` et \\\`cms-publish-draft\\\` pour écriture directe en base (résolution slug depuis l'URL cible : \\\`/blog/{slug}\\\` → \\\`blog_articles\\\`, sinon → \\\`seo_page_drafts\\\`)
- **Bouton Parménion (Glaive)** : Dans le CMS admin, au survol de chaque ligne d'article, un bouton épée (violet) insère une tâche \\\`pending\\\` dans \\\`architect_workbench\\\` avec \\\`source_function = 'cms-glaive'\\\`. Vérification anti-doublon avant insertion
- **Tarification** : Abonnés Pro Agency / Pro Agency+ : inclus dans le quota mensuel (100/150 pages). Non-abonnés : **5 crédits** par page (couvre LLM + 2 images). Le bouton Publier affiche le coût \\\`Publier (5 crédits)\\\` pour les non-abonnés
- **Fair use mensuel** : Limite par plan via \\\`check_monthly_fair_use\\\` (SQL RPC) — Free: 5/mois, Pro Agency: 100/mois, Pro Agency+: 150/mois. Renouvellement le 1er du mois calendaire. Admins: bypass
- **Routeur CMS** : Parménion utilise le routeur intelligent \\\`assign_workbench_action_type\\\` pour router les prescriptions vers Content Architect (contenu visible) ou Code Architect (métadonnées/structured data)
- **ContentBrief déterministe** : Le module \\\`_shared/contentBrief.ts\\\` calcule les contraintes éditoriales (longueur, ton, H2/H3, angle, CTA, liens internes) avant l'appel LLM
- **Presets utilisateur** : Prompts custom par site et type de page (\\\`content_prompt_presets\\\`), appelables depuis Cocoon ou Content
- **Templates système** : Templates SEO/GEO par type de page (\\\`content_prompt_templates\\\`) : landing, product, article
- **Sidebar multi-sites** : Menu vertical avec liste des sites trackés, onglets Landing Page / Produit / Article Blog par site
- **Logging performance** : Chaque génération est instrumentée dans \\\`content_generation_logs\\\` (features du brief, pas le texte du prompt)

### Interface UI (layout Canva v5)

- **Toolbar verticale gauche** (56px, icônes Lucide stroke-1.5) : 7 panneaux — Prompt, Structure (H1/H2/URL/mots-clés avec badges), Images (génération IA multi-styles : photo, cinematic, flat, infographic, watercolor, artistic), Données structurées (meta title/description, JSON-LD, robots, canonical), Brouillon (sauvegarde/historique), Bibliothèque (galerie images+pages créées), Options
- **Panneau contextuel** (centre, 260-500px redimensionnable) : un seul ouvert à la fois, sticky footer avec boutons d'action
- **Zone "Instructions spécifiques"** : partagée entre tous les panneaux, redimensionnable en hauteur (60-300px), bouton "Injecter" (icône Syringe) en sticky footer
- **Preview/Canvas** (droite, pleine largeur quand panneau fermé) : rendu temps réel avec spinner de rechargement, édition directe, boutons "Enregistrer" (brouillon) et "Publier vers le CMS" en haut à droite
- **Handle de drag** entre panneau et preview pour ajuster la largeur

### Gouvernance agents

- **Dans /cocoon** : le Stratège Cocoon pilote Content Architect, prescrit les contenus et prend la main
- **Hors /cocoon** (Console, Code Architect) : Félix (SAV) peut guider l'utilisateur dans Content Architect, expliquer les panneaux, suggérer des instructions et prendre la main si nécessaire
- **Pré-appel stratégique** : hors /cocoon, Content Architect effectue un pré-appel silencieux au \\\`cocoon-strategist\\\` pour pré-remplir la structure (H1, H2, mots-clés), garantissant une précision identique

### Génération d'images IA (v3 — multi-moteurs)

- **Edge Function** : \\\`generate-image\\\`
- **Routeur intelligent** : Le style demandé route automatiquement vers le moteur optimal :
  - **Imagen 3** (Google) : Photo, Cinématique — rendu photoréaliste. Forcé aussi quand une image de référence est utilisée (mode multimodal)
  - **FLUX** : Artistic, Flat Illustration, Watercolor — styles artistiques et illustrations
  - **Ideogram** : Typography, Infographic, Noir & Blanc, Peinture classique — texte lisible et compositions complexes
- **Styles supportés** : photo, cinematic, flat_illustration, infographic, watercolor, artistic, classic_painting, typography, black_and_white
- **Adaptation sectorielle** : le style est automatiquement adapté au secteur du site (food→photo, tech→flat, luxury→cinematic, etc.)
- **Multi-formats** : header, body, hero, thumbnail
- **Fair use** : Max 2 images par contenu, 3 itérations par génération
- **Bibliothèque** : 30 images max/site, stockées 24h dans le storage (\\\`image-references/generated/\\\`)
- **Image de référence** : Mode Inspiration ou Édition → force le routage vers Imagen 3 (multimodal)
- **Recommandations style** : Suggère les styles les plus utilisés par utilisateur et URL (\\\`image_style_preferences\\\`)
- **CMS** : Intégration HTML accessible (alt, caption, lazy-loading) et upload \\\`featured_media\\\` WordPress (base64 ou URL publique)
- **Moteur de recommandation** : \\\`computeImageRecommendation\\\` dans le stratège calcule le nombre, le style et le placement optimaux par type de page et secteur

### Pipeline de corrélation prompt→performance

- **Collecte** : À chaque génération, les features du brief (ton, angle, longueur, H2, CTA, liens internes, signaux E-E-A-T, passages GEO) sont logguées dans \\\`content_generation_logs\\\`
- **Mesure** : Le cron hebdomadaire \\\`content-perf-aggregator\\\` enrichit les logs avec les deltas GSC/GEO/LLM à T+30 et T+90
- **Agrégation** : Corrélations anonymes cross-utilisateurs dans \\\`content_performance_correlations\\\`, groupées par \\\`page_type × market_sector × tone × angle\\\`
- **Confiance** : Grade A (≥20 samples), B (≥10), C (≥5), F (<5)
- **Usage futur** : Recommandation inline de paramètres optimaux par secteur et type de page (V2)

---

## Détection d'anomalies (\\\`detect-anomalies\\\`)

- **Méthode** : Z-score sur fenêtre glissante (8 semaines baseline)
- **Métriques surveillées** : Pages vues, CTR SERP, taux de conversion, ranking, IAS, Google Ads (impressions, clics, coût)
- **Seuils** : |z| ≥ 2 → alerte, |z| ≥ 3 → critique
- **Table** : \\\`anomaly_alerts\\\` (metric_name, z_score, severity, direction, change_pct)
- **Affichage** : Bandeau défilant dans /console avec codes couleur (vert/orange/rouge)

---

## Détection de Chute (\\\`drop-detector\\\`)

- **Edge Function** : \\\`drop-detector\\\`
- **Exécution** : Automatique (arrière-tâche sur tous les sites trackés) + manuelle via Admin
- **Détection réactive** : Compare les clics GSC de la semaine en cours vs baseline 4 semaines. Seuil configurable (défaut 15%)
- **Détection prédictive** : Régression linéaire sur 8 semaines, projection à semaine+2. Alerte si probabilité ≥ 80%
- **Cross-analyse** : Croise GSC, audits techniques, E-E-A-T, backlinks pour identifier la cause (Trust, Tech, Content, Links, GEO)
- **Tables** : \\\`drop_diagnostics\\\`, \\\`drop_detector_config\\\`, \\\`drop_detector_logs\\\`
- **Alertes** : Génère des entrées dans \\\`anomaly_alerts\\\` (bandeau défilant /console)
- **Admin** : Bouton ON/OFF dans Admin → Scripts, registre des analyses et alertes envoyées
- **Tarification** : Gratuit Pro Agency/Admin, 3 crédits pour les autres

---

## Circuit de Signalement (Recettage)

- **Déclencheur** : Détection NLP dans Assistant Crawler ou Stratège Cocoon ("bug", "problème", "erreur", etc.)
- **Workflow** : Bouton "Signaler" → message suivant = signalement → pré-traduction technique via IA → INSERT \\\`user_bug_reports\\\`
- **Contexte auto-enrichi** : route, user-agent, plan, dernier audit, tracked_site actif
- **Catégorisation IA** : \\\`bug_ui\\\`, \\\`bug_data\\\`, \\\`feature_request\\\`, \\\`question\\\`
- **Admin CTO** : Nouvel onglet "Recettage" dans Intelligence → CTO
- **Statuts** : \\\`open\\\` → \\\`investigating\\\` → \\\`resolved\\\`
- **Notification** : À la résolution, le premier assistant disponible (Crawler ou Stratège Cocoon) avertit l'utilisateur via badge + message contextuel
- **Rate-limit** : Max 3 signalements/jour/utilisateur
- **Anti-doublon** : Hash message + route (<24h)

---

## Scribe (β)

- **Accès** : Admin only, masqué en démo
- **13 paramètres** : Prompt, URL, Type page, Longueur, Photo, CTA, Mot-clé, Ton, Langue, Persona, Jargon (1-10), Maillage Cocoon, URLs concurrentes
- **7 champs auto-remplis** via carte d'identité + cache SERP + Cocoon
- **File d'attente** : \\\`process-script-queue\\\` (FIFO)
`,
  },

  // ───────────────────────────────────────────────
  // SECTION : PIPELINE MARINA
  // ───────────────────────────────────────────────
  {
    id: 'marina',
    title: 'Pipeline Marina',
    icon: 'Ship',
    content: `
# Pipeline Marina — Prospection Automatisée

## Vue d'ensemble

Marina est un pipeline de génération de rapports SEO complets pour la prospection. Il est segmenté en **3 phases chaînées** via self-invocation (POST sur lui-même avec paramètre \\\`_phase\\\`) pour contourner les timeouts wall-clock des Edge Functions.

## Phases

\\\`\\\`\\\`
Phase 1 : Audit SEO (audit-expert-seo) + Audit Stratégique (strategic-orchestrator)
    ↓ persisté dans audit_cache (marina_intermediate_\${jobId})
Phase 2 : Crawl multi-pages (crawl-site + polling 100s max)
    ↓ persisté dans audit_cache
Phase 3 : Calcul Cocoon + Visibilité LLM + Synthèse rapport HTML
\\\`\\\`\\\`

## Phase 3 — Agrégation multi-pages

La phase 3 agrège les métriques de **toutes les pages crawlées** (\\\`crawl_pages\\\`) et du **graphe sémantique** (\\\`semantic_nodes\\\`) pour produire un rapport complet :

| Donnée | Source | Agrégation |
|--------|--------|------------|
| Score SEO moyen | \\\`crawl_pages.seo_score\\\` | Moyenne |
| Pages avec erreurs | \\\`crawl_pages.http_status\\\` | Count ≥ 400 |
| Mots total | \\\`crawl_pages.word_count\\\` | Somme |
| Liens internes/externes | \\\`crawl_pages\\\` | Somme |
| Clusters sémantiques | \\\`semantic_nodes\\\` | Count distinct cluster_id |
| Liens entrants par nœud | \\\`semantic_nodes.internal_links_in\\\` | Moyenne |

## Gestion des jobs

| Fonctionnalité | Détail |
|----------------|--------|
| **Table** | \\\`async_jobs\\\` (function_name = 'marina') |
| **Auto-cleanup** | Jobs bloqués > 10 min → marqués 'failed' |
| **Annulation** | Statut 'cancelled' + message 'Interrompu manuellement' |
| **Suppression** | Admin peut supprimer individuellement ou en masse |
| **Partage** | Liens temporaires via \\\`share-actions\\\` (\\\`/temporarylink/{shareId}\\\`) |
| **Coûts** | Compteur temps réel (LLM + APIs) via analytics_events |
`,
  },

  // ───────────────────────────────────────────────
  // SECTION : AUTOPILOTE
  // ───────────────────────────────────────────────
  {
    id: 'autopilot',
    title: 'Autopilote (Créateur)',
    icon: 'Package',
    content: `
# Autopilote — Pipeline d'Automation SEO

## Accès

- **Réservé aux créateurs** (rôle admin)
- Bouton "Autopilote" dans le header de chaque site tracké (/console → Mes sites)
- **Non exposé aux utilisateurs** — Félix ne connaît pas cette fonctionnalité

## Concept

Pipeline **complet en 5 phases séquentielles** exécutées dans un seul cycle :

\`\`\`
Audit → Diagnostic → Prescription → Exécution → Validation
\`\`\`

Chaque cycle boucle sur l'ensemble des phases pour garantir un traitement de bout en bout. Les phases individuelles restent configurables via des cases à cocher.

## Phases

### 1. Diagnostic (multi-select)

| Option | Description | Fonction backend |
|--------|-------------|-----------------|
| Audit complet | SEO + Performance + GEO + LLM | \`check-crawlers\`, \`check-pagespeed\`, \`check-geo\`, \`check-llm\` |
| Crawl | Crawl technique du site | \`crawl-site\` |
| Stratège Cocoon | Analyse du maillage interne | \`cocoon-strategist\` |

### 2. Prescription (multi-select)

| Option | Description | Fonction backend |
|--------|-------------|-----------------|
| Stratège Cocoon | Recommandations maillage | \`cocoon-strategist\` |
| Architect | Génération de code correctif | \`generate-corrective-code\` |
| Content Architect | Optimisation contenu éditorial | \`content-architect\` |

### 3. Implémentation (single-select)

| Mode | Description |
|------|-------------|
| Dry-run (simulation) | Simule sans modifier le site |
| One shot | Exécute une seule fois |
| One shot + rétroaction | Exécute → re-crawl → vérifie → corrige |
| Automatique | Boucle continue jusqu'à l'arrêt (cooldown 48h) |

## Garde-fous

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| Max pages/cycle | 10 | Plafond de pages modifiées par cycle |
| Cooldown | 48h | Délai minimum entre deux cycles automatiques |
| Auto-pause | 15% | Pause automatique si chute des métriques > seuil |
| Exclusions sous-domaines | — | Sous-domaines exclus du pipeline |
| Exclusions types de pages | — | Types de pages exclus (produit, catégorie…) |

## Interdictions strictes

- **Suppression de pages** : L'autopilote ne peut JAMAIS supprimer une page
- **Charte graphique** : Aucune modification du design/CSS/thème du site

## Tables

| Table | Rôle |
|-------|------|
| \`autopilot_configs\` | Configuration du pipeline par site (phases, mode, garde-fous, exclusions) |
| \`autopilot_modification_log\` | Registre de chaque modification (phase, action, URL, diff, statut) |
| \`parmenion_decision_log\` | Registre décisionnel de Parménion (but, tactique, risque, impact, tokens, coût) |
| \`parmenion_targets\` | Cibles multi-tenant pilotées par Parménion (\`domain\`, \`label\`, \`platform\`, \`event_type\`, \`api_key_name\`, \`is_active\`) |
| \`matrix_audits\` | Sprint 7 — historique des audits matriciels (\`label\`, \`audit_type\`, \`global_score\`, \`results\` JSONB, \`pivot_snapshot\` JSONB) |

## Moteur d'exécution (autopilot-engine)

L'Edge Function \`autopilot-engine\` est le moteur central de l'Autopilote, invoqué par un **cron job quotidien** (3h UTC) via \`pg_cron\` + \`pg_net\`.

### Pipeline d'exécution (cycle complet)

1. **Fetch** : Récupère toutes les \`autopilot_configs\` actives
2. **Cooldown** : Vérifie le délai minimum (défaut 48h) depuis \`last_cycle_at\`
3. **Boucle 5 phases** : Pour chaque phase (audit → diagnose → prescribe → execute → validate) :
   - Appelle \`parmenion-orchestrator\` avec le contexte de la phase
   - Exécute les actions décidées par Parménion
   - Log dans \`autopilot_modification_log\` et \`parmenion_decision_log\`
4. **MAJ** : Incrémente \`total_cycles_run\`, met à jour \`last_cycle_at\`
5. **Sync IKtracker** : Événement de statut final si applicable

### Parménion — Intelligence décisionnelle (V3 — prescribe déterministe)

- **Modèle** : Gemini 2.5 Flash (escalade vers Pro si nécessaire)
- **Phase prescribe V3** : appel déterministe à \`cocoon-strategist\` qui retourne un plan priorisé (max 8 tâches) avec \`executor_function\`, \`urgency\`, \`depends_on\`, \`priority_score\`. L'exécuteur prend toujours la tâche #1. Fallback V2 (\`prescribeWithDualPrompts\`) si le stratège échoue.
- **content_priority_mode** : booste x1.8 les tâches contenu (create_content, rewrite_content, publish_draft, improve_eeat).
- **Sécurité** : Risque ≥ 4 bloqué. Mode conservateur si erreurs > 20% (segmenté par action_type).
- **Apprentissage** : Boucle rétroaction T+30 via \`parmenion-feedback\`

### Cibles multi-tenant (\`parmenion_targets\`)

Parménion gère plusieurs sites cibles via la table \`parmenion_targets\`. Plateformes branchées et opérationnelles :

| Domaine | Plateforme | Pont API | Statut autonomie |
|---------|------------|----------|------------------|
| \`crawlers.fr\` | \`internal\` | \`cms-patch-content\` (handler crawlers_internal) | ✅ Branché |
| \`iktracker.fr\` | \`iktracker\` | \`iktracker-actions\` | ✅ Branché |
| \`dictadevi.io\` | \`custom\` | ⚠️ Aucun pont API dédié | ⚠️ Cible enregistrée mais **non branchée** — il manque \`dictadevi-actions\`, le secret \`DICTADEVI_API_KEY\`, le routing \`platform='dictadevi'\` dans \`parmenion-orchestrator\` + \`autopilot-engine\`, et le mode \`dictadevi\` dans \`cmsContentScanner.ts\`. À implémenter au Sprint 8. |

### Cron jobs

| Cron | Fréquence | Fonction |
|------|-----------|----------|
| \`autopilot-engine-cycle\` | Quotidien 3h UTC | \`autopilot-engine\` |
| \`refresh-serp-all\` | Hebdo | \`refresh-serp-all\` |
| \`watchdog-scripts\` | 15 min | \`watchdog-scripts\` |
| \`content-perf-aggregator\` | Hebdo lundi 3h UTC | \`content-perf-aggregator\` |

## Registre des modifications

- Affiché en bas du dashboard "Mes sites" (créateurs uniquement)
- Historique des 50 dernières modifications par site
`,
  },
];

/**
 * Métadonnées de la documentation.
 * Modifiez la version et la date à chaque mise à jour significative.
 */
export const docMetadata = {
  version: '11.0.0',
  lastUpdated: '2026-04-23',
  projectName: 'Crawlers — Plateforme Audit SEO/GEO/LLM + Stratège Cocoon + Drop Detector + Recettage + Content Architect (crédits + images IA multi-moteurs) + Scribe + GMB + Anomalies + Bundle + Agents + SAV Félix + Quiz SEO + Autopilote + Parménion + Marina + MCP + N8N + Content Performance Engine + Matrice immersive (SSE + Pivot/Cube 3D + historique)',
  totalEdgeFunctions: 192,
  totalSharedModules: 38,
  totalTables: '150+',
  totalLinesOfCode: '218 000+',
  totalMigrations: 247,
  totalPages: 42,
  totalComponents: 320,
};