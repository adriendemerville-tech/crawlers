---
name: Parménion — correctifs audit 2026-08-11 (P0/P1)
description: Garde skip audit (sources réelles + cooldown 24h), coût LLM loggé dans ai_gateway_usage, prescriptions tracées dans architect_workbench, error_category renseignée
type: feature
---
Correctifs issus de `knowledge/audits/parmenion/audit-2026-08-11.md` :

- **P0-1 skip audit** : la garde ciblait `source_function='agent-seo'` (valeur jamais écrite) → boucle audit horaire. Elle cible désormais `audit-expert-seo, expert-audit, audit-strategique-ia, check-eeat, check-geo, cocoon-strategist, marina` (< 5 j) **et** un cooldown 24 h sur toute décision audit déjà tentée (`completed/degraded/partial/skipped_stale/failed`).
- **P0-2 coût LLM** : `logAIUsageFromResponse` appelé sur chaque réponse dans `parmenion-orchestrator` (`edge_function='parmenion-orchestrator'`) et dans `_shared/parmenion/llmClient.ts` (`edge_function='parmenion-llmClient'`).
- **P0-3 traçabilité** : `_shared/parmenion/prescriptionWorkbench.ts` upsert les 8 tâches prescrites dans `architect_workbench` avec `source_type='proactive_scan'`, `source_function='parmenion-orchestrator'`, clé `parmenion_{domain}_c{cycle}_{taskId}`.
- **P1-1 taxonomie** : `categorizePhaseErrors` (`_shared/autopilot/types.ts`) renseigne `error_category` (`timeout, http_5xx, cms_4xx, guard_block, llm_failure, unknown`) sur `parmenion_decision_log`.
