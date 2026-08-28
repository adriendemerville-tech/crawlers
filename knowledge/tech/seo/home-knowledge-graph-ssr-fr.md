# Graphe de connaissance de la home — rendu côté serveur

Doc technique du JSON-LD de `/` et de la découvrabilité machine (sitemap, `llms.txt`).

Dernière mise à jour : 2026-08-28.

---

## 1. Problème corrigé

Le graphe de la home était injecté par un hook client (`useStructuredData`, dans un
`useEffect`). Conséquence : **absent du HTML servi**, donc invisible pour Googlebot
comme pour les crawlers IA (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot…) qui
n'exécutent pas le JavaScript. Seul un nœud `Organization` était crawlable, en double
(root + `Footer.tsx`).

Le hook `src/hooks/useStructuredData.ts` a été **supprimé** ; le bloc `Organization`
codé en dur dans `Footer.tsx` également. Ne pas les réintroduire.

## 2. Architecture actuelle

| Fichier | Rôle |
| --- | --- |
| `src/lib/seo/organization.ts` | Nœud `Organization` complet, émis **sitewide** depuis le root. Les autres graphes le référencent par `@id` (`ORGANIZATION_REF`). |
| `src/lib/seo/homeSchemas.ts` | Graphe de la home : `SoftwareApplication`, `ItemList` des outils, `ItemList` des API, `FAQPage`. |
| `src/lib/seo/pageHead.ts` | Option `jsonLd` de `pageHead()` → injection SSR via `head()` TanStack. |
| `src/routes/index.tsx` | `pageHead({ ..., jsonLd: homeJsonLd })`. |

Invariants :

- **Aucun `WebSite` ni `Organization` dans `homeSchemas.ts`** : ils sont déjà émis par le
  root, un doublon casse la résolution d'entité côté moteurs.
- Tout nouveau schéma de page passe par `pageHead({ jsonLd })`, jamais par un `useEffect`
  ni par `react-helmet`.

## 3. Contenu du graphe home

- `SoftwareApplication` (`#software`) : l'offre SaaS, éditeur = `ORGANIZATION_REF`.
- `ItemList` **outils** : catalogue public des 14 outils, console incluse ou non, chacun
  avec `name`, `url` et description factuelle. Contient notamment **Marina** (`/marina`)
  et **Matrice Concurrence** (`/matrice-concurrence`).
- `ItemList` **API** : les 3 API (`crw_live_`, `mk_live_`, `prm_live_`) + SDK TypeScript.
- `FAQPage` : questions défendant explicitement le positionnement
  « SaaS spécialisé qui mesure » vs « IA généraliste qui déduit » (Claude Code / Cowork),
  la disponibilité de Marina en API et le fonctionnement de la Matrice Concurrence.

Toute nouveauté produit (outil, API, argument de positionnement) doit être ajoutée dans
`TOOLS` / la FAQ de `homeSchemas.ts` **et** dans `public/llms.txt` **et** au sitemap.

## 4. Découvrabilité machine

| Surface | Emplacement | Règle |
| --- | --- | --- |
| Sitemap | `src/routes/sitemap[.]xml.ts` + table `sitemap_entries` | 141 URLs. Les nouvelles pages publiques s'ajoutent en base (`domain='crawlers.fr'`, `is_active=true`), pas en dur. |
| `llms.txt` | `public/llms.txt` | Liste Matrice Concurrence, `/developers` et les 3 docs API (`/docs/api/crawlers|marina|parmenion`). |
| Politique IA | `public/.well-known/ai-crawler-policy.json` | `default: allow`, aucun rate-limit sur les UA IA listés. |

## 5. Vérification

```bash
curl -s http://localhost:8080/ | grep -o 'application/ld+json'      # présence SSR
curl -s http://localhost:8080/sitemap.xml | grep -c '<loc>'          # nombre d'URLs
```

Un graphe qui n'apparaît qu'après hydratation est un **bug**, pas un détail : il doit être
lisible dans le HTML brut retourné par `curl`.
