---
name: Stratège Cocoon — Skills restaurés post-refacto
description: 3 skills wrappers (analyze_cocoon, plan_editorial, deploy_cocoon_plan) reconnectent le Copilot Stratège aux edge functions cocoon-strategist + cocoon-deploy-links
type: feature
---

## Contexte
La refacto Copilot unifié (`copilot-orchestrator`) avait laissé orphelines 3 capacités déclarées dans `personas.ts` mais absentes de `skills/registry.ts` (fallback `forbidden`). Le Stratège ne pouvait plus générer de plan ni déclencher de déploiement de liens.

## Skills ajoutés (registry.ts)

### `analyze_cocoon` (auto)
Wrapper sur `cocoon-strategist` en mode diagnostic seul (`content_priority_mode: false`). Renvoie findings top 10, axes, summary. Lecture seule.

### `plan_editorial` (auto)
Wrapper sur `cocoon-strategist` avec `task_budget` (1-12, défaut 8) et `content_priority_mode` (défaut true → boost x1.8 création contenu). Persiste les tâches typées en base. Renvoie une directive UI `navigate` vers `/app/cocoon?tab=plan&site=…` que `AgentChatShell.handleActions` exécute automatiquement.

### `deploy_cocoon_plan` (approval)
Wrapper sur `cocoon-deploy-links` (injection 3 tiers : wrap direct → context sentence → phrase-pont IA Gemini Flash Lite). Max 50 recommandations/lot. Mode `preview` ou `deploy`. Approbation utilisateur obligatoire (boutons Valider/Refuser dans le chat).

## Sécurité
- Tous les wrappers passent par `ctx.supabase` (client RLS de l'utilisateur) → `cocoon-strategist` et `cocoon-deploy-links` valident la propriété du `tracked_site_id` côté serveur (verifyInjectionOwnership pour deploy).
- Pas d'usage du service role dans ces wrappers.

## Comportement UI
- `analyze_cocoon` / `plan_editorial` : exécution silencieuse, résultat inline dans la réponse.
- `plan_editorial` : redirige automatiquement vers le Plan de tâches via `ui_action.action='navigate'`.
- `deploy_cocoon_plan` : statut `awaiting_approval` → `AgentChatShell` affiche un bouton **Valider** (skill, input visibles). L'utilisateur peut Refuser via `useCopilot.reject(actionId, reason?)`.
