---
name: Parmenion v3
description: Parmenion Autopilot orchestration, pipeline phases, and audit enrichment
type: feature
---
## Parménion v3 — Orchestrateur Breathing Spiral (post-fix 2026-04-27)

### Vue d'ensemble
Parménion (v3) est l'unique macro-orchestrateur de la **Breathing Spiral**, capable de piloter le cycle complet (Audit → Diagnostic → Prescription → Exécution → Validation). Il utilise le `spiral_score` pour prioriser les actions et un dual-lane scoring (tech + contenu) avec budget partagé configurable.

### Périmètre du mode dry_run (v3.6 — 2026-04-27)

**Problème racine** : `implementation_mode='dry_run'` court-circuitait **toutes les phases** (audit, diagnose, prescribe, validate), pas seulement le push CMS. Conséquence : 30 cycles "verts" sur dictadevi.io sans aucun audit réel ni alimentation du workbench.

**Correction** : `dry_run` ne bloque désormais **que la phase `execute`** (push CMS).

| Phase | dry_run avant | dry_run après |
|---|---|---|
| audit | ❌ skip | ✅ exécutée |
| diagnose | ❌ skip | ✅ exécutée |
| prescribe | ❌ skip | ✅ exécutée (workbench alimenté) |
| **execute** | ❌ skip | ❌ **skip (inchangé)** |
| validate | ❌ skip | ✅ exécutée |

**Logique** (`autopilot-engine/index.ts` ~ligne 248) :
```ts
const isDryRunBlocked = config.implementation_mode === 'dry_run' && phase === 'execute';
if (!isPrescribeV2 && !isDryRunBlocked && decision.action?.functions?.length > 0) {
  await executeFunctions(...)
}
```

Le statut `'dry_run'` dans `parmenion_decision_log.status` n'est désormais émis que pour la phase `execute`. Les autres phases reflètent leur exécution réelle (`completed`, `degraded`, `failed`).

### Onglet "Exécution" (admin Parménion, v3.6)

`src/components/Admin/ParmenionExecutionStatus.tsx` — onglet par défaut du dashboard. Pour chaque site branché :
- Mode actuel (Dry-run / Auto / Review) avec rappel de ce qui est bloqué
- Numéro du dernier cycle + total cycles + horodatage
- Pipeline visuel 5 chips (audit/diagnose/prescribe/execute/validate) avec statut réel par phase au dernier cycle
- Note pédagogique sous les sites en dry_run



### Pré-score déterministe (v3.5 — 2026-04-15)

Parménion appelle `computeSeoScoreV2` (import `_shared/seoScoringV2.ts`) en phases **audit** et **prescribe** pour obtenir un score baseline de la homepage du domaine **avant** les audits LLM coûteux. Ce score (0-100, 7 axes) est :
- Injecté dans le prompt LLM comme contexte `## SCORE SEO BASELINE`
- Retourné dans la réponse JSON (`baseline_seo_score`)
- Calculé en ~5ms, 0 token LLM, avec les `customKeywords` du `keyword_universe` du site
- Non-bloquant : si le fetch échoue (timeout 8s), le pipeline continue sans score

### Skip-Audit intelligent (v3.4 — 2026-04-15)

**Problème racine** : Parménion et Agent SEO utilisaient les mêmes fonctions d'audit (`audit-expert-seo`, `check-eeat`), doublant les appels LLM sans valeur ajoutée.

**Correction Option A** : Parménion détecte les items workbench `source_function='agent-seo'` de moins de 24h en phase audit. S'il en trouve, il **saute directement en prescribe** sans ré-auditer.

**Logique** :
- Phase `audit` → Query `architect_workbench` WHERE `source_function='agent-seo'` AND `status IN ('pending','in_progress')` AND `created_at > now() - 24h`
- Si ≥1 résultat → `currentPhase = 'prescribe'`
- Sinon → audit normal (3 fonctions en parallèle)

### Agent SEO enrichi (v3.4)
Agent SEO lance désormais **3 fonctions en parallèle** (comme Parménion) :
1. `audit-expert-seo` — Audit technique
2. `check-eeat` — Évaluation E-E-A-T
3. `strategic-orchestrator` — Audit stratégique GEO (mots-clés, quick wins, concurrents, SERP)

Les résultats stratégiques (quick wins, gaps, concurrents) sont injectés dans le contexte LLM de l'Agent SEO.

### Phase AUDIT enrichie (v3.3 — 2026-04-15)

**Problème racine** : Parmenion n'appelait que `audit-expert-seo` en phase audit, produisant un diagnostic mono-dimensionnel. Résultat : contenus répétitifs, pas de vision marché, pas de mots-clés quick-win.

**Correction** : La phase audit lance désormais **3 fonctions en parallèle** :
1. `audit-expert-seo` — Audit technique pur (performance, indexabilité, erreurs)
2. `strategic-orchestrator` — Audit stratégique GEO complet (mots-clés, quick wins, concurrents, SERP)
3. `check-eeat` — Évaluation E-E-A-T (expertise, autorité, fiabilité)

**Fichiers modifiés** :
- `_shared/parmenion/types.ts` — `PHASE_FUNCTIONS.audit` inclut `strategic-orchestrator`
- `parmenion-orchestrator/index.ts` — Prompt audit demande les 3 fonctions, fallback les 3 + skip-audit logic
- `autopilot-engine/index.ts` — Mapping payload spécifique pour `strategic-orchestrator` (sync) et `check-eeat`
- `agent-seo/index.ts` — Appelle `strategic-orchestrator` en parallèle avec les 2 autres audits

### Droits CMS interne crawlers.fr

| Agent | blog_articles | seo_page_drafts |
|---|---|---|
| **Parménion** | CRUD (via cms-publish-draft + cms-patch-content) | CRUD (via cms-publish-draft) |
| **Agent SEO** | SELECT only | INSERT (landings) |
| **generate-blog-from-news** | INSERT (articles auto) | — |

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
