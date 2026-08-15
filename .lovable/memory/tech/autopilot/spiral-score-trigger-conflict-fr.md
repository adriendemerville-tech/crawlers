---
name: Spiral score — conflit de trigger et neutralité cluster
description: Le trigger update_spiral_score_on_signal_change écrasait le score 10-signaux ; absence de cluster = neutralité 7/15 ; crons de réconciliation Parménion et de retry cluster
type: constraint
---

## Trigger `trg_update_spiral_score` (architect_workbench)

Il recalculait `spiral_score` avec une formule simplifiée à 4 signaux (velocity, competitor, gmb, severity × conversion) et **écrasait systématiquement** le score 10-signaux écrit par `compute-spiral-signals` → Breathing Spiral inerte (scores plafonnés ~7-12, aucun effet de ring / maturité / saisonnalité / couverture).

Règle : si un UPDATE fournit explicitement `spiral_score` (différent de l'ancien), le trigger **respecte** cette valeur. Sinon il calcule un repli aligné sur la formule complète (colonnes de signaux persistées, sans le malus de saturation qui n'est pas stocké).

## Neutralité en l'absence de cluster

`cluster_id IS NULL` ne vaut pas « cluster immature » : la contribution maturité est **7 pts sur 15** (neutre) et `cluster_maturity_pct` est écrit à NULL. Avant le correctif, `maturity = 0` offrait +15 pts à tous les items non rattachés (56/113 pending), écrasant la discrimination.

Multi-tenant : un même domaine peut exister sur plusieurs `tracked_sites` (users différents). Les clusters d'un autre user ne sont **jamais** réutilisés ; les items de ces sites restent sans cluster jusqu'à leur propre crawl (`spiralClassifier`).

## Crons de fiabilité

| Cron | Fréquence | Effet |
|---|---|---|
| `reconcile-stale-parmenion-hourly` | `25 * * * *` | `reconcile_stale_parmenion_decisions(3)` : décisions `planned` > 3 h → `skipped_stale`, même si l'Autopilot du site est en pause/cooldown (la réconciliation interne d'`autopilot-engine` ne tournait qu'au cycle suivant) |
| `retry-workbench-cluster-6h` | `5 */6 * * *` | `retry_workbench_cluster_assignment(500)` : nouvelle tentative `match_workbench_cluster` sur les items **contenu** non rattachés (catégories tech exclues par design) |

`compute-spiral-signals` accepte `{ all: true, force: true }` pour contourner le throttle de 60 min (relance manuelle/admin).
