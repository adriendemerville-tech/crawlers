---
name: Dimensions d'entreprise croisées avec l'offre
description: Carte d'identité étendue (économie, statut légal/SIRENE, effectif, structuration, rôle chaîne de valeur, relation client, mode de livraison) ; seules les dimensions pertinentes au croisement avec les produits/services influencent les questions de benchmark LLM
type: feature
---

`_shared/enterpriseDimensions.ts` — extension de la carte d'identité + arbitrage de pertinence.

## Dimensions
`economy_tier` (primaire/secondaire/tertiaire/quaternaire, dérivé du NAF sinon du lexique), `legal_form`, `siren`, `naf_code`, `employees_range`, `structuration` (independant/franchise/reseau/filiale/groupe/cotee), `value_chain_role` (sous_traitant/donneur_ordre/mixte/direct), `customer_relation` (b2b/b2c/b2b2c/b2g/mixte), `delivery_mode` (saas/app/marketplace/service/conseil/commerce/artisanat/produits/contenu). Chaque dimension porte sa source : `declared` / `sirene` / `derived`.

Statut légal : SIREN/SIRET et forme juridique extraits des mentions légales, puis croisés avec l'API publique gratuite `recherche-entreprises.api.gouv.fr` (aucune clé, jamais bloquant) pour la forme juridique officielle, le NAF, la tranche d'effectifs et le nombre d'établissements.

Remplissage et persistance : `enrichSiteContext` dérive les dimensions après l'inférence, puis écrit `enterprise_dimensions` (jsonb sur `tracked_sites`), `siren_siret` et `legal_structure` via l'Identity Gateway (champs mineurs). `getSiteContext` expose la colonne.

## Règle centrale : toutes les dimensions ne sont PAS pertinentes
`selectBenchmarkDimensions(dims, offre)` croise chaque dimension avec ce qui est réellement vendu et renvoie `{ relevant (poids 1-3 + directive de formulation), ignored (raison) }`.
- `delivery_mode` : toujours décisif (fixe ce que cherche le prospect : outil, artisan, boutique, cabinet…).
- `customer_relation` : retenue seulement en b2b/b2b2c/b2g (le prospect dit son rôle) ; écartée en b2c (un consommateur ne se présente pas).
- `value_chain_role` : retenue seulement si sous-traitance + clientèle pro + offre de type prestation/produit ; jamais pour un SaaS ou un commerce.
- `employees_range` : retenue seulement quand on vend une capacité d'exécution (travaux, conseil, production) ; jamais un chiffre cité dans la question.
- `structuration` : retenue seulement si réseau/franchise/groupe ET offre locale.
- `economy_tier` : jamais écrit littéralement, sert de registre lexical.
- `legal_form`, `siren`, `naf_code` : jamais dans une question (signaux de confiance E-E-A-T uniquement).

## Effets sur les benchmarks
- `benchmarkQuestionWriter` : `dimensionsPromptBlock()` injecte les directives retenues **et** la liste explicite des dimensions interdites.
- `llmBenchmarks` : effet déterministe — sous-traitance pertinente → une question sur neuf est posée par un donneur d'ordre (intention `subcontracting`), en remplacement de la question de contexte.
- Chaque décision est journalisée via `describeDimensionSelection()` (retenues / écartées).
