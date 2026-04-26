---
name: Copilot — Escalade téléphone & sav_quality_scores (Bloc 3)
description: Sprint Q5 Bloc 3 — skill escalate_to_phone (approval) crée/met à jour une sav_conversation shadow. Scoring auto par tour assistant_reply via scoring.ts upsert dans sav_quality_scores legacy (réutilisé pour le SAV Dashboard admin sans changement).
type: feature
---

# Bloc 3 — Escalade téléphone & sav_quality_scores

## Skill `escalate_to_phone`
- Politique : `approval` (Félix + Stratège). L'agent propose, l'utilisateur confirme via `approve(actionId)`.
- Inputs : `phone` (E.164 préféré), `reason` (1 phrase), `urgency` ∈ `low|normal|high` (défaut `normal`).
- Effet : crée/maj une `sav_conversations` "shadow" liée au `copilot_session` via `copilot_sessions.context.sav_conversation_id` → le SAV Dashboard admin liste l'escalade comme avant.
- Ownership : insertion via service client mais `user_id` = caller.

## Scoring automatique (`scoring.ts`)
Appelé après chaque `_assistant_reply` persisté dans l'orchestrator.

Heuristique (portée du legacy sav-agent) :
- `precision_score` part de 50.
- `+20` si résolu en ≤ 2 messages user.
- `-20 × repeated_intent_count` (mots-clés répétés ≥ 3 sur les 5 derniers msgs user).
- `-50` si une `escalate_to_phone` success existe sur la session.
- Bornes 0–100.

Champs upsert dans `sav_quality_scores` :
- `conversation_id` = sav_conversation shadow (créée à la volée si absente).
- `precision_score`, `message_count`, `repeated_intent_count`, `escalated_to_phone`.
- `detected_intent` ∈ `navigation|score|billing|bug|feature|cms|general`.
- `intent_keywords` (max 10, stop-words FR filtrés).
- `suggested_route` = 1er lien interne extrait de la réponse (URL crawlers.fr ou markdown `](/path)`).

## Garanties
- Best-effort : un échec scoring ne casse jamais la conversation (try/catch avec console.warn).
- Pas de doublon : 1 ligne `sav_quality_scores` par `conversation_id` (lookup + update sinon insert).
- RLS-safe : reads via service client mais filtrés par `user_id` quand pertinent.

## Files
- `supabase/functions/copilot-orchestrator/skills/registry.ts` — skill `escalate_to_phone`.
- `supabase/functions/copilot-orchestrator/scoring.ts` — `recordTurnQualityScore`.
- `supabase/functions/copilot-orchestrator/index.ts` — appel après persistance assistant_reply.
- `supabase/functions/copilot-orchestrator/personas.ts` — policies `escalate_to_phone: 'approval'`.
- `supabase/functions/_shared/agentPersonas.ts` — instructions persona Félix + Stratège.
