---
name: Garde-fous de cohérence des rapports Marina
description: Canonisation des Web Vitals, justifications différenciées par levier, toxicité backlinks hors-sujet, concurrents marché dans la carte d'identité, disclaimer d'échantillon GEO
type: feature
---
Correctifs de crédibilité appliqués aux rapports Marina (0 token LLM) :

- **Web Vitals — une mesure, un format.** `_shared/auditReconciliation.ts` expose `canonicalizeWebVitals` / `formatVitalSeconds` (format `X,XX s`, virgule FR). Appelé depuis `reconcileReportHtml` via `facts.webVitals` (source : `expertData.scores.performance`). Interdit les « 5.5s / 5.4s / 5.48s / 5776ms » pour la même métrique. Les seuils recommandés (« sous 2,5 s ») ne sont pas réécrits.
- **Justifications de trafic différenciées.** `_shared/actionPlanDiscrimination.ts` : table `LEVER_BY_FAMILY` + formule exposée (levier, % d'effet, périmètre en pages). Deux actions sans rapport ne peuvent plus partager la phrase « estimation depuis N recherches/mois ».
- **Titres jamais coupés en milieu de phrase.** `_shared/topPriorities.ts` / `splitLongTitle` coupe en priorité sur une fin de phrase réelle, sinon sur `:` / `—`, jamais sur `, ` / `pour` / `afin`. La recapitalisation du reste n'a lieu que si c'est une phrase autonome ; sinon le titre est suffixé `…` et le fragment garde sa casse.
- **Toxicité backlinks.** `_shared/domainAuthority.ts` / `detectSuspiciousReferringDomains` : motifs paris, adulte, miroirs, warez, pharma, wallpapers. Un seul référent hors-sujet interdit le verdict `sain` (plancher `a_surveiller`) et les domaines concernés sont nommés dans la recommandation.
- **Concurrents dans la carte d'identité.** `renderIdentityCardHTML` accepte un 4e argument `marketCompetitors` (issu de `strategicData.competitive_landscape`), affiché sur une ligne distincte de « Concurrents cités par le site ». Fin de la contradiction « Non résolu » vs section GEO qui en liste quatre.
- **Représentativité GEO.** Le bloc « Questions posées aux modèles » affiche questions × modèles = interrogations ; sous 8 questions, le score est explicitement présenté comme un indicateur de tendance, pas une part de voix.
