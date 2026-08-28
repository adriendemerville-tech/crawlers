# Matrice de concurrence — faire entrer les leaders du marché

## Le diagnostic

Ton intuition est juste, et la cause racine est identifiée : ce n'est pas un problème de données, c'est un problème d'ordre des étapes et de règle de tri.

1. **Les leaders sont explicitement exclus.** Le type `goliath` (grande plateforme dominante) est envoyé dans `outOfScope`, donc hors matrice. Semrush, Ahrefs, SEranking sont proposés puis jetés.
2. **Les concurrents sont figés avant tout relevé SERP.** L'ordre actuel est identité → concurrents → mots-clés → SERP. Un domaine qui occupe les positions 0 à 5 du marché ne peut donc jamais entrer dans la matrice, puisque personne ne regarde la SERP au moment où la liste est arrêtée.
3. **La détection de visibilité est biaisée vers les pairs.** `competitors_domain` trié par `sum_position,asc` remonte les domaines de même gabarit, pas les dominants.

Ton séquencement est le bon : il fait de la SERP la source des concurrents, au lieu d'une simple vérification a posteriori.

## Ce que je propose de construire

Deux passes SERP au lieu d'une, avec la liste de concurrents arrêtée entre les deux.

```text
1  Carte d'identité (inchangée)
2  Mots-clés d'amorçage      = ranked_keywords du domaine cible + requêtes IA
3  SERP passe 1 (amorçage)   = relevé sur ~10 requêtes à plus fort volume
4  Détection des acteurs     = leaders (positions 1-5 + AI Overviews récurrents)
                              + pairs de visibilité (DataForSEO)
                              + concurrents métier (LLM, vérifiés en SERP)
5  Mots-clés du marché       = union cible + leaders + pairs, dont quick wins
6  SERP passe 2 (matrice)    = relevé complet sur les 20 colonnes finales
7  Citations IA              = ChatGPT / Gemini / Claude (inchangé)
```

### Règles de classement

- Nouveau type `leader` : domaine présent en position 1-5 sur au moins 3 requêtes d'amorçage, ou cité par l'AI Overview sur au moins 3 requêtes. Affiché en tête de matrice, distinct du concurrent métier.
- Un `goliath` confirmé par la SERP est requalifié en `leader` et entre dans la matrice. `outOfScope` ne garde plus que les substituts fonctionnels non vus en SERP.
- Quotas de lignes : 2 leaders, 3 concurrents métier, 2 concurrents de visibilité, 1 silencieux (8 lignes max).

### Quick wins

Un mot-clé où la cible est en position 11-30 alors qu'un leader est en 1-5 est marqué `quickWin`. Ces colonnes sont priorisées dans la sélection des 20 et signalées dans la synthèse : ce sont les tests de position les plus rentables.

## Coût

Le coût DataForSEO augmente d'une passe SERP d'amorçage (~10 requêtes). En contrepartie, la passe 2 est mieux ciblée. Les appels LLM restent à 2 (concurrents + requêtes IA) et les citations IA à 9 appels : pas d'augmentation côté crédits.

## Détails techniques

- `serp.server.ts` : extraire `seedSerp()` (profondeur 10, sans AI Overview async) réutilisant `dfsPost`.
- Nouveau `leaders.server.ts` : agrégation des occurrences 1-5 et AI Overview → `Competitor[]` de type `leader`, source `serp`.
- `competitors.server.ts` : ajouter `leader` à la taxonomie, requalifier `goliath` vu en SERP, revoir les quotas dans `mergeCompetitors`.
- `keywords.server.ts` : `selectMarketKeywords` prend les domaines leaders et pondère les quick wins.
- `matrix.functions.ts` : insérer les étapes `seed_keywords` et `seed_serp` avant `competitors`, recalibrer les paliers de progression.
- `types.ts` / `build.ts` / `MatriceConcurrence.tsx` : nouveau type, libellé, badge quick win.
- Invariant conservé : aucune case n'est inventée, `not_measured` n'est jamais converti en `absent`.
