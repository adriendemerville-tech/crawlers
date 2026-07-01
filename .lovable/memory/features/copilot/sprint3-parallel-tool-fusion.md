---
name: Copilot Sprint 3 — Parallel Tool Fusion (S3.1)
description: runAgentLoopStreaming exécute en parallèle les tool_calls AUTO read/navigate; approval/write/destructive restent séquentiels; ordre tool_call_id préservé
type: feature
---

**Backend** — `supabase/functions/copilot-orchestrator/index.ts` (loop streaming) :
- Chaque batch de `tool_calls` est classé en 2 groupes via `categorizeAction` + policy :
  - **Parallèle** : `effectivePolicy=auto` ET `category ∈ {read, navigate}` ET non-inviolable → `Promise.all` avec exécution + insert `copilot_actions` en concurrence.
  - **Séquentiel** : `approval`, `write`, `destructive`, `forbidden`, `system` → même sémantique `stopForApproval` qu'avant.
- Résultats stockés par index puis poussés dans `messages` dans l'ordre original des `tool_calls` (préserve l'appariement `tool_call_id` attendu par Anthropic/OpenAI).
- Events SSE `tool_call` émis en amont dans l'ordre du batch pour rendu UI stable ; `tool_result` peut arriver hors-ordre côté client (keyer par `skill`+`action_id`).

**Loop non-streaming** (`runAgentLoop`) : inchangé (séquentiel, safe fallback si SSE indisponible).

**Gain attendu** : quand Claude 4.5 émet ≥2 tool_calls read/navigate dans un même tour (typique pour `read_site` + `read_pages` + `read_audit`), latence effective = max(t_i) au lieu de somme(t_i). Estimation −40% latence sur tours multi-read.

**Sécurité** :
- Skills destructives/write jamais parallélisées.
- `stopForApproval` toujours effectif : une approval bloque toutes les auto suivantes du batch séquentiel.
- FORBIDDEN_EVEN_IN_CREATOR reste bloquant en toutes circonstances.
