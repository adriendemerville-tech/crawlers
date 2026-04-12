# Memory: tech/autopilot/parmenion-v3-fr
Updated: 2026-04-12

## Parménion v3 — Orchestrateur Breathing Spiral (post-fix 2026-04-12)

### Vue d'ensemble
Parménion (v3) est l'unique macro-orchestrateur de la **Breathing Spiral**, capable de piloter le cycle complet (Audit → Diagnostic → Prescription → Exécution → Validation). Il utilise le `spiral_score` pour prioriser les actions et un dual-lane scoring (tech + contenu) avec budget partagé configurable. La spirale se contracte ou s'expand automatiquement en fonction des 9 signaux temps réel (voir `breathing-spiral-strategy-fr.md`).

### FIX critique v3.2 (2026-04-12) — 6 corrections

**Problème racine** : Parménion tournait depuis ~71 cycles sans produire aucun déploiement. 78 items workbench étaient bloqués en `in_progress` sans jamais passer à `deployed`.

**Causes identifiées** :
1. **Prompt Bloat** : Le `contentPrompt` dépassait 30K tokens (40 keywords, 300 chars descriptions, tous les templates), causant Gemini 2.5 Pro à retourner 0 tool calls
2. **Faux "deployed"** : `executionSuccess` restait `true` par défaut même quand aucune action CMS réelle n'était exécutée
3. **Boucle de recyclage** : `consumed_at` était rafraîchi à chaque cycle, empêchant le seuil de 24h de se déclencher
4. **Pas de watchdog global** : Aucune protection contre les timeouts Edge Function (150s max)
5. **Images gaspillées** : Génération d'image AVANT la déduplication iktracker-actions
6. **Synthetic items aveugles** : Les items synthétiques (workbench vide + force_content) n'injectaient pas la carte d'identité, causant des hallucinations massives (ex: article IKtracker décrivant un "tracker de données" au lieu d'un calculateur d'indemnités kilométriques)

**Corrections appliquées** :

#### FIX #1 — Truncation du prompt contenu (`parmenion-orchestrator`)
- Keywords limités de 40 → **15** (enrichKeywordsForPrescribe)
- Keywords site context de 30 → **15** 
- Descriptions items de 300 → **150** caractères
- Templates limités à **1 seul** (le premier détecté) au lieu de tous
- Items avec template limités à **3** (les autres conservent juste le page_type)

#### FIX #2 — Guard POST-EXECUTE (`autopilot-engine`)
- Le statut `deployed` n'est plus conditionné par `executionSuccess` global
- Vérifie `r.status === 'success' && r.cms_action` (action CMS réelle)
- Contenu : nécessite `create-post`, `update-post`, `update-page` ou `create-page` avec succès
- Code : nécessite `generate-corrective-code` ou `cms-push-code` avec succès
- Si 0 succès réels → les items restent en `in_progress`, pas de faux `deployed`

#### FIX #3 — Recyclage corrigé (`autopilot-engine`)
- Ancienne logique : `consumed_at < 24h` → problème car `consumed_at` rafraîchi à chaque cycle
- Nouvelle logique : `deployed_at IS NULL AND updated_at < 48h` → cible les vrais items bloqués
- Les items déployés avec succès (`deployed_at` non-null) ne sont jamais recyclés

#### FIX #4 — Watchdog global (`autopilot-engine`)
- Deadline de **8.5 minutes** (510s) vérifiée avant chaque phase
- Si dépassé → erreur `critical` → pipeline s'arrête proprement
- Protège contre le timeout Edge Function de 150s par invocation

#### FIX #5 — Image après dédup (`autopilot-engine`)
- Image générée APRÈS l'appel `iktracker-actions` (qui fait la dédup Jaccard/Core Topic/Slug)
- Si l'article est rejeté comme doublon, aucune image n'est gaspillée
- L'image est uploadée puis injectée via `update-post` séparé
- Timeout de 30s sur la génération d'image

#### FIX #6 — Enrichissement synthetic items + Semantic Gate (`parmenion-orchestrator` + `autopilot-engine`)
- Les synthetic items injectent désormais `identity_context`, `market_sector`, `target_audience`, `products_services` dans le payload
- Le mot-clé synthétique tombe en fallback sur `products_services` avant le nom de domaine brut
- La description synthétique inclut le résumé complet de la carte d'identité
- **Semantic Gate** dans `autopilot-engine` : après chaque `create-post` réussi, vérifie que ≥15% des termes d'identité (secteur, produits, cible, nom) apparaissent dans le contenu
- Si l'overlap est insuffisant → suppression automatique du post halluciné + log d'erreur + skip
- L'engine récupère désormais `site_name, market_sector, products_services, target_audience, entity_type, commercial_model` depuis `tracked_sites`

#### Migration ponctuelle
- Reset des ~78 items `in_progress` avec `deployed_at IS NULL` et `updated_at < 48h` → `pending`
- Suppression manuelle de l'article halluciné `iktracker-guide-complet-2026`

### Limites
- Max 10 actions CMS par cycle
- Max 4 tool calls par prompt LLM
- 2 prompts LLM max par micro-cycle (technique + contenu)
- 8 items max scorés par cycle (répartis entre les 2 lanes)
- Polling async : 90s max, intervalle 5s
- Watchdog cycle : 8.5 minutes max

### Retry LLM (v3.1)
callLLMWithTools utilise 3 tentatives :
1. Modèle principal + `tool_choice: 'required'` (temp 0.2)
2. Même modèle + `tool_choice: 'auto'` (temp 0.3)
3. Fallback `gemini-2.5-flash` + `tool_choice: 'required'` (temp 0.3)

### Exécution CMS par plateforme
- **IKtracker** : exécution complète (CRUD articles/pages, meta, code, redirections)
- **WordPress/Shopify** : partiel (cms-push-draft, cms-patch-content, cms-push-code)
- **Wix/Webflow** : lecture seule (audit/diagnostic uniquement)
