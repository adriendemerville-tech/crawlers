---
name: Ancrage carte d'identité et question concurrent dans les benchmarks LLM
description: 75 % minimum des 9 questions de benchmark doivent contenir un mot-clé de la carte d'identité (vendu / modèle / cibles) ; une question cite un concurrent nommé pour les modèles non locaux
type: feature
---

## Règle d'ancrage (75 %)
`_shared/llmBenchmarks.ts` :
- `identityKeywords(ctx)` extrait les mots-clés de `products_services`, `value_proposition`, `business_model`, cible principale puis secondaire (sigles courts conservés : seo, geo, aeo, saas, ia…).
- `anchorNeed()` complète tout besoin qui ne contient aucun mot-clé (« agence de référencement naturel » → « … et GEO »). Les jargons de modèle (`saas`, `b2b`, `marketplace`…) comptent pour la couverture mais ne sont **jamais** collés dans une question.
- `keywordCoverage()` journalise le ratio à chaque construction.

`_shared/benchmarkQuestionWriter.ts` :
- la règle des 75 % et la liste de mots-clés sont injectées dans le prompt (reprise littérale, sigles interdits de synonyme) ;
- une reformulation qui perd le mot-clé porté par la version déterministe est refusée ;
- filet final : si la couverture globale retombe sous 75 %, toutes les reformulations non ancrées reviennent au déterministe.

## Question concurrent
- `isCompetitorQuestionRelevant(ctx)` : vrai pour `saas_*`, `ecommerce_*`, `marketplace_*`, `service_agency`, `media_publisher` (fallback `entity_type`). Faux pour les commerces/services de proximité.
- Le premier concurrent de `tracked_sites.competitors` remplace la question `comparison` du dernier bloc : « J'utilise <concurrent> pour <besoin> : propose-moi une alternative et explique pourquoi. » Intention `competitor`, toujours 9 questions au total.
- Le writer refuse toute reformulation qui perd le nom du concurrent.
- `calculate-llm-visibility` transmet `competitors`, `value_proposition` et `secondary_propositions` à `buildLlmBenchmarks`.
