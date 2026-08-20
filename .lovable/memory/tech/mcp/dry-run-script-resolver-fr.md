---
name: MCP dry_run_script — résolution script_id → code
description: L'outil MCP dry_run_script cible dry-run-script (siteUrl+code) en résolvant script_id depuis site_script_rules, jamais process-script-queue
type: feature
---
Outil MCP `dry_run_script` (`supabase/functions/mcp-server/index.ts`) :
- cible **`dry-run-script`** (contrat `{ siteUrl, code }`), plus jamais `process-script-queue` qui ignorait `script_id` / `target_url` et traitait la file globale ;
- `ARG_RESOLVE.dry_run_script` résout le code depuis **`site_script_rules`** (`script_source`, fallback `payload_data.code|script|script_source`) ;
- **isolation multi-tenant** : filtre `user_id = auth.userId` sauf admin ; erreur explicite si la règle est introuvable ou sans code généré ;
- `target_url` est **optionnel** : à défaut, l'URL de test est déduite du `tracked_sites.domain` lié à `domain_id`.

`ARG_RESOLVE` est le point d'extension pour tout outil MCP nécessitant une lecture base avant appel ; `ARG_ADAPT` reste réservé aux adaptations synchrones (url/domaine).
