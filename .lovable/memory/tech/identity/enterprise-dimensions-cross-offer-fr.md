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

## Le code NAF ne décide jamais seul
Le NAF est déclaré une fois à l'immatriculation : il ne dit ni l'activité réelle, ni le secteur vécu, ni la place dans la chaîne de valeur. `deriveEnterpriseDimensions` calcule donc `economy_tier` à partir de ce qui est **observé sur le site** (offre, mode de livraison, lexique) et n'utilise le NAF que pour corroborer, via `naf_reliability` = `confirme` / `divergent` / `seul_signal`. En cas de divergence, le site l'emporte et la raison est journalisée. `naf_code`, `legal_form` et `siren` restent interdits dans une question.

## Ordre de résolution du mode de livraison
`deliveryFromContext` est ordonné, l'ordre étant structurant : (1) statuts qui l'emportent — `service_public`, `association`, `profession_liberale` (y compris via forme juridique SELARL/SELAS/SCIC/EPIC) ; (2) modèle déclaré — `saas`, `marketplace`, `commerce` (boutique en ligne) ; (3) métiers lisibles dans l'offre — `artisanat`, `conseil` (coaching inclus), `produits`, `commerce`, `contenu`, `app` ; (4) repli faible `service`.

## Règle centrale : toutes les dimensions ne sont PAS pertinentes
`selectBenchmarkDimensions(dims, offre)` croise chaque dimension avec ce qui est réellement vendu et renvoie `{ relevant (poids 1-3 + directive de formulation), ignored (raison) }`.
- `delivery_mode` : toujours décisif (fixe ce que cherche le prospect : outil, artisan, boutique, praticien, démarche administrative…).
- `customer_relation` : retenue seulement en b2b/b2b2c/b2g ; écartée en b2c.
- `value_chain_role` : hors sujet **par construction** pour `ROLE_IRRELEVANT_DELIVERY` = saas, app, marketplace, commerce (dont boutique en ligne), conseil/coaching, contenu, profession libérale, association, service public — la dimension n'est même pas dérivée (valeur `direct`). Retenue seulement si sous-traitance + clientèle pro + offre `service`/`artisanat`/`produits`.
- `employees_range` : retenue seulement quand on vend une capacité d'exécution (`artisanat`, `service`, `produits`) ; jamais un chiffre cité dans la question.
- `structuration` : retenue seulement si réseau/franchise/groupe ET offre de proximité.
- `economy_tier` : jamais écrit littéralement, sert de registre lexical.
- `legal_form`, `siren`, `naf_code` : jamais dans une question (signaux de confiance E-E-A-T uniquement).

## Effets sur les benchmarks
- `benchmarkQuestionWriter` : `dimensionsPromptBlock()` injecte les directives retenues **et** la liste explicite des dimensions interdites.
- `llmBenchmarks` : effet déterministe — sous-traitance pertinente → une question sur neuf est posée par un donneur d'ordre (intention `subcontracting`), en remplacement de la question de contexte.
- Chaque décision est journalisée via `describeDimensionSelection()` (retenues / écartées).
