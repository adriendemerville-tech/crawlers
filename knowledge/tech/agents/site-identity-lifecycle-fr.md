# Memory: tech/agents/site-identity-lifecycle-fr
Updated: now

Le cycle de vie de la 'Carte d'identité' (identity_card) centralise la connaissance stratégique d'un site.

## Architecture centralisée : Identity Gateway (`_shared/identityGateway.ts`)

**Point d'écriture unique** pour tous les champs identité dans `tracked_sites`.
Aucune fonction n'écrit directement dans la table — tout passe par `writeIdentity()`.

### Fonctionnalités du gateway :
- **Registre de champs** : seuls les champs déclarés (CRITICAL_FIELDS + MINOR_FIELDS) sont acceptés
- **Protection source** : les données `user_manual`/`user_voice` ne sont jamais écrasées par les sources LLM
- **Mode hybride** : champs critiques (site_name, market_sector, entity_type, commercial_model) → `identity_card_suggestions` si valeur existante ; champs mineurs → écriture directe
- **Confidence auto** : recalcul automatique après chaque écriture via `calculateConfidence()`
- **Logging** : trace source + timestamp systématique

### Callers qui NOURRISSENT via le gateway :
- `enrichSiteContext` (auto-remplissage LLM, `forceDirectWrite: true`)
- `voice-identity-enrichment` (audio utilisateur, `forceOverwrite: true`)
- `siteMemory.applyIdentityUpdates()` (Félix/Stratège, mode hybride)
- `cocoon-strategist` (insights diagnostiques)
- `seasonality-detector` (Google Trends)
- `audit-strategique-ia` (cibles/jargon)
- **Prévus** : `expert-audit` (CMS), `agent-seo` (concurrents), `marina-pipeline` (secteur/produits)

### Fonctions qui LISENT la carte (12+) :
Via `getSiteContext` → `ensureSiteContext` : calculate-llm-visibility, check-llm, llm-visibility-lite, agent-seo, expert-audit, content-architecture-advisor, generate-prediction, generate-target-queries, calculate-sov, cocoon-strategist, sav-agent, marina.

### Sources identifiées :
`llm_auto`, `llm_verified`, `user_manual`, `user_voice`, `felix`, `stratege`, `seasonality`, `expert_audit`, `agent_seo`, `marina`, `system`
