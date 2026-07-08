# Vague 1 · Slow queries — 2026-07-08

Source : `supabase--slow_queries` (top 20 par temps cumulé).

## Top offenders (par temps cumulé)

| # | Table / Op | Calls | Mean ms | Total ms | Diagnostic |
|---|---|---|---|---|---|
| 1 | `UPDATE crawl_jobs SET processed_count` | **16 296 269** | 0.30 | **4 859 382** | Volume délirant. Update ligne à ligne. **Batcher** ou déclencher un rollup périodique. |
| 2 | `UPDATE site_crawls SET crawled_pages` | **16 296 284** | 0.18 | **2 945 392** | Idem. Compteur incrémenté à chaque page crawlée → devrait être `SET x = x + 1` en batch ou trigger. |
| 3 | `INSERT crawl_pages ON CONFLICT DO NOTHING` | 16 296 020 | 0.18 | 2 904 181 | Normal côté crawler mais énorme volume. Vérifier batching côté worker. |
| 4 | `SELECT crawl_jobs WHERE status = ANY ORDER BY priority DESC, created_at ASC` | 16 429 779 | 0.13 | **2 057 640** | **Index composite manquant** `(status, priority DESC, created_at ASC)`. |
| 5 | `SELECT analytics_events WHERE created_at >= … ORDER BY created_at DESC` | 9 709 | **293** | 2 844 403 | **Index manquant** `(created_at DESC)` sur `analytics_events`. |
| 6 | `SELECT crawl_pages.id WHERE crawl_id = $1` | 32 590 067 | 0.05 | 1 790 357 | Index probablement OK. Volume dû à polling — envisager cache. |
| 7 | `SELECT site_crawls.status WHERE id = $1` | 16 295 228 | 0.07 | 1 124 279 | Volume dû à polling status. **Passer en Realtime** ou cache 5s. |
| 8 | `SELECT parmenion_decision_log WHERE domain AND status ORDER BY created_at DESC` | 6 593 | 108 | 709 676 | **Index composite manquant** `(domain, status, created_at DESC)`. |
| 9 | `INSERT analytics_events (event_data, event_type, session_id, ...)` | 38 161 | 11 | 418 810 | Acceptable. |
| 10 | `SELECT analytics_events WHERE event_type = $1 AND created_at >= $2` | 1 425 | 263 | 374 572 | **Index composite manquant** `(event_type, created_at DESC)`. |
| 11 | `SELECT user_stats_history WHERE user_id AND tracked_site_id = ANY ORDER BY recorded_at` | 11 085 | 26 | 292 480 | Index composite à vérifier `(user_id, tracked_site_id, recorded_at)`. |
| 12 | `SELECT strategist_recommendations WHERE tracked_site_id AND user_id ORDER BY created_at DESC` | 1 878 | 103 | 194 194 | **Index manquant** `(tracked_site_id, user_id, created_at DESC)`. |

## Fixes prioritaires

### P0 — Réduire le volume d'updates (levier x100)
Les 2 premiers offenders totalisent **7 800 secondes de DB** sur la période. Le pattern « update ligne à ligne pour incrémenter un compteur » est le principal coupable.

**Solution** : dans le worker de crawl, agréger les incréments en mémoire (par tranches de 500 pages ou 5s) et émettre **un seul** `UPDATE … SET processed_count = processed_count + N`. Réduction attendue : x100 à x500 sur le nombre de calls.

### P1 — Index composites manquants
Migration à créer :
```sql
CREATE INDEX idx_crawl_jobs_status_priority ON crawl_jobs (status, priority DESC, created_at ASC);
CREATE INDEX idx_analytics_events_created_at ON analytics_events (created_at DESC);
CREATE INDEX idx_analytics_events_type_created ON analytics_events (event_type, created_at DESC);
CREATE INDEX idx_parmenion_decision_log_domain_status_created ON parmenion_decision_log (domain, status, created_at DESC);
CREATE INDEX idx_strategist_reco_site_user_created ON strategist_recommendations (tracked_site_id, user_id, created_at DESC);
```
Vérifier avant chaque `CREATE INDEX` avec `EXPLAIN (ANALYZE, BUFFERS)` pour confirmer qu'il n'existe pas déjà sous une autre forme.

### P2 — Passage en Realtime / cache
- Polling `site_crawls.status` (16M calls) → Supabase Realtime channel sur `site_crawls`.
- Polling `crawl_pages.id` → même chose ou cache côté client 5s.

## Signaux à re-mesurer dans 30j
- Total ms cumulé du top 5 (baseline : **~14 300 secondes**)
- Nombre de calls sur `UPDATE crawl_jobs.processed_count` (baseline : **16M**)
- Mean ms sur `analytics_events` queries (baseline : **150-300 ms**)
