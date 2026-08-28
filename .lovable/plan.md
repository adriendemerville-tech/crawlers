# Plan réécrit — positions, par ordre d'effet réel

Périmètre : contenu, intention, métadonnées, maillage interne. Aucune action d'acquisition de liens. Les lots sont classés par effet démontrable sur le classement, puis par hygiène.

## Phase A — Les trois leviers qui déplacent réellement un rang

### Lot 1 — Nouvelle page `/api-seo` (effet fort)
Gisement le plus net : ~700 impressions déjà captées par `/developers`, une page produit qui ne répond pas à l'intention informationnelle.

- Nouvelle route `/api-seo` : « API SEO REST : endpoints, formats JSON, quotas, tarifs ».
- Cibles : api seo, seo api, api seo rest, api seo développeur.
- Structure : réponse directe < 40 mots, tableau des endpoints, exemples requête/réponse JSON, quotas, tarifs, FAQ.
- `/developers` reste la page produit : lien descendant depuis `/api-seo` (CTA « Obtenir une clé API »), lien montant depuis `/developers` en ancre « API SEO ».
- Schema `TechArticle` + `FAQPage`, ajout au sitemap et au hub.
- Gain attendu : entrée directe top 10 sous 4-6 semaines, top 6 plausible (difficulté 11-13). ~40-70 clics/mois si atteint.

### Lot 2 — Dé-cannibalisation « crawlers » (effet d'arbitrage)
La home (pos. 8,2) et `/blog/crawler-definition-seo-geo` (pos. 24,5) se disputent la même requête. L'effet est un transfert, pas un gain net : la home monte, l'article reste.

- Home : title/H1/intro recentrés sur la marque + « outil de crawl SEO & GEO », retrait des formulations définitionnelles.
- Article : recentré strictement sur le champ définitionnel (définition, traduction, def, en français), retrait des occurrences « seo crawlers ».
- Lien montant de l'article vers la home, ancre « Crawlers ».
- Contrôle qu'aucune autre page ne porte un title concurrent sur cette intention.
- Gain attendu : home de 8,2 vers 4-6. Pas de gain sur l'article.

### Lot 3 — Enrichissement `/comparatif-crawlers-semrush` (effet de couverture)
Deux requêtes en position 10-13 avec un top 5 faible : gain de couverture réel, pas décoratif.

- Sections : « Semrush Enterprise crawler », « Semrush vs Screaming Frog », « Crawl Semrush : limites et quotas ».
- Tableau comparatif chiffré (volume d'URLs, rendu JS, fréquence, prix).
- FAQ + schema `FAQPage`, maillage vers `/crawl` et `/api-seo`.
- Gain attendu : top 5 sur les variantes ajoutées. ~20-40 clics/mois.

## Phase B — Point de contrôle (6 semaines après le lot 1)

Relevé Search Console sur les requêtes cibles des lots 1 à 3.

- Si `/api-seo` est en top 10 : la mécanique intention/contenu fonctionne, on enchaîne la phase C.
- Si `/api-seo` stagne au-delà de la position 10 malgré une difficulté faible : le facteur limitant n'est pas le contenu. Écrire davantage sur ces clusters n'apportera rien de plus, et la phase C reste de l'hygiène.

## Phase C — Hygiène et couverture (aucune promesse de position)

Regroupe les anciens lots 4 à 7. À exécuter comme maintenance, pas comme levier de rang.

- `/blog/crawler-definition-seo-geo` : intro en réponse directe extractible, H2 « Crawler en français : traduction et équivalents » + tableau des équivalents, schema `DefinedTerm`. Cible Featured Snippet — gain possible en affichage, pas en position.
- `/lexique` : title/H1 alignés sur « glossaire SEO » (sans millésime dans le H1), intro définitionnelle, index alphabétique en SSR, maillage vers `/lexique/$slug`, schema `DefinedTermSet`.
- Guides métiers (artisan / BTP / avocat) : hub `/guides` renforcé, maillage croisé « Autres métiers », FAQ par métier + `FAQPage`. Effet marginal assumé.
- `/visibilite-llm` : sections méthodologiques, blocs `citable-passage`, maillage depuis le hub GEO. Volume ~30/mois — bruit statistique, traité en dernier.
- Les blocs `citable-passage` et les schemas servent la citation IA et l'affichage, pas le classement Google.

## Plafond de gain, chiffré

L'ensemble des cibles totalise ~1 800 recherches/mois, dont « crawler traduction » (~590) qui est définitionnelle et ne convertit pas.

- Phase A seule, si atteinte : ~60-110 clics/mois qualifiés.
- Phase A + C en top 3 partout : ~200-350 clics/mois, majoritairement non commerciaux.
- Conclusion : ce plan gagne des positions et de la couverture, pas nécessairement des clients.

## Détails techniques

- Métadonnées via `head()` TanStack + `src/lib/seo/pageHead.ts` ; titles < 60 caractères marque incluse.
- Nouvelles URLs ajoutées à `sitemap_entries` (source du `sitemap.xml`).
- Contenu rendu côté serveur, aucune section clé derrière un état client.
- Aucun changement de logique métier : contenu, métadonnées, maillage, JSON-LD uniquement.

## Vérification après chaque lot

Titles/H1 en production, absence de doublon d'intention, présence du JSON-LD, puis suivi des positions cibles dans Search Console.
