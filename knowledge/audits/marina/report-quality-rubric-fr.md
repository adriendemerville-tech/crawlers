# Grille de notation d'un rapport Marina — « niveau agence » sur 100

Objectif : noter un livrable d'audit comme le ferait un directeur de conseil SEO relisant
le rapport d'un consultant junior. La note ne mesure pas la santé du site auditée, mais la
**qualité du livrable**.

## 1. Axes et pondérations (base 100)

| # | Axe | Poids | Ce qui est noté |
|---|-----|-------|-----------------|
| A | Fiabilité factuelle et cohérence interne | 25 | Aucun chiffre ne se contredit d'une section à l'autre ; les verdicts sont compatibles entre eux ; le périmètre annoncé est celui réellement mesuré |
| B | Couverture diagnostique | 15 | Technique, on-page, sémantique, maillage, autorité, marché, GEO/AEO, conversion |
| C | Priorisation et actionnabilité | 20 | Actions dédoublonnées, séquencées, effort et impact crédibles, propriétaire et KPI de suivi |
| D | Éditorialisation du livrable | 15 | Français homogène, aucun champ brut (`snake_case`, anglais, JSON), pas de remplissage tabulaire |
| E | Preuves et sourcing | 10 | Chaque affirmation renvoie à une mesure, une source datée ou est marquée non concluante |
| F | Discrimination des scores | 10 | Les échelles séparent réellement les cas : pas de score plafonné malgré des blocages critiques, pas d'impact identique partout |
| G | Valeur différenciante | 5 | Apport qu'une agence classique ne produit pas (citabilité IA, risque zéro-clic, red team) |

Chaque axe est noté au prorata, puis on applique les pénalités.

## 2. Pénalités forfaitaires (cumulables, plancher 0)

| Défaut | Pénalité |
|---|---|
| Fuite de prompt, de variable ou de contenu système dans le livrable | −5 |
| Recommandation factuellement fausse ou inapplicable telle quelle | −3 par occurrence, max −9 |
| Contradiction chiffrée entre deux sections | −2 par occurrence, max −8 |
| Recommandation datée d'une année passée présentée comme actuelle | −2 |
| Action répétée à l'identique dans le plan d'action | −1 par doublon, max −5 |

## 3. Échelle de lecture

| Note | Interprétation |
|---|---|
| 90-100 | Livrable signable en l'état par une agence senior |
| 75-89 | Bon livrable, une relecture de forme suffit |
| 60-74 | Diagnostic solide mais livrable à retravailler avant remise client |
| 40-59 | Audit outillé brut : données riches, rédaction et cohérence non tenues |
| < 40 | Export de données, pas un audit |

## 4. Application — avenir-renovations.fr, 16/08/2026 (46 pages)

| Axe | Note | Justification |
|---|---|---|
| A | 10/25 | SEO technique 98/100 alors que trois constats critiques (LCP 3,8 s, TBT 408 ms, ratio texte 7 %) ; « aucun défaut bloquant propre à cette URL » face à « 12 blocages critiques » ; 10 pages orphelines listées contre 28 annoncées par le stratège ; couverture « 80 % » du crawl face à 925 URL de sitemap ; toxicité « saine » alors que le GEO parle d'empreinte artificielle |
| B | 12/15 | Couverture large et supérieure à un audit technique classique ; manque conversion/UX et données GSC réelles |
| C | 8/20 | Cinq actions sur douze sont la même recommandation ; toutes les actions sont « Critique » avec impact 100/100 ; les exemples de réécriture concatènent des titres sans rapport ; ni propriétaire ni KPI de suivi |
| D | 6/15 | Sections entières livrées en champs bruts : `readiness level: developing`, `toxicity score`, `Missing Terms`, `Red Team (Adversarial)`, `Quotes` ; tableaux de 100 URL tronquées et 205 liens sémantiques sans valeur de lecture |
| E | 8/10 | Sources nommées et datées, section « Portée et limites » explicite, autorité présentée comme estimation propriétaire |
| F | 3/10 | Impact 100/100 sur les douze actions, sévérité « Critique » partout, 65 clusters dont une majorité à une page |
| G | 5/5 | Citabilité IA, risque zéro-clic, intention conversationnelle, red team, benchmark concurrentiel qualifié |
| **Sous-total** | **52** | |

Pénalités : fuite de prompt dans la section Quotabilité (« CONTENU PAGE: , , Utilise ces
informations pour identifier le core business ») −5 ; extraction du méga-menu présentée comme
« premier paragraphe de 727 mots » −3 ; recommandations calées sur 2024 −2 ; doublons du plan
d'action −4 (plafonné à la marge déjà décomptée en C, on ne compte ici que −4).

**Note finale : 38/100** — soit la frontière basse de « audit outillé brut ».

## 5. Corrections à plus fort effet sur la note

1. Dédoublonner le plan d'action par empreinte de recommandation (gain estimé +6).
2. Retirer le boilerplate avant l'analyse du premier paragraphe (+5).
3. Rendre les échelles discriminantes : impact calculé, sévérité dérivée du signal (+7).
4. Traduire et éditorialiser les blocs GEO bruts, supprimer les tableaux de remplissage (+8).
5. Réconcilier les compteurs entre modules (orphelines, périmètre, toxicité) (+8).
6. Interdire toute année codée en dur et toute chaîne de prompt en sortie (+7).
