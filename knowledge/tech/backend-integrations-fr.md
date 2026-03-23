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

### Ahrefs Firehose (NEW)
- Edge function : `firehose-actions`
- API : `https://api.firehose.com` (SSE streaming)
- Authentification : Management Key (`fhm_` prefix) + Tap Tokens (`fh_` prefix)
- Tables : `firehose_taps`, `firehose_rules`, `firehose_events`
- Actions : list/create/update/revoke taps, list/create/update/delete rules, poll_stream (batch fetch & persist)
- Données : mentions web en temps réel, diff de contenu, catégorisation ML, markdown complet
- Requiert secret : `FIREHOSE_MANAGEMENT_KEY`
- Accès : Pro Agency ou Admin uniquement

## Bundle Options
- Table : `bundle_api_catalog` (api_name, api_url, seo_segment, crawlers_feature)
- Table : `bundle_subscriptions` (user_id, selected_apis, api_count, monthly_price_cents)
- Tarification : 1€ × nombre d'APIs sélectionnées
- Accès admin uniquement pour l'instant (onglet Console → Bundle Option, icône Lego)
