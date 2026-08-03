---
name: Parménion Content Pruning Executor
description: Pruning réel des clusters cannibalisés — fusion vers pilier + 301 + suppression avec snapshot restaurable, cap 4/cycle
type: feature
---

# Pruning réel (fusion + 301 + suppression)

Edge function `content-pruning-executor` (déterministe, 0 LLM).

## Séquence par doublon
1. `get-post` sur le CMS → snapshot intégral dans `content_pruning_log` (HTML + payload CMS brut) — **obligatoire avant toute mutation**.
2. Fusion : les sections `<h2>/<h3>` absentes du pilier (comparaison par titre normalisé, max 4 sections) sont appendées au pilier sous le marqueur `<!-- crawlers:consolidated -->`, puis `update-post` du pilier.
3. Redirection 301 doublon → pilier (`iktracker-actions:create-redirect` ou `cms-push-redirect`).
4. `delete-post` du doublon, uniquement si 1→3 ont réussi.

## Garde-fous
- Plafond dur **4 doublons par cycle** (`PRUNING_HARD_CAP`, clampé côté Parménion et côté executor).
- Si la plateforme ne sait pas créer de 301 (Dictadevi v1) → `redirect_status='unsupported'`, `delete_status='blocked_no_redirect'`, aucune suppression (404 évité).
- Le pilier est exclu de la liste des doublons.
- `dry_run` = tout sauf mutation ; Parménion passe `dry_run = implementation_mode !== 'auto'`.
- Restauration : `{ action: 'restore', log_id }` recrée le post en `draft` depuis le snapshot.

## Câblage
- `parmenion-orchestrator` phase prescribe : tâche `fix_cannibalization` avec `execution_mode: 'pruning'`, `executor_function: 'content-pruning-executor'`, `is_destructive: true`.
- `PHASE_FUNCTIONS.execute` (`_shared/parmenion/types.ts`) inclut `content-pruning-executor` et `dictadevi-actions`.
- `autopilot-engine` : une tâche de pruning court-circuite `prepareExecuteActions` (aucun pont CMS générique, aucun fallback méta) et est exécutée par `executeContentPruning` (timeout 120 s).

## Table `content_pruning_log`
Snapshot + statuts `merge_status` / `redirect_status` / `delete_status`, `dry_run`, `restored_at`, `error_message`. RLS lecture par `user_id = auth.uid()`, écriture service_role.
