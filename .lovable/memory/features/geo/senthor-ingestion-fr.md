---
name: Ingestion Senthor
description: Canal d'ingestion bot_hits via Senthor pour les sites hors Cloudflare — endpoint ingest-senthor, colonne provider, rotation de secret
type: feature
---
# Ingestion Senthor (sites hors Cloudflare)

- Colonne `cf_shield_configs.provider` : `cloudflare` (défaut) | `senthor` | `custom`.
  Une seule config par `tracked_site_id`, quel que soit le provider.
- Edge `ingest-senthor` (public) : auth par header `X-Crawlers-Secret` = `ingestion_secret`,
  ou HMAC-SHA256 `X-Senthor-Signature: sha256=<hex>` + `X-Crawlers-Domain`.
  Accepte array JSON / NDJSON / objet unique / `{events:[]}`, 500 max par lot.
- Mapping : Senthor fait foi sur `is_bot`/`bot_category`, `detectBot(ua)` en repli.
  `confidence` 0..1 ou 0..100 → `bot_hits.confidence_score` smallint 0..100.
  IP jamais stockée en clair (SHA-256), humains échantillonnés via `human_sample_rate`.
  `raw_meta = { source: 'senthor', senthor_id, decision }`.
- `cf-deploy-shield` : action `init` accepte `provider` ; pour senthor renvoie l'URL
  d'ingestion + le secret sans script Worker. Action `rotate` révoque immédiatement
  l'ancien secret et adapte la note selon le provider.
- UI `/cf-shield` : sélecteur de voie de collecte à l'étape 1, écran Senthor
  (URL, header, rotation, format) à l'étape 2, vérification commune à l'étape 3.
