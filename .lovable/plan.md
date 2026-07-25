# Plan d'action SEO/GEO crawlers.fr

Basé sur le diagnostic Semrush (AS 6/100, 8 mots-clés FR, profil de liens partiellement toxique). Priorisé par ROI : quick wins de ranking d'abord, assainissement en parallèle, contenu de fond ensuite.

## Lot 1 — Assainissement du profil de liens (P0, en parallèle)

Objectif : stopper le signal négatif Google avant d'accélérer.

1. **Générer le fichier `disavow.txt`** avec les domaines toxiques identifiés :
   - `photoshop-school.org` (124 liens depuis 1 domaine à AS 5)
   - Domaines PBN/spam repérés dans les ancres "buy backlinks", "premium PBN"
   - `wibngiftliken.blogspot.com`, `factmags.com`, `allwebsitesdirectory.com`, `australianwebdirectory.shop`, `bestwebstats.com`, `domain.com.lc`, `domainanalysis.org`
2. **Étendre la liste** via un audit complet des 102 referring domains (via connecteur Semrush si besoin d'export bulk).
3. **Fournir un guide de dépôt** dans Google Search Console (fichier + procédure).

## Lot 2 — Quick wins : faire passer les pages presque en top

Cibles identifiées par Semrush, à 1-2 positions du top 3.

### 2.1 `/comparatif-crawlers-semrush` — "crawl semrush" (pos 5 → top 3)
- Étoffer le comparatif : tableau détaillé fonctionnalités × prix × cas d'usage.
- Ajouter section "Quand choisir Semrush vs Crawlers" (intent commercial).
- JSON-LD `ComparisonTable` + FAQ (5 questions transactionnelles).
- Ajout de 2-3 captures annotées (alt SEO).

### 2.2 `/blog/crawler-definition-seo-geo` — "crawlers" / "crawler seo" (pos 10 → page 1)
- Passer de définition courte à guide long-form (≥ 1500 mots).
- H2/H3 dédiés : "crawler SEO", "crawler GEO", "types de crawlers", "outils".
- Ajouter table des matières + JSON-LD `Article` + `FAQPage`.
- Lien interne fort depuis la home + `/comparatif-crawlers-semrush`.

### 2.3 `/blog/json-ld-snippet-autorite` — "json ld" (pos 16 → page 1)
- Enrichir avec exemples concrets (Article, FAQ, Product, HowTo).
- Blocs code copiables + validateur intégré si possible.
- Cibler aussi "schema.org exemple", "structured data".

## Lot 3 — Alignement Slug / H1 / mots-clés cibles

Pages piliers avec désalignement identifié à l'audit précédent :

- `/architecte-generatif` : réaligner H1 + contenu FR complet (traduction).
- `/breathing-spiral` : idem, contenu encore trop anglais.
- Vérifier densité mot-clé cible (2-3 %) sur chaque page produit.

## Lot 4 — Élargir l'empreinte lexicale (8 → 50+ mots-clés)

Créer/enrichir 5 pages autour de requêtes à intent clair :
- "audit SEO GEO"
- "outil GEO IA"
- "optimisation LLM SEO"
- "crawler IA"
- "monitoring GPTBot / Perplexity"

Chaque page : 1200+ mots, JSON-LD, breadcrumbs, 3 liens internes minimum.

## Lot 5 — Autorité (long terme)

- Digital PR : 3-5 études de données propriétaires publiables (ex. "% de sites bloquant GPTBot en France").
- Backlinks propres via mentions presse SEO/IA.
- Guest posts sur 2-3 blogs SEO FR à AS > 40.

## Détails techniques

- Disavow : format standard Google, un domaine par ligne préfixé `domain:`.
- Enrichissement piliers : édition dans `src/pages/*` ou `src/data/blogArticles.ts` selon la route.
- JSON-LD : via `react-helmet-async` comme les articles existants.
- Densité mot-clé : viser 2-3 % sur le kw principal, plus variantes sémantiques.

## Ordre d'exécution recommandé

1. Lot 1 (disavow) — immédiat, effet en 2-4 semaines.
2. Lot 2.1 + 2.2 en priorité (66 % + 22 % du trafic actuel).
3. Lot 3 en parallèle (dette technique).
4. Lot 2.3 puis Lot 4.
5. Lot 5 en fond continu.

## Hors périmètre

- Refonte design / UX.
- Modification du modèle de facturation ou features produit.
- Migration de domaine (crawlers.fr reste primaire).

Dis-moi par quel lot j'attaque — je recommande de démarrer par le **Lot 1 (disavow)** en parallèle du **Lot 2.1 (page comparatif Semrush)** pour un impact rapide.