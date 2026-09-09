# Périclès — fermeture de la boucle (récompense, exclusion, pause)

Dernière mise à jour : 2026-09-09

Périclès est l'orchestrateur Autopilot. Sa boucle est
`prescribe → execute → réconciliation → mesure → réinjection`. Le Workbench en
est la mémoire d'état (constats, prescriptions, tentatives, réussites, échecs).

## Mesure de la récompense (migration `0021`)

`public.pericles_measure_rewards(domain, limit, window_days = 14)` compare les
fenêtres GSC avant/après `execution_completed_at` (clics et position moyenne) et
écrit `reward_signal` + `measured_at` sur la décision. Une action n'est mesurée
que si la fenêtre complète est couverte par les données disponibles.

Cron : `pericles-measure-rewards-daily` (`20 3 * * *`).

Référence de calibrage (mesure initiale sur 960 actions historiques) :
`dictadevi.io` +14,57 ; `crawlers.fr` +12,45 ; `iktracker.fr` −6,63.

## Réinjection dans le scoring (migration `0020`)

`score_spiral_priority` :

- ajoute `GREATEST(-15, LEAST(12, récompense_cluster × 0,15))`, avec repli sur
  la moyenne du domaine quand le cluster n'a pas encore de mesure ;
- pénalise la récidive : `− LEAST(18, validate_attempts × 6)` ;
- **exclut** les éléments à `validate_attempts >= 3` ;
- **exclut** les clusters cumulant ≥ 4 échecs sur 90 jours, sauf gravité
  `critical` / `danger`.

`public.pericles_reward_health(domain)` renvoie récompense moyenne, volume
mesuré et part de récompenses négatives.

## Seuil de pause

`autopilot-engine/index.ts` applique `auto_pause_threshold` (défaut 15) et gèle
un domaine dès **5 décisions mesurées** avec récompense moyenne ≤ **−15**. La
reprise est **manuelle** (sauf `bypassCooldown`).

## Dettes ouvertes

- La pause automatique n'est ni visible ni réversible depuis `AutopilotModal.tsx`.
- Deux mécanismes de mesure peuvent écrire les mêmes champs avec des sources
  différentes (`parmenion-feedback` vs `pericles_measure_rewards`) : un seul juge
  doit rester.
- Les crons actifs ne sont pas versionnés dans une migration.
