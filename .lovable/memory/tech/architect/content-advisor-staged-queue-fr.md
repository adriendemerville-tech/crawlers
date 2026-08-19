---
name: Content Advisor — exécution étagée job_queue
description: Découpage de content-architecture-advisor en 2 étapes enfilées (research → synthesis) avec checkpoint dans async_jobs.result_data
type: feature
---
# content-architecture-advisor — mode étagé (`staged: true`)

Appel avec `staged: true` (ou `_stage`) → crée un `async_jobs` puis enfile l'étape 1 dans `job_queue`.

1. `_stage: 'research'` — I/O uniquement (identité site, CMS, HTML existant, DataForSEO/SERP, concurrents, audits, workbench, keyword cloud). Écrit le bundle (23 clés) dans `async_jobs.result_data.__research`, progress 60, puis enfile `_stage: 'synthesis'`.
2. `_stage: 'synthesis'` — recharge le bundle et exécute uniquement le pipeline LLM + persistance. Quotas fair-use et débit de crédits **sautés** (déjà consommés à l'étape 1).

Règles :
- Le checkpoint est nettoyé des `\u0000` (jsonb Postgres les refuse) ; en cas d'échec, retry sans `existingPageHtmlRaw`, sinon job `failed` avec message explicite. Ne jamais écrire le checkpoint sans vérifier `error`.
- `existingPageHtmlRaw` tronqué à 150 000 caractères dans le checkpoint.
- Si l'étape 2 ne trouve pas `__research`, le job passe `failed` (jamais de recherche rejouée en silence).
- Le mode `async: true` historique (self-invocation) reste inchangé.
