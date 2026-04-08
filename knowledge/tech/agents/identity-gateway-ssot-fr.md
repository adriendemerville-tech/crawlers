# Memory: tech/agents/identity-gateway-ssot-fr
Updated: just now

L'architecture de la 'Carte d'identité' (`identity_card`) est centralisée via un module 'Identity Gateway' (`_shared/identityGateway.ts`), unique point d'entrée pour toute modification. Il impose des règles strictes : validation par whitelist, protection des sources 'user_manual'/'user_voice', et mode hybride (suggestions pour les champs critiques, update direct pour les mineurs).

## Sources actives (ÉCRITURE via gateway)
- `enrichSiteContext` (auto-remplissage LLM, `forceDirectWrite: true`)
- `voice-identity-enrichment` (audio utilisateur, `forceOverwrite: true`)
- `siteMemory.applyIdentityUpdates()` (Félix/Stratège, mode hybride)
- `expert-audit` → `cms_platform` (détection de 22 CMS)
- `marina` → `market_sector`, `products_services` (contexte stratégique)
- `cocoon-strategist` → `target_audience` (déduit des diagnostics sémantiques)
- `seasonality-detector` → `is_seasonal`, `seasonality_profile`
- `audit-strategique-ia` → `client_targets`, `jargon_distance`
- `parse-matrix-hybrid` → `cms_platform`, `entity_type`, `site_name` (détection HTML post-audit)
- **Différé** : `agent-seo` (limité au suivi interne 'crawlers.fr')

## Fonctions qui LISENT la carte (via getSiteContext)
### Lecture + injection dans les prompts LLM
- `audit-strategique-ia` — Injecte secteur/type/modèle/produits/cible/zone/taille/concurrents dans le prompt (📇 CARTE D'IDENTITÉ)
- `content-architecture-advisor` — Utilise la carte pour contextualiser les recommandations d'architecture
- `generate-prediction` — Override du secteur pour la saisonnalité, injection dans le prompt de prédiction
- `check-llm`, `llm-visibility-lite`, `calculate-llm-visibility`
- `calculate-sov`, `generate-target-queries`
- `sav-agent` (Félix)
- `parmenion-orchestrator` — Enrichit le siteInfo avec secteur/type/modèle/cible/produits/zone pour contextualiser les décisions LLM

### Lecture pour ajustement algorithmique
- `detect-anomalies` — Utilise `is_seasonal`/`seasonality_profile` pour relaxer les seuils Z-score (-25% de sensibilité pour les sites saisonniers)
- `cocoon-strategist` — Utilise la carte via `getSiteContext` (auto-enrichissement) au lieu d'un accès direct DB. Secteur injecté dans les données SERP stratégiques.
- `content-freshness` — `is_seasonal` relâche les seuils d'âge (×1.5) pour les sites saisonniers
- `content-pruning` — Secteur et entity_type ajoutés au summary pour contextualisation
- `drop-detector` — `is_seasonal` relâche le seuil de chute (+25%) et le seuil prédictif (+15%) pour les sites saisonniers
- `backlink-scanner` — Log le secteur et les concurrents pour traçabilité stratégique

### Sources identifiées
`llm_auto`, `llm_verified`, `user_manual`, `user_voice`, `felix`, `stratege`, `seasonality`, `expert_audit`, `agent_seo`, `marina`, `matrix`, `system`
