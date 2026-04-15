# Memory: tech/backend-integrations-fr
Updated: 2026-04-08

## Intégrations API tierces préparées (backend ready, pas encore connectées)

### Google Ads
- Edge function : `google-ads-connector`
- Table : `google_ads_connections` (customer_id, access_token, refresh_token, tracked_site_id)
- OAuth2 flow connecté, scope : `https://www.googleapis.com/auth/adwords` (scope standard Google, pas de scope read-only disponible)
- **Important** : L'API Google Ads ne propose pas de scope `readonly`. Le scope `adwords` est le seul disponible. L'application n'effectue que des opérations de consultation (rapports, métriques, mots-clés).
- Prérequis : l'API "Google Ads API" doit être activée dans la Google Cloud Console du projet
- Feature : SEA to SEO Bridge (onglet dans /console) — analyse les campagnes Google Ads pour identifier les mots-clés SEA rentables à convertir en opportunités SEO organiques

### Rank Math SEO (WordPress)
- Edge function : `rankmath-connector`
- Endpoints REST API WP : `/rankmath/v1/getHead`, `/rankmath/v1/getKeywords`
- Authentification : Application Password WordPress
- Données : SEO score, focus keywords, rich snippets config

### GTmetrix
- Edge function : `gtmetrix-connector`
- API REST v2.0 : `https://gtmetrix.com/api/2.0/tests`
- Authentification : API Key (Basic Auth)
- Données : Lighthouse scores, Web Vitals (LCP, TBT, CLS), waterfall

### LinkWhisper
- Edge function : `linkwhisper-connector`
- API REST WP : `/linkwhisper/v1/links`, `/linkwhisper/v1/suggestions`
- Authentification : Application Password WordPress
- Données : internal links, suggestions auto-link, orphan pages

### Matomo (alternative GA4)
- Edge function : `matomo-connector`
- API : Matomo Reporting API (`/index.php?module=API`)
- Authentification : `token_auth` (token API Matomo)
- Tables : `matomo_connections` (matomo_url, site_id, auth_token, tracked_site_id), `matomo_history_log` (sessions, pageviews, bounce_rate, etc.)
- Actions : test_connection, fetch_metrics, sync_weekly (9 semaines pour compatibilité anomaly detection)
- Données : visiteurs uniques, sessions, pages vues, taux de rebond, durée moyenne, actions/visite
- Pas de secret global requis (chaque connexion a son propre token_auth)

### Ahrefs Firehose
- Edge function : `firehose-actions`
- API : `https://api.firehose.com` (SSE streaming)
- Authentification : Management Key (`fhm_` prefix) + Tap Tokens (`fh_` prefix)
- Tables : `firehose_taps`, `firehose_rules`, `firehose_events`
- Actions : list/create/update/revoke taps, list/create/update/delete rules, poll_stream (batch fetch & persist)
- Données : mentions web en temps réel, diff de contenu, catégorisation ML, markdown complet
- Requiert secret : `FIREHOSE_MANAGEMENT_KEY`
- Accès : Pro Agency ou Admin uniquement

### Odoo (ERP/CMS)
- Edge function : `odoo-connector`
- API : XML-RPC `/xmlrpc/2/common` + `/xmlrpc/2/object` (execute_kw)
- API REST (Odoo 17+) : `/api/{model}` (JSON)
- Authentification : Login/Password + DB name (XML-RPC auth), ou API Key (header)
- Modèles : `website.page`, `blog.post`, `product.template`, `website.menu`
- Actions : test_connection, save_connection, list_pages, list_blog_posts, create_draft
- Capabilities stockées : uid, db, models disponibles
- Pas de secret global requis (chaque connexion a ses propres credentials)

### PrestaShop
- Edge function : `prestashop-connector`
- API : PrestaShop Webservice REST (`/api/{resource}?output_format=JSON`)
- Authentification : API Key (Basic Auth, key comme username, pas de password)
- Ressources : `content_management_system` (pages CMS), `products`, `orders`, `smartblog_posts` (si module blog)
- Actions : test_connection, save_connection, list_pages, list_blog_posts, list_products, create_draft
- Capabilities détectées : products, cms_pages, orders (via introspection `/api/`)
- Publication draft : CMS page avec `active=0` via XML POST
- Pas de secret global requis (chaque connexion a sa propre API key)

## Bundle Options
- Table : `bundle_api_catalog` (api_name, api_url, seo_segment, crawlers_feature)
- Table : `bundle_subscriptions` (user_id, selected_apis, api_count, monthly_price_cents)
- Tarification : 1€ × nombre d'APIs sélectionnées
- Accès admin uniquement pour l'instant (onglet Console → Bundle Option, icône Lego)

## Gouvernance des Agents IA
- **Budget tokens** : Les agents Supervisor et CTO sont limités à 1€/jour maximum en tokens Anthropic. Le contrôle est appliqué dans les edge functions respectives via un compteur quotidien.

## Logging tokens LLM (`ai_gateway_usage`)
- Toutes les edge functions utilisant des LLM loguent leur consommation dans `ai_gateway_usage`
- Champs : `model`, `prompt_tokens`, `completion_tokens`, `total_tokens`, `estimated_cost_usd`, `gateway`, `edge_function`, `is_fallback`
- Edge functions trackées : `sav-agent`, `cocoon-chat`, `strategic-synthesis`, `audit-strategique-ia`, `content-architecture-advisor`, `generate-corrective-code`, `autopilot-engine`, etc.
- Dashboard Finances (admin) : agrège les coûts par edge function et par modèle

## Système de Queue & Batch Processing (`job_queue`)
- Table : `job_queue` — file d'attente centralisée avec priorité, verrouillage optimiste, retry automatique (3 max)
- Table : `rate_limit_tokens` — token bucket global pour les appels LLM (30 tokens, recharge 20/sec)
- Edge function : `queue-worker` — déclenché par cron (30s), claim atomique via `claim_jobs()` (FOR UPDATE SKIP LOCKED), concurrence 10 jobs/batch 15
- Helper : `_shared/jobQueue.ts` — `enqueueJob()`, `enqueueBatch()`, `completeJob()`, `failJob()`
- **Priorité par plan** :
  - `agency_premium` = 10 (la plus haute, traité en premier)
  - `agency_pro` = 20
  - Nouvel utilisateur (<24h) = 30 (prioritaire sur les inscrits standards)
  - Inscrit standard = 40
- Fonction SQL `resolve_job_priority(p_user_id)` : calcule automatiquement la priorité depuis `profiles.plan_type` + `profiles.created_at`
- Fonction SQL `claim_jobs(batch_size, worker_id)` : récupère et verrouille atomiquement un batch de jobs
- RLS : chaque utilisateur ne voit/crée que ses propres jobs ; le worker utilise le service-role
- Recovery automatique : les jobs bloqués (locked_until expiré) sont requeueés
