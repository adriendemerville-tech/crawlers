---
name: features/cms/dictadevi-context-injection-fr
description: Injection auto du contexte Dictadevi (knowledge/lexicon/catalog-ranges) dans le Writer Parménion pour ancrer normes, prix et vocabulaire métier sur sources réelles.
type: feature
---

# Injection contexte Dictadevi dans le Writer

Pour les domaines `dictadevi.*`, le Stage 2 Writer (`editorialPipeline.ts`) appelle automatiquement les 3 endpoints `/api/parmenion/{knowledge|lexicon|catalog-ranges}` exposés par Dictadevi via le client shared `supabase/functions/_shared/dictadeviContext.ts`.

- **Auth** : `Authorization: Bearer ${DICTADEVI_API_KEY}` (secret Edge Functions)
- **Base URL** : `DICTADEVI_API_URL` (default `https://dictadevi.io`)
- **Timeout** : 8s, retry 1× sur 5xx/network, log explicite sur 429
- **Query** : 1er mot-clé du brief (ou angle stratégique en fallback)
- **Tolérance** : si l'un des 3 endpoints échoue, le pipeline continue sans bloquer

Le contexte est sérialisé dans le prompt sous balise `<dictadevi_context>` avec règles strictes :
- Toute norme citée DOIT référencer le `source_reference` exact
- Tout prix DOIT venir des `catalog_ranges` (aucune invention)
- Vocabulaire EXACT du lexique réutilisé pour la longue traîne SEO

Une section `<section class="sources">` est ajoutée en fin d'article avec les `source_reference` cités + `disclaimer` du catalog.
