---
name: SDKs développeurs (@crawlers/sdk, @parmenion/sdk)
description: SDKs TS officiels publiables npm + endpoint GET /v1/wallet/balance ajouté à crawlers-api
type: feature
---

## Packages

- `packages/crawlers-sdk/` → `@crawlers/sdk` v0.1.0
  - `CrawlersClient` typé sur les 18 features réelles du registry `crawlers-api/index.ts` (audit_expert, machine_layer, eeat, site_crawl, pagespeed, audit_matrix, semantic_audit, cocoon, content_architect, autopilot_status, conversion_optimizer, social_hub, geo_score, llm_visibility, ai_bots_analysis, observatory, serp_ranking, competitors).
  - Request shape : `{ feature, input: {...} }` (le backend attend `body.input`, pas du flat).
  - Helper `jobs.run()` = create + polling jusqu'à `completed|failed|cancelled`.
  - Erreurs typées : `AuthenticationError` (401/403), `InsufficientBalanceError` (402), `RateLimitError` (429), `ValidationError` (400/404/409/422), `JobTimeoutError`.
  - `wallet.balance()` → consomme l'endpoint ci-dessous.
  - Base URL par défaut : `https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/crawlers-api`.
  - Build : `tsup` (ESM + CJS + .d.ts). Zéro dépendance runtime.

- `packages/parmenion-sdk/` → `@parmenion/sdk` v0.1.0
  - Pull worker pour l'Autopilote : `runWorker(handler, { pollIntervalMs, signal })` boucle poll→ack→handler→published/failed.
  - Endpoints couverts : `GET /v1/tasks/pending`, `POST /v1/tasks/{id}/ack|published|failed`.
  - Clé `prm_live_*`.

## Backend ajouté

`GET /v1/wallet/balance` dans `supabase/functions/crawlers-api/index.ts` : lit `dev_wallets` filtré sur `auth.uid()` (via service role + `ctx.userId` issu de `crawlers_api_verify_token`), retourne `{ balance_cents, currency, estimated_jobs_remaining, updated_at }`. Si pas de ligne wallet → balance 0.

## Hors-scope MVP

- Marina : pas de SDK pour l'instant (l'edge `marina` n'expose pas une REST API stable).
- Publication npm : nécessite repo GitHub public + token NPM (workspace build secret).
