---
name: Lot A — signaux de confiance machine
description: Détection déterministe des affirmations à risque, des autorités citées hors compétence et des URLs mortes priorisées, calculée au crawl et restituée dans Marina
type: feature
---

# Lot A — surclaims, autorité citée, URLs mortes

Calcul 100 % déterministe (0 token LLM) au moment de la finalisation du crawl
(`_shared/crawlQueue/finalizer.ts`), persisté dans `site_crawls.content_integrity` :

- `risk_claims` — `_shared/trustClaims.ts` / `detectRiskClaims()`. 5 catégories :
  `conformite`, `garantie`, `validation`, `superlatif`, `securite`. Sévérité
  `critical` uniquement si le secteur normalisé est régulé
  (finance_assurance, juridique, sante_medical, immobilier,
  education_formation, energie_environnement) ET catégorie
  conformite/validation/garantie.
- `authority_mismatch` — `detectAuthorityMismatch()`. Table curée sujet →
  institution compétente vs institutions citées à tort (barème kilométrique :
  DGFiP/BOFiP vs URSSAF ; RGPD : CNIL vs ANSSI/DGCCRF ; prestations maladie :
  CPAM vs URSSAF ; rénovation énergétique : ADEME/ANAH ; droit conso : DGCCRF).
  Aucun constat si l'institution compétente est déjà citée dans la page.
- `dead_urls` — `_shared/deadUrls.ts` / `analyzeDeadUrls()`. 4 constats
  priorisés : canonical vers page morte (critical), liens internes vers page
  morte (important), pages mortes atteignables (suggestion), liens cassés
  sortants (suggestion).

Restitution Marina : `summarizeCrawlIntegrity()` transporte
`riskClaims` / `authorityMismatch` / `deadUrls` ; les constats entrent dans
`eeatFindings` (surclaims + autorité) et `seoFindings` (URLs mortes), donc dans
le plan consolidé et `architect_workbench`. Encart `trustSignalsBlockHTML()`
inséré en tête de la section E-E-A-T.

Règle dure : chaque constat porte l'extrait exact et l'URL en preuve. Aucun
constat n'est émis sur inférence.
