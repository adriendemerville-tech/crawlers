# Memory: tech/backend-integrations-fr

## Intégrations API tierces préparées (backend ready, pas encore connectées)

### Google Ads
- Edge function : `google-ads-connector`
- Table : `google_ads_connections` (customer_id, access_token, refresh_token, tracked_site_id)
- OAuth2 flow préparé, scopes : `https://www.googleapis.com/auth/adwords.readonly`

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
