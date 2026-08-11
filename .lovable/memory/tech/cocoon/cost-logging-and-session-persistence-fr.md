---
name: Cocoon P1 — logging coût & persistance session
description: aiGatewayFetch/aiGatewayCall loggent dans ai_gateway_usage via callerFunction ; persist-cocoon-session appelée après calculate-cocoon-logic
type: feature
---

Correctifs P1 de l'audit Cocoon 2026-08-10.

## Logging du coût LLM (H3)
- `_shared/aiGatewayFetch.ts` : chaque appel non-streaming réussi (OpenRouter ou sauvetage Lovable) insère une ligne dans `ai_gateway_usage` via REST service-role, fire-and-forget (`withUsageLog` + `logGatewayUsage`), coût estimé par `estimateTokenCostUsd`.
- Nouvelle option `callerFunction` sur `aiGatewayCall` et `aiGatewayFetch` → colonne `edge_function` (défaut `unknown`).
- Renseignée dans `cocoon-chat`, `cocoon-diag-subdomains`, `cocoon-deploy-links` (via `callLovableAI`).
- `cocoon-strategist` est déterministe : aucun appel LLM à instrumenter.

## Persistance des sessions (H4)
- `src/pages/Cocoon.tsx` appelle `persist-cocoon-session` après `calculate-cocoon-logic` + PageRank, en fire-and-forget, ce qui alimente `cocoon_sessions` et les colonnes de re-mesure d'impact.
