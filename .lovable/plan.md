# Matrice Concurrence — outil gratuit (lead magnet)

Une matrice à double entrée, gratuite et sans compte : en lignes le site cible + ses concurrents (classés par la taxonomie), en colonnes les 20 mots-clés qui structurent le marché dans Google **et** dans les IA. Chaque cellule dit qui couvre, qui couvre mal, qui ne couvre pas.

Différenciateur vs Sorank / Ahrefs Content Gap : la colonne « citation IA réellement mesurée » et la classification des concurrents par nature, pas seulement par SERP.

## Ce que voit l'utilisateur

1. Champ URL + (optionnel) 1 à 3 concurrents. Sinon détection automatique.
2. Écran d'attente avec étapes visibles (identité, concurrents, mots-clés, SERP, IA).
3. Résultat : matrice heatmap.
   - Lignes : site cible en tête, puis concurrents groupés par type.
   - Colonnes : 20 mots-clés, triés par valeur marché.
   - Cellule : position Google + citation IA, avec 4 états — **couvert** (top 10 ou cité), **faible** (11-30 ou mention sans lien), **absent**, **non applicable**.
   - Bandeau de synthèse : nb de mots-clés perdus face à chaque concurrent, mots-clés « no man's land » (personne ne couvre = opportunité).
4. Trois blocs de lecture : *Ce que tu couvres bien / mal / pas du tout*.
5. Export CSV et lien de partage après saisie de l'email (le lead magnet).

## Taxonomie des concurrents (lignes de la matrice)

| Type | Définition | Source de détection |
|---|---|---|
| Concurrent métier | même produit/service, même marché | identity card + recherche sectorielle |
| Concurrent de visibilité | rank Google/IA sur tes mots-clés, offre différente | SERP + réponses LLM |
| Concurrent silencieux | même offre, aucune visibilité | recherche annuaire/sectorielle |
| Substitut fonctionnel | besoin identique, moyen différent | LLM sur le besoin, pas sur le produit |
| Goliath | plateforme dominante, menace indirecte | dominance SERP + autorité |

Les trois premiers types entrent dans la matrice. Substituts et Goliaths sont listés à part (hors scoring) pour ne pas écraser la heatmap.

## Sélection des 20 mots-clés

Le marché, pas seulement le domaine cible. Union pondérée de :
- mots-clés sur lesquels le domaine cible rank déjà (couverture réelle),
- mots-clés des concurrents que le cible n'a pas (le gap),
- requêtes réellement posées aux IA sur le besoin (formulations naturelles, sans le mot « site »).

Filtrage : intention commerciale ou informationnelle utile, volume > seuil, dédoublonnage sémantique. Puis coupe à 20 par valeur = volume × pertinence métier ÷ difficulté.

## Mesure IA

Deux moteurs seulement, les deux qui pèsent : **Gemini** et **ChatGPT**. Chaque mot-clé est posé en **3 itérations** (même protocole que le benchmark GEO existant), et la cellule retient le taux de citation sur les 3 passages, pas un tirage unique — c'est ce qui distingue une citation stable d'un hasard.

Contrainte de coût assumée : 3 itérations × 2 moteurs, ce n'est pas gratuit. On mesure donc les **10 mots-clés à plus forte valeur** ; les 10 autres restent marqués « non mesuré » (état explicite, jamais inventé). Cache 24 h par couple mot-clé/moteur, mutualisé avec le pool existant.

## Ligne « AI Overviews — position 0 »

Ligne dédiée en haut de la matrice, avant même le site cible : pour chaque mot-clé, les noms de domaine cités par l'AI Overview de Google. C'est le vrai occupant de la position 0, souvent invisible dans un rapport de gap classique.

- Domaine cible cité → cellule mise en avant en or.
- Concurrent cité → son nom apparaît dans la cellule, et sa ligne est marquée « présent en position 0 ».
- Aucun AI Overview déclenché sur la requête → état explicite, distinct de « personne cité ».

Un bloc de synthèse liste les domaines les plus cités en position 0 sur l'ensemble des 20 mots-clés : c'est la carte des vrais gagnants du marché dans la recherche générative.


## Garde-fous produit

- Aucune projection de trafic chiffrée du type « +22 950 visites/mois » : on montre des relevés, pas des promesses.
- Toute cellule non mesurée est marquée comme telle.
- Quota : 1 matrice par IP et par jour sans compte, email requis pour l'export et le partage.
- Résultat mis en cache par domaine 24 h pour éviter de repayer les mêmes appels.

## Détails techniques

- Page publique `/matrice-concurrence` (route TanStack + `head()` propre, indexable, contenu SEO au-dessus du formulaire).
- Nouvelle fonction backend d'orchestration asynchrone (job en base + polling), réutilisant :
  - `_shared/strategicAudit/socialDiscovery.ts` et l'identity card pour le type « métier » et le périmètre local,
  - `_shared/dataForSeoStrategic.ts` (`fetchRankedKeywords`, `fetchMarketData`, `checkRankings`) pour SERP et volumes,
  - `strategic-competitors` et `analyze-content-gap` pour l'amorce concurrents/gap,
  - le pool de benchmark LLM existant pour les citations IA, avec la cascade de résilience déjà en place.
- Table dédiée `competitor_matrix_jobs` (+ résultats) avec RLS `auth.uid()` pour les comptes, et lecture par token opaque pour les sessions anonymes ; GRANT explicites.
- Quota IP sur le même modèle que `marinaFree.functions.ts`.
- Front : réutilisation de la famille `MatriceCanvas` avec un nouveau variant `competitor` (heatmap + vue par concurrent + cube 3D), pas de composant heatmap dupliqué.
- Design : violet / or / noir / blanc, boutons bordure + texte, aucun emoji, aucun bleu IA.

## Découpage

1. Schéma + job asynchrone + quota IP.
2. Résolution des concurrents typés.
3. Sélection des 20 mots-clés marché.
4. Relevés SERP puis relevés IA sur le top 10.
5. Variant `competitor` de la matrice + page publique + SEO.
6. Export CSV, capture email, partage.
