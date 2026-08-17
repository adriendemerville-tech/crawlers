---
name: Règles des questions de visibilité LLM
description: Censure obligatoire de la marque/domaine dans les prompts LLM + question locale réservée aux modèles d'affaires ancrés territorialement
type: feature
---

## Censure marque/domaine (non négociable)
`_shared/naturalPrompts.ts` applique `buildBrandScrubTerms(domain, [brand_name, site_name, ...])` et `scrubBrandFromText()` :
1. sur les champs de la carte d'identité (market_sector, products_services, target_audience, media_specialties) — ils contiennent souvent le nom commercial ;
2. en filet de sécurité final sur `prompts` et `followUps`.
Les connecteurs orphelins (« avec », « chez », « by »…) sont nettoyés. Mots génériques (web, site, shop, france, pro, agence…) exclus de la censure pour ne pas vider les questions.

## Question locale — éligibilité par business_model
Éligibles : `service_local`, `leadgen`, `nonprofit`.
Non éligibles : `saas_b2b`, `saas_b2c`, `marketplace_*`, `ecommerce_b2c`, `ecommerce_b2b`, `media_publisher`, `service_agency` — un service en ligne est servi partout, une question géolocalisée y produit une mesure fausse (bascule sur l'intention « audience »).
Fallback sans business_model : `entity_type` (saas/ecommerce/marketplace/media/blog = non éligible).
Une `commercial_area` nationale/internationale (France, Europe, en ligne, monde…) désactive aussi le local.

Exports : `isLocalQuestionRelevant(ctx)`, `scrubBrandFromText`, `buildBrandScrubTerms`.
Consommateurs : `calculate-llm-visibility`, `check-llm` (passent business_model + brand_name + site_name).
