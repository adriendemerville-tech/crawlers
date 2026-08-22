# Plan de correction — fiches par page des rapports Marina multipages

Objectif : rendre chaque fiche URL réellement spécifique à sa page, supprimer les données hors périmètre et les valeurs fausses. Aucun appel LLM supplémentaire : tous les correctifs sont déterministes et réutilisent les faits déjà mesurés et payés.

## Lot 1 — Fin de la pollution par le Workbench (défaut le plus grave)

- Filtrer le plan consolidé de chaque fiche sur l'URL lue et son gabarit : ne conserver que les actions dont la clé stable pointe vers cette URL, plus les actions de portée domaine explicitement étiquetées.
- Séparer visuellement deux zones dans la fiche : « À corriger sur cette page » (URL uniquement) et « Hérité du domaine » (2 lignes max, étiqueté comme tel).
- Garde-fou : si une action mentionne une ville, une marque ou un slug absents de l'URL lue et de son contenu crawlé, elle est écartée de la fiche.
- Test de régression : une fiche ne peut contenir aucune action référençant une autre URL du lot ou hors lot.

## Lot 2 — Actions réellement propres à la page

- Dériver les actions de la fiche des faits déjà mesurés sur cette URL : title/meta, H1, profondeur de clic, liens entrants internes, LCP, poids JS, images sans alt, données structurées présentes/absentes, passages citables détectés.
- Chaque action porte la preuve chiffrée de l'URL (valeur mesurée → cible), sinon elle n'est pas affichée.
- Dédupliquer par empreinte : si la même action est vraie sur plus de la moitié des URLs du lot, elle remonte en synthèse réseau et disparaît des fiches.
- Nettoyage rédactionnel : plus de répétition du titre dans sa description, plus de troncature par « … » (résumé en une phrase complète ou rien).

## Lot 3 — GEO discriminant par URL

- Recalculer le score GEO au niveau page à partir des signaux propres à l'URL (présence de réponses directes, blocs citables, densité entité/attribut, fraîcheur, balisage) au lieu d'hériter une valeur de domaine.
- Afficher la décomposition en sous-scores pour comprendre pourquoi une page est basse.
- Attribuer à chaque URL la question de benchmark où elle performe le mieux, et l'écart avec le meilleur concurrent mesuré sur cette question.
- Si un score n'est pas calculable, écrire « non consolidé » avec la raison, jamais une valeur héritée.

## Lot 4 — Cohérence du benchmark LLM

- Aligner méthode et rendu : soit les 3 zones pondérées sont réellement appliquées, soit la mention des pondérations disparaît. Décision retenue : appliquer les pondérations et les afficher par question.
- Exclure les mots-clés hors zone de chalandise de l'entité auditée (une agence de Saint-Rémy ne se compare pas sur Orléans) : contrôle géographique avant exécution, et purge à l'affichage pour les mesures déjà stockées hors zone.
- Remplacer « Potentiel de citabilité : n/m » par une valeur calculée ou par l'absence de la ligne.

## Lot 5 — Valeurs fausses et colonnes vides

- Ratio code/texte : corriger le calcul (texte visible après suppression des balises, scripts et styles) et ne classer en critique qu'au-delà d'un seuil réellement atteint. Si la mesure échoue, afficher « non mesuré ».
- Colonne « Gain estimé » : soit une fourchette dérivée des données GSC de l'URL (impressions, position, CTR attendu), soit suppression de la colonne. Décision retenue : afficher la fourchette quand GSC est branché, masquer la colonne sinon.
- Maillage du lot : mesurer les liens internes entre les URLs du lot à partir du crawl déjà effectué, pour que les recommandations de pilier soient chiffrées et non « à vérifier ».

## Détails techniques

- Fiche par page et filtrage : `src/lib/marina/ficheDetail.ts`, `src/lib/marina/mergeReports.ts`, `supabase/functions/_shared/marinaPageVerdict.ts`, `supabase/functions/_shared/actionPlanDiscrimination.ts`.
- Synthèse réseau et remontée des actions transverses : `src/lib/marina/networkSynthesis.ts`.
- Benchmark et zones de marché : module de prompts naturels GEO et l'étape de mesure LLM.
- Ratio code/texte et gains : modules de mesure technique partagés (`_shared`).
- Rendu PDF inchangé : la route `/api/render-report-pdf` reste le seul moteur, les corrections sont en amont dans le HTML.
- Tests : étendre les tests Marina existants avec des cas « aucune action hors URL », « GEO non uniforme sur un lot », « ratio code/texte non nul ».

## Ordre et validation

1. Lot 1 (crédibilité), 2. Lot 2, 3. Lot 5 (valeurs fausses), 4. Lot 3, 5. Lot 4.
2. Après chaque lot : régénération du rapport du lot `avenir-renovations.fr` (15 URLs) sans nouvelle mesure, contrôle visuel de 4 fiches.
