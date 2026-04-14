# Memory: tech/agents/fantomas-god-mode-fr
Updated: 2026-04-14

## Mode Fantomas (God Mode Créateur)

Le mode Fantomas est un mode d'administration caché dans Félix qui permet au créateur de dispatcher des directives critiques vers tous les agents sans préfixe.

### Activation
- Taper "fantomas" (avec ou sans guillemets) dans le chat Félix
- Requiert le rôle admin (vérifié côté serveur)
- Affiche un indicateur visuel "⚡ CREATOR MODE" au-dessus de l'input
- Le placeholder change en "⚡ Directive Creator..."

### Fonctionnement
1. Chaque message envoyé en mode Fantomas est analysé par un LLM (Gemini Flash Lite) pour déterminer les agents cibles
2. Les agents disponibles : SEO, CTO, UX, Supervisor
3. Les directives sont créées dans les tables `agent_*_directives` avec statut `pending`
4. Le dispatch est déclenché immédiatement (fire-and-forget vers `dispatch-agent-directives`)
5. Félix retourne un résumé structuré : agents ciblés, cible URL/fonction/composant

### Sécurité
- Vérification admin côté serveur via `has_role(user_id, 'admin')`
- Le flag `fantomas_mode: true` est envoyé dans le body de sav-agent
- Si l'utilisateur n'est pas admin, le flag est ignoré
- Pas de persistence du mode (mémoire uniquement, pas de localStorage)

### Timeout
- Désactivation automatique après 10 minutes d'inactivité
- Chaque message envoyé reset le timer
- Désactivation manuelle : retaper "fantomas" ou cliquer sur le badge

### Validation manuelle
- Les agents proposent des corrections via `cto_code_proposals` (dry-run)
- Les opérations destructives (DDL, migrations) restent sous validation manuelle
- Le déploiement passe par `deploy-code-proposal` après approbation admin
