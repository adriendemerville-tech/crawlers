---
name: Spiral Cluster Binding Fix
description: Rattachement automatique des tâches workbench aux clusters (trigger match_workbench_cluster) + cron compute-spiral-signals 6h — sans ce lien la Breathing Spiral était inerte
type: feature
---

## Correctif Breathing Spiral (2026-08-04)

### Problème détecté à l'audit
- `architect_workbench.cluster_id` était **NULL sur 171/171 items** : rien dans le pipeline (expert-audit, process-crawl-queue, cocoon-strategist) n'assignait de cluster aux tâches.
  Conséquences dans `score_spiral_priority` :
  - `ring` retombait toujours à 3 (5 pts au lieu de 18 pour Ring 1)
  - `cluster_maturity_pct` NULL → bonus neutre 9 pts, seuil de maturité 70 % inopérant
  - cap de diversité `ROW_NUMBER() PARTITION BY COALESCE(cluster_id, id)` → partition unitaire, **cap 2/cluster jamais appliqué**
- `compute-spiral-signals` **n'avait aucun cron** (la doc annonçait 6 h) → velocity_decay / competitor_momentum / topic_saturation jamais rafraîchis.

### Corrections
1. `match_workbench_cluster(tracked_site_id, text)` — matcher déterministe (0 LLM) : tokens ≥ 4 car., overlap ≥ 2 tokens ou 1 token ≥ 8 car. avec `cluster_definitions.keywords`, tri overlap → longueur → ring. SECURITY DEFINER, EXECUTE réservé à service_role.
2. Trigger `trg_assign_workbench_cluster` (BEFORE INSERT OR UPDATE OF title/description/target_url) : assigne `cluster_id` **uniquement aux items lane contenu** (les catégories tech restent sans cluster, volontairement).
3. Backfill : 54 items rattachés sur 29 clusters distincts (les ~90 items « Audit finding » tech restent hors cluster par design).
4. Cron `compute-spiral-signals-6h` (`15 */6 * * *`) avec `Authorization: Bearer current_setting('app.settings.service_role_key')` et body `{"all": true}` — l'anon key renvoie 401 (`getAuthenticatedUser`).

### Anti-chevauchement de mots-clés : couches actives
| Couche | Où | Effet |
|---|---|---|
| Cluster cap 2/cluster | `score_spiral_priority` | rotation thématique (opérationnel depuis ce fix) |
| Ring 1/2/3 + maturité | `score_spiral_priority` + `spiralClassifier` | interdit l'expansion avant maturité |
| Cannibalisation Jaccard 0.45 | `cannibalizationClusters.ts` (phase prescribe) | thèmes saturés transmis au stratège |
| Saturation guard ≥ 3 pages | `parmenion-orchestrator` | blocage création → bascule `fix_cannibalization` |
| Dedup synonymes + titres drafts | `contentBrief.ts` | interdit les doublons de sujet |
| Topic saturation (−20 pts) | `compute-spiral-signals` | malus sur création en cluster surchargé |
