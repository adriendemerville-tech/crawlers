# Parménion — Séquencement runtime (source de vérité)

Updated: 2026-07-27
Statut : document maître. Consolide `parmenion-v3-fr`, `parmenion-v2-fr` (legacy), `breathing-spiral-engine-v5-fr`, `routing-dispatch-fr`, `workbench-v2-fr`, `content-brief-fr`, `editorial-guard-parmenion-fr`, `dedup-synonym-layer-fr`, `cluster-diversity-engine-fr`, `persona-decomposition-engine-fr`, `auto-config-on-target-fr`, `parmenion-hardening-fixes-fr`, `image-originality-fr`, ainsi que `crawl/scheduler-fr` et `audits/parmenion/brief-2026-07-08.md`.

Portée : décrit **exactement** ce qui s'exécute, dans quel ordre, sur quelles tables, avec quelles gardes, pour un cycle Parménion complet.

---

## 1. Vue macro — chaîne d'appels

```
pg_cron (06:00 UTC, quotidien)
   │
   ▼
cron-autopilot-tick  ──► autopilot-engine (par site actif)
                              │
                              ├─ garde crawl-in-flight (skip si crawl en cours)
                              ├─ garde backlog (pause si >5 planned non exécutés)
                              ├─ fixe persona du cycle (rotation round-robin)
                              │
                              ▼
                     parmenion-orchestrator (phase = getNextPhase(lastPhase))
                              │
              ┌───────────────┼──────────────┬─────────────┬──────────────┐
              ▼               ▼              ▼             ▼              ▼
            audit         diagnose       prescribe       execute       validate
              │               │              │             │              │
              ▼               ▼              ▼             ▼              ▼
        audit-expert-seo  cocoon-diag-*  cocoon-        cms-push-*    autopilot-
        check-eeat                       strategist     iktracker-    validate-
        strategic-                       (plan 8        actions       deployed
        orchestrator                     tâches)        dictadevi-
        audit-                                          actions
        strategique-ia                                  wpsync
        multi-page-crawl
              │
              ▼
        architect_workbench  ◄── findings persistés (mem workbench-v2-fr)
                              │
                              ▼
                     parmenion-feedback → parmenion_decision_log
```

Phases exécutées **une par cycle** (pas les 5 d'affilée). `getNextPhase(lastPhase)` (`_shared/parmenion/types.ts`) fait tourner la roue : `audit → diagnose → prescribe → execute → validate → audit ...`. Un site parcourt donc les 5 phases en 5 cycles (≈ 5 jours à cron quotidien).

---

## 2. Entrée : `autopilot-engine`

`supabase/functions/autopilot-engine/index.ts` (1 218 lignes). Réveillé par cron pour chaque row actif de `parmenion_targets`.

### 2.1 Gardes de démarrage (avant tout appel LLM)

| Ordre | Garde | Effet si déclenchée | Mémoire de référence |
|---|---|---|---|
| 1 | Crawl en cours sur le site | Skip cycle, `status='skipped_crawl'` | `crawl/scheduler-fr` |
| 2 | Backlog > 5 décisions `planned` non exécutées | `status='paused'`, reprise manuelle | `backlog-guard-fr` |
| 3 | Config absente | Auto-création `autopilot_configs` en `dry_run` idle | `auto-config-on-target-fr` |
| 4 | Persona rotation | Sélection round-robin, persisté dans `persona_rotation_log` **pour tout le cycle** | `persona-decomposition-engine-fr` |
| 5 | Phase suivante | `getNextPhase(last_phase)` sur `parmenion_decision_log` | `_shared/parmenion/types.ts` |

### 2.2 Mode `dry_run` (v3.6)

`dry_run` bloque **uniquement** la phase `execute`. Les 4 autres phases s'exécutent normalement et alimentent le workbench.

```ts
const isDryRunBlocked = config.implementation_mode === 'dry_run' && phase === 'execute';
if (!isPrescribeV2 && !isDryRunBlocked && decision.action?.functions?.length > 0) {
  await executeFunctions(...)
}
```

### 2.3 Appel orchestrateur

`autopilot-engine` invoque `parmenion-orchestrator` avec `{ domain, tracked_site_id, phase, persona, config }`. **Note (audit 2026-07-08 #170)** : `execute` et `validate` sont chaînés dans le même thread — race condition connue (cache CMS, latence workers). Fix planifié : découpler `validate` à t+30 min.

---

## 3. `parmenion-orchestrator` — dispatch par phase

`supabase/functions/parmenion-orchestrator/index.ts` (2 467 lignes). `switch (phase)` autour de la ligne 2221.

### 3.1 Phase `audit` (ligne 2221)

**Objectif** : rafraîchir la vision du site.

Edge functions appelées (`PHASE_FUNCTIONS.audit` dans `types.ts`) :
- `audit-expert-seo` — audit SEO complet
- `check-eeat` — E-E-A-T v3
- `strategic-orchestrator` — audit stratégique
- `audit-strategique-ia` — audit GEO
- `multi-page-crawl` — re-crawl ciblé si stale

**Sortie** : findings poussés dans `architect_workbench` (statut `pending`, scoré par `spiral_score`).
**Gardes** : `anti-hallucination-gates-fr` (semantic gate).
**Statut log** : `parmenion_decision_log.pipeline_phase='audit'`.

### 3.2 Phase `diagnose` (ligne 2237)

**Objectif** : catégoriser les findings audit.

Edge functions :
- `cocoon-diag-content`
- `cocoon-diag-semantic`
- `cocoon-diag-structure`
- `cocoon-diag-authority`

**Sortie** : chaque finding gagne un `tier` (0-10, cf. `TIER_NAMES` dans `types.ts`) + `lane` (`tech` ou `content`).
Post-hook : `_shared/autopilot/postDiagnose.ts`.

### 3.3 Phase `prescribe` (ligne 2245) — cœur stratégique

**Edge function** : `cocoon-strategist` (mem `parmenion-v3-fr`).

**Modèle LLM** : Stratège = `google/gemini-3.1-pro-preview` via `aiGatewayFetch` (mem `combo-abc-allocation-fr`). Fallback Claude Sonnet 4.5 si kill switch premium activé.

**Entrée** :
- `architect_workbench` items `pending` scorés par `spiral_score`
- `SiteInfo` (secteur, audience, produits/services, `content_priority_mode`)
- Persona du cycle (fixe)
- `ContentBrief` déterministe pré-LLM (mem `content-brief-fr`) : `page_type`, `tone`, `angle`, `CTA`, liens internes, keywords, schema

**Sortie** : `StrategistPlanOutput` (types.ts) — **8 tâches** structurées :

```ts
interface StrategistExecutorTask {
  id, action_type, executor_function, // ← résolu déterministe
  title, description,
  urgency: 'critical'|'high'|'medium'|'low',
  priority_score: 0-100,
  affected_urls, depends_on,
  execution_mode: 'content_architect'|'code_architect'|'operational_queue',
  is_destructive, estimated_impact, payload, metadata
}
```

**Gardes appliqués DANS le stratège** :

| Garde | Rôle | Mem |
|---|---|---|
| Cluster diversity (SQL cap 2 items/cluster) | Force rotation topics | `cluster-diversity-engine-fr` |
| Persona decomposition | Décompose `target_audience` en personas, alterne | `persona-decomposition-engine-fr` |
| Dedup Layer E (Jaccard synonym-aware) | Bloque contenus proches < 0.5 vs existant | `dedup-synonym-layer-fr` |
| Saturation guard (Layer D) | Bloque si cluster saturé | `dedup-synonym-layer-fr` |
| Anti-cannibalisation | Vérifie titre + intent vs `keyword_universe` | `anti-cannibalization-logic-fr` |
| Editorial guard | Ton, angle, format | `editorial-guard-parmenion-fr` |
| `content_priority_mode` ×1.8 | Boost tâches contenu vs tech si activé | `parmenion-v3-fr` |

**Persistance** : `strategist_recommendations` (plan complet) + `parmenion_decision_log` (résumé).

**Audit 2026-07-08 #171** : bug connu — l'orchestrateur **n'exécute que la tâche #1** du plan de 8. Les 7 autres sont persistées mais dorment. Fix planifié : Execute traite les tâches en attente avant re-prescription.

### 3.4 Phase `execute` (ligne 2248)

**Bloquée si `dry_run`**. Sinon route via `_shared/autopilot/cmsActionRouter.ts` :

| `execution_mode` | `executor_function` (fn `resolveExecutorFunction`) | Cible |
|---|---|---|
| `content_architect` | `content-architecture-advisor` | Brief détaillé → pipeline éditoriale 4-étages |
| `code_architect` | `generate-corrective-code` | Injection HTML/JSON-LD |
| `operational_queue` + `add_internal_link` | `iktracker-actions` (IKtracker) ou `cms-push-code` | Maillage |
| `operational_queue` + `fix_redirect_chain` | `cms-push-redirect` | 301 |
| `operational_queue` + `publish_draft` | `iktracker-actions` ou `cms-push-draft` | Publication brouillon |
| Fallback | `iktracker-actions` (si domaine IKtracker) ou `cms-push-code` | — |

**Routing par domaine** (mem `routing-dispatch-fr`) :
- `iktracker.fr` → `iktracker-actions` (bridge v4, slug memory)
- `dictadevi.io` → `dictadevi-actions` (garde Markdown→HTML via `marked@12`)
- Autres CMS → `wpsync` / `cms-push-*` / `cms-patch-content`

**Post-hook** : `_shared/autopilot/postExecute.ts` — met à jour `parmenion_decision_log.status`, sémaphore Browserless (mem `browserless/timeout-and-semaphore-fix-fr`).

### 3.5 Phase `validate` (ligne 2251)

**Edge function** : `autopilot-validate-deployed` (308 lignes).

Re-crawle l'URL déployée, vérifie :
- Contenu présent dans le HTML final (post-cache CMS)
- JSON-LD injecté correctement
- Meta title/description alignés

Feed `parmenion-feedback` → `parmenion_decision_log.validation_status` (`confirmed` / `missing` / `partial`).

---

## 4. Tables touchées (résumé)

| Table | Rôle | Écrite par |
|---|---|---|
| `parmenion_targets` | Sites Autopilot actifs | Admin UI |
| `autopilot_configs` | Mode (dry_run/auto/review), phase enablement | Trigger auto-config + admin |
| `parmenion_decision_log` | 1 row / phase / cycle | orchestrator + engine |
| `architect_workbench` | Findings scorés (SSOT) | phase audit + diagnose |
| `strategist_recommendations` | Plan 8 tâches | phase prescribe |
| `persona_rotation_log` | Persona du cycle | engine (start) |
| `saturation_snapshots` | Cluster/topic saturation weekly | cron saturation |
| `autopilot_modification_log` | Push CMS effectifs | phase execute |
| `cocoon_auto_links` | Ancres proposées (3 variants) | phase prescribe (maillage) |
| `keyword_universe` | SSOT keywords/intent | phase audit + crawl |
| `ai_gateway_usage` | Coût LLM par phase | wrapper `aiGatewayFetch` |

---

## 5. Modèles LLM par phase

| Phase | Fonction | Modèle primaire | Fallback |
|---|---|---|---|
| audit | `audit-strategique-ia` | `google/gemini-3.1-flash-lite` | Sonar |
| diagnose | `cocoon-diag-*` | `google/gemini-3-flash-preview` | Haiku 4.5 |
| prescribe (stratège) | `cocoon-strategist` | `google/gemini-3.1-pro-preview` | Sonnet 4.5 |
| execute (writer contenu) | `content-architecture-advisor` | `anthropic/claude-sonnet-4.5` | GPT-5.4 |
| execute (tonalizer) | pipeline 4-étages | `google/gemini-3.5-flash` (ou Groq override) | Sonnet 4.5 |
| execute (code) | `generate-corrective-code` | `openai/gpt-5.4` | Sonnet 4.5 |
| validate | `autopilot-validate-deployed` | pas de LLM (parsing HTML) | — |

Kill switch admin : `ai_routing_global_flags.disable_premium` fait sauter Sonnet 4.5 / GPT-5.4 / Gemini 3.1 Pro (mem `combo-abc-allocation-fr`).

---

## 6. Statuts `parmenion_decision_log.status`

| Statut | Signification |
|---|---|
| `completed` | Phase OK, findings/tâches persistés |
| `dry_run` | Uniquement en phase `execute` (mode dry_run) |
| `skipped_crawl` | Crawl en cours, cycle sauté |
| `paused` | Backlog guard déclenché |
| `degraded` | Phase partielle (une fn sur N a échoué) |
| `partial` | Phase incomplète volontairement |
| `failed` | Erreur bloquante |
| `planned` | Décision créée, pas encore exécutée (Execute) |

---

## 7. Cycle type — timeline

Cron 06:00 → engine tire un site → garde crawl (100 ms) → garde backlog (SQL 200 ms) → persona rotation (SQL 100 ms) → dispatch orchestrateur :

| Phase | Durée p50 | Durée p95 | Coût LLM p50 |
|---|---|---|---|
| audit | 60-90 s | 180 s | ~1¢ |
| diagnose | 30-60 s | 120 s | ~0.5¢ |
| prescribe | 90-180 s | 300 s | ~3-5¢ (Gemini 3.1 Pro + cache) |
| execute | 60-240 s | 500 s | ~5-15¢ (writer Sonnet 4.5) |
| validate | 30-60 s | 120 s | 0 (parsing) |

Cible : cycle < 5 min p95. **Risque connu (audit #173)** : chaîne execute+validate dans le même thread peut dépasser 300 s (timeout Edge Function).

---

## 8. Findings d'audit ouverts (à traiter)

Source : `knowledge/audits/parmenion/audit-2026-07-08.md`.

| # | Prio | Sujet | Fix |
|---|---|---|---|
| #170 | P0 | Race condition Execute↔Validate | Découpler validate à t+30 min ou t+1 cycle |
| #169 | P1 | Propagation aveugle après skip Audit | Interrompre cycle si audit skipped |
| #171 | P1 | Évaporation tâches 2-8 du plan | Execute traite pending avant re-prescribe |
| #174 | P1 | Backlog guard n'attrape pas les échecs boucle | `retry_count`, bascule `failed` après 3 |
| #176 | P1 | Faiblesse isolation domaine ↔ site_id | Guard d'intégrité au démarrage |
| #172 | P2 | Collision multi-target `ilike('domain')` | Tuple exact `(domain, tracked_site_id)` |
| #173 | P2 | Risque timeout Lambda cycles Sonnet 4.5 | File d'attente async ou timeout par phase |
| #175 | P2 | Instabilité persona rotation multi-phase | Fixer persona au niveau engine (déjà partiellement fait) |

---

## 9. Points d'entrée code — index rapide

| Fichier | Rôle |
|---|---|
| `supabase/functions/autopilot-engine/index.ts` (1 218 l.) | Entrée cron, gardes, dispatch phase |
| `supabase/functions/parmenion-orchestrator/index.ts` (2 467 l.) | Switch phases (ligne 2221) |
| `supabase/functions/parmenion-feedback/index.ts` (227 l.) | Feedback → decision_log + workbench |
| `supabase/functions/parmenion-api/index.ts` (184 l.) | Pull API pour SDK `@parmenion/sdk` |
| `supabase/functions/autopilot-validate-deployed/index.ts` (308 l.) | Re-crawl validation |
| `_shared/parmenion/types.ts` | `PIPELINE_PHASES`, `PHASE_FUNCTIONS`, `resolveExecutorFunction`, `getNextPhase` |
| `_shared/parmenion/prompts.ts` | Prompts stratège |
| `_shared/parmenion/personaEngine.ts` | Décomposition + rotation |
| `_shared/parmenion/keywordEnrichment.ts` | Enrichissement keywords pré-LLM |
| `_shared/parmenion/imageOriginality.ts` | NO_TEXT_GUARD génération images |
| `_shared/autopilot/cmsActionRouter.ts` | Routing execute → CMS |
| `_shared/autopilot/postDiagnose.ts` / `postExecute.ts` | Post-hooks phase |
| `_shared/autopilot/semanticGate.ts` | Anti-hallucination gates |

---

## 10. Ce que Parménion **ne fait pas**

- Pas de rollback : une décision `failed` reste dans le log, elle n'annule pas les précédentes.
- Pas de A/B testing automatique.
- Pas d'exécution parallèle multi-phase sur un même site.
- Pas de génération d'images en dehors de `image-originality-fr` (NO_TEXT_GUARD).
- Pas de push CMS en mode `dry_run` (mais toutes les autres phases tournent, cf. §2.2).
