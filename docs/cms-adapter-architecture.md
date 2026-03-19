# CMS Adapter Architecture — Cocoon Auto-Implementation

> **Statut** : Phase de design (Mars 2026)
> **Objectif** : Permettre à Cocoon d'appliquer automatiquement ses recommandations SEO directement sur le CMS de l'utilisateur via les API REST natives.

## Vue d'ensemble

```
Cocoon Recommendation
        ↓
  Edge Function: cms-actions (routeur)
        ↓
  ┌─────────────┐
  │ CMS Adapter │ ← interface commune
  └──┬──┬──┬──┬─┘
     │  │  │  │
    WP Shopify Webflow Wix
```

## Table `cms_connections`

| Colonne              | Type                                              | Description                                    |
|----------------------|---------------------------------------------------|------------------------------------------------|
| `id`                 | uuid (PK)                                         | Identifiant unique                             |
| `user_id`            | uuid (FK → auth.users)                            | Propriétaire                                   |
| `tracked_site_id`    | uuid (FK → tracked_sites)                         | Site lié                                       |
| `platform`           | enum (`wordpress`, `shopify`, `webflow`, `wix`)   | Type de CMS                                    |
| `oauth_access_token` | text (chiffré via vault)                          | Token OAuth actif                              |
| `oauth_refresh_token`| text                                              | Refresh token                                  |
| `token_expiry`       | timestamptz                                       | Expiration du token                            |
| `site_url`           | text                                              | URL racine du CMS                              |
| `platform_site_id`   | text                                              | ID interne (Shopify store, Webflow site_id…)   |
| `scopes`             | text[]                                            | Scopes OAuth accordés                          |
| `status`             | text (`active`, `expired`, `revoked`)             | État de la connexion                           |
| `created_at`         | timestamptz                                       |                                                |
| `updated_at`         | timestamptz                                       |                                                |

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

## Actions supportées par CMS

| Action                 | WordPress | Shopify | Webflow | Wix  |
|------------------------|:---------:|:-------:|:-------:|:----:|
| Modifier title/meta    | ✅        | ✅      | ✅      | ⚠️   |
| Modifier canonical     | ✅        | ❌      | ✅      | ❌   |
| Ajouter JSON-LD        | ✅        | ✅ (1)  | ⚠️ (2) | ❌   |
| Maillage interne       | ✅        | ⚠️ (3) | ⚠️ (2) | ❌   |
| Redirections 301/302   | ✅        | ✅      | ✅      | ✅   |
| Lister les pages       | ✅        | ✅      | ✅      | ✅   |

Notes :
1. Shopify : JSON-LD via modification du thème Liquid (plus complexe).
2. Webflow : Pas de manipulation HTML fine via API — limité aux champs CMS.
3. Shopify : Le contenu des pages est en Liquid, l'injection de liens nécessite du parsing HTML.

## Edge Functions

| Fonction               | Rôle                                                        |
|------------------------|-------------------------------------------------------------|
| `cms-oauth-callback`   | Réception du callback OAuth, stockage des tokens            |
| `cms-actions`          | Routeur principal : `list-pages`, `update-meta`, `add-redirect`, `add-links` |
| `cms-token-refresh`    | Cron job pour rafraîchir les tokens expirés                 |

## Roadmap

1. **Phase 1** : Table `cms_connections` + WordPress Adapter (meta, redirections, maillage via plugin existant)
2. **Phase 2** : Shopify Adapter (meta + redirections) + OAuth Shopify
3. **Phase 3** : Webflow Adapter + Wix Adapter
4. **Phase 4** : Bouton « Appliquer automatiquement » dans l'historique Cocoon
5. **Phase 5** : Mode batch (appliquer N recommandations en 1 clic)

## Sécurité

- Les tokens OAuth sont stockés chiffrés (Supabase Vault si disponible).
- RLS strict : un utilisateur ne peut accéder qu'à ses propres connexions CMS.
- Chaque action CMS est loguée dans `analytics_events` pour traçabilité.
- Rate limiting via `check_fair_use_v2` sur les actions d'écriture.
- Confirmation utilisateur requise avant toute modification destructive (redirections, suppression de contenu).
