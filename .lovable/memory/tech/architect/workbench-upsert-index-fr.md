---
name: Workbench — index unique non partiel obligatoire
description: idx_workbench_source_unique doit rester NON partiel sinon tous les upsert onConflict(source_type,source_record_id) échouent silencieusement
type: constraint
---
`architect_workbench` : l'index `idx_workbench_source_unique (source_type, source_record_id)` doit rester **non partiel**.

Un index partiel (`WHERE source_record_id IS NOT NULL`) ne peut pas être ciblé par `ON CONFLICT`, ce qui faisait échouer **tous** les upserts de `marinaWorkbench.ts` et `contentIntegrity/workbench.ts` (erreur « no unique or exclusion constraint matching the ON CONFLICT specification »), donc aucun constat Marina ni intégrité n'atteignait Parménion.

Marina écrit aussi `audit_raw_data` (`audit_type = 'marina'`) pour **chaque** URL d'un batch multipages, et signe le rapport avec 3 tentatives (`createSignedUrl`) avant de logger une erreur explicite si `report_url` reste nul.
