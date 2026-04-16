---
name: Editorial Pipeline 4-étages
description: Pipeline éditorial à 4 étages (briefing → stratège → rédacteur → tonalisateur) avec routage LLM par domaine × type de contenu
type: feature
---

# Pipeline éditorial 4-étages

## Architecture

**Service partagé** : `supabase/functions/_shared/editorialPipeline.ts`
- Exporte `runEditorialPipeline(supabase, input)` qui orchestre les 4 étages.
- Exporte `AVAILABLE_MODELS` et `CONTENT_TYPES` consommés par l'UI.

**Wrapper HTTP** : `supabase/functions/editorial-pipeline-run/index.ts`
- Endpoint authentifié pour invoquer le pipeline depuis n'importe quel client.
- CRITICAL : utilise `auth.userId` (JWT), jamais le `user_id` du body.

## Les 4 étages

| Étage | Rôle | Modèle par défaut |
|---|---|---|
| 0. Briefing | Agrège workbench + keyword_universe + seasonal_context + business_profile | (pas de LLM) |
| 1. Stratège | Définit angle, plan, intent, longueur cible | Gemini 2.5 Flash → GPT-5 selon complexité |
| 2. Rédacteur | Produit le titre + contenu HTML + excerpt | Gemini Flash Lite → GPT-5 Mini |
| 3. Tonalisateur (optionnel) | Réécrit selon `voice_dna.signature` si force > 0.6 | Gemini Flash Lite |

## Routage LLM (cascade)

1. **Override manuel** dans le payload (`override_models`)
2. **Règle DB** : `editorial_llm_routing` (par user × domain × content_type)
3. **Défaut auto** : matrice `CONTENT_TYPE_BASE_TIER` × `estimateSiteComplexity()` (basé sur `crawl_pages_count`)

## Tables

- `editorial_llm_routing` : matrice user × domain × content_type → 3 modèles (RLS strict)
- `editorial_briefing_packets` : snapshots étage 0 pour replay/audit
- `editorial_pipeline_logs` : observabilité par run_id × stage (tokens, latence, coût)

## UI

**Console > Content > onglet "Routage LLM"** (`EditorialLLMRoutingMatrix.tsx`)
- Sélecteur de domaine + matrice 7 types × 3 étages
- Auto par défaut, override par cellule
- Save = upsert, Reset = delete les rows fully-auto

## Intégrations actuelles

- **Social Hub** (`generate-social-content`) : opt-in via flag `use_editorial_pipeline=true`. Fallback automatique vers le legacy en cas d'erreur.
- **Parménion + Content Architect** : NON intégrés (risque trop élevé sur 3500 lignes de logique tool-calling/quotas/async). À faire en sprint dédié avec tests.

## Comment appeler depuis une edge function

```ts
import { runEditorialPipeline } from '../_shared/editorialPipeline.ts';

const result = await runEditorialPipeline(supabase, {
  user_id: auth.userId,
  domain: 'iktracker.fr',
  tracked_site_id: 'uuid',
  content_type: 'blog_article',
  user_brief: 'optionnel',
});

// result.final.title / result.final.content / result.pipeline_run_id
```

## Comment appeler depuis le client

```ts
const { data } = await supabase.functions.invoke('editorial-pipeline-run', {
  body: {
    domain: 'iktracker.fr',
    tracked_site_id: '...',
    content_type: 'blog_article',
  },
});
```
