# Périclès — SQL d'attribution (en attente d'application)

La base était injoignable au moment de l'implémentation (pooler indisponible).
Les deux migrations ci-dessous doivent être appliquées telles quelles, dans cet
ordre, dès que la base répond. Le code des fonctions est déjà déployé et
tolérant : sans ces colonnes, les écritures supplémentaires échouent en warning
sans casser la validation existante.

## Migration 1 — schéma additif

Colonnes ajoutées :
- `pericles_decision_log` : `market_context`, `competitive_measured_at`,
  `geo_reward_signal`, `geo_measured_at`, `raw_reward_signal`
- `geo_visibility_snapshots` : `pericles_decision_id`
- `architect_workbench` : `pericles_decision_id`, `measurement_due_at`,
  `reward_verdict`, `reward_verdict_reason`, `reward_verdict_at`
- table `pericles_competitive_snapshots` (RLS propriétaire + service_role)

## Migration 2 — fonctions

1. `pericles_apply_market_context(p_decision_id uuid, p_market_context text)`
   - conserve `raw_reward_signal`
   - si `competitor_gain` : `reward_signal = 0` (perte attribuée au marché)
   - si `self_loss` : récompense conservée
   - écrit le verdict sur le constat Workbench lié
2. `pericles_measure_rewards` (v2) : ajoute le calcul du signal GEO borné
   (−6 à +6) à partir des snapshots rattachés, et le verdict Workbench
   (`rewarded` / `regressed`).
3. `score_spiral_priority` (v4) : ajoute un unique terme GEO borné, sans
   toucher aux autres pondérations.

Règles non négociables conservées :
- un scan indisponible ne neutralise jamais une récompense négative ;
- la validation technique (`status`) reste distincte du verdict de rentabilité
  (`reward_verdict`) ;
- aucun appel LLM, aucun scan SERP systématique (≤ 3 requêtes mutualisées et
  seulement après récompense négative).
