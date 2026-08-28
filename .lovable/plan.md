# Plan séquencé — 6 pages en top 6

Objectif : convertir les positions 10-25 déjà acquises en top 6, sans créer de nouvelle cannibalisation. Ordre par rapport gain/effort, chaque lot est livrable indépendamment.

## Lot 1 — Nouvelle page ressource `/api-seo`
Le plus gros gisement : ~700 impressions déjà acquises sur `/developers` (page produit), difficulté 11-13/100.

- Nouvelle route `/api-seo` : guide « API SEO REST : endpoints, formats JSON, quotas, tarifs ».
- Cible : api seo, seo api, api seo rest, api seo développeur.
- Structure : réponse directe < 40 mots, tableau des endpoints, exemples de requête/réponse JSON, section tarifs, FAQ.
- 2-3 blocs `blockquote.citable-passage` (extraction IA), schema `TechArticle` + `FAQPage`.
- `/developers` reste la page produit : lien descendant depuis `/api-seo` (CTA « Obtenir une clé API ») et lien montant depuis `/developers` en ancre « API SEO ».
- Ajout au sitemap et au hub concerné.

## Lot 2 — Dé-cannibalisation « crawlers » (home ↔ article définition)
La home (pos. 8,2) et `/blog/crawler-definition-seo-geo` (pos. 24,5) se disputent la même requête.

- Home : title/H1/intro recentrés sur la marque + « outil de crawl SEO & GEO ». Retrait des formulations définitionnelles.
- Article : recentré strictement sur le champ définitionnel (définition, traduction, def, en français). Retrait des occurrences « seo crawlers ».
- Lien montant explicite de l'article vers la home, ancre « Crawlers ».
- Vérification qu'aucune autre page ne porte un title concurrent sur la même intention.

## Lot 3 — Enrichissement `/comparatif-crawlers-semrush`
Deux requêtes à difficulté 0/100 en position 10-13 : gain quasi gratuit.

- Sections dédiées : « Semrush Enterprise crawler », « Semrush vs Screaming Frog », « Crawl Semrush : limites et quotas ».
- Tableau comparatif chiffré (volume d'URLs, JS rendering, fréquence, prix).
- Un bloc `citable-passage` par variante, FAQ, schema `FAQPage`.
- Maillage vers `/crawl` et `/api-seo`.

## Lot 4 — Cluster définition (`/blog/crawler-definition-seo-geo`)
~180 impressions en positions 8-13, plus gros volume (crawler traduction : 590/mois).

- Intro réécrite en réponse directe extractible (< 40 mots).
- H2 « Crawler en français : traduction et équivalents » + tableau des équivalents (robot, spider, indexeur).
- Schema `DefinedTerm` sur la définition principale.
- Objectif Featured Snippet.

## Lot 5 — `/lexique` sur « glossaire seo »
140 vol./mois, difficulté 17, position 10,6.

- Title/H1 alignés sur « glossaire SEO » (sans millésime dans le H1).
- Intro définitionnelle, index alphabétique visible côté serveur (SSR), maillage vers les fiches `/lexique/$slug`.
- Schema `DefinedTermSet`.

## Lot 6 — Guides métiers (artisan / BTP / avocat)
Trois requêtes à 0-7/100 en positions 10-14, pénalisées par l'absence de maillage.

- Hub `/guides` renforcé : liste complète, descriptions courtes, liens directs.
- Maillage croisé entre guides métiers (bloc « Autres métiers »).
- Bloc FAQ propre à chaque métier + schema `FAQPage`.
- « seo cabinet avocat » (volume 0) : conservé, non prioritaire.

## Lot 7 — `/visibilite-llm`
Difficulté 0, position 13,5. Renforcement de contenu : sections méthodologiques, blocs `citable-passage`, maillage depuis le hub GEO.

## Détails techniques
- Métadonnées via `head()` TanStack + `src/lib/seo/pageHead.ts` ; titles < 60 caractères marque incluse.
- Nouvelles URLs ajoutées à `sitemap_entries` (source du `sitemap.xml`).
- Contenu rendu côté serveur (pas de section clé derrière un état client) pour rester lisible par les bots.
- Aucun changement de logique métier : uniquement contenu, métadonnées, maillage et JSON-LD.

## Vérification après chaque lot
Contrôle des titles/H1 en production, absence de doublon d'intention, présence du JSON-LD, puis suivi des positions sur les requêtes cibles dans Search Console.
