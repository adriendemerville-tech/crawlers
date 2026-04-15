---
name: Parmenion v3
description: Parmenion Autopilot orchestration, pipeline phases, and audit enrichment
type: feature
---
## Parménion v3 — Orchestrateur Breathing Spiral (post-fix 2026-04-15)

### Vue d'ensemble
Parménion (v3) est l'unique macro-orchestrateur de la **Breathing Spiral**, capable de piloter le cycle complet (Audit → Diagnostic → Prescription → Exécution → Validation). Il utilise le `spiral_score` pour prioriser les actions et un dual-lane scoring (tech + contenu) avec budget partagé configurable.

### Phase AUDIT enrichie (v3.3 — 2026-04-15)

**Problème racine** : Parmenion n'appelait que `audit-expert-seo` en phase audit, produisant un diagnostic mono-dimensionnel. Résultat : contenus répétitifs, pas de vision marché, pas de mots-clés quick-win.

**Correction** : La phase audit lance désormais **3 fonctions en parallèle** :
1. `audit-expert-seo` — Audit technique pur (performance, indexabilité, erreurs)
2. `strategic-orchestrator` — Audit stratégique GEO complet (mots-clés, quick wins, concurrents, SERP)
3. `check-eeat` — Évaluation E-E-A-T (expertise, autorité, fiabilité)

**Fichiers modifiés** :
- `_shared/parmenion/types.ts` — `PHASE_FUNCTIONS.audit` inclut `strategic-orchestrator`
- `parmenion-orchestrator/index.ts` — Prompt audit demande les 3 fonctions, fallback les 3
- `autopilot-engine/index.ts` — Mapping payload spécifique pour `strategic-orchestrator` (sync) et `check-eeat`

### FIX critique v3.2 (2026-04-12) — 6 corrections
(inchangé — voir historique)

### Limites
- Max 10 actions CMS par cycle
- Max 4 tool calls par prompt LLM
- 2 prompts LLM max par micro-cycle (technique + contenu)
- 8 items max scorés par cycle (répartis entre les 2 lanes)
- Polling async : 90s max, intervalle 5s
- Watchdog cycle : 8.5 minutes max

### Retry LLM (v3.1)
callLLMWithTools utilise 3 tentatives :
1. Modèle principal + `tool_choice: 'required'` (temp 0.2)
2. Même modèle + `tool_choice: 'auto'` (temp 0.3)
3. Fallback `gemini-2.5-flash` + `tool_choice: 'required'` (temp 0.3)

### Exécution CMS par plateforme
- **IKtracker** : exécution complète (CRUD articles/pages, meta, code, redirections)
- **WordPress/Shopify** : partiel (cms-push-draft, cms-patch-content, cms-push-code)
- **Wix/Webflow** : lecture seule (audit/diagnostic uniquement)
