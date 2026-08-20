# Plan d'action — finition éditoriale des rapports Marina

Objectif : terminer les corrections identifiées dans l'audit du rapport multipages (mes constats + ceux de Claude). Les défauts partagés avec l'audit simple sont déjà corrigés côté moteur ; il reste la couche multipages et trois durcissements transverses.

## Lot A — Sommaire et titres du rapport multipages

Fichier : `src/lib/marina/mergeReports.ts`

- Remplacer le libellé « Identity » du sommaire par « Identité du site » (aucun terme anglais ne doit atteindre le livrable).
- Corriger les espaces avalés à la capture PDF : les intitulés composés du sommaire et des en-têtes utilisent une espace insécable (`Rapport&nbsp;multipages`), comme déjà fait ailleurs.
- Vérifier que chaque entrée du sommaire pointe vers une ancre réellement présente dans le document fusionné (une entrée sans cible est supprimée, pas laissée morte).

## Lot B — Synthèse réseau : lisibilité et non-répétition

Fichier : `src/lib/marina/networkSynthesis.ts`

- Espaces insécables sur « Synthèse&nbsp;réseau » et les autres titres de blocs.
- Déduplication titre / première phrase : quand le titre d'une action reprend mot pour mot le début de sa description, on ne rend que la description.
- Conclusions inter-pages : une même observation déclinée page par page devient une observation unique avec la liste des pages concernées (même principe d'empreinte que le plan d'action).
- Aucun bloc vide : si une des 8 sections n'a aucun fait mesuré, elle affiche « non concluant » avec la raison, plutôt qu'un cadre vide.

## Lot C — Durcissements transverses

- Garde-fou nom propre : déjà en place (`founderNameValidation.ts` interdit qu'une personne de Crawlers soit proposée comme porte-parole d'un domaine tiers). Ajouter un test de non-régression.
- Tableaux plats : vérifier que toutes les distributions DataForSEO passent bien par le rendu tabulaire et qu'aucun JSON brut ne subsiste dans les autres sections.
- Badges de sévérité : contrôler sur un rapport réel qu'aucune phrase courte n'est tronquée par la détection de sévérité en fin de ligne.

## Vérification

1. Relance d'un audit multipages sur `avenir-renovations.fr` (15 URL) et d'un audit simple sur `crawlers.fr`.
2. Contrôle du PDF produit : sommaire en français, titres non collés, plan d'action sans doublons, aucune section vide, aucun JSON brut, aucun nom Crawlers dans les recommandations.
3. Comptage des pages : le rapport multipages doit rester dans l'ordre de grandeur actuel (~150 pages), pas repartir à la hausse.

## Notes techniques

- Aucun appel LLM supplémentaire : tout le lot est déterministe (rendu et déduplication), coût en crédits inchangé.
- Les fichiers touchés sont côté client (`src/lib/marina/*`) ; le moteur edge `marina/index.ts` n'est pas modifié dans ce plan.
