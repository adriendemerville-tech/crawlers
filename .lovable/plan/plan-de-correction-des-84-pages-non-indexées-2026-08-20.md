# Plan de correction des 84 pages non indexées

Objectif : lever les causes réelles de non-indexation (similarité, contenu mince, titles tronqués), puis renforcer la citabilité IA et la performance mobile. On corrige les gabarits (effet sur des dizaines de pages) avant les pages une à une.

## Lot 1 — Débloquer l'indexation (priorité)

1. **Consolidation du cluster dupliqué**
   - Choisir un article pilier, y fusionner les angles utiles des quasi-doublons, dépublier les autres et poser des redirections 301 vers le pilier.
   - Retirer les URLs dépubliées du sitemap, ajouter le pilier.
2. **Double H1 dans le gabarit article** : un seul `<h1>` (le titre de l'article), les autres passent en `<h2>`. Correction dans le composant, pas article par article.
3. **Titles et descriptions** : réécriture des 45 titles > 65 caractères et des 4 descriptions hors plage (50–160). Marque en suffixe court, mot-clé en tête.
4. **Guides métier trop semblables** : différencier réellement les 8 guides (données propres au métier, exemples, FAQ spécifique, section chiffrée). Sans cela, Google continuera de les regrouper — inutile de demander l'indexation avant.

## Lot 2 — GEO et données structurées

5. **Bloc citable dans les gabarits lexique et article** : `blockquote.citable-passage` généré à partir de la définition / du chapeau, donc présent sur les 36 fiches et les 13 articles d'un coup.
6. **FAQPage** sur les gabarits lexique et article (2 à 4 questions issues du contenu, jamais inventées) — uniquement quand les questions existent réellement dans la page.
7. **Auteur / E-E-A-T** : `Person` + `ProfilePage` sur les pages auteur, et `author` (Person) + `dateModified` sur les articles.
8. **Trous ponctuels** : JSON-LD sur `/developers/sdks` et `/auteur/adrien-de-volontat` ; aligner `/comparatif-plateforme-seo-ia` sur ses deux jumelles (Article + FAQPage).

## Lot 3 — Contenu mince

9. Enrichir les 22 pages < 350 mots, en commençant par celles qui ont un potentiel de requête : `/faq`, `/extension`, `/developers/sdks`, les 14 fiches lexique courtes, `/auteur`. Cible : 500 mots utiles minimum, avec tableau ou liste exploitable par un LLM.

## Lot 4 — Performance mobile

10. **Réduire le JS des gabarits publics** : les 110 Ko inutilisés viennent de code applicatif importé dans les pages publiques. On isole les imports fautifs et on les charge en différé (lazy) côté app uniquement.
11. **LCP** : préchargement de l'image héro, dimensions explicites, polices en `font-display: swap` avec preload du seul poids critique.
12. **CLS `/guide/restaurant-seo` (0,094)** : réserver la hauteur des blocs qui se montent après hydratation.

## Lot 5 — Vérification

13. Re-scan du HTML servi (titles, H1, JSON-LD, bloc citable, comptage de mots) et Lighthouse mobile sur un échantillon des 5 gabarits.
14. Seulement ensuite : demandes d'indexation dans Search Console, par vague et par gabarit.

## Détails techniques

- Gabarits concernés : `src/routes/blog/$slug.tsx` + `src/pages/Blog/ArticlePage`, `src/routes/lexique/$slug.tsx` + `src/pages/Lexique/ExpertTermPage`, `src/routes/guide/$slug.tsx` + `src/components/Guide/GuideTemplate.tsx`, `src/routes/auteur/*`.
- Le head reste géré par `pageHead()` et `src/lib/seo/articleSchema.ts` (pas de second mécanisme).
- Les 301 passent par le mécanisme de redirection existant du projet ; les entrées sitemap se gèrent en base (`sitemap_entries`), `lastmod` restant nul sauf révision réelle.
- Aucun bloc citable ni FAQ inventé : ils sont dérivés du contenu existant, sinon absents.

## Ordre proposé

Lot 1 d'abord (c'est lui qui débloque l'indexation), puis Lot 2, puis 3 et 4. Dis-moi si tu veux que je commence directement par le Lot 1 complet ou seulement par la consolidation du cluster.
