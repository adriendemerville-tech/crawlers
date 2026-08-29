# Suivi Lighthouse mobile (TTFB / LCP / INP-proxy)

Méthode : `lighthouse <url> --form-factor=mobile --screenEmulation.mobile --only-categories=performance`
(Chromium headless, lab data. INP n'est pas mesurable en lab → on suit TBT + TTI comme proxy.)

## Baseline — 2026-08-29 (post cache edge + assets immutable)

| Page | Perf | TTFB doc | FCP | LCP | TBT | CLS | Speed Index | TTI | Poids total |
|---|---|---|---|---|---|---|---|---|---|
| `/` | 59 | 1 790 ms | 3,2 s | 4,0 s | 770 ms | 0,003 | 5,2 s | 5,6 s | 832 Ko |
| `/audit-expert` | 46 | 1 800 ms | 2,8 s | 8,0 s | 670 ms | 0,018 | 9,9 s | 18,7 s | 6 830 Ko |
| `/audit-geo` | 75 | 1 790 ms | 3,2 s | 3,6 s | 310 ms | 0,003 | 4,8 s | 4,4 s | 593 Ko |

### Constats
- **TTFB ~1,8 s identique sur les 3 pages** : le cache edge ne sert pas (premier hit / MISS CDN). C'est le plafond commun de toutes les métriques.
- **`/` : l'élément LCP est le `h2` du hero**, pas l'image du carrousel préchargée → le `preload fetchpriority=high` de `console-pilotage.png` ne sert pas le LCP. À réévaluer.
- **`/audit-expert` : 6,8 Mo et TTI 18,7 s** — le pire point. L'autolaunch d'audit + JS non utilisé (301 Ko) plombent l'interactivité.
- **CLS bon partout** (≤ 0,018) : les skeletons à hauteur réservée font leur travail.
- **TBT 770 ms sur `/`** : encore trop de JS hydraté au-dessus de la ligne de flottaison.

### Pistes prioritaires (non implémentées)
1. TTFB : vérifier le taux de HIT edge (`cf-cache-status`) et étendre `s-maxage` au-delà de 300 s sur les pages figées.
2. `/` : soit préinliner le texte du hero (déjà SSR) et supprimer le preload image inutile, soit rendre l'image réellement LCP.
3. `/audit-expert` : différer tout le JS d'audit jusqu'à l'interaction, réduire le poids initial (6,8 Mo).

## Historique

_(ajouter une ligne par run : date, page, TTFB, LCP, TBT, changement testé)_
