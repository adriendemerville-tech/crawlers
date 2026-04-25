---
name: SavDashboard — vue Copilot Félix (Q4.6)
description: Admin/SavDashboard affiche désormais CopilotSessionsCard (copilot_sessions + copilot_actions persona=felix) à côté du legacy sav_conversations. Migration progressive — legacy conservé pour escalades phone et sav_quality_scores.
type: feature
---

# SavDashboard — Migration vers copilot_* (Sprint Q4.6)

## Architecture
- Source nouvelle : `copilot_sessions` + `copilot_actions` (architecture 1 backend / N personas).
- Source legacy conservée : `sav_conversations`, `sav_quality_scores`, `churn_feedback`.
- Coexistence assumée le temps de porter les escalades phone et le scoring qualité.

## Composants
- `src/components/Admin/CopilotSessionsCard.tsx` (nouveau)
  - Liste 50 dernières `copilot_sessions WHERE persona='felix'`.
  - Dépliage par session → fetch lazy des `copilot_actions` filtrées sur `skill IN ('_user_message','_assistant_reply')`.
  - Mapping : `input.message` (user) / `output.reply` (assistant).
  - KPIs header : total / aujourd'hui / sessions `status='processing'`.
- `src/components/Admin/SavDashboard.tsx` : import + insertion entre la carte Quality Scoring et la carte legacy "Registre conversations".

## Points conservés
- Stats top (4 chiffres) : sav_conversations.
- Quality scoring 7 jours : sav_quality_scores (pas encore porté).
- Churn feedback : table churn_feedback.

## TODO résiduels (sprints dédiés)
- Porter `escalate_to_phone` comme skill `approval` (copilot_orchestrator).
- Brancher le scoring qualité sur copilot_actions (post-reply hook).
- Une fois fait : déprécier `sav_conversations` côté admin.
