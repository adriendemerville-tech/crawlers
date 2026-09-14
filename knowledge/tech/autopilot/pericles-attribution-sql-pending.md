# Périclès — attribution GEO et concurrentielle (APPLIQUÉ)

Dernière mise à jour : 2026-09-14

Les migrations décrites ici sont désormais appliquées :

- `0037_pericles_attribution_schema.sql` — colonnes `market_context`,
  `competitive_measured_at`, `geo_reward_signal`, `geo_measured_at`,
  `raw_reward_signal` sur `pericles_decision_log` ;
  `pericles_decision_id` sur `geo_visibility_snapshots` ;
  `pericles_decision_id`, `measurement_due_at`, `reward_verdict`,
  `reward_verdict_reason`, `reward_verdict_at` sur `architect_workbench` ;
  table `pericles_competitive_snapshots` (grants + RLS propriétaire/service) ;
  RPC `pericles_apply_market_context(uuid, text)` réservé au `service_role`.
- `0038_pericles_geo_reward_and_scoring.sql` — `pericles_measure_rewards` v2
  (signal GEO borné −6/+6 depuis les snapshots rattachés, écriture du
  `reward_verdict` sur les constats liés) et `score_spiral_priority` avec un
  unique terme GEO borné, sans toucher aux pondérations GSC.
- `0039_fix_spiral_cluster_id_casts.sql` — correction d'un défaut préexistant :
  `goal_cluster_id` est du texte, `architect_workbench.cluster_id` un uuid. Les
  jointures de mémoire (récompense, récompense GEO, échecs) échouaient en
  `text = uuid`, donc la réinjection de récompense n'avait jamais lieu. Les CTE
  castent maintenant après filtrage sur un uuid valide.

## Invariants

- un scan indisponible ne neutralise jamais une récompense négative ;
- `status` (validation technique) reste distinct de `reward_verdict` (ROI) ;
- ≤ 3 requêtes SERP mutualisées, seulement après récompense GSC négative ;
- aucun appel LLM, aucun nouvel orchestrateur.

## Dette restante

- `postExecute` rattache les constats `deployed` par domaine/statut/catégorie :
  une décision peut être associée à plusieurs constats. À resserrer par
  identifiant de constat.
- `measure-audit-impact` choisit la dernière décision complétée du domaine
  (45 j) : approximation acceptable, à remplacer par un identifiant propagé.

## Attribution par action (migrations 0040-0046)

`pericles_measure_rewards` ne mesure plus le domaine entier par défaut :

- `pericles_decision_urls(decision)` résout les pages visées (constats rattachés,
  puis `affected_urls` / `target_urls` / `target_url` de la charge utile) ;
- `pericles_decision_queries(decision, domain)` en déduit le périmètre de requêtes
  GSC (mots-clés déclarés dans `keyword_universe` + requêtes contenant un segment
  significatif du slug), sans appel LLM ;
- la mesure est restreinte à ces requêtes dès qu'au moins 3 sont présentes dans la
  GSC (`measured_scope = 'keyword'`), sinon repli domaine **amorti de moitié**
  (`measured_scope = 'domain'`) pour ne pas faire apprendre une moyenne ;
- `measured_keyword_count` et `measured_target_urls` tracent le périmètre réel ;
- le verdict ROI (`reward_verdict`) est écrit sur les constats rattachés, distinct
  de la validation technique ;
- `pericles_geo_reward(decision)` borne le signal IA à −6/+6 depuis
  `geo_visibility_snapshots.delta_overall_score`.

Vérification sur `crawlers.fr` (fenêtre 14 j) : 5 décisions mesurées, 4 en
périmètre mots-clés, notes désormais distinctes (4,10 / 1,39) au lieu de 20,26
pour toutes.

### Dette restante
- Faible recouvrement `keyword_universe` ↔ requêtes GSC réelles (1 correspondance
  exacte sur 453) : le périmètre repose surtout sur le slug.
- Aucune dimension page dans `gsc_daily_positions` : l'attribution page pure
  reste impossible côté GSC.
