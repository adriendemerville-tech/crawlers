---
name: Dictadevi Bridge
description: Bridge dictadevi-actions, garde éditoriale, conversion Markdown→HTML auto, et résolution clé API DB-first
type: feature
---

## Bridge dictadevi-actions

Pont REST entre Crawlers (Parménion) et l'API custom Dictadevi (`https://dictadevi.io/api/v1`, auth `Bearer dk_...`).

### Résolution de la clé API (mai 2026 — DB-first)
`getDictadeviApiKey(supabase)` dans `_shared/domainUtils.ts` :
1. **DB d'abord** : RPC `get_parmenion_target_api_key('dictadevi.io')` → `parmenion_targets.api_key_name` (SECURITY DEFINER)
2. **Env fallback** : `Deno.env.get('DICTADEVI_API_KEY')` (bootstrap / dev)

Inversion vs. comportement initial (env > DB) : toute MAJ via **Admin > Parménion > Intégrations** (`ParmenionApiKeyManager`) prend effet immédiatement, sans rotation manuelle du secret Edge. Évite le piège silencieux où la clé en base était écrasée par l'env obsolète.

Note : `_shared/dictadeviContext.ts` (knowledge/lexicon/catalog appelés par editorialPipeline) reste env-only (`DICTADEVI_API_KEY` requis comme secret Edge) — refactor invasif non prioritaire.

### Garde Markdown→HTML
`ensureHtmlContent()` appelée sur **tout `create-post` / `update-post`** :
- Champs scannés : `content`, `body`, `excerpt`
- Détection : signaux Markdown (`^# `, `**…**`, `[text](url)`) ET absence de balises HTML structurelles
- Conversion : `marked@12.0.2` (GFM, pas de `breaks`)
- Idempotent + logué

### Garde éditoriale
- Refus si auteur ∈ {parménion, parmenion, crawlers autopilot}
- Refus si `published_at` > 6 mois

### Actions non supportées (→ 501)
push-code-*, get-injection-*, robots, redirects, push-event, *-page (Dictadevi v1 n'expose que `/posts` en écriture).
