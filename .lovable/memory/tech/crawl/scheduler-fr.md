---
name: Crawl Scheduler
description: Planificateur automatique de crawls (full 15j + targeted 5j par répertoire)
type: feature
---
## cron-crawl-scheduler — Planification automatique des crawls

### Cadences
- **Full crawl** : tous les **15 jours** (maxPages=300, pas d'urlFilter)
- **Targeted crawl** : tous les **5 jours**, sur 1 répertoire à la fois (maxPages=80, urlFilter regex `^/dir(/|$)`)

### Sélection du répertoire (rotation pondérée)
- Découverte : segmentation du 1er niveau de `crawl_pages.path` du dernier crawl complet
- Score = `total_pages × 10 + days_since_last_crawl` → priorité aux répertoires actifs ET stales
- Filtre : ≥2 pages par répertoire, racine `/` exclue

### Fonctionnement
1. Cron pg_cron `cron-crawl-scheduler-daily` (03h00 UTC, jobid 58)
2. Pour chaque `parmenion_targets` actif (autopilot_enabled=true) :
   - Upsert `site_crawl_schedule` (1 ligne par domaine)
   - Si `last_full_crawl_at > full_interval_days` → full crawl, met à jour `last_full_crawl_at/id`
   - Sinon si `last_targeted_crawl_at > targeted_interval_days` → targeted crawl, met à jour `last_targeted_crawl_at/directory/directories[]`
   - Sinon skip (`up_to_date`)
3. Fallback `user_id` : si `parmenion_targets.created_by_user_id` est null, récupère depuis le dernier `site_crawls.user_id` du domaine

### Table `site_crawl_schedule`
- `domain` (unique), `user_id`, `enabled` (default true)
- `last_full_crawl_at/id`, `last_targeted_crawl_at/directory`
- `directories jsonb` : `[{path, total_pages, recent_pages, last_crawled_at}]`
- `full_interval_days` (15), `targeted_interval_days` (5) — configurables par site
- RLS : service_role full, owner SELECT, admin SELECT

### Parménion ne crawle plus
La logique 0bis dans `parmenion-orchestrator` est réduite à un simple **garde crawl-in-flight** (report du cycle si crawl `pending/processing`). Le déclenchement est entièrement délégué au cron.

### Test manuel
`POST /cron-crawl-scheduler` avec `{ "dry_run": true }` ou `{ "only_domain": "dictadevi.io" }` (admin auth requise).
