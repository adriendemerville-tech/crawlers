---
name: Discrimination et cohérence des rapports Marina (Lot 7)
description: Impact non saturé, gains de trafic répartis, barème technique 220 réconcilié, Top-3 non répétés, clusters nommés, candidats fondateur non cités
type: feature
---
Correctifs déterministes (0 token LLM) appliqués après la critique du rapport avenir-renovations.fr :

- `_shared/roiWeighting.ts` : bases de gravité abaissées (critical 58, important 40, suggestion 24, optional 20, low 14) et plafond d'impact à 97. Un « impact 100/100 » partout n'est plus possible ; les modulateurs mesurés (écart au seuil, volume, position, périmètre, performance propriétaire) redeviennent discriminants.
- `_shared/actionPlanDiscrimination.ts` : `distributeTrafficGains()` répartit le gain d'un même levier (même empreinte + même gain) entre ses actions au lieu de le recopier, et l'explicite dans la base de calcul. Appelé en fin de `buildConsolidatedActionPlan`.
- Barème de l'audit technique : `expert-audit` renvoie `maxScore: 220` (40 + 50 + 60 + 50 + 20), le vrai total atteignable. Le bloc « Détail des scores » de Marina affiche les cinq axes (sécurité incluse), la somme, et la conversion sur 100 utilisée par la synthèse exécutive.
- Redondance : quand un plan d'action consolidé existe, les Top-3 de section (SEO, GEO, mots-clés, E-E-A-T, cocon) ne sont plus réinjectés dans chaque section ; la phrase de synthèse ROI n'apparaît qu'en synthèse exécutive et en conclusion.
- `_shared/reportEditorial.ts` : `clusterDisplayName` dérive un nom des URL/titres des pages du cluster (tokens fréquents, stop-words FR) avant de tomber sur « Thématique non nommée ».
- Porte-parole : tant qu'aucun fondateur n'est corroboré par une page du domaine, les noms candidats ne sont plus cités, seulement comptés.
