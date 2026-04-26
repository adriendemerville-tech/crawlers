---
name: admin-lookup-skill
description: Skill admin_lookup_user dans copilot-orchestrator — réservée mode créateur, expose statut connexions CMS/Google/Matomo/Canva par utilisateur+site, et guide la marche à suivre pour connecter un CMS
type: feature
---

# Skill `admin_lookup_user` (mode créateur)

## Objectif
Permettre à Félix (et au Stratège, en mode créateur) de répondre à deux familles de questions support :
1. **Statut** : « L'user X a-t-il pu connecter son CMS pour le site Y ? »
2. **Action** : « Que doit faire X pour connecter son CMS pour le site Y ? »

## Activation
- Disponible UNIQUEMENT en mode créateur (préfixe `/createur :`, `/creator :` ou `/admin :`)
- N'est listée dans `skillPolicies` d'aucune persona → `'forbidden'` par défaut
- Devient exposée via la branche `isCreatorMode ? listSkills() : ...` dans `runAgentLoop` (`copilot-orchestrator/index.ts`)
- **Defense in depth** : le handler revérifie `has_role(user_id, 'admin')` côté serveur avant toute lecture

## Schéma réel des connexions (corrigé)
- `cms_connections` : scope **site** (`tracked_site_id`), colonnes `platform, auth_method, status, site_url, scopes, capabilities, token_expiry, …`
- `google_connections` : scope **user uniquement** (PAS de `tracked_site_id` ni de `service`/`status`). Colonnes : `google_email, gsc_site_urls[], ga4_property_id, gmb_account_id, gmb_location_id, scopes, token_expiry`. Le matching "ce site est-il couvert par GSC ?" se fait en filtrant `gsc_site_urls` pour le domaine.
- `matomo_connections` : scope **site**, colonnes `matomo_url, site_id, is_active, last_sync_at, sync_error`
- `canva_connections` : scope **user**, colonne d'expiration = `token_expires_at` (pas `token_expiry`)

## Données retournées
Pour chaque utilisateur matché (ILIKE first_name/last_name/email, max 10 résultats) :
- Profil : user_id, prénom, nom, email, plan_type, subscription_status, signup_date
- `sites[]` filtrables par `domain` :
  - `cms_platform_declared`, `last_cms_refresh_at`, `last_audit_at`
  - `connections.cms` : enregistrements `cms_connections` du site
  - `connections.google_for_this_site` : sous-ensemble de `google_connections` du user dont `gsc_site_urls` couvre le domaine
  - `connections.matomo` : `matomo_connections` du site
- `user_level_connections` : agrégat global (tous les Google + Canva du user, scopes, tokens) — utile pour répondre « il a connecté Google mais pas pour ce site précis ».

## Marche à suivre côté user (Félix doit la connaître)
Le system prompt FELIX_PERSONA décrit le chemin : **Mes Sites → site → onglet Connexions → "Connecter un CMS"** → choix plateforme :
- **WordPress** : Application Password (rôle Éditeur min) ou clé REST
- **Shopify** : custom app token avec scopes `read_content, write_content, read_orders`
- **Wix / Webflow** : OAuth en un clic
- **Drupal / Odoo / PrestaShop** : Basic Auth applicatif
Pré-requis : si `cms_platform_declared` est null, suggérer d'abord un audit (auto-détection plateforme). Gating : connexion CMS = Pro Agency+.

## Architecture
- Fichier : `supabase/functions/copilot-orchestrator/skills/registry.ts`
- Utilise `ctx.service` (service role) car on lit des tables d'autres utilisateurs — c'est l'unique skill autorisée à le faire sans `safeServiceCall` car le check d'autorisation porte sur **le rôle admin de l'appelant**, pas sur la propriété d'un site.

## Exemples d'usage
```
/createur : l'user richard stievenard a-t-il pu connecter son cms pour le site https://sphaeragloballtd.com/ ?
/createur : que doit faire richard stievenard pour connecter son cms pour le site https://sphaeragloballtd.com/ ?
```
→ Félix appelle `admin_lookup_user({ query: "stievenard", domain: "sphaeragloballtd.com" })`
→ Réponse : statut factuel (aucune cms_connection, plan agency_premium, plateforme non détectée) + marche à suivre produit.
