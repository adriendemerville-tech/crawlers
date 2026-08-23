---
name: GEO en 3 piliers, barème 25 / 22→17 / 53→58
description: GEO décomposé en 11 sous-signaux / 3 piliers — autorité domaine 25 constante, accessibilité machine 22 puis −1 pt par tranche de 18 mois jusqu'au plancher 17, contenu = le reste (53 → 58) ; ancre 2026-08-23, score toujours sur 100
type: feature
---

# GEO en 3 piliers, barème 25 / 22→17 / 53→58

## `_shared/geoSubSignals.ts`
Un score GEO global masque trois réalités. Il est décomposé en **11 sous-signaux
répartis en 3 piliers**, avec une **décroissance en marches** de l'accessibilité
machine : être crawlable est un différenciateur aujourd'hui, il se commoditise à
mesure que le parc de sites se rénove.

- **Pilier A — Autorité domaine (25 pts, constant, mutualisé)** : `brand_authority`
  (rel 14), `serp_presence` (11).
- **Pilier B — Accessibilité machine (22 → 17 pts, page)** : `bot_accessibility`,
  `structured_data_quality`, `ai_bot_policy`, `content_freshness`. `ai_bot_policy`
  note l'autorisation nommée des robots IA et détecte le throttling (429/403) ;
  `structured_data_quality` intègre la complétude du nœud d'identité `Organization`
  (adresse, contact, sameAs) pour 35 % du signal, et une décote sur les réponses
  non-200 sans corps utile. Le gate `geo_bot_policy` remonte en tête du workbench.

- **Pilier C — Exploitabilité contenu (53 → 58 pts, page)** : `content_quotability` (10),
  `answer_formatting` (8), `knowledge_graph_signals` (10), `self_citation_signals` (8),
  `person_authority` (6).

Courbe : ancre `GEO_WEIGHTS_ANCHOR_ISO = 2026-08-23`,
`geoAccessibilityPoints(now) = max(17, 22 − floor(mois/18))`,
`content = 100 − 25 − accessibility`. Le barème est **stable par tranche de 18 mois**
(deux audits d'une même tranche se comparent directement) et la somme vaut toujours
100. `geoSignalWeightsAt()` met à l'échelle les poids relatifs internes pour que
chaque pilier totalise son poids courant. 75 des 100 pts dépendent de la page auditée.


## Règles de calcul
- Un sous-signal non mesuré est exclu du numérateur ET du dénominateur de son pilier.
- `geo_score` = moyenne pondérée des piliers mesurés par leur poids.
- Verdict d'écart (seuil 20) entre bloc page (accessibilité + contenu) et autorité domaine.
- Plafonds de cohérence conservés (quotability ≤15, formatting ≤25, structured_data ≤40,
  bloc page ≤30 en coquille JS / texte quasi nul). 0 appel LLM.

## Rendu Marina
- Tableau de décomposition (`pillarTableHTML`) : par pilier, ses sous-signaux avec leur
  poids en points, le poids du pilier, son score /100, les points acquis ; ligne de total
  à 100 pts. Colonne « Barème » = tendance (constant 25 pts / −1 pt par 18 mois,
  plancher 17 pts / monte vers 58 pts). La note de bas de bloc date le barème.

- Cartes de piliers + mini-cells `geoPillars` par fiche URL pour la variance.
- Charte : violet #6d28d9, or #8a6d1f, noir, gris ; bordures sans fond plein, aucun emoji.
