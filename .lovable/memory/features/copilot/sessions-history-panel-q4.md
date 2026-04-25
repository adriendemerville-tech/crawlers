---
name: Copilot — Panneau historique sessions (Q4.4)
description: useCopilot hydrate l'historique depuis copilot_actions (_user_message/_assistant_reply) quand initialSessionId est fourni. CopilotHistoryPanel liste les copilot_sessions par persona et permet la reprise via key remount + initialSessionId.
type: feature
---

# Historique des sessions copilote (Sprint Q4.4)

## Mécanisme
- `useCopilot({ initialSessionId })` déclenche un effet qui SELECT les `copilot_actions` de la session filtrées sur `skill IN ('_user_message','_assistant_reply')`, ordonnées `created_at ASC`.
- Les rows sont mappées en `CopilotMessage` (`input.message` pour user, `output.reply` pour assistant).
- Le shell `AgentChatShell` accepte `initialSessionId` et le propage à `useCopilot`.
- Pour reprendre une session : le parent maintient `pickedSessionId` + un `shellKey` incrémenté, et passe `key={shellKey}` au shell pour forcer un remount propre.

## CopilotHistoryPanel
- Composant générique paramétré par `persona`.
- Liste 20 dernières `copilot_sessions` (ordre `last_message_at DESC`).
- Bouton "Nouvelle" → `onNewSession` (parent reset `pickedSessionId=null` + bump key).
- Désactive la session courante (`isCurrent`).

## Intégration actuelle
- ✅ Félix : bouton History dans le header de `ChatWindowUnified`.
- ⏳ Stratège : à brancher sur le même pattern dans `CocoonAIChatUnified` (composant prêt, persona `strategist`).
