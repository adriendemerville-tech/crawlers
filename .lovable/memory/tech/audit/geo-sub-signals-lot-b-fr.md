---
name: GEO en 10 sous-signaux (Lot B)
description: Décomposition GEO en 2 familles (compréhension machine / autorité perçue), verdict d'écart, et verdict pilier/satellite sur la cannibalisation
type: feature
---

# Lot B — GEO en 10 sous-signaux + verdict pilier/satellite

## `_shared/geoSubSignals.ts`
Un score GEO global masque deux causes opposées : il est donc décomposé en 10 sous-signaux, 2 familles de 50 points, sans recouvrement.

**Compréhension machine (50)** : `bot_accessibility` (14, mesuré — coquille JS / absences bot-only), `structured_data_quality` (12, mesuré), `content_quotability` (10, testé), `answer_formatting` (8, déduit — H1/FAQ/listes/volume agrégés au crawl), `content_freshness` (6, mesuré).

**Autorité perçue (50)** : `brand_authority` (14, mesuré), `serp_presence` (12, mesuré), `knowledge_graph_signals` (10, testé), `self_citation_signals` (8, déduit), `person_authority` (6, déduit — voix experte nommée=55, corroborée hors site=90).

Règles :
- Un sous-signal non mesuré est exclu du numérateur ET du dénominateur de sa famille (`coverage` indique le poids réellement couvert). Idem pour les composantes de `answer_formatting` : une colonne non collectée au crawl n'est jamais lue comme une absence de balisage.
- `geo_score` lisible = moyenne des deux familles mesurées.
- Verdicts d'écart (seuil 20 points) : `authority_lag` (site lisible, marque peu crédible → levier hors-site), `comprehension_lag` (marque crédible, site mal lisible → levier site), `both_low` (< 40 partout → structurer d'abord, notoriété ensuite), `aligned` / `aligned_strong`, `unknown`.
- 3 leviers prioritaires déduits par `poids × (100 − valeur)`.
- 0 appel LLM : réagrégation de signaux déjà mesurés ou testés ailleurs.

## `_shared/pillarSatelliteVerdict.ts`
Un « risque de cannibalisation /a ↔ /b » ne dit pas quelle page garder. Chaque groupe reçoit un verdict unique, autorité interne = `seo_score + min(40, mots/50) + 3×liens entrants − 2×profondeur` (même formule que `cannibalizationClusters.ts`, pour éviter deux classements contradictoires) :
- `pilier_net` (dominance ≥ 1,25) → 301 des satellites vers le pilier.
- `pilier_conteste` (dominance < 1,25) → arbitrage métier explicite puis fusion.
- `sans_pilier` (meilleure page < 35 pts) → refonte en une page de référence.
- `satellites_legitimes` (intentions déclarées toutes distinctes, ≤ 3 pages) → pas de 301, différenciation des titres et maillage avec ancres variées.

`verdictsFromCocoonRisks(risks, nodes)` recolle les métriques des nœuds du graphe aux URL des risques du cocon.

## Intégration Marina
- Bloc « Le GEO en 10 sous-signaux » inséré dans la section stratégique, juste avant le bloc de visibilité IA (paramètre `geoSubSignalsHtml`).
- Section cocon : le bloc pilier/satellite remplace la liste brute des risques ; repli sur la liste si les métriques de nœuds manquent.
- `buildMultiPageCrawlSnapshot` expose `answerFormatting` (pages avec H1 / FAQ / listes, volume moyen).
- Charte respectée : violet #6d28d9, or #8a6d1f, noir, gris ; bordures sans fond plein, aucun emoji, aucun bleu IA.
