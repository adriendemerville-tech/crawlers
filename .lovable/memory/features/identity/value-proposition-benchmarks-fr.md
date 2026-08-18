---
name: Proposition de valeur centrale et archétypes de questions
description: value_proposition + secondary_propositions dans la carte d'identité, axe value_prop réservé au benchmark n°1, gabarits de questions directs selon l'archétype (commerce local, service local, SaaS, e-commerce, agence)
type: feature
---

## Carte d'identité
- `tracked_sites.value_proposition` : LA proposition de valeur centrale, phrase courte vue du client, sans marque.
- `tracked_sites.secondary_propositions` : deux propositions secondaires, séparées par " ; ".
- Extraites par `enrichSiteContext.ts` (prompt LLM), écrites via `identityGateway` (champs mineurs), éditables dans `SiteIdentityModal`.
- `needsEnrichment()` renvoie `refresh` quand `value_proposition` est absente (sauf source `user_manual`) : rattrapage unique des cartes anciennes.

## Benchmarks LLM
- `questionTopics.ts` : nouvel axe `value_prop`. La proposition centrale occupe **toujours** le benchmark n°1 ; les propositions secondaires complètent quand la SERP ne fournit pas 3 zones distinctes. `normalizeValueProposition()` tolère 90 caractères et retire les mentions de marque.
- `llmBenchmarks.ts` : quand le site est local (`isLocalQuestionRelevant`), la ville entre dès la question de découverte (« je cherche un fleuriste à … ») ; la question locale du 3e slot passe en « à proximité de … » pour rester distincte.
- `benchmarkQuestionWriter.ts` : `resolveArchetype()` (local_commerce / local_service / software / ecommerce / agency / generic) injecte une directive de style dans le prompt, avec la proposition centrale et les secondaires.
