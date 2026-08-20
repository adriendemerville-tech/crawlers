---
name: Workbench — plafond de file et déduplication
description: workbench-hygiene borne architect_workbench (dédup titre + catégorie/URL, plafond 40 constats actifs par domaine/user, dismissed jamais done)
type: feature
---
`architect_workbench` doit rester **borné**, sinon les constats ne redescendent jamais en exécution (file de 762 pending observée le 20/08/2026).

`workbench-hygiene` (cron 6 h, actions `full` / `purge_duplicates` / `archive_stale` / `cap_backlog` / `recalc_scores` / `reset_stuck`) :
- **Dédup double signature** : `domain::user::titre normalisé` **et** `domain::user::finding_category::URL normalisée` (sans protocole, www ni slash final). Le gagnant est choisi par `keepScore` : priorité manuelle > gravité > `spiral_score` > `in_progress`.
- **Plafond `ACTIVE_CAP_PER_DOMAIN = 40`** constats actifs par (domaine, utilisateur) ; le surplus passe en `dismissed`.
- Les constats périmés (> 60 j) ou en échec de validation (> 3 tentatives) passent en **`dismissed`, jamais `done`** — rien n'a été exécuté.
- `reset_stuck` : `in_progress` non touché depuis 2 h → `pending` (par lots de 100, plafond 500).

Rappel : le garde-fou backlog de Parménion lit `parmenion_decision_log` (CMS `planned` > 5), pas le workbench — les deux files se surveillent séparément.
