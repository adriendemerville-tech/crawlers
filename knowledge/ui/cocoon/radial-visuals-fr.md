# Memory: ui/cocoon/radial-visuals-fr
Updated: 2026-04-14

Le graphique radial du Cocon utilise la profondeur BFS pour le placement des anneaux concentriques. Il intègre un système de **Faisceaux de famille** (Fan Beams) :

## Logique de dimensionnement
Les faisceaux sont calculés **strictement à partir des positions angulaires des nœuds** de chaque cluster :
- **Start/End** : angle exact du premier/dernier nœud du cluster (pas de padding arbitraire)
- **Gap inter-faisceaux** : 0.04 rad (~2.3°) imposé entre faisceaux adjacents non-chevauchants
- **Chevauchement** : autorisé UNIQUEMENT si les nœuds de deux clusters occupent réellement la même zone angulaire (pages partagées ou mal classifiées)
- **Rayon** : maxNodeDist + 20px pour chaque cluster indépendamment

## Rendu visuel
- Wedge flouté (blur 18px) à opacité 14%
- Arc de bordure à opacité 25%, lineWidth 2
- Couleurs : teintes HSL espacées uniformément (360° / nombre de clusters, offset 200°)

## Légende dynamique
Quand les faisceaux sont activés dans les filtres :
- La légende HTML sous le graphe affiche **couleur = Famille "nom" (N pages)**
- Le nom est dérivé du segment d'URL principal du premier nœud du cluster
- Les données de légende sont émises via le callback `onFanBeamLegend`

## Activation
- L'activation des faisceaux dans les filtres désactive automatiquement les particules animées
- Inversement, activer les particules désactive les faisceaux

## Analyse par le Stratège Cocoon
Le Stratège Cocoon analyse les faisceaux selon ces critères :
1. **Taille disproportionnée** (>30% de l'espace angulaire) → cluster trop large, recommander un découpage
2. **Chevauchement** → pages pivot ou mauvaise classification à investiguer
3. **Gaps vides** entre faisceaux → espace sémantique non couvert = opportunité de contenu
