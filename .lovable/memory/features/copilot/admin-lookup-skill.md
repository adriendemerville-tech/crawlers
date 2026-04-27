---
name: admin-lookup-skill
description: Skill admin_lookup_user — réservée mode créateur, expose statut connexions CMS user / CMS miroir Parménion / Google / Matomo / Canva / IKtracker par utilisateur+site, et guide la marche à suivre pour connecter un CMS
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

## Schéma réel des connexions
- `cms_connections` : scope **site** (`tracked_site_id`), colonnes `platform, auth_method, status, site_url, scopes, capabilities, token_expiry, managed_by, …`. La colonne `managed_by` distingue `'user'` (UI) de `'parmenion'` (miroir auto via trigger DB depuis `parmenion_targets`).
- `parmenion_targets` : scope **domaine** (admin-pushed). Stocke `api_key_name` (token Bearer dk_/fhm_/…) + `platform` + `event_type` + `is_active`. Un trigger DB `sync_parmenion_target_to_cms_connection` crée/maintient automatiquement les miroirs `cms_connections` (managed_by='parmenion', auth_method='api_key', status='active') pour chaque tracked_site dont le domaine matche.
- `iktracker_connections` (si présente) : pont autopilote IKtracker.
- `google_connections` : scope **user uniquement** (PAS de `tracked_site_id`). Colonnes : `google_email, gsc_site_urls[], ga4_property_id, gmb_account_id, gmb_location_id, scopes, token_expiry`. Le matching « ce site est-il couvert par GSC ? » se fait en filtrant `gsc_site_urls`.
- `matomo_connections` : scope **site**, colonnes `matomo_url, site_id, is_active, last_sync_at, sync_error`
- `canva_connections` : scope **user**, colonne d'expiration = `token_expires_at`

## Données retournées (par utilisateur matché)
Pour chaque site (filtrable par `domain`) :
- Profil identifiant (user_id, prénom, nom, email, plan_type, signup)
- `connections.cms_user[]` : connexions CMS créées par l'utilisateur via l'UI
- `connections.cms_parmenion_mirror[]` : connexions miroirs créées par le trigger depuis `parmenion_targets` (admin-pushed)
- `connections.cms_count_total / _user / _parmenion`
- `connections.parmenion_targets[]` : liste brute des cibles Parménion sur ce domaine, avec `has_api_key`, `api_key_preview`, `is_active`
- `connections.parmenion_active` : booléen — true si Parménion peut pousser du contenu sur ce domaine
- `connections.google_for_this_site[]`, `matomo[]`, `iktracker_connections[]`
- `user_level_connections` : agrégat global Google + Canva du user

## Marche à suivre côté user
**Mes Sites → site → onglet Connexions → "Connecter un CMS"** → choix plateforme :
- **WordPress** : Application Password (rôle Éditeur min) ou clé REST
- **Shopify** : custom app token avec scopes `read_content, write_content, read_orders`
- **Wix / Webflow** : OAuth en un clic
- **Drupal / Odoo / PrestaShop** : Basic Auth applicatif
- **Dictadevi / IKtracker / sites internes** : géré côté admin via Dashboard Parménion (clé Bearer dk_…/ik_…) — l'utilisateur n'a rien à faire si parmenion_active=true.

Pré-requis : si `cms_platform_declared` est null, suggérer d'abord un audit (auto-détection plateforme). Gating : connexion CMS standard = Pro Agency+.

## Trigger Parménion → cms_connections (SSOT)
Migration `2026-04-27` : function `sync_parmenion_target_to_cms_connection` + trigger `trg_parmenion_to_cms_connections_iud` sur `parmenion_targets`. Index unique partiel `cms_connections_parmenion_mirror_uniq (tracked_site_id, platform) WHERE managed_by='parmenion'`. Enum `cms_platform` étendu avec `dictadevi`, `iktracker`, `custom_rest`.

## Architecture
- Fichier : `supabase/functions/copilot-orchestrator/skills/registry.ts`
- Utilise `ctx.service` (service role) car on lit des tables d'autres utilisateurs — autorisé car le check d'autorisation porte sur **le rôle admin de l'appelant**, pas sur la propriété d'un site.

## Exemples d'usage
```
/createur : l'user richard stievenard a-t-il pu connecter son cms pour le site https://sphaeragloballtd.com/ ?
/createur : dictadevi.io est-il bien relié à parménion ?
```
→ Félix appelle `admin_lookup_user({ query: "...", domain: "..." })`
→ Réponse factuelle : statut user CMS + statut miroir Parménion + clé API présence + plan + plateforme détectée + marche à suivre.
