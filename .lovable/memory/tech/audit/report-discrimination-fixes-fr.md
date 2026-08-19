---
name: Discrimination des constats dans les rapports d'audit
description: Correctifs de crédibilité Marina — détection FAQ tolérante aux balises, impact modulé par famille, autorité de page recalculée, verdicts pilier/satellite départagés, modèle d'affaires jamais « non résolu » sans raison
type: feature
---
Correctifs appliqués aux rapports (Marina + audit stratégique) pour supprimer les constats génériques ou contradictoires :

1. **FAQ** : la détection (`audit-expert-seo/index.ts`) extrait le texte des headings balises retirées et croise avec `h2Contents`/`h3Contents` du crawl. Un motif `[^<]` produisait un faux négatif « aucune FAQ » alors que le crawl listait le H2.
2. **Comptage H2** : le rapport affiche `h2Count` mesuré et précise « extrait de N intitulés relevés » quand la liste est plus courte — plus de deux chiffres contradictoires.
3. **Impact 0-100** (`_shared/roiWeighting.ts`) : table `FAMILY_IMPACT` par famille de consigne (`fingerprintFinding`) + second levier à demi-poids. Auparavant gravité `critical` + un seul bonus = 68/100 sur presque toutes les actions.
4. **Gains de trafic** (`_shared/topPriorities.ts`) : libellé « gain direct attribuable », mention « hors effet de déblocage » sur les actions critiques, interdiction explicite d'additionner les valeurs.
5. **Autorité de page** (`marina/index.ts`) : la colonne du tableau du graphe retombe sur `pageAuthority()` (même formule que le verdict pilier/satellite), astérisque pour valeur recalculée, `n/m` sans signal. Plus de colonne à 0 partout.
6. **Verdict pilier contesté** (`_shared/pillarSatelliteVerdict.ts`) : `tieBreaker()` choisit le critère de départage réellement mesuré (liens entrants, volume, profondeur, score on-page, écart relatif ≥ 10 %) ou déclare explicitement qu'aucun signal ne départage. Plus de phrase identique sur tous les groupes.
7. **Modèle d'affaires** (`_shared/sectorTaxonomy.ts`) : `normalizeCommercialModel` lit aussi `products_services`, `target_audience`, `value_proposition`, et retombe sur une table secteur → modèle. « Non résolu » ne doit jamais coexister avec un arbitrage qui s'en sert.
