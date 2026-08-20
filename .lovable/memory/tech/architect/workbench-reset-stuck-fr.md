---
name: Workbench — reset automatique des constats bloqués
description: Cron SQL 15 min qui repasse en pending les constats architect_workbench bloqués en in_progress depuis plus de 2 h
type: feature
---
# Reset automatique des `in_progress` bloqués

`public.reset_stuck_workbench_items()` (SECURITY DEFINER, `search_path = public`, EXECUTE réservé à `service_role`) repasse en `pending` tout `architect_workbench` en `in_progress` dont `updated_at` a plus de 2 h, et journalise le nombre via `RAISE LOG`.

Cron : `workbench-reset-stuck-15min` — `*/15 * * * *`, SQL pur (aucun boot d'edge function).

Le bloc `reset_stuck` de l'edge `workbench-hygiene` (cron 6 h) reste en place comme filet secondaire, mais ce n'est plus lui qui garantit le déblocage : 6 h de granularité laissaient des constats figés bien au-delà du seuil de 2 h.
