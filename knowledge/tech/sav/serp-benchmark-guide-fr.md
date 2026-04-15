# SAV — Benchmark SERP Multi-Providers

## Qu'est-ce que c'est ?
Le **Benchmark SERP** compare les résultats de recherche Google entre plusieurs fournisseurs de données (DataForSEO, SerpApi, Serper.dev, Bright Data). Il permet de détecter les écarts de positions et les résultats "anti-scraping" renvoyés par Google.

## Où le trouver ?
**Console > Indexation** → Section "Benchmark SERP Multi-Providers" en bas de page.

## Comment l'utiliser ?
1. **Sélectionner les providers** : Cliquer sur les chips pour activer/désactiver (minimum 2)
2. **Entrer un mot-clé** : Ex: "agence seo"
3. **Domaine cible** (optionnel) : Pour le mettre en surbrillance dans les résultats
4. **Localisation** : France par défaut, autres pays disponibles
5. **Single-hit penalty** : Pénalise les sites trouvés par un seul provider (20 pts par défaut)
6. Cliquer **Lancer le benchmark**

## Comment lire les résultats ?
- Chaque colonne = un provider SERP
- Les chiffres = position dans les résultats Google selon ce provider
- **—** = le provider n'a pas trouvé ce site
- **SERP Réelle Moyenne** = position moyenne pondérée (la colonne la plus importante)
- Les couleurs indiquent la qualité : vert (top 3), bleu (top 10), orange (top 20), rouge (>20)

## FAQ

**Q: Pourquoi les positions diffèrent entre providers ?**
Google personnalise ses résultats selon le datacenter, la localisation exacte, et détecte les bots scraping. Chaque provider passe par des serveurs différents et peut obtenir des résultats légèrement différents.

**Q: Qu'est-ce que le "Single-hit penalty" ?**
Si un site n'apparaît que chez 1 seul provider sur 4, c'est peut-être un faux positif (résultat anti-scraping de Google). La pénalité ajoute 20 points à sa position moyenne pour le faire descendre dans le classement.

**Q: Un provider affiche "Not configured", que faire ?**
Le provider n'a pas de clé API configurée. Contactez l'administrateur pour l'ajouter.

**Q: Combien ça coûte en crédits API ?**
Chaque benchmark consomme 1 requête par provider activé. Avec 3 providers, 1 benchmark = 3 appels API.

## Accès
- Réservé aux utilisateurs **Pro Agency** et supérieurs
- Nécessite un site tracké sélectionné dans Console
