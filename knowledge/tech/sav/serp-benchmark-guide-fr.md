# SAV — Benchmark SERP Multi-Providers

## Qu'est-ce que c'est ?
Le **Benchmark SERP** compare les résultats de recherche Google entre 4 fournisseurs de données (DataForSEO, SerpApi, Serper.dev, Bright Data). Il permet de détecter les écarts de positions et les résultats "anti-scraping" renvoyés par Google.

## Où le trouver ?
- **Page gratuite** : `/app/ranking-serp` (accessible sans compte, benchmark avec les 4 providers)
- **Console complète** : Console > Indexation → Section "Benchmark SERP Multi-Providers" en bas de page

## Modes d'analyse : Batch vs Cible

Le benchmark propose deux modes via un sélecteur dans la barre d'outils :

### Mode Batch
Analyse automatique de toutes les URLs du site tracké sélectionné. Utile pour scanner l'ensemble des pages indexées et détecter les anomalies de positionnement à grande échelle. Le système récupère les URLs depuis les données de crawl existantes.

### Mode Cible
Analyse d'une URL spécifique saisie manuellement. Utile pour vérifier le positionnement d'une page précise ou d'un concurrent. L'utilisateur entre l'URL dans le champ dédié puis lance l'analyse.

## Comment l'utiliser ?
1. **Sélectionner les providers** : Cliquer sur les chips pour activer/désactiver (minimum 2, 4 disponibles)
2. **Entrer un mot-clé** : Ex: "agence seo"
3. **Domaine cible** (optionnel, Console uniquement) : Pour le mettre en surbrillance dans les résultats
4. **Localisation** : Échelle géographique (pays, région, département, ville) avec France par défaut
5. **Single-hit penalty** : Case à cocher activant une pénalité fixe de +20 points (non modifiable par l'utilisateur)
6. Cliquer **Analyser**

## Comment lire les résultats ?
- Chaque colonne = un provider SERP (DataForSEO, SerpApi, Serper, Bright Data)
- Les chiffres = position dans les résultats Google selon ce provider
- **—** = le provider n'a pas trouvé ce site
- **SERP Réelle Moyenne** = position moyenne pondérée (la colonne la plus importante)
- Les couleurs indiquent la qualité : vert (top 3), bleu (top 10), orange (top 20), rouge (>20)

## FAQ

**Q: Quelle est la différence entre Batch et Cible ?**
Le mode **Batch** lance une analyse sur l'ensemble des URLs connues de votre site (issues du dernier crawl). Le mode **Cible** permet de vérifier une seule URL précise. Utilisez Batch pour un panorama global, Cible pour un diagnostic ponctuel.

**Q: Pourquoi les positions diffèrent entre providers ?**
Google personnalise ses résultats selon le datacenter, la localisation exacte, et détecte les bots scraping. Chaque provider passe par des serveurs différents et peut obtenir des résultats légèrement différents.

**Q: Qu'est-ce que le "Single-hit penalty" ?**
Si un site n'apparaît que chez 1 seul provider sur 4, c'est peut-être un faux positif (résultat anti-scraping de Google). La pénalité fixe de +20 points est ajoutée à sa position moyenne pour le faire descendre dans le classement. Cette valeur n'est pas modifiable — elle est calibrée sur les standards d'analyse SERP.

**Q: Un provider affiche "Not configured", que faire ?**
Le provider n'a pas de clé API configurée. Contactez l'administrateur pour l'ajouter.

**Q: Combien ça coûte en crédits API ?**
Chaque benchmark consomme 1 requête par provider activé. Avec 4 providers, 1 benchmark = 4 appels API.

## Accès
- Page gratuite : accessible à tous (lead magnet)
- Console complète : réservé aux utilisateurs **Pro Agency** et supérieurs avec un site tracké sélectionné
