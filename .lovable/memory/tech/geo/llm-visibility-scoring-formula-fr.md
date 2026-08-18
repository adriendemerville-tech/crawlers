---
name: Formule de score visibilité LLM
description: Couverture binaire + Wilson 95%, qualité pondérée par axe (ranked ×2,0 / covered ×1,5 / demand ×1,0), fiabilité par nombre de runs, et bloc potentiel GEO vs citation mesurée
type: feature
---

# Score de visibilité LLM — trois grandeurs séparées

Module unique : `supabase/functions/_shared/llmVisibilityScore.ts`.
Consommateurs : `calculate-llm-visibility` (calcul), `marina` (rendu).

## 1. Couverture (taux de citation brut)

```
observations = questions_mesurées × modèles_mesurés   (pannes exclues du dénominateur)
hits         = interrogations où la marque apparaît (toute itération)
taux         = hits / observations
```
Toujours accompagné de l'**intervalle de Wilson à 95 %** (`wilsonInterval`).
Exemple : 6 hits / 27 → 22 % [11 % ; 41 %]. Le rapport affiche la fourchette,
jamais le point seul.

## 2. Qualité (composite 0-100, hiérarchique et pondérée)

```
score_question = moyenne des compositeScore des modèles
score_axe      = moyenne des 3 score_question de l'axe
score_global   = Σ(poids × score_axe) / Σ(poids des axes mesurés)
```
Poids diagnostiques (`AXIS_WEIGHTS`) :
- `ranked` ×2,0 — 1er sur Google et invisible en IA = signal le plus fort
- `covered` ×1,5 — conversion de la couverture éditoriale
- `identity` ×1,5 — repli quand la donnée SERP est faible
- `demand` ×1,0 — potentiel non capté, **jamais un échec**

Un axe non mesuré est exclu du numérateur ET du dénominateur.

## 3. Fiabilité

`assessReliability(observations, runs, stdDev)` : `insufficient` / `low` (1 run) /
`medium` (≥2 runs) / `solid` (≥3 runs et écart-type < 10 pts). Le libellé
`caveat` est affiché sous le score.

## Interdits

- Compter un prompt non mesuré (panne modèle) comme un 0.
- Afficher un score ponctuel sans sa fourchette ni son niveau de fiabilité.
- Traiter une absence sur `demand` avec la même sévérité qu'une absence sur `ranked`.

## Rapport au score GEO

Le score GEO (`_shared/citationScorer.ts`) mesure un **potentiel** de citabilité
de façon déterministe (SERP, données structurées, fraîcheur, autorité). Il
n'intègre **pas** la mesure LLM, et ne doit pas l'intégrer : mélanger un
indicateur déterministe et un indicateur stochastique rendrait le GEO instable.

`comparePotentialVsMeasured(potentiel, taux_mesuré)` interprète l'écart, rendu
dans un bloc dédié du rapport Marina :
- écart ≥ +25 → `notoriety_gap` : fondations en place, frein = notoriété d'entité
- écart ≤ −25 → `structure_gap` : notoriété en avance, levier = structure
- les deux < 35 → `both_low` : structurer d'abord, notoriété ensuite
- sinon → `aligned`
