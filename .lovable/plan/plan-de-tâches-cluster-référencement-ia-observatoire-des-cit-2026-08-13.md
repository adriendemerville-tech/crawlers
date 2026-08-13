# Plan de tâches — Cluster « référencement IA » + Observatoire des citations IA

Objectif : passer de 0 visibilité sur le cluster GEO/« référencement ia » à une autorité thématique défendable par la donnée, et corriger les 3 anomalies techniques repérées.

## Lot 0 — Correctifs techniques (rapides, gains immédiats)

1. **Trafic `/app/site-crawl` en fuite** — la route publique `/site-crawl` existe déjà. Il faut :
   - vérifier qu'elle contient bien le contenu éditorial ciblant « crawl website », « site crawler », « crawl wordpress » (H1, sections, FAQ) ;
   - ajouter une redirection 301 `/app/site-crawl` → `/site-crawl` pour les visiteurs non connectés, et un lien canonique croisé ;
   - confirmer que `/site-crawl` est bien dans le sitemap et indexable.
2. **Variante `?lang=es` encore indexée** (position 34) — le `noindex` SSR est en place mais l'URL reste dans l'index. Ajouter la demande de suppression via l'outil d'inspection GSC (action manuelle listée) et vérifier que la variante renvoie bien `X-Robots-Tag: noindex` + canonical vers la version FR.
3. **Cannibalisation home ↔ `/blog/crawler-definition-seo-geo`** — l'article ranke 8-10, la home 20/23/39/80 sur les mêmes requêtes « crawler(s) ». Correctif : désoptimiser la home sur « crawler » (title/description/H1 recentrés sur la promesse produit « référencement IA / visibilité dans les moteurs IA ») et laisser l'article porter le terme, avec lien article → home.

## Lot 1 — Pilier « Référencement IA »

Nouvelle page `/referencement-ia` (route TanStack avec `head()` dédié) :
- H1 « Référencement IA : le guide GEO pour ChatGPT, Perplexity et Gemini » ;
- structure : définition, différences SEO vs GEO, comment les IA choisissent leurs sources, ce qui se mesure, méthode Crawlers, chiffres réels issus du module GEO, FAQ ;
- JSON-LD `Article` + `FAQPage` + `BreadcrumbList` ;
- passages citables (`blockquote.citable-passage`) pour la reprise par les LLM ;
- maillage : vers `/observatoire`, `/generative-engine-optimization`, `/geo-vs-seo`, `/score-geo`, l'étude de cas iktracker et l'app.

## Lot 2 — Observatoire des citations IA (le vrai gisement)

Deux requêtes à volume réel et concurrence nulle :

| Requête | Volume | Concurrence |
|---|---:|---|
| domaines les plus cités par les moteurs ia | 390/mo | 0 |
| types de contenus cités par les moteurs ia | 480/mo | 0 |

Travail sur la page `/observatoire` existante :
- ajouter deux sections chiffrées et datées : **classement des domaines les plus cités** et **répartition des types de contenus cités** (guides, comparatifs, forums, docs, actualités) ;
- alimentation par les données GEO déjà collectées (agrégation en lecture, mise à jour périodique) ;
- affichage tableaux + méthodologie explicite (période, échantillon, moteurs couverts) et section « Portée et limites » ;
- JSON-LD `Dataset` + `Article`, passages citables, date de mise à jour visible ;
- créer deux pages d'atterrissage dédiées si le volume le justifie, sinon ancrer les deux requêtes sur des sections H2 de `/observatoire` (choix retenu : sections H2, pour éviter la dilution).

## Lot 3 — Satellites du cluster (4 fiches)

Fiches courtes et distinctes, chacune maillée vers le pilier :
- « SEO IA : ce qui change concrètement »
- « Référencement ChatGPT : comment être cité »
- « Visibilité IA : les indicateurs à suivre »
- « Agence / prestataire référencement IA : ce qu'il faut exiger » (capte l'intention transactionnelle ~150/mo)

Vérifier avant écriture qu'aucune fiche ne recouvre une page existante (`/optimisation-llm-seo`, `/visibilite-llm`, `/outil-geo-ia`, `/lexique/*`) — sinon renforcer l'existante plutôt que créer un doublon.

## Lot 4 — Contrôle et mesure

- Régénérer le sitemap, vérifier canonicals et absence de variantes `?lang=`.
- Passer l'audit de cannibalisation interne (skill `detect_content_cannibalization`) sur le nouveau cluster.
- Relever la baseline GSC (impressions/positions) sur les requêtes ciblées avant/après, pour mesurer sur 30 jours.

## Détails techniques

- Routes : `src/routes/referencement-ia.tsx` (nouvelle), `src/routes/observatoire.tsx` (enrichie), `src/routes/site-crawl.tsx` (vérification), `src/routes/index.tsx` (métadonnées recentrées).
- Métadonnées via `head()` TanStack + `src/lib/seo/pageHead.ts` uniquement.
- Design : violet / or / noir / blanc, boutons bordure + texte sans fond, aucun emoji, pas de bleu.
- Agrégations GEO en lecture seule côté serveur, aucune écriture nouvelle en base sauf besoin de cache d'agrégat.

## Ordre d'exécution proposé

Lot 0 → Lot 2 → Lot 1 → Lot 3 → Lot 4.
Raison : les correctifs stoppent une fuite de trafic existante, et l'observatoire est le contenu le plus défendable et le moins concurrentiel.
