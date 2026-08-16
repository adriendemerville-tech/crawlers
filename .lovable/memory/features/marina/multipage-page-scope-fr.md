---
name: Marina multipages — périmètre page vs domaine
description: Crawl/cocon/indexation/visibilité IA mutualisés au domaine ; score technique, score GEO et recos cocon propres à chaque URL ; conclusion intermédiaire par URL + synthèse exécutive globale en tête du rapport fusionné
type: feature
---
Règle non négociable en mode multipages Marina :

- **Mutualisé (domaine, `data-marina-scope="site"`)** : crawl multi-pages, archétypes, cocon global, santé d'indexation, visibilité dans les moteurs de réponse IA, intro méthodologique, divulgation, portée et limites.
- **Propre à chaque URL (`data-marina-scope="page"`)** : score SEO technique, score GEO, plan d'action page, et le bloc `cocoon_page` — recommandations de maillage dérivées de la position réelle de l'URL dans le graphe (cluster, liens entrants/sortants, orphelinage, cannibalisation, liens à ajouter). Ces scores ne sont **jamais** moyennés entre URLs.

`supabase/functions/_shared/marinaPageVerdict.ts` (0 token LLM) :
- `buildPageVerdictHTML()` → bloc `page-verdict` placé **en tête de la partie qui concerne l'URL** (avant la section SEO technique). Il porte ses métriques en `data-marina-page-meta` (JSON encodé en URI).
- `buildCocoonPageFocusHTML()` → bloc `cocoon_page`, placé juste après le cocon site.
- `extractCocoonPageFacts()` / `pageKey()` → appariement d'URL insensible au protocole, au `www` et au slash final.

`src/lib/marina/mergeReports.ts` : lit les `data-marina-page-meta`, construit une **synthèse exécutive globale** en tête du document fusionné en trois temps — (1) le domaine (verdict stratégique remonté depuis le bloc `verdict`), (2) tableau de reprise des conclusions intermédiaires par URL, (3) liens entre URLs (dispersion de scores, GEO/tech faibles partagés = défaut de gabarit, URLs d'un même cluster, maillage entrant faible). Le bloc `summary` de périmètre page est retiré des fiches dès qu'un `page-verdict` existe (anti-redondance).
