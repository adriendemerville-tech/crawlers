---
name: Cocoon — boucle workbench et traçabilité de déploiement
description: cocoon-strategist écrit ses findings critiques dans architect_workbench (_shared/cocoonWorkbench.ts) et cocoon-deploy-links marque is_deployed = true avec idempotence
type: feature
---

Correctifs P0 de l'audit Cocoon du 2026-08-10.

## P0-1 — Boucle mesure → correction
`_shared/cocoonWorkbench.ts` (`writeCocoonFindingsToWorkbench`) upsert les findings actionnables (severity critical/warning) dans `architect_workbench` :
- `source_type = 'cocoon'` (enum existant), `source_function = 'cocoon-strategist'`
- clé idempotente `cocoon_<domain>_<findingId>[_<hash(url)>]` → `onConflict: 'source_type,source_record_id'` (l'index doit rester NON partiel)
- catégories retenues : cannibalization, orphan_pages, deep_pages, structure, thin_content, duplicate_content, content_decay, weak_clusters, keyword_gaps, broken_links, anchor_over_optimization
- `target_selector` / `target_operation` mappés par catégorie ; `action_type` laissé au trigger DB
- écriture ignorée si `userId === 'service-role'` (pas de propriétaire réel → invisible en RLS)
- appel en PHASE 4b de `cocoon-strategist`, non bloquant, exposé dans la réponse via `workbench_findings_written`

## P0-2 — Traçabilité du déploiement de liens
`cocoon-deploy-links` :
- en mode `deploy`, filtre d'emblée les liens déjà `is_deployed = true` (clé normalisée source|target|anchor, insensible casse/slash final) ; retourne `path: 'skipped'` si le lot est entièrement déjà déployé
- après déploiement, `markLinksDeployed()` passe `is_deployed = true` + `deployment_method` (cms_connection / iktracker / site_rules) + `updated_at` sur les `cocoon_auto_links` correspondants
- les sources en échec (`results[].status !== 'deployed'`, chemin IKtracker) sont exclues du marquage
- réponse enrichie : `already_deployed`, `marked_deployed`
