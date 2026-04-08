# Memory: tech/autopilot/parmenion-v2-fr
Updated: 2026-04-01

## Autopilote Parménion v2 — Architecture complète (Dual-Lane)

### Vue d'ensemble

L'Autopilote suit un double cycle avec **deux pipelines parallèles** (tech + contenu) :
- **Macro-cycle** : rotation à travers la Pyramide de priorité (11 tiers)
- **Micro-cycle** : pipeline de 6 phases par itération
- **Dual-Lane** : tech et contenu scorés et exécutés **indépendamment**

```
┌─ DUAL-LANE SCORING (tech ∥ contenu)
│  Lane TECH : tiers 0-4 (accessibility → meta_tags)
│  Lane CONTENT : tiers 5-10 (content → expansion)
│  Budget partagé : 70% tech / 30% contenu (configurable)
│
│  ┌─ MICRO-CYCLE (Parménion)
│  │
│  │  1. AUDIT      → audit-expert-seo (exécution dans l'engine)
│  │
│  │  2. DIAGNOSE   → cocoon-diag-* (exécution dans l'engine)
│  │                  + ♻️ recyclage des items workbench consommés >24h
│  │
│  │  3. PRESCRIBE  → 2 prompts LLM parallèles dans l'orchestrateur :
│  │                   • Lot TECHNIQUE (lane tech) → emit_code + emit_corrective_data
│  │                   • Lot CONTENU (lane content) → emit_corrective_content + emit_editorial_content
│  │                   (max 4 tool calls par prompt)
│  │                   ⚠️ PAS d'exécution de fonctions (V2 produit directement le contenu)
│  │                   Les cms_actions et fixes sont stockés dans le payload
│  │
│  │  4. ROUTE      → inline, dispatch automatique par canal (dans l'engine)
│  │
│  │  5. EXECUTE    → iktracker-actions / cms-push-draft / cms-patch-content / generate-corrective-code
│  │                   Les CMS actions de prescribe V2 sont injectées dans cette phase
│  │                   Max 10 actions CMS par cycle
│  │
│  │  6. VALIDATE   → vérification post-déploiement
│  └─
└─

### Pyramide de priorité (11 tiers)

| Tier | Nom | Type | Lane |
|------|-----|------|------|
| 0 | Accessibilité | Technique | tech |
| 1 | Performance | Technique | tech |
| 2 | Crawl mineur | Technique | tech |
| 3 | Données GEO | Technique | tech |
| 4 | On-page mineur | Technique | tech |
| 5 | On-page majeur | Contenu | content |
| 6 | Maillage | Contenu | content |
| 7 | Cannibalisation | Contenu | content |
| 8 | Gap/Modification | Contenu | content |
| 9 | Gap/Création | Contenu | content |
| 10 | Expansion | Contenu | content |

### FIX critique v2.2 (2026-04-01)

**Problème racine** : Parménion ne publiait aucun article sur IKtracker malgré 71 cycles.
- `content-architecture-advisor` échouait avec "Failed to create async job" car `user.id = 'service-role'` n'est pas un UUID valide pour la colonne `async_jobs.user_id`
- L'engine exécutait les fonctions pendant la phase `prescribe`, alors que Prescribe V2 produit déjà le contenu via tool calls LLM. Résultat : appel redondant à `content-architecture-advisor` → crash → pipeline bloqué.

**Corrections appliquées** :
1. `autopilot-engine` : la phase `prescribe` avec V2 (`_prescribe_v2: true`) ne déclenche plus d'exécution de fonctions. Les `cms_actions` et `fixes` sont stockés dans le payload et injectés dans la phase `execute`.
2. `content-architecture-advisor` : les appels service role utilisent maintenant le `user_id` réel depuis le body de la requête, avec fallback sur un admin.
3. `autopilot-engine` : passe `config.user_id` dans les appels à `content-architecture-advisor`.

### Gate progressif (v2)
- Tiers 5-6 : bloqués si score tech < `gate_threshold_low` (défaut: 50)
- Tiers 7+ : bloqués si score tech < `gate_threshold_high` (défaut: 70)
- Gate malus : -300 (tiers 5-6) ou -500 (tiers 7+)
- `force_content_cycle` = true → bypass total du gate (one-shot)
- Seuils configurables par site dans `autopilot_configs`

### Budget partagé (Option A)
- Chaque cycle alloue N slots tech + M slots contenu
- Par défaut : 70% tech / 30% contenu → sur 8 slots = 6 tech + 2 contenu
- Configurable via `content_budget_pct` (0-100) dans `autopilot_configs`
- Si `force_content_cycle` = true → 100% contenu (0 tech)

### Dual-Lane Scoring — Filtrage par consommation (FIX v2.1)
- `score_workbench_priority()` filtre les items **par lane** :
  - Lane `tech` → exclut seulement les items avec `consumed_by_code = true`
  - Lane `content` → exclut seulement les items avec `consumed_by_content = true`
  - Lane `all` → exclut seulement si `consumed_by_code = true AND consumed_by_content = true`

### Recyclage du workbench (FIX v2.1)
- Après chaque phase `diagnose`, l'engine recycle les items `in_progress` consommés depuis >24h
- Reset : `status = 'pending'`, `consumed_by_code = false`, `consumed_by_content = false`
- Garantit que le workbench n'est jamais définitivement vidé

### Item synthétique pour force_content (FIX v2.1)
- Si le workbench est vide mais `force_content_cycle` ou `force_iktracker_article` est actif
- L'orchestrateur crée un item synthétique `missing_page` tier 9 avec le premier keyword du site
- Garantit que prescribeWithDualPrompts est toujours appelé quand du contenu est forcé

### Colonnes `autopilot_configs`
| Colonne | Type | Défaut | Description |
|---------|------|--------|-------------|
| `force_content_cycle` | boolean | **true** (v3) | Mode proactif contenu (actif par défaut) |
| `force_iktracker_article` | boolean | false | Forcer la création d'un article IKtracker (one-shot, pas reset si cycle échoue) |
| `content_budget_pct` | integer | 30 | % du budget alloué au contenu |
| `gate_threshold_low` | integer | 50 | Seuil gate pour tiers 5-6 |
| `gate_threshold_high` | integer | 70 | Seuil gate pour tiers 7+ |

### 4 canaux LLM (tool calls)
| Canal | Compatibilité | Destination |
|-------|--------------|-------------|
| `emit_code` | Lot technique | generate-corrective-code |
| `emit_corrective_data` | Lot technique | iktracker-actions (JSON, meta, structured data) |
| `emit_corrective_content` | Lot contenu | iktracker-actions (H1, H2, paragraphes existants) |
| `emit_editorial_content` | Lot contenu | iktracker-actions (nouveaux articles, nouvelles pages) |

### Gestion des erreurs graduée (v3.1, 2026-04-04)

**3 niveaux de sévérité** :
| Sévérité | Comportement | Exemples |
|----------|-------------|----------|
| `ignorable` | Log only, pipeline continue | generate-image, cms-push-code auto-chain, cms-push-redirect |
| `degraded` | Phase marquée "degraded", pipeline continue | 1 action CMS sur N ratée, timeout content-architecture-advisor |
| `critical` | Pipeline s'arrête (`break`) | Orchestrateur 500, toutes les actions CMS échouées |

**Statuts de cycle** : `completed` → `degraded` → `partial` → `failed`
- `completed` : 0 erreurs ou uniquement `ignorable`
- `degraded` : au moins une erreur `degraded`, aucune `critical`
- `failed` : au moins une erreur `critical`

**Polling content-architecture-advisor** : 90s max (sous la limite Edge de 150s), intervalle 5s. Timeout = `degraded` (le job continue en arrière-plan).

**Observabilité** : chaque cycle produit un log JSON structuré avec `event: 'cycle_complete'`, durée, nombre d'erreurs par sévérité, articles créés.

### Limites
- Max 10 actions CMS par cycle
- Max 4 tool calls par prompt LLM
- 2 prompts LLM max par micro-cycle (technique + contenu)
- 8 items max scorés par cycle (répartis entre les 2 lanes)
- Polling async : 90s max, intervalle 5s

### Anti-doublon renforcé (FIX v2.3, 2026-04-08)

**Problème racine** : Parménion créait des articles en doublon sur le même thème (ex: 5 articles "frais réels") à cause de :
1. Seuil Jaccard trop strict (0.65) — des titres reformulés passaient sous le radar
2. Items workbench jamais marqués `consumed_by_content = true` après création → re-présentés au LLM

**Corrections appliquées** :
1. `iktracker-actions` : dédup multi-couche (3 layers) :
   - **Layer A** : Jaccard classique abaissé de 0.65 → **0.45**
   - **Layer B** : Core Topic Overlap (mots-clés centraux, sans stop words) ≥ **0.80** → même sujet
   - **Layer C** : Slug Similarity ≥ **0.70** → même intention d'URL
2. `autopilot-engine` : POST-EXECUTE marque les items content (`missing_page`, `content_gap`, `content_upgrade`, `missing_terms`) avec `consumed_by_content = true` après succès
3. Les stop words français (le, la, des, guide, complet, etc.) sont exclus du calcul core topic pour se concentrer sur les mots-clés réellement discriminants

### FIX Pipeline bloqué en boucle audit-diagnose (v2.4, 2026-04-08)

**Problème racine** : Parménion restait bloqué en boucle audit→diagnose→prescribe(fail)→audit sans jamais atteindre execute/validate. 3 causes :

1. **Ambiguïté de surcharge RPC** : `score_workbench_priority` avait 2 overloads compatibles (paramètre `p_user_id` en `uuid` ET en `text`). PostgREST ne pouvait pas choisir → scoring échouait silencieusement → workbench toujours vide pour le LLM
2. **`force_content_cycle = false`** dans la DB malgré le défaut v3 à `true` → pas d'item synthétique de secours quand le scoring échoue
3. **Le engine traitait un prescribe "skipped" comme une erreur fatale** (`break`) au lieu de continuer vers execute/validate

**Corrections appliquées** :
1. `DROP FUNCTION score_workbench_priority(text, text, int, text, bool)` — suppression de l'overload `text` qui causait l'ambiguïté
2. `UPDATE autopilot_configs SET force_content_cycle = true` pour tous les configs actifs
3. `autopilot-engine` : un prescribe retournant `status: 'skipped'` est désormais logué puis `continue` au lieu de `break` — le pipeline peut continuer vers execute/validate
