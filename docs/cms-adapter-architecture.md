# CMS Adapter Architecture — Cocoon Auto-Implementation

> **Statut** : Phase 1 active (Mars 2026)
> **Objectif** : Permettre à Cocoon d'appliquer automatiquement ses recommandations SEO directement sur le CMS de l'utilisateur via les API REST natives.

## Vue d'ensemble

```
Cocoon Recommendation
        ↓
  Edge Function: cms-actions (routeur)
        ↓
  ┌──────────────────┐
  │   CMS Adapter    │ ← interface commune
  └──┬──┬──┬──┬──┬───┘
     │  │  │  │  │
    WP Shopify Webflow Wix Drupal
```

## Table `cms_connections`

| Colonne              | Type                                                         | Description                                    |
|----------------------|--------------------------------------------------------------|------------------------------------------------|
| `id`                 | uuid (PK)                                                    | Identifiant unique                             |
| `user_id`            | uuid (FK → auth.users)                                       | Propriétaire                                   |
| `tracked_site_id`    | uuid (FK → tracked_sites)                                    | Site lié                                       |
| `platform`           | enum (`wordpress`, `shopify`, `webflow`, `wix`, `drupal`)    | Type de CMS                                    |
| `auth_method`        | text (`oauth2`, `basic`, `api_key`)                          | Mode d'authentification                        |
| `oauth_access_token` | text (chiffré via vault)                                     | Token OAuth actif                              |
| `oauth_refresh_token`| text                                                         | Refresh token                                  |
| `token_expiry`       | timestamptz                                                  | Expiration du token                            |
| `basic_auth_user`    | text                                                         | Utilisateur Basic Auth (Drupal)                |
| `basic_auth_pass`    | text                                                         | Mot de passe Basic Auth (Drupal)               |
| `api_key`            | text                                                         | Clé API directe                                |
| `site_url`           | text                                                         | URL racine du CMS                              |
| `platform_site_id`   | text                                                         | ID interne (Shopify store, Webflow site_id…)   |
| `scopes`             | text[]                                                       | Scopes OAuth accordés                          |
| `capabilities`       | jsonb                                                        | Capacités détectées (metatag, redirect…)        |
| `status`             | text (`active`, `expired`, `revoked`, `pending`)             | État de la connexion                           |
| `created_at`         | timestamptz                                                  |                                                |
| `updated_at`         | timestamptz                                                  |                                                |

## Interface commune `CMSAdapter`

```typescript
interface CMSAdapter {
  // SEO on-page
  updatePageMeta(pageId: string, meta: {
    title?: string;
    description?: string;
    canonical?: string;
    hreflang?: Record<string, string>;
  }): Promise<void>;

  upsertJsonLd(pageId: string, schema: object): Promise<void>;

  // Maillage interne
  addInternalLinks(pageId: string, links: {
    anchor: string;
    targetUrl: string;
  }[]): Promise<void>;

  // Redirections
  createRedirect(from: string, to: string, type: 301 | 302): Promise<void>;
  listRedirects(): Promise<Redirect[]>;
  deleteRedirect(id: string): Promise<void>;

  // Discovery
  listPages(cursor?: string): Promise<{ pages: Page[]; nextCursor?: string }>;
}
```

## Authentification OAuth par CMS

### WordPress
- **Méthode** : Pas d'app OAuth externe nécessaire.
- **Le plugin WP existant** fait déjà office de pont API REST via le handshake `wpsync`.
- Le plugin expose des endpoints REST custom (`/wp-json/crawlers/v1/...`) déjà authentifiés par la clé API site.
- **Scopes** : Accès complet via le rôle admin WordPress du plugin.
- **Secrets requis** : Aucun nouveau (réutilise `tracked_sites.api_key`).

### Shopify
- **Portail dev** : [partners.shopify.com](https://partners.shopify.com)
- **Flow** : OAuth 2.0 natif Shopify
- **Scopes nécessaires** : `write_content`, `write_redirects`, `write_online_store`
- **Secrets requis** : `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`
- **Callback URL** : `https://{project_id}.supabase.co/functions/v1/cms-oauth-callback`

### Webflow
- **Portail dev** : [developers.webflow.com](https://developers.webflow.com)
- **Flow** : OAuth 2.0 natif
- **Scopes nécessaires** : `cms:write`, `sites:read`, `pages:write`
- **Secrets requis** : `WEBFLOW_CLIENT_ID`, `WEBFLOW_CLIENT_SECRET`
- **Callback URL** : `https://{project_id}.supabase.co/functions/v1/cms-oauth-callback`

### Wix
- **Portail dev** : [dev.wix.com](https://dev.wix.com)
- **Flow** : OAuth 2.0 (Wix Dev Center)
- **Scopes nécessaires** : `site.pages.update`, `site.redirects.manage`
- **Secrets requis** : `WIX_CLIENT_ID`, `WIX_CLIENT_SECRET`
- **Callback URL** : `https://{project_id}.supabase.co/functions/v1/cms-oauth-callback`

### Drupal (NOUVEAU)
- **API** : JSON:API (module core Drupal 8+/9+/10+/11+)
- **Flow principal** : OAuth 2.0 via le module `simple_oauth`
- **Flow alternatif** : Basic Auth (module `basic_auth` core) — idéal pour MVP/tests rapides
- **Scopes OAuth** : Configurables via `simple_oauth` (ex: `administrator`, `content_editor`)
- **Modules Drupal requis** :
  - `jsonapi` (core, activé par défaut)
  - `metatag` (contrib) — pour la gestion des meta title/description
  - `redirect` (contrib) — pour les redirections 301/302
  - `simple_oauth` (contrib, optionnel) — pour l'auth OAuth2
  - `basic_auth` (core, optionnel) — pour l'auth Basic
- **Secrets requis** : Aucun côté Crawlers (les credentials sont stockés par connexion dans `cms_connections`)
- **Endpoints utilisés** :
  - `GET /jsonapi` — Discovery des types de contenus
  - `GET /jsonapi/node/{type}` — Lister les pages
  - `PATCH /jsonapi/node/{type}/{uuid}` — Modifier title, meta, body
  - `GET/POST/DELETE /jsonapi/redirect/redirect` — Gestion des redirections

## Actions supportées par CMS

| Action                 | WordPress | Shopify | Webflow | Wix  | Drupal | PrestaShop | Odoo |
|------------------------|:---------:|:-------:|:-------:|:----:|:------:|:----------:|:----:|
| Modifier title/meta    | ✅        | ✅      | ✅      | ⚠️   | ✅     | ✅         | ✅   |
| Modifier canonical     | ✅        | ❌      | ❌      | ❌   | ✅     | ❌         | ❌   |
| Modifier robots meta   | ✅        | ❌      | ❌      | ❌   | ✅     | ❌         | ❌   |
| Open Graph (title/desc)| ✅        | ❌ (1)  | ✅      | ❌   | ✅     | ❌         | ❌   |
| Ajouter JSON-LD        | ✅        | ✅      | ✅      | ❌   | ✅     | ✅ (2)     | ✅ (2)|
| Alt text images        | ✅        | ✅      | ✅      | ❌   | ✅     | ✅         | ✅   |
| Maillage interne       | ✅        | ⚠️      | ⚠️      | ❌   | ✅     | ✅         | ✅   |
| Redirections 301/302   | ✅ (3)    | ✅      | ✅      | ✅   | ✅     | ❌ (4)     | ✅   |
| Lister les pages       | ✅        | ✅      | ✅      | ✅   | ✅     | ✅         | ✅   |
| Patch contenu (H1/FAQ) | ✅        | ✅      | ✅      | ⚠️   | ✅     | ✅         | ✅   |

Notes :
1. Shopify OG tags sont auto-générés depuis title/description/image.
2. JSON-LD injecté dans le body HTML du contenu.
3. WordPress redirections : nécessite le plugin Redirection ou le plugin Crawlers.
4. PrestaShop : pas d'API native pour les redirections — nécessite `.htaccess` ou module tiers.

## Edge Functions

| Fonction               | Rôle                                                        |
|------------------------|-------------------------------------------------------------|
| `cms-oauth-callback`   | Réception du callback OAuth, stockage des tokens            |
| `cms-actions`          | Routeur principal : `list-pages`, `update-meta`, `add-redirect`, `add-links` |
| `cms-token-refresh`    | Cron job pour rafraîchir les tokens expirés                 |
| `drupal-actions`       | **Routeur Drupal** : 10 actions (test, list-pages, get-page, update-meta, update-body, add-internal-links, list/create/delete-redirect, discover-node-types) |

## Edge Function `drupal-actions` — Actions disponibles

| Action               | Méthode | Description                                          |
|----------------------|---------|------------------------------------------------------|
| `test-connection`    | POST    | Teste la connexion Drupal (sans sauvegarder en DB)   |
| `discover-node-types`| POST   | Liste les types de nœuds disponibles                 |
| `list-pages`         | POST    | Liste les pages d'un type donné (pagination incluse) |
| `get-page`           | POST    | Récupère le détail d'une page (body, meta, path)     |
| `update-meta`        | POST    | Met à jour title et/ou metatags d'un nœud            |
| `update-body`        | POST    | Remplace le body HTML d'un nœud                      |
| `add-internal-links` | POST    | Injecte des liens internes dans le body existant      |
| `list-redirects`     | POST    | Liste les redirections (module `redirect`)            |
| `create-redirect`    | POST    | Crée une redirection 301/302                         |
| `delete-redirect`    | POST    | Supprime une redirection                             |

## Intégration Autopilote Parménion

L'Autopilote utilise le bridge CMS (`iktracker-actions`) comme canal d'exécution pour les corrections de contenu et les créations éditoriales. Les coordonnées de ciblage (`target_selector`, `target_operation`) issues du workbench sont traduites en actions CMS concrètes :
- `target_selector: h1` + `target_operation: replace` → `update-page` avec le nouveau H1
- `target_selector: content` + `target_operation: append` → `update-page` avec contenu enrichi
- `target_selector: meta_description` + `target_operation: create` → `update-page` avec nouvelle meta
- Canal `emit_editorial_content` → `create-post` pour les nouveaux articles

## Roadmap

1. **Phase 1** : Table `cms_connections` ✅ + WordPress Adapter (meta, redirections, maillage via plugin existant)
2. **Phase 1bis** : **Drupal Adapter** ✅ (JSON:API, OAuth2 + Basic Auth, 10 actions)
3. **Phase 2** : Shopify Adapter (meta + redirections) + OAuth Shopify
4. **Phase 3** : Webflow Adapter + Wix Adapter
5. **Phase 4** : Bouton « Appliquer automatiquement » dans l'historique Cocoon
6. **Phase 5** : Mode batch (appliquer N recommandations en 1 clic)

## Sécurité

- Les tokens OAuth sont stockés chiffrés (Supabase Vault si disponible).
- RLS strict : un utilisateur ne peut accéder qu'à ses propres connexions CMS.
- Chaque action CMS est loguée dans `analytics_events` pour traçabilité.
- Rate limiting via `check_fair_use_v2` sur les actions d'écriture.
- Confirmation utilisateur requise avant toute modification destructive (redirections, suppression de contenu).
- **Drupal** : Les credentials Basic Auth sont stockés en base (champ `basic_auth_pass`), idéalement à migrer vers Vault.
