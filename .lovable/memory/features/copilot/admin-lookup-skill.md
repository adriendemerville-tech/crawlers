---
name: admin-lookup-skill
description: Skill admin_lookup_user dans copilot-orchestrator — réservée mode créateur, expose statut connexions CMS/Google/Matomo/Canva par utilisateur+site
type: feature
---

# Skill `admin_lookup_user` (mode créateur)

## Objectif
Permettre à Félix (et au Stratège, en mode créateur) de répondre aux questions support du type :
> "L'user X a-t-il pu connecter son CMS pour le site Y ?"

## Activation
- Disponible UNIQUEMENT en mode créateur (préfixe `/createur :`, `/creator :` ou `/admin :`)
- N'est listée dans `skillPolicies` d'aucune persona → `'forbidden'` par défaut
- Devient exposée via la branche `isCreatorMode ? listSkills() : ...` dans `runAgentLoop` (`copilot-orchestrator/index.ts`)
- **Defense in depth** : le handler revérifie `has_role(user_id, 'admin')` côté serveur avant toute lecture

## Données retournées
Pour chaque utilisateur matché (ILIKE first_name/last_name/email, max 10 résultats) :
- Profil : user_id, prénom, nom, email, plan_type, subscription_status, signup_date
- Sites suivis (filtrables par `domain`) avec :
  - `cms_platform_declared`, `last_cms_refresh_at`, `last_audit_at`
  - **connections.cms** : tous les enregistrements `cms_connections` (platform, auth_method, status, scopes, capabilities, dates, token_expiry)
  - **connections.google** : tous les `google_connections` (service GSC/GA4, status, scopes, token_expiry)
  - **connections.matomo** : tous les `matomo_connections`
  - **connections.canva_workspace** : `canva_connections` du user (note: scope user, pas site)

## Architecture
- Fichier : `supabase/functions/copilot-orchestrator/skills/registry.ts`
- Utilise `ctx.service` (service role) car on lit des tables d'autres utilisateurs (profiles, tracked_sites, *_connections) — c'est l'unique skill autorisée à le faire sans `safeServiceCall` car le check d'autorisation porte sur **le rôle admin de l'appelant**, pas sur la propriété d'un site.

## System prompt (Félix)
La skill est documentée dans `agentPersonas.ts` (FELIX_PERSONA.styleGuide) sous "Skills admin disponibles en mode créateur" avec consignes de présentation factuelle (4 points : identification user → statut CMS du site → connexions alternatives si pas de CMS → date dernier refresh).

## Exemple d'usage
```
/createur : l'user richard stievenard a-t-il pu connecter son cms pour le site https://sphaeragloballtd.com/ ?
```
→ Félix appelle `admin_lookup_user({ query: "stievenard", domain: "sphaeragloballtd.com" })`
→ Réponse synthétique avec statut CMS du site cible.
