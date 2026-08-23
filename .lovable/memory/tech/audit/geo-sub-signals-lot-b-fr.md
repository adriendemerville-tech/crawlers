---
name: GEO en 3 piliers, barème fixe 25 / 22 / 53
description: GEO décomposé en 10 sous-signaux / 3 piliers à barème FIXE (autorité domaine 25, accessibilité machine 22, exploitabilité contenu 53), score sur 100, tableau de décomposition dans le rapport Marina
type: feature
---

# GEO en 3 piliers, barème fixe 25 / 22 / 53

## `_shared/geoSubSignals.ts`
Un score GEO global masque trois réalités. Il est décomposé en **10 sous-signaux
répartis en 3 piliers** à **poids fixes** (plus de décroissance temporelle : deux
audits, quelle que soit leur date, se comparent directement).

- **Pilier A — Autorité domaine (25 pts, mutualisé)** : `brand_authority` (rel 14),
  `serp_presence` (11).
- **Pilier B — Accessibilité machine (22 pts, page)** : `bot_accessibility` (14),
  `structured_data_quality` (12), `content_freshness` (6).
- **Pilier C — Exploitabilité contenu (53 pts, page)** : `content_quotability` (10),
  `answer_formatting` (8), `knowledge_graph_signals` (10), `self_citation_signals` (8),
  `person_authority` (6).

`GEO_PILLAR_POINTS = { authority: 25, accessibility: 22, content: 53 }` (somme 100).
`geoPillarTotals(now)` retourne ce barème quelle que soit la date (`now` conservé pour
compatibilité). `geoSignalWeightsAt()` met à l'échelle les poids relatifs internes pour
que chaque pilier totalise son poids. 75 des 100 pts dépendent de la page auditée.

## Règles de calcul
- Un sous-signal non mesuré est exclu du numérateur ET du dénominateur de son pilier.
- `geo_score` = moyenne pondérée des piliers mesurés par leur poids.
- Verdict d'écart (seuil 20) entre bloc page (accessibilité + contenu) et autorité domaine.
- Plafonds de cohérence conservés (quotability ≤15, formatting ≤25, structured_data ≤40,
  bloc page ≤30 en coquille JS / texte quasi nul). 0 appel LLM.

## Rendu Marina
- Tableau de décomposition (`pillarTableHTML`) : par pilier, ses sous-signaux avec leur
  poids en points, le poids du pilier, son score /100, les points acquis ; ligne de total
  à 100 pts. Colonne « Barème » = poids fixe.
- Cartes de piliers + mini-cells `geoPillars` par fiche URL pour la variance.
- Charte : violet #6d28d9, or #8a6d1f, noir, gris ; bordures sans fond plein, aucun emoji.
