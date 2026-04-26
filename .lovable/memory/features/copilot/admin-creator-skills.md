---
name: Skills admin /creator: pour Félix & Stratège
description: Commandes admin exposées via préfixe /creator: dans le copilot pour gestion sites trackés, plan, clé API
type: feature
---

# Skills admin (creator_mode)

Toutes ces skills sont disponibles dans `copilot-orchestrator` uniquement quand l'utilisateur est admin (`has_role(admin) = true`) ET préfixe son message par `/creator:`, `/createur:` ou `/admin:` (le préfixe est persisté dans `session.context.creator_mode` pour survivre aux tours suivants).

Chaque handler revérifie `has_role(admin)` côté serveur (defense in depth) — exposition seule ne suffit pas.

## Skills disponibles

| Skill | Catégorie | Description |
|---|---|---|
| `admin_lookup_user` | read | Recherche user par nom/prénom/email + sites + connexions CMS/Google/Matomo/Canva |
| `admin_list_user_sites` | read | Liste tous les sites trackés d'un user (par email) |
| `admin_track_site` | write | Ajoute manuellement un site à `tracked_sites` (idempotent) |
| `admin_untrack_site` | destructive | Retire un site du suivi (DELETE tracked_sites) |
| `admin_reset_api_key` | write | Régénère `profiles.api_key` (UUID). Invalide la clé du plugin WP / widget GTM |
| `admin_grant_pro` | write | Force `plan_type` + `subscription_status` (free / starter / agency_pro / agency_premium) |

## Exemples d'usage

```
/creator: ajoute sphaeragloballtd.com aux sites suivis de rstievenart@gmail.com
/creator: liste tous les sites de sphaeraglobal@gmail.com
/creator: passe rstievenart@gmail.com en agency_premium
/creator: regénère la clé API de demo@crawlers.fr
/creator: retire ancien-domaine.com du suivi de user@example.com
```

## Audit & traçabilité

Chaque exécution est loggée dans `copilot_actions` avec `skill`, `input`, `output`, `status`, `action_category`. Aucune table d'audit séparée — `copilot_actions` est le journal unique.

## Inviolables (FORBIDDEN_EVEN_IN_CREATOR)

Listées dans `copilot-orchestrator/index.ts` : `delete_site`, `delete_user`, `rotate_keys`, `escalate_to_human`, `mass_delete`. Ces skills restent forbidden même en mode créateur.
