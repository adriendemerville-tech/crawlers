# Plan d'optimisation — Performances mobile crawlers.fr

Baseline PageSpeed du 24/08 13:10 (Moto G Power, 4G lente) : Performances **73**, Accessibilité **96**, Bonnes pratiques **100**, SEO **100**, Navigation agentique **3/3**.

Diagnostic clé : le serveur n'est pas en cause (TTFB 10 ms). Le LCP de 5,9 s est composé à **2 870 ms de « délai d'affichage de l'élément »** — c'est-à-dire l'attente du CSS bloquant puis de l'hydratation React. Tout le déficit est donc dans le poids des assets et le cache, pas dans le backend.

Objectif : Performances **> 88** et LCP **< 2,8 s** sur mobile, sans toucher au SEO/GEO (déjà à 100 et 3/3).

---

## Lot 1 — Cache des polices (gain immédiat, risque nul)

Constat : `inter-latin-wght-normal.woff2` (48 KiB), `space-grotesk-latin-wght-normal.woff2` (22 KiB) et `fonts-deferred.css` sont servis **sans aucun TTL** (78 Kio à retélécharger à chaque visite), alors que `public/_headers` déclare bien `immutable` sur `/*.woff2`. Le fichier `_headers` n'est donc pas appliqué par l'hébergement Worker actuel.

Action : poser les en-têtes de cache dans le middleware serveur (`src/server.ts`) pour les chemins `/fonts/*`, `/fonts-deferred.css` et `/assets/*` — `public, max-age=31536000, immutable`. Conserver `_headers` pour compatibilité, mais ne plus s'y fier.

Gain attendu : suppression des 78 Kio sur visite répétée, ~300 ms sur le rendu de deuxième visite.

## Lot 2 — CSS critique (LCP direct)

Constat : `styles-CC0kqELu.css` fait **55,5 KiB** et bloque le rendu 1 680 ms ; `fonts-deferred.css` ajoute 460 ms de blocage alors qu'il est censé être différé (il est déclaré `rel: stylesheet` dans `__root.tsx`, donc bloquant).

Actions :
1. Charger `/fonts-deferred.css` en non bloquant (`media="print"` + bascule `onload`, ou `rel="preload" as="style"`) — il porte des polices d'affichage secondaires, pas le premier rendu.
2. Réduire le CSS initial : audit des utilitaires générés par Tailwind v4 et suppression du CSS mort (composants de console/admin chargés sur la home publique).

Gain attendu : ~310 ms d'économie annoncée par Lighthouse, plus la part de LCP libérée.

## Lot 3 — Bundle JavaScript (le vrai levier sur le LCP)

Constat : 146 Kio de JS inutilisé sur 431,9 KiB, dont
- `index-Cyr2eyzS.js` — 340,7 KiB, 81,7 inutilisés,
- `client-Cnp0jd2q.js` — 51,9 KiB dont **41,8 inutilisés (80 %)**,
- `es-DWQ9g1ev.js` — 39,3 KiB, chargé alors que la page est en français.

Actions :
1. Sortir les traductions **es** (et **en**) du chargement initial : import dynamique par langue au lieu d'un bundle unique.
2. Découper `index` : les modules Console / Marina / Parménion ne doivent pas entrer dans le chunk de la home. Vérifier les imports statiques remontant depuis les composants de landing.
3. Différer les 3 tâches longues du thread principal identifiées (initialisation analytics/GTM et bootstrap de contexte).

Gain attendu : le plus gros contributeur des 2 870 ms de délai d'affichage. C'est ce lot qui fait passer les 73 au-dessus de 85.

## Lot 4 — Accessibilité 96 → 100

Un seul échec réel : **contraste insuffisant** sur le bloc « L'approche Crawlers » (`text-primary-foreground` sur fond violet) et sur le libellé de la conversation Claude. Correction par ajustement du token de contraste, dans le respect de la palette violet / or / noir / blanc.

## Lot 5 — Durcissement (Bonnes pratiques, réserves non notées)

- CSP effective contre le XSS et protection clickjacking via `frame-ancestors` (aujourd'hui seulement `X-Frame-Options`).
- Trusted Types pour le XSS DOM.
- Publier les **source maps** de `index-*.js` (manquantes, signalées par Lighthouse) — améliore aussi le débogage en production.

---

## Ordre d'exécution recommandé

1. Lot 1 (rapide, mesurable, sans risque)
2. Lot 2
3. Lot 3 (le plus long, le plus rentable)
4. Lot 4
5. Lot 5

Après les lots 1 à 3, nouveau passage PageSpeed sur la même URL pour comparer à la baseline 73 / LCP 5,9 s.

## Ce que je ne touche pas

SEO (100), Navigation agentique (3/3), JSON-LD `#organization`, robots.txt, `ai-crawler-policy.json`, CLS (0,002) et TBT (70 ms) : déjà conformes, aucune intervention.
