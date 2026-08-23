---
name: GEO en 3 piliers à pondération décroissante
description: GEO décomposé en 10 sous-signaux / 3 piliers (autorité 25 constant, accessibilité 25→10 décroissant, contenu 50→65 croissant), demi-vie 18 mois ancrée 2026-08, score toujours sur 100
type: feature
---

# GEO en 3 piliers à pondération décroissante (remplace le Lot B 2 familles)

## `_shared/geoSubSignals.ts`
Un score GEO global masque trois réalités opposées. Il est décomposé en
**10 sous-signaux répartis en 3 piliers** dont les poids évoluent dans le temps
pour refléter la maturité du marché GEO (le parc de sites se rénove).

**Pilier A — Autorité domaine (25, constant, mutualisé)** : `brand_authority` (14),
`serp_presence` (11).

**Pilier B — Accessibilité machine (25 → 10, décroissant)** : `bot_accessibility`
(14), `structured_data_quality` (12), `content_freshness` (6). Poids ÉLEVÉ
aujourd'hui car beaucoup de concurrents sont mal crawlables ou trop lents ;
avantage **transitoire** qui se commoditise → décroît.

**Pilier C — Exploitabilité contenu (50 → 65, croissant)** : `content_quotability`
(10), `answer_formatting` (8), `knowledge_graph_signals` (10),
`self_citation_signals` (8), `person_authority` (6). Levier durable → monte.
(`knowledge_graph_signals` déplacé de l'autorité ici : levier actionnable en page.)

## Pondération temporelle (déterministe)
- Demi-vie **18 mois**, ancrée au **2026-08-01** (`geoElapsedMonths`).
- `geoPillarTotals(now)` : `authority=25`, `accessibility=10+15×0,5^(t/18)`,
  `content=100−25−accessibility`. **La somme vaut toujours 100.**
- `geoSignalWeightsAt(now)` : poids relatifs fixes par pilier, mis à l'échelle
  pour que chaque pilier totalise son poids courant. Deux audits du même jour
  donnent les mêmes poids (`inputs.now` injectable pour tests/re-rendus datés).

## Règles de calcul
- Un sous-signal non mesuré est exclu du numérateur ET du dénominateur de son
  pilier (`coverage` = poids réellement couvert).
- `geo_score` = moyenne **pondérée** des piliers mesurés par leur poids courant.
- Verdict d'écart (seuil 20) entre le **bloc page** (accessibilité + contenu) et
  l'**autorité domaine** : `authority_lag` / `comprehension_lag` / `both_low` /
  `aligned` / `aligned_strong` / `unknown`.
- Plafonds de cohérence conservés : sous-signaux (quotability ≤15, formatting ≤25,
  structured_data ≤40) + plafond du bloc page à 30 en cas de coquille JS / texte
  quasi nul.
- 3 leviers prioritaires déduits par `poids × (100 − valeur)`. 0 appel LLM.

## Intégration Marina
- Bloc « Le GEO en 10 sous-signaux, 3 piliers » dans la section stratégique :
  3 blocs (score/100, points du jour, tendance), témoin « Pondération au <date> ».
- Fiches page : 3 mini-cells piliers sous le score GEO (`geoPillars`) pour
  restaurer la variance entre URLs — seule l'autorité domaine (25) est mutualisée,
  accessibilité + contenu (75) varient par page.
- Charte respectée : violet #6d28d9, or #8a6d1f, noir, gris ; bordures sans fond
  plein, aucun emoji, aucun bleu IA.
