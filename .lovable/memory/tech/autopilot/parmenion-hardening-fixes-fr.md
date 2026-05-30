---
name: Parmenion Hardening Fixes (10.3/10.5/10.6/10.7)
description: 4 durcissements Parménion — guard éditoriale DB-driven, traçabilité clé Dictadevi, alerting crawl stuck, parser MD strict
type: feature
---

## Fixes durcissement Parménion (mai 2026)

### 10.7 — Guard éditoriale DB-driven
- Colonne `parmenion_targets.author_aliases` (JSONB array, default `[]`, seedée avec liste statique)
- RPC `get_parmenion_author_aliases(p_domain)` SECURITY DEFINER
- Module `_shared/parmenionEditorialGuard.ts` : `checkEditorialGuard(content, domain, supabase)` async, cache 5 min, **fallback statique CRITIQUE** si DB vide (jamais désactiver la garde par accident)
- Wiré dans `dictadevi-actions` (create/update-post) + `iktracker-actions` (8 call sites convertis async)

### 10.5 — Traçabilité clé Dictadevi
`getDictadeviApiKey` log chaque résolution : `domain`, `source` (db/env/NONE), `key_prefix` (6 chars masqué), `db_entry` (exists?), `env_present`. **Warning explicite `DESYNC_WARNING`** si source=env alors qu'une row DB existe.

### 10.3 — Alerting crawl stuck
- Colonnes `consecutive_crawl_skips` (int) + `last_crawl_skip_at` (timestamptz) sur `parmenion_targets`
- Phase 0bis orchestrator incrémente à chaque skip `crawl_in_flight`, reset à 0 dès qu'un cycle s'exécute
- Seuil 5 cycles → `console.error` + insert `parmenion_decision_log` (action_type=`crawl_stuck_alert`, status=`degraded`)

### 10.6 — Parser Markdown strict
`shouldConvertMarkdown` remplace la regex `MD_SIGNALS` par un scoring pondéré : signaux MD structurels (headings ATX, listes, blockquotes, code fences, liens MD) vs blocs HTML structurels. Conversion uniquement si `mdScore > htmlScore` ET pas de bloc HTML dominant. `**bold**` exclu (trop ambigu).
