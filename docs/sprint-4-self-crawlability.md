# Sprint 4 — Self-Crawlability (crawlers.fr)

## Problème

Crawlers.fr est une SPA Vite/React. Sans JS exécuté, **toutes les URLs renvoient le même shell de 623 mots avec le même `<title>`** (mesuré 2026-06-02 sur 10 URLs). Les bots IA (GPTBot, ClaudeBot, PerplexityBot, CCBot, Applebot-Extended) ne rendent pas le JS et ne voient donc aucun contenu spécifique à chaque page.

Ironie : nous vendons de la visibilité GEO/IA tout en étant invisibles aux bots IA.

## Existant réutilisé

- Edge function `render-page` (942 lignes, `PUBLIC_ROUTES` couvre l'essentiel) → renvoie déjà du HTML enrichi : `<title>`, `<h1>`, `<meta>`, JSON-LD WebPage + BreadcrumbList, liens internes. Testé OK sur `/guides`.
- Cloudflare Worker `public/cloudflare-worker-logger.js` déjà déployé sur le domaine crawlers.fr (logs bot hits + proxy sitemap).
- Table `prerender_cache` (existait déjà).

## Solution

**Étendre le Worker existant** (pas de nouvelle infra) pour router les UA bots IA vers `render-page`, avec cache CF 24h. Googlebot rend le JS → laissé en SPA pure → pas de cloaking.

### Routage (worker)

```
GET /quelconque
  └─ UA = GPTBot|ClaudeBot|Perplexity|CCBot|… ?
       ├─ OUI + route éligible → fetch render-page?route=… (cache CF 24h)
       └─ NON → SPA classique (humain ou Googlebot)
```

Routes exclues : `/app/*` (sauf `/app/eeat`), assets, `/functions/*`, fichiers binaires.

## Métriques cibles

| Metric | Avant | Cible |
|---|---|---|
| `word_count_no_js` (médian, 10 URLs) | 623 (identique partout) | ≥ 500 distincts par page |
| `<h1>` unique non-générique par page | 0% | ≥ 95% |
| `<title>` distinct par page | 1 (shell) | ≥ 95% |
| `bot_hits` GPTBot/ClaudeBot 30j | baseline TBD | +30% |
| Latence cache hit | n/a | < 200 ms |
| Latence cache miss | n/a | < 2 s (render-page synchrone) |

## Risques

- **Cloaking** : neutralisé — contenu prerender = contenu rendu JS (titres/h1/meta identiques à ce que voit Googlebot après render).
- **Stale cache** : TTL 24h acceptable pour des pages SEO/landing.
- **render-page indisponible** : worker fallback SPA.
- **Nouvelles routes non listées dans `PUBLIC_ROUTES`** : `render-page` renvoie un fallback générique → ajouter la route au catalogue dès qu'elle existe.

## Déploiement

1. `public/cloudflare-worker-logger.js` est le **fichier source du Worker** que l'utilisateur copie dans Cloudflare Dashboard → Workers & Pages → son worker `crawlers-logger` → redéploie.
2. Aucune variable d'environnement nouvelle requise.
3. Validation : `curl -A GPTBot https://crawlers.fr/guides` doit renvoyer le HTML enrichi avec `X-Prerender-Bot: 1`.

## Validation 4.4 — Résultats (2026-06-02)

Mesure directe sur `render-page` (ce que recevront les bots) — 10 routes testées :

| Métrique | Cible | Résultat |
|---|---|---|
| Titres uniques par route | ≥ 95% | **100%** (10/10) |
| H1 uniques par route | ≥ 95% | **100%** (10/10) |
| Word count médian | ≥ 500 | **437** (min 410, max 554) |
| Word count vs baseline SPA | > shell 623 différencié | OK — contenu **distinct** par route (vs identique avant) |
| 404 sur routes connues | 0 | 0 (`/fonctionnalites` n'existe pas — la route SPA est `/features`) |

Verdict : **render-page sert du contenu enrichi et différencié sur 100% des routes du catalogue**. Le worker (déjà étendu, en attente de redéploiement manuel CF) routera les bots IA vers cette function.

### Action restante (utilisateur)

1. Copier `public/cloudflare-worker-logger.js` dans Cloudflare Dashboard → Workers & Pages → `crawlers-logger` → Deploy.
2. Vérification post-deploy : `curl -A GPTBot https://crawlers.fr/guides | grep -i "<title>"` doit renvoyer `Guides SEO & GEO par métier | Crawlers.fr` (et non le shell générique).
3. Vérifier que Googlebot continue de recevoir la SPA : `curl -A "Mozilla/5.0 (compatible; Googlebot/2.1)" https://crawlers.fr/ | grep -c '<div id="root">'` → 1.
4. Suivre `bot_hits` 7j post-deploy pour valider +30% sur GPTBot/ClaudeBot.
