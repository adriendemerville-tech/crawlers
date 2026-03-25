# Memory: features/agents/site-memory-architecture-fr
Updated: now

## Architecture mémoire persistante par site

### Tables
- `site_memory` : clé-valeur structuré par `tracked_site_id` (unique sur tracked_site_id + memory_key)
  - Catégories : preference, insight, objective, context, identity
  - Score de confiance : 0.0–1.0
  - Source : felix, stratege, system
- `identity_card_suggestions` : modifications de carte d'identité en attente de validation
  - Status : pending, accepted, rejected
  - Champs critiques (site_name, market_sector, entity_type, commercial_model) → validation obligatoire
  - Champs mineurs → mise à jour automatique

### Helper partagé : `_shared/siteMemory.ts`
- `readSiteMemory(siteId)` → entries + promptSnippet formaté pour injection LLM
- `writeSiteMemory(siteId, userId, entries, source)` → upsert clé-valeur
- `applyIdentityUpdates(siteId, userId, updates, source)` → mode hybride auto/validation
- `getMemoryExtractionPrompt()` → instructions LLM pour extraction invisible
- `parseMemoryExtraction(response)` → parse le bloc `<!--MEMORY_EXTRACT-->` du LLM
- `getPendingSuggestions(siteId)` → suggestions en attente

### Intégration Félix (sav-agent)
- Lecture : mémoire injectée dans le contexte utilisateur (top 3 sites)
- Écriture : extraction automatique via bloc MEMORY_EXTRACT dans la réponse LLM
- Suggestions pendantes affichées dans le contexte pour rappel

### Intégration Stratège (cocoon-strategist)
- Lecture : mémoire chargée en Phase 0 avant les diagnostics
- Écriture : insights diagnostiques (critiques contenu/sémantique, conflits, axes, recos réussies)
- Auto-enrichissement carte d'identité si champs vides (ex: target_audience déduit de l'analyse sémantique)
