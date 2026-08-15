---
name: Pool SERP mutualisé
description: Toute requête SERP passe par _shared/serpPool.ts (getSerp/ingestExternalSerp), TTL par classe d'usage, fan-out des positions, journal serp_pool_hits
type: feature
---

Toute nouvelle requête SERP doit passer par `_shared/serpPool.ts` — jamais d'appel direct DataForSEO/Serper/SerpAPI dans une edge function.

- `getSerp(query, opts)` : read-through `serp_pool` (clé = requête normalisée + engine + country + language + device + location, sans `user_id` : donnée publique partagée) → cascade DataForSEO → Serper → SerpAPI.
- TTL par `usageClass` : `position` 24 h, `intent` 7 j, `volume` 30 j.
- Fan-out automatique : une SERP payée met à jour `current_position`/`best_position` dans `keyword_universe` pour tous les domaines suivis du top 100 (`skipFanout: true` pour les requêtes `site:`).
- `ingestExternalSerp()` : pour les modules qui appellent plusieurs providers volontairement (`serp-benchmark`), afin que la donnée payée alimente quand même le pool.
- Attribution/quotas et compteur d'économies : `serp_pool_hits` (caller, source pool/provider, cost_usd, saved_usd, fanout_rows).
- `normalizeQuery` conserve `: . / _ -` pour préserver les opérateurs (`site:`, `inurl:`).

Appelants migrés : `serp-benchmark` (position), `analyze-serp-intents` (intent), `fetch-serp-kpis` (volume, `site:`). Hors périmètre : `refresh-serp-all` et `audit-strategique-ia` (DataForSEO Labs `ranked_keywords` / snapshots, pas une page de résultats).
